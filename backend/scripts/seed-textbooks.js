const fs = require('fs');
const path = require('path');

// Load .env manually (simple parser) so script can run without extra deps.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Starter catalog so the "Textbook Name" dropdown is populated for development.
const TEXTBOOKS = [
  { textbookName: 'Level 3 Diploma in Health and Social Care (RQF)', subject: 'Health and Social Care' },
  { textbookName: 'Grade 10 Mathematics Revision Copy', subject: 'Mathematics' },
  { textbookName: 'Introduction to Business Studies', subject: 'Business' },
  { textbookName: 'English Language and Literature', subject: 'English' },
  { textbookName: 'Foundations of Computer Science', subject: 'Computing' },
];

async function main() {
  console.log('Seeding textbook catalog...');

  for (const textbook of TEXTBOOKS) {
    const existing = await prisma.textbook.findFirst({
      where: { textbookName: textbook.textbookName },
    });
    if (existing) {
      console.log(`Skipping existing textbook: ${textbook.textbookName}`);
      continue;
    }
    await prisma.textbook.create({ data: textbook });
    console.log(`Created textbook: ${textbook.textbookName}`);
  }

  console.log('Textbook catalog seeding complete.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
