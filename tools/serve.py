# -*- coding: utf-8 -*-
"""
Máy chủ thử nghiệm trên máy, mô phỏng cách GitHub Pages phục vụ trang:
  /luathinhsu/dieu-173  → dieu-173.html   (đường dẫn không đuôi .html)
  đường dẫn không tồn tại → 404.html với mã 404
  nén gzip các tệp văn bản (HTML, CSS, JS, JSON, SVG) như GitHub Pages

    python3 tools/serve.py            # mở http://localhost:8000/luathinhsu/
    python3 tools/serve.py 8080
"""
import functools
import gzip
import http.server
import io
import os
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREFIX = "/luathinhsu"  # giống địa chỉ trên GitHub Pages: https://willmichco.github.io/luathinhsu/
TEXT = (".html", ".css", ".js", ".json", ".svg", ".xml", ".txt", ".webmanifest")


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        url = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(url.path)
        if path in ("", "/"):
            self.send_response(302)
            self.send_header("Location", PREFIX + "/")
            self.end_headers()
            return None
        if path == PREFIX:
            path = PREFIX + "/"
        if not path.startswith(PREFIX + "/"):
            return self.not_found()
        rel = path[len(PREFIX):]
        local = os.path.join(ROOT, rel.lstrip("/"))
        if rel.endswith("/"):
            local = os.path.join(local, "index.html")
        elif not os.path.exists(local) and os.path.exists(local + ".html"):
            local += ".html"
        if not os.path.isfile(local):
            return self.not_found()
        if local.endswith(TEXT) and "gzip" in self.headers.get("Accept-Encoding", ""):
            body = gzip.compress(open(local, "rb").read(), 6)
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(local))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        self.path = urllib.parse.urlunsplit(("", "", "/" + os.path.relpath(local, ROOT).replace(os.sep, "/"), url.query, ""))
        return super().send_head()

    def not_found(self):
        body = open(os.path.join(ROOT, "404.html"), "rb").read()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return None


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(Handler, directory=ROOT)
    print("Đang phục vụ http://localhost:%d%s/ (Ctrl+C để dừng)" % (port, PREFIX))
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
