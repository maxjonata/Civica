import type { Express } from "express";
import type { Server } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
export async function setupVite(app: Express, server: Server): Promise<void> {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: { ...viteConfig.server, middlewareMode: true, hmr: { server } },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.get("*", (req, res, next) => {
    void fs
      .readFile(
        path.resolve(import.meta.dirname, "../../client/index.html"),
        "utf8"
      )
      .then(html => vite.transformIndexHtml(req.originalUrl, html))
      .then(html =>
        res
          .status(req.path === "/404" ? 404 : 200)
          .type("html")
          .send(html)
      )
      .catch(next);
  });
}
