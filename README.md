# mechaok

Motorbike service reminders by **odometer (km)** — static app for **GitHub Pages**. Data is stored in the browser (`localStorage`).

## Local preview

Open `index.html` in a browser, or from this folder run:

```bash
python3 -m http.server 8080
```

Then visit `http://127.0.0.1:8080`.

Use **HTTPS** (or `localhost`) so the **service worker** registers; that enables **Install app** on Chrome/Android. iOS: Safari → Share → **Add to Home Screen** (uses `apple-touch-icon`).

To change the **Donate** link, edit the `href` on `.donate-link` in `index.html` (e.g. Ko-fi, PayPal, or GitHub Sponsors).

## GitHub Pages

Repo **Settings → Pages**: set **Source** to your branch (e.g. `main`) and **folder** `/ (root)`, save. The site will be at `https://<user>.github.io/mechaok/` if the repo is named `mechaok`.
