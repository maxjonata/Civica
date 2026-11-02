import { spawn, spawnSync } from "node:child_process";
import {
  randomBytes,
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const suffix = randomBytes(8).toString("hex");
const database = "civica_test_browser_" + suffix;
const user = "cb_" + randomBytes(6).toString("hex");
const password = randomBytes(24).toString("hex");
const setup = spawnSync("sudo", ["mariadb", "--batch"], {
  input: `CREATE DATABASE ${database}; CREATE USER '${user}'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL ON ${database}.* TO '${user}'@'127.0.0.1';`,
  encoding: "utf8",
});
if (setup.status !== 0)
  throw new Error(
    "Isolated local database setup failed; no managed database fallback."
  );
const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "civica-browser-protocol-")
);
const inviteFile = path.join(directory, "invite.txt");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LANG: "C.UTF-8",
  NODE_ENV: "production",
  CIVICA_TEST_MODE: "1",
  TEST_DATABASE_URL: `mysql://${user}:${password}@127.0.0.1/${database}`,
  CIVICA_ORIGIN: "http://localhost:4100",
  CIVICA_RP_ID: "localhost",
  PORT: "4100",
  CIVICA_DOCUMENT_KEY: randomBytes(32).toString("hex"),
  CIVICA_CPF_KEY: randomBytes(32).toString("hex"),
};
let server;
let browser;
try {
  const invitation = spawnSync(
    "node",
    ["dist/pilot.js", "invite", inviteFile],
    { env, encoding: "utf8" }
  );
  if (invitation.status !== 0)
    throw new Error("Isolated operational invitation failed.");
  const invite = (await fs.readFile(inviteFile, "utf8")).trim();
  server = spawn("node", ["dist/index.js"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let startup = "";
  server.stderr.on("data", () => {
    startup = "server initialization error";
  });
  const base = "http://localhost:4100";
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      ready = (await fetch(base + "/api/health")).status === 200;
      if (ready) break;
    } catch {
      /* only the server we just started is expected here */
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready)
    throw new Error(
      "Browser RED: production entrypoint did not become healthy " + startup
    );
  const systemChromium = await fs
    .access("/usr/bin/chromium")
    .then(() => true)
    .catch(() => false);
  browser = await chromium.launch({
    headless: true,
    ...(systemChromium ? { executablePath: "/usr/bin/chromium" } : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const a = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  console.log(
    "Browser protocol: registration using genuine WebAuthn virtual authenticator, no real identity."
  );
  await page.goto(base + "/acesso");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await page.getByLabel("Apelido público").fill("Protocol test only");
  await page.getByLabel("Convite de uso único").fill(invite);
  await page.getByRole("button", { name: "Criar conta com passkey" }).click();
  await page.waitForURL("**/conta", { timeout: 15000 });
  let session = await page.evaluate(
    async () => await (await fetch("/api/session")).json()
  );
  assert.equal(session.account.role, "member");
  assert.equal(session.credentials.length, 1);
  assert.equal(session.identity, null);
  assert.equal(session.credentials[0].lastUsedAt, null);
  const accountId = session.account.id;
  console.log(
    "Browser protocol: reauthentication and addition of a second actual virtual credential."
  );
  const credentialsA = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId: a.authenticatorId,
  });
  assert.equal(credentialsA.credentials.length, 1);
  // UI performs reauth followed by register; intercept the register-options response to disable A and enable B at the exact boundary.
  let b;
  let routeError = null;
  await page.route("**/api/auth/credentials/options", async route => {
    try {
      const response = await route.fetch();
      await cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
        authenticatorId: a.authenticatorId,
        enabled: false,
      });
      b = await cdp.send("WebAuthn.addVirtualAuthenticator", {
        options: {
          protocol: "ctap2",
          transport: "usb",
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
      await route.fulfill({ response });
    } catch (error) {
      routeError = error.message;
      await route.abort();
    }
  });
  await page
    .getByLabel("Nome para a nova passkey")
    .fill("Second protocol authenticator");
  await page
    .getByRole("button", { name: "Adicionar com reautenticação" })
    .click();
  await page
    .getByText("2 credenciais", { exact: true })
    .waitFor({ timeout: 15000 });
  assert.equal(routeError, null);
  await page.unroute("**/api/auth/credentials/options");
  await page.goto(base + "/vinculacao");
  await page.getByRole("button", { name: "Testar a segunda passkey" }).click();
  await page
    .getByText("Duas credenciais têm utilização confirmada pelo servidor.")
    .waitFor({ timeout: 15000 });
  session = await page.evaluate(
    async () => await (await fetch("/api/session")).json()
  );
  assert.equal(
    session.credentials.filter(key => key.lastUsedAt !== null).length,
    2
  );
  assert.equal(session.account.id, accountId);
  console.log(
    "Browser protocol: real PDF generation, reload recovery, CSRF rejection and private untrusted upload."
  );
  await page.getByRole("button", { name: "Emitir PDF de vinculação" }).click();
  await page
    .getByRole("link", { name: "Baixar PDF para assinar" })
    .waitFor({ timeout: 15000 });
  const issued = await page.evaluate(
    async () => await (await fetch("/api/session")).json()
  );
  assert.equal(issued.identity.status, "issued");
  const docId = issued.identity.id;
  const pdf = await context.request.get(
    base + "/api/identity/document/" + docId
  );
  assert.equal(pdf.status(), 200);
  assert.match((await pdf.body()).subarray(0, 5).toString(), /^%PDF-/);
  assert.match(pdf.headers()["content-disposition"], /^attachment/);
  await page.reload();
  await page.getByRole("link", { name: "Baixar PDF para assinar" }).waitFor();
  const forbidden = await context.request.post(base + "/api/identity/document");
  assert.equal(forbidden.status(), 403);
  await page.locator("#signed-pdf").setInputFiles({
    name: "unsigned-protocol-only.pdf",
    mimeType: "application/pdf",
    buffer: await pdf.body(),
  });
  await page.getByLabel(/Consinto com o envio/).check();
  await page.getByRole("button", { name: "Enviar para conferência" }).click();
  await page
    .getByText(/PDF recebido para conferência manual/)
    .waitFor({ timeout: 15000 });
  session = await page.evaluate(
    async () => await (await fetch("/api/session")).json()
  );
  assert.equal(session.identity.status, "submitted");
  assert.equal(session.identity.signatureChecked, false);
  assert.equal(session.identity.identityIdentified, false);
  assert.equal(session.identity.civilUniqueness, false);
  assert.equal(
    (
      await context.request.get(
        base + "/api/admin/reviews/" + docId + "/evidence"
      )
    ).status(),
    403
  );
  await page.goto(base + "/conta");
  await page.getByRole("button", { name: "Encerrar sessão" }).click();
  await page
    .getByRole("heading", { name: "Sua conta começa com uma passkey." })
    .waitFor();
  session = await page.evaluate(
    async () => await (await fetch("/api/session")).json()
  );
  assert.equal(session.account, null);
  console.log(
    "Browser protocol: discoverable login preserves the same account, two credentials and pending-only evidence."
  );
  await page.goto(base + "/acesso");
  await page.getByRole("button", { name: "Continuar com passkey" }).click();
  await page.waitForURL("**/conta", { timeout: 15000 });
  session = await page.evaluate(
    async () => await (await fetch("/api/session")).json()
  );
  assert.equal(session.account.id, accountId);
  assert.equal(session.credentials.length, 2);
  assert.equal(session.identity.status, "submitted");
  assert.equal(session.identity.signatureChecked, false);
  const virtualCredentials = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId: b.authenticatorId,
  });
  const virtualKey = virtualCredentials.credentials[0];
  const privateKey = createPrivateKey({
    key: Buffer.from(virtualKey.privateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey);
  const digestAlgorithm = ["ed25519", "ed448"].includes(
    privateKey.asymmetricKeyType
  )
    ? null
    : "sha256";
  let counter = virtualKey.signCount;
  const variants = [
    {
      name: "valid baseline",
      origin: base,
      rp: "localhost",
      uv: true,
      status: 200,
    },
    {
      name: "UV absent",
      origin: base,
      rp: "localhost",
      uv: false,
      status: 400,
    },
    {
      name: "wrong origin",
      origin: "https://evil.invalid",
      rp: "localhost",
      uv: true,
      status: 400,
    },
    {
      name: "wrong RP",
      origin: base,
      rp: "evil.invalid",
      uv: true,
      status: 400,
    },
  ];
  for (const variant of variants) {
    const state = (await context.request.get(base + "/api/session")).json();
    const csrf = (await state).csrfToken;
    const headers = {
      Origin: base,
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
    };
    const options = await (
      await context.request.post(base + "/api/auth/login/options", {
        headers,
        data: {},
      })
    ).json();
    const clientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge: options.challenge,
        origin: variant.origin,
        crossOrigin: false,
      })
    );
    const authData = Buffer.alloc(37);
    createHash("sha256").update(variant.rp).digest().copy(authData);
    authData[32] = variant.uv ? 5 : 1;
    authData.writeUInt32BE(++counter, 33);
    const signedBytes = Buffer.concat([
      authData,
      createHash("sha256").update(clientData).digest(),
    ]);
    const signature = sign(digestAlgorithm, signedBytes, privateKey);
    assert(verify(digestAlgorithm, signedBytes, publicKey, signature));
    const id = Buffer.from(virtualKey.credentialId, "base64").toString(
      "base64url"
    );
    const response = {
      id,
      rawId: id,
      type: "public-key",
      authenticatorAttachment: "cross-platform",
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientData.toString("base64url"),
        authenticatorData: authData.toString("base64url"),
        signature: signature.toString("base64url"),
        userHandle: Buffer.from(virtualKey.userHandle, "base64").toString(
          "base64url"
        ),
      },
    };
    const result = await context.request.post(base + "/api/auth/login/verify", {
      headers,
      data: response,
    });
    assert.equal(
      result.status(),
      variant.status,
      "genuine signed protocol " + variant.name
    );
    if (variant.status === 400) {
      const replay = await context.request.post(
        base + "/api/auth/login/verify",
        { headers, data: response }
      );
      assert.equal(replay.status(), 400);
    }
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(base + "/");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  );
  assert(b?.authenticatorId);
  assert.deepEqual(pageErrors, []);
  console.log(
    "Browser GREEN: registration, two-key proof, reauth, document, reload, private upload, CSRF, authorization, logout, discoverable login, UV-required rejection, wrong-origin rejection, wrong-RP rejection, replay rejection and 360px layout passed. No gov.br signature or physical identity was validated."
  );
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill("SIGTERM");
    await new Promise(resolve => {
      if (server.exitCode !== null) return resolve();
      server.once("exit", resolve);
      setTimeout(resolve, 2000);
    });
  }
  console.log(
    "Isolated non-personal database retained; child browser/server stopped."
  );
}
