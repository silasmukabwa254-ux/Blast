const button = document.getElementById("welcomeBtn");
const message = document.getElementById("message");
const nameInput = document.getElementById("nameInput");
const nameError = document.getElementById("nameError");
let savedName = "";
try {
  savedName = localStorage.getItem("blastName") || "";
} catch (error) {
  savedName = "";
}
const messageMeta = document.getElementById("messageMeta");
const nameCount = document.getElementById("nameCount");
const resetBtn = document.getElementById("resetBtn");
const welcomeModal = document.getElementById("welcomeModal");
const closeWelcomeModal = document.getElementById("closeWelcomeModal");
const dismissWelcomeModal = document.getElementById("dismissWelcomeModal");
const exploreBlastLink = document.getElementById("exploreBlastLink");
const welcomeModalEyebrow = document.getElementById("welcomeModalEyebrow");
const welcomeModalTitle = document.getElementById("welcomeModalTitle");
const welcomeModalText = document.getElementById("welcomeModalText");
const welcomeModalDialog = document.querySelector(".welcome-modal__dialog");

let isVisible = false;
let modalTypingTimeout;
let modalTypingDelayTimeout;
let lastFocusedElement;

if (
  welcomeModal &&
  closeWelcomeModal &&
  dismissWelcomeModal &&
  exploreBlastLink &&
  welcomeModalEyebrow &&
  welcomeModalTitle &&
  welcomeModalText &&
  welcomeModalDialog
) {
  const modalEyebrowText = welcomeModalEyebrow.textContent;
  const modalTitleText = welcomeModalTitle.textContent;
  const modalBodyText = welcomeModalText.textContent;

  function typeModalText(element, text, speed, callback) {
    let index = 0;
    element.textContent = "";

    function typeNextCharacter() {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index += 1;
        modalTypingTimeout = setTimeout(typeNextCharacter, speed);
        return;
      }

      if (callback) {
        callback();
      }
    }

    typeNextCharacter();
  }

  function openWelcomeModal() {
    clearTimeout(modalTypingTimeout);
    clearTimeout(modalTypingDelayTimeout);
    lastFocusedElement = document.activeElement;
    welcomeModal.classList.add("is-visible");
    welcomeModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    welcomeModalEyebrow.textContent = modalEyebrowText;
    closeWelcomeModal.focus();
    typeModalText(welcomeModalTitle, modalTitleText, 65, function () {
      modalTypingDelayTimeout = setTimeout(function () {
        typeModalText(welcomeModalText, modalBodyText, 30);
      }, 180);
    });
  }

  function closeModal() {
    clearTimeout(modalTypingTimeout);
    clearTimeout(modalTypingDelayTimeout);
    welcomeModal.classList.remove("is-visible");
    welcomeModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (element) {
      return element.offsetParent !== null;
    });
  }

  window.addEventListener("load", function () {
    setTimeout(openWelcomeModal, 250);
  });

  closeWelcomeModal.addEventListener("click", closeModal);
  dismissWelcomeModal.addEventListener("click", closeModal);
  exploreBlastLink.addEventListener("click", closeModal);
  welcomeModal.addEventListener("click", function (event) {
    if (event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (!welcomeModal.classList.contains("is-visible")) return;

    if (event.key === "Escape") {
      closeModal();
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = getFocusableElements(welcomeModalDialog);
    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });
}

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z\s'-]/g, "").replace(/\s{2,}/g, " ");
}

