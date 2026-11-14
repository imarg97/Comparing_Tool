#!/usr/bin/env python3
"""
mDiff Production Static Server (Universal Python 3 Engine)
Compatible with Python 3.6 through 3.13+ on RHEL, CentOS, Debian, Ubuntu, macOS.
Guarantees correct ES Module MIME types, handles SPA routing, and runs multi-threaded.
"""

import os
import sys
import urllib.parse
import posixpath

# Backward compatibility with Python 3.6 (standard on RHEL 8 / CentOS 8)
try:
    from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
except ImportError:
    from socketserver import ThreadingMixIn
    from http.server import HTTPServer, SimpleHTTPRequestHandler
    class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8097
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Locate dist directory whether running from deploy/ or repository root
if os.path.isdir(os.path.join(SCRIPT_DIR, 'dist')):
    DIST_DIR = os.path.join(SCRIPT_DIR, 'dist')
elif os.path.isdir(os.path.join(SCRIPT_DIR, '..', 'dist')):
    DIST_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'dist'))
else:
    DIST_DIR = os.path.abspath('dist')

# Always change working directory to DIST_DIR so any standard SimpleHTTPRequestHandler functions correctly
if os.path.isdir(DIST_DIR):
    os.chdir(DIST_DIR)

# Comprehensive MIME mapping to guarantee browser execution of modules and styles
MIME_MAP = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.map': 'application/json',
}

class MDiffHandler(SimpleHTTPRequestHandler):
    # Do NOT accept or pass directory keyword argument in __init__ for Python 3.6 compatibility
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME_MAP.get(ext, 'application/octet-stream')

    def translate_path(self, path):
        # Sanitize path, strip query/hash
        path = path.split('?', 1)[0].split('#', 1)[0]
        unquoted = urllib.parse.unquote(path)
        norm = posixpath.normpath(unquoted)
        rel = norm.lstrip('/')
        
        # Root path -> serve index.html
        if not rel or rel == '.':
            return os.path.join(DIST_DIR, 'index.html')
            
        full = os.path.join(DIST_DIR, rel)
        if os.path.isdir(full):
            idx = os.path.join(full, 'index.html')
            if os.path.exists(idx):
                return idx
                
        # SPA routing: if requesting a route that is not an asset, serve index.html
        if not os.path.exists(full):
            # Defensive check: if asset was requested at root without /assets/ prefix
            asset_alt = os.path.join(DIST_DIR, 'assets', rel)
            if os.path.isfile(asset_alt):
                return asset_alt
            if not rel.startswith('assets/'):
                return os.path.join(DIST_DIR, 'index.html')
            
        return full

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        path_lower = self.path.lower()
        if path_lower.endswith('.html') or path_lower in ('', '/', '/index.html'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        else:
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        
        # If directory or missing, fall back to index.html
        if os.path.isdir(path):
            index_path = os.path.join(path, 'index.html')
            if os.path.exists(index_path):
                path = index_path
            else:
                path = os.path.join(DIST_DIR, 'index.html')
        elif not os.path.isfile(path) and not self.path.startswith('/assets/'):
            path = os.path.join(DIST_DIR, 'index.html')

        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None

        try:
            fs = os.fstat(f.fileno())
            ctype = self.guess_type(path)
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(fs[6]))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        except Exception:
            f.close()
            raise

    def log_message(self, format, *args):
        # Flush stdout/stderr immediately so tail -f mdiff.log works in real time
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))
        sys.stderr.flush()

def run():
    if not os.path.isdir(DIST_DIR):
        sys.stderr.write(f"[ERROR] dist directory not found at: {DIST_DIR}\n")
        sys.stderr.flush()
        sys.exit(1)

    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer(('0.0.0.0', PORT), MDiffHandler)
    sys.stderr.write(f"[INFO] mDiff Python server listening on 0.0.0.0:{PORT} (serving {DIST_DIR})\n")
    sys.stderr.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    run()
