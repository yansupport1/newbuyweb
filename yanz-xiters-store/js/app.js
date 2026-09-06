// Yanz Xiters Store - Main App (plain, no encrypt)
const App = {
  userId: null,
  products: {},
  globalOn: false,
  currentView: "home",
  startTime: 0,
  _qrTimerInterval: null,
  _buktiDataUrl: null,
  _currentOrderId: null,
  _logoTaps: 0,
  _logoTapTimer: null,
  _appliedPromo: null,

  init: function () {
    try {
      var home = document.getElementById("view-home");
      if (home) home.classList.add("active");

      var savedStart = localStorage.getItem("yx_run_start");
      if (savedStart) this.startTime = parseInt(savedStart, 10);
      else {
        this.startTime = Date.now();
        localStorage.setItem("yx_run_start", String(this.startTime));
      }

      this.userId = getOrCreateUserId();
      try { saveUserToFirebase(this.userId); } catch (e) {}

      var uidEl = document.getElementById("userIdDisplay");
      if (uidEl) uidEl.textContent = this.userId;
      var yearEl = document.getElementById("year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();

      this.setupDashboardVideo();
      this.startRunningTime();
      this.bindDropzone();

      try { this.listenGlobalStatus(); } catch (e) {}
      try { this.listenProducts(); } catch (e) { this.renderProducts(); }
      try { this.checkPendingPayment(); } catch (e) {}

      this.bindLogoAdmin();

      var hash = (location.hash || "").replace("#", "");
      // Jangan buka admin via hash sembarangan
      if (hash === "admin") hash = "home";
      if (hash && document.getElementById("view-" + hash)) this.showView(hash);
      else this.showView("home");
    } catch (e) {
      console.error(e);
      var h = document.getElementById("view-home");
      if (h) {
        document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
        h.classList.add("active");
      }
      try { this.setupDashboardVideo(); } catch (x) {}
    }
  },

  setupDashboardVideo: function () {
    var box = document.getElementById("dashboardVideoBox");
    if (!box) return;
    var url = (typeof CONFIG !== "undefined" && CONFIG.dashboardVideoUrl) ? String(CONFIG.dashboardVideoUrl).trim() : "";
    this._videoMuted = true;
    if (!url) {
      box.innerHTML = '<div class="video-placeholder"><i class="fa-solid fa-play"></i><span>Set dashboardVideoUrl di config.js</span></div>';
      return;
    }
    if (url.indexOf("youtube.com") !== -1 || url.indexOf("youtu.be") !== -1) {
      var id = this.extractYoutubeId(url);
      box.innerHTML = id
        ? '<iframe id="dashVideoEl" src="https://www.youtube.com/embed/' + id + '?autoplay=1&mute=1&loop=1&controls=0&playlist=' + id + '" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>'
        : '<div class="video-placeholder"><span>Link YouTube tidak valid</span></div>';
    } else {
      box.innerHTML = '<video id="dashVideoEl" src="' + this.escAttr(url) + '" autoplay muted loop playsinline></video>';
    }
    this._updateAudioIcon();
  },

  toggleVideoAudio: function () {
    var v = document.getElementById("dashVideoEl");
    if (!v) return this.toast("Video belum siap", "error");
    if (v.tagName === "VIDEO") {
      this._videoMuted = !this._videoMuted;
      v.muted = this._videoMuted;
      if (!this._videoMuted) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      }
      this._updateAudioIcon();
    } else {
      // YouTube iframe: reload with mute 0/1
      this._videoMuted = !this._videoMuted;
      var src = v.src || "";
      if (this._videoMuted) {
        src = src.replace("mute=0", "mute=1");
        if (src.indexOf("mute=") === -1) src += (src.indexOf("?") >= 0 ? "&" : "?") + "mute=1";
      } else {
        src = src.replace("mute=1", "mute=0");
      }
      v.src = src;
      this._updateAudioIcon();
    }
  },

  _updateAudioIcon: function () {
    var icon = document.getElementById("videoAudioIcon");
    if (!icon) return;
    icon.className = this._videoMuted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
  },

  extractYoutubeId: function (url) {
    var m = String(url).match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : "";
  },

  startRunningTime: function () {
    var el = document.getElementById("runningTime");
    if (!el) return;
    var self = this;
    setInterval(function () {
      var s = Math.floor((Date.now() - self.startTime) / 1000);
      var h = String(Math.floor(s / 3600)).padStart(2, "0");
      var m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      var sec = String(s % 60).padStart(2, "0");
      el.innerHTML = '<i class="fa-solid fa-clock"></i> <span>' + h + ":" + m + ":" + sec + "</span>";
    }, 1000);
  },

  showView: function (name) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    var el = document.getElementById("view-" + name);
    if (el) {
      el.classList.add("active");
      this.currentView = name;
      try { location.hash = name; } catch (e) {}
    }
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === name);
    });
    if (name === "profile") this.loadUserPurchases();
    if (name === "admin") {
      this.showAdminLogin();
      this.checkAdminSession();
    }
  },

  bindDropzone: function () {
    var self = this;
    var zone = document.getElementById("buktiDropzone");
    var input = document.getElementById("buktiFileInput");
    var clearBtn = document.getElementById("buktiClearBtn");
    if (!zone || !input) return;

    zone.addEventListener("click", function (e) {
      if (e.target.closest("#buktiClearBtn")) return;
      if (e.target.closest("#buktiPreviewImg")) {
        self.openLightbox(self._buktiDataUrl);
        return;
      }
      input.click();
    });
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", function () { zone.classList.remove("dragover"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) self.handleBuktiFile(e.dataTransfer.files[0]);
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) self.handleBuktiFile(input.files[0]);
    });
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.clearBuktiFile();
      });
    }
  },

  handleBuktiFile: function (file) {
    var self = this;
    if (!file || !file.type || file.type.indexOf("image/") !== 0) {
      return this.toast("File harus gambar (JPG/PNG/JPEG)", "error");
    }
    if (file.size > 3.5 * 1024 * 1024) return this.toast("Ukuran max 3MB", "error");

    var reader = new FileReader();
    reader.onload = function (ev) {
      self.compressImage(ev.target.result, function (dataUrl) {
        self._buktiDataUrl = dataUrl;
        var preview = document.getElementById("buktiPreview");
        var img = document.getElementById("buktiPreviewImg");
        var inner = document.getElementById("buktiDropInner");
        if (img) img.src = dataUrl;
        if (preview) preview.style.display = "block";
        if (inner) inner.style.display = "none";
        var btn = document.getElementById("btnSubmitBukti");
        if (btn) btn.disabled = false;
      });
    };
    reader.readAsDataURL(file);
  },

  compressImage: function (dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var maxW = 900, w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  },

  clearBuktiFile: function () {
    this._buktiDataUrl = null;
    var input = document.getElementById("buktiFileInput");
    if (input) input.value = "";
    var preview = document.getElementById("buktiPreview");
    var inner = document.getElementById("buktiDropInner");
    if (preview) preview.style.display = "none";
    if (inner) inner.style.display = "block";
    var btn = document.getElementById("btnSubmitBukti");
    if (btn) btn.disabled = true;
  },

  openLightbox: function (src) {
    if (!src) return;
    var lb = document.getElementById("lightbox");
    var img = document.getElementById("lightboxImg");
    if (img) img.src = src;
    if (lb) lb.classList.add("show");
  },

  closeLightbox: function (e) {
    if (e && e.target && e.target.id === "lightboxImg") return;
    var lb = document.getElementById("lightbox");
    if (lb) lb.classList.remove("show");
  },

  listenProducts: function () {
    var self = this;
    try {
      getProductsRef().on("value", function (snap) {
        self.products = snap.val() || {};
        self.renderProducts();
      });
    } catch (e) { this.renderProducts(); }
  },

  isDiscountActive: function (p) {
    if (!p || !p.discount || p.discount <= 0) return false;
    if (!p.discountDays || p.discountDays <= 0) return true;
    if (!p.discountStart) return true;
    return Date.now() < p.discountStart + p.discountDays * 86400000;
  },

  getFinalPrice: function (p) {
    if (this.isDiscountActive(p)) return Math.round(p.price * (1 - p.discount / 100));
    return p.price;
  },

  renderProducts: function () {
    var self = this;
    var list = Object.keys(this.products).map(function (id) {
      return Object.assign({ id: id }, self.products[id]);
    });
    list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    function card(p, delay) {
      var disc = self.isDiscountActive(p);
      var final = self.getFinalPrice(p);
      var videoHtml = '<div class="placeholder"><i class="fa-solid fa-film"></i></div>';
      if (p.video) {
        if (String(p.video).indexOf("youtube") !== -1 || String(p.video).indexOf("youtu.be") !== -1) {
          var yid = self.extractYoutubeId(p.video);
          if (yid) videoHtml = '<iframe src="https://www.youtube.com/embed/' + yid + '?autoplay=1&mute=1&loop=1&controls=0&playlist=' + yid + '" frameborder="0" allow="autoplay"></iframe>';
        } else {
          videoHtml = '<video src="' + self.escAttr(p.video) + '" autoplay muted loop playsinline></video>';
        }
      }
      return (
        '<div class="product-card glass" style="animation-delay:' + delay + 'ms">' +
          '<div class="product-video">' + videoHtml + "</div>" +
          '<div class="product-body">' +
            '<div class="product-name">' + self.esc(p.name) + "</div>" +
            '<div class="product-desc">' + self.esc(p.desc || "") + "</div>" +
            '<div class="price-row">' +
              (p.isFree ? '<span class="price">GRATIS</span>' : (
                (disc ? '<span class="price-old">Rp ' + self.fmt(p.price) + "</span>" : "") +
                '<span class="price">Rp ' + self.fmt(final) + "</span>"
              )) +
              (disc ? '<span class="discount-badge"><i class="fa-solid fa-tag"></i> ' + p.discount + "%</span>" : "") +
              (p.isFree ? '<span class="badge-free">GRATIS</span>' : "") +
            "</div>" +
            '<div class="product-actions">' +
              (p.isFree
                ? '<button class="btn btn-success btn-block" onclick="App.openFree(\'' + p.id + '\')"><i class="fa-solid fa-gift"></i> Ambil Gratis</button>'
                : '<button class="btn btn-primary btn-block" onclick="App.buyProduct(\'' + p.id + '\')"><i class="fa-solid fa-cart-shopping"></i> Buy Now</button>') +
            "</div></div></div>"
      );
    }

    var allEl = document.getElementById("allProducts");
    if (!list.length) {
      var empty = '<div class="empty"><i class="fa-solid fa-box-open"></i>Belum ada produk</div>';
      if (allEl) allEl.innerHTML = empty;
      return;
    }
    if (allEl) allEl.innerHTML = list.map(function (p, i) { return card(p, i * 40); }).join("");
    this.renderAdminProducts();
  },

  buyProduct: function (id) {
    var p = this.products[id];
    if (!p) return this.toast("Produk tidak ditemukan", "error");
    if (p.isFree) return this.openFree(id);
    if (!this.globalOn) return this.toast("Admin sedang OFF", "error");

    var final = this.getFinalPrice(p);
    var orderId = "ord_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    var order = {
      id: orderId,
      productId: id,
      productName: p.name,
      price: final,
      originalPrice: p.price,
      priceOriginal: final,
      discount: this.isDiscountActive(p) ? p.discount : 0,
      userId: this.userId,
      status: "pending",
      buktiTf: "",
      downloadLink: p.download || "",
      createdAt: Date.now(),
      qrExpireAt: Date.now() + ((CONFIG && CONFIG.qrExpireMinutes) || 15) * 60 * 1000
    };
    this._appliedPromo = null;


    var self = this;
    try {
      getOrdersRef().child(orderId).set(order).then(function () {
        setPendingPayment(orderId, {
          productName: p.name,
          price: final,
          priceOriginal: final,
          productId: id,
          createdAt: order.createdAt,
          qrExpireAt: order.qrExpireAt
        });
        self.clearBuktiFile();
        self.showPaymentPage(order);
      }).catch(function (err) {
        self.toast("Gagal order: " + err.message, "error");
      });
    } catch (e) {
      this.toast(e.message, "error");
    }
  },

  showPaymentPage: function (order) {
    this._currentOrderId = order.id;
    var info = document.getElementById("orderInfo");
    if (info) {
      info.innerHTML =
        "<div><span>Order ID</span><span>" + this.esc(order.id) + "</span></div>" +
        "<div><span>Produk</span><span>" + this.esc(order.productName) + "</span></div>" +
        '<div><span>Total</span><span class="neon">Rp ' + this.fmt(order.price) + "</span></div>" +
        "<div><span>User ID</span><span style=\"font-size:0.75rem\">" + this.esc(order.userId) + "</span></div>";
    }

    var qrUrl = (CONFIG && CONFIG.qrPaymentUrl) ? String(CONFIG.qrPaymentUrl).trim() : "";
    var qrImg = document.getElementById("qrImg");
    if (qrUrl && qrImg) {
      qrImg.src = qrUrl;
      qrImg.style.display = "block";
    }

    this.startQrTimer(order.qrExpireAt || (order.createdAt + 15 * 60 * 1000));
    this.showView("payment");
    this.listenOrderStatus(order.id);
  },

  startQrTimer: function (expireAt) {
    var el = document.getElementById("qrTimer");
    if (!el) return;
    if (this._qrTimerInterval) clearInterval(this._qrTimerInterval);
    var self = this;
    function tick() {
      var left = Math.max(0, expireAt - Date.now());
      if (left <= 0) {
        el.textContent = "QR kedaluwarsa";
        el.className = "qr-timer expired";
        clearInterval(self._qrTimerInterval);
        return;
      }
      var m = Math.floor(left / 60000);
      var s = Math.floor((left % 60000) / 1000);
      el.textContent = "QR berlaku " + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      el.className = "qr-timer active";
    }
    tick();
    this._qrTimerInterval = setInterval(tick, 1000);
  },

  downloadQr: function () {
    var url = (CONFIG && CONFIG.qrPaymentUrl) ? CONFIG.qrPaymentUrl : "";
    if (!url) return this.toast("QR belum di-set", "error");
    var a = document.createElement("a");
    a.href = url;
    a.download = "qr-pembayaran.jpg";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  checkPendingPayment: function () {
    var pending = getPendingPayment();
    var self = this;
    var approved = localStorage.getItem("yx_approved_order");
    if (approved) {
      try {
        var ao = JSON.parse(approved);
        if (ao && ao.orderId) {
          getOrdersRef().child(ao.orderId).once("value").then(function (snap) {
            var o = snap.val();
            if (o && o.status === "approved" && !o.userDone) self.showPaymentPage(o);
            else localStorage.removeItem("yx_approved_order");
          });
          return;
        }
      } catch (e) {}
    }
    if (!pending || !pending.orderId) return;
    try {
      getOrdersRef().child(pending.orderId).once("value").then(function (snap) {
        var o = snap.val();
        if (!o) { clearPendingPayment(); return; }
        if (o.status === "pending" || (o.status === "approved" && !o.userDone)) {
          self.showPaymentPage(o);
        } else clearPendingPayment();
      });
    } catch (e) {}
  },

  listenOrderStatus: function (orderId) {
    var self = this;
    try {
      getOrdersRef().child(orderId).off();
      getOrdersRef().child(orderId).on("value", function (snap) {
        var o = snap.val();
        if (!o) return;
        var el = document.getElementById("paymentStatus");
        if (!el) return;

        if (o.status === "approved") {
          localStorage.setItem("yx_approved_order", JSON.stringify({ orderId: orderId }));
          clearPendingPayment();
          el.innerHTML =
            '<div style="padding:18px;background:rgba(0,230,118,0.1);border-radius:14px;border:1px solid rgba(0,230,118,0.28)">' +
              '<strong style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> Pembayaran Diverifikasi</strong>' +
              '<p style="margin-top:10px;font-size:0.9rem">Link download:</p>' +
              '<a href="' + self.escAttr(o.downloadLink || "#") + '" target="_blank" class="btn btn-success" style="margin-top:12px;display:inline-flex">' +
                '<i class="fa-solid fa-download"></i> Download Produk</a>' +
              '<button class="btn btn-primary btn-block" style="margin-top:14px" onclick="App.finishOrder(\'' + orderId + '\')">' +
                '<i class="fa-solid fa-check-double"></i> Done</button>' +
              '<p style="margin-top:10px;font-size:0.75rem;color:var(--muted)">Tekan Done setelah download.</p></div>';
          try {
            ensureDb().ref("users/" + self.userId + "/purchases/" + orderId).set({
              productName: o.productName,
              price: o.price,
              downloadLink: o.downloadLink || "",
              at: Date.now()
            });
          } catch (e) {}
        } else if (o.status === "rejected") {
          clearPendingPayment();
          localStorage.removeItem("yx_approved_order");
          el.innerHTML =
            '<div style="padding:18px;background:rgba(255,48,64,0.1);border-radius:14px;border:1px solid rgba(255,48,64,0.28)">' +
              '<strong style="color:var(--danger)"><i class="fa-solid fa-circle-xmark"></i> Ditolak</strong>' +
              '<p style="margin-top:8px;font-size:0.9rem">' + self.esc(o.rejectReason || "Bukti tidak valid") + "</p></div>";
        } else {
          el.innerHTML = '<p style="color:var(--warning)"><i class="fa-solid fa-spinner fa-spin"></i> Menunggu verifikasi admin...</p>';
        }
      });
    } catch (e) {}
  },

  finishOrder: function (orderId) {
    try {
      getOrdersRef().child(orderId).update({ userDone: true, doneAt: Date.now() });
    } catch (e) {}
    localStorage.removeItem("yx_approved_order");
    clearPendingPayment();
    this.toast("Selesai. Terima kasih!", "success");
    this.showView("home");
  },

  submitBuktiTf: function () {
    if (!this._buktiDataUrl) return this.toast("Upload foto bukti TF dulu", "error");
    var pending = getPendingPayment();
    if (!pending || !pending.orderId) return this.toast("Order tidak ditemukan", "error");
    if (pending.qrExpireAt && Date.now() > pending.qrExpireAt) {
      return this.toast("QR sudah kedaluwarsa. Buat order baru.", "error");
    }

    var self = this;
    var btn = document.getElementById("btnSubmitBukti");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
    }
    try {
      getOrdersRef().child(pending.orderId).update({
        buktiTf: this._buktiDataUrl,
        buktiAt: Date.now(),
        buktiType: "image"
      }).then(function () {
        // tandai promo terpakai untuk user ini
        if (pending.promoCode) {
          try {
            var pref = ensureDb().ref("promos/" + pending.promoCode);
            pref.once("value").then(function (ps) {
              var pv = ps.val() || {};
              var usedBy = pv.usedBy || {};
              usedBy[self.userId] = Date.now();
              pref.update({ used: (pv.used || 0) + 1, usedBy: usedBy });
            });
          } catch (e) {}
        }
        self.toast("Bukti TF terkirim", "success");
        var el = document.getElementById("paymentStatus");
        if (el) el.innerHTML = '<p style="color:var(--warning)"><i class="fa-solid fa-spinner fa-spin"></i> Bukti terkirim, menunggu admin...</p>';
      }).catch(function (e) {
        self.toast(e.message || "Gagal kirim", "error");
      }).finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Bukti TF';
        }
      });
    } catch (e) {
      this.toast(e.message, "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Bukti TF';
      }
    }
  },

  listenGlobalStatus: function () {
    var self = this;
    try {
      getGlobalStatusRef().on("value", function (snap) {
        var val = snap.val();
        self.globalOn = !!(val && val.online);
        var el = document.getElementById("globalStatus");
        if (el) {
          el.className = self.globalOn ? "status-badge status-on" : "status-badge status-off";
          el.innerHTML = self.globalOn ? '<span class="dot"></span> ON' : '<span class="dot"></span> OFF';
        }
        var ad = document.getElementById("adminStatusDisplay");
        if (ad) {
          ad.className = self.globalOn ? "status-badge status-on" : "status-badge status-off";
          ad.innerHTML = self.globalOn ? '<span class="dot"></span> ON' : '<span class="dot"></span> OFF';
        }
      });
    } catch (e) {}
  },

  setGlobalStatus: function (on) {
    var self = this;
    try {
      getGlobalStatusRef().set({ online: !!on, updatedAt: Date.now() })
        .then(function () { self.toast(on ? "Status ON" : "Status OFF", "success"); })
        .catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) { this.toast(e.message, "error"); }
  },

  checkAdminSession: function () {
    this.showAdminLogin();
    var sess = getAdminSession();
    if (!sess.logged || !sess.key) return;
    var self = this;
    var timeout = new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error("timeout")); }, 8000);
    });
    Promise.race([validateAdminKey(sess.key), timeout])
      .then(function (res) {
        if (res && res.valid) self.showAdminPanel();
        else { clearAdminSession(); self.showAdminLogin(); }
      })
      .catch(function () { clearAdminSession(); self.showAdminLogin(); });
  },

  showAdminLogin: function () {
    var login = document.getElementById("adminLogin");
    var panel = document.getElementById("adminPanel");
    if (login) { login.style.display = "flex"; login.style.visibility = "visible"; }
    if (panel) panel.style.display = "none";
  },

  showAdminPanel: function () {
    var login = document.getElementById("adminLogin");
    var panel = document.getElementById("adminPanel");
    if (login) login.style.display = "none";
    if (panel) panel.style.display = "block";
    this.listenOrders();
    this.renderAdminProducts();
    this.listenKeys();
    this.listenUsers();
    this.listenPromos();
  },

  adminLogin: function () {
    var input = document.getElementById("adminKeyInput");
    var key = input ? String(input.value).trim() : "";
    if (!key) return this.toast("Masukkan key", "error");
    var btn = document.querySelector("#adminLogin .btn-primary");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa...'; }

    var self = this;
    var timeout = new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error("Timeout. Cek databaseURL & Rules.")); }, 10000);
    });
    Promise.race([validateAdminKey(key), timeout])
      .then(function (res) {
        if (res && res.valid) {
          setAdminSession(key);
          self.showAdminPanel();
          self.toast("Login berhasil", "success");
        } else self.toast((res && res.reason) || "Key tidak valid", "error");
      })
      .catch(function (e) { self.toast(e.message || "Gagal koneksi", "error"); })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Masuk'; }
      });
  },

  adminLogout: function () {
    var sess = getAdminSession();
    if (sess.key) {
      try { ensureDb().ref("adminKeys/" + sess.key).update({ activeDevice: null }); } catch (e) {}
    }
    clearAdminSession();
    this.showAdminLogin();
    this.toast("Logout", "success");
  },

  showAdminSection: function (name) {
    document.querySelectorAll(".admin-section").forEach(function (s) { s.classList.remove("active"); });
    var el = document.getElementById("admin-" + name);
    if (el) el.classList.add("active");
    document.querySelectorAll(".admin-menu-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-section") === name);
    });
  },

  listenOrders: function () {
    var self = this;
    try {
      getOrdersRef().orderByChild("createdAt").limitToLast(80).on("value", function (snap) {
        var orders = [];
        snap.forEach(function (c) { orders.push(Object.assign({ id: c.key }, c.val())); });
        orders.reverse();
        var tbody = document.getElementById("ordersTableBody");
        if (!tbody) return;
        if (!orders.length) {
          tbody.innerHTML = '<tr><td colspan="7" class="empty">Belum ada order</td></tr>';
          return;
        }
        tbody.innerHTML = orders.map(function (o) {
          var st = o.status === "approved" ? "approved" : o.status === "rejected" ? "rejected" : "pending";
          var aksi = "-";
          if (o.status === "pending" && o.buktiTf) {
            aksi =
              '<button class="btn btn-success btn-sm" onclick="App.verifyOrder(\'' + o.id + '\', true)"><i class="fa-solid fa-check"></i> Terima</button> ' +
              '<button class="btn btn-danger btn-sm" onclick="App.verifyOrder(\'' + o.id + '\', false)"><i class="fa-solid fa-xmark"></i> Tolak</button>';
          } else if (o.status === "approved") {
            aksi =
              '<button class="btn btn-ghost btn-sm" onclick="App.copyReceipt(\'' + o.id + '\')"><i class="fa-solid fa-copy"></i> Salin</button> ' +
              '<button class="btn btn-ghost btn-sm" onclick="App.printReceipt(\'' + o.id + '\')"><i class="fa-solid fa-print"></i> Cetak</button>';
          }
          var buktiCell = "-";
          if (o.buktiTf) {
            if (String(o.buktiTf).indexOf("data:image") === 0) {
              buktiCell = '<img src="' + o.buktiTf + '" alt="bukti" style="width:48px;height:48px;object-fit:cover;border-radius:8px;cursor:zoom-in" onclick="App.openLightbox(this.src)" />';
            } else {
              buktiCell = '<a href="' + self.escAttr(o.buktiTf) + '" target="_blank" style="color:var(--blood-neon)"><i class="fa-solid fa-eye"></i></a>';
            }
          }
          return (
            "<tr>" +
              '<td style="font-size:0.72rem">' + self.esc(o.id) + "</td>" +
              '<td style="font-size:0.72rem">' + self.esc(o.userId || "-") + "</td>" +
              "<td>" + self.esc(o.productName) + "</td>" +
              "<td>Rp " + self.fmt(o.price) + "</td>" +
              "<td>" + buktiCell + "</td>" +
              '<td><span class="badge badge-' + st + '">' + self.esc(o.status) + "</span></td>" +
              "<td>" + aksi + "</td></tr>"
          );
        }).join("");
      });
    } catch (e) {}
  },

  buildReceiptText: function (o) {
    var tgl = o.verifiedAt || o.createdAt || Date.now();
    var d = new Date(tgl);
    var tglStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    var jamStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return (
      "===== STRUK YANZ XITERS STORE =====\n" +
      "Nama Produk : " + (o.productName || "-") + "\n" +
      "Harga       : Rp " + this.fmt(o.price) + "\n" +
      "Order ID    : " + (o.id || "-") + "\n" +
      "User ID     : " + (o.userId || "-") + "\n" +
      "Tanggal     : " + tglStr + "\n" +
      "Jam         : " + jamStr + "\n" +
      "Status      : " + (o.status || "-") + "\n" +
      "=================================="
    );
  },

  copyReceipt: function (orderId) {
    var self = this;
    getOrdersRef().child(orderId).once("value").then(function (snap) {
      var o = snap.val();
      if (!o) return;
      o.id = orderId;
      var text = self.buildReceiptText(o);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          self.toast("Struk disalin", "success");
        }).catch(function () { self._fallbackCopy(text); });
      } else self._fallbackCopy(text);
    });
  },

  _fallbackCopy: function (text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); this.toast("Struk disalin", "success"); }
    catch (e) { this.toast("Gagal salin", "error"); }
    ta.remove();
  },

  printReceipt: function (orderId) {
    var self = this;
    getOrdersRef().child(orderId).once("value").then(function (snap) {
      var o = snap.val();
      if (!o) return;
      o.id = orderId;
      var text = self.buildReceiptText(o);
      var w = window.open("", "_blank", "width=420,height=560");
      if (!w) return self.toast("Popup diblokir", "error");
      w.document.write("<pre style=\"font-family:monospace;padding:24px;font-size:14px\">" + text.replace(/</g, "&lt;") + "</pre>");
      w.document.close();
      w.focus();
      w.print();
    });
  },

  verifyOrder: function (orderId, approve) {
    var self = this;
    var updates = {
      status: approve ? "approved" : "rejected",
      verifiedAt: Date.now()
    };
    if (!approve) updates.rejectReason = prompt("Alasan tolak (opsional):") || "Ditolak admin";
    try {
      getOrdersRef().child(orderId).once("value").then(function (snap) {
        var o = snap.val();
        if (!o) return;
        if (approve) {
          updates.downloadLink = o.downloadLink || (self.products[o.productId] && self.products[o.productId].download) || "";
        }
        return getOrdersRef().child(orderId).update(updates);
      }).then(function () {
        self.toast(approve ? "Order disetujui" : "Order ditolak", approve ? "success" : "error");
      }).catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) { this.toast(e.message, "error"); }
  },

  renderAdminProducts: function () {
    var self = this;
    var tbody = document.getElementById("adminProductsBody");
    if (!tbody) return;
    var list = Object.keys(this.products).map(function (id) {
      return Object.assign({ id: id }, self.products[id]);
    });
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">Kosong</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (p) {
      return (
        "<tr><td>" + self.esc(p.name) + "</td><td>Rp " + self.fmt(p.price) + "</td><td>" +
        (p.discount ? p.discount + "%" : "-") + "</td><td>" + (p.video ? "Ya" : "-") + "</td><td>" +
        '<button class="btn btn-ghost btn-sm" onclick="App.editProduct(\'' + p.id + '\')"><i class="fa-solid fa-pen"></i></button> ' +
        '<button class="btn btn-danger btn-sm" onclick="App.deleteProduct(\'' + p.id + '\')"><i class="fa-solid fa-trash"></i></button></td></tr>'
      );
    }).join("");
  },

  saveProduct: function () {
    var idEl = document.getElementById("editProductId");
    var id = (idEl && idEl.value) ? idEl.value : ("prod_" + Date.now().toString(36));
    var name = String((document.getElementById("pName") || {}).value || "").trim();
    var price = parseInt((document.getElementById("pPrice") || {}).value, 10);
    var desc = String((document.getElementById("pDesc") || {}).value || "").trim();
    var download = String((document.getElementById("pDownload") || {}).value || "").trim();
    var video = String((document.getElementById("pVideo") || {}).value || "").trim();
    var discount = parseInt((document.getElementById("pDiscount") || {}).value, 10) || 0;
    var discountDays = parseInt((document.getElementById("pDiscountDays") || {}).value, 10) || 0;
    var isFree = !!(document.getElementById("pIsFree") && document.getElementById("pIsFree").checked);
    if (!name) return this.toast("Nama wajib", "error");
    if (!isFree && !price) return this.toast("Harga wajib (atau centang GRATIS)", "error");
    if (isFree) price = 0;

    var data = {
      name: name, price: price || 0, desc: desc, download: download, video: video,
      isFree: isFree,
      discount: isFree ? 0 : discount, discountDays: isFree ? 0 : discountDays,
      discountStart: (!isFree && discount > 0) ? Date.now() : null,
      updatedAt: Date.now()
    };
    if (!idEl || !idEl.value) data.createdAt = Date.now();

    var self = this;
    try {
      getProductsRef().child(id).update(data).then(function () {
        self.toast("Produk disimpan", "success");
        self.resetProductForm();
        self.showAdminSection("products");
      }).catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) { this.toast(e.message, "error"); }
  },

  editProduct: function (id) {
    var p = this.products[id];
    if (!p) return;
    document.getElementById("editProductId").value = id;
    document.getElementById("pName").value = p.name || "";
    document.getElementById("pPrice").value = p.price || "";
    document.getElementById("pDesc").value = p.desc || "";
    document.getElementById("pDownload").value = p.download || "";
    document.getElementById("pVideo").value = p.video || "";
    document.getElementById("pDiscount").value = p.discount || 0;
    document.getElementById("pDiscountDays").value = p.discountDays || 0;
    var freeCb = document.getElementById("pIsFree");
    if (freeCb) freeCb.checked = !!p.isFree;
    this.showAdminSection("addproduct");
  },

  deleteProduct: function (id) {
    if (!confirm("Hapus produk?")) return;
    var self = this;
    try {
      getProductsRef().child(id).remove()
        .then(function () { self.toast("Dihapus", "success"); })
        .catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) { this.toast(e.message, "error"); }
  },

  resetProductForm: function () {
    ["editProductId", "pName", "pPrice", "pDesc", "pDownload", "pVideo"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    var d = document.getElementById("pDiscount"); if (d) d.value = "0";
    var dd = document.getElementById("pDiscountDays"); if (dd) dd.value = "0";
    var freeCb = document.getElementById("pIsFree"); if (freeCb) freeCb.checked = false;
  },

  createAdminKey: function () {
    var input = document.getElementById("newKeyInput");
    var key = input ? String(input.value).trim() : "";
    if (!key) return this.toast("Isi key", "error");
    var self = this;
    try {
      ensureDb().ref("adminKeys/" + key).set({
        createdAt: Date.now(), activeDevice: null, disabled: false
      }).then(function () {
        self.toast("Key dibuat", "success");
        if (input) input.value = "";
      }).catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) { this.toast(e.message, "error"); }
  },

  listenKeys: function () {
    var self = this;
    try {
      ensureDb().ref("adminKeys").on("value", function (snap) {
        var tbody = document.getElementById("keysTableBody");
        if (!tbody) return;
        var keys = snap.val() || {};
        var rows = Object.keys(keys).map(function (k) {
          var v = keys[k] || {};
          return "<tr><td style=\"font-family:monospace\">" + self.esc(k) + "</td>" +
            '<td style="font-size:0.72rem">' + self.esc(v.activeDevice || "-") + "</td>" +
            "<td>" + (v.lastLogin ? new Date(v.lastLogin).toLocaleString("id") : "-") + "</td>" +
            '<td><button class="btn btn-danger btn-sm" onclick="App.disableKey(\'' + self.esc(k) + '\')"><i class="fa-solid fa-ban"></i></button></td></tr>';
        }).join("");
        tbody.innerHTML = rows || '<tr><td colspan="4" class="empty">Belum ada key</td></tr>';
      });
    } catch (e) {}
  },

  disableKey: function (key) {
    if (!confirm("Disable key?")) return;
    try { ensureDb().ref("adminKeys/" + key).update({ disabled: true, activeDevice: null }); }
    catch (e) { this.toast(e.message, "error"); }
  },

  listenUsers: function () {
    var self = this;
    try {
      ensureDb().ref("users").limitToLast(100).on("value", function (snap) {
        var tbody = document.getElementById("usersTableBody");
        if (!tbody) return;
        var users = [];
        snap.forEach(function (c) { users.push(c.val()); });
        users.reverse();
        tbody.innerHTML = users.map(function (u) {
          return "<tr><td style=\"font-size:0.78rem;font-family:monospace\">" + self.esc(u.id) + "</td>" +
            "<td>" + (u.createdAt ? new Date(u.createdAt).toLocaleString("id") : "-") + "</td>" +
            "<td>" + (u.lastSeen ? new Date(u.lastSeen).toLocaleString("id") : "-") + "</td></tr>";
        }).join("") || '<tr><td colspan="3" class="empty">Kosong</td></tr>';
      });
    } catch (e) {}
  },

  loadUserPurchases: function () {
    var self = this;
    var el = document.getElementById("userPurchases");
    if (!el) return;
    try {
      ensureDb().ref("users/" + this.userId + "/purchases").once("value").then(function (snap) {
        var data = snap.val();
        if (!data) {
          el.innerHTML = '<i class="fa-solid fa-inbox"></i> Belum ada pembelian';
          return;
        }
        el.innerHTML = Object.keys(data).map(function (k) {
          var p = data[k];
          return '<div style="text-align:left;padding:14px;margin-bottom:10px;background:rgba(0,0,0,0.28);border-radius:12px">' +
            "<strong>" + self.esc(p.productName) + "</strong><br>" +
            '<span style="font-size:0.85rem;color:var(--muted)">Rp ' + self.fmt(p.price) + "</span><br>" +
            (p.downloadLink ? '<a href="' + self.escAttr(p.downloadLink) + '" target="_blank" style="color:var(--success);font-size:0.85rem"><i class="fa-solid fa-download"></i> Download</a>' : "") +
            "</div>";
        }).join("");
      }).catch(function () {
        el.innerHTML = '<i class="fa-solid fa-inbox"></i> Belum ada pembelian';
      });
    } catch (e) {
      el.innerHTML = '<i class="fa-solid fa-inbox"></i> Belum ada pembelian';
    }
  },


  bindLogoAdmin: function () {
    var self = this;
    var logo = document.getElementById("mainLogo");
    if (!logo) return;
    logo.addEventListener("click", function (e) {
      e.preventDefault();
      self._logoTaps = (self._logoTaps || 0) + 1;
      if (self._logoTapTimer) clearTimeout(self._logoTapTimer);
      self._logoTapTimer = setTimeout(function () {
        if (self._logoTaps >= 3) self.showView("admin");
        else self.showView("home");
        self._logoTaps = 0;
      }, 450);
    });
  },

  applyPromo: function () {
    var input = document.getElementById("promoCodeInput");
    var code = input ? String(input.value).trim().toUpperCase() : "";
    var msg = document.getElementById("promoMsg");
    if (!code) {
      this._appliedPromo = null;
      if (msg) { msg.textContent = ""; msg.style.color = "var(--muted)"; }
      return;
    }
    var self = this;
    var uid = this.userId;
    try {
      ensureDb().ref("promos/" + code).once("value").then(function (snap) {
        if (!snap.exists()) {
          self._appliedPromo = null;
          if (msg) { msg.textContent = "Kode tidak valid"; msg.style.color = "var(--danger)"; }
          return;
        }
        var p = snap.val();
        if (p.disabled) {
          self._appliedPromo = null;
          if (msg) { msg.textContent = "Kode nonaktif"; msg.style.color = "var(--danger)"; }
          return;
        }
        if (p.exp && Date.now() > p.exp) {
          self._appliedPromo = null;
          if (msg) { msg.textContent = "Kode kedaluwarsa"; msg.style.color = "var(--danger)"; }
          return;
        }
        if (p.limit && (p.used || 0) >= p.limit) {
          self._appliedPromo = null;
          if (msg) { msg.textContent = "Kuota kode habis"; msg.style.color = "var(--danger)"; }
          return;
        }
        var usedBy = p.usedBy || {};
        if (usedBy[uid]) {
          self._appliedPromo = null;
          if (msg) { msg.textContent = "Kamu sudah memakai kode ini"; msg.style.color = "var(--danger)"; }
          return;
        }
        self._appliedPromo = { code: code, percent: Number(p.percent) || 0 };
        if (msg) {
          msg.textContent = "Diskon " + p.percent + "% diterapkan";
          msg.style.color = "var(--success)";
        }
        self.toast("Kode diskon aktif: " + p.percent + "%", "success");
        self._refreshPaymentPrice();
      }).catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) { this.toast(e.message, "error"); }
  },

  _refreshPaymentPrice: function () {
    var pending = getPendingPayment();
    if (!pending || !this._appliedPromo) return;
    var base = pending.priceOriginal || pending.price;
    var pct = this._appliedPromo.percent;
    var final = Math.round(Number(base) * (1 - pct / 100));
    pending.price = final;
    pending.promoCode = this._appliedPromo.code;
    pending.promoPercent = pct;
    if (!pending.priceOriginal) pending.priceOriginal = base;
    setPendingPayment(pending.orderId, pending);
    try {
      getOrdersRef().child(pending.orderId).update({
        price: final,
        promoCode: this._appliedPromo.code,
        promoPercent: pct,
        priceOriginal: pending.priceOriginal || base
      });
    } catch (e) {}
    var self = this;
    getOrdersRef().child(pending.orderId).once("value").then(function (snap) {
      var o = snap.val();
      if (o) self.showPaymentPage(Object.assign({ id: pending.orderId }, o));
    });
  },

  savePromo: function () {
    var code = String((document.getElementById("promoCode") || {}).value || "").trim().toUpperCase();
    var percent = parseInt((document.getElementById("promoPercent") || {}).value, 10);
    var limit = parseInt((document.getElementById("promoLimit") || {}).value, 10) || 0;
    var expStr = (document.getElementById("promoExp") || {}).value || "";
    if (!code || !percent) return this.toast("Kode & % wajib", "error");
    var exp = expStr ? new Date(expStr + "T23:59:59").getTime() : null;
    var self = this;
    try {
      ensureDb().ref("promos/" + code).set({
        code: code, percent: percent, limit: limit, used: 0, usedBy: {},
        exp: exp, disabled: false, createdAt: Date.now()
      }).then(function () {
        self.toast("Kode dibuat", "success");
        var el;
        el = document.getElementById("promoCode"); if (el) el.value = "";
        el = document.getElementById("promoPercent"); if (el) el.value = "";
        el = document.getElementById("promoLimit"); if (el) el.value = "";
        el = document.getElementById("promoExp"); if (el) el.value = "";
      }).catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) { this.toast(e.message, "error"); }
  },

  listenPromos: function () {
    var self = this;
    try {
      ensureDb().ref("promos").on("value", function (snap) {
        var tbody = document.getElementById("promosTableBody");
        if (!tbody) return;
        var data = snap.val() || {};
        var rows = Object.keys(data).map(function (k) {
          var p = data[k] || {};
          var exp = p.exp ? new Date(p.exp).toLocaleDateString("id") : "-";
          return "<tr><td style=\"font-family:monospace\">" + self.esc(k) + "</td><td>" + (p.percent || 0) +
            "%</td><td>" + (p.used || 0) + "/" + (p.limit || "∞") + "</td><td>" + exp +
            '</td><td><button class="btn btn-danger btn-sm" onclick="App.deletePromo(\'' + self.esc(k) +
            '\')"><i class="fa-solid fa-trash"></i></button></td></tr>';
        }).join("");
        tbody.innerHTML = rows || '<tr><td colspan="5" class="empty">Belum ada kode</td></tr>';
      });
    } catch (e) {}
  },

  deletePromo: function (code) {
    if (!confirm("Hapus kode " + code + "?")) return;
    try { ensureDb().ref("promos/" + code).remove(); }
    catch (e) { this.toast(e.message, "error"); }
  },

  toggleAi: function () {
    var p = document.getElementById("aiAssistant");
    if (!p) return;
    p.style.display = (p.style.display === "none" || !p.style.display) ? "flex" : "none";
  },

  sendAi: function () {
    var input = document.getElementById("aiInput");
    var text = input ? String(input.value).trim() : "";
    if (!text) return;
    if (input) input.value = "";
    this._aiPush("user", text);
    var reply = this._aiReply(text);
    var self = this;
    setTimeout(function () { self._aiPush("bot", reply); }, 300);
  },

  _aiPush: function (role, text) {
    var box = document.getElementById("aiMessages");
    if (!box) return;
    var div = document.createElement("div");
    div.className = "ai-bubble " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  },

  _aiReply: function (q) {
    var t = q.toLowerCase();
    if (t.indexOf("bayar") !== -1 || t.indexOf("transfer") !== -1 || t.indexOf("qr") !== -1) {
      return "Cara bayar: pilih produk → Buy Now → scan QR → upload bukti TF. Boleh tutup halaman saat menunggu. QR berlaku 15 menit.";
    }
    if (t.indexOf("diskon") !== -1 || t.indexOf("kode") !== -1 || t.indexOf("promo") !== -1) {
      return "Di halaman pembayaran isi Kode Diskon lalu tekan Terapkan. Tiap user hanya 1x per kode.";
    }
    if (t.indexOf("download") !== -1 || t.indexOf("link") !== -1) {
      return "Setelah admin Terima, link download muncul di halaman pembayaran. Tekan Done setelah menyimpan link.";
    }
    if (t.indexOf("admin") !== -1 || t.indexOf("status") !== -1 || t.indexOf("off") !== -1) {
      return "Lihat badge ON/OFF di header. Jika OFF, pembelian sementara ditutup.";
    }
    if (t.indexOf("produk") !== -1 || t.indexOf("beli") !== -1) {
      var names = [];
      try {
        Object.keys(this.products || {}).forEach(function (id) {
          if (App.products[id] && App.products[id].name) names.push(App.products[id].name);
        });
      } catch (e) {}
      if (names.length) return "Produk: " + names.slice(0, 8).join(", ") + ". Buka tab Produk lalu Buy Now.";
      return "Belum ada produk. Coba lagi nanti.";
    }
    if (t.indexOf("halo") !== -1 || t.indexOf("hai") !== -1 || t.indexOf("help") !== -1 || t.indexOf("bantuan") !== -1) {
      return "Halo! Tanya saja soal bayar, QR, diskon, download, atau produk.";
    }
    if (t.indexOf("support") !== -1 || t.indexOf("kontak") !== -1) {
      return "Support: yansupport1@gmail.com · Telegram @yanzking122";
    }
    return "Saya bantu: cara bayar, kode diskon, status, produk, download, support. Tanya lebih spesifik ya.";
  },


  openFree: function (id) {
    var p = this.products[id];
    if (!p) return this.toast("Produk tidak ditemukan", "error");
    this._freeProductId = id;
    var nameEl = document.getElementById("freeProductName");
    if (nameEl) nameEl.textContent = p.name + " — ikuti langkah di bawah";
    var res = document.getElementById("freeResult");
    if (res) res.innerHTML = "";
    this.showView("free");
  },

  claimFree: function () {
    var id = this._freeProductId;
    var p = this.products[id];
    if (!p) return this.toast("Produk tidak ditemukan", "error");
    var link = p.download || "";
    var res = document.getElementById("freeResult");
    if (!link) {
      if (res) res.innerHTML = '<p style="color:var(--danger)">Link download belum di-set admin.</p>';
      return;
    }
    // simpan ke riwayat user
    var orderId = "free_" + Date.now().toString(36);
    try {
      ensureDb().ref("users/" + this.userId + "/purchases/" + orderId).set({
        productName: p.name,
        price: 0,
        downloadLink: link,
        free: true,
        at: Date.now()
      });
    } catch (e) {}
    if (res) {
      res.innerHTML =
        '<div style="padding:16px;background:rgba(0,230,118,0.1);border-radius:14px;border:1px solid rgba(0,230,118,0.28)">' +
          '<strong style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> Siap download</strong>' +
          '<a href="' + this.escAttr(link) + '" target="_blank" class="btn btn-success btn-block" style="margin-top:12px">' +
            '<i class="fa-solid fa-download"></i> Download</a></div>';
    }
    this.toast("Link download siap", "success");
  },

  esc: function (str) {
    if (str == null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
  escAttr: function (str) {
    if (str == null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
  },
  fmt: function (n) { return Number(n || 0).toLocaleString("id-ID"); },
  toast: function (msg, type) {
    type = type || "info";
    var c = document.getElementById("toastContainer");
    if (!c) return;
    var t = document.createElement("div");
    t.className = "toast " + (type === "success" ? "success" : type === "error" ? "error" : "");
    var icon = type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-exclamation" : "fa-circle-info";
    t.innerHTML = '<i class="fa-solid ' + icon + '"></i> <span>' + this.esc(msg) + "</span>";
    c.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
  }
};

document.addEventListener("DOMContentLoaded", function () { App.init(); });
