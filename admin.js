// admin.js
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
window.sb = sb;

const loginView = document.getElementById('loginView');
const adminApp = document.getElementById('adminApp');

async function refreshAuth() {
  const { data } = await sb.auth.getSession();
  const ok = !!data.session;
  loginView.hidden = ok;
  adminApp.hidden = !ok;
  if (ok) renderProducts();
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  document.getElementById('loginError').textContent = error ? '登入失敗：' + error.message : '';
  if (!error) refreshAuth();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut(); refreshAuth();
});

async function renderProducts() { /* Task 8 實作 */ }
refreshAuth();
