import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const suffix = randomBytes(8).toString("hex");
const database = `civica_test_browser_${suffix}`;
const username = `cb_${randomBytes(6).toString("hex")}`;
const password = randomBytes(24).toString("hex");
const databaseUrl = `mysql://${username}:${password}@127.0.0.1/${database}`;
const port = 4100;
const origin = `http://127.0.0.1:${port}`;
const envBase = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8" };
let server;
let browser;

function assertChild(result, label) {
  if (result.status !== 0) throw new Error(`${label} failed; no managed database fallback was used.`);
}

async function checkAccessibility(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  if (results.violations.length) {
    console.error(
      JSON.stringify(
        results.violations.map(item => ({
          id: item.id,
          impact: item.impact,
          help: item.help,
          nodes: item.nodes.slice(0, 5).map(node => ({ target: node.target, summary: node.failureSummary })),
        })),
        null,
        2
      )
    );
    throw new Error(`axe found ${results.violations.length} violation group(s) on ${label}.`);
  }
  console.log(`axe: ${label} — zero violations in the selected WCAG tags.`);
}

const setup = spawnSync("sudo", ["mariadb", "--batch"], {
  input: `CREATE DATABASE ${database}; CREATE USER '${username}'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL ON ${database}.* TO '${username}'@'127.0.0.1';`,
  encoding: "utf8",
});
assertChild(setup, "Local isolated database setup");

const migration = spawnSync(process.execPath, ["scripts/migrate-civic.mjs"], {
  cwd: process.cwd(),
  env: { ...envBase, DATABASE_URL: databaseUrl },
  encoding: "utf8",
});
assertChild(migration, "Local civic migration");

