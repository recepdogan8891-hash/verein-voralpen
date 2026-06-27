// ── Mobile nav toggle ──────────────────────────────────────
const hamburger = document.querySelector('.hamburger');
const mobileNav = document.querySelector('.mobile-nav');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => mobileNav.classList.toggle('open'));
}

// ── Active nav link ────────────────────────────────────────
const currentPage = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(link => {
  const linkPage = link.getAttribute('href').split('/').pop();
  if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
    link.classList.add('active');
  }
});

// ── Admin login modal ──────────────────────────────────────
// Inject modal HTML once into every page
document.body.insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="admin-modal">
    <div class="modal-card">
      <button class="modal-close" id="modal-close" aria-label="Schließen">✕</button>
      <h2>🔒 Admin-Bereich</h2>
      <p class="modal-sub">Verein Voralpen – Verwaltung</p>
      <div class="form-group">
        <label for="m-user">Benutzername</label>
        <input type="text" id="m-user" placeholder="admin" autocomplete="username">
      </div>
      <div class="form-group" style="margin-top:12px;">
        <label for="m-pass">Passwort</label>
        <input type="password" id="m-pass" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-primary" id="modal-login-btn" style="width:100%; margin-top:16px;">Anmelden</button>
      <div class="modal-error" id="modal-error">Falsche Zugangsdaten.</div>
    </div>
  </div>
`);

const modal     = document.getElementById('admin-modal');
const adminBtn  = document.getElementById('admin-btn');
const closeBtn  = document.getElementById('modal-close');
const loginBtn  = document.getElementById('modal-login-btn');
const errorEl   = document.getElementById('modal-error');

function openModal()  { modal.classList.add('open'); document.getElementById('m-user').focus(); }
function closeModal() { modal.classList.remove('open'); errorEl.style.display = 'none'; }

if (adminBtn) adminBtn.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

async function doLogin() {
  const username = document.getElementById('m-user').value.trim();
  const password = document.getElementById('m-pass').value;
  errorEl.style.display = 'none';
  loginBtn.disabled = true;
  loginBtn.textContent = '…';
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (r.ok) {
      window.location.href = '/admin.html';
    } else {
      errorEl.style.display = 'block';
    }
  } catch {
    // API yok (statik serve) — direkt yönlendir
    window.location.href = '/admin.html';
  }
  loginBtn.disabled = false;
  loginBtn.textContent = 'Anmelden';
}

loginBtn.addEventListener('click', doLogin);
document.getElementById('m-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// ── Contact form ───────────────────────────────────────────
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const success = document.getElementById('form-success');
    btn.textContent = 'Wird gesendet…';
    btn.disabled = true;
    setTimeout(() => {
      contactForm.reset();
      btn.textContent = 'Absenden';
      btn.disabled = false;
      if (success) success.style.display = 'block';
    }, 1000);
  });
}

// ── Registration form ──────────────────────────────────────
const regForm = document.getElementById('reg-form');
if (regForm) {
  regForm.addEventListener('submit', e => {
    e.preventDefault();
    const btn = regForm.querySelector('button[type="submit"]');
    const success = document.getElementById('reg-success');
    btn.textContent = 'Wird gesendet…';
    btn.disabled = true;
    setTimeout(() => {
      regForm.reset();
      btn.textContent = 'Absenden';
      btn.disabled = false;
      if (success) success.style.display = 'block';
    }, 1000);
  });
}
