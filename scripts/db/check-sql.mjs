// Checks SQL passed to query() / queryOne() / batch() against the SQLite schema: every literal
// query is prepared (catches syntax errors and unknown tables/columns) and Postgres-only syntax is
// flagged. Queries built from ${...} fragments are prepared with NULL in place of each fragment
// and reported as "dynamic" if that fails, since the fragment may be SQL.
// Run: node scripts/db/check-sql.mjs [paths...]   (default: src scripts)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const POSTGRES_ONLY = [
  [/\bNOW\(\)/i, "NOW()"],
  [/::\s*[a-z]/i, ":: cast"],
  [/=\s*ANY\s*\(/i, "= ANY(...)"],
  [/<>\s*ALL\s*\(/i, "<> ALL(...)"],
  [/\bINTERVAL\s+'/i, "INTERVAL"],
  [/\bFOR\s+UPDATE\b/i, "FOR UPDATE"],
  [/\bFOR\s+SHARE\b/i, "FOR SHARE"],
  [/\bSKIP\s+LOCKED\b/i, "SKIP LOCKED"],
  [/\bILIKE\b/i, "ILIKE"],
  [/\bDISTINCT\s+ON\b/i, "DISTINCT ON"],
  [/\bpg_advisory/i, "advisory lock"],
  [/\bjsonb_|\bjson_(build|agg|array_elements|strip|typeof)\b/i, "jsonb function"],
  [/->>?/, "JSON operator"],
  [/\bto_char\(/i, "to_char"],
  [/\bgenerate_series\(/i, "generate_series"],
  [/\bdate_trunc\(/i, "date_trunc"],
  [/\bEXTRACT\s*\(/i, "EXTRACT"],
  [/\bmake_interval\(/i, "make_interval"],
  [/\bgen_random_uuid\(/i, "gen_random_uuid"],
  [/\barray_agg\(|\bARRAY\[|\bunnest\(/i, "array"],
  [/\bsealsend_personal_organization\(/i, "removed SQL function"],
  [/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;?\s*$/i, "transaction statement (use batch)"],
  [/\bGREATEST\(|\bLEAST\(/i, "GREATEST/LEAST (use max()/min())"],
  [/\bCURRENT_DATE\b/i, "CURRENT_DATE (returns local text, use strftime)"],
];

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ["src", "scripts"];
const files = [];
const walk = (path) => {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) if (name !== "node_modules") walk(join(path, name));
  } else if (/\.(ts|tsx|mts)$/.test(path) && !path.endsWith(".d.ts")) files.push(path);
};
roots.forEach(walk);

const db = new DatabaseSync(":memory:");
db.exec(readFileSync("src/lib/db/schema.sql", "utf8"));

const isQueryCall = (node) => {
  const callee = node.expression;
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
  return ["query", "queryOne"].includes(name);
};

function sqlOf(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { text: node.text, dynamic: false };
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) text += "NULL" + span.literal.text;
    return { text, dynamic: true };
  }
  return null;
}

const problems = [];
let checked = 0;
let dynamicSkipped = 0;
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    let candidate = null;
    if (ts.isCallExpression(node) && isQueryCall(node) && node.arguments[0]) candidate = node.arguments[0];
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "text") candidate = node.initializer;
    const sql = candidate && sqlOf(candidate);
    if (sql && /\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql.text)) {
      const line = source.getLineAndCharacterOfPosition(candidate.getStart()).line + 1;
      const where = `${file.replace(/\\/g, "/")}:${line}`;
      checked++;
      for (const [pattern, label] of POSTGRES_ONLY) if (pattern.test(sql.text)) problems.push(`${where}  postgres: ${label}`);
      try {
        db.prepare(sql.text.replace(/\$(\d+)/g, "?$1"));
      } catch (error) {
        if (sql.dynamic) dynamicSkipped++;
        else problems.push(`${where}  sqlite: ${error.message}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

console.log(problems.join("\n"));
console.log(`\n${checked} queries checked, ${problems.length} problems, ${dynamicSkipped} dynamic queries could not be prepared`);
process.exitCode = problems.length ? 1 : 0;
