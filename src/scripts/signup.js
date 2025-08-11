// src/scripts/signup.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signup-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm-password");

  const togglePassword = document.getElementById("toggle-password");
  const toggleConfirm = document.getElementById("toggle-confirm");

  const usernameError = document.getElementById("username-error");
  const passwordError = document.getElementById("password-error");
  const confirmError = document.getElementById("confirm-error");

  // Load audio files from assets folder
  const successSound = new Audio("../assets/success.mp3");
  const errorSound = new Audio("../assets/error.mp3");
  const bgm = new Audio("../assets/bgm.mp3");

  // BGM settings
  bgm.loop = true;
  bgm.volume = 0; // start silent

  // Fade in function for BGM
  function fadeInBGM() {
    if (bgm.paused) {
      bgm.play().catch(err => console.warn("BGM play blocked:", err));
    }
    let vol = bgm.volume;
    const fade = setInterval(() => {
      vol += 0.05;
      if (vol >= 1) { vol = 1; clearInterval(fade); }
      bgm.volume = vol;
    }, 100);
  }

  // Start background music with fade in
  fadeInBGM();

  // Toggle password visibility
  togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "🙈" : "👁️";
  });

  toggleConfirm.addEventListener("click", () => {
    const isHidden = confirmInput.type === "password";
    confirmInput.type = isHidden ? "text" : "password";
    toggleConfirm.textContent = isHidden ? "🙈" : "👁️";
  });

  // Clear all error messages
  function clearErrors() {
    usernameError.textContent = "";
    passwordError.textContent = "";
    confirmError.textContent = "";
  }

  // Popup message
  function showPopup(message, type = "info") {
    const popup = document.createElement("div");
    popup.className = `popup-message ${type}`;
    popup.textContent = message;

    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add("show"), 10);
    setTimeout(() => {
      popup.classList.remove("show");
      setTimeout(() => popup.remove(), 300);
    }, 1800);
  }

  // Play sounds
  function playSound(type) {
    if (type === "success") {
      successSound.currentTime = 0;
      successSound.play();
    } else if (type === "error") {
      errorSound.currentTime = 0;
      errorSound.play();
    }
  }

  // Form submission logic
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const confirm = confirmInput.value.trim();

    let valid = true;

    if (!username) {
      usernameError.textContent = "Username is required.";
      playSound("error");
      valid = false;
    }

    if (!password) {
      passwordError.textContent = "Password is required.";
      playSound("error");
      valid = false;
    }

    if (!confirm) {
      confirmError.textContent = "Please confirm your password.";
      playSound("error");
      valid = false;
    }

    if (password && confirm && password !== confirm) {
      confirmError.textContent = "Passwords do not match.";
      playSound("error");
      valid = false;
    }

    if (!valid) return;

    try {
      // Check if username already exists
      const snapshot = await db.collection("users")
        .where("username", "==", username)
        .get();

      if (!snapshot.empty) {
        usernameError.textContent = "Username already exists.";
        playSound("error");
        return;
      }

      // Add user to Firestore
      const docRef = await db.collection("users").add({
        username,
        password,
        score: 0,
        createdAt: firebase.firestore.Timestamp.now(),
      });

      // Store username and userId in sessionStorage
      sessionStorage.setItem("username", username);
      sessionStorage.setItem("userId", docRef.id);

      playSound("success"); // Play before popup
      showPopup("✅ Account created successfully!", "success");

      setTimeout(() => {
        window.location.href = "../pages/user.html";
      }, 1000);

    } catch (err) {
      console.error("Signup error:", err.message);
      playSound("error");
      showPopup("❌ Error: " + err.message, "error");
    }
  });
});
