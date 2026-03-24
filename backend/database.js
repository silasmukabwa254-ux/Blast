const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "";

let pool = null;

function getPool() {
  if (!DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
}

function isDatabaseEnabled() {
  return Boolean(DATABASE_URL);
}

module.exports = {
  getPool,
  isDatabaseEnabled,
};
