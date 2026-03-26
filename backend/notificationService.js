const dns = require("node:dns");
const nodemailer = require("nodemailer");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNotificationConfig() {
  const host = normalizeText(process.env.SMTP_HOST);
  const port = parsePort(process.env.SMTP_PORT, 587);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const user = normalizeText(process.env.SMTP_USER);
  const password = normalizeText(process.env.SMTP_PASSWORD);
  const to = normalizeText(process.env.NOTIFY_TO_EMAIL);
  const from = normalizeText(process.env.NOTIFY_FROM_EMAIL || user || "BLAST <no-reply@blast.local>");

  return {
    host,
    port,
    secure,
    user,
    password,
    to,
    from,
  };
}

function isNotificationConfigured() {
  const config = getNotificationConfig();
  return Boolean(config.host && config.port && config.user && config.password && config.to);
}

function getNotificationSummary() {
  const config = getNotificationConfig();

  return {
    enabled: isNotificationConfigured(),
    host: config.host,
    port: config.port,
    recipient: config.to,
    sender: config.from,
  };
}

let cachedTransporter = null;
let cachedTransporterKey = "";

function buildTransportOptions(config, resolvedHost) {
  return {
    host: resolvedHost,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
      servername: config.host,
    },
  };
}

function getTransporter(config, resolvedHost) {
  const cacheKey = [
    resolvedHost,
    config.port,
    config.secure ? "1" : "0",
    config.user,
    config.to,
    config.from,
  ].join("|");

  if (!cachedTransporter || cachedTransporterKey !== cacheKey) {
    const transportOptions = buildTransportOptions(config, resolvedHost);

    if (config.user && config.password) {
      transportOptions.auth = {
        user: config.user,
        pass: config.password,
      };
    }

    cachedTransporter = nodemailer.createTransport(transportOptions);
    cachedTransporterKey = cacheKey;
  }

  return cachedTransporter;
}

function buildFallbackConfig(config) {
  if (config.host === "smtp.gmail.com" && config.port === 587) {
    return {
      ...config,
      port: 465,
      secure: true,
    };
  }

  if (config.host === "smtp.gmail.com" && config.port === 465) {
    return {
      ...config,
      port: 587,
      secure: false,
    };
  }

  return null;
}

async function resolveTransportHost(hostname) {
  try {
    const resolved = await dns.promises.lookup(hostname, { family: 4 });
    return resolved && resolved.address ? resolved.address : hostname;
  } catch (error) {
    console.warn(`SMTP host lookup failed for ${hostname}:`, error.message);
    return hostname;
  }
}

async function sendWithConfig(config, message) {
  const resolvedHost = await resolveTransportHost(config.host);
  return getTransporter(config, resolvedHost).sendMail(message);
}

async function sendMail({ subject, text, html, replyTo }) {
  const config = getNotificationConfig();

  if (!isNotificationConfigured()) {
    return {
      status: "skipped",
      reason: "notification settings are incomplete",
    };
  }

  const message = {
    from: config.from,
    to: config.to,
    subject,
    text,
    html,
    replyTo: replyTo || undefined,
  };

  try {
    await sendWithConfig(config, message);
  } catch (error) {
    const fallbackConfig = buildFallbackConfig(config);

    if (!fallbackConfig) {
      throw error;
    }

    await sendWithConfig(fallbackConfig, message);
  }

  return {
    status: "sent",
  };
}

function buildSubmissionEmail(submission) {
  const submittedAt = new Date(submission.submittedAt).toLocaleString();
  const safeName = escapeHtml(submission.fullName);
  const safeEmail = escapeHtml(submission.email);
  const safeMessage = escapeHtml(submission.interest).replace(/\n/g, "<br>");

  return {
    subject: `[BLAST] New submission from ${submission.fullName}`,
    text: [
      "A new BLAST join form submission was received.",
      "",
      `Name: ${submission.fullName}`,
      `Email: ${submission.email}`,
      `Message: ${submission.interest}`,
      `Submitted at: ${submittedAt}`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #2f1f26; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #5d1029;">New BLAST submission</h2>
        <p style="margin: 0 0 8px;">A new join form submission was received.</p>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong><br>${safeMessage}</p>
        <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
      </div>
    `,
  };
}

async function sendSubmissionNotification(submission) {
  const email = buildSubmissionEmail(submission);
  return sendMail({
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: submission.email,
  });
}

async function sendTestNotification() {
  const now = new Date().toLocaleString();
  return sendMail({
    subject: "[BLAST] Test notification",
    text: [
      "This is a test notification from the BLAST admin dashboard.",
      "",
      `Sent at: ${now}`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #2f1f26; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #5d1029;">Test notification</h2>
        <p style="margin: 0 0 8px;">This is a test notification from the BLAST admin dashboard.</p>
        <p><strong>Sent at:</strong> ${escapeHtml(now)}</p>
      </div>
    `,
  });
}

module.exports = {
  getNotificationSummary,
  isNotificationConfigured,
  sendSubmissionNotification,
  sendTestNotification,
};
