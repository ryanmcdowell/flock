# Flock landing page

A single static HTML page that:

- Detects the visitor's OS (macOS / Windows) via `navigator.userAgent`.
- Calls the GitHub Releases API (`/repos/{owner}/{repo}/releases/latest`) to pick the right download asset for the detected platform.
- Falls back gracefully when there's no published release yet.

## Configure

Edit two strings in `index.html`:

```js
const REPO_OWNER = 'REPLACE_USER';
const REPO_NAME  = 'REPLACE_REPO';
```

That's it for the page itself.

## Deploy to GitHub Pages

Two reasonable setups:

### Option A — `gh-pages` branch (recommended)

Keeps `main` clean and serves only this landing page.

1. Push the repo to GitHub.
2. In Settings → Pages, set the source to `gh-pages` branch, root.
3. Publish the `docs/landing/` contents to that branch (one-time):

```sh
git checkout --orphan gh-pages
git rm -rf .
cp docs/landing/index.html docs/landing/icon.png .
git add index.html icon.png
git commit -m "publish landing page"
git push origin gh-pages
git checkout main
```

Or use a GitHub Action to keep it in sync — there are many `peaceiris/actions-gh-pages` templates that publish a folder on every push.

### Option B — `/docs` folder

Simpler but exposes the rest of `docs/` (specs, plans) at your Pages URL.

1. Move `index.html` and `icon.png` to `docs/index.html` and `docs/icon.png`.
2. In Settings → Pages, set the source to `main` branch, `/docs` folder.

## Custom domain (optional)

In Settings → Pages, set a custom domain like `flock.ryanmcdowell.io`. Add a `CNAME` file with the bare domain inside `docs/landing/` (or wherever the published root is). Add a CNAME DNS record at your registrar pointing at `yourname.github.io`.

## Icon

`icon.png` is currently the 256×256 render of `docs/icons/concept-c-pin-flock.svg`. If you pick the other concept, copy `docs/icons/concept-b-swift-256.png` over it.

For higher resolution displays, render a 512×512 source from one of the SVGs and use that:

```sh
rsvg-convert -w 512 -h 512 docs/icons/concept-c-pin-flock.svg -o docs/landing/icon.png
```
