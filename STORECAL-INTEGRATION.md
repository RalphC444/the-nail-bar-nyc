# StoreCal Integration — Replication Guide

Everything wired into **The Nail Bar** site, written so you can replicate it on
**Pamper 4 Paws** (or any StoreCal store). Copy the patterns; swap the
**brand-specific bits** (marked 🎨) — store key, accent color, fonts, copy.

> **Model:** the site is static HTML/CSS/JS. StoreCal drives all the dynamic bits
> (booking, services menu, gallery, hero cover) so the shop owner controls them
> from the StoreCal dashboard — the site code never changes for content updates.

---

## 0. The one-time embed

Drop this once near the end of `<body>` on **every page**:

```html
<!-- 🎨 swap data-store + data-accent -->
<script src="https://YOUR-DOMAIN/embed.js"
        data-store="sc_YOUR_STORE_KEY"
        data-accent="#2563eb"></script>
<script src="script.js"></script>
```

- `data-store` — your shop's **public key**.
- `data-accent` — 🎨 your brand color. This *alone* recolors the whole booking
  widget (buttons, calendar, selected states, time slots). For Pamper 4 Paws use
  its navy/tan; for The Nail Bar it's `#ff4f8b`.
- In dev, point `src` at `http://localhost:5001/embed.js`. In prod, use the
  deployed domain — the API base is inferred from this script's `src`, so nothing
  else changes.

### Content sync (services / gallery / staff)

For the *content* (not booking), also load the data-sync companion once:

```html
<!-- 🎨 same store key -->
<script src="https://storecal.onrender.com/storecal-data.js" data-store="sc_YOUR_STORE_KEY"></script>
```

It fetches `/api/shop-config` (+ `/api/gallery` and `/api/gallery?scope=staff` when
the page has a gallery) and exposes a global:
- `StoreCal.ready(fn)` → `fn(data)` with `data.services`, `data.providers`,
  `data.gallery` (store photos), `data.cover`, `data.staffGallery` (keyed by
  provider id), `data.showStaffGalleries`.
- `StoreCal.staffGallery(providerId)` → that staffer's `[{url, caption}]` (`[]` if
  none / disabled).
- **Load triggers** (attribute form — loads the data without auto-rendering, so
  your custom UI stays in charge): `data-storecal-gallery` (store + cover),
  `data-storecal-staff-gallery` (per-staff photos).

The embed exposes:
- **`data-storecal-book`** attribute → any element becomes a booking trigger.
- **`data-service="Name or _id"`** → opens preselected to that service.
- Global JS API: `StoreCalWidget.open()`, `StoreCalWidget.book("Service")`.
- Public REST (GET, `?key=`): `/api/shop-config`, `/api/services`, `/api/addons`,
  `/api/gallery`, `/api/availability/...`. POST `/api/appointments` to book.

---

## 1. Every booking CTA = native trigger

Put `data-storecal-book` on **every** button/link that should book. Keep your own
CSS classes for styling — the attribute only controls behavior.

```html
<!-- generic "Book" CTA (opens at the service step) -->
<a href="#book" class="btn btn--primary" data-storecal-book>Book Now</a>

<!-- service-specific CTA (opens preselected to that service) -->
<button class="card__book" data-storecal-book data-service="Full Groom">Book →</button>
```

Why native (vs. calling `StoreCalWidget.open()` yourself):
- The embed binds clicks via a **delegated** listener, so dynamically-rendered
  cards work automatically.
- When the owner **toggles booking off** in StoreCal, the embed **relabels** these
  CTAs to "📞 Call <phone>" (and hides them only if no phone is set — see §6).
- It's controlled entirely from the StoreCal dashboard.

**Hide the embed's auto-injected default button** and add two light touches in
`script.js` (menu close + jump to step two). See §3.

---

## 2. Live services menu from the API

Render the service cards from `/api/services` so the menu always matches StoreCal.
Keep a few **static fallback cards** in the HTML for when the API is unreachable.

**HTML** — a container with an id, plus fallback cards:

```html
<div class="services__grid" id="servicesGrid" data-loading="true">
  <!-- static fallback cards here; replaced on a successful fetch -->
</div>
```

**JS** (in `script.js`):

