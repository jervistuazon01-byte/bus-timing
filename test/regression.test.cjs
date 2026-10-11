const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createServer } = require('../server');
const { createHandler, upstreamUrl } = require('../lib/lta');

test('live empty response stays live; outage rejects; demo is explicit', async () => {
 const context = vm.createContext({ localStorage: { getItem() {} }, Date, console, window: {} });
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../api.js'), 'utf8') + '\nthis.api=LTA_API;', context);
 context.api.request = async () => ({ Services: [] });
 const empty = await context.api.getBusArrival('83139');
 assert.equal(empty.Services.length, 0); assert.equal(empty._isDemo, false);
 context.api.request = async () => { throw Error('outage'); };
 await assert.rejects(context.api.getBusArrival('83139'), /outage/);
 assert.equal((await context.api.getBusArrival('83139', '', { demo: true }))._isDemo, true);
 context.api.demoMode = true;
 await assert.rejects(context.api.getBusArrival('83139', '', { demo: false }), /outage/);
});

test('static assets only: reject dummy secrets, source, traversal, malformed paths', async () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-static-'));
 fs.writeFileSync(path.join(root, 'index.html'), 'public');
 fs.writeFileSync(path.join(root, '.env'), 'DUMMY_ONLY');
 fs.writeFileSync(path.join(root, 'server.js'), 'dummy source');
 const server = createServer({ publicDir: root });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const base = 'http://127.0.0.1:' + server.address().port;
 try {
  assert.equal(await (await fetch(base)).text(), 'public');
  for (const route of ['/.env', '/%2eenv', '/server.js', '/%2e%2e%2f.env', '/api/test/New%20Text%20Document.txt', '/%5c.env']) assert.equal((await fetch(base + route)).status, 404, route);
  assert.equal((await fetch(base + '/%ZZ')).status, 400);
 } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true }); }
});

test('shared Vercel/Node stops handler forwards validated pagination and handles upstream errors', async () => {
 assert.equal(upstreamUrl('stops', { skip: '500' }).searchParams.get('$skip'), '500');
 for (const skip of ['-1', '1&evil=1', 'a', ['0','500']]) assert.throws(() => upstreamUrl('stops', { skip }));
 let called;
 const handler = createHandler('stops', { apiKey: 'dummy', request: async url => { called = url; return { value: [{ BusStopCode: '83139' }] }; } });
 const server = require('http').createServer(handler);
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 try {
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/bus-stops?skip=500');
  assert.equal(response.status,200); assert.equal((await response.json()).value.length,1); assert.equal(called.searchParams.get('$skip'),'500');
 } finally { await new Promise(resolve => server.close(resolve)); }
 assert.equal(typeof require('../api/bus-stops'),'function');
});

test('favorite failures clear ETAs and show unavailable; empty response clears old services', async () => {
 const api = { getBusArrival: async () => { throw Error('outage'); } };
 const context = vm.createContext({ LTA_API: api, console, document: { addEventListener() {} }, window: {} });
 let source=fs.readFileSync(path.join(__dirname, '../app.js'),'utf8');
 source=source.replace(/const app = new BusTimingApp\(\);/, 'const app = {};');
 vm.runInContext(source+'\nthis.App=BusTimingApp;',context);
 const app=Object.create(context.App.prototype);
 app.state={favorites:[{stopCode:'83139',serviceNo:'10'}],favTimings:{'83139_10':[{EstimatedArrival:'old'}]}};
 app.renderFavorites=()=>{};
 app.state.favStatus = {'83139_10':{source:'Live',updatedAt:Date.parse('2000-01-01T01:02:03Z')}};
 await app.refreshFavoriteTimings();
 assert.equal(app.state.favTimings['83139_10'].length,0);
 assert.match(app.state.favStatus['83139_10'].source,/Unavailable/);
 app.elements={favoritesGrid:{innerHTML:''},favoritesSection:{classList:{remove(){},add(){}}}};
 const savedFavoriteTime=new Date(app.state.favStatus['83139_10'].updatedAt).toLocaleTimeString('en-SG');
 context.App.prototype.renderFavorites.call(app);
 assert(app.elements.favoritesGrid.innerHTML.includes('Updated ' + savedFavoriteTime));
 assert(app.elements.favoritesGrid.innerHTML.includes('Unavailable — refresh failed'));
 api.getBusArrival=async()=>({Services:[],_updatedAt:123,_isDemo:false});
 await app.refreshFavoriteTimings();
 assert.equal(app.state.favStatus['83139_10'].source,'Live');
 assert.equal(app.state.favStatus['83139_10'].updatedAt,123);
});

