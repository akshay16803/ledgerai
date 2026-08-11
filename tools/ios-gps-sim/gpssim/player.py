"""Background route playback with a paced emit loop."""

from __future__ import annotations

import logging
import threading
import time

from . import routes
from .routes import Point

log = logging.getLogger(__name__)


class RoutePlayer:
    """Streams a densified route to a backend on a worker thread.

    Only one route runs at a time; start() replaces whatever was playing.
    """

    def __init__(self, backend):
        self.backend = backend
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._state = {
            "playing": False,
            "index": 0,
            "total": 0,
            "current": None,
            "error": None,
        }

    # -- state ---------------------------------------------------------------

    def snapshot(self) -> dict:
        with self._lock:
            return dict(self._state)

    def _update(self, **kw) -> None:
        with self._lock:
            self._state.update(kw)

    # -- control -------------------------------------------------------------

    def start(self, waypoints: list[Point], speed_kmh: float, hz: float = 1.0,
              loop: bool = False) -> int:
        self.stop()
        pts = list(routes.densify(routes.validate(waypoints), speed_kmh, hz))
        if not pts:
            raise ValueError("route produced no points")

        self._stop.clear()
        self._update(playing=True, index=0, total=len(pts), current=pts[0], error=None)
        self._thread = threading.Thread(
            target=self._run, args=(pts, hz, loop), name="route-player", daemon=True
        )
        self._thread.start()
        return len(pts)

    def stop(self) -> None:
        self._stop.set()
        thread = self._thread
        if thread is not None and thread.is_alive():
            thread.join(timeout=5)
        self._thread = None
        self._update(playing=False)

    # -- worker --------------------------------------------------------------

    def _run(self, pts: list[Point], hz: float, loop: bool) -> None:
        interval = 1.0 / hz
        try:
            while not self._stop.is_set():
                # Pace against a monotonic deadline so a slow backend call
                # shortens the next sleep instead of stretching the whole run.
                deadline = time.monotonic()
                for i, (lat, lon) in enumerate(pts):
                    if self._stop.is_set():
                        return
                    self.backend.set(lat, lon)
                    self._update(index=i + 1, current=(lat, lon))

                    deadline += interval
                    slack = deadline - time.monotonic()
                    if slack > 0:
                        if self._stop.wait(slack):
                            return
                    elif slack < -interval:
                        # Backend can't keep up with the requested rate.
                        deadline = time.monotonic()
                if not loop:
                    return
        except Exception as exc:  # noqa: BLE001 - surface to the UI, don't crash
            log.exception("route playback failed")
            self._update(error=str(exc))
        finally:
            self._update(playing=False)
