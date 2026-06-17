const fs = require('fs');
const path = require('path');

// Load .env manually (simple parser) so script can run without extra deps
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      // remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // The single manager/admin account. Override via .env (ADMIN_USERNAME /
  // ADMIN_PASSWORD / ADMIN_FULLNAME) to set your own credentials.
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@2026';
  const fullName = process.env.ADMIN_FULLNAME || 'Administrator';

  console.log('Seeding admin user:', username);

  const passwordHash = await bcrypt.hash(password, 10);

  // Upsert so re-running the seed updates the password instead of failing.
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash, fullName },
    create: { username, passwordHash, fullName },
  });

  console.log('Admin user is ready.');
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
