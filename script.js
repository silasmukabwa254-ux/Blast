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

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z\s'-]/g, "").replace(/\s{2,}/g, " ");
}

function getPartOfDay(hour) {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

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

const joinForm = document.querySelector(".join-form");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const interest = document.getElementById("interest");
const formFeedback = document.getElementById("formFeedback");
const joinFields = [fullName, email, interest];
const formButton = joinForm.querySelector(".form-button");
const isLocalHost =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const JOIN_API_URL =
  window.BLAST_JOIN_API_URL ||
  (isLocalHost
    ? "http://localhost:3000/api/join"
    : "https://blast-backend-4zkv.onrender.com/api/join");
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