test('outage after live arrival marks stale and removes countdowns; next empty response clears stale status', async () => {
 const api={getBusArrival:async()=>{throw Error('outage');}};
 const context=vm.createContext({LTA_API:api,console:{error(){},log(){}},document:{addEventListener(){}},window:{},setTimeout:fn=>fn()});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8')+'\nthis.App=BusTimingApp;',context);
 const app=Object.create(context.App.prototype);
 const savedTime = Date.parse('2000-01-01T01:02:03Z');
 app.state={currentBusStop:'83139',currentService:'10',services:[{ServiceNo:'10'}],isDemo:false,updatedAt:savedTime};
 const svg={style:{}};
 app.elements={refreshBtn:{querySelector:()=>svg},arrivalsList:{textContent:''},lastUpdated:{textContent:''}};
 app.showStopInfo=()=>{};
 const formatted = new Date(savedTime).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
 app.updateTimestamp();
 assert.equal(app.elements.lastUpdated.textContent, 'Live | Last updated: ' + formatted);
 await app.refreshArrivals();
 assert.equal(app.state.updatedAt,savedTime); assert.equal(app.state.stale,true);
 assert.equal(app.elements.lastUpdated.textContent, 'Stale — refresh failed | Last updated: ' + formatted);
 app.elements.busStopInput={value:'83139'};
 for(const method of ['showLoading','hideError','hideSections','showError']) app[method]=()=>{};
 await app.searchBusStop();
 assert.equal(app.elements.lastUpdated.textContent, 'Stale — refresh failed | Last updated: ' + formatted);
 await app.refreshArrivals();
 assert.equal(app.elements.lastUpdated.textContent, 'Stale — refresh failed | Last updated: ' + formatted);
 assert.match(app.elements.lastUpdated.textContent,/Stale/);
 assert.match(app.elements.arrivalsList.textContent,/unavailable/);
 api.getBusArrival=async()=>({Services:[],_isDemo:false,_updatedAt:456});
 await app.refreshArrivals();
 assert.equal(app.state.stale,false);assert.equal(app.state.updatedAt,456);assert.equal(app.state.services.length,0);
 assert.match(app.elements.arrivalsList.textContent,/No arrivals/);assert.match(app.elements.lastUpdated.textContent,/Live/);
 assert.equal(app.elements.lastUpdated.textContent, 'Live | Last updated: ' + new Date(456).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
 delete app.state.updatedAt;
 app.updateTimestamp();
 assert.equal(app.elements.lastUpdated.textContent,'Unavailable — no successful update');
});

test('both serverless endpoints return safe error for invalid upstream payload and reject invalid parameters', async () => {
 async function call(handler,query) {
  let body='';const res={statusCode:0,setHeader(){},end(text){body=text;}};
  await handler({method:'GET',query,headers:{}},res);
  return {status:res.statusCode,body:JSON.parse(body)};
 }
 for(const kind of ['arrival','stops']) {
  const handler=createHandler(kind,{apiKey:'dummy',request:async()=>({unexpected:true})});
  const result=await call(handler,kind==='arrival'?{BusStopCode:'83139'}:{skip:0});
  assert.equal(result.status,502); assert.match(result.body.error,/unavailable/);
 }
 assert.equal((await call(createHandler('arrival'),{BusStopCode:'123&bad=1'})).status,400);
 assert.equal((await call(createHandler('stops',{apiKey:'dummy'}),{skip:-1})).status,400);
});
