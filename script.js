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

const communityFeedVerseReference = document.getElementById("verseTitle");
const communityFeedVerseText = document.getElementById("verseText");
const communityFeedVerseNote = document.getElementById("verseNote");
const communityFeedVerseDate = document.getElementById("verseDate");
const communityFeedPrayerReference = document.getElementById("prayerTitle");
const communityFeedPrayerText = document.getElementById("prayerText");
const communityFeedPrayerNote = document.getElementById("prayerNote");
const communityFeedPrayerDate = document.getElementById("prayerDate");
const communityFeedList = document.getElementById("communityFeedList");
const communityTestimonyForm = document.getElementById("communityTestimonyForm");
const communityTestimonyName = document.getElementById("communityTestimonyName");
const communityTestimonyEmail = document.getElementById("communityTestimonyEmail");
const communityTestimonyMessage = document.getElementById("communityTestimonyMessage");
const communityTestimonyStatus = document.getElementById("communityTestimonyStatus");

function getDailyVerse(date) {
  const verses = [
    {
      reference: "John 15:5",
      text:
        "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit.",
      note: "Stay close to Christ and let your life bear good fruit today.",
    },
    {
      reference: "Isaiah 41:10",
      text:
        "So do not fear, for I am with you; do not be dismayed, for I am your God.",
      note: "God’s presence is enough for every step ahead.",
    },
    {
      reference: "Philippians 4:13",
      text: "I can do all this through him who gives me strength.",
      note: "The strength you need is already with you.",
    },
    {
      reference: "Psalm 46:1",
      text: "God is our refuge and strength, an ever-present help in trouble.",
      note: "When life feels heavy, God stays close.",
    },
    {
      reference: "Romans 15:13",
      text:
        "May the God of hope fill you with all joy and peace as you trust in him.",
      note: "Hope grows where trust begins.",
    },
    {
      reference: "Matthew 11:28",
      text:
        "Come to me, all you who are weary and burdened, and I will give you rest.",
      note: "You are invited to rest in Him today.",
    },
    {
      reference: "2 Timothy 1:7",
      text:
        "For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.",
      note: "Walk with courage and steady love.",
    },
    {
      reference: "Joshua 1:9",
      text:
        "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
      note: "You are not walking alone.",
    },
  ];

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const index = Math.abs(Math.floor(new Date(year, month, day).getTime() / 86400000)) % verses.length;

  return verses[index];
}

