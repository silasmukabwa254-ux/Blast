const fs = require("fs/promises");
const path = require("path");
const { getPool } = require("./database");

const STORAGE_DIR = path.join(__dirname, "data");
const RATE_LIMIT_FILE = path.join(STORAGE_DIR, "rate-limits.json");

let databaseReadyPromise = null;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parseBucketWindow(bucket) {
  const parsed = Date.parse(normalizeText(bucket && bucket.windowStart));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureFileStorage() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(RATE_LIMIT_FILE);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(RATE_LIMIT_FILE, "[]\n", "utf8");
      return;
    }

    throw error;
  }
}

async function readFileBuckets() {
  await ensureFileStorage();
  const raw = await fs.readFile(RATE_LIMIT_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeFileBuckets(buckets) {
  await ensureFileStorage();
  await fs.writeFile(
    RATE_LIMIT_FILE,
    `${JSON.stringify(buckets, null, 2)}\n`,
    "utf8"
  );
}

function pruneBuckets(buckets, now, windowMs) {
  return buckets.filter(function (bucket) {
    return now - parseBucketWindow(bucket) < windowMs;
  });
}

async function ensureDatabase() {
  const pool = getPool();
  if (!pool) return;

  if (!databaseReadyPromise) {
    databaseReadyPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS rate_limit_buckets (
          scope text NOT NULL,
          client_id text NOT NULL,
          window_start timestamptz NOT NULL,
          count integer NOT NULL,
          updated_at timestamptz NOT NULL,
          PRIMARY KEY (scope, client_id)
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

async function checkFileRateLimit(scope, clientId, windowMs, maxCount) {
  const now = Date.now();
  const buckets = await readFileBuckets();
  const prunedBuckets = pruneBuckets(buckets, now, windowMs);
  const bucketIndex = prunedBuckets.findIndex(function (bucket) {
    return bucket.scope === scope && bucket.clientId === clientId;
  });

  if (bucketIndex === -1) {
    prunedBuckets.push({
      scope,
      clientId,
      windowStart: new Date(now).toISOString(),
      count: 1,
    });
    await writeFileBuckets(prunedBuckets);
    return false;
  }

  const bucket = prunedBuckets[bucketIndex];
  if (bucket.count >= maxCount) {
    await writeFileBuckets(prunedBuckets);
    return true;
  }

  bucket.count += 1;
  bucket.windowStart = new Date(now).toISOString();
  await writeFileBuckets(prunedBuckets);
  return false;
}

async function checkDatabaseRateLimit(scope, clientId, windowMs, maxCount) {
  const pool = getPool();
  await ensureDatabase();

  if (!pool) {
    throw new Error("Database is not available.");
  }

  const now = new Date();
  const nowMs = now.getTime();

  await pool.query("BEGIN");

  try {
    const result = await pool.query(
      `
        SELECT count, window_start
        FROM rate_limit_buckets
        WHERE scope = $1 AND client_id = $2
        FOR UPDATE
      `,
      [scope, clientId]
    );

    if (!result.rows.length) {
      await pool.query(
        `
          INSERT INTO rate_limit_buckets (scope, client_id, window_start, count, updated_at)
          VALUES ($1, $2, $3, 1, $3)
        `,
        [scope, clientId, now]
      );
      await pool.query("COMMIT");
      return false;
    }

    const row = result.rows[0];
    const windowStartMs = new Date(row.window_start).getTime();

    if (nowMs - windowStartMs >= windowMs) {
      await pool.query(
        `
          UPDATE rate_limit_buckets
          SET window_start = $3, count = 1, updated_at = $3
          WHERE scope = $1 AND client_id = $2
        `,
        [scope, clientId, now]
      );
      await pool.query("COMMIT");
      return false;
    }

    if (Number(row.count) >= maxCount) {
      await pool.query("COMMIT");
      return true;
    }

    await pool.query(
      `
        UPDATE rate_limit_buckets
        SET count = count + 1, updated_at = $3
        WHERE scope = $1 AND client_id = $2
      `,
      [scope, clientId, now]
    );
    await pool.query("COMMIT");
    return false;
  } catch (error) {
    try {
      await pool.query("ROLLBACK");
    } catch (rollbackError) {
      console.warn("Rate limit rollback failed:", rollbackError);
    }
    throw error;
  }
}

async function isRateLimited(scope, clientId, windowMs, maxCount) {
  const normalizedScope = normalizeText(scope);
  const normalizedClientId = normalizeText(clientId);

  if (!normalizedScope || !normalizedClientId) {
    return false;
  }

  if (getPool()) {
    try {
      return await checkDatabaseRateLimit(normalizedScope, normalizedClientId, windowMs, maxCount);
    } catch (error) {
      console.warn(
        "Rate limit database check failed, falling back to file storage:",
        error && error.message ? error.message : error
      );
    }
  }

  return checkFileRateLimit(normalizedScope, normalizedClientId, windowMs, maxCount);
}

module.exports = {
  isRateLimited,
};
