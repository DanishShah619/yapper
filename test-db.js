const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log("DB connected successfully", result);
  } catch (err) {
    console.error("DB connection failed", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
