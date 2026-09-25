import http.client
import sys
sys.stdout.reconfigure(encoding='utf-8')

urls = [
    '/',
    '/styles/critical.css',
    '/styles/components.css',
    '/styles/layout.css',
    '/src/app.js',
    '/src/core/state.js',
    '/src/core/api.js',
    '/src/core/router.js',
    '/src/core/events.js',
    '/src/animations/scroll.js',
    '/src/ui/Toast.js',
    '/src/modules/payments/index.js',
]

for path in urls:
    try:
        conn = http.client.HTTPConnection('127.0.0.1', 3000, timeout=5)
        conn.request('GET', path)
        res = conn.getresponse()
        data = res.read()
        ct = res.getheader('Content-Type', 'N/A')
        print(f"{path} -> {res.status} ({ct.split(';')[0]}) [{len(data)} bytes]")
        conn.close()
    except Exception as e:
        print(f"{path} -> ERROR: {e}")
