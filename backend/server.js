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
