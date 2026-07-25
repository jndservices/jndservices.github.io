(function () {
  const ADMIN_PW = window.JND_CONFIG.ADMIN_PW;
  const TRIGGER = 'jndadmin';
  const BANNER_MS = 10000;
  const SB_URL = window.JND_CONFIG.SUPABASE_URL;
  const SB_KEY = window.JND_CONFIG.SUPABASE_KEY;
  const ANNOUNCE_TABLE = 'bd_announcements'; // existing Supabase table, reused for broadcasts
  const HEADERS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

  let keyBuffer = '', bufferTimer = null, bannerTimer = null;

  // ── Desktop trigger: Shift + Alt + type "jndadmin" ─────────────────────────
  document.addEventListener('keydown', e => {
    if (!e.shiftKey || !e.altKey || e.key.length !== 1 || !/[a-zA-Z]/.test(e.key)) {
      if (!e.shiftKey || !e.altKey) { keyBuffer = ''; clearTimeout(bufferTimer); }
      return;
    }
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    keyBuffer += e.key.toLowerCase();
    if (keyBuffer.length > TRIGGER.length) keyBuffer = keyBuffer.slice(-TRIGGER.length);
    clearTimeout(bufferTimer);
    bufferTimer = setTimeout(() => { keyBuffer = ''; }, 2000);
    if (keyBuffer === TRIGGER) { keyBuffer = ''; popLogin(); }
  });

  // ── Mobile trigger: tap the drawer mark 10 times ────────────────────────────
  let drawerTaps = 0, drawerTapTimer = null, drawerTapAttached = false;
  function attachDrawerTap() {
    if (drawerTapAttached) return;
    const mark = document.querySelector('.drawer-mark');
    if (!mark) { setTimeout(attachDrawerTap, 300); return; }
    drawerTapAttached = true;
    mark.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') mark.click(); });
    mark.addEventListener('click', () => {
      drawerTaps++;
      clearTimeout(drawerTapTimer);
      if (drawerTaps >= 10) { drawerTaps = 0; popLogin(); }
      else { drawerTapTimer = setTimeout(() => { drawerTaps = 0; }, 4000); }
    });
  }
  document.addEventListener('DOMContentLoaded', attachDrawerTap);
  attachDrawerTap();

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const loginOverlay = document.getElementById('loginOverlay');
  const loginClose = document.getElementById('loginClose');
  const pwField = document.getElementById('adminPw');
  const enterBtn = document.getElementById('adminEnter');
  const loginErr = document.getElementById('adminErr');
  const panelOverlay = document.getElementById('panelOverlay');
  const panelClose = document.getElementById('panelClose');
  const announceField = document.getElementById('announceText');
  const announceBtn = document.getElementById('announceSend');
  const logoutBtn = document.getElementById('panelLogout');
  const moderateBtn = document.getElementById('toggleModerate');
  const banner = document.getElementById('banner');
  const bannerBackdrop = document.getElementById('bannerBackdrop');
  const bannerMsgEl = document.getElementById('bannerMsg');
  const bannerClose = document.getElementById('bannerClose');

  function popLogin() {
    loginOverlay.classList.add('open');
    loginErr.textContent = ''; pwField.value = '';
    setTimeout(() => pwField.focus(), 150);
  }
  function ditchLogin() { loginOverlay.classList.remove('open'); pwField.value = ''; loginErr.textContent = ''; }
  function popPanel() { panelOverlay.classList.add('open'); }
  function ditchPanel() { panelOverlay.classList.remove('open'); }

  function verify() {
    if (pwField.value === ADMIN_PW) {
      sessionStorage.setItem('jnd-admin', '1');
      document.body.classList.add('jnd-admin-active');
      ditchLogin();
      popPanel();
      if (window.jndReloadReviews) window.jndReloadReviews();
    } else {
      loginErr.textContent = 'Incorrect password.';
      pwField.value = '';
    }
  }

  loginClose.addEventListener('click', ditchLogin);
  loginOverlay.addEventListener('click', e => { if (e.target === loginOverlay) ditchLogin(); });
  enterBtn.addEventListener('click', verify);
  pwField.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); });
  panelClose.addEventListener('click', ditchPanel);
  panelOverlay.addEventListener('click', e => { if (e.target === panelOverlay) ditchPanel(); });
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('jnd-admin');
    document.body.classList.remove('jnd-admin-active');
    ditchPanel();
    if (window.jndReloadReviews) window.jndReloadReviews();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (loginOverlay.classList.contains('open')) ditchLogin();
      if (panelOverlay.classList.contains('open')) ditchPanel();
    }
  });

  moderateBtn.addEventListener('click', () => {
    if (window.jndReloadReviews) window.jndReloadReviews();
    ditchPanel();
    document.getElementById('reviews').scrollIntoView({ behavior: 'smooth' });
  });

  // ── Broadcast ────────────────────────────────────────────────────────────────
  announceBtn.addEventListener('click', async () => {
    const text = announceField.value.trim();
    if (!text) return;
    announceBtn.textContent = 'Sending…';
    announceBtn.disabled = true;
    try {
      const res = await fetch(SB_URL + '/rest/v1/' + ANNOUNCE_TABLE, {
        method: 'POST',
        headers: Object.assign({}, HEADERS, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ message: text, created_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error(await res.text());
      const [saved] = await res.json();
      if (saved && saved.id != null) lastSeenId = saved.id;
      ditchPanel();
      announceField.value = '';
      showBanner(text);
    } catch (err) { console.error('Broadcast failed:', err); }
    finally { announceBtn.textContent = '📢 Broadcast Now'; announceBtn.disabled = false; }
  });

  // ── Polling for new announcements ───────────────────────────────────────────
  let lastSeenId = null, pollInitialized = false;
  async function listenForAnnouncements() {
    try {
      const res = await fetch(
        SB_URL + '/rest/v1/' + ANNOUNCE_TABLE + '?select=id,message,created_at&order=created_at.desc&limit=1',
        { headers: HEADERS }
      );
      if (!res.ok) return;
      const rows = await res.json();
      if (!rows.length) { pollInitialized = true; return; }
      const latest = rows[0];
      if (!pollInitialized) { lastSeenId = latest.id; pollInitialized = true; return; }
      if (latest.id !== lastSeenId) {
        const age = Date.now() - new Date(latest.created_at).getTime();
        lastSeenId = latest.id;
        if (age < 15000) showBanner(latest.message);
      }
    } catch (e) {}
  }
  listenForAnnouncements();
  setInterval(listenForAnnouncements, 5000);

  function showBanner(text) {
    clearTimeout(bannerTimer);
    const oldBar = document.getElementById('bannerBar');
    const newBar = oldBar.cloneNode();
    oldBar.parentNode.replaceChild(newBar, oldBar);
    bannerMsgEl.textContent = text;
    bannerBackdrop.classList.add('show');
    banner.classList.add('show');
    bannerTimer = setTimeout(killBanner, BANNER_MS);
  }
  function killBanner() { banner.classList.remove('show'); bannerBackdrop.classList.remove('show'); }
  bannerBackdrop.addEventListener('click', () => { clearTimeout(bannerTimer); killBanner(); });
  bannerClose.addEventListener('click', () => { clearTimeout(bannerTimer); killBanner(); });

  // show delete buttons live when admin is logged in
  setInterval(() => {
    const isAdmin = sessionStorage.getItem('jnd-admin') === '1';
    document.querySelectorAll('.review-delete-btn').forEach(b => { b.style.display = isAdmin ? 'flex' : 'none'; });
  }, 1000);
})();
