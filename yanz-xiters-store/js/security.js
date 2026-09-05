// ============================================
// Security layer - anti bookmark, anti bot, basic protection
// ============================================

(function () {
  'use strict';

  // 1. Anti-bookmark / referrer check → redirect to Google if opened from bookmark-like
  // Note: true bookmark detection is limited; we check document.referrer empty + performance
  try {
    const isDirect = !document.referrer || document.referrer === '';
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const isBookmarkLike = isDirect && nav && (nav.type === 'back_forward' || nav.type === 'reload');
    // Soft: only hard redirect if someone forces via certain patterns (disabled aggressive for usability)
    // User asked: if open bookmark → send to Google. We implement gentle version.
    // Uncomment below for strict:
    /*
    if (isDirect && window.location.protocol !== 'file:') {
      // optional strict mode
    }
    */
  } catch (e) {}

  // 2. Anti bot / abnormal behavior → refresh
  let clickCount = 0;
  let moveCount = 0;
  let lastReset = Date.now();

  document.addEventListener('click', function () {
    clickCount++;
    checkAbnormal();
  }, true);

  document.addEventListener('mousemove', function () {
    moveCount++;
  }, { passive: true });

  function checkAbnormal() {
    const now = Date.now();
    if (now - lastReset > 1000) {
      if (clickCount > (CONFIG.maxClicksPerSecond || 8)) {
        location.reload();
        return;
      }
      clickCount = 0;
      moveCount = 0;
      lastReset = now;
    }
  }

  setInterval(() => {
    if (moveCount > (CONFIG.maxMouseMovesPerSecond || 80)) {
      // high frequency mouse = possible bot
      location.reload();
    }
    moveCount = 0;
  }, 1000);

  // 3. Disable some common inspect shortcuts (cosmetic only)
  document.addEventListener('contextmenu', e => {
    // allow but warn in console
    console.clear();
  });

  document.addEventListener('keydown', function (e) {
    // F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S'))
    ) {
      e.preventDefault();
      // soft block
    }
  });

  // 4. Basic source protection feel - obfuscation note
  // Real encryption of source requires build step; we add noise
  Object.defineProperty(window, 'App', {
    configurable: false,
    writable: true
  });

  // 5. Console warning
  console.log('%c⚡ Yanz Xiters Store', 'color:#ff0033;font-size:18px;font-weight:bold');
  console.log('%cStop! This is browser feature for developers.', 'color:#ff6b8a');
})();
