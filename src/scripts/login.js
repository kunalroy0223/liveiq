// src/scripts/login.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("toggle-password");

  const usernameError = document.getElementById("username-error");
  const passwordError = document.getElementById("password-error");

  // Toggle password visibility
  togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "🙈" : "👁️";
  });

  // Clear error messages
  function clearErrors() {
    usernameError.textContent = "";
    passwordError.textContent = "";
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

  // Form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    let valid = true;

    if (!username) {
      usernameError.textContent = "Username is required.";
      valid = false;
    }

    if (!password) {
      passwordError.textContent = "Password is required.";
      valid = false;
    }

    if (!valid) return;

    // Admin Login
    if (username === "Admin" && password === "Admin@123") {
      sessionStorage.setItem("username", "Admin");
      showPopup("👑 Logged in as Admin", "success");
      setTimeout(() => {
        window.location.href = "../pages/admin.html";
      }, 1000);
      return;
    }

    // Regular User Login
    try {
      const snapshot = await db
        .collection("users")
        .where("username", "==", username)
        .get();

      if (snapshot.empty) {
        passwordError.textContent = "Invalid username or password.";
        return;
      }

      let matched = false;
      let matchedUserId = null;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const storedPassword = (data.password || "").trim();
        const enteredPassword = password.trim();

        if (storedPassword === enteredPassword) {
          matched = true;
          matchedUserId = doc.id;  // store user document ID
        }
      });

      if (matched) {
        sessionStorage.setItem("username", username);
        sessionStorage.setItem("userId", matchedUserId);  // store userId
        showPopup("✅ Login successful!", "success");
        setTimeout(() => {
          window.location.href = "../pages/user.html";
        }, 1000);
      } else {
        passwordError.textContent = "Invalid username or password.";
      }
    } catch (err) {
      console.error("Login error:", err);
      showPopup("❌ Error logging in", "error");
    }
  });
});