```js
(function loadServices() {
  var grid = document.getElementById("servicesGrid");
  if (!grid || !window.fetch) return;

  var STORE = "sc_YOUR_STORE_KEY";               // 🎨
  var base = "http://localhost:5001";
  var embed = document.querySelector('script[src*="embed.js"]');
  if (embed && embed.src) { try { base = new URL(embed.src).origin; } catch (e) {} }

  var FEATURE = "Full Groom"; // 🎨 one card gets the dark "signature" treatment
  function esc(t){ return String(t==null?"":t).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }

  fetch(base + "/api/services?key=" + STORE)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (services) {
      if (!Array.isArray(services) || !services.length) return; // keep fallback
      services.sort(function (a, b) { return (a.sortOrder||0) - (b.sortOrder||0); });
      grid.innerHTML = services.map(function (s) {
        var feature = s.name === FEATURE ? " card--feature" : "";
        var time = s.durationMin ? '<span class="card__time">'+s.durationMin+' min</span>' : "";
        return '<article class="card'+feature+'">' +
            '<h3 class="card__title">'+esc(s.name)+'</h3>' +
            '<p class="card__desc">'+esc(s.description)+'</p>' +
            '<div class="card__foot"><span class="card__price">'+esc(s.price)+'</span>'+time+'</div>' +
            '<button type="button" class="card__book" data-storecal-book data-service="'+esc(s.name)+'">Book →</button>' +
          '</article>';
      }).join("");
      grid.removeAttribute("data-loading");
    })
    .catch(function (err) { if (window.console) console.warn("services fetch failed:", err); });
})();
```

Service object shape: `{ _id, name, description, durationMin, price, sortOrder }`.
Whole-card click can book by giving `.card__book::after { position:absolute; inset:0 }`
(stretched-link trick) so the button covers the card.

---

## 3. Brand the widget + step-two nudge + hide default button

The widget renders in an **open Shadow DOM**. Inject a stylesheet into it to match
your buttons/fonts, and hide the auto-injected inline trigger (we book from our own
CTAs). Also nudge service-preselected opens to step two.

```js
// --- brand the widget + hide its default inline button ---
(function brandStoreCal() {
  var CSS = [
    ".sc{font-family:'Manrope',system-ui,-apple-system,sans-serif;border-radius:24px}",     // 🎨 body font
    ".sc__shop,.sc__h{font-family:'Fraunces',Georgia,serif;font-weight:500}",                 // 🎨 heading font
    ".sc-trigger,.sc__btn,.sc-callbtn{background:linear-gradient(135deg,#ff4f8b,#e85a8f);" +  // 🎨 button color
      "border-radius:100px;font-weight:700;box-shadow:0 10px 30px -8px rgba(255,79,139,.55)}",
    ".sc-trigger:hover,.sc__btn:hover,.sc-callbtn:hover{filter:brightness(1.03)}",
    ".sc__close{border-radius:100px}",
    ".sc__opt,.sc__addon,.sc__input,.sc__cal-toggle{border-radius:14px}"
  ].join("");
  function apply() {
    var host = document.querySelector(".storecal-widget");
    if (!host || !host.shadowRoot) return false;
    var root = host.shadowRoot;
    if (!root.getElementById || !root.getElementById("sc-brand")) {
      var s = document.createElement("style"); s.id = "sc-brand"; s.textContent = CSS;
      root.appendChild(s); // appended after embed's own <style> so it wins
    }
    var t = root.querySelector(".sc-trigger");
    if (t) t.style.display = "none";  // we use our own CTAs
    return true;
  }
  if (!apply()) { var n=0, id=setInterval(function(){ if(apply()||++n>60) clearInterval(id); },50); }
})();

// --- close mobile menu on any CTA + jump preselected-service opens to step two ---
document.addEventListener("click", function (e) {
  var el = e.target.closest ? e.target.closest("[data-storecal-book]") : null;
  if (!el) return;
  /* close your mobile menu here if open */
  if (el.getAttribute("data-service")) advancePastServiceStep();
});

// StoreCal keeps a preselected service on the combined "Service + add-ons" step
// when add-ons exist. Auto-click Continue so the client lands on step two.
function advancePastServiceStep() {
  var tries = 0;
  var timer = setInterval(function () {
    if (++tries > 60) { clearInterval(timer); return; }       // give up ~3s
    var label = document.querySelector(".sc__step");
    var cont = document.querySelector(".sc__btn");
    if (label && /service/i.test(label.textContent||"") && cont && !cont.disabled) {
      cont.click(); clearInterval(timer);
    }
  }, 50);
}
```

> Fonts referenced in the injected CSS must be loaded in the **main document**
> (e.g. via a Google Fonts `<link>`); document-scope `@font-face` is available
> inside shadow roots.

