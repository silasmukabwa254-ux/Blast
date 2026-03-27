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

async function sendMail({ to, subject, text, html, replyTo }) {
  const config = getNotificationConfig();

  if (!isNotificationConfigured()) {
    return {
      status: "skipped",
      reason: "notification settings are incomplete",
    };
  }

  const message = {
    from: config.from,
    to: normalizeText(to) || config.to,
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

function buildSubmissionConfirmation(submission) {
  const safeName = escapeHtml(submission.fullName);

  return {
    subject: "Thanks for joining BLAST",
    text: [
      `Hi ${submission.fullName},`,
      "",
      "Thanks for reaching out to BLAST. We have received your join message and we are glad you want to be part of the journey.",
      "",
      "We will review your message and get back to you soon.",
      "",
      "With gratitude,",
      "BLAST Team",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #2f1f26; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #5d1029;">Thanks for joining BLAST</h2>
        <p style="margin: 0 0 8px;">Hi ${safeName},</p>
        <p style="margin: 0 0 8px;">Thanks for reaching out to BLAST. We have received your join message and we are glad you want to be part of the journey.</p>
        <p style="margin: 0 0 8px;">We will review your message and get back to you soon.</p>
        <p style="margin: 0;">With gratitude,<br>BLAST Team</p>
      </div>
    `,
  };
}

async function sendSubmissionNotification(submission) {
  const email = buildSubmissionEmail(submission);
  return sendMail({
    to: undefined,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: submission.email,
  });
}

async function sendSubmissionConfirmation(submission) {
  const email = buildSubmissionConfirmation(submission);
  return sendMail({
    to: submission.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: undefined,
  });
}

function buildFeedbackEmail(feedback) {
  const submittedAt = new Date(feedback.submittedAt).toLocaleString();
  const safeName = escapeHtml(feedback.fullName);
  const safeEmail = escapeHtml(feedback.email || "Not provided");
  const safeTopic = escapeHtml(feedback.topic);
  const safeMessage = escapeHtml(feedback.message).replace(/\n/g, "<br>");

  return {
    subject: `[BLAST] New feedback from ${feedback.fullName}`,
    text: [
      "A new BLAST feedback message was received.",
      "",
      `Name: ${feedback.fullName}`,
      `Email: ${feedback.email || "Not provided"}`,
      `Topic: ${feedback.topic}`,
      `Message: ${feedback.message}`,
      `Submitted at: ${submittedAt}`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #2f1f26; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #5d1029;">New BLAST feedback</h2>
        <p style="margin: 0 0 8px;">A new feedback message was received from the website.</p>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Topic:</strong> ${safeTopic}</p>
        <p><strong>Message:</strong><br>${safeMessage}</p>
        <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
      </div>
    `,
  };
}

function buildFeedbackConfirmation(feedback) {
  const safeName = escapeHtml(feedback.fullName);
  const safeTopic = escapeHtml(feedback.topic);

  return {
    subject: "Thanks for your feedback",
    text: [
      `Hi ${feedback.fullName},`,
      "",
      "Thank you for taking the time to share your thoughts with BLAST.",
      `We received your feedback about ${feedback.topic}.`,
      "",
      "Your voice matters to us, and we will keep it in mind as we keep growing.",
      "",
      "Warmly,",
      "BLAST Team",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #2f1f26; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #5d1029;">Thanks for your feedback</h2>
        <p style="margin: 0 0 8px;">Hi ${safeName},</p>
        <p style="margin: 0 0 8px;">Thank you for taking the time to share your thoughts with BLAST.</p>
        <p style="margin: 0 0 8px;">We received your feedback about <strong>${safeTopic}</strong>.</p>
        <p style="margin: 0 0 8px;">Your voice matters to us, and we will keep it in mind as we keep growing.</p>
        <p style="margin: 0;">Warmly,<br>BLAST Team</p>
      </div>
    `,
  };
}

async function sendFeedbackNotification(feedback) {
  const email = buildFeedbackEmail(feedback);
  return sendMail({
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: feedback.email || undefined,
  });
}

async function sendFeedbackConfirmation(feedback) {
  if (!feedback.email) {
    return {
      status: "skipped",
      reason: "feedback email not provided",
    };
  }

  const email = buildFeedbackConfirmation(feedback);
  return sendMail({
    to: feedback.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: undefined,
  });
}

function buildReplyEmail(details) {
  const recipientName = normalizeText(details && details.recipientName);
  const recipientEmail = normalizeText(details && details.recipientEmail);
  const subject = normalizeText(details && details.subject);
  const message = normalizeText(details && details.message);
  const contextLabel = normalizeText(details && details.contextLabel) || "BLAST";
  const safeRecipientName = escapeHtml(recipientName || recipientEmail || "friend");
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  return {
    subject: subject || `Re: ${contextLabel}`,
    text: [
      `Hi ${recipientName || recipientEmail || "there"},`,
      "",
      message,
      "",
      "Warmly,",
      "BLAST Team",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #2f1f26; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #5d1029;">${escapeHtml(subject || `Re: ${contextLabel}`)}</h2>
        <p style="margin: 0 0 8px;">Hi ${safeRecipientName},</p>
        <div style="margin: 0 0 12px;">${safeMessage}</div>
        <p style="margin: 0;">Warmly,<br>BLAST Team</p>
      </div>
    `,
  };
}

async function sendAdminReplyEmail(details) {
  const recipientEmail = normalizeText(details && details.recipientEmail);

  if (!recipientEmail) {
    return {
      status: "skipped",
      reason: "recipient email is required",
    };
  }

  const email = buildReplyEmail(details);
  const config = getNotificationConfig();

  return sendMail({
    to: recipientEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: config.to,
  });
}

async function sendTestNotification() {
  const now = new Date().toLocaleString();
  return sendMail({
    to: undefined,
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
  sendAdminReplyEmail,
  sendFeedbackConfirmation,
  sendFeedbackNotification,
  sendSubmissionNotification,
  sendSubmissionConfirmation,
  sendTestNotification,
};
