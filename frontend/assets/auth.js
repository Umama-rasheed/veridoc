// Veridoc — Supabase auth bridge (safe to load multiple times)
(function () {
  if (window.__veridoc_auth_loaded) return;
  window.__veridoc_auth_loaded = true;

  const SUPABASE_URL = "https://etzgiqzabbacsbvcegia.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0emdpcXphYmJhY3NidmNlZ2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4Njk4NTAsImV4cCI6MjEwNzQ0NTg1MH0.yPSbu2pXsNI2fvayAs11XMAIEfU0zSIo1Es5Pt-lZII";

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  }

  async function getCurrentUser() {
    const { data } = await supabaseClient.auth.getUser();
    return data.user;
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabaseClient.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw new Error(error.message);
    if (!data.session) {
      const { data: si, error: se } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (se) throw new Error("Account created but couldn't auto-login. Try logging in.");
      return si;
    }
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signInWithGoogle() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/index.html" },
    });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem("veridoc_guest");
    window.location.href = "login.html";
  }

  function signInAsGuest() {
    localStorage.setItem("veridoc_guest", "true");
    window.location.href = "index.html";
  }

  function isGuest() {
    return localStorage.getItem("veridoc_guest") === "true";
  }

  async function requireAuth() {
    if (isGuest()) return { guest: true };
    const session = await getSession();
    if (!session) {
      window.location.href = "login.html";
      return null;
    }
    return { guest: false, user: session.user, token: session.access_token };
  }

  async function renderUserChip() {
    const chip = document.getElementById("userChip");
    if (!chip) return;

    if (isGuest()) {
      chip.innerHTML = `<span class="text-outline font-label-sm">Guest</span><a href="login.html" class="ml-2 text-primary font-label-sm hover:underline">Sign in</a>`;
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      chip.innerHTML = `<a href="login.html" class="text-primary font-label-sm hover:underline">Sign in</a>`;
      return;
    }

    const initial = (user.email || "?")[0].toUpperCase();
    chip.innerHTML = `
      <span class="w-8 h-8 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center font-bold">${initial}</span>
      <button onclick="window.Auth.signOut()" class="ml-2 text-outline font-label-sm hover:text-primary transition-colors">Sign out</button>
    `;
  }

  window.Auth = {
    supabase: supabaseClient,
    getSession, getCurrentUser, signUp, signIn, signInWithGoogle,
    signOut, signInAsGuest, isGuest, requireAuth, renderUserChip,
  };
})();