try {
  server = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...envBase,
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
      CIVICA_ORIGIN: origin,
      CIVICA_TEST_MODE: "1",
      PORT: String(port),
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let startupError = "";
  server.stderr.on("data", () => {
    startupError = "production entrypoint reported a private startup error";
  });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      ready = response.status === 200;
      if (ready) break;
    } catch {
      // Only the local child server is expected to be unavailable during startup.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, `Local production server did not become healthy. ${startupError}`);

  const manifestResponse = await fetch(`${origin}/manus-routes.json`);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  const declaredRoutes = new Set(manifest.routes.map(route => route.path));
  for (const route of ["/", "/propostas", "/sugerir", "/propostas/:id", "/mapa", "/dados", "/conexoes", "/metodologia", "/privacidade", "/acessibilidade"]) {
    assert(declaredRoutes.has(route), `Missing declared route: ${route}`);
  }

  const systemChromium = await fs.access("/usr/bin/chromium").then(() => true).catch(() => false);
  browser = await chromium.launch({
    headless: true,
    ...(systemChromium ? { executablePath: "/usr/bin/chromium" } : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const pageErrors = [];
  const deferredFindings = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const sessionReady = page.waitForResponse(response => response.url().endsWith("/api/civic/session") && response.status() === 200);
  const home = await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  assert.equal(home?.status(), 200);
  await sessionReady;
  await page.getByRole("heading", { name: "Compreender propostas. Participar com transparência." }).waitFor();
  await checkAccessibility(page, "início");

  let createdRequestBody = null;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/civic/proposals" && request.method() === "POST") {
      createdRequestBody = JSON.parse(request.postData() ?? "{}");
    }
  });
  await page.route(url => new URL(url).pathname === "/api/civic/sources/states", route =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "official_source_unavailable" }) })
  );
  await page.route(url => new URL(url).pathname === "/api/civic/sources/municipalities", route =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "official_source_unavailable" }) })
  );
  await page.goto(`${origin}/sugerir`, { waitUntil: "networkidle" });
  await page.getByLabel("Título curto").fill("TESTE ISOLADO — travessia segura");
  await page.getByLabel("Resumo").fill("Proposta sintética restrita ao banco local do teste automatizado.");
  await page.getByLabel("O que aconteceu ou qual é a necessidade?").fill("Cenário automatizado; não descreve uma obra real.");
  await page.getByLabel("Qual mudança você gostaria de ver?").fill("Somente verificar o fluxo sem publicar dados no Preview.");
  await page.getByRole("button", { name: "Continuar" }).click();

  const defaultNoLocation = page.getByRole("radio", { name: /Ainda não sei \/ prefiro não informar/ });
  assert.equal(await defaultNoLocation.isChecked(), true, "Location disclosure must default to off");
  assert.equal(await page.getByLabel("Estado (UF)").count(), 0, "Locality controls must start hidden when location is omitted");
  const includeLocation = page.getByRole("radio", { name: /Informar o local/ });
  await includeLocation.check();
  await page.getByText(/Não foi possível carregar os estados do IBGE/).waitFor();
  await page.getByLabel("Estado (UF)").fill("RJ");
  await page.getByText(/Não foi possível carregar os municípios do IBGE/).waitFor();
  await page.getByLabel("Município", { exact: true }).fill("Rio de Janeiro");
  assert.equal(await page.getByLabel("Código IBGE do município").inputValue(), "", "IBGE code starts optional in manual fallback");
  await checkAccessibility(page, "localidade manual sem código IBGE");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("heading", { name: "Foto opcional" }).waitFor();
  await page.getByRole("button", { name: "Adicionar evidência" }).click();
  await page.getByLabel("Categoria da evidência 1").selectOption("legislation");
  await page.getByLabel("Natureza da evidência 1").selectOption("documented_fact");
  await page.getByLabel("Relação com a proposta 1").selectOption("supports");
  await page.getByLabel("Texto da evidência 1").fill("Registro público simulado persistido somente no banco local do teste.");
  await page.getByLabel("Título da fonte 1 (opcional)").fill("Fonte local isolada");
  await page.getByLabel("URL da fonte 1 (opcional)").fill("https://example.test/fonte-local");
  await page.getByLabel("Trecho da fonte 1 (opcional)").fill("Trecho de teste; não representa uma fonte consultada.");
  await page.getByLabel("Jurisdição ou local da fonte 1 (opcional)").fill("RJ");
  await page.getByLabel("Data da fonte 1 (opcional)").fill("2026-10-28");
  await page.getByRole("button", { name: "Voltar e corrigir" }).click();

  const noLocation = page.getByRole("radio", { name: /Ainda não sei \/ prefiro não informar/ });
  await noLocation.check();
  assert.equal(await noLocation.isChecked(), true, "Location disclosure remains off after opting out");
  assert.equal(await page.getByLabel("Estado (UF)").count(), 0, "Locality controls must be hidden when location is omitted");
  assert.equal(await page.getByLabel("Município", { exact: true }).count(), 0, "Municipality controls must be hidden when location is omitted");
  assert.equal(await page.getByLabel("Código IBGE do município").count(), 0, "Municipality code must be hidden when location is omitted");
  await checkAccessibility(page, "sugestão sem localidade");
  await page.getByRole("button", { name: "Continuar" }).click();
  await checkAccessibility(page, "formulário de sugestão sem localidade");

  await page.getByRole("button", { name: "Procurar relações" }).click();
  await page.getByText("Nenhuma relação foi encontrada.").waitFor();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Publicar esta proposta" }).click();
  const noticeError = page.getByRole("link", { name: "Confirme que entendeu a visibilidade antes de publicar." });
  await noticeError.waitFor();
  const noticeErrorTarget = await noticeError.getAttribute("href");
  assert.equal(noticeErrorTarget, "#field-public-notice");
  assert.equal(await page.locator(noticeErrorTarget).count(), 1, "Visibility error must target its actual control");
  await page.getByLabel("Entendi que o conteúdo poderá ser visto publicamente.").check();
  await page.getByRole("button", { name: "Publicar esta proposta" }).click();
  await page.getByRole("heading", { name: "Sua proposta foi recebida." }).waitFor();
  assert(page.url().startsWith(`${origin}/sugerir`));
  assert.deepEqual(createdRequestBody?.region, null, "Omitida locality must be sent as region null");
  assert.equal(Object.hasOwn(createdRequestBody ?? {}, "publicLocation"), false, "Omitida locality must not send publicLocation");
  assert.equal(createdRequestBody?.initialClaims?.length, 1, "Exactly one initial evidence item must be sent");
  assert.equal(createdRequestBody.initialClaims[0].statement, "Registro público simulado persistido somente no banco local do teste.");
  assert.equal(createdRequestBody.initialClaims[0].sourceTitle, "Fonte local isolada");
  assert.equal(createdRequestBody.initialClaims[0].sourceUrl, "https://example.test/fonte-local");

  const detailResponsePromise = page.waitForResponse(response => {
    const pathname = new URL(response.url()).pathname;
    return response.request().method() === "GET" && pathname.startsWith("/api/civic/proposals/") && response.status() === 200;
  });
  await page.getByRole("link", { name: "Ler a proposta" }).click();
  const detailResponse = await detailResponsePromise;
  const detailBody = await detailResponse.json();
  const persistedClaim = detailBody.claims?.find(claim => claim.statement === "Registro público simulado persistido somente no banco local do teste.");
  assert(persistedClaim, "The initial evidence must persist in the proposal detail");
  assert.equal(persistedClaim.status, "community_submitted");
  assert.equal(persistedClaim.checkedAt, null);
  assert.equal(typeof persistedClaim.submittedAt, "number");
  assert.equal(persistedClaim.sourceTitle, "Fonte local isolada");
  assert.equal(persistedClaim.sourceUrl, "https://example.test/fonte-local");
  assert.equal(persistedClaim.sourceExcerpt, "Trecho de teste; não representa uma fonte consultada.");
  assert.equal(persistedClaim.jurisdiction, "RJ");
  assert.equal(persistedClaim.sourceDate, "2026-10-28");
  await page.getByRole("heading", { name: "TESTE ISOLADO — travessia segura" }).waitFor();
  await page.getByText("Registro público simulado persistido somente no banco local do teste.", { exact: true }).waitFor();
  await page.getByText("Fonte local isolada", { exact: true }).waitFor();
  await page.getByText("https://example.test/fonte-local", { exact: true }).waitFor();
  await page.getByText("Trecho de teste; não representa uma fonte consultada.", { exact: true }).waitFor();
  await page.getByText("RJ", { exact: true }).waitFor();
  await page.getByText("2026-10-28", { exact: true }).waitFor();
  await page.getByText("Estado: community_submitted — enviado pela comunidade", { exact: true }).waitFor();
  await page.getByText(/Enviado em:/).waitFor();
  assert.equal(await page.getByText(/Conferido em:/).count(), 0, "Unchecked evidence must not show a checked date");
  await checkAccessibility(page, "detalhe e debate");
  await page.getByRole("button", { name: "Apoiar" }).click();
  await page.getByText("Escolha registrada nesta sessão experimental.").waitFor();
  await page.getByRole("button", { name: "Preciso de mais informações" }).click();
  await page.getByText("Escolha registrada nesta sessão experimental.").waitFor();
  await page.getByRole("button", { name: "Retirar minha escolha" }).click();
  await page.getByText("Retirada concluída para esta sessão experimental. Se havia uma escolha, ela foi removida.").waitFor();
  await page.getByText("Local não informado", { exact: true }).waitFor();
  await page.goto(`${origin}/mapa`, { waitUntil: "networkidle" });
  await page.getByText("Local não informado", { exact: true }).waitFor();
  await checkAccessibility(page, "mapa com proposta sem localidade");

  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(100);
  const widthCheck = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert(widthCheck.scroll <= widthCheck.viewport, `Horizontal overflow at 360px: ${JSON.stringify(widthCheck)}`);
  for (const route of ["/propostas", "/mapa", "/dados", "/conexoes", "/metodologia", "/privacidade", "/acessibilidade"]) {
    const response = await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `Public page failed: ${route}`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await checkAccessibility(page, route);
  }
  const errorPage = await context.newPage();
  let proposalRequests = 0;
  await errorPage.route(url => new URL(url).pathname === "/api/civic/proposals" && url.search === "", route => {
    proposalRequests += 1;
    return route.fulfill(proposalRequests === 1 || proposalRequests === 3
      ? { status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary_unavailable" }) }
      : { status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
  await errorPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const homeAlert = errorPage.locator("main .civic-home").getByRole("alert");
  await homeAlert.waitFor();
  assert.equal(await homeAlert.count(), 1, "Home must announce a recoverable failure once");
  assert.equal(await errorPage.getByText(/Ainda não há propostas públicas/).count(), 0);
  const retryButton = homeAlert.getByRole("button", { name: "Tentar novamente" });
  await retryButton.waitFor();
  await checkAccessibility(errorPage, "início com falha recuperável");
  await retryButton.click();
  await errorPage.getByText(/Ainda não há propostas públicas/).waitFor();
  assert.equal(await homeAlert.count(), 0, "The alert must disappear after a successful retry");
  assert.equal(proposalRequests, 2, "Retry must issue exactly one new proposal request");
  await checkAccessibility(errorPage, "início após recuperação com lista vazia");
  if (await errorPage.locator(".civic-page--notice").count()) {
    deferredFindings.push("A sessão experimental exibiu erro após navegações repetidas no teste de navegador.");
  }
  await errorPage.goto(`${origin}/mapa`, { waitUntil: "networkidle" });
  const mapAlert = errorPage.locator("main .civic-page").getByRole("alert");
  await mapAlert.waitFor();
  assert.equal(await mapAlert.count(), 1, "Map must announce a recoverable failure once");
  assert.equal(await errorPage.getByText(/Ainda não há propostas públicas para listar/).count(), 0);
  const mapRetryButton = mapAlert.getByRole("button", { name: "Tentar novamente" });
  await mapRetryButton.waitFor();
  await checkAccessibility(errorPage, "mapa com falha recuperável");
  await mapRetryButton.click();
  await errorPage.getByText(/Ainda não há propostas públicas para listar/).waitFor();
  assert.equal(await mapAlert.count(), 0, "The map alert must disappear after a successful retry");
  assert.equal(proposalRequests, 4, "Map retry must issue exactly one new proposal request");
  await checkAccessibility(errorPage, "mapa após recuperação com lista vazia");
  assert.deepEqual(pageErrors, []);
  console.log("Browser flow completed: anonymous experimental session, proposal without locality, related search, proposal, changeable/removable vote, recoverable loading errors, declared route manifest, and 360px reflow. Synthetic data remained in a local test-only database.");
  for (const finding of deferredFindings) console.warn(`TODO UI: ${finding}`);
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill("SIGTERM");
    await new Promise(resolve => {
      if (server.exitCode !== null) return resolve();
      server.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
  }
  console.log("Local non-personal test database retained; no managed database or DROP command was used.");
}
