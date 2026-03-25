const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = String(process.env.BLAST_AI_MODEL || "gpt-5.4-mini").trim() || "gpt-5.4-mini";
const REQUEST_TIMEOUT_MS = Number.parseInt(String(process.env.BLAST_BOT_TIMEOUT_MS || "15000"), 10);

const SITE_LINKS = [
  { label: "About", href: "about.html" },
  { label: "Programs & Events", href: "programs-events.html#programs" },
  { label: "Media", href: "media.html#gallery" },
  { label: "Leadership", href: "leadership.html#leadership" },
  { label: "Join", href: "join.html#join-form" },
  { label: "Contact", href: "contact.html" },
  { label: "Patrons", href: "index.html#patrons" },
];

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLinks(links) {
  const allowed = new Map(SITE_LINKS.map(function (link) {
    return [link.href, link];
  }));

  return (Array.isArray(links) ? links : [])
    .map(function (link) {
      if (!link || typeof link !== "object") {
        return null;
      }

      const label = normalizeText(link.label);
      const href = normalizeText(link.href);
      if (!label || !href || !allowed.has(href)) {
        return null;
      }

      return {
        label,
        href,
      };
    })
    .filter(Boolean);
}

function buildSiteContext(content) {
  const normalizedContent = content && typeof content === "object" ? content : {};
  const events = Array.isArray(normalizedContent.events) ? normalizedContent.events : [];
  const media = normalizedContent.media && typeof normalizedContent.media === "object" ? normalizedContent.media : {};
  const images = Array.isArray(media.images) ? media.images : [];

  return {
    siteName: "BLAST",
    tone: "Warm, welcoming, loving, and concise.",
    audience: "Visitors who want to learn about BLAST, join, or find the right page.",
    pages: SITE_LINKS,
    contact: {
      email: "blastteam254@gmail.com",
      joinPage: "join.html#join-form",
      submissions: "submissions are available to the admin on the Render backend",
    },
    patrons: "Our patrons guide BLAST with prayer, wisdom, and loving support.",
    currentEvents: events.slice(0, 5).map(function (event) {
      return {
        title: normalizeText(event.title),
        time: normalizeText(event.time),
        location: normalizeText(event.location),
      };
    }),
    currentMediaHighlights: {
      intro: normalizeText(media.intro),
      captions: images.slice(0, 6).map(function (item) {
        return normalizeText(item.caption || item.alt || item.src);
      }),
    },
    leadershipNames: [
      "Wesley",
      "Kelvin Ndung'u",
      "Ian",
      "Nelson Kirwa",
      "Joshua",
      "Mathew",
      "Hope",
      "Audia",
      "Caroline",
      "Shillah",
      "Cynthia",
      "Anado",
      "Elisha",
      "Justin",
    ],
  };
}

function createFallbackReply(query) {
  const text = String(query || "").toLowerCase();
  const has = function (terms) {
    return terms.some(function (term) {
      return text.includes(term);
    });
  };

  if (has(["patron", "patrons"])) {
    return {
      text:
        "Our patrons guide BLAST with prayer, wisdom, and loving support. They are a blessing to the journey, and you can meet them on the homepage after the testimonies section.",
      links: [{ label: "Go to Homepage", href: "index.html#patrons" }],
    };
  }

  if (has(["about", "story", "mission", "vision", "values", "who are you", "what is blast"])) {
    return {
      text:
        "BLAST is a youth-centered Christian community built on faith, mentorship, fellowship, and purposeful living. The About page shares our story, mission, and values in more detail.",
      links: [{ label: "Open About", href: "about.html" }],
    };
  }

  if (has(["program", "programs", "event", "events", "fellowship", "prayer", "bible", "study", "mentorship"])) {
    return {
      text:
        "Our Programs & Events page covers Bible study, fellowship, prayer gatherings, and the rhythms that help BLAST grow together.",
      links: [{ label: "Open Programs & Events", href: "programs-events.html#programs" }],
    };
  }

  if (has(["media", "photo", "photos", "picture", "pictures", "video", "gallery"])) {
    return {
      text:
        "The Media page shows BLAST moments in pictures and video, including outreach, prayer, school visits, kids camp, and worship highlights.",
      links: [{ label: "Open Media", href: "media.html#gallery" }],
    };
  }

  if (
    has([
      "leader",
      "leaders",
      "leadership",
      "founder",
      "founders",
      "team",
      "wesley",
      "kelvin",
      "ian",
      "nelson",
      "joshua",
      "mathew",
      "hope",
      "audia",
      "caroline",
      "shillah",
      "cynthia",
      "anado",
      "elisha",
      "justin",
    ])
  ) {
    return {
      text:
        "The Leadership page introduces our founders, leaders, and members who carry BLAST forward with faith, service, and courage.",
      links: [{ label: "Meet the Team", href: "leadership.html#leadership" }],
    };
  }

  if (has(["join", "join blast", "become a member", "sign up"])) {
    return {
      text:
        "We'd love to have you with us. The Join page has the form you can use to get connected with BLAST.",
      links: [{ label: "Open Join", href: "join.html#join-form" }],
    };
  }

  if (has(["contact", "email", "phone", "reach us", "talk to", "message"])) {
    return {
      text:
        "You can reach BLAST through the Contact page for email details and the best ways to get in touch.",
      links: [{ label: "Open Contact", href: "contact.html" }],
    };
  }

  return {
    text:
      "I can help with About, Programs & Events, Media, Leadership, Join, Contact, or Patrons. Try one of the quick prompts below, and I'll point you in the right direction.",
    links: [],
  };
}

