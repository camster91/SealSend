import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrate: {
    async url() {
      return process.env.DATABASE_URL || 'postgresql://sealsend:Seal2026!@10.0.1.30:5432/sealsend';
    },
  },
});
