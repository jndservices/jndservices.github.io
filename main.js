// ============================================================
//  main.js — nav, theme, mobile menu, scroll reveal, reviews
// ============================================================

/* ---------- Header hide on scroll down, show on scroll up ---------- */
(function () {
  const nav = document.getElementById('siteNav');
  if (!nav) return;
  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const goingDown = y > lastY;
    const pastThreshold = y > 80;

    if (goingDown && pastThreshold) {
      nav.classList.add('nav-hidden');
    } else {
      nav.classList.remove('nav-hidden');
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();

/* ---------- Theme toggle ---------- */
(function () {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const ball = document.getElementById('toggle-ball');
  const label = document.getElementById('theme-label');

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    ball.textContent = theme === 'dark' ? '🌙' : '☀️';
    label.textContent = theme === 'dark' ? 'Dark' : 'Light';
    localStorage.setItem('jnd-theme', theme);
  }
  apply(localStorage.getItem('jnd-theme') || 'light');
  toggle.addEventListener('click', () => {
    apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
})();

/* ---------- Mobile menu ---------- */
(function () {
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');
  const backdrop = document.getElementById('menu-backdrop');
  const closeBtn = document.getElementById('mobile-close');

  function open() { menu.classList.add('open'); backdrop.classList.add('open'); }
  function close() { menu.classList.remove('open'); backdrop.classList.remove('open'); }

  hamburger.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.querySelectorAll('.mobile-link').forEach(a => a.addEventListener('click', close));
})();

/* ---------- Scroll reveal ---------- */
(function () {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

/* ---------- Toast ---------- */
function jndToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._jndToastTimer);
  window._jndToastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Reviews ---------- */
(function () {
  const SB_URL = window.JND_CONFIG.SUPABASE_URL;
  const SB_KEY = window.JND_CONFIG.SUPABASE_KEY;
  const TABLE = 'jnd_reviews';
  const HEADERS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  const LAST_SEND_KEY = 'jnd-review-last';

  let rating = 0;
  let reviews = [];
  let index = 0;

  const starPicker = document.getElementById('starPicker');
  const nameInput = document.getElementById('revName');
  const msgInput = document.getElementById('revMsg');
  const sendBtn = document.getElementById('revSend');
  const cooldownEl = document.getElementById('revCooldown');
  const track = document.getElementById('reviewTrack');
  const dotsEl = document.getElementById('reviewDots');

  starPicker.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      rating = parseInt(btn.dataset.val, 10);
      starPicker.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.val, 10) <= rating));
    });
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function starString(n) {
    return '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);
  }

  function updateSummary() {
    const avgEl = document.getElementById('rsAverage');
    const starsEl = document.getElementById('rsStars');
    const countEl = document.getElementById('rsCount');
    if (!reviews.length) {
      avgEl.textContent = '–';
      starsEl.textContent = '☆☆☆☆☆';
      countEl.textContent = 'No reviews yet';
      return;
    }
    const avg = reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length;
    avgEl.textContent = avg.toFixed(1);
    starsEl.textContent = starString(Math.round(avg));
    countEl.textContent = reviews.length + (reviews.length === 1 ? ' review' : ' reviews');
  }

  function makeCard(r, i) {
    const card = document.createElement('div');
    card.className = 'review-card';
    const isAdmin = sessionStorage.getItem('jnd-admin') === '1';
    card.innerHTML = `
      <div class="rc-stars">${starString(r.rating || 0)}</div>
      <div class="rc-msg">${escapeHtml(r.message || '')}</div>
      <div class="rc-name">${escapeHtml(r.name && r.name.trim() ? r.name : 'Anonymous')}</div>
      <button class="review-delete-btn" style="display:${isAdmin ? 'flex' : 'none'};" aria-label="Delete review">🗑</button>
    `;
    card.querySelector('.review-delete-btn').addEventListener('click', async () => {
      if (!confirm('Delete this review?')) return;
      try {
        await fetch(SB_URL + '/rest/v1/' + TABLE + '?id=eq.' + r.id, { method: 'DELETE', headers: HEADERS });
      } catch (e) {}
      reviews.splice(i, 1);
      renderReviews(reviews);
      updateSummary();
    });
    return card;
  }

  function buildDots(count) {
    dotsEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.className = 'review-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => { index = i; updateCarousel(); });
      dotsEl.appendChild(dot);
    }
  }

  function updateCarousel() {
    const cardWidth = 320 + 16;
    track.style.transform = `translateX(-${index * cardWidth}px)`;
    [...dotsEl.children].forEach((d, i) => d.classList.toggle('active', i === index));
  }

  function renderReviews(list) {
    track.innerHTML = '';
    if (!list.length) {
      track.innerHTML = '<div class="review-empty">No reviews yet. Be the first to leave one.</div>';
      dotsEl.innerHTML = '';
      return;
    }
    list.slice().reverse().forEach((r, i) => track.appendChild(makeCard(r, list.length - 1 - i)));
    buildDots(list.length);
    index = 0;
    updateCarousel();
  }

  async function loadReviews() {
    try {
      const res = await fetch(SB_URL + '/rest/v1/' + TABLE + '?select=*&order=created_at.desc&limit=50', { headers: HEADERS });
      if (!res.ok) throw new Error('fetch failed');
      reviews = (await res.json()).reverse();
    } catch (e) {
      reviews = [];
      track.innerHTML = '<div class="review-empty">Reviews are unavailable right now. Please check back later.</div>';
    }
    renderReviews(reviews);
    updateSummary();
  }
  loadReviews();

  function getLastSend() { return parseInt(localStorage.getItem(LAST_SEND_KEY) || '0', 10); }
  function updateCooldownUI() {
    const wait = 30000 - (Date.now() - getLastSend());
    if (wait > 0) {
      sendBtn.disabled = true;
      cooldownEl.textContent = `You can submit another review in ${Math.ceil(wait / 1000)}s`;
      setTimeout(updateCooldownUI, 1000);
    } else {
      sendBtn.disabled = false;
      cooldownEl.textContent = '';
    }
  }
  updateCooldownUI();

  sendBtn.addEventListener('click', async () => {
    const message = msgInput.value.trim();
    const name = nameInput.value.trim();
    if (!message) { jndToast('Please write a review first.'); return; }
    if (!rating) { jndToast('Please select a star rating.'); return; }
    if (Date.now() - getLastSend() < 30000) return;

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    const payload = { name: name || null, rating, message };
    try {
      const res = await fetch(SB_URL + '/rest/v1/' + TABLE, {
        method: 'POST',
        headers: Object.assign({}, HEADERS, { 'Prefer': 'return=representation' }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const [saved] = await res.json();
      reviews.push(saved || Object.assign({ id: Date.now(), created_at: new Date().toISOString() }, payload));
      renderReviews(reviews);
      updateSummary();
      msgInput.value = ''; nameInput.value = '';
      rating = 0;
      starPicker.querySelectorAll('button').forEach(b => b.classList.remove('on'));
      localStorage.setItem(LAST_SEND_KEY, Date.now().toString());
      jndToast('Thanks for your review!');
    } catch (e) {
      console.error('Review submit failed:', e);
      jndToast('Could not submit review — please try again.');
    } finally {
      sendBtn.textContent = 'Submit Review';
      updateCooldownUI();
    }
  });

  window.jndReloadReviews = loadReviews;

  const outer = document.querySelector('.review-carousel-wrap');
  let dragging = false, startX = 0, startIndex = 0;
  outer.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startIndex = index; dragging = true; }, { passive: true });
  outer.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const cards = document.querySelectorAll('.review-card');
    if (dx < -50 && index < cards.length - 1) { index = startIndex + 1; updateCarousel(); dragging = false; }
    else if (dx > 50 && index > 0) { index = startIndex - 1; updateCarousel(); dragging = false; }
  }, { passive: true });
  outer.addEventListener('touchend', () => { dragging = false; });
})();
