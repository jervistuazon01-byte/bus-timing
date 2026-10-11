// Read-only post-deployment endpoint check; set BUS_APP_URL to the deployment URL.
const assert = require('node:assert/strict');
async function main() {
 const base = process.env.BUS_APP_URL;
 if (!base) throw new Error('Set BUS_APP_URL to your deployed app URL');
 const first = await fetch(new URL('/api/bus-stops?skip=0', base));
 assert.equal(first.status, 200, 'deployed bus-stop lookup must work');
 const data = await first.json();
 assert(Array.isArray(data.value));
 assert(data.value.some(stop => /^\d{5}$/.test(stop.BusStopCode) && typeof stop.Description === 'string' && Number.isFinite(Number(stop.Latitude)) && Number.isFinite(Number(stop.Longitude))), 'search and nearby stop fields missing');
 const next = await fetch(new URL('/api/bus-stops?skip=500', base));
 assert.equal(next.status, 200); assert(Array.isArray((await next.json()).value));
 const invalid = await fetch(new URL('/api/bus-stops?skip=-1', base));
 assert.equal(invalid.status, 400);
 console.log('Deployed search/nearby stop endpoint and pagination passed');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
