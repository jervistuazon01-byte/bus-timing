# Deployment Guide

## Can I deploy to GitHub Pages?
**Yes, but with limitations.**

GitHub Pages acts as a static file server. It cannot run the `server.js` file (Node.js).

### Scenario 1: GitHub Pages Only
- **Result**: The app will load, but **live bus timings will NOT work**.
- **Why**: The LTA DataMall API does not allow direct calls from browsers (CORS issue). The app relies on `server.js` to act as a proxy.
- **Behavior**: The app will detect the API failure and switch to **Demo Mode** (simulated data).

### Scenario 2: Full Deployment (Live Data)
To get live data, you need to host the backend (`server.js`) somewhere that supports Node.js.

#### Option A: Vercel (Recommended)
Vercel can host both the frontend and the backend (converted to serverless functions).
1. Create a `vercel.json` configuration to redirect `/api/*` to a serverless function.
2. Push to GitHub.
3. Import project in Vercel.

#### Option B: Render / Railway / Glitch
These platforms can run `server.js` directly.
1. Push to GitHub.
2. Connect your repo to Render/Railway.
3. Set the start command to `node server.js`.
4. Set the `LTA_API_KEY` environment variable in their dashboard.

## Running Locally
1. Install Node.js.
2. Open terminal in this folder.
3. Run `node server.js`.
4. App opens at `http://localhost:3000`.