function initCommunityFeedVerse() {
  if (
    !communityFeedVerseReference ||
    !communityFeedVerseText ||
    !communityFeedVerseNote ||
    !communityFeedVerseDate
  ) {
    return;
  }

  const today = new Date();
  const verse = getDailyVerse(today);

  communityFeedVerseReference.textContent = verse.reference;
  communityFeedVerseText.textContent = verse.text;
  communityFeedVerseNote.textContent = verse.note;
  communityFeedVerseDate.textContent = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

initCommunityFeedVerse();

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
const BLAST_BOT_API_URL = `${apiOrigin}/api/bot/chat`;

function getDailyPrayer(date) {
  const prayers = [
    {
      reference: "Prayer for Peace",
      text: "Lord, calm every troubled heart, steady every worried mind, and help us rest in your love today.",
      note: "A prayer to carry into the day with hope and trust.",
    },
    {
      reference: "Prayer for Courage",
      text: "God, give us courage to keep going, faith to keep trusting, and love to keep serving well.",
      note: "Strength for the steps we still need to take.",
    },
    {
      reference: "Prayer for Families",
      text: "Father, cover our families with your care, protect our homes, and let kindness grow in every heart.",
      note: "A prayer for the people closest to us.",
    },
    {
      reference: "Prayer for Exams",
      text: "Lord, bless every learner with focus, calm, and wisdom. Help them remember what they have prepared.",
      note: "A prayer for study, preparation, and peace.",
    },
    {
      reference: "Prayer for Serving",
      text: "Jesus, make our hands gentle, our words gracious, and our hearts willing to serve where we are needed.",
      note: "A prayer for a life that blesses others.",
    },
    {
      reference: "Prayer for Hope",
      text: "God of hope, lift every discouraged spirit, renew joy, and remind us that your mercy is new every morning.",
      note: "Hope is still growing here.",
    },
  ];

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const index = Math.abs(Math.floor(new Date(year, month, day).getTime() / 86400000)) % prayers.length;

  return prayers[index];
}

function formatCommunityDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCommunityDateTime(value) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initCommunityFeedPrayer() {
  if (
    !communityFeedPrayerReference ||
    !communityFeedPrayerText ||
    !communityFeedPrayerNote ||
    !communityFeedPrayerDate
  ) {
    return;
  }

  const today = new Date();
  const prayer = getDailyPrayer(today);

  communityFeedPrayerReference.textContent = prayer.reference;
  communityFeedPrayerText.textContent = prayer.text;
  communityFeedPrayerNote.textContent = prayer.note;
  communityFeedPrayerDate.textContent = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function setCommunityFeedStatus(message, isError) {
  if (!communityTestimonyStatus) return;
  communityTestimonyStatus.textContent = message;
  communityTestimonyStatus.style.color = isError ? "#8b1e3f" : "";
}

function buildCommunityComment(comment) {
  const item = document.createElement("div");
  item.className = "feed-post__comment";

  const name = document.createElement("strong");
  name.textContent = comment.fullName || "BLAST Friend";
  item.appendChild(name);

  const body = document.createElement("p");
  body.textContent = comment.message || "";
  item.appendChild(body);

  const meta = document.createElement("div");
  meta.className = "feed-post__comment-meta";
  meta.textContent = formatCommunityDateTime(comment.submittedAt);
  item.appendChild(meta);

  return item;
}

function buildCommunityPostCard(post) {
  const article = document.createElement("article");
  article.className = "feed-post";
  if ((post.comments || []).length > 0 && Number(post.likes || 0) >= 12) {
    article.classList.add("feed-post--featured");
  }

  const meta = document.createElement("div");
  meta.className = "feed-post__meta";

  const author = document.createElement("strong");
  author.textContent = post.fullName || "Anonymous";
  meta.appendChild(author);

  const date = document.createElement("span");
  date.textContent = formatCommunityDate(post.submittedAt);
  meta.appendChild(date);
  article.appendChild(meta);

  const message = document.createElement("p");
  message.textContent = post.message || "";
  article.appendChild(message);

  const actions = document.createElement("div");
  actions.className = "feed-post__actions";

  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.className = "feed-post__button";
  likeButton.textContent = `Like (${Number(post.likes || 0)})`;

  const commentButton = document.createElement("button");
  commentButton.type = "button";
  commentButton.className = "feed-post__button feed-post__comment-toggle";
  commentButton.textContent = `Comment (${(post.comments || []).length})`;

  actions.appendChild(likeButton);
  actions.appendChild(commentButton);
  article.appendChild(actions);

  const commentPanel = document.createElement("div");
  commentPanel.className = "feed-post__comment-panel";
  commentPanel.hidden = true;

  const commentsHeading = document.createElement("p");
  commentsHeading.className = "feed-post__comments-heading";
  commentsHeading.textContent = "Comments";
  commentPanel.appendChild(commentsHeading);

  const commentsList = document.createElement("div");
  commentsList.className = "feed-post__comment-list";
  const comments = Array.isArray(post.comments) ? post.comments : [];

  if (comments.length) {
    comments.forEach(function (comment) {
      commentsList.appendChild(buildCommunityComment(comment));
    });
  } else {
    const empty = document.createElement("p");
    empty.className = "feed-post__status";
    empty.textContent = "Be the first to encourage this testimony.";
    commentsList.appendChild(empty);
  }

  commentPanel.appendChild(commentsList);

  const commentForm = document.createElement("form");
  commentForm.className = "feed-post__comment-form";

  const commentNameLabel = document.createElement("label");
  commentNameLabel.className = "field";

  const commentNameSpan = document.createElement("span");
  commentNameSpan.textContent = "Your name";
  commentNameLabel.appendChild(commentNameSpan);

  const commentNameInput = document.createElement("input");
  commentNameInput.type = "text";
  commentNameInput.maxLength = 60;
  commentNameInput.placeholder = "Enter your name";
  commentNameInput.autocomplete = "name";
  commentNameLabel.appendChild(commentNameInput);
  commentForm.appendChild(commentNameLabel);

  const commentMessageLabel = document.createElement("label");
  commentMessageLabel.className = "field";

  const commentMessageSpan = document.createElement("span");
  commentMessageSpan.textContent = "Comment";
  commentMessageLabel.appendChild(commentMessageSpan);

  const commentMessageInput = document.createElement("textarea");
  commentMessageInput.rows = 3;
  commentMessageInput.maxLength = 240;
  commentMessageInput.placeholder = "Share a kind comment or prayer.";
  commentMessageLabel.appendChild(commentMessageInput);
  commentForm.appendChild(commentMessageLabel);

  const commentActions = document.createElement("div");
  commentActions.className = "feed-post__comment-actions";

  const submitCommentButton = document.createElement("button");
  submitCommentButton.type = "submit";
  submitCommentButton.className = "feed-post__button";
  submitCommentButton.textContent = "Post comment";
  commentActions.appendChild(submitCommentButton);

  const commentStatus = document.createElement("p");
  commentStatus.className = "feed-post__status";
  commentStatus.setAttribute("aria-live", "polite");
  commentActions.appendChild(commentStatus);

  commentForm.appendChild(commentActions);
  commentPanel.appendChild(commentForm);
  article.appendChild(commentPanel);

  commentButton.addEventListener("click", function () {
    commentPanel.hidden = !commentPanel.hidden;
    commentButton.classList.toggle("is-active", !commentPanel.hidden);
    if (!commentPanel.hidden) {
      commentNameInput.focus();
    }
  });

  likeButton.addEventListener("click", async function () {
    likeButton.disabled = true;
    commentButton.disabled = true;
    likeButton.textContent = "Liking...";

    try {
      const response = await fetch(`${apiOrigin}/api/community/testimonies/${encodeURIComponent(post.id)}/like`, {
        method: "POST",
      });

      const result = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        window.alert(result.message || "Could not like this testimony.");
        return;
      }

      await loadCommunityFeed();
    } catch (error) {
      window.alert(error.message || "Could not reach the backend. Please try again.");
    } finally {
      likeButton.disabled = false;
      commentButton.disabled = false;
    }
  });

  commentForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    commentStatus.textContent = "";

    const trimmedName = commentNameInput.value.trim();
    const trimmedMessage = commentMessageInput.value.trim();

    if (!trimmedName) {
      commentStatus.textContent = "Please enter your name first.";
      commentStatus.style.color = "#8b1e3f";
      commentNameInput.focus();
      return;
    }

    if (!trimmedMessage) {
      commentStatus.textContent = "Please write a comment.";
      commentStatus.style.color = "#8b1e3f";
      commentMessageInput.focus();
      return;
    }

    submitCommentButton.disabled = true;
    submitCommentButton.textContent = "Posting...";
    commentStatus.textContent = "Posting your comment...";
    commentStatus.style.color = "";

    try {
      const response = await fetch(`${apiOrigin}/api/community/testimonies/${encodeURIComponent(post.id)}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: trimmedName,
          message: trimmedMessage,
        }),
      });

      const result = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        commentStatus.textContent = result.message || "Could not post the comment.";
        commentStatus.style.color = "#8b1e3f";
        return;
      }

      commentMessageInput.value = "";
      commentStatus.textContent = result.message || "Comment added.";
      commentStatus.style.color = "";
      await loadCommunityFeed();
    } catch (error) {
      commentStatus.textContent = error.message || "Could not reach the backend. Please try again.";
      commentStatus.style.color = "#8b1e3f";
    } finally {
      submitCommentButton.disabled = false;
      submitCommentButton.textContent = "Post comment";
    }
  });

  return article;
}

function renderCommunityFeed(feed) {
  if (!communityFeedList) return;

  const testimonies = feed && Array.isArray(feed.testimonies) ? feed.testimonies : [];
  communityFeedList.innerHTML = "";

  if (!testimonies.length) {
    const empty = document.createElement("article");
    empty.className = "feed-post";

    const paragraph = document.createElement("p");
    paragraph.textContent = "The testimony wall is still waiting for the first story. Share one below and help begin the conversation.";
    empty.appendChild(paragraph);

    communityFeedList.appendChild(empty);
    return;
  }

  testimonies.forEach(function (testimony) {
    communityFeedList.appendChild(buildCommunityPostCard(testimony));
  });
}

async function loadCommunityFeed() {
  if (!communityFeedList) {
    return;
  }

  communityFeedList.innerHTML = `
    <article class="feed-post">
      <p>Loading the testimony wall...</p>
    </article>
  `;

  try {
    const response = await fetch(`${apiOrigin}/api/community/feed`, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.message || "Unable to load the community feed.");
    }

    renderCommunityFeed(payload.feed || {});
  } catch (error) {
    communityFeedList.innerHTML = "";

    const article = document.createElement("article");
    article.className = "feed-post";

    const paragraph = document.createElement("p");
    paragraph.textContent = error.message || "Unable to load the community feed.";
    article.appendChild(paragraph);

    communityFeedList.appendChild(article);
  }
}

function initCommunityFeedPage() {
  if (communityFeedPrayerReference || communityFeedPrayerText || communityFeedPrayerNote || communityFeedPrayerDate) {
    initCommunityFeedPrayer();
  }

  if (communityTestimonyForm && communityTestimonyName && communityTestimonyEmail && communityTestimonyMessage && communityTestimonyStatus) {
    setCommunityFeedStatus("Share a testimony or encourage someone else today.", false);

    communityTestimonyForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setCommunityFeedStatus("", false);

      const trimmedName = communityTestimonyName.value.trim();
      const trimmedEmail = communityTestimonyEmail.value.trim();
      const trimmedMessage = communityTestimonyMessage.value.trim();

      if (!trimmedName) {
        setCommunityFeedStatus("Please tell us your name first.", true);
        communityTestimonyName.focus();
        return;
      }

      if (!trimmedMessage) {
        setCommunityFeedStatus("Please share your testimony.", true);
        communityTestimonyMessage.focus();
        return;
      }

      communityTestimonyForm.querySelector(".join-button").disabled = true;
      setCommunityFeedStatus("Sharing your testimony...", false);

      try {
        const response = await fetch(`${apiOrigin}/api/community/testimonies`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: trimmedName,
            email: trimmedEmail,
            message: trimmedMessage,
          }),
        });

        const result = await response.json().catch(function () {
          return {};
        });

        if (!response.ok) {
          if (result.errors) {
            if (result.errors.fullName) {
              communityTestimonyName.classList.add("invalid");
            }
            if (result.errors.email) {
              communityTestimonyEmail.classList.add("invalid");
            }
            if (result.errors.message) {
              communityTestimonyMessage.classList.add("invalid");
            }
          }
          setCommunityFeedStatus(result.message || "Please fix the highlighted fields.", true);
          return;
        }

        communityTestimonyForm.reset();
        setCommunityFeedStatus(result.message || "Your testimony has been shared.", false);
        await loadCommunityFeed();
      } catch (error) {
        setCommunityFeedStatus(error.message || "Could not reach the backend. Please try again.", true);
      } finally {
        const submitButton = communityTestimonyForm.querySelector(".join-button");
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });

    [communityTestimonyName, communityTestimonyEmail, communityTestimonyMessage].forEach(function (field) {
      field.addEventListener("input", function () {
        field.classList.remove("invalid");
        setCommunityFeedStatus("", false);
      });
    });
  }

  if (communityFeedList) {
    loadCommunityFeed();
  }
}

initCommunityFeedPage();

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

const feedbackForm = document.querySelector(".feedback-form");
const feedbackName = document.getElementById("feedbackName");
const feedbackEmail = document.getElementById("feedbackEmail");
const feedbackTopic = document.getElementById("feedbackTopic");
const feedbackMessage = document.getElementById("feedbackMessage");
const feedbackWebsite = document.getElementById("feedbackWebsite");
const feedbackFormStatus = document.getElementById("feedbackFormStatus");
const feedbackNameError = document.getElementById("feedbackNameError");
const feedbackEmailError = document.getElementById("feedbackEmailError");
const feedbackTopicError = document.getElementById("feedbackTopicError");
const feedbackMessageError = document.getElementById("feedbackMessageError");
const feedbackButton = feedbackForm ? feedbackForm.querySelector(".form-button") : null;

if (
  feedbackForm &&
  feedbackName &&
  feedbackEmail &&
  feedbackTopic &&
  feedbackMessage &&
  feedbackWebsite &&
  feedbackFormStatus &&
  feedbackNameError &&
  feedbackEmailError &&
  feedbackTopicError &&
  feedbackMessageError &&
  feedbackButton
) {
  function clearFeedbackErrors() {
    feedbackNameError.textContent = "";
    feedbackEmailError.textContent = "";
    feedbackTopicError.textContent = "";
    feedbackMessageError.textContent = "";

    [feedbackName, feedbackEmail, feedbackTopic, feedbackMessage].forEach(function (field) {
      field.classList.remove("invalid");
      field.setAttribute("aria-invalid", "false");
    });
  }

  function isValidFeedbackEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  feedbackForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearFeedbackErrors();
    feedbackFormStatus.classList.remove("success");

    const trimmedName = feedbackName.value.trim();
    const trimmedEmail = feedbackEmail.value.trim();
    const trimmedTopic = feedbackTopic.value.trim();
    const trimmedMessage = feedbackMessage.value.trim();

    if (trimmedName === "") {
      feedbackName.classList.add("invalid");
      feedbackName.setAttribute("aria-invalid", "true");
      feedbackNameError.textContent = "Full name is required.";
    }

    if (trimmedEmail && !isValidFeedbackEmail(trimmedEmail)) {
      feedbackEmail.classList.add("invalid");
      feedbackEmail.setAttribute("aria-invalid", "true");
      feedbackEmailError.textContent = "Please enter a valid email address.";
    }

    if (trimmedTopic === "") {
      feedbackTopic.classList.add("invalid");
      feedbackTopic.setAttribute("aria-invalid", "true");
      feedbackTopicError.textContent = "Please choose what your feedback is about.";
    }

    if (trimmedMessage === "") {
      feedbackMessage.classList.add("invalid");
      feedbackMessage.setAttribute("aria-invalid", "true");
      feedbackMessageError.textContent = "Please share your feedback.";
    }

    if (
      trimmedName === "" ||
      (trimmedEmail && !isValidFeedbackEmail(trimmedEmail)) ||
      trimmedTopic === "" ||
      trimmedMessage === ""
    ) {
      if (trimmedName === "") {
        feedbackName.focus();
      } else if (trimmedEmail && !isValidFeedbackEmail(trimmedEmail)) {
        feedbackEmail.focus();
      } else if (trimmedTopic === "") {
        feedbackTopic.focus();
      } else {
        feedbackMessage.focus();
      }

      feedbackFormStatus.textContent = "Please fill in the highlighted fields.";
      return;
    }

    feedbackFormStatus.textContent = "Submitting...";
    feedbackButton.disabled = true;

    try {
      const response = await fetch(`${apiOrigin}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: trimmedName,
          email: trimmedEmail,
          topic: trimmedTopic,
          message: trimmedMessage,
          website: feedbackWebsite ? feedbackWebsite.value : "",
        }),
      });

      const result = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        if (result.errors) {
          if (result.errors.fullName) {
            feedbackName.classList.add("invalid");
            feedbackName.setAttribute("aria-invalid", "true");
            feedbackNameError.textContent = result.errors.fullName;
          }

          if (result.errors.email) {
            feedbackEmail.classList.add("invalid");
            feedbackEmail.setAttribute("aria-invalid", "true");
            feedbackEmailError.textContent = result.errors.email;
          }

          if (result.errors.topic) {
            feedbackTopic.classList.add("invalid");
            feedbackTopic.setAttribute("aria-invalid", "true");
            feedbackTopicError.textContent = result.errors.topic;
          }

          if (result.errors.message) {
            feedbackMessage.classList.add("invalid");
            feedbackMessage.setAttribute("aria-invalid", "true");
            feedbackMessageError.textContent = result.errors.message;
          }
        }

        feedbackFormStatus.textContent = result.message || "Please fix the highlighted fields.";
        if (result.errors && result.errors.fullName) {
          feedbackName.focus();
        } else if (result.errors && result.errors.email) {
          feedbackEmail.focus();
        } else if (result.errors && result.errors.topic) {
          feedbackTopic.focus();
        } else if (result.errors && result.errors.message) {
          feedbackMessage.focus();
        }
        return;
      }

      feedbackFormStatus.classList.add("success");
      feedbackFormStatus.textContent = result.message || "Thanks for sharing your feedback.";
      feedbackForm.reset();
      clearFeedbackErrors();
      feedbackName.focus();
      setTimeout(function () {
        feedbackFormStatus.textContent = "";
        feedbackFormStatus.classList.remove("success");
      }, 2500);
    } catch (error) {
      feedbackFormStatus.textContent = "Could not reach the backend. Please try again.";
    } finally {
      feedbackButton.disabled = false;
    }
  });

  [feedbackName, feedbackEmail, feedbackTopic, feedbackMessage].forEach(function (field) {
    field.addEventListener("input", function () {
      field.classList.remove("invalid");
      field.setAttribute("aria-invalid", "false");
      feedbackFormStatus.textContent = "";
      feedbackFormStatus.classList.remove("success");
      if (field === feedbackName) {
        feedbackNameError.textContent = "";
      } else if (field === feedbackEmail) {
        feedbackEmailError.textContent = "";
      } else if (field === feedbackTopic) {
        feedbackTopicError.textContent = "";
      } else if (field === feedbackMessage) {
        feedbackMessageError.textContent = "";
      }
    });
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
      links: [{ label: "Go to Patrons", href: "index.html#patrons" }],
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

  if (has(["community feed", "feed", "verse of the day", "posts", "prayer request"])) {
    return {
      text:
        "The Community Feed page is where you can read a fresh verse, see the prayer of the day, share testimonies, and stay connected with what BLAST is sharing today.",
      links: [{ label: "Open Community Feed", href: "community-feed.html#feed" }],
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

  if (has(["feedback", "review", "suggestion", "suggestions", "message about services", "share thoughts"])) {
    return {
      text:
        "The Feedback page lets you share encouragement, ideas, and suggestions about BLAST services so the team can keep improving.",
      links: [{ label: "Open Feedback", href: "feedback.html#feedback-form" }],
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
      "I can help with About, Programs & Events, Media, Community Feed, Leadership, Join, Feedback, Contact, or Patrons. Ask me what you need, and I’ll guide you gently to the right place.",
    links: [],
  };
}

async function getBlastBotResponse(query) {
  const fallback = createBlastBotResponse(query);

  try {
    const response = await fetch(BLAST_BOT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: query,
        page: window.location.pathname,
      }),
    });

    const payload = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      return fallback;
    }

    if (!payload || typeof payload.text !== "string") {
      return fallback;
    }

    const text = payload.text.trim();
    if (!text) {
      return fallback;
    }

    return {
      text: text,
      links: Array.isArray(payload.links) ? payload.links : fallback.links,
    };
  } catch (error) {
    return fallback;
  }
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
  eyebrow.textContent = "AI assistant";
  const title = document.createElement("h2");
  title.textContent = "Ask the BLAST Companion";
  const subtitle = document.createElement("p");
  subtitle.className = "blast-bot__subtitle";
  subtitle.textContent = "A warm guide to pages, prayers, testimonies, and ways to get involved.";
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
    "Community Feed",
    "Leadership",
    "Feedback",
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
  input.setAttribute("aria-label", "Ask the BLAST Assistant a question");

  const sendButton = document.createElement("button");
  sendButton.type = "submit";
  sendButton.className = "blast-bot__send";
  sendButton.textContent = "Send";

  form.appendChild(input);
  form.appendChild(sendButton);

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
    "Hello, I’m here to help you find your place in BLAST. Ask me about a page, a program, a testimony, or where to begin, and I’ll guide you kindly.",
    [
      { label: "Open Community Feed", href: "community-feed.html#feed" },
      { label: "Join BLAST", href: "join.html#join-form" },
    ]
  );

  panel.id = "blastBotPanel";
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(promptRow);
  panel.appendChild(form);

  widget.appendChild(panel);
  widget.appendChild(toggle);
  document.body.appendChild(widget);
}

initBlastBot();
