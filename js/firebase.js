// ============================================
// Firebase + Helpers - Yanz Xiters Store
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyCQCwme8gwAZgYY-lOZSmT6s0DBIWEFH2w",
  authDomain: "web-jual.firebaseapp.com",
  databaseURL: "https://web-jual-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "web-jual",
  storageBucket: "web-jual.firebasestorage.app",
  messagingSenderId: "112426008960",
  appId: "1:112426008960:web:16e27963af02c11ae64165",
  measurementId: "G-TXMGW7HGNY"
};

let db = null;
let firebaseReady = false;

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.database();
  firebaseReady = true;
} catch (e) {
  console.error("Firebase init error:", e);
  firebaseReady = false;
}

function ensureDb() {
  if (!firebaseReady || !db) {
    console.error("Firebase belum siap. Cek databaseURL di js/firebase.js dan Rules di Console.");
    throw new Error("Firebase belum siap. Cek databaseURL & Rules.");
  }
  return db;
}

// Helper aman untuk read tanpa crash UI
function safeRef(path) {
  try {
    return ensureDb().ref(path);
  } catch (e) {
    return null;
  }
}

function generateUserId() {
  return "user_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getOrCreateUserId() {
  let uid = localStorage.getItem("yx_user_id");
  if (!uid) {
    uid = generateUserId();
    localStorage.setItem("yx_user_id", uid);
  }
  return uid;
}

function getOrCreateDeviceId() {
  let did = localStorage.getItem("yx_device_id");
  if (!did) {
    did = "dev_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
    localStorage.setItem("yx_device_id", did);
  }
  return did;
}

function saveUserToFirebase(uid, extra) {
  try {
    const ref = ensureDb().ref("users/" + uid);
    ref.once("value").then(function (snap) {
      if (!snap.exists()) {
        ref.set(Object.assign({
          id: uid,
          createdAt: Date.now(),
          lastSeen: Date.now(),
          purchases: {}
        }, extra || {}));
      } else {
        ref.update(Object.assign({ lastSeen: Date.now() }, extra || {}));
      }
    }).catch(function (e) {
      console.warn("saveUser:", e.message);
    });
  } catch (e) {
    console.warn("saveUser skip:", e.message);
  }
}

async function validateAdminKey(key) {
  try {
    if (!key || typeof key !== "string") {
      return { valid: false, reason: "Key kosong" };
    }
    const snap = await ensureDb().ref("adminKeys/" + key).once("value");
    if (!snap.exists()) return { valid: false, reason: "Key tidak valid" };
    const data = snap.val();
    if (!data || data.disabled) return { valid: false, reason: "Key dinonaktifkan" };
    const deviceId = getOrCreateDeviceId();
    if (data.activeDevice && data.activeDevice !== deviceId) {
      return { valid: false, reason: "Key sudah dipakai di device lain (max 1 device)" };
    }
    await ensureDb().ref("adminKeys/" + key).update({
      activeDevice: deviceId,
      lastLogin: Date.now()
    });
    return { valid: true, data: data };
  } catch (err) {
    console.error("validateAdminKey:", err);
    return {
      valid: false,
      reason: "Gagal koneksi Firebase. Cek databaseURL & Rules (.read/.write true)."
    };
  }
}

function getProductsRef() {
  return ensureDb().ref("products");
}

function getOrdersRef() {
  return ensureDb().ref("orders");
}

function getGlobalStatusRef() {
  return ensureDb().ref("global/status");
}

function setAdminSession(key) {
  localStorage.setItem("yx_admin_key", key);
  localStorage.setItem("yx_admin_logged", "1");
}

function getAdminSession() {
  return {
    key: localStorage.getItem("yx_admin_key"),
    logged: localStorage.getItem("yx_admin_logged") === "1"
  };
}

function clearAdminSession() {
  localStorage.removeItem("yx_admin_key");
  localStorage.removeItem("yx_admin_logged");
}

function setPendingPayment(orderId, data) {
  localStorage.setItem("yx_pending_order", JSON.stringify(Object.assign({ orderId: orderId, ts: Date.now() }, data)));
}

function getPendingPayment() {
  try {
    var raw = localStorage.getItem("yx_pending_order");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearPendingPayment() {
  localStorage.removeItem("yx_pending_order");
}
