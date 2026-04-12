import postgres from "postgres";

export type Sql = postgres.Sql;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
}

export function createSql(url?: string): Sql {
  const resolvedUrl = url ?? getDatabaseUrl();
  return postgres(resolvedUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}
