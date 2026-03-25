#!/usr/bin/env python3
"""Small local static server for the Fractal Rendering project."""

from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the project over HTTP.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind (default: 8080)")
    parser.add_argument(
        "--dir",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="Directory to serve (default: project root)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    os.chdir(args.dir)

    server = ThreadingHTTPServer((args.host, args.port), SimpleHTTPRequestHandler)
    url = f"http://{args.host}:{args.port}"

    print(f"Serving {args.dir}")
    print(f"Open: {url}")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
