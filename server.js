/**
 * Simple Local Server for SG Bus Timing App
 * Run with: node server.js
 * Then open: http://localhost:3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;

// MIME types for serving static files
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Parse the URL manually for better compatibility
    const urlParts = req.url.split('?');
    const pathname = urlParts[0];
    const queryString = urlParts[1] || '';

    // Parse query parameters
    const params = {};
    queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) params[key] = decodeURIComponent(value || '');
    });

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

    // Handle CORS preflight FIRST
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'AccountKey, Accept, Content-Type'
        });
        res.end();
        return;
    }

    // Handle LTA API proxy requests
    if (pathname === '/api/bus-arrival') {
        console.log('  -> Handling bus arrival API request');

        const busStopCode = params.BusStopCode;
        const serviceNo = params.ServiceNo || '';

        // Check for client-provided API key in headers FIRST
        let apiKey = req.headers['accountkey'];

        if (!apiKey) {
            // Fall back to environment or .env file
            apiKey = process.env.LTA_API_KEY;

            // Simple manual .env parser if not in process.env
            if (!apiKey && fs.existsSync('.env')) {
                try {
                    const envFile = fs.readFileSync('.env', 'utf8');
                    const match = envFile.match(/LTA_API_KEY=(.*)/);
                    if (match && match[1]) {
                        apiKey = match[1].trim();
                    }
                } catch (e) {
                    console.error('Error reading .env file:', e);
                }
            }
        }

        const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'None';
        const isClientProvided = !!req.headers['accountkey'];

        console.log(`  -> BusStopCode: ${busStopCode}, ServiceNo: ${serviceNo}`);
        console.log(`  -> Using ${isClientProvided ? 'Client' : 'Server'} Key: "${maskedKey}"`);

        if (apiKey && apiKey.length === 32 && /^[0-9a-fA-F]+$/.test(apiKey)) {
            console.log('  ⚠️  WARNING: API Key is 32 hex characters. LTA keys are usually 36 characters (UUIDs with dashes).');
            console.log('  ⚠️  Did you remove the dashes? Please try adding them back.');
        }

        if (!apiKey) {
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'Server misconfiguration: LTA_API_KEY not found in environment' }));
            return;
        }

        if (!busStopCode) {
            res.writeHead(400, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'BusStopCode parameter required' }));
            return;
        }

        // Build LTA API URL - Using v3/BusArrival as confirmed by previous 401 response and documentation
        let ltaUrl = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${busStopCode}`;
        if (serviceNo) ltaUrl += `&ServiceNo=${serviceNo}`;

        console.log(`  -> Calling LTA API: ${ltaUrl}`);

        // Make request to LTA API
        const ltaReq = https.request(ltaUrl, {
            method: 'GET',
            headers: {
                'AccountKey': apiKey,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SG-Bus-Timing-App/1.0'
            }
        }, (ltaRes) => {
            let data = '';
            ltaRes.on('data', chunk => data += chunk);
            ltaRes.on('end', () => {
                console.log(`  -> LTA API responded with status: ${ltaRes.statusCode}`);

                if (ltaRes.statusCode !== 200) {
                    console.log(`  -> LTA Status: ${ltaRes.statusCode}`);
                    console.log(`  -> LTA Headers: ${JSON.stringify(ltaRes.headers)}`);
                    console.log(`  -> LTA Error Body: '${data}'`); // Quote to see if empty
                }

                res.writeHead(ltaRes.statusCode, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        });

        ltaReq.on('error', (error) => {
            console.log(`  -> LTA API error: ${error.message}`);
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: error.message }));
        });

        ltaReq.end();
        return;
    }

    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`  -> 404 Not Found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

function startServer(port) {
    server.listen(port)
        .on('listening', () => {
            const url = `http://localhost:${port}`;
            console.log(`
╔════════════════════════════════════════════╗
║     🚌 SG Bus Timing Server Running!       ║
╠════════════════════════════════════════════╣
║  URL: ${url.padEnd(37)}║
║  Press Ctrl+C to stop                      ║
╚════════════════════════════════════════════╝
            `);

            // Automatically open browser
            console.log(`Opening ${url}...`);
            const startCommand = process.platform === 'win32' ? 'start' :
                process.platform === 'darwin' ? 'open' : 'xdg-open';
            exec(`${startCommand} ${url}`);
        })
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  Port ${port} is already in use.`);
                if (port < 3010) { // Limit retries
                    console.log(`🔄 Trying next port: ${port + 1}...`);
                    startServer(port + 1);
                } else {
                    console.error('❌ Could not find an available port after 10 attempts.');
                    process.exit(1);
                }
            } else {
                console.error('❌ Server error:', err);
                process.exit(1);
            }
        });
}

startServer(PORT);