---

## 4. Live gallery + StoreCal-controlled hero cover

`/api/gallery` returns image items. Each has a **`cover`** flag: the cover image
drives the **hero**, the rest fill the **grid**. Item shape:
`{ _id, url, caption, cover }` (`url` may be a `data:` URI or a hosted URL).

**HTML:**

```html
<!-- hero image (home) -->
<img id="heroImg" class="hero__img" src="images/hero.jpg"
     alt="..." onerror="this.classList.add('is-missing')" />

<!-- home preview grid (shows 4 most recent) -->
<div class="gallery__grid" id="galleryHome"> <!-- static fallback tiles --> </div>

<!-- gallery page (shows all; masonry scales) -->
<div class="masonry" id="galleryFull"> <!-- static fallback shots --> </div>
```

**JS:**

```js
(function loadGallery() {
  var home = document.getElementById("galleryHome");
  var full = document.getElementById("galleryFull");
  var heroImg = document.getElementById("heroImg");

  // Hold the hero hidden (CSS: .hero__img{opacity:0} .hero__img.is-ready{opacity:1})
  // until the right image is decoded — no flash of the placeholder.
  var heroShown = false;
  function revealHero(src, altText) {
    if (!heroImg || heroShown) return; heroShown = true;
    var show = function(){ heroImg.classList.add("is-ready"); };
    if (src) {
      heroImg.classList.remove("is-missing");
      if (altText) heroImg.alt = String(altText);
      var pre = new Image();                       // preload/decode before swap
      pre.onload = function(){ heroImg.src = src; heroImg.decode ? heroImg.decode().then(show,show) : show(); };
      pre.onerror = show; pre.src = src;
    } else if (heroImg.complete) show();
    else { heroImg.onload = show; heroImg.onerror = show; }
  }
  if (!window.fetch) { revealHero(null); return; }
  if (!home && !full && !heroImg) return;

  var STORE = "sc_YOUR_STORE_KEY";                 // 🎨
  var base = "http://localhost:5001";
  var embed = document.querySelector('script[src*="embed.js"]');
  if (embed && embed.src) { try { base = new URL(embed.src).origin; } catch (e) {} }
  var heroSafety = setTimeout(function(){ revealHero(null); }, 2500); // never stay hidden

  function url(it){ var u=it.url||it.src||it.image||""; if(u&&!/^https?:\/\//i.test(u)&&!/^data:/i.test(u)) u=base+(u.charAt(0)==="/"?"":"/")+u; return u; }
  function alt(it){ return String(it.caption||it.alt||"Photo").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function recentFirst(a,b){ var da=a.createdAt||a.date||"", db=b.createdAt||b.date||""; if(da||db) return da<db?1:da>db?-1:0; return (b.sortOrder||0)-(a.sortOrder||0); }

  fetch(base + "/api/gallery?key=" + STORE)
    .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(function(items){
      if (!Array.isArray(items) || !items.length) return; // keep fallback
      items = items.slice().sort(recentFirst);
      var cover=null, grid=[];
      items.forEach(function(it){ if(it.cover&&!cover) cover=it; else grid.push(it); });
      clearTimeout(heroSafety);
      cover ? revealHero(url(cover), cover.caption) : revealHero(null);
      var pool = grid.length ? grid : items;
      if (home) home.innerHTML = pool.slice(0,4).map(function(it){ return '<figure class="tile"><img src="'+url(it)+'" alt="'+alt(it)+'" loading="lazy"></figure>'; }).join("");
      if (full) full.innerHTML = pool.map(function(it){ return '<figure class="shot"><img src="'+url(it)+'" alt="'+alt(it)+'" loading="lazy"></figure>'; }).join("");
    })
    .catch(function(err){ clearTimeout(heroSafety); revealHero(null); if(window.console) console.warn("gallery fetch failed:",err); });
})();
```

Result: mark an image as **cover** in StoreCal → it becomes the hero. Everything
else fills the grid; home shows the 4 newest, the gallery page shows all.

> ⚡ **Perf note:** if StoreCal returns images as base64 `data:` URIs, the payload
> is heavy (the home page downloads all of them). Prefer **hosted image URLs** in
> StoreCal; the loader handles both.

---

### Gallery tabs (store + staff galleries)

When staff have their own galleries, show tabs above the masonry:
**All** (store first, then staff) · one tab per staff. (No dedicated "Store" tab —
**All** already leads with the store photos.) If no staff has a gallery → **no
tabs**. The loader decides on page load from the data.

