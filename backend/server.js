const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const {
  isDatabaseEnabled,
  readSubmissions,
  saveSubmission,
} = require("./submissionStore");

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || ALLOWED_ORIGIN)
  .split(",")
  .map(function (origin) {
    return origin.trim();
  })
  .filter(Boolean);
const ADMIN_REALM = "BLAST Admin";

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
            </div>
          </div>
        </div>
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

app.post("/api/join", async function (req, res, next) {
  try {
    const fullName = normalizeText(req.body.fullName);
    const email = normalizeText(req.body.email);
    const interest = normalizeText(req.body.interest);
    const errors = {};

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

    const submission = {
      id: crypto.randomUUID(),
      fullName,
      email,
      interest,
      submittedAt: new Date().toISOString(),
    };

    await saveSubmission(submission);

    return res.status(201).json({
      message: "Submission saved successfully.",
      submission,
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
