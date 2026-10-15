import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getClient() {
  // Cached in every environment: building a client opens a new connection pool, and on a remote database
  // each fresh connection costs a TCP + TLS handshake on top of the query itself.
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

// Lazy so unit tests can import modules that touch this file without a database.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
