const https = require('https');

function upstreamUrl(kind, query) {
    const url = new URL(`https://datamall2.mytransport.sg/ltaodataservice/v3/${kind === 'stops' ? 'BusStops' : 'BusArrival'}`);
    if (kind === 'stops') {
        const skip = query.skip === undefined ? '0' : String(query.skip);
        if (!/^\d{1,7}$/.test(skip)) throw new Error('skip must be a non-negative integer');
        url.searchParams.set('$skip', skip);
    } else {
        if (!/^\d{5}$/.test(query.BusStopCode || '')) throw new Error('BusStopCode must be 5 digits');
        url.searchParams.set('BusStopCode', query.BusStopCode);
        if (query.ServiceNo) {
            if (!/^[a-zA-Z0-9]{1,8}$/.test(query.ServiceNo)) throw new Error('Invalid ServiceNo');
            url.searchParams.set('ServiceNo', query.ServiceNo);
        }
    }
    return url;
}

function requestJson(url, apiKey) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { AccountKey: apiKey, Accept: 'application/json' } }, response => {
            let body = '';
            response.on('error', reject);
            response.on('data', chunk => {
                body += chunk;
                if (body.length > 2 * 1024 * 1024) request.destroy(new Error('Upstream response too large'));
            });
            response.on('end', () => {
                if (response.statusCode !== 200) return reject(new Error('Upstream unavailable'));
                try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid upstream JSON')); }
            });
        });
        request.setTimeout(10000, () => request.destroy(new Error('Upstream timed out')));
        request.on('error', reject);
    });
}

function createHandler(kind, { apiKey, request = requestJson } = {}) {
    return async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
        let url;
        try { url = upstreamUrl(kind, req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)); }
        catch (error) { return send(400, { error: error.message }); }
        const key = req.headers.accountkey || apiKey || process.env.LTA_API_KEY;
        if (!key) return send(503, { error: 'Live data unavailable: API key not configured' });
        try {
            const data = await request(url, key);
            if (!Array.isArray(kind === 'stops' ? data.value : data.Services)) throw new Error('Invalid upstream response');
            send(200, data);
        } catch { send(502, { error: 'Live data temporarily unavailable' }); }
    };
}
module.exports = { createHandler, upstreamUrl };
