const { createTransport } = (() => {
  try {
    // Optional dependency. Required only when SMTP provider is selected.
    return require("nodemailer");
  } catch {
    return {};
  }
})();

function normalizeText(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveProvider() {
  return normalizeText(process.env.PASSWORD_RESET_EMAIL_PROVIDER || "disabled").toLowerCase();
}

function resolveMailFrom() {
  return (
    normalizeText(process.env.PASSWORD_RESET_EMAIL_FROM) ||
    normalizeText(process.env.AUTH_EMAIL_FROM) ||
    "ViiSync <no-reply@viisync.com.br>"
  );
}

function buildEmailTemplate({ resetUrl, expiresAtIso }) {
  const expiresAt = new Date(expiresAtIso);
  const expiresAtLabel = Number.isNaN(expiresAt.getTime())
    ? "em breve"
    : expiresAt.toLocaleString("pt-BR");
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: "Redefinicao de senha - ViiSync",
    text: [
      "Recebemos uma solicitacao para redefinir sua senha no ViiSync.",
      "",
      "Use o link abaixo para criar uma nova senha:",
      resetUrl,
      "",
      `Esse link expira em: ${expiresAtLabel}.`,
      "",
      "Se voce nao solicitou essa alteracao, ignore este e-mail.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#102036;line-height:1.6">
        <h2 style="margin:0 0 12px">Redefinicao de senha</h2>
        <p style="margin:0 0 12px">
          Recebemos uma solicitacao para redefinir sua senha no <strong>ViiSync</strong>.
        </p>
        <p style="margin:0 0 18px">
          Clique no botao abaixo para criar uma nova senha:
        </p>
        <p style="margin:0 0 18px">
          <a
            href="${safeUrl}"
            style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700"
          >
            Redefinir senha
          </a>
        </p>
        <p style="margin:0 0 10px;font-size:14px;color:#475569">
          Esse link expira em <strong>${escapeHtml(expiresAtLabel)}</strong>.
        </p>
        <p style="margin:0;font-size:14px;color:#475569">
          Se voce nao solicitou essa alteracao, ignore este e-mail.
        </p>
      </div>
    `,
  };
}

async function sendWithResend({ toEmail, subject, text, html }) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  if (!apiKey) {
    throw new Error("RESEND_API_KEY nao configurada.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resolveMailFrom(),
      to: [toEmail],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || "Falha ao enviar e-mail via Resend.");
  }
}

function resolveSmtpConfig() {
  const host = normalizeText(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 587);
  const user = normalizeText(process.env.SMTP_USER);
  const pass = normalizeText(process.env.SMTP_PASS);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !Number.isInteger(port) || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS devem estar configurados.");
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };
}

async function sendWithSmtp({ toEmail, subject, text, html }) {
  if (typeof createTransport !== "function") {
    throw new Error(
      "Provider SMTP selecionado, mas a dependencia nodemailer nao esta instalada."
    );
  }

  const transport = createTransport(resolveSmtpConfig());
  await transport.sendMail({
    from: resolveMailFrom(),
    to: toEmail,
    subject,
    text,
    html,
  });
}

async function sendPasswordResetEmail({ toEmail, resetUrl, expiresAtIso }) {
  const provider = resolveProvider();
  const { subject, text, html } = buildEmailTemplate({
    resetUrl,
    expiresAtIso,
  });

  if (provider === "resend") {
    await sendWithResend({
      toEmail,
      subject,
      text,
      html,
    });
    return;
  }

  if (provider === "smtp") {
    await sendWithSmtp({
      toEmail,
      subject,
      text,
      html,
    });
    return;
  }

  if (provider === "disabled" || provider === "none") {
    const isProduction = String(process.env.NODE_ENV || "development").toLowerCase() === "production";

    if (!isProduction) {
      console.info(`[auth:password-reset:preview] ${toEmail} -> ${resetUrl}`);
    }
    return;
  }

  throw new Error("PASSWORD_RESET_EMAIL_PROVIDER invalido. Use resend, smtp ou disabled.");
}

module.exports = {
  sendPasswordResetEmail,
};
