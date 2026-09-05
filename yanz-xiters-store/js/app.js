// ============================================
// Yanz Xiters Store - Main App (Final)
// ============================================

const App = {
  userId: null,
  products: {},
  globalOn: false,
  currentView: "home",
  startTime: Date.now(),
  _orderListener: null,

  init: function () {
    var self = this;
    try {
      this.userId = getOrCreateUserId();
      saveUserToFirebase(this.userId);
      var uidEl = document.getElementById("userIdDisplay");
      if (uidEl) uidEl.textContent = this.userId;
      var yearEl = document.getElementById("year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();

      this.setupDashboardVideo();
      this.listenGlobalStatus();
      this.listenProducts();
      this.checkPendingPayment();
      this.startRunningTime();

      var hash = (location.hash || "").replace("#", "");
      if (hash && document.getElementById("view-" + hash)) {
        this.showView(hash);
      }
    } catch (e) {
      console.error("Init error:", e);
      this.toast("Error init: " + e.message, "error");
    }
  },

  // ---------- Video & QR from config ----------
  setupDashboardVideo: function () {
    var box = document.getElementById("dashboardVideoBox");
    if (!box) return;
    var url = (typeof CONFIG !== "undefined" && CONFIG.dashboardVideoUrl) ? String(CONFIG.dashboardVideoUrl).trim() : "";
    if (!url) {
      box.innerHTML = '<div class="video-placeholder"><i class="fa-solid fa-play"></i><span>Set dashboardVideoUrl di config.js</span></div>';
      return;
    }
    if (url.indexOf("youtube.com") !== -1 || url.indexOf("youtu.be") !== -1) {
      var id = this.extractYoutubeId(url);
      if (id) {
        box.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>';
      } else {
        box.innerHTML = '<div class="video-placeholder"><i class="fa-solid fa-play"></i><span>Link YouTube tidak valid</span></div>';
      }
    } else {
      box.innerHTML = '<video src="' + this.escAttr(url) + '" controls playsinline preload="metadata"></video>';
    }
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
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.remove("active");
    });
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

  // ---------- Products ----------
  listenProducts: function () {
    var self = this;
    try {
      getProductsRef().on("value", function (snap) {
        self.products = snap.val() || {};
        self.renderProducts();
      }, function (err) {
        console.warn("products listen:", err);
        self.renderProducts();
      });
    } catch (e) {
      console.warn(e);
      this.renderProducts();
    }
  },

  isDiscountActive: function (p) {
    if (!p || !p.discount || p.discount <= 0) return false;
    if (!p.discountDays || p.discountDays <= 0) return true;
    if (!p.discountStart) return true;
    var end = p.discountStart + p.discountDays * 24 * 60 * 60 * 1000;
    return Date.now() < end;
  },

  getFinalPrice: function (p) {
    if (this.isDiscountActive(p)) {
      return Math.round(p.price * (1 - p.discount / 100));
    }
    return p.price;
  },

  renderProducts: function () {
    var self = this;
    var list = Object.keys(this.products).map(function (id) {
      return Object.assign({ id: id }, self.products[id]);
    });
    list.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    function renderCard(p, delay) {
      var disc = self.isDiscountActive(p);
      var final = self.getFinalPrice(p);
      var videoHtml = '<div class="placeholder"><i class="fa-solid fa-film"></i></div>';
      if (p.video) {
        if (String(p.video).indexOf("youtube") !== -1 || String(p.video).indexOf("youtu.be") !== -1) {
          var yid = self.extractYoutubeId(p.video);
          if (yid) videoHtml = '<iframe src="https://www.youtube.com/embed/' + yid + '" frameborder="0" allowfullscreen></iframe>';
        } else {
          videoHtml = '<video src="' + self.escAttr(p.video) + '" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>';
        }
      }
      return (
        '<div class="product-card glass" style="animation-delay:' + delay + 'ms">' +
          '<div class="product-video">' + videoHtml + "</div>" +
          '<div class="product-body">' +
            '<div class="product-name">' + self.esc(p.name) + "</div>" +
            '<div class="product-desc">' + self.esc(p.desc || "") + "</div>" +
            '<div class="price-row">' +
              (disc ? '<span class="price-old">Rp ' + self.fmt(p.price) + "</span>" : "") +
              '<span class="price">Rp ' + self.fmt(final) + "</span>" +
              (disc ? '<span class="discount-badge"><i class="fa-solid fa-tag"></i> ' + p.discount + "%</span>" : "") +
            "</div>" +
            '<div class="product-actions">' +
              '<button class="btn btn-primary btn-block" onclick="App.buyProduct(\'' + p.id + '\')">' +
                '<i class="fa-solid fa-cart-shopping"></i> Buy Now' +
              "</button>" +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }

    var homeEl = document.getElementById("homeProducts");
    var allEl = document.getElementById("allProducts");
    if (!list.length) {
      var empty = '<div class="empty"><i class="fa-solid fa-box-open"></i>Belum ada produk</div>';
      if (homeEl) homeEl.innerHTML = empty;
      if (allEl) allEl.innerHTML = empty;
      return;
    }
    if (homeEl) homeEl.innerHTML = list.slice(0, 6).map(function (p, i) { return renderCard(p, i * 70); }).join("");
    if (allEl) allEl.innerHTML = list.map(function (p, i) { return renderCard(p, i * 50); }).join("");
    this.renderAdminProducts();
  },

  buyProduct: function (id) {
    var p = this.products[id];
    if (!p) return this.toast("Produk tidak ditemukan", "error");
    if (!this.globalOn) return this.toast("Admin sedang OFF. Coba lagi nanti.", "error");

    var final = this.getFinalPrice(p);
    var orderId = "ord_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    var order = {
      id: orderId,
      productId: id,
      productName: p.name,
      price: final,
      originalPrice: p.price,
      discount: this.isDiscountActive(p) ? p.discount : 0,
      userId: this.userId,
      status: "pending",
      buktiTf: "",
      downloadLink: p.download || "",
      createdAt: Date.now()
    };

    var self = this;
    try {
      getOrdersRef().child(orderId).set(order).then(function () {
        setPendingPayment(orderId, {
          productName: p.name,
          price: final,
          productId: id
        });
        self.showPaymentPage(order);
      }).catch(function (err) {
        self.toast("Gagal membuat order: " + err.message, "error");
      });
    } catch (e) {
      this.toast(e.message, "error");
    }
  },

  showPaymentPage: function (order) {
    var info = document.getElementById("orderInfo");
    if (info) {
      info.innerHTML =
        "<div><span>Order ID</span><span>" + this.esc(order.id) + "</span></div>" +
        "<div><span>Produk</span><span>" + this.esc(order.productName) + "</span></div>" +
        '<div><span>Total</span><span class="neon">Rp ' + this.fmt(order.price) + "</span></div>" +
        "<div><span>User ID</span><span style=\"font-size:0.75rem\">" + this.esc(order.userId) + "</span></div>";
    }

    var qrUrl = (typeof CONFIG !== "undefined" && CONFIG.qrPaymentUrl) ? String(CONFIG.qrPaymentUrl).trim() : "";
    var qrBox = document.getElementById("qrBox");
    var qrImg = document.getElementById("qrImg");

    if (qrUrl) {
      if (qrImg) {
        qrImg.src = qrUrl;
        qrImg.style.display = "block";
        qrImg.onerror = function () {
          if (qrBox) qrBox.innerHTML = '<p style="color:#333;padding:30px 16px;font-size:0.9rem">QR gagal dimuat. Cek link di config.js</p>';
        };
      }
      if (qrBox && !qrImg) {
        qrBox.innerHTML = '<img src="' + this.escAttr(qrUrl) + '" alt="QR" style="width:210px;height:210px;object-fit:contain" />';
      }
    } else if (qrBox) {
      qrBox.innerHTML = '<p style="color:#333;padding:30px 16px;font-size:0.9rem">Set qrPaymentUrl di config.js</p>';
    }

    var buktiInput = document.getElementById("buktiTfUrl");
    if (buktiInput) buktiInput.value = "";
    var statusEl = document.getElementById("paymentStatus");
    if (statusEl) statusEl.innerHTML = "";

    this.showView("payment");
    this.listenOrderStatus(order.id);
  },

  checkPendingPayment: function () {
    var pending = getPendingPayment();
    if (!pending || !pending.orderId) return;
    var self = this;
    try {
      getOrdersRef().child(pending.orderId).once("value").then(function (snap) {
        var o = snap.val();
        if (o && o.status === "pending") {
          self.showPaymentPage(o);
        } else if (o && o.status === "approved") {
          clearPendingPayment();
          self.toast("Pembayaran sudah diverifikasi. Cek Profil.", "success");
        } else {
          clearPendingPayment();
        }
      }).catch(function () {
        clearPendingPayment();
      });
    } catch (e) {
      clearPendingPayment();
    }
  },

  listenOrderStatus: function (orderId) {
    var self = this;
    try {
      if (this._orderListener) {
        try { getOrdersRef().child(orderId).off("value", this._orderListener); } catch (e) {}
      }
      this._orderListener = function (snap) {
        var o = snap.val();
        if (!o) return;
        var el = document.getElementById("paymentStatus");
        if (!el) return;
        if (o.status === "approved") {
          el.innerHTML =
            '<div style="padding:18px;background:rgba(0,230,118,0.1);border-radius:14px;border:1px solid rgba(0,230,118,0.28)">' +
              '<strong style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> Pembayaran Diverifikasi</strong>' +
              '<p style="margin-top:10px;font-size:0.9rem">Link download:</p>' +
              '<a href="' + self.escAttr(o.downloadLink || "#") + '" target="_blank" class="btn btn-success" style="margin-top:12px;display:inline-flex">' +
                '<i class="fa-solid fa-download"></i> Download Produk' +
              "</a></div>";
          clearPendingPayment();
          try {
            ensureDb().ref("users/" + self.userId + "/purchases/" + orderId).set({
              productName: o.productName,
              price: o.price,
              downloadLink: o.downloadLink || "",
              at: Date.now()
            });
          } catch (e) {}
        } else if (o.status === "rejected") {
          el.innerHTML =
            '<div style="padding:18px;background:rgba(255,48,64,0.1);border-radius:14px;border:1px solid rgba(255,48,64,0.28)">' +
              '<strong style="color:var(--danger)"><i class="fa-solid fa-circle-xmark"></i> Ditolak</strong>' +
              '<p style="margin-top:8px;font-size:0.9rem">' + self.esc(o.rejectReason || "Bukti tidak valid") + "</p></div>";
          clearPendingPayment();
        } else {
          el.innerHTML = '<p style="color:var(--warning)"><i class="fa-solid fa-spinner fa-spin"></i> Menunggu verifikasi admin...</p>';
        }
      };
      getOrdersRef().child(orderId).on("value", this._orderListener);
    } catch (e) {
      console.warn(e);
    }
  },

  submitBuktiTf: function () {
    var input = document.getElementById("buktiTfUrl");
    var url = input ? String(input.value).trim() : "";
    if (!url) return this.toast("Masukkan link bukti TF", "error");
    var pending = getPendingPayment();
    if (!pending || !pending.orderId) return this.toast("Order tidak ditemukan", "error");
    var self = this;
    try {
      getOrdersRef().child(pending.orderId).update({
        buktiTf: url,
        buktiAt: Date.now()
      }).then(function () {
        self.toast("Bukti TF terkirim. Tunggu verifikasi.", "success");
        var el = document.getElementById("paymentStatus");
        if (el) el.innerHTML = '<p style="color:var(--warning)"><i class="fa-solid fa-spinner fa-spin"></i> Bukti terkirim, menunggu admin...</p>';
      }).catch(function (e) {
        self.toast(e.message, "error");
      });
    } catch (e) {
      this.toast(e.message, "error");
    }
  },

  // ---------- Global status ----------
  listenGlobalStatus: function () {
    var self = this;
    try {
      getGlobalStatusRef().on("value", function (snap) {
        var val = snap.val();
        self.globalOn = !!(val && val.online);
        var el = document.getElementById("globalStatus");
        if (el) {
          if (self.globalOn) {
            el.className = "status-badge status-on";
            el.innerHTML = '<span class="dot"></span> ON';
          } else {
            el.className = "status-badge status-off";
            el.innerHTML = '<span class="dot"></span> OFF';
          }
        }
        var ad = document.getElementById("adminStatusDisplay");
        if (ad) {
          ad.className = self.globalOn ? "status-badge status-on" : "status-badge status-off";
          ad.innerHTML = self.globalOn ? '<span class="dot"></span> ON' : '<span class="dot"></span> OFF';
        }
      });
    } catch (e) {
      console.warn("global status:", e);
    }
  },

  setGlobalStatus: function (on) {
    var self = this;
    try {
      getGlobalStatusRef().set({ online: !!on, updatedAt: Date.now() })
        .then(function () { self.toast(on ? "Status ON" : "Status OFF", "success"); })
        .catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) {
      this.toast(e.message, "error");
    }
  },

  // ---------- Admin ----------
  checkAdminSession: function () {
    this.showAdminLogin();
    var sess = getAdminSession();
    if (!sess.logged || !sess.key) return;

    var self = this;
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error("timeout")); }, 8000);
    });
    Promise.race([validateAdminKey(sess.key), timeout])
      .then(function (res) {
        if (res && res.valid) self.showAdminPanel();
        else {
          clearAdminSession();
          self.showAdminLogin();
        }
      })
      .catch(function () {
        clearAdminSession();
        self.showAdminLogin();
      });
  },

  showAdminLogin: function () {
    var login = document.getElementById("adminLogin");
    var panel = document.getElementById("adminPanel");
    if (login) {
      login.style.display = "flex";
      login.style.visibility = "visible";
      login.style.opacity = "1";
    }
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
  },

  adminLogin: function () {
    var input = document.getElementById("adminKeyInput");
    var key = input ? String(input.value).trim() : "";
    if (!key) return this.toast("Masukkan key", "error");

    var btn = document.querySelector("#adminLogin .btn-primary");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa...';
    }

    var self = this;
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("Koneksi timeout. Cek databaseURL & Rules Firebase."));
      }, 10000);
    });

    Promise.race([validateAdminKey(key), timeout])
      .then(function (res) {
        if (res && res.valid) {
          setAdminSession(key);
          self.showAdminPanel();
          self.toast("Login berhasil", "success");
        } else {
          self.toast((res && res.reason) || "Key tidak valid", "error");
        }
      })
      .catch(function (e) {
        self.toast(e.message || "Gagal koneksi Firebase", "error");
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Masuk';
        }
      });
  },

  adminLogout: function () {
    var sess = getAdminSession();
    if (sess.key) {
      try {
        ensureDb().ref("adminKeys/" + sess.key).update({ activeDevice: null });
      } catch (e) {}
    }
    clearAdminSession();
    this.showAdminLogin();
    this.toast("Logout", "success");
  },

  showAdminSection: function (name) {
    document.querySelectorAll(".admin-section").forEach(function (s) {
      s.classList.remove("active");
    });
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
        snap.forEach(function (c) {
          orders.push(Object.assign({ id: c.key }, c.val()));
        });
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
          }
          return (
            "<tr>" +
              '<td style="font-size:0.75rem">' + self.esc(o.id) + "</td>" +
              '<td style="font-size:0.75rem">' + self.esc(o.userId || "-") + "</td>" +
              "<td>" + self.esc(o.productName) + "</td>" +
              "<td>Rp " + self.fmt(o.price) + "</td>" +
              "<td>" + (o.buktiTf ? '<a href="' + self.escAttr(o.buktiTf) + '" target="_blank" style="color:var(--blood-neon)"><i class="fa-solid fa-eye"></i> Lihat</a>' : "-") + "</td>" +
              '<td><span class="badge badge-' + st + '">' + self.esc(o.status) + "</span></td>" +
              "<td>" + aksi + "</td>" +
            "</tr>"
          );
        }).join("");
      });
    } catch (e) {
      console.warn(e);
    }
  },

  verifyOrder: function (orderId, approve) {
    var self = this;
    var updates = {
      status: approve ? "approved" : "rejected",
      verifiedAt: Date.now()
    };
    if (!approve) {
      updates.rejectReason = prompt("Alasan tolak (opsional):") || "Ditolak admin";
    }
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
      }).catch(function (e) {
        self.toast(e.message, "error");
      });
    } catch (e) {
      this.toast(e.message, "error");
    }
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
        "<tr>" +
          "<td>" + self.esc(p.name) + "</td>" +
          "<td>Rp " + self.fmt(p.price) + "</td>" +
          "<td>" + (p.discount ? p.discount + "%" : "-") + "</td>" +
          "<td>" + (p.video ? "Ya" : "-") + "</td>" +
          "<td>" +
            '<button class="btn btn-ghost btn-sm" onclick="App.editProduct(\'' + p.id + '\')"><i class="fa-solid fa-pen"></i> Edit</button> ' +
            '<button class="btn btn-danger btn-sm" onclick="App.deleteProduct(\'' + p.id + '\')"><i class="fa-solid fa-trash"></i> Hapus</button>' +
          "</td>" +
        "</tr>"
      );
    }).join("");
  },

  saveProduct: function () {
    var idEl = document.getElementById("editProductId");
    var id = (idEl && idEl.value) ? idEl.value : ("prod_" + Date.now().toString(36));
    var name = (document.getElementById("pName") || {}).value || "";
    name = String(name).trim();
    var price = parseInt((document.getElementById("pPrice") || {}).value, 10);
    var desc = String((document.getElementById("pDesc") || {}).value || "").trim();
    var download = String((document.getElementById("pDownload") || {}).value || "").trim();
    var video = String((document.getElementById("pVideo") || {}).value || "").trim();
    var discount = parseInt((document.getElementById("pDiscount") || {}).value, 10) || 0;
    var discountDays = parseInt((document.getElementById("pDiscountDays") || {}).value, 10) || 0;

    if (!name || !price) return this.toast("Nama & harga wajib", "error");

    var data = {
      name: name,
      price: price,
      desc: desc,
      download: download,
      video: video,
      discount: discount,
      discountDays: discountDays,
      discountStart: discount > 0 ? Date.now() : null,
      updatedAt: Date.now()
    };
    if (!idEl || !idEl.value) data.createdAt = Date.now();

    var self = this;
    try {
      getProductsRef().child(id).update(data).then(function () {
        self.toast("Produk disimpan", "success");
        self.resetProductForm();
        self.showAdminSection("products");
      }).catch(function (e) {
        self.toast(e.message, "error");
      });
    } catch (e) {
      this.toast(e.message, "error");
    }
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
    this.showAdminSection("addproduct");
  },

  deleteProduct: function (id) {
    if (!confirm("Hapus produk ini?")) return;
    var self = this;
    try {
      getProductsRef().child(id).remove()
        .then(function () { self.toast("Dihapus", "success"); })
        .catch(function (e) { self.toast(e.message, "error"); });
    } catch (e) {
      this.toast(e.message, "error");
    }
  },

  resetProductForm: function () {
    var ids = ["editProductId", "pName", "pPrice", "pDesc", "pDownload", "pVideo"];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    var d = document.getElementById("pDiscount");
    if (d) d.value = "0";
    var dd = document.getElementById("pDiscountDays");
    if (dd) dd.value = "0";
  },

  createAdminKey: function () {
    var input = document.getElementById("newKeyInput");
    var key = input ? String(input.value).trim() : "";
    if (!key) return this.toast("Isi key", "error");
    var self = this;
    try {
      ensureDb().ref("adminKeys/" + key).set({
        createdAt: Date.now(),
        activeDevice: null,
        disabled: false
      }).then(function () {
        self.toast("Key dibuat", "success");
        if (input) input.value = "";
      }).catch(function (e) {
        self.toast(e.message, "error");
      });
    } catch (e) {
      this.toast(e.message, "error");
    }
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
          return (
            "<tr>" +
              '<td style="font-family:monospace">' + self.esc(k) + "</td>" +
              '<td style="font-size:0.75rem">' + self.esc(v.activeDevice || "-") + "</td>" +
              "<td>" + (v.lastLogin ? new Date(v.lastLogin).toLocaleString("id") : "-") + "</td>" +
              "<td>" +
                '<button class="btn btn-danger btn-sm" onclick="App.disableKey(\'' + self.esc(k) + '\')"><i class="fa-solid fa-ban"></i> Disable</button>' +
              "</td>" +
            "</tr>"
          );
        }).join("");
        tbody.innerHTML = rows || '<tr><td colspan="4" class="empty">Belum ada key</td></tr>';
      });
    } catch (e) {
      console.warn(e);
    }
  },

  disableKey: function (key) {
    if (!confirm("Disable key ini?")) return;
    try {
      ensureDb().ref("adminKeys/" + key).update({ disabled: true, activeDevice: null });
    } catch (e) {
      this.toast(e.message, "error");
    }
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
          return (
            "<tr>" +
              '<td style="font-size:0.8rem;font-family:monospace">' + self.esc(u.id) + "</td>" +
              "<td>" + (u.createdAt ? new Date(u.createdAt).toLocaleString("id") : "-") + "</td>" +
              "<td>" + (u.lastSeen ? new Date(u.lastSeen).toLocaleString("id") : "-") + "</td>" +
            "</tr>"
          );
        }).join("") || '<tr><td colspan="3" class="empty">Kosong</td></tr>';
      });
    } catch (e) {
      console.warn(e);
    }
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
        var list = Object.keys(data).map(function (k) { return data[k]; });
        el.innerHTML = list.map(function (p) {
          return (
            '<div style="text-align:left;padding:14px;margin-bottom:10px;background:rgba(0,0,0,0.28);border-radius:12px;border:1px solid rgba(255,50,70,0.1)">' +
              "<strong>" + self.esc(p.productName) + "</strong><br>" +
              '<span style="font-size:0.85rem;color:var(--muted)">Rp ' + self.fmt(p.price) + "</span><br>" +
              (p.downloadLink
                ? '<a href="' + self.escAttr(p.downloadLink) + '" target="_blank" style="color:var(--success);font-size:0.85rem;display:inline-flex;align-items:center;gap:6px;margin-top:6px"><i class="fa-solid fa-download"></i> Download</a>'
                : "") +
            "</div>"
          );
        }).join("");
      }).catch(function () {
        el.innerHTML = '<i class="fa-solid fa-inbox"></i> Belum ada pembelian';
      });
    } catch (e) {
      el.innerHTML = '<i class="fa-solid fa-inbox"></i> Belum ada pembelian';
    }
  },

  // ---------- Utils ----------
  esc: function (str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  escAttr: function (str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  fmt: function (n) {
    return Number(n || 0).toLocaleString("id-ID");
  },

  toast: function (msg, type) {
    type = type || "info";
    var c = document.getElementById("toastContainer");
    if (!c) return;
    var t = document.createElement("div");
    t.className = "toast " + (type === "success" ? "success" : type === "error" ? "error" : "");
    var icon = type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-exclamation" : "fa-circle-info";
    t.innerHTML = '<i class="fa-solid ' + icon + '"></i> <span>' + this.esc(msg) + "</span>";
    c.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4200);
  }
};

document.addEventListener("DOMContentLoaded", function () {
  App.init();
});
