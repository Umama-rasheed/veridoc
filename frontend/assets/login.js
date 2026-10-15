// Login page logic
document.addEventListener("DOMContentLoaded", async () => {
  const session = await window.Auth.getSession();
  if (session) {
    window.location.href = "index.html";
    return;
  }

  const tabRegister = document.getElementById("tabRegister");
  const tabLogin = document.getElementById("tabLogin");
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const authError = document.getElementById("authError");
  const googleBtn = document.getElementById("googleBtn");
  const guestBtn = document.getElementById("guestBtn");

  function showError(msg) {
    authError.textContent = msg;
    authError.classList.remove("hidden");
  }
  function clearError() {
    authError.classList.add("hidden");
  }

  function switchTo(mode) {
    clearError();
    if (mode === "register") {
      tabRegister.classList.add("text-primary", "bg-primary-container/15");
      tabRegister.classList.remove("text-on-surface-variant");
      tabLogin.classList.remove("text-primary", "bg-primary-container/15");
      tabLogin.classList.add("text-on-surface-variant");
      registerForm.classList.remove("hidden");
      registerForm.classList.add("flex");
      loginForm.classList.add("hidden");
      loginForm.classList.remove("flex");
    } else {
      tabLogin.classList.add("text-primary", "bg-primary-container/15");
      tabLogin.classList.remove("text-on-surface-variant");
      tabRegister.classList.remove("text-primary", "bg-primary-container/15");
      tabRegister.classList.add("text-on-surface-variant");
      loginForm.classList.remove("hidden");
      loginForm.classList.add("flex");
      registerForm.classList.add("hidden");
      registerForm.classList.remove("flex");
    }
  }

  registerForm.classList.add("flex");

  tabRegister.addEventListener("click", () => switchTo("register"));
  tabLogin.addEventListener("click", () => switchTo("login"));
  document.getElementById("goLogin").addEventListener("click", () => switchTo("login"));
  document.getElementById("goRegister").addEventListener("click", () => switchTo("register"));

  googleBtn.addEventListener("click", async () => {
    try { await window.Auth.signInWithGoogle(); } catch (e) { showError(e.message); }
  });

  guestBtn.addEventListener("click", () => window.Auth.signInAsGuest());

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const btn = document.getElementById("registerBtn");
    btn.disabled = true; btn.textContent = "Creating…";
    try {
      await window.Auth.signUp(email, password, name);
      window.location.href = "index.html";
    } catch (err) {
      showError(err.message);
      btn.disabled = false; btn.textContent = "Create Account";
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    const email = document.getElementById("logEmail").value.trim();
    const password = document.getElementById("logPassword").value;
    const btn = document.getElementById("loginBtn");
    btn.disabled = true; btn.textContent = "Logging in…";
    try {
      await window.Auth.signIn(email, password);
      window.location.href = "index.html";
    } catch (err) {
      showError(err.message);
      btn.disabled = false; btn.textContent = "Login";
    }
  });
});