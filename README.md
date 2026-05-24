# Swarm Viewer

A desktop app to explore your Foursquare Swarm check-in history on an interactive map.

## Prerequisites

### 1. Foursquare Developer Account

1. Go to [foursquare.com/developers](https://foursquare.com/developers) and create an account
2. Create a new project → add an OAuth consumer
3. Set the **Redirect URI** to: `http://127.0.0.1:7878/callback`
4. Copy your **Client ID** and **Client Secret**

### 2. Google Maps API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Maps JavaScript API**
3. Create an API key → restrict it to **Maps JavaScript API**
4. Copy the key

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
FOURSQUARE_CLIENT_ID=your_client_id
FOURSQUARE_CLIENT_SECRET=your_client_secret
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
```

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The `.dmg` (macOS) or `.exe` installer (Windows) will be in `src-tauri/target/release/bundle/`.

## Release

Push a version tag to trigger a GitHub Actions build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Add `FOURSQUARE_CLIENT_ID`, `FOURSQUARE_CLIENT_SECRET`, and `VITE_GOOGLE_MAPS_API_KEY` as GitHub repository secrets before releasing.
