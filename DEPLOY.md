# Deployment Guide

## Can I deploy to GitHub Pages?
**Yes, but with limitations.**

GitHub Pages acts as a static file server. It cannot run the `server.js` file (Node.js).

### Scenario 1: GitHub Pages Only
- **Result**: The app will load, but **live bus timings will NOT work**.
- **Why**: The LTA DataMall API does not allow direct calls from browsers (CORS issue). The app relies on `server.js` to act as a proxy.
- **Behavior**: Live lookups show unavailable data. Users can explicitly choose the Demo mode checkbox to see simulated arrivals.

### Scenario 2: Full Deployment (Live Data)
To get live data, you need to host the backend (`server.js`) somewhere that supports Node.js.

#### Option A: Vercel (Recommended)
Vercel can host both the frontend and the backend (converted to serverless functions).
1. Use the checked-in `vercel.json`; it builds the public assets and uses the two checked-in `/api` functions for arrivals and paginated stops.
2. Push to GitHub.
3. Import project in Vercel.
4. Configure `LTA_API_KEY` in Vercel environment variables. After deployment, set `BUS_APP_URL` to its URL and run `npm run test:deployment` to check search/nearby stop fields and pagination.

#### Option B: Render / Railway / Glitch
These platforms can run `server.js` directly.
1. Push to GitHub.
2. Connect your repo to Render/Railway.
3. Set the start command to `npm start` (builds public assets before serving).
4. Set the `LTA_API_KEY` environment variable in their dashboard.

## Running Locally
1. Install Node.js.
2. Open terminal in this folder.
3. Run `npm start`, or `npm run build` followed by `node server.js`.
4. App opens at `http://localhost:3000`.

The local server binds to loopback and serves only the generated `public/` assets. `.env`, source, tests, and configuration files are denied. Run `npm test` for focused arrival, favorite, pagination, and static-file regression checks.
