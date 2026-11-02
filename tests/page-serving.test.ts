import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { servePublicPages } from "../server/http/pages";
describe("static page boundary, no private data", () => {
  it("serves declared pages, manifest and 404 without turning missing assets into HTML 200", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "civica-page-test-"));
    await writeFile(
      path.join(dir, "index.html"),
      '<!doctype html><html lang="pt-BR"><body>Protocol HTML test</body></html>'
    );
    await writeFile(
      path.join(dir, "manus-routes.json"),
      JSON.stringify({ routes: [{ path: "/" }, { path: "/acesso" }, { path: "/propostas/:id" }] })
    );
    const app = express();
    servePublicPages(app, dir);
    expect((await request(app).get("/")).status).toBe(200);
    expect((await request(app).get("/acesso")).status).toBe(200);
    expect((await request(app).get("/propostas/550e8400-e29b-41d4-a716-446655440000")).status).toBe(200);
    expect(
      (await request(app).get("/manus-routes.json")).headers["content-type"]
    ).toContain("application/json");
    expect((await request(app).get("/404")).status).toBe(404);
    expect((await request(app).get("/not-a-real-page")).status).toBe(404);
    const missing = await request(app).get("/missing.js");
    expect(missing.status).toBe(404);
    expect(missing.text).not.toContain("Protocol HTML test");
  });
});
