"""Local web UI: a map you click to move the phone.

Built on the standard library's HTTP server so the only third-party dependency
in the whole tool stays pymobiledevice3. Binds to loopback by default; pass
--host 0.0.0.0 to drive it from the phone's own browser over the LAN while it
stays tethered for the location channel.
"""

from __future__ import annotations

import json
import logging
import pathlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import routes
from .device import DeviceError, pick_backend
from .player import RoutePlayer

log = logging.getLogger(__name__)

WEB_DIR = pathlib.Path(__file__).resolve().parent / "web"
PRESETS_PATH = pathlib.Path(__file__).resolve().parent.parent / "presets.json"

MAX_BODY_BYTES = 2 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    server_version = "gpssim"
    backend = None       # injected in run_server
    player: RoutePlayer  # injected in run_server
    last_fix = None

    # -- helpers -------------------------------------------------------------

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY_BYTES:
            raise ValueError("request body too large")
        return json.loads(self.rfile.read(length) or b"{}")

    def log_message(self, fmt, *args):  # quieter default logging
        log.debug("%s - %s", self.address_string(), fmt % args)

    # -- routing -------------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if self.path in ("/", "/index.html"):
            self._serve_file(WEB_DIR / "index.html", "text/html; charset=utf-8")
        elif self.path == "/api/status":
            self._send_json(self._status())
        elif self.path == "/api/presets":
            self._send_json(self._presets())
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self) -> None:  # noqa: N802 - stdlib naming
        try:
            body = self._read_json()
            if self.path == "/api/location":
                self._set_location(body)
            elif self.path == "/api/clear":
                self._clear()
            elif self.path == "/api/route/start":
                self._route_start(body)
            elif self.path == "/api/route/stop":
                type(self).player.stop()
                self._send_json(self._status())
            elif self.path == "/api/parse":
                self._parse(body)
            else:
                self._send_json({"error": "not found"}, 404)
        except (ValueError, KeyError) as exc:
            self._send_json({"error": str(exc)}, 400)
        except DeviceError as exc:
            self._send_json({"error": str(exc)}, 503)
        except Exception as exc:  # noqa: BLE001 - never drop the connection silently
            log.exception("request failed")
            self._send_json({"error": f"unexpected: {exc}"}, 500)

    # -- endpoints -----------------------------------------------------------

    def _serve_file(self, path: pathlib.Path, ctype: str) -> None:
        try:
            data = path.read_bytes()
        except OSError:
            self._send_json({"error": "not found"}, 404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _presets(self) -> dict:
        try:
            return json.loads(PRESETS_PATH.read_text())
        except (OSError, ValueError):
            return {}

    def _status(self) -> dict:
        cls = type(self)
        snap = cls.player.snapshot()
        return {
            "backend": cls.backend.name if cls.backend else None,
            "lastFix": cls.last_fix,
            "route": snap,
        }

    def _set_location(self, body: dict) -> None:
        cls = type(self)
        cls.player.stop()
        lat, lon = routes.validate([(float(body["lat"]), float(body["lon"]))])[0]
        cls.backend.set(lat, lon)
        cls.last_fix = [lat, lon]
        self._send_json(self._status())

    def _clear(self) -> None:
        cls = type(self)
        cls.player.stop()
        cls.backend.clear()
        cls.last_fix = None
        self._send_json(self._status())

    def _route_start(self, body: dict) -> None:
        cls = type(self)
        pts = routes.validate([(float(a), float(b)) for a, b in body["points"]])
        if len(pts) < 2:
            raise ValueError("a route needs at least two points")
        total = cls.player.start(
            pts,
            speed_kmh=float(body.get("speed", 40.0)),
            hz=float(body.get("hz", 1.0)),
            loop=bool(body.get("loop", False)),
        )
        payload = self._status()
        payload["generated"] = total
        payload["distanceKm"] = routes.path_length_m(pts) / 1000.0
        self._send_json(payload)

    def _parse(self, body: dict) -> None:
        """Turn pasted text or an uploaded GPX into waypoints for the map."""
        text = body.get("text", "")
        if not text.strip():
            raise ValueError("nothing to parse")
        pts = routes.parse_gpx(text) if text.lstrip().startswith("<") else routes.parse_coords(text)
        pts = routes.validate(pts)
        self._send_json({"points": [list(p) for p in pts]})


def run_server(host: str = "127.0.0.1", port: int = 8765,
               udid: str | None = None, backend: str | None = None) -> int:
    dev = pick_backend(udid, backend)
    Handler.backend = dev
    Handler.player = RoutePlayer(dev)

    httpd = ThreadingHTTPServer((host, port), Handler)
    shown = "localhost" if host in ("127.0.0.1", "0.0.0.0") else host
    print(f"gpssim UI on http://{shown}:{port}  (backend: {dev.name})")
    if host == "0.0.0.0":
        print("bound to all interfaces - reachable from other devices on this network")
    print("Ctrl-C to stop")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
    finally:
        Handler.player.stop()
        httpd.server_close()
        dev.close()
    return 0
