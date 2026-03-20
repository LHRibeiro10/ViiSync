const REQUIRED = [
  "DATABASE_URL",
  "MERCADOLIVRE_API_MODE",
  "MERCADOLIVRE_API_BASE_URL",
  "MERCADOLIVRE_AUTH_BASE_URL",
  "MERCADOLIVRE_OAUTH_TOKEN_URL",
  "MERCADOLIVRE_CLIENT_ID",
  "MERCADOLIVRE_CLIENT_SECRET",
  "MERCADOLIVRE_REDIRECT_URI",
];

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function main() {
  const missing = REQUIRED.filter((name) => !readEnv(name));
  const mode = readEnv("MERCADOLIVRE_API_MODE").toLowerCase();
  const redirectUri = readEnv("MERCADOLIVRE_REDIRECT_URI");

  if (missing.length) {
    console.error("Variaveis obrigatorias ausentes:");
    missing.forEach((name) => console.error(`- ${name}`));
    process.exit(1);
  }

  if (!["mock", "auto", "live"].includes(mode)) {
    console.error(
      "MERCADOLIVRE_API_MODE invalido. Use: mock, auto ou live."
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && redirectUri.includes("localhost")) {
    console.error(
      "MERCADOLIVRE_REDIRECT_URI aponta para localhost em producao. Use o dominio publico do Railway."
    );
    process.exit(1);
  }

  console.log("Env do Railway validado com sucesso.");
}

main();
