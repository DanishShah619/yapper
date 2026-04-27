import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Use structured logging in production; avoid console.log
  if (process.env.NODE_ENV !== 'production') {
    console.info('🌱 Seeding database...');
  }

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

  // Avoid logging sensitive user data in production
  if (process.env.NODE_ENV !== 'production') {
    console.info('✅ Seeded users:', { alice: alice.id, bob: bob.id, charlie: charlie.id });
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
