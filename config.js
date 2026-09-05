// ============================================
// Yanz Xiters Store - CONFIGURATION
// Edit links, QR, videos, and settings here
// ============================================

const CONFIG = {
  // QR Code Image URL for payment (Catbox or any direct image link)
  // Ganti dengan link QR kamu sendiri
  qrPaymentUrl: "https://files.catbox.moe/example-qr.png", // <-- GANTI INI

  // Default video box di Dashboard (link Catbox atau direct video)
  dashboardVideoUrl: "https://files.catbox.moe/example-video.mp4", // <-- GANTI INI

  // Favicon (emoji)
  faviconEmoji: "⚡",

  // Contact
  supportEmail: "yansupport1@gmail.com",
  supportTelegram: "yanzking122",
  supportWA: "", // kosong

  // Site
  siteName: "Yanz Xiters Store",
  siteTagline: "Premium Digital Products • Mafia Edition",

  // Anti-bot / Security thresholds
  maxClicksPerSecond: 8,
  maxMouseMovesPerSecond: 80,
};

// Export for modules if needed
if (typeof module !== "undefined") module.exports = CONFIG;
