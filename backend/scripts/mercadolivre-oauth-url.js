function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function main() {
  const baseUrl = normalizeBaseUrl(
    process.env.DEPLOY_API_BASE_URL || process.env.API_BASE_URL
  );

  if (!baseUrl) {
    console.error("Defina DEPLOY_API_BASE_URL com a URL publica do backend.");
    process.exit(1);
  }

  const accountName = process.env.MERCADOLIVRE_ACCOUNT_NAME || "Loja Principal ML";
  const query = new URLSearchParams({ accountName });

  const response = await fetch(
    `${baseUrl}/integrations/mercadolivre/auth/url?${query.toString()}`
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(
      `Falha ao gerar URL OAuth (${response.status}): ${payload?.error || "erro desconhecido"}`
    );
    process.exit(1);
  }

  console.log("Authorization URL:");
  console.log(payload.authorizationUrl);
}

main().catch((error) => {
  console.error("Erro inesperado ao gerar URL OAuth:", error.message);
  process.exit(1);
});
