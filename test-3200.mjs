import http from 'node:http';

function test(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const hasHero = data.includes('hero-badge');
        const hasFeatures = data.includes('features-grid');
        const hasCSP = res.headers['content-security-policy'] !== undefined;
        const hasCSS = data.includes('styles/critical.css');
        const hasApp = data.includes('src/app.js');
        console.log(`${url} -> ${res.status} | hero:${hasHero} features:${hasFeatures} CSP:${hasCSS} CSS:${hasCSS} JS:${hasApp}`);
      });
    }).on('error', e => console.log(`${url} -> ERROR: ${e.message}`));
  });
}

async function main() {
  await test('http://127.0.0.1:3200/');
}
main();
