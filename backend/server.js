const express = require("express");
const crypto = require("crypto");
const {
  isDatabaseEnabled,
  readSubmissions,
  saveSubmission,
} = require("./submissionStore");
const {
  readFeedback,
  saveFeedback,
} = require("./feedbackStore");
const { isRateLimited } = require("./rateLimitStore");
const {
  getDefaultContent,
  normalizeContent,
  readContent,
  saveContent,
} = require("./contentStore");
const {
  getReplySummary,
  getNotificationSummary,
  sendAdminReplyEmail,
  sendFeedbackConfirmation,
  sendFeedbackNotification,
  sendSubmissionConfirmation,
  sendSubmissionNotification,
  sendTestNotification,
} = require("./notificationService");
const { generateBlastBotReply } = require("./blastBotService");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || ALLOWED_ORIGIN)
  .split(",")
  .map(function (origin) {
    return origin.trim();
  })
  .filter(Boolean);
const ADMIN_REALM = "BLAST Admin";
const JOIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const JOIN_RATE_LIMIT_MAX = 5;
const FEEDBACK_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const FEEDBACK_RATE_LIMIT_MAX = 5;

app.use(function (req, res, next) {
  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  if (!isAllowedOrigin(origin, req)) {
    return res.status(403).json({
      message: `Origin ${origin} is not allowed by CORS.`,
    });
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});
app.use(express.json({ limit: "64kb" }));

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getRequestHost(req) {
  return normalizeText(req.headers["x-forwarded-host"] || req.headers.host);
}

function isSameOriginRequest(origin, req) {
  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const requestHost = getRequestHost(req);
    return requestHost !== "" && originUrl.host === requestHost;
  } catch (error) {
    return false;
  }
}

function isAllowedOrigin(origin, req) {
  if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  return isSameOriginRequest(origin, req);
}

