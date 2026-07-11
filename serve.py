#!/usr/bin/env python3
"""Tiny dev server that disables caching so edits always show on refresh.
Usage: python3 serve.py [port]   (default 8090)
"""
import functools
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
DIRECTORY = "/Users/ralphcapriglione/the-nail-bar"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
Handler = functools.partial(NoCacheHandler, directory=DIRECTORY)
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("The Nail Bar — no-cache dev server on http://localhost:%d" % PORT)
    httpd.serve_forever()
