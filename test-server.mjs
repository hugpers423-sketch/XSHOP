import http from 'node:http';

function test(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const type = res.headers['content-type'] || 'N/A';
        console.log(`${url} → ${res.statusCode} (${type.split(';')[0]}) [${data.length} bytes]`);
      });
    }).on('error', e => console.log(`${url} → ERROR: ${e.message}`));
  });
}

async function main() {
  const urls = [
    'http://127.0.0.1:3000/',
    'http://127.0.0.1:3000/styles/critical.css',
    'http://127.0.0.1:3000/styles/components.css',
    'http://127.0.0.1:3000/styles/layout.css',
    'http://127.0.0.1:3000/src/app.js',
    'http://127.0.0.1:3000/src/core/state.js',
    'http://127.0.0.1:3000/src/core/api.js',
    'http://127.0.0.1:3000/src/core/router.js',
    'http://127.0.0.1:3000/src/core/events.js',
    'http://127.0.0.1:3000/src/core/state.js',
    'http://127.0.0.1:3000/src/animations/scroll.js',
    'http://127.0.0.1:3000/src/ui/Toast.js',
    'http://127.0.0.1:3000/src/modules/payments/index.js',
  ];
  for (const u of urls) {
    await test(u);
  }
}
main();
