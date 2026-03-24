const fs = require("fs/promises");
const path = require("path");
const { getPool, isDatabaseEnabled } = require("./database");

const STORAGE_DIR = path.join(__dirname, "data");
const SUBMISSIONS_FILE = path.join(STORAGE_DIR, "submissions.json");
let databaseReadyPromise = null;

async function ensureFileStorage() {
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

async function readFileSubmissions() {
  await ensureFileStorage();
  const raw = await fs.readFile(SUBMISSIONS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeFileSubmissions(submissions) {
  await ensureFileStorage();
  await fs.writeFile(
    SUBMISSIONS_FILE,
    `${JSON.stringify(submissions, null, 2)}\n`,
    "utf8"
  );
}

async function ensureDatabase() {
  const pool = getPool();
  if (!pool) return;

  if (!databaseReadyPromise) {
    databaseReadyPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS submissions (
          id text PRIMARY KEY,
          full_name text NOT NULL,
          email text NOT NULL,
          interest text NOT NULL,
          submitted_at timestamptz NOT NULL
        );
      `)
      .then(function () {
        return true;
      })
      .catch(function (error) {
        databaseReadyPromise = null;
        throw error;
      });
  }

  return databaseReadyPromise;
}

async function readDatabaseSubmissions() {
  const pool = getPool();
  await ensureDatabase();
  const result = await pool.query(`
    SELECT
      id,
      full_name AS "fullName",
      email,
      interest,
      submitted_at AS "submittedAt"
    FROM submissions
    ORDER BY submitted_at ASC
  `);

  return result.rows;
}

async function saveDatabaseSubmission(submission) {
  const pool = getPool();
  await ensureDatabase();
  await pool.query(
    `
      INSERT INTO submissions (id, full_name, email, interest, submitted_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      submission.id,
      submission.fullName,
      submission.email,
      submission.interest,
      submission.submittedAt,
    ]
  );
}

async function readSubmissions() {
  if (getPool()) {
    return readDatabaseSubmissions();
  }

  return readFileSubmissions();
}

async function saveSubmission(submission) {
  if (getPool()) {
    return saveDatabaseSubmission(submission);
  }

  const submissions = await readFileSubmissions();
  submissions.push(submission);
  await writeFileSubmissions(submissions);
}

module.exports = {
  isDatabaseEnabled,
  readSubmissions,
  saveSubmission,
};