function getPartOfDay(hour) {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

if (button && message && nameInput && nameError && messageMeta && nameCount && resetBtn) {
  function updateButtonState() {
    const currentName = sanitizeName(nameInput.value).trim();
    nameCount.textContent = `${currentName.length}/30`;
    button.disabled = !isVisible && currentName.length === 0;
  }

  if (savedName) {
    nameInput.value = sanitizeName(savedName);
  }

  button.textContent = "Show message";
  updateButtonState();

  button.addEventListener("click", function () {
    nameError.textContent = "";
    const name = sanitizeName(nameInput.value).trim();
    const partOfDay = getPartOfDay(new Date().getHours());

    if (!isVisible) {
      if (name === "") {
        nameError.textContent = "Please enter your name first.";
        message.textContent = "";
        message.classList.remove("show");
        messageMeta.textContent = "";
        button.textContent = "Show message";
        isVisible = false;
        updateButtonState();
        nameInput.focus();
        return;
      }

      if (name.length > 30) {
        nameError.textContent = "Name must be 30 characters or less.";
        message.textContent = "";
        message.classList.remove("show");
        messageMeta.textContent = "";
        button.textContent = "Show message";
        isVisible = false;
        updateButtonState();
        nameInput.focus();
        return;
      }

      button.textContent = "Loading...";
      button.disabled = true;

      setTimeout(function () {
        message.textContent = `Good ${partOfDay}, ${name}! Welcome to BLAST! We are thrilled to have you here. Let's embark on this journey of faith and growth together!`;
        message.classList.add("show");
        try {
          localStorage.setItem("blastName", name);
        } catch (error) {
          // ignore storage errors
        }

        const now = new Date();
        messageMeta.textContent = `Last updated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

        button.textContent = "Hide message";
        isVisible = true;
        nameInput.value = "";
        updateButtonState();
      }, 400);
      return;
    }

    message.textContent = "";
    message.classList.remove("show");
    messageMeta.textContent = "";
    button.textContent = "Show message";
    isVisible = false;
    updateButtonState();
    nameInput.focus();
  });

  nameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      button.click();
    }
  });

  resetBtn.addEventListener("click", function () {
    try {
      localStorage.removeItem("blastName");
    } catch (error) {
      // ignore storage errors
    }
    nameError.textContent = "";
    message.textContent = "";
    message.classList.remove("show");
    messageMeta.textContent = "";
    nameInput.value = "";
    button.textContent = "Show message";
    isVisible = false;
    updateButtonState();
    nameInput.focus();
  });

  nameInput.addEventListener("input", function () {
    nameInput.value = sanitizeName(nameInput.value);
    if (nameError.textContent !== "") {
      nameError.textContent = "";
    }
    updateButtonState();
  });
}

const joinForm = document.querySelector(".join-form");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const interest = document.getElementById("interest");
const spamTrap = document.getElementById("website");
const formFeedback = document.getElementById("formFeedback");
const joinFields = [fullName, email, interest];
const formButton = joinForm ? joinForm.querySelector(".form-button") : null;
const isLocalHost =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const JOIN_API_URL =
  window.BLAST_JOIN_API_URL ||
  (isLocalHost
    ? "http://localhost:3000/api/join"
    : "https://blast-backend-4zkv.onrender.com/api/join");
let apiOrigin;
try {
  apiOrigin = new URL(JOIN_API_URL).origin;
} catch (error) {
  apiOrigin = isLocalHost
    ? "http://localhost:3000"
    : "https://blast-backend-4zkv.onrender.com";
}
const CONTENT_API_URL = `${apiOrigin}/api/content`;
let savedJoinName = "";
let savedJoinEmail = "";
let savedJoinInterest = "";
try {
  savedJoinName = localStorage.getItem("joinFullName") || "";
  savedJoinEmail = localStorage.getItem("joinEmail") || "";
  savedJoinInterest = localStorage.getItem("joinInterest") || "";
} catch (error) {
  savedJoinName = "";
  savedJoinEmail = "";
  savedJoinInterest = "";
}
const fullNameError = document.getElementById("fullNameError");
const emailError = document.getElementById("emailError");
const interestError = document.getElementById("interestError");
const fullNameCount = document.getElementById("fullNameCount");
const emailCount = document.getElementById("emailCount");
const interestCount = document.getElementById("interestCount");

if (
  joinForm &&
  fullName &&
  email &&
  interest &&
  spamTrap &&
  formFeedback &&
  formButton &&
  fullNameError &&
  emailError &&
  interestError &&
  fullNameCount &&
  emailCount &&
  interestCount
) {
  const joinFields = [fullName, email, interest];

  function clearJoinErrors() {
    fullNameError.textContent = "";
    emailError.textContent = "";
    interestError.textContent = "";
    clearJoinFieldState();
  }

  if (savedJoinName) fullName.value = savedJoinName;
  if (savedJoinEmail) email.value = savedJoinEmail;
  if (savedJoinInterest) interest.value = savedJoinInterest;

  function clearJoinFieldState() {
    joinFields.forEach(function (field) {
      field.classList.remove("invalid");
      field.setAttribute("aria-invalid", "false");
    });
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function updateJoinCounts() {
    fullNameCount.textContent = `${fullName.value.length}/50`;
    emailCount.textContent = `${email.value.length}/80`;
    interestCount.textContent = `${interest.value.length}/300`;
  }

  updateJoinCounts();

  joinForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearJoinErrors();
    formFeedback.classList.remove("success");

    const trimmedName = fullName.value.trim();
    const trimmedEmail = email.value.trim();
    const trimmedInterest = interest.value.trim();

    if (trimmedName === "") {
      fullName.classList.add("invalid");
      fullName.setAttribute("aria-invalid", "true");
      fullNameError.textContent = "Full name is required.";
    }

    if (trimmedEmail === "") {
      email.classList.add("invalid");
      email.setAttribute("aria-invalid", "true");
      emailError.textContent = "Email is required.";
    }

    if (trimmedInterest === "") {
      interest.classList.add("invalid");
      interest.setAttribute("aria-invalid", "true");
      interestError.textContent = "Please tell us why you want to join.";
    }

    if (trimmedName === "" || trimmedEmail === "" || trimmedInterest === "") {
      if (trimmedName === "") {
        fullName.focus();
      } else if (trimmedEmail === "") {
        email.focus();
      } else {
        interest.focus();
      }
      formFeedback.textContent = "Please fill in all form fields.";
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      email.classList.add("invalid");
      email.setAttribute("aria-invalid", "true");
      emailError.textContent = "Please enter a valid email address.";
      email.focus();
      formFeedback.textContent = "Please enter a valid email address.";
      return;
    }

    formFeedback.textContent = "Submitting...";
    formButton.disabled = true;

    try {
      const response = await fetch(JOIN_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: trimmedName,
          email: trimmedEmail,
          interest: trimmedInterest,
          website: spamTrap ? spamTrap.value : "",
        }),
      });

      const result = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        if (result.errors) {
          if (result.errors.fullName) {
            fullName.classList.add("invalid");
            fullName.setAttribute("aria-invalid", "true");
            fullNameError.textContent = result.errors.fullName;
          }

          if (result.errors.email) {
            email.classList.add("invalid");
            email.setAttribute("aria-invalid", "true");
            emailError.textContent = result.errors.email;
          }

          if (result.errors.interest) {
            interest.classList.add("invalid");
            interest.setAttribute("aria-invalid", "true");
            interestError.textContent = result.errors.interest;
          }
        }

        formFeedback.textContent = result.message || "Please fix the highlighted fields.";
        if (result.errors && result.errors.fullName) {
          fullName.focus();
        } else if (result.errors && result.errors.email) {
          email.focus();
        } else if (result.errors && result.errors.interest) {
          interest.focus();
        }
        return;
      }

      formFeedback.classList.add("success");
      formFeedback.textContent = result.message || "Your message has been submitted successfully.";
      joinForm.reset();
      updateJoinCounts();
      try {
        localStorage.removeItem("joinFullName");
        localStorage.removeItem("joinEmail");
        localStorage.removeItem("joinInterest");
      } catch (error) {
        // ignore storage errors
      }
      fullName.focus();
      setTimeout(function () {
        formFeedback.textContent = "";
        formFeedback.classList.remove("success");
      }, 2500);
    } catch (error) {
      formFeedback.textContent = "Could not reach the backend. Please try again.";
    } finally {
      formButton.disabled = false;
    }
  });

  joinFields.forEach(function (field) {
    field.addEventListener("input", function () {
      try {
        localStorage.setItem("joinFullName", fullName.value);
        localStorage.setItem("joinEmail", email.value);
        localStorage.setItem("joinInterest", interest.value);
      } catch (error) {
        // ignore storage errors
      }
      field.classList.remove("invalid");
      field.setAttribute("aria-invalid", "false");
      updateJoinCounts();
      if (field === fullName) fullNameError.textContent = "";
      if (field === email) emailError.textContent = "";
      if (field === interest) interestError.textContent = "";
      if (formFeedback.textContent !== "") {
        formFeedback.textContent = "";
        formFeedback.classList.remove("success");
      }
    });
  });
}

const backToTopBtn = document.getElementById("backToTopBtn");

if (backToTopBtn) {
  function updateBackToTopButton() {
    backToTopBtn.classList.toggle("is-visible", window.scrollY > 600);
  }

  updateBackToTopButton();
  window.addEventListener("scroll", updateBackToTopButton, { passive: true });
  backToTopBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

const eventList = document.getElementById("eventList");
const mediaGrid = document.getElementById("mediaGrid");
const mediaIntro = document.getElementById("mediaIntro");
const featuredVideoTitle = document.getElementById("featuredVideoTitle");
const featuredVideoCaption = document.getElementById("featuredVideoCaption");
const featuredVideoElement = document.getElementById("featuredVideoElement");
const featuredVideoSource = document.getElementById("featuredVideoSource");
const isDedicatedMediaPage = Boolean(document.querySelector("main.media-page"));

function buildEventCard(event) {
  const card = document.createElement("div");
  card.className = "event-card";

  const heading = document.createElement("h3");
  heading.textContent = event.title || "Untitled event";
  card.appendChild(heading);

  if (event.time) {
    const time = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = "Time:";
    time.appendChild(strong);
    time.appendChild(document.createTextNode(` ${event.time}`));
    card.appendChild(time);
  }

  if (event.location) {
    const location = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = "Location:";
    location.appendChild(strong);
    location.appendChild(document.createTextNode(` ${event.location}`));
    card.appendChild(location);
  }

  return card;
}

function buildMediaCard(item) {
  const figure = document.createElement("figure");
  figure.className = "media-card";

  const image = document.createElement("img");
  image.src = item.src || "blast.webp";
  image.alt = item.alt || item.caption || "BLAST media";
  image.width = 640;
  image.height = 480;
  image.loading = "lazy";
  image.decoding = "async";
  figure.appendChild(image);

  const caption = document.createElement("figcaption");
  caption.textContent = item.caption || "BLAST";
  figure.appendChild(caption);

  return figure;
}

function renderHomepageContent(content) {
  if (!content) return;

  const events = Array.isArray(content.events) ? content.events : [];
  const media = content.media || {};
  const images = Array.isArray(media.images) ? media.images : [];
  const video = media.video || {};

  if (eventList) {
    eventList.innerHTML = "";
    if (events.length) {
      events.forEach(function (event) {
        eventList.appendChild(buildEventCard(event));
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "event-card";
      empty.innerHTML = "<p>No upcoming events yet.</p>";
      eventList.appendChild(empty);
    }
  }

  if (mediaIntro && media.intro) {
    mediaIntro.textContent = media.intro;
  }

  if (mediaGrid) {
    mediaGrid.innerHTML = "";
    if (images.length) {
      images.forEach(function (item) {
        mediaGrid.appendChild(buildMediaCard(item));
      });
    } else {
      const empty = document.createElement("figure");
      empty.className = "media-card";
      empty.innerHTML = "<figcaption>No media highlights yet.</figcaption>";
      mediaGrid.appendChild(empty);
    }
  }

  if (featuredVideoTitle && video.title) {
    featuredVideoTitle.textContent = video.title;
  }

  if (featuredVideoCaption && video.caption) {
    featuredVideoCaption.textContent = video.caption;
  }

  if (featuredVideoElement && featuredVideoSource && video.src) {
    featuredVideoSource.src = encodeURI(video.src);
    if (video.poster) {
      featuredVideoElement.setAttribute("poster", encodeURI(video.poster));
    }
    featuredVideoElement.load();
  }
}

async function loadHomepageContent() {
  if (isDedicatedMediaPage) {
    return;
  }

  try {
    const response = await fetch(CONTENT_API_URL);
    if (!response.ok) {
      return;
    }

    const payload = await response.json().catch(function () {
      return null;
    });

    if (payload && payload.content) {
      renderHomepageContent(payload.content);
    }
  } catch (error) {
    // Keep the static homepage fallback when the content API is unavailable.
  }
}

loadHomepageContent();

const BLAST_BOT_LINKS = [
  { label: "About", href: "about.html" },
  { label: "Programs", href: "programs-events.html#programs" },
  { label: "Media", href: "media.html#gallery" },
  { label: "Leadership", href: "leadership.html#leadership" },
  { label: "Join", href: "join.html#join-form" },
  { label: "Contact", href: "contact.html" },
];

function createBlastBotResponse(query) {
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
      links: [{ label: "Go to Homepage", href: "index.html#main-content" }],
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
        "Our Programs & Events page covers Bible study, fellowship, prayer gatherings, and the rhythms that keep BLAST growing together.",
      links: [{ label: "Open Programs & Events", href: "programs-events.html#programs" }],
    };
  }

  if (has(["media", "photo", "photos", "picture", "pictures", "video", "gallery"])) {
    return {
      text:
        "The Media page shows BLAST moments in pictures and video, with outreach, prayer, school visits, kids camp, and worship highlights.",
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

async function getBlastBotResponse(query) {
  const fallback = createBlastBotResponse(query);
  if (typeof window !== "undefined" && typeof window.BLAST_BOT_PROVIDER === "function") {
    try {
      const result = await window.BLAST_BOT_PROVIDER(query, {
        fallback: fallback,
        links: BLAST_BOT_LINKS,
      });

      if (typeof result === "string") {
        return {
          text: result,
          links: fallback.links,
        };
      }

      if (result && typeof result === "object") {
        return {
          text:
            typeof result.text === "string" && result.text.trim() ? result.text.trim() : fallback.text,
          links: Array.isArray(result.links) ? result.links : fallback.links,
        };
      }
    } catch (error) {
      console.warn("BLAST Bot provider failed, using fallback reply.", error);
    }
  }

  return fallback;
}

function initBlastBot() {
  if (document.getElementById("blastBotWidget")) {
    return;
  }

  const widget = document.createElement("section");
  widget.className = "blast-bot";
  widget.id = "blastBotWidget";

  const panel = document.createElement("div");
  panel.className = "blast-bot__panel";
  panel.hidden = true;

  const header = document.createElement("div");
  header.className = "blast-bot__header";

  const headingWrap = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "blast-bot__eyebrow";
  eyebrow.textContent = "BLAST helper";
  const title = document.createElement("h2");
  title.textContent = "Ask the BLAST Bot";
  const subtitle = document.createElement("p");
  subtitle.className = "blast-bot__subtitle";
  subtitle.textContent = "A friendly guide to pages, programs, and ways to get involved.";
  headingWrap.appendChild(eyebrow);
  headingWrap.appendChild(title);
  headingWrap.appendChild(subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "blast-bot__close";
  closeButton.setAttribute("aria-label", "Close BLAST Bot");
  closeButton.textContent = "Ã—";

  header.appendChild(headingWrap);
  header.appendChild(closeButton);

  const messages = document.createElement("div");
  messages.className = "blast-bot__messages";
  messages.setAttribute("role", "log");
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions text");

  const promptRow = document.createElement("div");
  promptRow.className = "blast-bot__prompts";
  const promptItems = [
    "About BLAST",
    "Programs & Events",
    "Media",
    "Leadership",
    "Patrons",
    "Join BLAST",
    "Contact",
  ];

  function addMessage(role, text, links) {
    const bubble = document.createElement("div");
    bubble.className = `blast-bot__message blast-bot__message--${role}`;

    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    bubble.appendChild(paragraph);

    if (Array.isArray(links) && links.length) {
      const linkRow = document.createElement("div");
      linkRow.className = "blast-bot__message-links";

      links.forEach(function (link) {
        const anchor = document.createElement("a");
        anchor.className = "blast-bot__message-link";
        anchor.href = link.href;
        anchor.textContent = link.label;
        linkRow.appendChild(anchor);
      });

      bubble.appendChild(linkRow);
    }

    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function addTypingIndicator() {
    const typing = document.createElement("div");
    typing.className = "blast-bot__message blast-bot__message--assistant blast-bot__message--typing";
    typing.setAttribute("aria-live", "polite");

    const dotWrap = document.createElement("span");
    dotWrap.className = "blast-bot__typing";
    dotWrap.textContent = "BLAST Bot is typing";
    typing.appendChild(dotWrap);

    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    return typing;
  }

  async function showReply(query) {
    const cleaned = String(query || "").trim();
    if (!cleaned) return;

    addMessage("user", cleaned);
    input.value = "";

    const typing = addTypingIndicator();
    window.setTimeout(async function () {
      typing.remove();
      const response = await getBlastBotResponse(cleaned);
      addMessage("assistant", response.text, response.links);
    }, 500);
  }

  promptItems.forEach(function (label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "blast-bot__prompt";
    button.textContent = label;
    button.addEventListener("click", function () {
      showReply(label);
      openBot();
    });
    promptRow.appendChild(button);
  });

  const form = document.createElement("form");
  form.className = "blast-bot__form";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "blast-bot__input";
  input.placeholder = "Ask me about BLAST...";
  input.setAttribute("aria-label", "Ask the BLAST Bot a question");

  const sendButton = document.createElement("button");
  sendButton.type = "submit";
  sendButton.className = "blast-bot__send";
  sendButton.textContent = "Send";

  form.appendChild(input);
  form.appendChild(sendButton);

  const quickLinks = document.createElement("div");
  quickLinks.className = "blast-bot__quick-links";

  BLAST_BOT_LINKS.forEach(function (link) {
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.textContent = link.label;
    quickLinks.appendChild(anchor);
  });

  function openBot() {
    panel.hidden = false;
    panel.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = "Close BLAST Bot";
    window.setTimeout(function () {
      input.focus();
    }, 0);
  }

  function closeBot() {
    panel.hidden = true;
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Open BLAST Bot";
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "blast-bot__toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "blastBotPanel");
  toggle.textContent = "Open BLAST Bot";
  toggle.addEventListener("click", function () {
    if (panel.hidden) {
      openBot();
    } else {
      closeBot();
    }
  });

  closeButton.addEventListener("click", closeBot);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showReply(input.value);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) {
      closeBot();
    }
  });

  addMessage(
    "assistant",
    "Hi, I'm BLAST Bot. I can help you find the right page, learn about BLAST, or get connected. Try one of the quick prompts below."
  );

  panel.id = "blastBotPanel";
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(promptRow);
  panel.appendChild(form);
  panel.appendChild(quickLinks);

  widget.appendChild(panel);
  widget.appendChild(toggle);
  document.body.appendChild(widget);
}

initBlastBot();
