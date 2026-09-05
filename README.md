# ⚡ Yanz Xiters Store

Web pembelian otomatis + Admin Panel  
Tema: **Liquid Glass Neon Merah Darah Mafia**

## File Structure

```
yanz-xiters-store/
├── index.html          # Main page
├── config.js           # QR, video dashboard, contact (EDIT INI)
├── css/style.css       # Full liquid glass + neon animations
├── js/
│   ├── firebase.js     # Firebase helpers
│   ├── security.js     # Anti-bot, anti-inspect soft
│   └── app.js          # Main logic
├── database.json       # Import ke Firebase Realtime Database
└── README.md
```

## Setup Firebase (WAJIB)

1. Buka [Firebase Console](https://console.firebase.google.com/) → project **web-jual**
2. Realtime Database → Create database (jika belum) → pilih lokasi (biasanya `asia-southeast1` atau default)
3. **Import** file `database.json`:
   - Realtime Database → ⋮ (tiga titik) → Import JSON → pilih `database.json`
4. **Rules** (sementara untuk testing, longgarkan dulu):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> Setelah production, kunci rules agar hanya path tertentu yang boleh di-write.

5. Pastikan `databaseURL` di `js/firebase.js` sesuai.  
   Cek di Firebase Console → Realtime Database → URL-nya.  
   Biasanya: `https://web-jual-default-rtdb.firebaseio.com`  
   atau `https://web-jual-default-rtdb.asia-southeast1.firebasedatabase.app`

## Config yang harus diganti

Buka `config.js`:

```js
qrPaymentUrl: "https://files.catbox.moe/XXXXX.png",   // QR transfer kamu
dashboardVideoUrl: "https://files.catbox.moe/YYYY.mp4", // Video di home
```

## Admin Key

Default key di `database.json`:

```
YANZ-MASTER-KEY-2026
```

- Max **1 device** login.
- Setelah login pertama, device ID tersimpan.
- Bisa buat key baru / disable lewat Admin Panel → Keys.

## Fitur

- ✅ Produk + video box (Catbox / direct / YouTube)
- ✅ Diskon % + durasi hari (otomatis mati)
- ✅ Buy → QR → upload bukti TF (localStorage agar tidak hilang)
- ✅ Admin verifikasi Terima / Tolak → user otomatis dapat link download
- ✅ User ID unik (localStorage + Firebase) terbawa ke order
- ✅ Admin session persist (key tidak diminta ulang jika masih valid)
- ✅ Global ON/OFF status
- ✅ Running time di home
- ✅ Liquid glass + neon blood red animations
- ✅ Soft anti-bot / anti-inspect

## Deploy

Bisa deploy ke:

- Netlify / Vercel / GitHub Pages / Cloudflare Pages
- Atau hosting biasa (cPanel) — pure static HTML/CSS/JS

Tidak perlu backend server.

## Support

- Gmail: yansupport1@gmail.com
- Telegram: @yanzking122

---

**Sekali bikin langsung jadi.** Edit config.js + import database.json → siap pakai.