function getClientIdentifier(req) {
  const forwardedFor = normalizeText(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return normalizeText(req.ip || req.socket?.remoteAddress || "unknown");
}

async function isJoinRateLimited(req) {
  return isRateLimited(
    "join",
    getClientIdentifier(req),
    JOIN_RATE_LIMIT_WINDOW_MS,
    JOIN_RATE_LIMIT_MAX
  );
}

async function isFeedbackRateLimited(req) {
  return isRateLimited(
    "feedback",
    getClientIdentifier(req),
    FEEDBACK_RATE_LIMIT_WINDOW_MS,
    FEEDBACK_RATE_LIMIT_MAX
  );
}

function getAdminCredentials() {
  const isProduction = process.env.NODE_ENV === "production";
  const username = normalizeText(process.env.ADMIN_USERNAME || (isProduction ? "" : "admin"));
  const password = normalizeText(process.env.ADMIN_PASSWORD || (isProduction ? "" : "blast123"));

  return {
    username,
    password,
  };
}

function credentialsConfigured() {
  const credentials = getAdminCredentials();
  return credentials.username !== "" && credentials.password !== "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getQueryText(value) {
  if (Array.isArray(value)) {
    return normalizeText(value[0]);
  }

  return normalizeText(value);
}

function normalizeSearch(value) {
  return getQueryText(value).toLowerCase();
}

function formatSubmissionDate(value) {
  return escapeHtml(new Date(value).toLocaleString());
}

function filterSubmissions(submissions, query) {
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return submissions;
  }

  return submissions.filter(function (submission) {
    const haystack = [
      submission.fullName,
      submission.email,
      submission.interest,
      new Date(submission.submittedAt).toLocaleString(),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildSubmissionsCsv(submissions) {
  const header = ["Full Name", "Email", "Message", "Submitted At"];
  const lines = [header.map(escapeCsvCell).join(",")];

  submissions.forEach(function (submission) {
    lines.push(
      [
        submission.fullName,
        submission.email,
        submission.interest,
        new Date(submission.submittedAt).toLocaleString(),
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  });

  return `${lines.join("\n")}\n`;
}

function filterFeedback(feedbackEntries, query) {
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return feedbackEntries;
  }

  return feedbackEntries.filter(function (entry) {
    const haystack = [
      entry.fullName,
      entry.email,
      entry.topic,
      entry.message,
      new Date(entry.submittedAt).toLocaleString(),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function buildFeedbackCsv(feedbackEntries) {
  const header = ["Full Name", "Email", "Topic", "Message", "Submitted At"];
  const lines = [header.map(escapeCsvCell).join(",")];

  feedbackEntries.forEach(function (entry) {
    lines.push(
      [
        entry.fullName,
        entry.email,
        entry.topic,
        entry.message,
        new Date(entry.submittedAt).toLocaleString(),
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  });

  return `${lines.join("\n")}\n`;
}

function buildDashboardReplyStyles() {
  return `
          .reply-panel {
            margin: 0 1.5rem 1.25rem;
            padding: 1.1rem 1.1rem 1.2rem;
            border: 1px solid var(--border);
            border-radius: 18px;
            background: linear-gradient(180deg, #fffafc 0%, #fff 100%);
          }
          .reply-panel__header {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            align-items: flex-start;
          }
          .reply-panel__eyebrow {
            margin: 0 0 0.25rem;
            color: var(--muted);
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .reply-panel__header h2 {
            margin: 0 0 0.35rem;
            color: var(--accent);
            font-size: 1.1rem;
          }
          .reply-panel__notice {
            margin: 0.9rem 0 0;
            padding: 0.75rem 0.9rem;
            border-radius: 12px;
            background: #f8eef2;
            color: var(--accent);
            font-size: 0.92rem;
            line-height: 1.5;
          }
          .reply-panel__target {
            margin-top: 0.9rem;
            padding: 0.85rem 1rem;
            border: 1px dashed var(--border);
            border-radius: 14px;
            background: #fff;
          }
          .reply-panel__target strong {
            display: block;
            color: var(--accent);
          }
          .reply-panel__target span {
            display: block;
            margin-top: 0.15rem;
            color: var(--muted);
          }
          .reply-panel__form {
            display: grid;
            gap: 0.75rem;
            margin-top: 1rem;
          }
          .reply-panel__form label {
            font-weight: 700;
            color: var(--accent);
          }
          .reply-panel__form input,
          .reply-panel__form textarea {
            width: 100%;
            box-sizing: border-box;
            padding: 0.85rem 0.95rem;
            border: 1px solid var(--border);
            border-radius: 12px;
            font: inherit;
          }
          .reply-panel__form textarea {
            min-height: 120px;
            resize: vertical;
          }
          .reply-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            align-items: center;
          }
          .reply-actions .tool-button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }
          .reply-actions .tool-link.is-disabled {
            pointer-events: none;
            opacity: 0.5;
            filter: grayscale(0.1);
          }
          .reply-status {
            margin: 0;
            color: var(--muted);
          }
          .reply-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 40px;
            padding: 0.55rem 0.85rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: #f4ebee;
            color: var(--accent);
            font: inherit;
            font-weight: 700;
            cursor: pointer;
          }
          .reply-row {
            cursor: pointer;
          }
          .reply-row:focus-visible {
            outline: 2px solid rgba(139, 30, 63, 0.25);
            outline-offset: -2px;
          }
          .reply-trigger:hover {
            background: #efe3e8;
          }
          .reply-trigger:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }
          .reply-empty {
            color: var(--muted);
            font-size: 0.9rem;
          }
  `;
}

function buildReplyPanelMarkup({
  kind,
  title,
  description,
  defaultSubject,
  placeholder,
  recipientLabel,
  emptyText,
  replyEnabled = true,
  replyNotice = "",
}) {
  const prefix = `${kind}Reply`;
  return `
    <section class="reply-panel" id="${prefix}Panel">
      <div class="reply-panel__header">
        <div>
          <p class="reply-panel__eyebrow">Reply</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
        <button class="tool-link" type="button" id="${prefix}Clear">Clear selection</button>
      </div>
      ${replyEnabled ? "" : `<p class="reply-panel__notice">${escapeHtml(replyNotice || "Replies are paused until a verified domain is configured.")}</p>`}
      <div class="reply-panel__target">
        <strong id="${prefix}TargetName">No recipient selected</strong>
        <span id="${prefix}TargetEmail">${escapeHtml(emptyText)}</span>
      </div>
      <form class="reply-panel__form" id="${prefix}Form">
        <label for="${prefix}Subject">Subject</label>
        <input
          id="${prefix}Subject"
          type="text"
          maxlength="140"
          value="${escapeHtml(defaultSubject)}"
          placeholder="Enter a short subject"
          autocomplete="off"
        >
        <label for="${prefix}Message">${escapeHtml(recipientLabel)}</label>
        <textarea
          id="${prefix}Message"
          rows="5"
          maxlength="4000"
          placeholder="${escapeHtml(placeholder)}"
        ></textarea>
        <input type="hidden" id="${prefix}RecipientName" value="">
        <input type="hidden" id="${prefix}RecipientEmail" value="">
        <input type="hidden" id="${prefix}ContextLabel" value="">
        <div class="reply-actions">
          <button class="tool-button" type="submit"${replyEnabled ? "" : " disabled"}>${replyEnabled ? "Send reply" : "Replies paused"}</button>
          <p class="reply-status" id="${prefix}Status" aria-live="polite"></p>
        </div>
      </form>
    </section>
  `;
}

function buildReplyPanelScript({ kind, endpoint, defaultSubject, replyEnabled = true, replyNotice = "" }) {
  const prefix = `${kind}Reply`;
  const replySelector = `[data-reply-kind="${kind}"]`;
  return `
    <script>
      (function () {
        const form = document.getElementById(${JSON.stringify(`${prefix}Form`)});
        if (!form) return;

        const panel = document.getElementById(${JSON.stringify(`${prefix}Panel`)});
        const clearButton = document.getElementById(${JSON.stringify(`${prefix}Clear`)});
        const targetName = document.getElementById(${JSON.stringify(`${prefix}TargetName`)});
        const targetEmail = document.getElementById(${JSON.stringify(`${prefix}TargetEmail`)});
        const subjectInput = document.getElementById(${JSON.stringify(`${prefix}Subject`)});
        const messageInput = document.getElementById(${JSON.stringify(`${prefix}Message`)});
        const recipientNameInput = document.getElementById(${JSON.stringify(`${prefix}RecipientName`)});
        const recipientEmailInput = document.getElementById(${JSON.stringify(`${prefix}RecipientEmail`)});
        const contextLabelInput = document.getElementById(${JSON.stringify(`${prefix}ContextLabel`)});
        const status = document.getElementById(${JSON.stringify(`${prefix}Status`)});
        const replyButtons = Array.from(document.querySelectorAll(${JSON.stringify(`[data-reply-kind="${kind}"]`)}));
        const replyEnabled = ${JSON.stringify(Boolean(replyEnabled))};
        const replyNotice = ${JSON.stringify(replyNotice || "Replies are paused until a verified domain is configured.")};

        function getReplyData(element) {
          return {
            recipientName: element.getAttribute("data-recipient-name") || "",
            recipientEmail: element.getAttribute("data-recipient-email") || "",
            contextLabel: element.getAttribute("data-context-label") || "",
            defaultSubject: element.getAttribute("data-default-subject") || subjectInput.value,
          };
        }

        function setStatus(message, isError) {
          status.textContent = message;
          status.style.color = isError ? "#8b1e3f" : "";
        }

        function clearSelection() {
          recipientNameInput.value = "";
          recipientEmailInput.value = "";
          contextLabelInput.value = "";
          targetName.textContent = "No recipient selected";
          targetEmail.textContent = "Pick a row to prepare a reply.";
          subjectInput.value = ${JSON.stringify(defaultSubject)};
          messageInput.value = "";
          setStatus(replyEnabled ? "Choose a submission or feedback entry to start replying." : replyNotice, false);
        }

        function applySelection(element) {
          const replyData = getReplyData(element);
          const recipientName = replyData.recipientName;
          const recipientEmail = replyData.recipientEmail;
          const contextLabel = replyData.contextLabel;
          const defaultSubject = replyData.defaultSubject;

          recipientNameInput.value = recipientName;
          recipientEmailInput.value = recipientEmail;
          contextLabelInput.value = contextLabel;
          targetName.textContent = recipientName || recipientEmail || "No recipient selected";
          targetEmail.textContent = recipientEmail || "No recipient email available";
          subjectInput.value = defaultSubject || subjectInput.value;
          setStatus("Reply composer ready.", false);
          messageInput.focus();
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        replyButtons.forEach(function (button) {
          button.addEventListener("click", function (event) {
            event.preventDefault();
            const row = button.closest(${JSON.stringify(`[data-reply-row-kind="${kind}"]`)});
            applySelection(row || button);
          });
        });

        clearButton.addEventListener("click", function () {
          clearSelection();
          subjectInput.focus();
        });

        form.addEventListener("submit", async function (event) {
          event.preventDefault();

          if (!replyEnabled) {
            setStatus(replyNotice, true);
            return;
          }

          const recipientName = recipientNameInput.value.trim();
          const recipientEmail = recipientEmailInput.value.trim();
          const contextLabel = contextLabelInput.value.trim();
          const subject = subjectInput.value.trim();
          const message = messageInput.value.trim();

          if (!recipientEmail) {
            setStatus("Pick a row with an email address first.", true);
            return;
          }

          if (!message) {
            setStatus("Write a reply message before sending.", true);
            messageInput.focus();
            return;
          }

          const originalText = form.querySelector("button[type='submit']").textContent;
          const submitButton = form.querySelector("button[type='submit']");
          submitButton.disabled = true;
          submitButton.textContent = "Sending...";
          setStatus("Sending reply...", false);

          try {
            const response = await fetch(${JSON.stringify(endpoint)}, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                recipientName,
                recipientEmail,
                contextLabel,
                subject,
                message,
              }),
            });

            const payload = await response.json().catch(function () {
              return null;
            });

            if (!response.ok) {
              setStatus((payload && (payload.error || payload.message)) || "Could not send the reply.", true);
              return;
            }

            setStatus((payload && payload.message) || "Reply sent successfully.", false);
            messageInput.value = "";
          } catch (error) {
            setStatus(error.message || "Could not reach the backend. Please try again.", true);
          } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
          }
        });

        clearSelection();
      })();
    </script>
  `;
}

function buildFeedbackDashboard(feedbackEntries, query) {
  const searchQuery = getQueryText(query);
  const filteredFeedback = filterFeedback(feedbackEntries, searchQuery);
  const replySummary = getReplySummary();
  const exportHref = searchQuery
    ? `/feedback/export.csv?q=${encodeURIComponent(searchQuery)}`
    : "/feedback/export.csv";
  const clearHref = searchQuery ? "/feedback" : "";
  const latestFeedback = feedbackEntries.length ? feedbackEntries[feedbackEntries.length - 1] : null;
  const latestLabel = latestFeedback
    ? new Date(latestFeedback.submittedAt).toLocaleString()
    : "No feedback yet";
  const rows = filteredFeedback.length
    ? filteredFeedback
        .map(function (entry, index) {
          const replyButton = entry.email
            ? `
                <button
                  type="button"
                  class="reply-trigger"
                  data-reply-kind="feedback"
                  data-recipient-name="${escapeHtml(entry.fullName)}"
                  data-recipient-email="${escapeHtml(entry.email)}"
                  data-context-label="${escapeHtml(`Feedback about ${entry.topic}`)}"
                  data-default-subject="${escapeHtml("Re: Your BLAST feedback")}"
                >
                  Reply
                </button>
              `
            : `<span class="reply-empty">No email</span>`;
          const rowAttributes = entry.email
            ? ` class="reply-row" data-reply-row-kind="feedback" data-recipient-name="${escapeHtml(entry.fullName)}" data-recipient-email="${escapeHtml(entry.email)}" data-context-label="${escapeHtml(`Feedback about ${entry.topic}`)}" data-default-subject="${escapeHtml("Re: Your BLAST feedback")}" tabindex="0" role="button" aria-label="Reply to ${escapeHtml(entry.fullName)}"`
            : "";

          return `
            <tr${rowAttributes}>
              <td>${index + 1}</td>
              <td>${escapeHtml(entry.fullName)}</td>
              <td>${escapeHtml(entry.email || "—")}</td>
              <td>${escapeHtml(entry.topic)}</td>
              <td>${escapeHtml(entry.message)}</td>
              <td>${formatSubmissionDate(entry.submittedAt)}</td>
              <td>${replyButton}</td>
            </tr>
          `;
        })
        .join("")
    : `
        <tr>
          <td colspan="7" style="text-align:center; padding: 1.5rem;">
            ${searchQuery ? "No feedback matches your search." : "No feedback yet."}
          </td>
        </tr>
      `;

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BLAST Feedback</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f7f1f4;
            --panel: #ffffff;
            --text: #2f1f26;
            --muted: #6f5a64;
            --accent: #5d1029;
            --border: #e4d7dd;
            --accent-soft: #f4e6ea;
          }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: linear-gradient(180deg, #fff7f9 0%, var(--bg) 100%);
            color: var(--text);
            padding: 2rem;
          }
          .wrap {
            max-width: 1100px;
            margin: 0 auto;
          }
          .card {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: 0 12px 30px rgba(93, 16, 41, 0.08);
            overflow: hidden;
          }
          header {
            padding: 1.5rem 1.5rem 1rem;
          }
          h1 {
            margin: 0 0 0.5rem;
            color: var(--accent);
            font-size: clamp(1.6rem, 4vw, 2.4rem);
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-bottom: 0.8rem;
            padding: 0.35rem 0.7rem;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent);
            font-size: 0.85rem;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.75rem;
            margin-top: 1rem;
          }
          .stat {
            padding: 0.85rem 1rem;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: linear-gradient(180deg, #fff 0%, #fffafc 100%);
          }
          .stat span {
            display: block;
            color: var(--muted);
            font-size: 0.85rem;
            margin-bottom: 0.25rem;
          }
          .stat strong {
            color: var(--accent);
            font-size: 1.1rem;
          }
          .dashboard-tools {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            align-items: end;
            margin-top: 1rem;
            padding: 0 1.5rem 1.25rem;
          }
          .search-group {
            flex: 1 1 320px;
          }
          .search-group label {
            display: block;
            font-weight: 700;
            color: var(--accent);
            margin-bottom: 0.4rem;
          }
          .search-group input {
            width: 100%;
            box-sizing: border-box;
            padding: 0.85rem 0.95rem;
            border: 1px solid var(--border);
            border-radius: 12px;
            font: inherit;
          }
          .tool-button,
          .tool-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            min-height: 44px;
            padding: 0.8rem 1rem;
            border-radius: 12px;
            border: 1px solid transparent;
            font: inherit;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
          }
          .tool-button {
            background: var(--accent);
            color: #fff;
          }
          .tool-link {
            background: #f4ebee;
            color: var(--accent);
            border-color: var(--border);
          }
          .tool-button:hover {
            background: #6f1732;
          }
          .tool-link:hover {
            background: #efe3e8;
          }
          ${buildDashboardReplyStyles()}
          .table-wrap {
            overflow-x: auto;
            border-top: 1px solid var(--border);
            background: linear-gradient(180deg, #fff 0%, #fffdfd 100%);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 900px;
            table-layout: fixed;
          }
          thead th {
            background: #faf4f6;
            color: var(--accent);
            text-align: left;
            padding: 1rem;
            font-size: 0.95rem;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 1;
          }
          tbody td {
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
            line-height: 1.5;
            word-break: break-word;
          }
          tbody tr:nth-child(even) {
            background: #fcf9fb;
          }
          tbody tr:hover {
            background: #f8eef2;
          }
          thead th:nth-child(1),
          tbody td:nth-child(1) {
            width: 4rem;
          }
          thead th:nth-child(2),
          tbody td:nth-child(2) {
            width: 15%;
          }
          thead th:nth-child(3),
          tbody td:nth-child(3) {
            width: 15%;
          }
          thead th:nth-child(4),
          tbody td:nth-child(4) {
            width: 14%;
          }
          thead th:nth-child(5),
          tbody td:nth-child(5) {
            width: 32%;
          }
          thead th:nth-child(6),
          tbody td:nth-child(6) {
            width: 20%;
          }
          thead th:nth-child(7),
          tbody td:nth-child(7) {
            width: 10%;
          }
          .note {
            padding: 1rem 1.5rem 1.5rem;
            color: var(--muted);
            font-size: 0.95rem;
            border-top: 1px solid var(--border);
            background: #fffafc;
          }
          code {
            background: #f4ebee;
            padding: 0.15rem 0.35rem;
            border-radius: 6px;
          }
          @media (max-width: 720px) {
            body {
              padding: 1rem;
            }
            .stats {
              grid-template-columns: 1fr;
            }
            .dashboard-tools {
              padding-inline: 1rem;
            }
            .reply-panel {
              margin-inline: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <header>
              <div class="badge">Protected admin dashboard</div>
              <h1>BLAST Feedback</h1>
              <p>Read the messages people send about BLAST services, pages, and community experience.</p>
              <div class="stats">
                <div class="stat">
                  <span>Total</span>
                  <strong>${feedbackEntries.length}</strong>
                </div>
                <div class="stat">
                  <span>Showing</span>
                  <strong>${filteredFeedback.length}</strong>
                </div>
                <div class="stat">
                  <span>Latest</span>
                  <strong>${escapeHtml(latestLabel)}</strong>
                </div>
              </div>
            </header>
            <form class="dashboard-tools" method="get" action="/feedback">
              <div class="search-group">
                <label for="feedbackSearch">Search feedback</label>
                <input
                  id="feedbackSearch"
                  type="search"
                  name="q"
                  placeholder="Search name, email, topic, message, or date"
                  value="${escapeHtml(searchQuery)}"
                >
              </div>
              <button class="tool-button" type="submit">Search</button>
              <a class="tool-link" href="${exportHref}">Export CSV</a>
              ${clearHref ? `<a class="tool-link" href="${clearHref}">Clear</a>` : ""}
              <a class="tool-link" href="/submissions">Review submissions</a>
              <a class="tool-link" href="/content">Manage Content</a>
            </form>
            ${buildReplyPanelMarkup({
              kind: "feedback",
              title: "Reply to feedback",
              description: "Pick a message from the list below, write a warm response, and send it back to the person.",
              defaultSubject: "Re: Your BLAST feedback",
              placeholder: "Write a kind reply that speaks to their message.",
              recipientLabel: "Reply message",
              emptyText: "Choose a feedback entry to start a reply.",
              replyEnabled: replySummary.enabled,
              replyNotice: "Replies are paused until a verified sending domain is configured in Resend.",
            })}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Topic</th>
                    <th>Message</th>
                    <th>Submitted At</th>
                    <th>Reply</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
            <div class="note">
              This dashboard is protected with Basic Auth. The data is stored in
              <code>${isDatabaseEnabled() ? "Render Postgres" : "backend/data/feedback.json"}</code>.
            </div>
          </div>
        </div>
        ${buildReplyPanelScript({
          kind: "feedback",
          endpoint: "/api/admin/reply",
          defaultSubject: "Re: Your BLAST feedback",
          replyEnabled: replySummary.enabled,
          replyNotice: "Replies are paused until a verified sending domain is configured in Resend.",
        })}
      </body>
    </html>`;
}

function buildSubmissionsDashboard(submissions, query) {
  const searchQuery = getQueryText(query);
  const filteredSubmissions = filterSubmissions(submissions, searchQuery);
  const notificationSummary = getNotificationSummary();
  const replySummary = getReplySummary();
  const exportHref = searchQuery
    ? `/submissions/export.csv?q=${encodeURIComponent(searchQuery)}`
    : "/submissions/export.csv";
  const clearHref = searchQuery ? "/submissions" : "";
  const latestSubmission = submissions.length ? submissions[submissions.length - 1] : null;
  const latestLabel = latestSubmission
    ? new Date(latestSubmission.submittedAt).toLocaleString()
    : "No submissions yet";
  const rows = filteredSubmissions.length
    ? filteredSubmissions
        .map(function (submission, index) {
          const replyButton = submission.email
            ? `
                <button
                  type="button"
                  class="reply-trigger"
                  data-reply-kind="submission"
                  data-recipient-name="${escapeHtml(submission.fullName)}"
                  data-recipient-email="${escapeHtml(submission.email)}"
                  data-context-label="${escapeHtml(`Join message from ${submission.fullName}`)}"
                  data-default-subject="${escapeHtml("Re: Your BLAST join message")}"
                >
                  Reply
                </button>
              `
            : `<span class="reply-empty">No email</span>`;
          const rowAttributes = submission.email
            ? ` class="reply-row" data-reply-row-kind="submission" data-recipient-name="${escapeHtml(submission.fullName)}" data-recipient-email="${escapeHtml(submission.email)}" data-context-label="${escapeHtml(`Join message from ${submission.fullName}`)}" data-default-subject="${escapeHtml("Re: Your BLAST join message")}" tabindex="0" role="button" aria-label="Reply to ${escapeHtml(submission.fullName)}"`
            : "";

          return `
            <tr${rowAttributes}>
              <td>${index + 1}</td>
              <td>${escapeHtml(submission.fullName)}</td>
              <td>${escapeHtml(submission.email)}</td>
              <td>${escapeHtml(submission.interest)}</td>
              <td>${formatSubmissionDate(submission.submittedAt)}</td>
              <td>${replyButton}</td>
            </tr>
          `;
        })
        .join("")
    : `
        <tr>
          <td colspan="6" style="text-align:center; padding: 1.5rem;">
            ${searchQuery ? "No submissions match your search." : "No submissions yet."}
          </td>
        </tr>
      `;

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BLAST Submissions</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f7f1f4;
            --panel: #ffffff;
            --text: #2f1f26;
            --muted: #6f5a64;
            --accent: #5d1029;
            --border: #e4d7dd;
            --accent-soft: #f4e6ea;
          }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: linear-gradient(180deg, #fff7f9 0%, var(--bg) 100%);
            color: var(--text);
            padding: 2rem;
          }
          .wrap {
            max-width: 1100px;
            margin: 0 auto;
          }
          .card {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: 0 12px 30px rgba(93, 16, 41, 0.08);
            overflow: hidden;
          }
          header {
            padding: 1.5rem 1.5rem 1rem;
          }
          h1 {
            margin: 0 0 0.5rem;
            color: var(--accent);
            font-size: clamp(1.6rem, 4vw, 2.4rem);
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-bottom: 0.8rem;
            padding: 0.35rem 0.7rem;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent);
            font-size: 0.85rem;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.75rem;
            margin-top: 1rem;
          }
          .stat {
            padding: 0.85rem 1rem;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: linear-gradient(180deg, #fff 0%, #fffafc 100%);
          }
          .stat span {
            display: block;
            color: var(--muted);
            font-size: 0.85rem;
            margin-bottom: 0.25rem;
          }
          .stat strong {
            color: var(--accent);
            font-size: 1.1rem;
          }
          .dashboard-tools {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            align-items: end;
            margin-top: 1rem;
            padding: 0 1.5rem 1.25rem;
          }
          .search-group {
            flex: 1 1 320px;
          }
          .search-group label {
            display: block;
            font-weight: 700;
            color: var(--accent);
            margin-bottom: 0.4rem;
          }
          .search-group input {
            width: 100%;
            box-sizing: border-box;
            padding: 0.85rem 0.95rem;
            border: 1px solid var(--border);
            border-radius: 12px;
            font: inherit;
          }
          .tool-button,
          .tool-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            min-height: 44px;
            padding: 0.8rem 1rem;
            border-radius: 12px;
            border: 1px solid transparent;
            font: inherit;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
          }
          .tool-button {
            background: var(--accent);
            color: #fff;
          }
          .tool-link {
            background: #f4ebee;
            color: var(--accent);
            border-color: var(--border);
          }
          .tool-button:hover {
            background: #6f1732;
          }
          .tool-link:hover {
            background: #efe3e8;
          }
          ${buildDashboardReplyStyles()}
          .table-wrap {
            overflow-x: auto;
            border-top: 1px solid var(--border);
            background: linear-gradient(180deg, #fff 0%, #fffdfd 100%);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 760px;
            table-layout: fixed;
          }
          thead th {
            background: #faf4f6;
            color: var(--accent);
            text-align: left;
            padding: 1rem;
            font-size: 0.95rem;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 1;
          }
          tbody td {
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
            line-height: 1.5;
            word-break: break-word;
          }
          tbody tr:nth-child(even) {
            background: #fcf9fb;
          }
          tbody tr:hover {
            background: #f8eef2;
          }
          thead th:nth-child(1),
          tbody td:nth-child(1) {
            width: 4rem;
          }
          thead th:nth-child(2),
          tbody td:nth-child(2) {
            width: 16%;
          }
          thead th:nth-child(3),
          tbody td:nth-child(3) {
            width: 20%;
          }
          thead th:nth-child(4),
          tbody td:nth-child(4) {
            width: 36%;
          }
          thead th:nth-child(5),
          tbody td:nth-child(5) {
            width: 20%;
          }
          thead th:nth-child(6),
          tbody td:nth-child(6) {
            width: 10%;
          }
          .note {
            padding: 1rem 1.5rem 1.5rem;
            color: var(--muted);
            font-size: 0.95rem;
            border-top: 1px solid var(--border);
            background: #fffafc;
          }
          code {
            background: #f4ebee;
            padding: 0.15rem 0.35rem;
            border-radius: 6px;
          }
          @media (max-width: 720px) {
            body {
              padding: 1rem;
            }
            .stats {
              grid-template-columns: 1fr;
            }
            .dashboard-tools {
              padding-inline: 1rem;
            }
            .reply-panel {
              margin-inline: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <header>
          <div class="badge">Protected admin dashboard</div>
          <h1>BLAST Submissions</h1>
          <p>Search, review, and export the entries people send through the join form.</p>
          <div class="stats">
            <div class="stat">
              <span>Total</span>
              <strong>${submissions.length}</strong>
            </div>
            <div class="stat">
              <span>Showing</span>
              <strong>${filteredSubmissions.length}</strong>
            </div>
            <div class="stat">
              <span>Latest</span>
              <strong>${escapeHtml(latestLabel)}</strong>
            </div>
            <div class="stat">
              <span>Email alerts</span>
              <strong>${notificationSummary.enabled ? "On" : "Off"}</strong>
            </div>
          </div>
        </header>
            <form class="dashboard-tools" method="get" action="/submissions">
              <div class="search-group">
                <label for="submissionSearch">Search submissions</label>
                <input
                  id="submissionSearch"
                  type="search"
                  name="q"
                  placeholder="Search name, email, message, or date"
                  value="${escapeHtml(searchQuery)}"
                >
              </div>
              <button class="tool-button" type="submit">Search</button>
              <a class="tool-link" href="${exportHref}">Export CSV</a>
              ${clearHref ? `<a class="tool-link" href="${clearHref}">Clear</a>` : ""}
              <button class="tool-button" type="button" id="sendTestAlertBtn">Send test alert</button>
              <a class="tool-link" href="/content">Manage Content</a>
              <a class="tool-link" href="/feedback">Review Feedback</a>
            </form>
            ${buildReplyPanelMarkup({
              kind: "submission",
              title: "Reply to a join message",
              description: "Select a submission below, write your response, and send it back to the person who wants to join.",
              defaultSubject: "Re: Your BLAST join message",
              placeholder: "Write a warm reply to the person who joined BLAST.",
              recipientLabel: "Reply message",
              emptyText: "Choose a submission to start a reply.",
              replyEnabled: replySummary.enabled,
              replyNotice: "Replies are paused until a verified sending domain is configured in Resend.",
            })}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Message</th>
                    <th>Submitted At</th>
                    <th>Reply</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
            <div class="note">
              This dashboard is protected with Basic Auth. The data is stored in
              <code>${isDatabaseEnabled() ? "Render Postgres" : "backend/data/submissions.json"}</code>.
              ${notificationSummary.enabled
                ? ` Email alerts are active for <code>${escapeHtml(notificationSummary.recipient)}</code>.`
                : " Email alerts are not configured yet."}
            </div>
          </div>
        </div>
        ${buildReplyPanelScript({
          kind: "submission",
          endpoint: "/api/admin/reply",
          defaultSubject: "Re: Your BLAST join message",
          replyEnabled: replySummary.enabled,
          replyNotice: "Replies are paused until a verified sending domain is configured in Resend.",
        })}
        <script>
          (function () {
            const testButton = document.getElementById("sendTestAlertBtn");
            if (!testButton) return;
            testButton.addEventListener("click", async function () {
              const originalText = testButton.textContent;
              testButton.disabled = true;
              testButton.textContent = "Sending...";
              try {
                const response = await fetch("/api/notifications/test", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                });
                const payload = await response.json().catch(function () {
                  return null;
                });

                if (response.ok) {
                  testButton.textContent = "Sent";
                } else {
                  testButton.textContent = "Failed";
                  if (payload && (payload.error || payload.message)) {
                    window.alert(payload.error || payload.message);
                  }
                }
              } catch (error) {
                testButton.textContent = "Failed";
                window.alert(error.message || "Unable to send the test alert.");
              }

              setTimeout(function () {
                testButton.disabled = false;
                testButton.textContent = originalText;
              }, 2000);
            });
          })();
        </script>
      </body>
    </html>`;
}

function buildContentRowTitle(type, index) {
  return `${type} ${index + 1}`;
}

function buildEventRowTitle(index) {
  return buildContentRowTitle("Event", index);
}

function buildMediaRowTitle(index) {
  return buildContentRowTitle("Image", index);
}

function buildEventEditorRow(event, index) {
  return `
    <div class="editor-row" data-row-type="event">
      <div class="editor-row__head">
        <strong data-row-label>${buildEventRowTitle(index)}</strong>
        <button type="button" class="remove-row" data-remove-row>Remove</button>
      </div>
      <div class="editor-grid">
        <label class="field">
          <span>Title</span>
          <input type="text" data-field="title" maxlength="80" placeholder="Event title" value="${escapeHtml(event.title)}">
        </label>
        <label class="field">
          <span>Time</span>
          <input type="text" data-field="time" maxlength="80" placeholder="Event time" value="${escapeHtml(event.time)}">
        </label>
        <label class="field">
          <span>Location</span>
          <input type="text" data-field="location" maxlength="80" placeholder="Event location" value="${escapeHtml(event.location)}">
        </label>
      </div>
    </div>
  `;
}

function buildMediaEditorRow(item, index) {
  return `
    <div class="editor-row" data-row-type="media">
      <div class="editor-row__head">
        <strong data-row-label>${buildMediaRowTitle(index)}</strong>
        <button type="button" class="remove-row" data-remove-row>Remove</button>
      </div>
      <div class="editor-grid">
        <label class="field">
          <span>Caption</span>
          <input type="text" data-field="caption" maxlength="80" placeholder="Caption text" value="${escapeHtml(item.caption)}">
        </label>
        <label class="field">
          <span>Image source</span>
          <input type="text" data-field="src" maxlength="160" placeholder="media/example.jpg" value="${escapeHtml(item.src)}">
        </label>
        <label class="field">
          <span>Alt text</span>
          <input type="text" data-field="alt" maxlength="120" placeholder="Image description" value="${escapeHtml(item.alt)}">
        </label>
      </div>
    </div>
  `;
}

function buildContentDashboard(content) {
  const normalizedContent = normalizeContent(content);
  const eventRows = normalizedContent.events.length
    ? normalizedContent.events.map(buildEventEditorRow).join("")
    : buildEventEditorRow({ title: "", time: "", location: "" }, 0);
  const mediaRows = normalizedContent.media.images.length
    ? normalizedContent.media.images.map(buildMediaEditorRow).join("")
    : buildMediaEditorRow({ src: "", alt: "", caption: "" }, 0);
  const lastSavedLabel = normalizedContent.updatedAt
    ? new Date(normalizedContent.updatedAt).toLocaleString()
    : "Never saved";

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BLAST Content Manager</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f7f1f4;
            --panel: #ffffff;
            --text: #2f1f26;
            --muted: #6f5a64;
            --accent: #5d1029;
            --border: #e4d7dd;
            --accent-soft: #f4e6ea;
          }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: linear-gradient(180deg, #fff7f9 0%, var(--bg) 100%);
            color: var(--text);
            padding: 2rem;
          }
          .wrap {
            max-width: 1180px;
            margin: 0 auto;
          }
          .card {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: 0 12px 30px rgba(93, 16, 41, 0.08);
            overflow: hidden;
          }
          header {
            padding: 1.5rem 1.5rem 1rem;
          }
          h1 {
            margin: 0 0 0.5rem;
            color: var(--accent);
            font-size: clamp(1.8rem, 4vw, 2.6rem);
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-bottom: 0.8rem;
            padding: 0.35rem 0.7rem;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent);
            font-size: 0.85rem;
            font-weight: 700;
          }
          p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.75rem;
            margin-top: 1rem;
          }
          .stat {
            padding: 0.85rem 1rem;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: linear-gradient(180deg, #fff 0%, #fffafc 100%);
          }
          .stat span {
            display: block;
            color: var(--muted);
            font-size: 0.85rem;
            margin-bottom: 0.25rem;
          }
          .stat strong {
            color: var(--accent);
            font-size: 1.1rem;
          }
          .dashboard-tools {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            align-items: center;
            padding: 0 1.5rem 1.25rem;
          }
          .tool-button,
          .tool-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            min-height: 44px;
            padding: 0.8rem 1rem;
            border-radius: 12px;
            border: 1px solid transparent;
            font: inherit;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
          }
          .tool-button {
            background: var(--accent);
            color: #fff;
          }
          .tool-link {
            background: #f4ebee;
            color: var(--accent);
            border-color: var(--border);
          }
          .tool-button:hover {
            background: #6f1732;
          }
          .tool-link:hover {
            background: #efe3e8;
          }
          .section-shell {
            border-top: 1px solid var(--border);
            background: linear-gradient(180deg, #fff 0%, #fffdfd 100%);
            padding: 1.25rem 1.5rem 1.5rem;
          }
          .section-head {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0.75rem;
            align-items: start;
            margin-bottom: 1rem;
          }
          .section-head h2 {
            margin: 0 0 0.35rem;
            color: var(--accent);
          }
          .section-head p {
            max-width: 66ch;
          }
          .editor-stack {
            display: grid;
            gap: 1rem;
          }
          .editor-panel {
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 1rem;
            background: #fff;
          }
          .editor-panel h3 {
            margin: 0 0 0.35rem;
            color: var(--accent);
          }
          .editor-panel > p {
            margin-bottom: 1rem;
          }
          .editor-list {
            display: grid;
            gap: 0.85rem;
          }
          .editor-row {
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 0.95rem;
            background: linear-gradient(180deg, #fff 0%, #fffafc 100%);
          }
          .editor-row__head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.85rem;
          }
          .remove-row {
            background: transparent;
            color: #8b1e3f;
            border: 1px solid #e5cfd7;
            border-radius: 999px;
            padding: 0.35rem 0.7rem;
            cursor: pointer;
            font: inherit;
            font-weight: 700;
          }
          .remove-row:hover {
            background: #f7e6eb;
          }
          .editor-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.75rem;
          }
          .editor-grid--video {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .field span {
            display: block;
            margin-bottom: 0.35rem;
            color: var(--accent);
            font-weight: 700;
          }
          .field input,
          .field textarea {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 0.8rem 0.9rem;
            font: inherit;
            background: #fff;
          }
          .field textarea {
            min-height: 88px;
            resize: vertical;
          }
          .content-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1rem;
          }
          .content-status {
            margin-top: 0.85rem;
            padding: 0.95rem 1rem;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: #fffafc;
            color: var(--muted);
            min-height: 1.5rem;
          }
          .note {
            padding: 1rem 1.5rem 1.5rem;
            color: var(--muted);
            font-size: 0.95rem;
            border-top: 1px solid var(--border);
            background: #fffafc;
          }
          code {
            background: #f4ebee;
            padding: 0.15rem 0.35rem;
            border-radius: 6px;
          }
          @media (max-width: 900px) {
            .stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .editor-grid,
            .editor-grid--video {
              grid-template-columns: 1fr;
            }
          }
          @media (max-width: 720px) {
            body {
              padding: 1rem;
            }
            .stats {
              grid-template-columns: 1fr;
            }
            .dashboard-tools {
              padding-inline: 1rem;
            }
            .section-shell {
              padding-inline: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <header>
              <div class="badge">Protected content manager</div>
              <h1>BLAST Homepage Content</h1>
              <p>Edit the upcoming events and media highlights shown on the public homepage without touching HTML.</p>
              <div class="stats">
                <div class="stat">
                  <span>Events</span>
                  <strong id="eventCount">${normalizedContent.events.length}</strong>
                </div>
                <div class="stat">
                  <span>Media images</span>
                  <strong id="mediaCount">${normalizedContent.media.images.length}</strong>
                </div>
                <div class="stat">
                  <span>Video</span>
                  <strong id="videoStatus">${normalizedContent.media.video.src ? "Ready" : "Missing"}</strong>
                </div>
                <div class="stat">
                  <span>Last saved</span>
                  <strong id="lastSaved">${escapeHtml(lastSavedLabel)}</strong>
                </div>
              </div>
            </header>
            <div class="dashboard-tools">
              <a class="tool-link" href="/submissions">Back to submissions</a>
              <a class="tool-link" href="/api/content/export.json">Download backup</a>
              <button class="tool-button" type="button" id="restoreDefaultsBtn">Restore defaults</button>
              <button class="tool-button" type="button" id="saveContentBtn">Save changes</button>
            </div>
            <div class="section-shell">
              <div class="editor-stack">
                <section class="editor-panel">
                  <div class="section-head">
                    <div>
                      <h2>Upcoming Events</h2>
                      <p>These cards appear in the public Events section.</p>
                    </div>
                    <button class="tool-link" type="button" id="addEventBtn">Add event</button>
                  </div>
                  <div class="editor-list" id="eventsEditor">
                    ${eventRows}
                  </div>
                </section>
                <section class="editor-panel">
                  <div class="section-head">
                    <div>
                      <h2>Media Highlights</h2>
                      <p>Update the intro, image cards, and the featured video used on the public Media section.</p>
                    </div>
                    <button class="tool-link" type="button" id="addMediaBtn">Add image</button>
                  </div>
                  <div class="field" style="margin-bottom: 1rem;">
                    <span>Media intro</span>
                    <textarea id="mediaIntro" maxlength="180">${escapeHtml(normalizedContent.media.intro)}</textarea>
                  </div>
                  <div class="editor-list" id="mediaEditor">
                    ${mediaRows}
                  </div>
                </section>
                <section class="editor-panel">
                  <h3>Featured Video</h3>
                  <p>Use the exact file names from your project folder. The homepage will encode spaces in the path automatically.</p>
                  <div class="editor-grid editor-grid--video">
                    <label class="field">
                      <span>Title</span>
                      <input type="text" id="videoTitle" maxlength="80" value="${escapeHtml(normalizedContent.media.video.title)}">
                    </label>
                    <label class="field">
                      <span>Caption</span>
                      <input type="text" id="videoCaption" maxlength="120" value="${escapeHtml(normalizedContent.media.video.caption)}">
                    </label>
                    <label class="field">
                      <span>Video source</span>
                      <input type="text" id="videoSrc" maxlength="160" value="${escapeHtml(normalizedContent.media.video.src)}">
                    </label>
                    <label class="field">
                      <span>Poster image</span>
                      <input type="text" id="videoPoster" maxlength="160" value="${escapeHtml(normalizedContent.media.video.poster)}">
                    </label>
                  </div>
                </section>
              </div>
              <div class="content-actions">
                <button class="tool-button" type="button" id="saveContentBtnBottom">Save changes</button>
                <a class="tool-link" href="/submissions">Review submissions</a>
              </div>
              <div class="content-status" id="contentStatus" aria-live="polite">No changes saved yet.</div>
            </div>
            <div class="note">
              The public homepage reads this content from <code>/api/content</code>. The data is stored in
              <code>${isDatabaseEnabled() ? "Render Postgres with file fallback" : "backend/data/content.json"}</code>.
            </div>
          </div>
        </div>
        <script>
          window.__BLAST_CONTENT__ = ${serializeForScript(normalizedContent)};
          window.__BLAST_DEFAULT_CONTENT__ = ${serializeForScript(getDefaultContent())};
          (function () {
            const currentContent = window.__BLAST_CONTENT__ || {};
            const defaultContent = window.__BLAST_DEFAULT_CONTENT__ || currentContent;
            const eventsEditor = document.getElementById("eventsEditor");
            const mediaEditor = document.getElementById("mediaEditor");
            const mediaIntro = document.getElementById("mediaIntro");
            const videoTitle = document.getElementById("videoTitle");
            const videoCaption = document.getElementById("videoCaption");
            const videoSrc = document.getElementById("videoSrc");
            const videoPoster = document.getElementById("videoPoster");
            const contentStatus = document.getElementById("contentStatus");
            const saveButtonTop = document.getElementById("saveContentBtn");
            const saveButtonBottom = document.getElementById("saveContentBtnBottom");
            const restoreButton = document.getElementById("restoreDefaultsBtn");
            const eventCount = document.getElementById("eventCount");
            const mediaCount = document.getElementById("mediaCount");
            const videoStatus = document.getElementById("videoStatus");
            const lastSaved = document.getElementById("lastSaved");
            const addEventBtn = document.getElementById("addEventBtn");
            const addMediaBtn = document.getElementById("addMediaBtn");

            function setStatus(message) {
              if (contentStatus) {
                contentStatus.textContent = message;
              }
            }

            function updateSummary() {
              if (eventCount) {
                eventCount.textContent = String(eventsEditor.querySelectorAll("[data-row-type='event']").length);
              }
              if (mediaCount) {
                mediaCount.textContent = String(mediaEditor.querySelectorAll("[data-row-type='media']").length);
              }
              if (videoStatus) {
                videoStatus.textContent = videoSrc.value.trim() ? "Ready" : "Missing";
              }
            }

            function refreshLabels(container, labelText) {
              container.querySelectorAll("[data-row-label]").forEach(function (node, index) {
                node.textContent = labelText + " " + (index + 1);
              });
            }

            function buildEventRow(item) {
              const row = document.createElement("div");
              row.className = "editor-row";
              row.setAttribute("data-row-type", "event");
              row.innerHTML = [
                '<div class="editor-row__head">',
                '<strong data-row-label>Event</strong>',
                '<button type="button" class="remove-row" data-remove-row>Remove</button>',
                '</div>',
                '<div class="editor-grid">',
                '<label class="field"><span>Title</span><input type="text" maxlength="80" placeholder="Event title" data-field="title"></label>',
                '<label class="field"><span>Time</span><input type="text" maxlength="80" placeholder="Event time" data-field="time"></label>',
                '<label class="field"><span>Location</span><input type="text" maxlength="80" placeholder="Event location" data-field="location"></label>',
                '</div>',
              ].join('');

              row.querySelector('[data-field="title"]').value = item && item.title ? item.title : '';
              row.querySelector('[data-field="time"]').value = item && item.time ? item.time : '';
              row.querySelector('[data-field="location"]').value = item && item.location ? item.location : '';

              row.querySelector("[data-remove-row]").addEventListener("click", function () {
                row.remove();
                refreshLabels(eventsEditor, "Event");
                updateSummary();
              });

              return row;
            }

            function buildMediaRow(item) {
              const row = document.createElement("div");
              row.className = "editor-row";
              row.setAttribute("data-row-type", "media");
              row.innerHTML = [
                '<div class="editor-row__head">',
                '<strong data-row-label>Image</strong>',
                '<button type="button" class="remove-row" data-remove-row>Remove</button>',
                '</div>',
                '<div class="editor-grid">',
                '<label class="field"><span>Caption</span><input type="text" maxlength="80" placeholder="Caption text" data-field="caption"></label>',
                '<label class="field"><span>Image source</span><input type="text" maxlength="160" placeholder="media/example.jpg" data-field="src"></label>',
                '<label class="field"><span>Alt text</span><input type="text" maxlength="120" placeholder="Image description" data-field="alt"></label>',
                '</div>',
              ].join('');

              row.querySelector('[data-field="caption"]').value = item && item.caption ? item.caption : '';
              row.querySelector('[data-field="src"]').value = item && item.src ? item.src : '';
              row.querySelector('[data-field="alt"]').value = item && item.alt ? item.alt : '';

              row.querySelector("[data-remove-row]").addEventListener("click", function () {
                row.remove();
                refreshLabels(mediaEditor, "Image");
                updateSummary();
              });

              return row;
            }

            function renderContent(content) {
              const safeContent = content || {};
              const safeEvents = Array.isArray(safeContent.events) ? safeContent.events : [];
              const safeMedia = safeContent.media || {};
              const safeImages = Array.isArray(safeMedia.images) ? safeMedia.images : [];

              eventsEditor.innerHTML = "";
              if (safeEvents.length) {
                safeEvents.forEach(function (event) {
                  eventsEditor.appendChild(buildEventRow(event));
                });
              } else {
                eventsEditor.appendChild(buildEventRow({}));
              }

              mediaEditor.innerHTML = "";
              if (safeImages.length) {
                safeImages.forEach(function (image) {
                  mediaEditor.appendChild(buildMediaRow(image));
                });
              } else {
                mediaEditor.appendChild(buildMediaRow({}));
              }

              mediaIntro.value = safeMedia.intro || "";
              videoTitle.value = safeMedia.video && safeMedia.video.title ? safeMedia.video.title : "";
              videoCaption.value = safeMedia.video && safeMedia.video.caption ? safeMedia.video.caption : "";
              videoSrc.value = safeMedia.video && safeMedia.video.src ? safeMedia.video.src : "";
              videoPoster.value = safeMedia.video && safeMedia.video.poster ? safeMedia.video.poster : "";

              refreshLabels(eventsEditor, "Event");
              refreshLabels(mediaEditor, "Image");
              updateSummary();
            }

            function collectRows(container, fields) {
              return Array.from(container.querySelectorAll("[data-row-type]"))
                .map(function (row) {
                  const item = {};
                  fields.forEach(function (field) {
                    const input = row.querySelector('[data-field="' + field + '"]');
                    item[field] = input ? input.value.trim() : "";
                  });
                  return item;
                })
                .filter(function (item) {
                  return fields.some(function (field) {
                    return item[field];
                  });
                });
            }

            function collectContent() {
              return {
                updatedAt: currentContent.updatedAt || null,
                events: collectRows(eventsEditor, ["title", "time", "location"]),
                media: {
                  intro: mediaIntro.value.trim(),
                  images: collectRows(mediaEditor, ["caption", "src", "alt"]),
                  video: {
                    title: videoTitle.value.trim(),
                    caption: videoCaption.value.trim(),
                    src: videoSrc.value.trim(),
                    poster: videoPoster.value.trim(),
                  },
                },
              };
            }

            function syncButtons(disabled) {
              saveButtonTop.disabled = disabled;
              saveButtonBottom.disabled = disabled;
              restoreButton.disabled = disabled;
              addEventBtn.disabled = disabled;
              addMediaBtn.disabled = disabled;
            }

            async function saveContent() {
              syncButtons(true);
              setStatus("Saving content...");

              try {
                const response = await fetch("/api/content", {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(collectContent()),
                });

                const payload = await response.json().catch(function () {
                  return {};
                });

                if (!response.ok) {
                  setStatus(payload.error || payload.message || "Unable to save content.");
                  syncButtons(false);
                  return;
                }

                renderContent(payload.content || collectContent());
                currentContent.updatedAt = payload.content && payload.content.updatedAt ? payload.content.updatedAt : currentContent.updatedAt;
                if (payload.content && payload.content.updatedAt) {
                  lastSaved.textContent = new Date(payload.content.updatedAt).toLocaleString();
                }
                setStatus(payload.message || "Homepage content saved successfully.");
              } catch (error) {
                setStatus(error.message || "Unable to save content.");
              } finally {
                syncButtons(false);
              }
            }

            renderContent(currentContent);

            addEventBtn.addEventListener("click", function () {
              eventsEditor.appendChild(buildEventRow({}));
              refreshLabels(eventsEditor, "Event");
              updateSummary();
            });

            addMediaBtn.addEventListener("click", function () {
              mediaEditor.appendChild(buildMediaRow({}));
              refreshLabels(mediaEditor, "Image");
              updateSummary();
            });

            saveButtonTop.addEventListener("click", saveContent);
            saveButtonBottom.addEventListener("click", saveContent);

            restoreButton.addEventListener("click", function () {
              renderContent(defaultContent);
              setStatus("Defaults restored in the editor. Save to apply them to the homepage.");
            });
          })();
        </script>
      </body>
    </html>`;
}

function safeCompare(expected, provided) {
  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function sendAdminChallenge(res) {
  res.set("WWW-Authenticate", `Basic realm="${ADMIN_REALM}", charset="UTF-8"`);
  return res.status(401).send("Authentication required.");
}

function requireAdmin(req, res, next) {
  if (!credentialsConfigured()) {
    return res.status(503).send("Admin credentials are not configured.");
  }

  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Basic ")) {
    return sendAdminChallenge(res);
  }

  let decoded;
  try {
    decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  } catch (error) {
    return sendAdminChallenge(res);
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return sendAdminChallenge(res);
  }

  const providedUsername = decoded.slice(0, separatorIndex);
  const providedPassword = decoded.slice(separatorIndex + 1);
  const credentials = getAdminCredentials();

  if (
    !safeCompare(credentials.username, providedUsername) ||
    !safeCompare(credentials.password, providedPassword)
  ) {
    return sendAdminChallenge(res);
  }

  return next();
}

app.get("/health", function (req, res) {
  res.json({
    status: "ok",
    service: "blast-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/content", async function (req, res, next) {
  try {
    const content = await readContent();
    res.set("Cache-Control", "no-store");
    res.json({
      source: isDatabaseEnabled() ? "Render Postgres" : "backend/data/content.json",
      content,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/content/export.json", requireAdmin, async function (req, res, next) {
  try {
    const content = await readContent();

    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="blast-homepage-content.json"');
    res.send(
      `${JSON.stringify(
        {
          source: isDatabaseEnabled() ? "Render Postgres" : "backend/data/content.json",
          exportedAt: new Date().toISOString(),
          content,
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    return next(error);
  }
});

app.get("/api/submissions", requireAdmin, async function (req, res, next) {
  try {
    const submissions = await readSubmissions();
    const filteredSubmissions = filterSubmissions(submissions, req.query.q);
    res.json({
      count: filteredSubmissions.length,
      total: submissions.length,
      query: getQueryText(req.query.q),
      submissions: filteredSubmissions,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/feedback", requireAdmin, async function (req, res, next) {
  try {
    const feedbackEntries = await readFeedback();
    const filteredFeedback = filterFeedback(feedbackEntries, req.query.q);
    res.json({
      count: filteredFeedback.length,
      total: feedbackEntries.length,
      query: getQueryText(req.query.q),
      feedback: filteredFeedback,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/notifications/test", requireAdmin, async function (req, res, next) {
  try {
    const result = await sendTestNotification();

    if (result.status === "skipped") {
      return res.status(503).json({
        message: "Email alerts are not configured yet.",
        notification: result,
      });
    }

    return res.json({
      message: "Test notification sent.",
      notification: result,
    });
  } catch (error) {
    console.error("Test notification failed:", error);
    return res.status(502).json({
      message: "Test notification failed.",
      error: error.message || "Unknown SMTP error.",
    });
  }
});

app.post("/api/admin/reply", requireAdmin, async function (req, res, next) {
  try {
    const recipientName = normalizeText(req.body.recipientName);
    const recipientEmail = normalizeText(req.body.recipientEmail);
    const contextLabel = normalizeText(req.body.contextLabel);
    const subject = normalizeText(req.body.subject);
    const message = normalizeText(req.body.message);
    const errors = {};

    if (!recipientEmail) {
      errors.recipientEmail = "A recipient email is required.";
    } else if (!isValidEmail(recipientEmail)) {
      errors.recipientEmail = "Please enter a valid recipient email address.";
    }

    if (!message) {
      errors.message = "Please write a reply message.";
    } else if (message.length > 4000) {
      errors.message = "Reply message must be 4000 characters or less.";
    }

    if (subject && subject.length > 140) {
      errors.subject = "Subject must be 140 characters or less.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    const result = await sendAdminReplyEmail({
      recipientName,
      recipientEmail,
      contextLabel,
      subject,
      message,
    });

    if (result.status === "skipped") {
      return res.status(503).json({
        message: "Replies are paused until a verified domain is configured.",
        notification: result,
      });
    }

    return res.json({
      message: "Reply sent.",
      notification: result,
    });
  } catch (error) {
    console.error("Admin reply failed:", error);
    return res.status(502).json({
      message: "Reply failed.",
      error: error.message || "Unknown SMTP error.",
    });
  }
});

app.post("/api/bot/chat", async function (req, res, next) {
  try {
    const message = normalizeText(req.body.message);
    const page = normalizeText(req.body.page);

    if (!message) {
      return res.status(400).json({
        message: "A message is required.",
      });
    }

    const content = await readContent();
    const reply = await generateBlastBotReply(message, content, page);

    res.json({
      message: "Blast bot reply generated.",
      text: reply.text,
      links: reply.links,
      source: reply.source,
      model: reply.model,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/submissions/export.csv", requireAdmin, async function (req, res, next) {
  try {
    const submissions = await readSubmissions();
    const filteredSubmissions = filterSubmissions(submissions, req.query.q);
    const csv = buildSubmissionsCsv(filteredSubmissions);

    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="blast-submissions.csv"');
    res.send(csv);
  } catch (error) {
    return next(error);
  }
});

app.get("/feedback/export.csv", requireAdmin, async function (req, res, next) {
  try {
    const feedbackEntries = await readFeedback();
    const filteredFeedback = filterFeedback(feedbackEntries, req.query.q);
    const csv = buildFeedbackCsv(filteredFeedback);

    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="blast-feedback.csv"');
    res.send(csv);
  } catch (error) {
    return next(error);
  }
});

app.get("/submissions", requireAdmin, async function (req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.type("html").send(buildSubmissionsDashboard(await readSubmissions(), req.query.q));
  } catch (error) {
    return next(error);
  }
});

app.get("/feedback", requireAdmin, async function (req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.type("html").send(buildFeedbackDashboard(await readFeedback(), req.query.q));
  } catch (error) {
    return next(error);
  }
});

app.put("/api/content", requireAdmin, async function (req, res, next) {
  try {
    const normalized = normalizeContent(req.body);
    normalized.updatedAt = new Date().toISOString();
    await saveContent(normalized);

    res.json({
      message: "Homepage content saved successfully.",
      content: normalized,
    });
  } catch (error) {
    console.error("Content save failed:", error);
    return res.status(502).json({
      message: "Homepage content save failed.",
      error: error && error.message ? error.message : "Unknown content storage error.",
    });
  }
});

app.get("/content", requireAdmin, async function (req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.type("html").send(buildContentDashboard(await readContent()));
  } catch (error) {
    return next(error);
  }
});

app.post("/api/join", async function (req, res, next) {
  try {
    const fullName = normalizeText(req.body.fullName);
    const email = normalizeText(req.body.email);
    const interest = normalizeText(req.body.interest);
    const website = normalizeText(req.body.website);
    const errors = {};

    if (website) {
      return res.status(400).json({
        message: "Please try again.",
      });
    }

    if (!fullName) {
      errors.fullName = "Full name is required.";
    } else if (fullName.length > 50) {
      errors.fullName = "Full name must be 50 characters or less.";
    }

    if (!email) {
      errors.email = "Email is required.";
    } else if (email.length > 80 || !isValidEmail(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!interest) {
      errors.interest = "Please tell us why you want to join.";
    } else if (interest.length > 300) {
      errors.interest = "Your message must be 300 characters or less.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    if (await isJoinRateLimited(req)) {
      return res.status(429).json({
        message: "You are submitting too quickly. Please wait a few minutes and try again.",
      });
    }

    const submission = {
      id: crypto.randomUUID(),
      fullName,
      email,
      interest,
      submittedAt: new Date().toISOString(),
    };

    await saveSubmission(submission);
    const notification = {
      status: "queued",
    };

    Promise.resolve()
      .then(function () {
        return Promise.all([
          sendSubmissionNotification(submission),
          sendSubmissionConfirmation(submission),
        ]);
      })
      .catch(function (notificationError) {
        console.error("Notification delivery failed:", notificationError);
      });

    return res.status(201).json({
      message: "Submission saved successfully.",
      submission,
      notification,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/feedback", async function (req, res, next) {
  try {
    const fullName = normalizeText(req.body.fullName);
    const email = normalizeText(req.body.email);
    const topic = normalizeText(req.body.topic);
    const message = normalizeText(req.body.message);
    const website = normalizeText(req.body.website);
    const errors = {};

    if (website) {
      return res.status(400).json({
        message: "Please try again.",
      });
    }

    if (!fullName) {
      errors.fullName = "Full name is required.";
    } else if (fullName.length > 50) {
      errors.fullName = "Full name must be 50 characters or less.";
    }

    if (email && (email.length > 80 || !isValidEmail(email))) {
      errors.email = "Please enter a valid email address.";
    }

    if (!topic) {
      errors.topic = "Please choose what your feedback is about.";
    } else if (topic.length > 80) {
      errors.topic = "Topic must be 80 characters or less.";
    }

    if (!message) {
      errors.message = "Please share your feedback.";
    } else if (message.length > 500) {
      errors.message = "Your message must be 500 characters or less.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    if (await isFeedbackRateLimited(req)) {
      return res.status(429).json({
        message: "You are submitting too quickly. Please wait a few minutes and try again.",
      });
    }

    const feedback = {
      id: crypto.randomUUID(),
      fullName,
      email,
      topic,
      message,
      submittedAt: new Date().toISOString(),
    };

    await saveFeedback(feedback);

    Promise.resolve()
      .then(function () {
        return Promise.all([
          sendFeedbackNotification(feedback),
          sendFeedbackConfirmation(feedback),
        ]);
      })
      .catch(function (notificationError) {
        console.error("Feedback notification delivery failed:", notificationError);
      });

    return res.status(201).json({
      message: "Thanks for sharing your feedback.",
      feedback,
    });
  } catch (error) {
    return next(error);
  }
});

app.use(function (req, res) {
  res.status(404).json({ message: "Route not found." });
});

app.use(function (error, req, res, next) {
  console.error(error);
  res.status(500).json({
    message: "Something went wrong on the server.",
  });
});

app.listen(PORT, function () {
  console.log(`BLAST backend listening on port ${PORT}`);
});
