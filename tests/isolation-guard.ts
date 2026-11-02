const forbidden = [
  "DATABASE_URL",
  "DRIZZLE_DATABASE_URL",
  "MANUS_JWT_SECRET",
  "MANUS_API_KEY",
  "CIVICA_DOCUMENT_KEY",
  "CIVICA_CPF_KEY",
  "CIVICA_BOOTSTRAP_SECRET",
  "OPENAI_API_KEY",
];
if (
  process.env.CIVICA_TEST_MODE !== "1" ||
  forbidden.some(key => process.env[key])
)
  throw new Error(
    "Tests must run through scripts/test-isolated.mjs with production credentials removed"
  );
if (process.env.TEST_DATABASE_URL) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/civica_test_[a-z0-9_]+$/.test(url.pathname)
  )
    throw new Error("Refusing a non-local or non-test database");
}
