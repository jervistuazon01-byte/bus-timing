const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
for (const file of ['index.html', 'app.js', 'api.js', 'style.css', 'minimal-ui.css', 'manifest.json', 'icon.png', 'service-worker.js']) {
    fs.copyFileSync(path.join(root, file), path.join(root, 'public', file));
}
