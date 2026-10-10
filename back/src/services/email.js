import nodemailer from "nodemailer";

const supportedProviders = new Set(["resend", "smtp"]);

function getEmailProvider() {
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (supportedProviders.has(configuredProvider)) {
    return configuredProvider;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return "smtp";
  }

  if (process.env.RESEND_API_KEY) {
    return "resend";
  }

  return "console";
}

function getEmailFrom() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || null;
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

async function sendWithSmtp({ from, to, subject, text, html }) {
  const transport = getSmtpTransport();

  if (!transport || !from) {
    return null;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { sent: true, provider: "smtp" };
}

async function sendWithResend({ from, to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !from) {
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.message || "No se pudo enviar el email transaccional");
    error.statusCode = 502;
    error.details = payload;
    throw error;
  }

  return { sent: true, provider: "resend" };
}

export async function sendTransactionalEmail({ to, subject, text, html }) {
  const provider = getEmailProvider();
  const from = getEmailFrom();
  const message = { from, to, subject, text, html };
  const result = provider === "smtp"
    ? await sendWithSmtp(message)
    : provider === "resend"
      ? await sendWithResend(message)
      : null;

  if (result) {
    return result;
  }

  if (process.env.NODE_ENV === "production") {
    const error = new Error("Proveedor de email transaccional no configurado");
    error.statusCode = 503;
    error.details = { code: "EMAIL_PROVIDER_NOT_CONFIGURED" };
    error.publicDetails = { code: "EMAIL_PROVIDER_NOT_CONFIGURED" };
    throw error;
  }

  console.info("Email transaccional omitido: configura EMAIL_PROVIDER con smtp o resend.", {
    to,
    subject,
    hasText: Boolean(text),
    hasHtml: Boolean(html),
  });

  return { sent: false, provider: "console" };
}
