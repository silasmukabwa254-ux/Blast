const fs = require("fs/promises");
const path = require("path");
const { getPool } = require("./database");

const STORAGE_DIR = path.join(__dirname, "data");
const CONTENT_FILE = path.join(STORAGE_DIR, "content.json");
const CONTENT_KEY = "homepage";

let databaseReadyPromise = null;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getContentTimestamp(content) {
  const value = content && content.updatedAt ? content.updatedAt : "";
  const parsed = Date.parse(normalizeText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDefaultContent() {
  return {
    updatedAt: null,
    events: [
      {
        title: "Saturday Fellowship",
        time: "Every Saturday at 4:00 PM",
        location: "BLAST Youth Hall",
      },
      {
        title: "Prayer Gathering",
        time: "First Friday of each month at 6:00 PM",
        location: "Online Meeting",
      },
    ],
    media: {
      intro: "Moments from fellowship, mentorship sessions, and community outreach.",
      images: [
        {
          src: "media/img3.jpg-opt.jpg",
          alt: "Community gathering",
          caption: "Community",
        },
        {
          src: "media/img4.jpg-opt.jpg",
          alt: "Saturday fellowship group photo",
          caption: "Saturday Fellowship",
        },
        {
          src: "media/img2.jpg-opt.jpg",
          alt: "Bible study discussion session",
          caption: "Bible Study",
        },
        {
          src: "media/img7.png-opt.jpg",
          alt: "Mentorship moment with youth leaders",
          caption: "Mentorship",
        },
        {
          src: "blast.webp",
          alt: "Fellowship gathering",
          caption: "Fellowship",
        },
        {
          src: "media/img9.png-opt.jpg",
          alt: "Community outreach activity",
          caption: "Community Outreach",
        },
      ],
      video: {
        title: "Featured Video",
        caption: "A glimpse from our latest fellowship gathering.",
        src: "VID 2.mp4",
        poster: "blast.webp",
      },
    },
  };
}

function normalizeEvent(event) {
  const title = normalizeText(event && event.title);
  const time = normalizeText(event && event.time);
  const location = normalizeText(event && event.location);

  if (!title && !time && !location) {
    return null;
  }

  return {
    title: title || "Untitled event",
    time: time || "Time to be announced",
    location: location || "Location to be announced",
  };
}

function normalizeMediaItem(item) {
  const src = normalizeText(item && item.src);
  const alt = normalizeText(item && item.alt);
  const caption = normalizeText(item && item.caption);

  if (!src && !alt && !caption) {
    return null;
  }

  return {
    src: src || "blast.webp",
    alt: alt || caption || "BLAST media",
    caption: caption || alt || "BLAST",
  };
}

function normalizeVideo(video) {
  const defaults = getDefaultContent().media.video;
  const source = video || {};

  return {
    title: normalizeText(source.title) || defaults.title,
    caption: normalizeText(source.caption) || defaults.caption,
    src: normalizeText(source.src) || defaults.src,
    poster: normalizeText(source.poster) || defaults.poster,
  };
}

function normalizeContent(content) {
  const defaults = getDefaultContent();
  const source = content || {};
  const mediaSource = source.media || {};

  const events = Array.isArray(source.events)
    ? source.events.map(normalizeEvent).filter(Boolean)
    : defaults.events;

  const images = Array.isArray(mediaSource.images)
    ? mediaSource.images.map(normalizeMediaItem).filter(Boolean)
    : defaults.media.images;

  return {
    updatedAt: normalizeText(source.updatedAt) || defaults.updatedAt,
    events,
    media: {
      intro: normalizeText(mediaSource.intro) || defaults.media.intro,
      images,
      video: normalizeVideo(mediaSource.video),
    },
  };
}

async function ensureFileStorage() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(CONTENT_FILE);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(
        CONTENT_FILE,
        `${JSON.stringify(getDefaultContent(), null, 2)}\n`,
        "utf8"
      );
      return;
    }

    throw error;
  }
}

async function readFileContent() {
  await ensureFileStorage();
  const raw = await fs.readFile(CONTENT_FILE, "utf8");

  try {
    return normalizeContent(JSON.parse(raw));
  } catch (error) {
    return getDefaultContent();
  }
}

async function writeFileContent(content) {
  await ensureFileStorage();
  const normalized = normalizeContent(content);

  await fs.writeFile(
    CONTENT_FILE,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
}

async function persistFileMirror(content) {
  try {
    await writeFileContent(content);
  } catch (error) {
    console.warn(
      "Content file mirror update failed:",
      error && error.message ? error.message : error
    );
  }
}

async function writeDatabaseContent(content) {
  const pool = getPool();
  const normalized = normalizeContent(content);

  if (!pool) {
    throw new Error("Database is not available.");
  }

  await ensureDatabase();
  await pool.query(
    `
      INSERT INTO site_content (content_key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (content_key)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [CONTENT_KEY, JSON.stringify(normalized)]
  );

  return normalized;
}

async function ensureDatabase() {
  const pool = getPool();
  if (!pool) return;

  if (!databaseReadyPromise) {
    databaseReadyPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS site_content (
          content_key text PRIMARY KEY,
          payload jsonb NOT NULL,
          updated_at timestamptz NOT NULL
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

async function saveDatabaseContent(content) {
  const normalized = normalizeContent(content);

  try {
    await writeDatabaseContent(normalized);
    await persistFileMirror(normalized);
  } catch (error) {
    console.warn(
      "Content database save failed, falling back to file storage:",
      error && error.message ? error.message : error
    );
    await writeFileContent(normalized);
  }
}

async function readDatabaseContent() {
  const pool = getPool();
  try {
    await ensureDatabase();

    const result = await pool.query(
      `
        SELECT payload
        FROM site_content
        WHERE content_key = $1
        LIMIT 1
      `,
      [CONTENT_KEY]
    );

    if (!result.rows.length) {
      const defaults = normalizeContent(getDefaultContent());
      await saveDatabaseContent(defaults);
      return defaults;
    }

    const databaseContent = normalizeContent(result.rows[0].payload);
    const fileContent = await readFileContent();

    if (getContentTimestamp(fileContent) > getContentTimestamp(databaseContent)) {
      try {
        await writeDatabaseContent(fileContent);
      } catch (syncError) {
        console.warn(
          "Content database sync from file failed:",
          syncError && syncError.message ? syncError.message : syncError
        );
      }
      return normalizeContent(fileContent);
    }

    await persistFileMirror(databaseContent);
    return databaseContent;
  } catch (error) {
    console.warn(
      "Content database read failed, falling back to file storage:",
      error && error.message ? error.message : error
    );
    return readFileContent();
  }
}

async function readContent() {
  if (getPool()) {
    return readDatabaseContent();
  }

  return readFileContent();
}

async function saveContent(content) {
  if (getPool()) {
    return saveDatabaseContent(content);
  }

  return writeFileContent(content);
}

module.exports = {
  getDefaultContent,
  normalizeContent,
  readContent,
  saveContent,
};
