/**
 * Gliding panorama gallery (client-approved "Option D").
 *
 * One complete photo at a time; slides glide horizontally on a translateX
 * track. Auto-advances every AUTOPLAY_MS while the gallery is on screen and
 * not hovered/focused; disabled entirely under prefers-reduced-motion.
 * Prev/next arrows, dot indicators, arrow keys (when focus is inside the
 * gallery) and touch swipe all navigate and wrap.
 *
 * Opening a slide full size is handled separately by js/lightbox.js —
 * slides are real <button> elements, so that module just listens to them.
 *
 * Degrades gracefully: without this script the first photo is visible and
 * the rest are simply not reachable; nothing is broken.
 */
const AUTOPLAY_MS = 13000;
const SWIPE_THRESHOLD_PX = 40;

export function initGallery() {
  const root = document.querySelector('.gallery-panorama');
  if (!root) return;

  const viewport = root.querySelector('.gallery-viewport');
  const track = root.querySelector('.gallery-track');
  const slides = Array.from(root.querySelectorAll('.gallery-slide'));
  const prevBtn = root.querySelector('.gallery-nav--prev');
  const nextBtn = root.querySelector('.gallery-nav--next');
  const dotsEl = root.querySelector('.gallery-dots');
  if (!track || slides.length < 2) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = slides.length;
  let current = 0;
  let timer = null;
  let paused = false;   // hover / focus-within
  let visible = false;  // IntersectionObserver

  // ─── Dots ───
  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'gallery-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to photo ${i + 1}`);
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', () => goTo(i, true));
    if (dotsEl) dotsEl.appendChild(dot);
    return dot;
  });

  // Lazy-loaded slides sit inside an overflow:hidden track, so the browser
  // may not fetch them until they're already sliding into view. Nudge the
  // neighbours of the current slide to load ahead of time.
  function preloadAround(index) {
    [index - 1, index, index + 1].forEach((i) => {
      const img = slides[(i + count) % count].querySelector('img');
      if (img && img.loading === 'lazy') img.loading = 'eager';
    });
  }

  function goTo(index, userInitiated = false) {
    current = (index + count) % count;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((dot, i) => dot.setAttribute('aria-selected', i === current ? 'true' : 'false'));
    // Off-screen slides are focusable <button>s; take them out of the tab
    // order and the accessibility tree while hidden.
    slides.forEach((slide, i) => {
      const hidden = i !== current;
      slide.inert = hidden;
      slide.tabIndex = hidden ? -1 : 0;
    });
    preloadAround(current);
    if (userInitiated) restartTimer();
  }

  // ─── Autoplay ───
  function syncTimer() {
    const shouldRun = !reduceMotion && visible && !paused && !document.hidden;
    if (shouldRun && !timer) {
      timer = setInterval(() => goTo(current + 1), AUTOPLAY_MS);
    } else if (!shouldRun && timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function restartTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    syncTimer();
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        visible = e.isIntersecting && e.intersectionRatio >= 0.45;
        syncTimer();
      });
    }, { threshold: [0, 0.45, 1] }).observe(root);
  } else {
    visible = true;
    syncTimer();
  }

  root.addEventListener('mouseenter', () => { paused = true; syncTimer(); });
  root.addEventListener('mouseleave', () => { paused = false; syncTimer(); });
  root.addEventListener('focusin', () => { paused = true; syncTimer(); });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) { paused = false; syncTimer(); }
  });
  document.addEventListener('visibilitychange', syncTimer);

  // ─── Controls ───
  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1, true));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1, true));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1, true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1, true); }
  });

  // Touch swipe. A horizontal drag past the threshold navigates and
  // suppresses the click that would otherwise open the lightbox.
  let touchStartX = 0;
  let touchStartY = 0;
  let swiped = false;
  viewport.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swiped = false;
  }, { passive: true });
  viewport.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      goTo(dx < 0 ? current + 1 : current - 1, true);
    }
  }, { passive: true });
  viewport.addEventListener('click', (e) => {
    if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
  }, true);

  goTo(0);
}
