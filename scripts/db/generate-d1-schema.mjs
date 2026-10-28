// Generates src/lib/db/schema.d1.sql (SQLite/D1) from the Postgres schema: loads schema.sql and
// apply-security-indexes.sql into PGlite, reads the final tables back, and rewrites them for SQLite.
// Run: node scripts/db/generate-d1-schema.mjs   (one-off for the D1 port; see docs/d1-port.md)
import { readFileSync, writeFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const SCHEMA = "src/lib/db/schema.sql";
const UPGRADE = "apply-security-indexes.sql";
const OUT = "src/lib/db/schema.d1.sql";

async function introspect() {
  const stripExtensions = (sql) => sql.replace(/^CREATE EXTENSION.*$/gm, "");
  const pg = new PGlite();
  await pg.exec(stripExtensions(readFileSync(SCHEMA, "utf8")));
  await pg.exec(stripExtensions(readFileSync(UPGRADE, "utf8")));
  await pg.exec(stripExtensions(readFileSync(SCHEMA, "utf8")));
  const rows = async (sql) => (await pg.query(sql)).rows;
  const tables = await rows(`SELECT c.relname AS name, c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.oid`);
  for (const table of tables) {
    table.cols = await rows(`SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull,
      pg_get_expr(d.adbin, d.adrelid) AS def FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = ${table.oid} AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`);
    table.cons = await rows(`SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = ${table.oid} ORDER BY contype, conname`);
    table.idx = await rows(`SELECT i.relname AS name, pg_get_indexdef(i.oid) AS def,
      EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.oid AND k.conrelid = x.indrelid AND k.contype IN ('p', 'u')) AS backs_constraint
      FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid WHERE x.indrelid = ${table.oid} ORDER BY i.relname`);
  }
  await pg.close();
  return tables;
}

const tables = await introspect();
const oldSchema = readFileSync(SCHEMA, "utf8").split(/\r?\n/);
const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";
const UUID =
  "(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || " +
  "substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))";

const REGEX = {
  "^[a-f0-9]{64}$": (c) => `(length(${c}) = 64 AND ${c} NOT GLOB '*[^a-f0-9]*')`,
  "^host-[a-f0-9]{12}$": (c) => `(length(${c}) = 17 AND ${c} GLOB 'host-*' AND substr(${c}, 6) NOT GLOB '*[^a-f0-9]*')`,
  "^[a-z0-9][a-z0-9-]{2,63}$": (c) => `(length(${c}) BETWEEN 3 AND 64 AND ${c} GLOB '[a-z0-9]*' AND ${c} NOT GLOB '*[^a-z0-9-]*')`,
  "^#[0-9A-Fa-f]{6}$": (c) => `(length(${c}) = 7 AND ${c} GLOB '#*' AND substr(${c}, 2) NOT GLOB '*[^0-9A-Fa-f]*')`,
};

function sqlExpr(expr) {
  let out = expr
    .replace(/\(ARRAY\[([^\]]*)\]\)/g, (_, items) => `(${items})`)
    .replace(/ = ANY \(/g, " IN (")
    .replace(/'((?:[^']|'')*)'::[a-z ]+(\[\])?/g, "'$1'")
    .replace(/::[a-z ]+(\[\])?/g, "")
    .replace(/\bchar_length\(/g, "length(")
    .replace(/\bjsonb_array_length\(/g, "json_array_length(")
    .replace(/\bcardinality\(/g, "json_array_length(")
    .replace(/ = true\b/g, " = 1")
    .replace(/ = false\b/g, " = 0");
  out = out.replace(/(\w+) ~ '([^']+)'/g, (match, col, pattern) => {
    const rewrite = REGEX[pattern];
    if (!rewrite) throw new Error(`No GLOB rewrite for ${match}`);
    return rewrite(col);
  });
  if (/::|ARRAY|ANY|~/.test(out)) throw new Error(`Untranslated expression: ${out}`);
  return out;
}

function columnType(pgType) {
  if (pgType === "uuid" || pgType === "text") return "TEXT";
  if (pgType.startsWith("timestamp")) return "TIMESTAMP_TEXT";
  if (pgType === "jsonb" || pgType.endsWith("[]")) return "JSON_TEXT";
  if (pgType === "boolean") return "BOOLEAN";
  if (pgType === "date") return "DATE_TEXT";
  if (pgType === "integer" || pgType === "bigint") return "INTEGER";
  if (pgType === "double precision") return "REAL";
  throw new Error(`Unmapped type ${pgType}`);
}

function columnDefault(def) {
  if (def === "now()") return NOW;
  if (def === "gen_random_uuid()") return UUID;
  if (def === "true") return "1";
  if (def === "false") return "0";
  if (/^-?\d+$/.test(def)) return def;
  const array = def.match(/^ARRAY\[(.*)\]$/);
  if (array) return `'${JSON.stringify(array[1].split(",").map((item) => item.trim().replace(/^'(.*)'::text$/, "$1")))}'`;
  const literal = def.match(/^'((?:[^']|'')*)'::(text|jsonb)$/);
  if (literal) return `'${literal[1]}'`;
  throw new Error(`Unmapped default ${def}`);
}

