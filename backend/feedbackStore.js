const fs = require("fs/promises");
const path = require("path");
const { getPool, isDatabaseEnabled } = require("./database");

const STORAGE_DIR = path.join(__dirname, "data");
const FEEDBACK_FILE = path.join(STORAGE_DIR, "feedback.json");
let databaseReadyPromise = null;

async function ensureFileStorage() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(FEEDBACK_FILE);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(FEEDBACK_FILE, "[]\n", "utf8");
      return;
    }

    throw error;
  }
}

async function readFileFeedback() {
  await ensureFileStorage();
  const raw = await fs.readFile(FEEDBACK_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeFileFeedback(feedbackEntries) {
  await ensureFileStorage();
  await fs.writeFile(
    FEEDBACK_FILE,
    `${JSON.stringify(feedbackEntries, null, 2)}\n`,
    "utf8"
  );
}

async function ensureDatabase() {
  const pool = getPool();
  if (!pool) return;

  if (!databaseReadyPromise) {
    databaseReadyPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS feedback_entries (
          id text PRIMARY KEY,
          full_name text NOT NULL,
          email text,
          topic text NOT NULL,
          message text NOT NULL,
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

async function readDatabaseFeedback() {
  const pool = getPool();
  await ensureDatabase();
  const result = await pool.query(`
    SELECT
      id,
      full_name AS "fullName",
      email,
      topic,
      message,
      submitted_at AS "submittedAt"
    FROM feedback_entries
    ORDER BY submitted_at ASC
  `);

  return result.rows;
}

async function saveDatabaseFeedback(feedback) {
  const pool = getPool();
  await ensureDatabase();
  await pool.query(
    `
      INSERT INTO feedback_entries (id, full_name, email, topic, message, submitted_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      feedback.id,
      feedback.fullName,
      feedback.email || null,
      feedback.topic,
      feedback.message,
      feedback.submittedAt,
    ]
  );
}

async function readFeedback() {
  if (getPool()) {
    return readDatabaseFeedback();
  }

  return readFileFeedback();
}

async function saveFeedback(feedback) {
  if (getPool()) {
    return saveDatabaseFeedback(feedback);
  }

  const feedbackEntries = await readFileFeedback();
  feedbackEntries.push(feedback);
  await writeFileFeedback(feedbackEntries);
}

module.exports = {
  isDatabaseEnabled,
  readFeedback,
  saveFeedback,
};
