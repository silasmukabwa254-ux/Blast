const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const {
  isDatabaseEnabled,
  readSubmissions,
  saveSubmission,
} = require("./submissionStore");
const {
  getDefaultContent,
  normalizeContent,
  readContent,
  saveContent,
} = require("./contentStore");
const {
  getNotificationSummary,
  sendSubmissionNotification,
  sendTestNotification,
} = require("./notificationService");

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
const joinRateLimitBuckets = new Map();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
  })
);
app.use(express.json({ limit: "64kb" }));

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getClientIdentifier(req) {
  const forwardedFor = normalizeText(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return normalizeText(req.ip || req.socket?.remoteAddress || "unknown");
}

function pruneJoinRateLimitBuckets(now) {
  for (const [clientId, bucket] of joinRateLimitBuckets.entries()) {
    if (now - bucket.windowStart >= JOIN_RATE_LIMIT_WINDOW_MS) {
      joinRateLimitBuckets.delete(clientId);
    }
  }
}

function isJoinRateLimited(req) {
  const now = Date.now();
  const clientId = getClientIdentifier(req);

  pruneJoinRateLimitBuckets(now);

  const bucket = joinRateLimitBuckets.get(clientId);
  if (!bucket) {
    joinRateLimitBuckets.set(clientId, {
      windowStart: now,
      count: 1,
    });
    return false;
  }

  if (bucket.count >= JOIN_RATE_LIMIT_MAX) {
    return true;
  }

  bucket.count += 1;
  return false;
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

function buildSubmissionsDashboard(submissions, query) {
  const searchQuery = getQueryText(query);
  const filteredSubmissions = filterSubmissions(submissions, searchQuery);
  const notificationSummary = getNotificationSummary();
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
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(submission.fullName)}</td>
              <td>${escapeHtml(submission.email)}</td>
              <td>${escapeHtml(submission.interest)}</td>
              <td>${formatSubmissionDate(submission.submittedAt)}</td>
            </tr>
          `;
        })
        .join("")
    : `
        <tr>
          <td colspan="5" style="text-align:center; padding: 1.5rem;">
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
            width: 24%;
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
            </form>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Message</th>
                    <th>Submitted At</th>
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
              <code>${isDatabaseEnabled() ? "Render Postgres" : "backend/data/content.json"}</code>.
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
                  setStatus(payload.message || "Unable to save content.");
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

app.get("/submissions", requireAdmin, async function (req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.type("html").send(buildSubmissionsDashboard(await readSubmissions(), req.query.q));
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
    return next(error);
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

    if (isJoinRateLimited(req)) {
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
        return sendSubmissionNotification(submission);
      })
      .then(function (result) {
        if (result && result.status !== "sent") {
          console.log("Notification result:", result);
        }
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
