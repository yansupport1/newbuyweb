// ============================================
// Yanz Xiters Store - Main Application
// ============================================

const App = {
  userId: null,
  products: {},
  globalOn: false,
  currentView: 'home',
  startTime: Date.now(),

  init() {
    this.userId = getOrCreateUserId();
    saveUserToFirebase(this.userId);
    document.getElementById('userIdDisplay').textContent = this.userId;
    document.getElementById('year').textContent = new Date().getFullYear();

    this.setupDashboardVideo();
    this.listenGlobalStatus();
    this.listenProducts();
    this.checkPendingPayment();
    this.checkAdminSession();
    this.startRunningTime();
    this.bindNav();

    // Restore view if needed
    const hash = location.hash.replace('#', '');
    if (hash && document.getElementById('view-' + hash)) {
      this.showView(hash);
    }
  },

  setupDashboardVideo() {
    const box = document.getElementById('dashboardVideoBox');
    const url = (CONFIG && CONFIG.dashboardVideoUrl) || '';
    if (url && !url.includes('example-video')) {
      if (url.includes('youtube') || url.includes('youtu.be')) {
        const id = this.extractYoutubeId(url);
        box.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen allow="autoplay"></iframe>`;
      } else {
        box.innerHTML = `<video src="${url}" controls playsinline></video>`;
      }
    }
  },

  extractYoutubeId(url) {
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  },

  startRunningTime() {
    const el = document.getElementById('runningTime');
    setInterval(() => {
      const s = Math.floor((Date.now() - this.startTime) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, '0');
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const sec = String(s % 60).padStart(2, '0');
      el.textContent = `Web running: ${h}:${m}:${sec}`;
    }, 1000);
  },

  bindNav() {
    // already via onclick
  },

  showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + name);
    if (el) {
      el.classList.add('active');
      this.currentView = name;
      location.hash = name;
    }
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === name);
    });
    if (name === 'profile') this.loadUserPurchases();
    if (name === 'admin') this.checkAdminSession();
  },

  // ---------- Products ----------
  listenProducts() {
    getProductsRef().on('value', snap => {
      this.products = snap.val() || {};
      this.renderProducts();
    });
  },

  isDiscountActive(p) {
    if (!p.discount || p.discount <= 0) return false;
    if (!p.discountDays || p.discountDays <= 0) return true; // permanent while discount > 0
    if (!p.discountStart) return true;
    const end = p.discountStart + (p.discountDays * 24 * 60 * 60 * 1000);
    return Date.now() < end;
  },

  getFinalPrice(p) {
    if (this.isDiscountActive(p)) {
      return Math.round(p.price * (1 - p.discount / 100));
    }
    return p.price;
  },

  renderProducts() {
    const list = Object.entries(this.products).map(([id, p]) => ({ id, ...p }));
    // sort newest first
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const renderCard = (p, delay) => {
      const disc = this.isDiscountActive(p);
      const final = this.getFinalPrice(p);
      let videoHtml = '<div class="video-placeholder" style="height:100%;font-size:0.8rem">No video</div>';
      if (p.video) {
        if (p.video.includes('youtube') || p.video.includes('youtu.be')) {
          const id = this.extractYoutubeId(p.video);
          videoHtml = `<iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe>`;
        } else {
          videoHtml = `<video src="${p.video}" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>`;
        }
      }
      return `
        <div class="product-card glass" style="animation-delay:${delay}ms">
          <div class="product-video">${videoHtml}</div>
          <div class="product-body">
            <div class="product-name">${this.esc(p.name)}</div>
            <div class="product-desc">${this.esc(p.desc || '')}</div>
            <div class="price-row">
              ${disc ? `<span class="price-old">Rp ${this.fmt(p.price)}</span>` : ''}
              <span class="price">Rp ${this.fmt(final)}</span>
              ${disc ? `<span class="discount-badge">DISKON ${p.discount}%</span>` : ''}
            </div>
            <div class="product-actions">
              <button class="btn btn-primary" style="width:100%" onclick="App.buyProduct('${p.id}')">
                🛒 Buy Now
              </button>
            </div>
          </div>
        </div>`;
    };

    const homeEl = document.getElementById('homeProducts');
    const allEl = document.getElementById('allProducts');
    if (list.length === 0) {
      const empty = `<div class="empty"><div class="empty-icon">📦</div>Belum ada produk</div>`;
      homeEl.innerHTML = empty;
      allEl.innerHTML = empty;
      return;
    }
    homeEl.innerHTML = list.slice(0, 6).map((p, i) => renderCard(p, i * 80)).join('');
    allEl.innerHTML = list.map((p, i) => renderCard(p, i * 60)).join('');
  },

  buyProduct(id) {
    const p = this.products[id];
    if (!p) return this.toast('Produk tidak ditemukan', 'error');
    if (!this.globalOn) {
      return this.toast('Admin sedang OFF. Coba lagi nanti.', 'error');
    }
    const final = this.getFinalPrice(p);
    const orderId = 'ord_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

    const order = {
      id: orderId,
      productId: id,
      productName: p.name,
      price: final,
      originalPrice: p.price,
      discount: this.isDiscountActive(p) ? p.discount : 0,
      userId: this.userId,
      status: 'pending',
      buktiTf: '',
      downloadLink: p.download || '',
      createdAt: Date.now()
    };

    getOrdersRef().child(orderId).set(order).then(() => {
      setPendingPayment(orderId, {
        productName: p.name,
        price: final,
        productId: id
      });
      this.showPaymentPage(order);
    }).catch(err => {
      this.toast('Gagal membuat order: ' + err.message, 'error');
    });
  },

  showPaymentPage(order) {
    const info = document.getElementById('orderInfo');
    info.innerHTML = `
      <div><span>Order ID</span><span>${order.id}</span></div>
      <div><span>Produk</span><span>${this.esc(order.productName)}</span></div>
      <div><span>Total</span><span class="neon">Rp ${this.fmt(order.price)}</span></div>
      <div><span>User ID</span><span style="font-size:0.75rem">${order.userId}</span></div>
    `;
    const qr = (CONFIG && CONFIG.qrPaymentUrl) || '';
    const img = document.getElementById('qrImg');
    if (qr && !qr.includes('example-qr')) {
      img.src = qr;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
      document.getElementById('qrBox').innerHTML = '<p style="color:#333;padding:40px 20px">Set QR di config.js</p>';
    }
    document.getElementById('buktiTfUrl').value = '';
    document.getElementById('paymentStatus').innerHTML = '';
    this.showView('payment');
    this.listenOrderStatus(order.id);
  },

  checkPendingPayment() {
    const pending = getPendingPayment();
    if (pending && pending.orderId) {
      // re-attach listener
      getOrdersRef().child(pending.orderId).once('value').then(snap => {
        const o = snap.val();
        if (o && o.status === 'pending') {
          this.showPaymentPage(o);
        } else if (o && o.status === 'approved') {
          clearPendingPayment();
          this.toast('Pembayaran sudah diverifikasi! Cek profil.', 'success');
        } else {
          clearPendingPayment();
        }
      });
    }
  },

  listenOrderStatus(orderId) {
    getOrdersRef().child(orderId).on('value', snap => {
      const o = snap.val();
      if (!o) return;
      const el = document.getElementById('paymentStatus');
      if (o.status === 'approved') {
        el.innerHTML = `
          <div style="padding:16px;background:rgba(0,255,136,0.1);border-radius:12px;border:1px solid rgba(0,255,136,0.3)">
            <strong style="color:var(--success)">✅ Pembayaran Diverifikasi!</strong>
            <p style="margin-top:8px">Link download:</p>
            <a href="${this.esc(o.downloadLink)}" target="_blank" class="btn btn-success" style="margin-top:10px;display:inline-flex">
              📥 Download Produk
            </a>
          </div>`;
        clearPendingPayment();
        // save to user purchases
        db.ref('users/' + this.userId + '/purchases/' + orderId).set({
          productName: o.productName,
          price: o.price,
          downloadLink: o.downloadLink,
          at: Date.now()
        });
      } else if (o.status === 'rejected') {
        el.innerHTML = `
          <div style="padding:16px;background:rgba(255,50,50,0.1);border-radius:12px;border:1px solid rgba(255,50,50,0.3)">
            <strong style="color:var(--danger)">❌ Ditolak</strong>
            <p style="margin-top:6px;font-size:0.9rem">${this.esc(o.rejectReason || 'Bukti tidak valid')}</p>
          </div>`;
        clearPendingPayment();
      } else {
        el.innerHTML = `<p style="color:var(--warning)">⏳ Menunggu verifikasi admin...</p>`;
      }
    });
  },

  submitBuktiTf() {
    const url = document.getElementById('buktiTfUrl').value.trim();
    if (!url) return this.toast('Masukkan link bukti TF', 'error');
    const pending = getPendingPayment();
    if (!pending) return this.toast('Order tidak ditemukan', 'error');

    getOrdersRef().child(pending.orderId).update({
      buktiTf: url,
      buktiAt: Date.now()
    }).then(() => {
      this.toast('Bukti TF terkirim! Tunggu verifikasi.', 'success');
      document.getElementById('paymentStatus').innerHTML = '<p style="color:var(--warning)">⏳ Bukti terkirim, menunggu admin...</p>';
    }).catch(e => this.toast(e.message, 'error'));
  },

  // ---------- Global Status ----------
  listenGlobalStatus() {
    getGlobalStatusRef().on('value', snap => {
      this.globalOn = !!(snap.val() && snap.val().online);
      const el = document.getElementById('globalStatus');
      if (this.globalOn) {
        el.className = 'status-badge status-on';
        el.innerHTML = '<span class="dot"></span> ON';
      } else {
        el.className = 'status-badge status-off';
        el.innerHTML = '<span class="dot"></span> OFF';
      }
      // also update admin display
      const ad = document.getElementById('adminStatusDisplay');
      if (ad) {
        ad.className = this.globalOn ? 'status-badge status-on' : 'status-badge status-off';
        ad.innerHTML = this.globalOn ? '<span class="dot"></span> ON' : '<span class="dot"></span> OFF';
      }
    });
  },

  setGlobalStatus(on) {
    getGlobalStatusRef().set({ online: on, updatedAt: Date.now() })
      .then(() => this.toast(on ? 'Status ON' : 'Status OFF', 'success'))
      .catch(e => this.toast(e.message, 'error'));
  },

  // ---------- Admin ----------
  checkAdminSession() {
    const sess = getAdminSession();
    if (sess.logged && sess.key) {
      // re-validate silently
      validateAdminKey(sess.key).then(res => {
        if (res.valid) {
          this.showAdminPanel();
        } else {
          clearAdminSession();
          this.showAdminLogin();
        }
      });
    } else {
      this.showAdminLogin();
    }
  },

  showAdminLogin() {
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
  },

  showAdminPanel() {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    this.listenOrders();
    this.renderAdminProducts();
    this.listenKeys();
    this.listenUsers();
  },

  adminLogin() {
    const key = document.getElementById('adminKeyInput').value.trim();
    if (!key) return this.toast('Masukkan key', 'error');
    validateAdminKey(key).then(res => {
      if (res.valid) {
        setAdminSession(key);
        this.showAdminPanel();
        this.toast('Login berhasil', 'success');
      } else {
        this.toast(res.reason || 'Key invalid', 'error');
      }
    }).catch(e => this.toast(e.message, 'error'));
  },

  adminLogout() {
    const sess = getAdminSession();
    if (sess.key) {
      // release device
      db.ref('adminKeys/' + sess.key).update({ activeDevice: null });
    }
    clearAdminSession();
    this.showAdminLogin();
    this.toast('Logout', 'success');
  },

  showAdminSection(name) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById('admin-' + name).classList.add('active');
    document.querySelectorAll('.admin-menu-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.section === name);
    });
  },

  listenOrders() {
    getOrdersRef().orderByChild('createdAt').limitToLast(50).on('value', snap => {
      const orders = [];
      snap.forEach(c => {
        orders.push({ id: c.key, ...c.val() });
      });
      orders.reverse();
      const tbody = document.getElementById('ordersTableBody');
      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Belum ada order</td></tr>';
        return;
      }
      tbody.innerHTML = orders.map(o => `
        <tr>
          <td style="font-size:0.75rem">${o.id}</td>
          <td style="font-size:0.75rem">${o.userId || '-'}</td>
          <td>${this.esc(o.productName)}</td>
          <td>Rp ${this.fmt(o.price)}</td>
          <td>${o.buktiTf ? `<a href="${this.esc(o.buktiTf)}" target="_blank" style="color:var(--blood-neon)">Lihat</a>` : '-'}</td>
          <td><span class="badge badge-${o.status === 'approved' ? 'approved' : o.status === 'rejected' ? 'rejected' : 'pending'}">${o.status}</span></td>
          <td>
            ${o.status === 'pending' && o.buktiTf ? `
              <button class="btn btn-success btn-sm" onclick="App.verifyOrder('${o.id}', true)">Terima</button>
              <button class="btn btn-danger btn-sm" onclick="App.verifyOrder('${o.id}', false)">Tolak</button>
            ` : '-'}
          </td>
        </tr>
      `).join('');
    });
  },

  verifyOrder(orderId, approve) {
    const updates = {
      status: approve ? 'approved' : 'rejected',
      verifiedAt: Date.now()
    };
    if (!approve) {
      updates.rejectReason = prompt('Alasan tolak (opsional):') || 'Ditolak admin';
    }
    getOrdersRef().child(orderId).once('value').then(snap => {
      const o = snap.val();
      if (!o) return;
      if (approve) {
        updates.downloadLink = o.downloadLink || (this.products[o.productId] && this.products[o.productId].download) || '';
      }
      return getOrdersRef().child(orderId).update(updates);
    }).then(() => {
      this.toast(approve ? 'Order disetujui ✓' : 'Order ditolak', approve ? 'success' : 'error');
    }).catch(e => this.toast(e.message, 'error'));
  },

  // Products admin
  renderAdminProducts() {
    // re-use products listener already updates this.products
    const tbody = document.getElementById('adminProductsBody');
    const list = Object.entries(this.products).map(([id, p]) => ({ id, ...p }));
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">Kosong</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(p => `
      <tr>
        <td>${this.esc(p.name)}</td>
        <td>Rp ${this.fmt(p.price)}</td>
        <td>${p.discount ? p.discount + '%' : '-'}</td>
        <td>${p.video ? '✓' : '-'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="App.editProduct('${p.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="App.deleteProduct('${p.id}')">Hapus</button>
        </td>
      </tr>
    `).join('');
  },

  saveProduct() {
    const id = document.getElementById('editProductId').value || ('prod_' + Date.now().toString(36));
    const name = document.getElementById('pName').value.trim();
    const price = parseInt(document.getElementById('pPrice').value, 10);
    const desc = document.getElementById('pDesc').value.trim();
    const download = document.getElementById('pDownload').value.trim();
    const video = document.getElementById('pVideo').value.trim();
    const discount = parseInt(document.getElementById('pDiscount').value, 10) || 0;
    const discountDays = parseInt(document.getElementById('pDiscountDays').value, 10) || 0;

    if (!name || !price) return this.toast('Nama & harga wajib', 'error');

    const data = {
      name, price, desc, download, video, discount, discountDays,
      discountStart: discount > 0 ? Date.now() : null,
      updatedAt: Date.now()
    };
    if (!document.getElementById('editProductId').value) {
      data.createdAt = Date.now();
    }

    getProductsRef().child(id).update(data).then(() => {
      this.toast('Produk disimpan', 'success');
      this.resetProductForm();
      this.showAdminSection('products');
      this.renderAdminProducts();
    }).catch(e => this.toast(e.message, 'error'));
  },

  editProduct(id) {
    const p = this.products[id];
    if (!p) return;
    document.getElementById('editProductId').value = id;
    document.getElementById('pName').value = p.name || '';
    document.getElementById('pPrice').value = p.price || '';
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pDownload').value = p.download || '';
    document.getElementById('pVideo').value = p.video || '';
    document.getElementById('pDiscount').value = p.discount || 0;
    document.getElementById('pDiscountDays').value = p.discountDays || 0;
    this.showAdminSection('addproduct');
  },

  deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    getProductsRef().child(id).remove()
      .then(() => {
        this.toast('Dihapus', 'success');
        this.renderAdminProducts();
      })
      .catch(e => this.toast(e.message, 'error'));
  },

  resetProductForm() {
    document.getElementById('editProductId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pDesc').value = '';
    document.getElementById('pDownload').value = '';
    document.getElementById('pVideo').value = '';
    document.getElementById('pDiscount').value = '0';
    document.getElementById('pDiscountDays').value = '0';
  },

  // Keys
  createAdminKey() {
    const key = document.getElementById('newKeyInput').value.trim();
    if (!key) return this.toast('Isi key', 'error');
    db.ref('adminKeys/' + key).set({
      createdAt: Date.now(),
      activeDevice: null,
      disabled: false
    }).then(() => {
      this.toast('Key dibuat', 'success');
      document.getElementById('newKeyInput').value = '';
    }).catch(e => this.toast(e.message, 'error'));
  },

  listenKeys() {
    db.ref('adminKeys').on('value', snap => {
      const tbody = document.getElementById('keysTableBody');
      const keys = snap.val() || {};
      const rows = Object.entries(keys).map(([k, v]) => `
        <tr>
          <td style="font-family:monospace">${this.esc(k)}</td>
          <td style="font-size:0.75rem">${v.activeDevice || '-'}</td>
          <td>${v.lastLogin ? new Date(v.lastLogin).toLocaleString('id') : '-'}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="App.disableKey('${this.esc(k)}')">Disable</button>
          </td>
        </tr>
      `).join('');
      tbody.innerHTML = rows || '<tr><td colspan="4" class="empty">Belum ada key</td></tr>';
    });
  },

  disableKey(key) {
    if (!confirm('Disable key ini?')) return;
    db.ref('adminKeys/' + key).update({ disabled: true, activeDevice: null });
  },

  listenUsers() {
    db.ref('users').limitToLast(100).on('value', snap => {
      const tbody = document.getElementById('usersTableBody');
      const users = [];
      snap.forEach(c => users.push(c.val()));
      users.reverse();
      tbody.innerHTML = users.map(u => `
        <tr>
          <td style="font-size:0.8rem;font-family:monospace">${u.id}</td>
          <td>${u.createdAt ? new Date(u.createdAt).toLocaleString('id') : '-'}</td>
          <td>${u.lastSeen ? new Date(u.lastSeen).toLocaleString('id') : '-'}</td>
        </tr>
      `).join('') || '<tr><td colspan="3" class="empty">Kosong</td></tr>';
    });
  },

  loadUserPurchases() {
    db.ref('users/' + this.userId + '/purchases').once('value').then(snap => {
      const el = document.getElementById('userPurchases');
      const data = snap.val();
      if (!data) {
        el.innerHTML = '<div class="empty-icon">📭</div>Belum ada pembelian';
        return;
      }
      const list = Object.values(data);
      el.innerHTML = list.map(p => `
        <div style="text-align:left;padding:12px;margin-bottom:8px;background:rgba(0,0,0,0.25);border-radius:10px">
          <strong>${this.esc(p.productName)}</strong><br>
          <span style="font-size:0.85rem;color:var(--muted)">Rp ${this.fmt(p.price)}</span><br>
          ${p.downloadLink ? `<a href="${this.esc(p.downloadLink)}" target="_blank" style="color:var(--success);font-size:0.85rem">📥 Download</a>` : ''}
        </div>
      `).join('');
    });
  },

  // Utils
  esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  fmt(n) {
    return Number(n || 0).toLocaleString('id-ID');
  },

  toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());

// Keep admin products table in sync
const origRender = App.renderProducts.bind(App);
App.renderProducts = function () {
  origRender();
  if (document.getElementById('adminProductsBody')) {
    this.renderAdminProducts();
  }
};
