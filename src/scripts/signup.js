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
      valid = false;
    }

    if (!password) {
      passwordError.textContent = "Password is required.";
      valid = false;
    }

    if (!confirm) {
      confirmError.textContent = "Please confirm your password.";
      valid = false;
    }

    if (password && confirm && password !== confirm) {
      confirmError.textContent = "Passwords do not match.";
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
        return;
      }

      // Add user to Firestore and get the doc reference
      const docRef = await db.collection("users").add({
        username,
        password,
        score: 0,
        createdAt: firebase.firestore.Timestamp.now(),
      });

      // Store username and userId in sessionStorage
      sessionStorage.setItem("username", username);
      sessionStorage.setItem("userId", docRef.id);

      showPopup("✅ Account created successfully!", "success");

      setTimeout(() => {
        window.location.href = "../pages/user.html";
      }, 1000);

    } catch (err) {
      console.error("Signup error:", err.message);
      showPopup("❌ Error: " + err.message, "error");
    }
  });
});
