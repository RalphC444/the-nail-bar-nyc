# The Nail Bar — Website

A whimsy / modern / sexy one-page site for **The Nail Bar** (Mount Vernon, NY · [@itsthenailbar](https://www.instagram.com/itsthenailbar/)).
Pure static site — HTML, CSS, JS. No build step, no dependencies.

## Run it

Just open `index.html` in a browser, or serve the folder:

```bash
cd the-nail-bar
python3 -m http.server 8000
# → http://localhost:8000
```

## Structure

```
the-nail-bar/
├── index.html     # home (hero, services, experience, booking)
├── gallery.html   # Gallery page
├── reviews.html   # Reviews page
├── styles.css     # design system + all styling (shared)
├── script.js      # nav, reveals, mobile menu, booking, live services (shared)
├── images/        # nail photos
└── README.md
```

All three pages share `styles.css` + `script.js`. The nav lives in each page's
markup: on the home page "Gallery"/"Reviews" link to `gallery.html`/`reviews.html`,
and on the subpages the other nav items link back to `index.html#section`.

## Design notes

- **Fonts:** Fraunces (display serif) + Manrope (sans) via Google Fonts.
- **Palette** (CSS vars in `:root`): wine `#3a0e24`, cream `#fbf3ec`, blush `#f4c9d6`, hot pink `#ff4f8b`, gold `#cda349`. Change them in one place at the top of `styles.css`.
- Fully responsive, dark booking section, grain overlay, animated blobs, marquee, scroll-reveal, sticky mobile "Book Now" bar.
- Respects `prefers-reduced-motion`.

## StoreCal booking integration ✅ (wired)

The StoreCal widget is loaded near the end of `index.html`:

```html
<script src="http://localhost:5001/embed.js" data-store="sc_a1588f0b7afba3e678"></script>
```

**Going to production:** swap `http://localhost:5001` for the domain that serves
`embed.js`. Nothing else changes — the API base is inferred from the script's `src`.

**Every booking CTA is wired.** All elements with the `.js-book` class (nav "Book
Now", hero "Book your seat", "Come hang out", the booking band button, the footer
link, and the mobile FAB) call `StoreCalWidget.open()` via `script.js`. If the
widget script hasn't loaded, they fall back to scrolling to the booking band
(which has call / DM options).

### Deep-link a specific service
Add `data-service` to any `.js-book` element and it opens preselected to that
service (the name must match your StoreCal menu exactly):

```html
<button class="btn btn--primary js-book" data-service="Gel Manicure">Book Gel Manicure</button>
```

You can also call it directly: `StoreCalWidget.book("Deluxe Spa Pedicure")` or
`window.openBooking("Gel-X Extensions")`.

### Optional embed attributes
```html
<!-- custom auto-injected button label -->  data-button-text="Book an Appointment"
<!-- auto-open modal on load (e.g. a /book page) -->  data-auto
```

### Populating the menu from the API (optional next step)
The service cards in the Services section are currently hand-written placeholders.
To drive them from StoreCal, fetch the public config and render the cards:

```js
const KEY = "sc_a1588f0b7afba3e678", BASE = "http://localhost:5001";
const cfg = await fetch(`${BASE}/api/shop-config?key=${KEY}`).then(r => r.json());
// cfg has shop info + services + add-ons + staff
```
Just make sure the `data-service` values match the names returned by the API.

## Content still to swap in real data

- **Gallery** — the 6 gradient tiles in the `.gallery__grid` are placeholders. Drop in real photos from Instagram:
  ```html
  <figure class="tile tile--a" data-reveal><img src="images/set1.jpg" alt="Chrome French set" /></figure>
  ```
- **Prices / service times** — currently sensible placeholders. Update the `.card` blocks with real menu pricing.
- **Reviews** — swap the 3 placeholder testimonials for real ones.
- **Hours** — footer says "Tue–Sat 10a–7p, by appointment." Adjust to actual hours.
- **Phone** — wired to `347-931-5183`. Update `tel:` links + footer if needed.
```
