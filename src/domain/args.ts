import { networkInterfaces } from "os";

export interface ServerOptions {
  port: number;
  host: string;
  dbPath?: string;
}

export function parseArgs(defaults: { port: number; portEnv: string }): ServerOptions {
  const args = process.argv.slice(2);
  let port = Number(process.env[defaults.portEnv]) || defaults.port;
  let host = process.env.HOME_HOST ?? "0.0.0.0";
  let dbPath: string | undefined = process.env.SQLITE_PATH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) port = Number(args[++i]);
    if (args[i] === "--host" && args[i + 1]) host = args[++i];
    if (args[i] === "--sqlite-path" && args[i + 1]) dbPath = args[++i];
  }

  return { port, host, dbPath };
}

export function getNetworkAddress(): string | undefined {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
}

export function parseCorsOrigins(envValue?: string): (origin: string) => boolean {
  if (!envValue) {
    return (origin) => {
      try {
        const url = new URL(origin);
        return url.hostname === "localhost" || url.hostname === "127.0.0.1";
      } catch {
        return false;
      }
    };
  }
  if (envValue.trim() === "*") return () => true;
  const allowed = new Set(envValue.split(",").map(s => s.trim()).filter(Boolean));
  return (origin) => allowed.has(origin);
}

export function logListening(name: string, host: string, port: number): void {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.error(`${name} listening on http://${displayHost}:${port}`);
  if (host === "0.0.0.0") {
    const networkAddr = getNetworkAddress();
    if (networkAddr) {
      console.error(`${name} network: http://${networkAddr}:${port}`);
    }
  }
}
