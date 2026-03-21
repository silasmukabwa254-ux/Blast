const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const STORAGE_DIR = path.join(__dirname, "data");
const SUBMISSIONS_FILE = path.join(STORAGE_DIR, "submissions.json");

app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? "*" : ALLOWED_ORIGIN,
  })
);
app.use(express.json({ limit: "64kb" }));

function normalizeText(value) {
  return String(value ?? "").trim();
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

async function ensureStorage() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(SUBMISSIONS_FILE, "[]\n", "utf8");
      return;
    }

    throw error;
  }
}

async function readSubmissions() {
  await ensureStorage();
  const raw = await fs.readFile(SUBMISSIONS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeSubmissions(submissions) {
  await ensureStorage();
  await fs.writeFile(
    SUBMISSIONS_FILE,
    `${JSON.stringify(submissions, null, 2)}\n`,
    "utf8"
  );
}

app.get("/health", function (req, res) {
  res.json({
    status: "ok",
    service: "blast-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/submissions", async function (req, res, next) {
  try {
    const submissions = await readSubmissions();
    res.json({
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/submissions", async function (req, res, next) {
  try {
    const submissions = await readSubmissions();
    const rows = submissions.length
      ? submissions
          .map(function (submission, index) {
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(submission.fullName)}</td>
                <td>${escapeHtml(submission.email)}</td>
                <td>${escapeHtml(submission.interest)}</td>
                <td>${escapeHtml(new Date(submission.submittedAt).toLocaleString())}</td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="5" style="text-align:center; padding: 1.5rem;">No submissions yet.</td>
          </tr>
        `;

    res.set("Cache-Control", "no-store");
    res.type("html").send(`<!doctype html>
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
            p {
              margin: 0;
              color: var(--muted);
              line-height: 1.6;
            }
            .meta {
              display: flex;
              gap: 1rem;
              flex-wrap: wrap;
              margin-top: 1rem;
            }
            .meta a {
              color: var(--accent);
              text-decoration: none;
              font-weight: 700;
            }
            .table-wrap {
              overflow-x: auto;
              border-top: 1px solid var(--border);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              min-width: 760px;
            }
            thead th {
              background: #faf4f6;
              color: var(--accent);
              text-align: left;
              padding: 1rem;
              font-size: 0.95rem;
              border-bottom: 1px solid var(--border);
            }
            tbody td {
              padding: 1rem;
              border-bottom: 1px solid var(--border);
              vertical-align: top;
              line-height: 1.5;
            }
            tbody tr:nth-child(even) {
              background: #fcf9fb;
            }
            .note {
              padding: 1rem 1.5rem 1.5rem;
              color: var(--muted);
              font-size: 0.95rem;
            }
            code {
              background: #f4ebee;
              padding: 0.15rem 0.35rem;
              border-radius: 6px;
            }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="card">
              <header>
                <h1>BLAST Submissions</h1>
                <p>Saved form entries from the join form.</p>
                <div class="meta">
                  <span><strong>Total:</strong> ${submissions.length}</span>
                  <a href="/api/submissions" target="_blank" rel="noreferrer">View JSON</a>
                  <a href="/health" target="_blank" rel="noreferrer">Health check</a>
                </div>
              </header>
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
                This page is for local development and review. The data is stored in <code>backend/data/submissions.json</code>.
              </div>
            </div>
          </div>
        </body>
      </html>`);
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

    const submissions = await readSubmissions();
    submissions.push(submission);
    await writeSubmissions(submissions);

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
