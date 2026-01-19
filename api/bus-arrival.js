const https = require('https');

module.exports = function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { BusStopCode, ServiceNo } = req.query;

    if (!BusStopCode) {
        res.status(400).json({ error: 'BusStopCode parameter required' });
        return;
    }

    const apiKey = process.env.LTA_API_KEY;

    if (!apiKey) {
        res.status(500).json({ error: 'Server misconfiguration: API key not found' });
        return;
    }

    // Build LTA API URL
    let ltaUrl = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${BusStopCode}`;
    if (ServiceNo) ltaUrl += `&ServiceNo=${ServiceNo}`;

    const ltaReq = https.request(ltaUrl, {
        method: 'GET',
        headers: {
            'AccountKey': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'SG-Bus-Timing-App/1.0'
        }
    }, (ltaRes) => {
        let data = '';
        ltaRes.on('data', chunk => data += chunk);
        ltaRes.on('end', () => {
            // Forward status code and content
            res.status(ltaRes.statusCode).json(JSON.parse(data));
        });
    });

    ltaReq.on('error', (error) => {
        console.error('LTA API error:', error.message);
        res.status(500).json({ error: error.message });
    });

    ltaReq.end();
}
