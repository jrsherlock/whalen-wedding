/**
 * Gallery lightbox.
 *
 * Clicking (or Enter/Space-activating, since gallery slides are real
 * <button> elements) a gallery photo opens it large in a modal dialog.
 * Serves the 1600px variant (WebP with JPEG fallback) read straight out
 * of each thumbnail's existing <picture> markup — no duplicated data
 * attributes to keep in sync.
 *
 * Accessibility:
 *  - role="dialog" + aria-modal="true" + aria-label on the frame.
 *  - Focus moves into the dialog on open, is trapped there (Tab/Shift+Tab
 *    cycle within it), and returns to the triggering gallery item on close.
 *  - Escape closes; Left/Right arrows navigate and wrap.
 *  - An aria-live region announces "Photo N of M" on every navigation.
 *  - Background scroll is locked while open and restored on close.
 *
 * Degrades gracefully: if the gallery isn't present, this is a no-op, and
 * the panorama itself works (and looks identical) with this script absent.
 */
export function initLightbox() {
  const gallery = document.querySelector('.gallery-panorama');
  if (!gallery) return;

  const items = Array.from(gallery.querySelectorAll('.gallery-slide'));
  if (!items.length) return;

  let currentIndex = -1;
  let triggerEl = null;
  let savedScrollY = 0;
  let savedRootOverflow = '';
  let savedRootPaddingRight = '';

  // ─── Build the lightbox DOM once ───
  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox-backdrop';

  const frame = document.createElement('div');
  frame.className = 'lightbox-frame';
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-modal', 'true');
  frame.setAttribute('aria-label', 'Photo viewer');
  frame.tabIndex = -1;

  ['tl', 'tr', 'bl', 'br'].forEach((corner) => {
    const span = document.createElement('span');
    span.className = `lightbox-corner lightbox-corner--${corner}`;
    span.setAttribute('aria-hidden', 'true');
    frame.appendChild(span);
  });

  const picture = document.createElement('picture');
  const source = document.createElement('source');
  source.type = 'image/webp';
  const img = document.createElement('img');
  img.className = 'lightbox-image';
  picture.appendChild(source);
  picture.appendChild(img);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'lightbox-nav lightbox-prev';
  prevBtn.setAttribute('aria-label', 'Previous photo');
  prevBtn.innerHTML = '&lsaquo;';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'lightbox-nav lightbox-next';
  nextBtn.setAttribute('aria-label', 'Next photo');
  nextBtn.innerHTML = '&rsaquo;';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close photo viewer');
  closeBtn.innerHTML = '&times;';

  const liveRegion = document.createElement('div');
  liveRegion.className = 'sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');

  frame.appendChild(picture);
  frame.appendChild(prevBtn);
  frame.appendChild(nextBtn);
  frame.appendChild(closeBtn);
  frame.appendChild(liveRegion);
  backdrop.appendChild(frame);
  document.body.appendChild(backdrop);

  // ─── Helpers ───

  // Pull the URL matching a given width descriptor (e.g. "1600w") out of
  // a srcset string; falls back to the last (largest) listed entry.
  function srcForWidth(srcset, width) {
    if (!srcset) return '';
    const entries = srcset.split(',').map((entry) => entry.trim()).filter(Boolean);
    const match = entries.find((entry) => entry.split(/\s+/)[1] === width);
    if (match) return match.split(/\s+/)[0];
    const last = entries[entries.length - 1];
    return last ? last.split(/\s+/)[0] : '';
  }

  function dataForItem(item) {
    const sourceEl = item.querySelector('picture source[type="image/webp"]');
    const imgEl = item.querySelector('picture img');
    return {
      webp: srcForWidth(sourceEl ? sourceEl.getAttribute('srcset') : '', '1600w'),
      jpg: srcForWidth(imgEl.getAttribute('srcset'), '1600w') || imgEl.src,
      alt: imgEl.alt,
    };
  }

  function focusableEls() {
    return [prevBtn, nextBtn, closeBtn];
  }

  function render(index) {
    currentIndex = index;
    const { webp, jpg, alt } = dataForItem(items[index]);
    source.srcset = webp;
    img.src = jpg;
    img.alt = alt;
    frame.setAttribute('aria-label', `Photo viewer — photo ${index + 1} of ${items.length}`);
    liveRegion.textContent = `Photo ${index + 1} of ${items.length}`;
  }

  // Wheel input is blocked outright via preventDefault. Programmatic
  // scrolling (window.scrollTo/scrollBy, etc.) can't be intercepted that
  // way, so any drift it causes is caught by the scroll listener below and
  // snapped straight back to the saved offset.
  function preventWheelScroll(e) {
    e.preventDefault();
  }

  function pinScrollPosition() {
    if (window.scrollY !== savedScrollY) {
      // `behavior: 'instant'` bypasses this page's `scroll-behavior:
      // smooth`, which would otherwise animate the snap-back and leave it
      // settling at a slightly-off sub-pixel value.
      window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' });
    }
  }

  function lockScroll() {
    // This page's scrolling element is <html>, not <body> (base.css only
    // sets overflow-x on body), so the lock has to target documentElement
    // or it has no effect on background scroll. Note that `overflow:
    // hidden` alone doesn't stop programmatic scrollTo() on the root
    // scroller in Chromium, hence the wheel/scroll listeners below.
    const root = document.documentElement;
    savedScrollY = window.scrollY || root.scrollTop;
    savedRootOverflow = root.style.overflow;
    savedRootPaddingRight = root.style.paddingRight;

    // Measure the scrollbar width before hiding it so we can compensate
    // with padding and avoid a layout shift. This is 0 on platforms with
    // overlay scrollbars, so no padding is added there.
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    if (scrollbarWidth > 0) {
      root.style.paddingRight = `${scrollbarWidth}px`;
    }
    root.style.overflow = 'hidden';

    window.addEventListener('wheel', preventWheelScroll, { passive: false });
    window.addEventListener('scroll', pinScrollPosition, { passive: true });
  }

  function unlockScroll() {
    const root = document.documentElement;
    window.removeEventListener('wheel', preventWheelScroll);
    window.removeEventListener('scroll', pinScrollPosition);
    root.style.overflow = savedRootOverflow;
    root.style.paddingRight = savedRootPaddingRight;
  }

  function open(index) {
    triggerEl = items[index];
    render(index);
    backdrop.classList.add('is-open');
    lockScroll();
    document.addEventListener('keydown', onKeydown, true);
    frame.focus();
  }

  function close() {
    backdrop.classList.remove('is-open');
    unlockScroll();
    document.removeEventListener('keydown', onKeydown, true);
    source.srcset = '';
    img.src = '';
    currentIndex = -1;
    if (triggerEl) {
      triggerEl.focus();
      triggerEl = null;
    }
  }

  function showNext() {
    render((currentIndex + 1) % items.length);
  }

  function showPrev() {
    render((currentIndex - 1 + items.length) % items.length);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      showNext();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showPrev();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = focusableEls();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === frame) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ─── Wire up controls ───
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);

  items.forEach((item, index) => {
    item.addEventListener('click', () => open(index));
  });
}
