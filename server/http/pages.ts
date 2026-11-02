import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

function routePattern(route: string): RegExp {
  if (route === "/") return /^\/$/;
  const segments = route.split("/").filter(Boolean).map(segment => {
    if (/^:[A-Za-z][A-Za-z0-9_]*$/.test(segment)) return "[^/]+";
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return new RegExp(`^/${segments.join("/")}/?$`);
}

export function servePublicPages(app: Express, directory: string): void {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, "manus-routes.json"), "utf8")
  ) as { routes: { path: string }[] };
  const pages = manifest.routes.map(item => routePattern(item.path));
  app.use(
    express.static(directory, {
      index: false,
      fallthrough: true,
      dotfiles: "deny",
      maxAge: 0,
    })
  );
  app.get("*", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (path.extname(req.path)) {
      return res.status(404).type("text/plain").send("Not found");
    }
    const declared = pages.some(pattern => pattern.test(req.path));
    return res
      .status(declared ? 200 : 404)
      .sendFile(path.join(directory, "index.html"));
  });
}