Data source — the `storecal-data.js` payload (see §0):
- **Store images** — `data.gallery` (cover already split into `data.cover`).
- **Staff galleries** — loop `data.providers`, call
  `StoreCal.staffGallery(p._id)`; group under `p.name`. Empty when the owner turns
  **Allow per-staff galleries** off (admin) → no tabs.

Markup — a tab bar + masonry, both carrying the load triggers:

```html
<div class="gallery__tabs" id="galleryTabs" role="tablist" data-storecal-staff-gallery hidden></div>
<div class="masonry" id="galleryFull" data-storecal-gallery><!-- fallback shots --></div>
```

The loader (§4 `loadGallery`) runs inside `StoreCal.ready(data)`: sets the hero
from `data.cover`, fills the store grid from `data.gallery`, builds one collection
per staffer with photos, and only renders `#galleryTabs` when ≥1 staff group has
images. **All** = store first, then staff; each tab shows its image count. A 6s
safety timeout reveals the static fallback if the sync never loads.

**Skeletons, not fake content.** Every data-driven region (services, galleries,
staff) ships **skeleton placeholders** in its container (`.sk` shimmer classes),
not real-looking dummy content — so there's no flash of fake data before the real
data swaps in. On fetch failure/timeout the JS swaps skeletons for a small
fallback (local images / a couple of cards) so it never sits on skeletons forever.

**Hero cover is fetched first.** The loader fires its own `/api/gallery` request
immediately and sets the hero the moment it returns — not gated behind
shop-config/staff. A `<link rel="preconnect">` to the API warms the connection.
⚠️ While gallery images are base64 `data:` URIs the cover lives inside a ~2 MB
payload (~600 ms to download), so sub-400 ms isn't achievable — switch StoreCal to
**hosted image URLs** and the cover can be `<link rel="preload">`ed for near-instant.

## 4b. Team / staff from StoreCal (About page)

`/api/shop-config` returns a `providers` array —
`{ _id, name, bio, photo, serviceIds }`. Render them on the About page:

```html
<div class="staff__grid" id="staffGrid" data-loading="true">
  <!-- static fallback card; replaced on a successful fetch -->
</div>
```

```js
(function loadStaff() {
  var grid = document.getElementById("staffGrid");
  if (!grid || !window.fetch) return;
  var STORE = "sc_YOUR_STORE_KEY";                 // 🎨
  var base = "http://localhost:5001";
  var embed = document.querySelector('script[src*="embed.js"]');
  if (embed && embed.src) { try { base = new URL(embed.src).origin; } catch (e) {} }
  function esc(t){ return String(t==null?"":t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function initials(n){ return String(n||"").trim().split(/\s+/).slice(0,2).map(function(w){return w.charAt(0).toUpperCase();}).join("")||"✦"; }
  fetch(base + "/api/shop-config?key=" + STORE)
    .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(function(cfg){
      var team = cfg && cfg.providers;
      if (!Array.isArray(team) || !team.length) return; // keep fallback
      grid.innerHTML = team.map(function(p){
        var photo = p.photo ? ' style="background-image:url('+esc(p.photo)+')"' : "";
        var bio = p.bio ? '<p class="staff__bio">'+esc(p.bio)+'</p>' : "";
        return '<article class="staff"><div class="staff__photo"'+photo+'>'+(p.photo?"":initials(p.name))+'</div>'+
               '<h3 class="staff__name">'+esc(p.name)+'</h3>'+bio+'</article>';
      }).join("");
      grid.removeAttribute("data-loading");
    })
    .catch(function(err){ if(window.console) console.warn("staff fetch failed:", err); });
})();
```

```css
.staff__grid { display: grid; gap: 1.8rem; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
.staff { text-align: center; }
.staff__photo { width: 130px; height: 130px; border-radius: 50%; margin: 0 auto 1.1rem; overflow: hidden;
  display: grid; place-items: center; font-family: serif; font-size: 2.4rem; color: #fff;
  background: /* 🎨 */ linear-gradient(150deg,#e85a8f,#3a0e24); background-size: cover; background-position: center; }
```

> The team card grows as the owner adds staff, bios, and photos in StoreCal — no
> code change. Owners with no photo get initials.

## 5. Supporting CSS snippets

