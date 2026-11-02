import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import { Pool } from "pg";
import { PostgresCivicRepository } from "./server/civic/adapters/postgres-repository";
import { createCivicApp } from "./server/civic/http/app";
import { loadCivicHttpConfig } from "./server/civic/http/config";

type WorkerEnv = Env & {
  CIVICA_ORIGIN?: string;
  CIVICA_TEST_MODE?: string;
};

const workerEnv = env as WorkerEnv;
const pool = new Pool({
  connectionString: workerEnv.HYPERDRIVE.connectionString,
  max: 5,
  idleTimeoutMillis: 20_000,
});
const repository = new PostgresCivicRepository(pool);
const app = createCivicApp({
  repository,
  config: loadCivicHttpConfig({
    NODE_ENV: "production",
    CIVICA_ORIGIN: workerEnv.CIVICA_ORIGIN,
    CIVICA_TEST_MODE: workerEnv.CIVICA_TEST_MODE,
    MANUS_API_URL: workerEnv.MANUS_API_URL,
    MANUS_API_BROWSER_KEY: workerEnv.MANUS_API_BROWSER_KEY,
  }),
});

app.listen(3000);

export default httpServerHandler({ port: 3000 });
