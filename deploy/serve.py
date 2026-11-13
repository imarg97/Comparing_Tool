#!/usr/bin/env python3
"""
mDiff Production Static Server (Multi-Threaded Python 3 Engine)
Provides fast, non-blocking HTTP serving for enterprise Linux hosts (RHEL / CentOS).
Guarantees correct ES Module MIME types and handles parallel requests seamlessly.
"""

import os
import sys
import mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8097
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(SCRIPT_DIR, 'dist')

# Ensure strict MIME types are always present regardless of host OS /etc/mime.types packages
MIME_MAP = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml',
}

class MDiffHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in MIME_MAP:
            return MIME_MAP[ext]
        return super().guess_type(path)

    def end_headers(self):
        # Enable CORS and control caching
        self.send_header('Access-Control-Allow-Origin', '*')
        if self.path.endswith('.html') or self.path == '/' or self.path.startswith('/?'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        else:
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        super().end_headers()

    def do_GET(self):
        # SPA routing: if path does not exist, fall back to /index.html
        path_without_query = self.path.split('?')[0].split('#')[0]
        local_path = os.path.join(DIST_DIR, path_without_query.lstrip('/'))
        if not os.path.exists(local_path) and not path_without_query.startswith('/assets/'):
            self.path = '/index.html'
        return super().do_GET()

def run():
    if not os.path.isdir(DIST_DIR):
        print(f"[ERROR] dist directory not found at: {DIST_DIR}")
        sys.exit(1)

    print(f"[INFO] Starting mDiff threaded server on 0.0.0.0:{PORT} from {DIST_DIR}...")
    server = ThreadingHTTPServer(('0.0.0.0', PORT), MDiffHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    run()