```css
/* hero fade-in (prevents the flash) */
.hero__img { opacity: 0; transition: opacity .55s ease; }
.hero__img.is-ready { opacity: 1; }
.hero__img.is-missing { display: none; }
.hero__frame-fallback { display: none; }               /* placeholder only on real error */
.hero__img.is-missing ~ .hero__frame-fallback { display: grid; }

/* gallery page masonry (scales with image count) */
.masonry { column-count: 3; column-gap: 1.1rem; }
.masonry .shot { break-inside: avoid; margin: 0 0 1.1rem; border-radius: 16px; overflow: hidden; }
.masonry .shot img { width: 100%; height: auto; display: block; }
@media (max-width: 820px) { .masonry { column-count: 2; } }
@media (max-width: 560px) { .masonry { column-count: 1; } }

/* booking band: primary + secondary CTA in one row */
.book__cta { display: flex; align-items: center; justify-content: center; gap: .9rem; flex-wrap: wrap; }
```

---

## 6. Booking OFF → CTAs become "Call us"

When the owner turns booking **off** in StoreCal, `embed.js` runs `applyGate()`:

- If `shop.phone` **is set** → relabels text-only `[data-storecal-book]` CTAs to
  **"📞 Call <phone>"** and dials on click.
- If `shop.phone` is **empty** → it **hides** the CTAs. ❌

**So step one is: set the phone number in the StoreCal dashboard** (`shop.phone`).
That turns every CTA into a call button when booking is off — no hiding.

We then rewrite the visible label to **"Call us"** so the number isn't shown on
the page (it still dials on click, via the embed's `callStore()` → `tel:`). Drop
this in `script.js`:

```js
(function callUsLabel() {
  var LABEL = "Call us";
  function fix(el) {
    if (!el || el.children.length) return;         // leave rendered cards alone
    var t = el.textContent || "";
    if (/\d/.test(t) && /call/i.test(t) && t.trim() !== LABEL) el.textContent = LABEL;
  }
  function scan(){ Array.prototype.forEach.call(document.querySelectorAll("[data-storecal-book]"), fix); }
  if (window.MutationObserver) {                    // override embed's relabel whenever it fires
    var obs = new MutationObserver(function (muts) {
      muts.forEach(function (m) { var el = m.target && m.target.closest ? m.target.closest("[data-storecal-book]") : null; if (el) fix(el); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-storecal-book]"), function (el) {
      obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  scan();
  var n = 0, id = setInterval(function () { scan(); if (++n > 12) clearInterval(id); }, 300);
})();
```

> How it stays in sync: the embed's relabel is async, so we watch the CTAs with a
> `MutationObserver` (plus a few timed passes) and normalize "📞 Call <number>" →
> "Call us" whenever it appears. When booking is **on**, labels have no digits so
> they're left untouched. `applyGate()` skips CTAs with child elements (rendered
> service cards), so this only touches the simple text CTAs.

---

## 7. Dev workflow — no-cache server

Python's default server caches JS/CSS, so edits don't show. Use a no-cache server:

```python
# serve.py  →  python3 serve.py 8090
import functools, http.server, socketserver, sys
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
DIRECTORY = "/absolute/path/to/site"   # 🎨
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), functools.partial(H, directory=DIRECTORY)) as s:
    print("serving http://localhost:%d" % PORT); s.serve_forever()
```

CORS: the StoreCal API reflects any `Origin` (incl. `null` for `file://`), so the
fetches work from a dev server or an opened file.

---

## 8. Replication checklist for Pamper 4 Paws

- [ ] Get the Pamper 4 Paws **store key** (`sc_...`) and set `data-store`.
- [ ] 🎨 Set `data-accent` to the P4P brand color (navy/tan).
- [ ] 🎨 Swap the two fonts in the `brandStoreCal` CSS + load them in `<head>`.
- [ ] Add `data-storecal-book` to every booking CTA (+ `data-service` on cards).
- [ ] Wire `loadServices` (P4P services: Full Groom, Bath & Brush, Nail & Ear…).
- [ ] Wire `loadGallery` + `#heroImg` cover; upload photos + set a cover in StoreCal.
- [ ] Build an **About** page; wire `loadStaff` (`shop-config → providers`) for the
      team; add "About" to the nav.
- [ ] Copy the `brandStoreCal` + step-two nudge + hide-trigger block.
- [ ] **Set `shop.phone` in StoreCal** so booking-off shows "📞 Call …".
- [ ] Copy the supporting CSS (hero fade, masonry, booking row).
- [ ] Test with the StoreCal server running: book flow, services render, gallery
      cover→hero, booking-off → call.