// The comment block directly above `CREATE TABLE IF NOT EXISTS <name>` in the old schema, if any.
function commentsFor(name) {
  const at = oldSchema.findIndex((line) => line.startsWith(`CREATE TABLE IF NOT EXISTS ${name} (`));
  if (at < 0) return [];
  const lines = [];
  for (let i = at - 1; i >= 0; i--) {
    const line = oldSchema[i];
    if (line.startsWith("--")) lines.unshift(line);
    else if (line.trim() === "" && lines.length === 0 && i === at - 1) continue;
    else break;
  }
  return lines;
}

const out = [
  "-- SealSend schema for Cloudflare D1 (SQLite). Idempotent: safe to re-run.",
  "--",
  "-- Storage conventions (src/lib/db/sqlite-dialect.ts turns values back into the JS types the app expects):",
  "--   ids         TEXT (UUID strings; the default makes a random v4 UUID)",
  "--   timestamps  TIMESTAMP_TEXT, ISO-8601 UTC like 2026-10-28T14:00:00.000Z (same as Date.toISOString())",
  "--   booleans    BOOLEAN, stored as 0/1",
  "--   JSON        JSON_TEXT, JSON text (also used for the former TEXT[] columns)",
  "--   dates       DATE_TEXT, YYYY-MM-DD",
  "-- Every declared type above keeps TEXT or NUMERIC affinity, so SQLite never rewrites stored values.",
  "",
];

for (const table of tables) {
  const comments = commentsFor(table.name);
  if (comments.length) out.push(...comments);
  const pk = table.cons.find((c) => c.contype === "p");
  const pkCols = pk ? pk.def.match(/\(([^)]*)\)/)[1].split(",").map((s) => s.trim()) : [];
  const lines = [];
  let inlinePk = false;
  for (const col of table.cols) {
    if (col.def?.startsWith("nextval(")) {
      lines.push(`  ${col.name} INTEGER PRIMARY KEY AUTOINCREMENT`);
      inlinePk = true;
      continue;
    }
    let line = `  ${col.name} ${columnType(col.type)}`;
    if (col.notnull && !(pkCols.length === 1 && pkCols[0] === col.name)) line += " NOT NULL";
    if (pkCols.length === 1 && pkCols[0] === col.name) line += " PRIMARY KEY";
    if (col.def) line += ` DEFAULT ${columnDefault(col.def)}`;
    lines.push(line);
  }
  if (pkCols.length > 1 && !inlinePk) lines.push(`  PRIMARY KEY (${pkCols.join(", ")})`);
  for (const con of table.cons) {
    if (con.contype === "u") lines.push(`  ${con.def}`);
    else if (con.contype === "f") lines.push(`  ${con.def}`);
    else if (con.contype === "c") {
      const generated = /_check\d*$/.test(con.conname) && !con.conname.includes("notification_type") && !con.conname.includes("event_name");
      const prefix = generated ? "" : `CONSTRAINT ${con.conname} `;
      lines.push(`  ${prefix}CHECK ${sqlExpr(con.def.replace(/^CHECK /, ""))}`);
    }
  }
  out.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`, lines.join(",\n"), ");");
  for (const index of table.idx) {
    if (index.backs_constraint) continue;
    const m = index.def.match(/^CREATE (UNIQUE )?INDEX (\w+) ON public\.(\w+) USING btree \((.*?)\)( WHERE (.*))?$/);
    if (!m) throw new Error(`Unparsed index ${index.def}`);
    const [, unique = "", name, tbl, cols, , where] = m;
    out.push(`CREATE ${unique}INDEX IF NOT EXISTS ${name} ON ${tbl} (${sqlExpr(cols)})${where ? ` WHERE ${sqlExpr(where)}` : ""};`);
  }
  out.push("");
}

out.push(
  "-- New events default to the owner's personal workspace (created with the owner membership on first use).",
  "-- SQLite can't change NEW in a BEFORE trigger, so this runs AFTER INSERT. An INSERT ... RETURNING",
  "-- organization_id therefore still returns NULL; read the row again when you need it.",
  "CREATE TRIGGER IF NOT EXISTS events_default_organization AFTER INSERT ON events",
  "WHEN NEW.organization_id IS NULL",
  "BEGIN",
  "  INSERT OR IGNORE INTO organizations (name, slug, is_personal, created_by)",
  "    SELECT COALESCE(NULLIF(TRIM(u.name), ''), 'My events'), 'personal-' || REPLACE(u.id, '-', ''), 1, u.id",
  "    FROM admin_users u WHERE u.id = NEW.user_id;",
  "  INSERT OR IGNORE INTO organization_members (organization_id, user_id, role)",
  "    SELECT id, NEW.user_id, 'owner' FROM organizations WHERE created_by = NEW.user_id AND is_personal = 1;",
  "  UPDATE events SET organization_id = (SELECT id FROM organizations WHERE created_by = NEW.user_id AND is_personal = 1)",
  "    WHERE id = NEW.id;",
  "END;",
  "",
  "-- Keep deleted file paths through cascades and retry explicit photo erasure.",
  "CREATE TRIGGER IF NOT EXISTS queue_deleted_social_photo AFTER DELETE ON event_social_photos",
  "BEGIN",
  "  INSERT OR IGNORE INTO event_social_file_cleanup (storage_path) VALUES (OLD.storage_path);",
  "END;",
  "",
);

writeFileSync(OUT, out.join("\n"));
console.log(`wrote ${tables.length} tables to ${OUT}`);