function buildPrompt(query, content, page) {
  const context = buildSiteContext(content);
  return [
    "You are BLAST Bot, a warm and helpful AI assistant for the BLAST youth community website.",
    "Speak in a loving, welcoming, and concise tone.",
    "Use only the site context provided below. Do not invent facts.",
    `Current page: ${normalizeText(page) || "unknown"}`,
    "If the visitor asks about BLAST, answer naturally and point them to the right page when useful.",
    "If the question is outside the website content, gently say you only know BLAST website details and suggest the Contact page.",
    "Return JSON only with this exact shape: {\"text\":\"...\",\"links\":[{\"label\":\"...\",\"href\":\"...\"}]}",
    "",
    "Site context:",
    JSON.stringify(context, null, 2),
    "",
    `Visitor question: ${query}`,
  ].join("\n");
}

function parseAiReply(rawText, fallback) {
  const fallbackReply = fallback || createFallbackReply("");
  const raw = normalizeText(rawText);

  if (!raw) {
    return fallbackReply;
  }

  try {
    const parsed = JSON.parse(raw);
    const text = normalizeText(parsed.text) || fallbackReply.text;
    const links = normalizeLinks(parsed.links);

    return {
      text,
      links: links.length ? links : fallbackReply.links,
    };
  } catch (error) {
    return {
      text: raw,
      links: fallbackReply.links,
    };
  }
}

function getOpenAiConfig() {
  const apiKey = normalizeText(process.env.OPENAI_API_KEY);
  const model = normalizeText(process.env.BLAST_AI_MODEL) || DEFAULT_MODEL;

  return {
    apiKey,
    model,
  };
}

async function generateBlastBotReply(query, content, page) {
  const fallback = createFallbackReply(query);
  const { apiKey, model } = getOpenAiConfig();

  if (!apiKey) {
    return {
      ...fallback,
      source: "fallback",
      model: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(function () {
    controller.abort();
  }, Number.isFinite(REQUEST_TIMEOUT_MS) && REQUEST_TIMEOUT_MS > 0 ? REQUEST_TIMEOUT_MS : 15000);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: buildPrompt(query, content, page),
        max_output_tokens: 350,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      const message =
        (payload && (payload.error?.message || payload.message)) ||
        `${response.status} ${response.statusText}`.trim();
      throw new Error(message || "OpenAI request failed.");
    }

    const reply = parseAiReply(payload && payload.output_text, fallback);

    return {
      ...reply,
      source: "ai",
      model,
    };
  } catch (error) {
    console.warn("BLAST Bot AI request failed, using fallback reply.", error);
    return {
      ...fallback,
      source: "fallback",
      model,
      error: error && error.message ? error.message : "Unknown AI error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  createFallbackReply,
  generateBlastBotReply,
  normalizeLinks,
};
