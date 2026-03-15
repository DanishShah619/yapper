import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@nexchat.dev' },
    update: {},
    create: {
      email: 'alice@nexchat.dev',
      username: 'alice',
      passwordHash,
      avatarUrl: null,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@nexchat.dev' },
    update: {},
    create: {
      email: 'bob@nexchat.dev',
      username: 'bob',
      passwordHash,
      avatarUrl: null,
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@nexchat.dev' },
    update: {},
    create: {
      email: 'charlie@nexchat.dev',
      username: 'charlie',
      passwordHash,
      avatarUrl: null,
    },
  });

  console.log('✅ Seeded users:', { alice: alice.id, bob: bob.id, charlie: charlie.id });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
