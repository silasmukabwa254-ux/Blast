const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { getPool } = require("./database");

const STORAGE_DIR = path.join(__dirname, "data");
const COMMUNITY_FILE = path.join(STORAGE_DIR, "community.json");

let databaseReadyPromise = null;
let communitySeedPromise = null;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toIsoTimestamp(value) {
  const parsed = Date.parse(normalizeText(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function createSeedComment(id, fullName, message, submittedAt) {
  return {
    id,
    fullName,
    message,
    submittedAt,
  };
}

function createSeedTestimony(id, fullName, email, message, likes, submittedAt, comments) {
  return {
    id,
    fullName,
    email,
    message,
    likes,
    submittedAt,
    comments,
  };
}

function getDefaultCommunityFeed() {
  return {
    updatedAt: "2026-04-08T00:00:00.000Z",
    testimonies: [
      createSeedTestimony(
        "seed-joshua-overcoming-fear",
        "Joshua",
        "",
        "God helped me overcome fear this week. I am grateful for the peace that came through prayer and the support of my brothers and sisters.",
        18,
        "2026-04-07T07:20:00.000Z",
        [
          createSeedComment(
            "seed-joshua-comment-1",
            "Hope",
            "Thank you for sharing this, Joshua. God is faithful to carry us through.",
            "2026-04-07T07:58:00.000Z"
          ),
          createSeedComment(
            "seed-joshua-comment-2",
            "Caroline",
            "This encouraged me today. Peace really does come through prayer.",
            "2026-04-07T08:14:00.000Z"
          ),
        ]
      ),
      createSeedTestimony(
        "seed-cynthia-exams",
        "Cynthia",
        "",
        "Please pray for my exams. I am trusting God for wisdom, calmness, and the strength to keep going.",
        14,
        "2026-04-06T18:45:00.000Z",
        [
          createSeedComment(
            "seed-cynthia-comment-1",
            "Kelvin",
            "We are standing with you, Cynthia. May God give you peace and understanding.",
            "2026-04-06T19:05:00.000Z"
          ),
        ]
      ),
      createSeedTestimony(
        "seed-hope-blast-family",
        "Hope",
        "",
        "Today's verse reminded me that BLAST is more than a gathering. It is a place where faith feels close, hope feels alive, and no one has to walk alone.",
        22,
        "2026-04-05T12:30:00.000Z",
        [
          createSeedComment(
            "seed-hope-comment-1",
            "Joshua",
            "Amen. BLAST really does feel like family.",
            "2026-04-05T12:54:00.000Z"
          ),
          createSeedComment(
            "seed-hope-comment-2",
            "Shillah",
            "This is such a beautiful reminder. Thank you, Hope.",
            "2026-04-05T13:02:00.000Z"
          ),
        ]
      ),
      createSeedTestimony(
        "seed-elisha-media-service",
        "Elisha",
        "",
        "Serving through media keeps showing me how God is using small moments to make a big difference in the community.",
        11,
        "2026-04-04T16:00:00.000Z",
        [
          createSeedComment(
            "seed-elisha-comment-1",
            "Caroline",
            "Your work helps people see the heart of BLAST. Thank you for serving so well.",
            "2026-04-04T16:24:00.000Z"
          ),
        ]
      ),
      createSeedTestimony(
        "seed-caroline-faith",
        "Caroline",
        "",
        "I love how BLAST keeps reminding us that faith can be steady, warm, and practical in the middle of real life.",
        16,
        "2026-04-03T10:15:00.000Z",
        [
          createSeedComment(
            "seed-caroline-comment-1",
            "Nelson",
            "This is the kind of faith that builds people up. So grateful for you.",
            "2026-04-03T10:41:00.000Z"
          ),
        ]
      ),
      createSeedTestimony(
        "seed-kelvin-strength",
        "Kelvin",
        "",
        "Praying for everyone who is carrying something heavy this week. May God give you strength and peace that lasts.",
        20,
        "2026-04-02T15:45:00.000Z",
        [
          createSeedComment(
            "seed-kelvin-comment-1",
            "Ian",
            "Thank you, Kelvin. This prayer speaks to my heart today.",
            "2026-04-02T16:08:00.000Z"
          ),
          createSeedComment(
            "seed-kelvin-comment-2",
            "Cynthia",
            "Amen. May God strengthen everyone reading this.",
            "2026-04-02T16:22:00.000Z"
          ),
        ]
      ),
    ],
  };
}

function normalizeComment(comment) {
  const source = comment || {};
  const fullName = normalizeText(source.fullName);
  const message = normalizeText(source.message);
  const submittedAt = toIsoTimestamp(source.submittedAt);

  if (!fullName && !message) {
    return null;
  }

  return {
    id: normalizeText(source.id) || randomUUID(),
    fullName: fullName || "BLAST Friend",
    message: message || "",
    submittedAt,
  };
}

function normalizeTestimony(testimony) {
  const source = testimony || {};
  const fullName = normalizeText(source.fullName);
  const email = normalizeText(source.email);
  const message = normalizeText(source.message);
  const submittedAt = toIsoTimestamp(source.submittedAt);
  const likesValue = Number(source.likes);
  const comments = Array.isArray(source.comments)
    ? source.comments.map(normalizeComment).filter(Boolean)
    : [];

  if (!fullName && !email && !message) {
    return null;
  }

  return {
    id: normalizeText(source.id) || randomUUID(),
    fullName: fullName || "Anonymous",
    email: email || "",
    message,
    likes: Number.isFinite(likesValue) && likesValue > 0 ? Math.floor(likesValue) : 0,
    submittedAt,
    comments,
  };
}

function normalizeCommunityFeed(feed) {
  const source = feed || {};
  const testimonies = Array.isArray(source.testimonies)
    ? source.testimonies.map(normalizeTestimony).filter(Boolean)
    : getDefaultCommunityFeed().testimonies;

  testimonies.sort(function (left, right) {
    return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
  });

  testimonies.forEach(function (testimony) {
    testimony.comments.sort(function (left, right) {
      return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
    });
  });

  return {
    updatedAt: toIsoTimestamp(source.updatedAt || new Date().toISOString()),
    testimonies,
  };
}

async function ensureFileStorage() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(COMMUNITY_FILE);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(
        COMMUNITY_FILE,
        `${JSON.stringify(getDefaultCommunityFeed(), null, 2)}\n`,
        "utf8"
      );
      return;
    }

    throw error;
  }
}

