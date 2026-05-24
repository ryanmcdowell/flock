# Manual Smoke Test Checklist

Automated tests cover Rust logic (12 tests) and React components (22 tests). This checklist covers the end-to-end paths that require real APIs.

## Prerequisites

- Foursquare developer account with OAuth consumer (redirect URI: `http://127.0.0.1:7878/callback`)
- Google Maps API key (Maps JavaScript API enabled)
- `.env` populated with `FOURSQUARE_CLIENT_ID`, `FOURSQUARE_CLIENT_SECRET`, `VITE_GOOGLE_MAPS_API_KEY`

## Run

```bash
npm run tauri dev
```

## Checklist

### OAuth & initial load
- [ ] App window opens to the Connect screen
- [ ] "Connect to Swarm" opens Foursquare in the system browser
- [ ] After approval, redirected to "Connected!" page; app advances to loading screen
- [ ] Progress bar advances as pages load
- [ ] Map renders with orange pins after load completes

### Map
- [ ] Clicking a pin opens detail card with venue name, date, category, note, "Open in Maps" + "View on Swarm" links
- [ ] "×" closes the detail card
- [ ] Pin clusters expand on zoom-in
- [ ] Pan/zoom is persisted across app restarts (close app, reopen, map opens at same location)

### Timeline
- [ ] Scrolling the timeline shows venue names, cities, dates
- [ ] Clicking a row pans the map to that pin and opens its detail card
- [ ] Selected row is highlighted (orange left border)

### Search & filters
- [ ] Typing in search filters timeline and map pins in real time
- [ ] "Filters" button opens panel with date presets and city list
- [ ] "Last 30 days" preset narrows results to recent
- [ ] Clicking a city restricts to that city only
- [ ] FilterChips show active filters; "×" on each chip removes that filter
- [ ] "Clear all" resets all filters

### Stats
- [ ] "Stats" toolbar button switches right panel to stats
- [ ] Total count, per-month chart, longest streak, top cities, new venues chart all render
- [ ] Stats respect active filters
- [ ] "Stats" again returns to timeline

### Settings & sign-out
- [ ] ⚙ → uncheck "Show categories" removes category chips from rows and detail cards
- [ ] ⚙ → uncheck "Show notes" removes notes from rows and detail cards
- [ ] ⚙ → Sign out clears all data and returns to Connect screen

### Theme
- [ ] Switch OS to dark mode → app shell uses dark colors
- [ ] Map renders in dark style in dark mode (requires app restart)

## Distribution build

```bash
npm run tauri build
```

Verify `.dmg` is produced under `src-tauri/target/release/bundle/dmg/`.

For GitHub Actions release: add `FOURSQUARE_CLIENT_ID`, `FOURSQUARE_CLIENT_SECRET`, and `VITE_GOOGLE_MAPS_API_KEY` as repo secrets, then `git tag v0.1.0 && git push origin v0.1.0`.
