/* =========================================================
   THE NAIL BAR — interactions
   ========================================================= */
(function () {
  "use strict";

  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("navToggle");
  var fab = document.querySelector(".book-fab");
  var hero = document.getElementById("hero");

  /* ---- Sticky nav + mobile book FAB on scroll ---- */
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 30);

    // Show the mobile "Book Now" fab once the hero is out of view.
    // Subpages have no #hero, so fall back to a fixed scroll threshold.
    if (fab) {
      var threshold = hero ? hero.offsetHeight - 120 : 320;
      fab.classList.toggle("is-visible", y > threshold);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu toggle ---- */
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    // Close menu when a link is tapped
    nav.querySelectorAll(".nav__links a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (entry.isIntersecting) {
            // subtle stagger for grouped elements
            var delay = entry.target.dataset.delay || (i % 4) * 70;
            setTimeout(function () {
              entry.target.classList.add("is-in");
            }, delay);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---- Gentle parallax on hero blobs ---- */
  var blobs = document.querySelectorAll(".hero .blob");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion && blobs.length && window.matchMedia("(pointer:fine)").matches) {
    window.addEventListener("mousemove", function (e) {
      var cx = (e.clientX / window.innerWidth - 0.5);
      var cy = (e.clientY / window.innerHeight - 0.5);
      blobs.forEach(function (b, i) {
        var depth = (i + 1) * 14;
        b.style.transform = "translate(" + cx * depth + "px," + cy * depth + "px)";
      });
    }, { passive: true });
  }

  /* ---- Booking (StoreCal native triggers) ----
     Every booking CTA carries [data-storecal-book] (+ data-service on service
     cards), so embed.js itself binds the clicks, opens the modal, preselects the
     service, and relabels/hides the CTAs when booking is toggled off in StoreCal.
     We only add two light touches on top, without opening anything ourselves:
       1) close the mobile menu when a CTA is tapped,
       2) nudge a preselected-service open straight to step two. */
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-storecal-book]") : null;
    if (!el) return;
    // close the mobile menu if it's open (embed handles opening the modal)
    if (nav) nav.classList.remove("is-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    // A service is preselected → skip StoreCal's service step to land on step two.
    if (el.getAttribute("data-service")) advancePastServiceStep();
  });

  // StoreCal preselects the clicked service on its combined "Service + add-ons"
  // step. Since it's already chosen, auto-click that step's Continue button so the
  // client lands on step two (team / date & time) instead of re-picking.
  function advancePastServiceStep() {
    var tries = 0;
    var timer = setInterval(function () {
      if (++tries > 60) { clearInterval(timer); return; } // give up after ~3s
      var label = document.querySelector(".sc__step");
      var cont = document.querySelector(".sc__btn");
      var onServiceStep = label && /service/i.test(label.textContent || "");
      if (onServiceStep && cont && !cont.disabled) {
        cont.click();
        clearInterval(timer);
      }
    }, 50);
  }

  /* ---- Brand StoreCal's widget to match the site ----
     data-accent (set on the embed script) recolors the widget pink; here we
     inject a stylesheet into its (open) shadow root so buttons become the site's
     gradient pills and the type matches (Fraunces headings / Manrope body).
     We also hide embed.js's auto-injected inline trigger — we book from our own
     CTAs — while leaving the .sc-overlay modal fully functional. */
  (function brandStoreCal() {
    var CSS = [
      ".sc{font-family:'Manrope',system-ui,-apple-system,sans-serif;border-radius:24px}",
      ".sc__shop,.sc__h{font-family:'Fraunces',Georgia,serif;font-weight:500;letter-spacing:-.01em}",
      ".sc-trigger,.sc__btn,.sc-callbtn{background:linear-gradient(135deg,#ff4f8b,#e85a8f);" +
        "border-radius:100px;font-weight:700;box-shadow:0 10px 30px -8px rgba(255,79,139,.55)}",
      ".sc-trigger:hover,.sc__btn:hover,.sc-callbtn:hover{filter:brightness(1.03);" +
        "box-shadow:0 16px 38px -10px rgba(255,79,139,.7)}",
      ".sc__close{border-radius:100px}",
      ".sc__opt,.sc__addon,.sc__input,.sc__cal-toggle{border-radius:14px}"
    ].join("");

    function apply() {
      var host = document.querySelector(".storecal-widget");
      if (!host || !host.shadowRoot) return false;
      var root = host.shadowRoot;
      if (!root.getElementById || !root.getElementById("sc-brand")) {
        var s = document.createElement("style");
        s.id = "sc-brand";
        s.textContent = CSS;
        root.appendChild(s); // appended after embed's own <style> so it wins
      }
      var t = root.querySelector(".sc-trigger");
      if (t) t.style.display = "none";
      return true;
    }
    if (!apply()) {
      var n = 0, id = setInterval(function () { if (apply() || ++n > 60) clearInterval(id); }, 50);
    }
  })();

  /* ---- Live gallery from StoreCal ----
     Home (#galleryHome) shows the 4 most recent; the gallery page (#galleryFull)
     shows all, and the masonry scales with however many images exist. Static
     markup stays as a fallback until StoreCal has uploads. */
  (function loadGallery() {
    var home = document.getElementById("galleryHome");
    var full = document.getElementById("galleryFull");
    var heroImg = document.getElementById("heroImg");

    // Keep the hero hidden (branded gradient frame showing) until the correct
    // image — the StoreCal cover, or the static fallback — is decoded, so we
    // never flash the placeholder before swapping in the cover.
    var heroShown = false;
    function revealHero(src, altText) {
      if (!heroImg || heroShown) return;
      heroShown = true;
      var show = function () { heroImg.classList.add("is-ready"); };
      if (src) {
        heroImg.classList.remove("is-missing");
        if (altText) heroImg.alt = String(altText);
        var pre = new Image();               // preload/decode before the swap
        pre.onload = function () {
          heroImg.src = src;
          if (heroImg.decode) heroImg.decode().then(show, show); else show();
        };
        pre.onerror = show;
        pre.src = src;
      } else if (heroImg.complete) { show(); }
      else { heroImg.onload = show; heroImg.onerror = show; }
    }

    if (!window.fetch) { revealHero(null); return; }
    if (!home && !full && !heroImg) return;

    var STORE = "sc_a1588f0b7afba3e678";
    var base = "http://localhost:5001";
    var embed = document.querySelector('script[src*="embed.js"]');
    if (embed && embed.src) { try { base = new URL(embed.src).origin; } catch (e) {} }
    var heroSafety = setTimeout(function () { revealHero(null); }, 2500);

    function toImg(it) { return typeof it === "string" ? { url: it } : (it || {}); }
    function url(it) {
      it = toImg(it);
      var u = it.url || it.src || it.image || it.imageUrl || it.path || it.thumbnail || "";
      if (u && u.charAt(0) === "/") u = base + u; // server-absolute path → API origin (leave data:/http/local as-is)
      return u;
    }
    function alt(it) {
      it = toImg(it);
      return String(it.caption || it.alt || it.title || "Nail set by The Nail Bar")
        .replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
    }
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function recentFirst(a, b) {
      a = toImg(a); b = toImg(b);
      var da = a.createdAt || a.date || a.uploadedAt || "";
      var db = b.createdAt || b.date || b.uploadedAt || "";
      if (da || db) return da < db ? 1 : da > db ? -1 : 0;   // newest first
      return (b.sortOrder || 0) - (a.sortOrder || 0);
    }
    function tiles(list) { return list.map(function (it) { return '<figure class="tile"><img src="' + url(it) + '" alt="' + alt(it) + '" loading="lazy" /></figure>'; }).join(""); }
    function shots(list) { return list.map(function (it) { return '<figure class="shot"><img src="' + url(it) + '" alt="' + alt(it) + '" loading="lazy" /></figure>'; }).join(""); }

    // Render the gallery page for a given collection, wiring the tab bar.
    function renderGalleryPage(collections, activeKey) {
      if (!full) return;
      var tabsEl = document.getElementById("galleryTabs");
      var active = collections.filter(function (c) { return c.key === activeKey; })[0] || collections[0];
      full.innerHTML = shots(active.images);
      if (!tabsEl) return;
      if (collections.length <= 1) { tabsEl.hidden = true; tabsEl.innerHTML = ""; return; } // store only → no tabs
      tabsEl.hidden = false;
      tabsEl.innerHTML = collections.map(function (c) {
        return '<button type="button" class="gallery__tab' + (c.key === active.key ? " is-active" : "") +
          '" data-tab="' + esc(c.key) + '">' + esc(c.label) + ' <span>' + c.images.length + '</span></button>';
      }).join("");
      Array.prototype.forEach.call(tabsEl.querySelectorAll(".gallery__tab"), function (btn) {
        btn.addEventListener("click", function () { renderGalleryPage(collections, btn.getAttribute("data-tab")); });
      });
    }

    // Local fallback images (shown only if the live data can't be reached).
    var LOCAL_SHOTS = ["images/nails-swirl.png", "images/nails-gold.png", "images/hero.png", "images/nails-gummy.png", "images/nails-blue.png"];
    var LOCAL_TILES = ["images/nails-gummy.png", "images/nails-gold.png", "images/nails-blue.png", "images/nails-swirl.png"];

    // 1) Cover-first: our own gallery fetch, fired immediately, sets the hero as
    //    soon as it returns — not gated behind shop-config / staff photos.
    var galleryReq = fetch(base + "/api/gallery?key=" + STORE)
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (items) { return Array.isArray(items) ? items : null; })
      .catch(function () { return null; });

    galleryReq.then(function (items) {
      clearTimeout(heroSafety);
      if (!items) { revealHero(null); return; }
      var cover = items.filter(function (it) { return it.cover; })[0];
      cover ? revealHero(url(cover), toImg(cover).caption) : revealHero(null);
    });

    // 2) Staff galleries from the data-sync payload (small: shop-config + staff photos).
    function staffReady() {
      return new Promise(function (resolve) {
        if (window.StoreCal && typeof window.StoreCal.ready === "function") {
          var done = false;
          window.StoreCal.ready(function (d) { if (!done) { done = true; resolve(d || {}); } });
          setTimeout(function () { if (!done) { done = true; resolve({}); } }, 6000);
        } else { resolve({}); }
      });
    }

    // 3) Render the grids once both store photos and staff groups are known.
    Promise.all([galleryReq, (home || full) ? staffReady() : Promise.resolve({})]).then(function (res) {
      var items = res[0], data = res[1] || {};
      var store = (items || []).filter(function (it) { return !it.cover; }).sort(recentFirst);

      var groups = [];
      (data.providers || []).forEach(function (p) {
        var id = p._id || p.id;
        var photos = (window.StoreCal && StoreCal.staffGallery) ? StoreCal.staffGallery(id) : ((data.staffGallery || {})[id] || []);
        if (photos && photos.length) groups.push({ name: p.name || "Staff", images: photos.slice() });
      });

      // Home preview: 4 most recent store images (local fallback only if fetch failed).
      if (home) {
        home.innerHTML = store.length ? tiles(store.slice(0, 4)) : (items === null ? tiles(LOCAL_TILES) : "");
        home.removeAttribute("aria-busy");
      }

      // Gallery page: tabs only when a staff member has a gallery — no "Store" tab.
      if (full) {
        var tabsEl = document.getElementById("galleryTabs");
        if (!groups.length) {
          if (tabsEl) { tabsEl.hidden = true; tabsEl.innerHTML = ""; }
          full.innerHTML = store.length ? shots(store) : (items === null ? shots(LOCAL_SHOTS) : "");
        } else {
          var all = store.slice();
          groups.forEach(function (g) { all = all.concat(g.images); }); // store first, then staff
          var collections = [{ key: "all", label: "All", images: all }];
          groups.forEach(function (g) { collections.push({ key: "staff:" + g.name, label: g.name, images: g.images }); });
          renderGalleryPage(collections, "all");
        }
        full.removeAttribute("aria-busy");
      }
    });
  })();

  /* ---- Live service menu from StoreCal ---- */
  (function loadServices() {
    var grid = document.getElementById("servicesGrid");
    if (!grid || !window.fetch) return;

    var STORE = "sc_a1588f0b7afba3e678";
    // Derive the API base from the embed script's own src so it follows the
    // production domain automatically; fall back to localhost for dev.
    var base = "http://localhost:5001";
    var embed = document.querySelector('script[src*="embed.js"]');
    if (embed && embed.src) { try { base = new URL(embed.src).origin; } catch (e) {} }

    var FEATURE = "Gel-X Extensions"; // one dark "signature" card for visual rhythm

    function esc(t) {
      return String(t == null ? "" : t).replace(/[&<>]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
      });
    }
    function cardHTML(s) {
      var feature = s.name === FEATURE ? " card--feature" : "";
      var time = s.durationMin ? '<span class="card__time">' + s.durationMin + " min</span>" : "";
      return '<article class="card' + feature + '">' +
          '<div class="card__glow"></div>' +
          '<h3 class="card__title">' + esc(s.name) + "</h3>" +
          '<p class="card__desc">' + esc(s.description) + "</p>" +
          '<div class="card__foot"><span class="card__price">' + esc(s.price) + "</span>" + time + "</div>" +
          '<button type="button" class="card__book" data-storecal-book data-service="' + esc(s.name) + '">Book →</button>' +
        "</article>";
    }
    // Fallback shown only if the menu can't be fetched.
    var FALLBACK = [
      { name: "Gel Manicure", description: "Long-lasting gel polish, chip-free for up to two weeks.", price: "$40", durationMin: 45 },
      { name: "Gel-X Extensions", description: "Soft gel tips for a natural, lightweight look.", price: "$80", durationMin: 90 },
      { name: "Deluxe Spa Pedicure", description: "Extended massage, mask, and hot towels.", price: "$60", durationMin: 60 }
    ];

    var filled = false;
    function render(list) {
      if (filled) return;
      filled = true;
      grid.innerHTML = list.map(cardHTML).join("");
      grid.removeAttribute("aria-busy");
    }

    var t = setTimeout(function () { render(FALLBACK); }, 8000); // don't skeleton forever
    fetch(base + "/api/services?key=" + STORE)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (services) {
        clearTimeout(t);
        if (Array.isArray(services) && services.length) {
          services.sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
          render(services);
        } else { render(FALLBACK); }
      })
      .catch(function (err) {
        clearTimeout(t); render(FALLBACK);
        if (window.console) console.warn("StoreCal services fetch failed:", err);
      });
  })();

  /* ---- Team from StoreCal (shop-config → providers) ---- */
  (function loadStaff() {
    var grid = document.getElementById("staffGrid");
    if (!grid || !window.fetch) return;

    var STORE = "sc_a1588f0b7afba3e678";
    var base = "http://localhost:5001";
    var embed = document.querySelector('script[src*="embed.js"]');
    if (embed && embed.src) { try { base = new URL(embed.src).origin; } catch (e) {} }

    function esc(t) {
      return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
    function initials(n) {
      return String(n || "").trim().split(/\s+/).slice(0, 2)
        .map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "✦";
    }
    function staffHTML(p) {
      var photo = p.photo ? ' style="background-image:url(' + esc(p.photo) + ')"' : "";
      var bio = p.bio ? '<p class="staff__bio">' + esc(p.bio) + "</p>" : "";
      return '<article class="staff">' +
          '<div class="staff__photo"' + photo + ">" + (p.photo ? "" : initials(p.name)) + "</div>" +
          '<h3 class="staff__name">' + esc(p.name) + "</h3>" + bio +
        "</article>";
    }
    var FALLBACK = [{ name: "The Nail Bar", bio: "Your Mount Vernon nail artist — meticulous sets, one client at a time." }];

    var filled = false;
    function render(list) {
      if (filled) return;
      filled = true;
      grid.innerHTML = list.map(staffHTML).join("");
      grid.removeAttribute("aria-busy");
    }

    var t = setTimeout(function () { render(FALLBACK); }, 8000);
    fetch(base + "/api/shop-config?key=" + STORE)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (cfg) {
        clearTimeout(t);
        var team = cfg && cfg.providers;
        render(Array.isArray(team) && team.length ? team : FALLBACK);
      })
      .catch(function (err) {
        clearTimeout(t); render(FALLBACK);
        if (window.console) console.warn("StoreCal staff fetch failed:", err);
      });
  })();

  /* ---- Footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
