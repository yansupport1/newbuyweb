// Firebase init + helpers
// Uses Firebase compat for simplicity (CDN)

const firebaseConfig = {
  apiKey: "AIzaSyCQCwme8gwAZgYY-lOZSmT6s0DBIWEFH2w",
  authDomain: "web-jual.firebaseapp.com",
  projectId: "web-jual",
  storageBucket: "web-jual.firebasestorage.app",
  messagingSenderId: "112426008960",
  appId: "1:112426008960:web:81de7e39cbce7acbe64165",
  measurementId: "G-3LNW9GF2XM",
  databaseURL: "https://web-jual-default-rtdb.firebaseio.com" // standard for most projects; adjust if different
};

// Initialize
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---- Helpers ----
function generateUserId() {
  return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getOrCreateUserId() {
  let uid = localStorage.getItem('yx_user_id');
  if (!uid) {
    uid = generateUserId();
    localStorage.setItem('yx_user_id', uid);
  }
  return uid;
}

function saveUserToFirebase(uid, extra = {}) {
  const userRef = db.ref('users/' + uid);
  userRef.once('value').then(snap => {
    if (!snap.exists()) {
      userRef.set({
        id: uid,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        purchases: {},
        ...extra
      });
    } else {
      userRef.update({ lastSeen: Date.now(), ...extra });
    }
  });
}

// Admin key validation (keys stored in Firebase under /adminKeys)
async function validateAdminKey(key) {
  const snap = await db.ref('adminKeys/' + key).once('value');
  if (!snap.exists()) return { valid: false, reason: 'Key tidak valid' };
  const data = snap.val();
  if (data.disabled) return { valid: false, reason: 'Key dinonaktifkan' };
  // Max 1 device
  const deviceId = getOrCreateDeviceId();
  if (data.activeDevice && data.activeDevice !== deviceId) {
    return { valid: false, reason: 'Key sudah dipakai di device lain (max 1 device)' };
  }
  // Claim device
  await db.ref('adminKeys/' + key).update({
    activeDevice: deviceId,
    lastLogin: Date.now()
  });
  return { valid: true, data };
}

function getOrCreateDeviceId() {
  let did = localStorage.getItem('yx_device_id');
  if (!did) {
    did = 'dev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
    localStorage.setItem('yx_device_id', did);
  }
  return did;
}

// Products
function getProductsRef() {
  return db.ref('products');
}

// Orders / Payment proofs
function getOrdersRef() {
  return db.ref('orders');
}

// Global status
function getGlobalStatusRef() {
  return db.ref('global/status');
}

// Admin session
function setAdminSession(key) {
  localStorage.setItem('yx_admin_key', key);
  localStorage.setItem('yx_admin_logged', '1');
}

function getAdminSession() {
  return {
    key: localStorage.getItem('yx_admin_key'),
    logged: localStorage.getItem('yx_admin_logged') === '1'
  };
}

function clearAdminSession() {
  localStorage.removeItem('yx_admin_key');
  localStorage.removeItem('yx_admin_logged');
}

// Pending payment local
function setPendingPayment(orderId, data) {
  localStorage.setItem('yx_pending_order', JSON.stringify({ orderId, ...data, ts: Date.now() }));
}

function getPendingPayment() {
  const raw = localStorage.getItem('yx_pending_order');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

function clearPendingPayment() {
  localStorage.removeItem('yx_pending_order');
}