async function readFileCommunityFeed() {
  await ensureFileStorage();
  const raw = await fs.readFile(COMMUNITY_FILE, "utf8");

  try {
    return normalizeCommunityFeed(JSON.parse(raw));
  } catch (error) {
    return normalizeCommunityFeed(getDefaultCommunityFeed());
  }
}

async function writeFileCommunityFeed(feed) {
  await ensureFileStorage();
  const normalized = normalizeCommunityFeed(feed);

  await fs.writeFile(
    COMMUNITY_FILE,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );

  return normalized;
}

async function syncFileMirrorFromDatabase() {
  try {
    const feed = await readDatabaseCommunityFeed();
    await writeFileCommunityFeed(feed);
  } catch (error) {
    console.warn(
      "Community file mirror update failed:",
      error && error.message ? error.message : error
    );
  }
}

async function ensureDatabase() {
  const pool = getPool();
  if (!pool) return;

  if (!databaseReadyPromise) {
    databaseReadyPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS community_testimonies (
          id text PRIMARY KEY,
          full_name text NOT NULL,
          email text NOT NULL DEFAULT '',
          message text NOT NULL,
          likes integer NOT NULL DEFAULT 0,
          submitted_at timestamptz NOT NULL
        );
        CREATE TABLE IF NOT EXISTS community_comments (
          id text PRIMARY KEY,
          testimony_id text NOT NULL REFERENCES community_testimonies(id) ON DELETE CASCADE,
          full_name text NOT NULL,
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

async function seedDatabaseIfEmpty() {
  const pool = getPool();

  if (!pool) {
    return;
  }

  if (!communitySeedPromise) {
    communitySeedPromise = (async function () {
      const countResult = await pool.query(
        "SELECT COUNT(*)::int AS count FROM community_testimonies"
      );

      if (countResult.rows[0].count > 0) {
        return;
      }

      const defaults = getDefaultCommunityFeed().testimonies;

      for (const testimony of defaults) {
        await pool.query(
          `
            INSERT INTO community_testimonies (id, full_name, email, message, likes, submitted_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
          `,
          [
            testimony.id,
            testimony.fullName,
            testimony.email || "",
            testimony.message,
            testimony.likes || 0,
            testimony.submittedAt,
          ]
        );

        for (const comment of testimony.comments || []) {
          await pool.query(
            `
              INSERT INTO community_comments (id, testimony_id, full_name, message, submitted_at)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO NOTHING
            `,
            [comment.id, testimony.id, comment.fullName, comment.message, comment.submittedAt]
          );
        }
      }
    })()
      .catch(function (error) {
        communitySeedPromise = null;
        throw error;
      });
  }

  return communitySeedPromise;
}

async function readDatabaseCommunityFeed() {
  const pool = getPool();
  await ensureDatabase();
  await seedDatabaseIfEmpty();

  const testimoniesResult = await pool.query(`
    SELECT
      id,
      full_name AS "fullName",
      email,
      message,
      likes,
      submitted_at AS "submittedAt"
    FROM community_testimonies
    ORDER BY submitted_at DESC
  `);

  const commentsResult = await pool.query(`
    SELECT
      id,
      testimony_id AS "testimonyId",
      full_name AS "fullName",
      message,
      submitted_at AS "submittedAt"
    FROM community_comments
    ORDER BY submitted_at ASC
  `);

  const commentsByTestimonyId = new Map();

  commentsResult.rows.forEach(function (comment) {
    const current = commentsByTestimonyId.get(comment.testimonyId) || [];
    current.push({
      id: comment.id,
      fullName: comment.fullName,
      message: comment.message,
      submittedAt: comment.submittedAt,
    });
    commentsByTestimonyId.set(comment.testimonyId, current);
  });

  return {
    updatedAt: new Date().toISOString(),
    testimonies: testimoniesResult.rows.map(function (testimony) {
      return {
        id: testimony.id,
        fullName: testimony.fullName,
        email: testimony.email || "",
        message: testimony.message,
        likes: Number(testimony.likes) || 0,
        submittedAt: testimony.submittedAt,
        comments: commentsByTestimonyId.get(testimony.id) || [],
      };
    }),
  };
}

async function getCommunityFeed() {
  if (getPool()) {
    try {
      const feed = await readDatabaseCommunityFeed();
      await writeFileCommunityFeed(feed);
      return feed;
    } catch (error) {
      console.warn(
        "Community database read failed, falling back to file storage:",
        error && error.message ? error.message : error
      );
    }
  }

  return readFileCommunityFeed();
}

async function saveDatabaseTestimony(testimony) {
  const pool = getPool();
  await ensureDatabase();
  await pool.query(
    `
      INSERT INTO community_testimonies (id, full_name, email, message, likes, submitted_at)
      VALUES ($1, $2, $3, $4, 0, $5)
    `,
    [
      testimony.id,
      testimony.fullName,
      testimony.email || "",
      testimony.message,
      testimony.submittedAt,
    ]
  );

  await syncFileMirrorFromDatabase();
  return testimony;
}

async function saveFileTestimony(testimony) {
  const feed = await readFileCommunityFeed();
  feed.testimonies.unshift({
    ...testimony,
    comments: [],
  });
  feed.updatedAt = new Date().toISOString();
  await writeFileCommunityFeed(feed);
  return testimony;
}

async function saveCommunityTestimony(testimony) {
  const normalized = normalizeTestimony(testimony);

  if (!normalized) {
    throw new Error("A testimony is required.");
  }

  if (getPool()) {
    try {
      return await saveDatabaseTestimony(normalized);
    } catch (error) {
      console.warn(
        "Community testimony database save failed, falling back to file storage:",
        error && error.message ? error.message : error
      );
    }
  }

  return saveFileTestimony(normalized);
}

async function updateDatabaseLike(testimonyId) {
  const pool = getPool();
  await ensureDatabase();
  const result = await pool.query(
    `
      UPDATE community_testimonies
      SET likes = likes + 1
      WHERE id = $1
      RETURNING id
    `,
    [testimonyId]
  );

  if (!result.rows.length) {
    return null;
  }

  await syncFileMirrorFromDatabase();
  return result.rows[0];
}

async function updateFileLike(testimonyId) {
  const feed = await readFileCommunityFeed();
  const testimony = feed.testimonies.find(function (entry) {
    return entry.id === testimonyId;
  });

  if (!testimony) {
    return null;
  }

  testimony.likes = Number(testimony.likes || 0) + 1;
  feed.updatedAt = new Date().toISOString();
  await writeFileCommunityFeed(feed);
  return { id: testimonyId };
}

async function incrementCommunityLike(testimonyId) {
  const normalizedId = normalizeText(testimonyId);

  if (!normalizedId) {
    throw new Error("A testimony id is required.");
  }

  if (getPool()) {
    try {
      return await updateDatabaseLike(normalizedId);
    } catch (error) {
      console.warn(
        "Community like database update failed, falling back to file storage:",
        error && error.message ? error.message : error
      );
    }
  }

  return updateFileLike(normalizedId);
}

async function saveDatabaseComment(testimonyId, comment) {
  const pool = getPool();
  await ensureDatabase();

  const testimonyResult = await pool.query(
    "SELECT id FROM community_testimonies WHERE id = $1",
    [testimonyId]
  );

  if (!testimonyResult.rows.length) {
    return null;
  }

  await pool.query(
    `
      INSERT INTO community_comments (id, testimony_id, full_name, message, submitted_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [comment.id, testimonyId, comment.fullName, comment.message, comment.submittedAt]
  );

  await syncFileMirrorFromDatabase();
  return comment;
}

async function saveFileComment(testimonyId, comment) {
  const feed = await readFileCommunityFeed();
  const testimony = feed.testimonies.find(function (entry) {
    return entry.id === testimonyId;
  });

  if (!testimony) {
    return null;
  }

  testimony.comments.push(comment);
  feed.updatedAt = new Date().toISOString();
  await writeFileCommunityFeed(feed);
  return comment;
}

async function saveCommunityComment(testimonyId, comment) {
  const normalizedId = normalizeText(testimonyId);
  const normalizedComment = normalizeComment(comment);

  if (!normalizedId) {
    throw new Error("A testimony id is required.");
  }

  if (!normalizedComment) {
    throw new Error("A comment is required.");
  }

  if (getPool()) {
    try {
      return await saveDatabaseComment(normalizedId, normalizedComment);
    } catch (error) {
      console.warn(
        "Community comment database save failed, falling back to file storage:",
        error && error.message ? error.message : error
      );
    }
  }

  return saveFileComment(normalizedId, normalizedComment);
}

module.exports = {
  getCommunityFeed,
  getDefaultCommunityFeed,
  incrementCommunityLike,
  normalizeCommunityFeed,
  saveCommunityComment,
  saveCommunityTestimony,
};
