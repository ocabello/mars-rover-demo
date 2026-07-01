#!/usr/bin/env python3
"""Static file server for Project Ark-3 with iframe-friendly headers."""

from __future__ import annotations

import argparse
import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class EmbedFriendlyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        # Allow embedding in third-party iframes (e.g. Expo web).
        # Do not set X-Frame-Options: DENY or SAMEORIGIN.
        self.send_header('Content-Security-Policy', 'frame-ancestors *')
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description='Serve Project Ark-3 for local dev and iframe embeds.')
    parser.add_argument('--port', type=int, default=8080, help='Port to listen on (default: 8080)')
    args = parser.parse_args()

    with socketserver.TCPServer(('', args.port), EmbedFriendlyHandler) as httpd:
        print(f'Serving {ROOT} at http://localhost:{args.port}/')
        print('Iframe-friendly headers enabled (frame-ancestors *; no X-Frame-Options).')
        httpd.serve_forever()


if __name__ == '__main__':
    main()
