import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function getDbUrl(): string {
  const raw = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const filePath = raw.replace(/^file:/, "");
  if (path.isAbsolute(filePath)) {
    return `file:${filePath}`;
  }
  const resolved = path.join(process.cwd(), filePath.startsWith("./") ? filePath.slice(2) : filePath);
  return `file:${resolved}`;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaLibSql({ url: getDbUrl() });
  return new PrismaClient({ adapter } as never);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
