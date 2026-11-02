import { createServer } from "node:http";
import path from "node:path";
import { assertTestDatabase } from "../adapters/config";
import { MysqlCivicRepository } from "../civic/adapters/mysql-repository";
import { PostgresCivicRepository } from "../civic/adapters/postgres-repository";
import { createCivicApp } from "../civic/http/app";
import { loadCivicHttpConfig } from "../civic/http/config";
import { servePublicPages } from "../http/pages";

async function start() {
  if (process.env.NODE_ENV === "development") await import("dotenv/config");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("database_not_configured");

  const databaseProtocol = new URL(databaseUrl).protocol;
  const repository = databaseProtocol === "mysql:" && process.env.CIVICA_TEST_MODE === "1"
    ? (assertTestDatabase(databaseUrl), new MysqlCivicRepository(databaseUrl))
    : databaseProtocol === "postgres:" || databaseProtocol === "postgresql:"
      ? new PostgresCivicRepository(databaseUrl)
      : (() => { throw new Error("database_configuration_invalid"); })();
  const config = loadCivicHttpConfig(process.env);
  const app = createCivicApp({ repository, config });
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  } else {
    servePublicPages(app, path.resolve(import.meta.dirname, "public"));
  }

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("invalid_port");
  }
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.listen(port, "0.0.0.0", () => {
    console.log("Cívica: runtime cívico iniciado; nenhuma identidade civil foi coletada.");
  });

  const shutdown = () => {
    server.close(() => {
      void repository.close().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch(() => {
  console.error("Cívica: inicialização bloqueada. Confira banco e configuração; nenhum segredo foi exibido.");
  process.exit(1);
});
