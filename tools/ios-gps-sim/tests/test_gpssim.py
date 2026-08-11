"""Tests for the parts that run without a device attached.

Anything touching pymobiledevice3 needs real hardware, so the device layer is
exercised through a fake backend instead.
"""

import json
import sys
import threading
import time
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gpssim import routes  # noqa: E402
from gpssim.player import RoutePlayer  # noqa: E402


class FakeBackend:
    name = "fake"

    def __init__(self, delay=0.0):
        self.points = []
        self.cleared = 0
        self.delay = delay
        self._lock = threading.Lock()

    def set(self, lat, lon):
        if self.delay:
            time.sleep(self.delay)
        with self._lock:
            self.points.append((lat, lon))

    def clear(self):
        self.cleared += 1

    def close(self):
        pass


class TestGeo(unittest.TestCase):
    def test_haversine_known_distance(self):
        # Mumbai -> Delhi is about 1150 km great-circle.
        d = routes.haversine_m((19.0760, 72.8777), (28.6139, 77.2090))
        self.assertAlmostEqual(d / 1000.0, 1153, delta=15)

    def test_zero_distance(self):
        self.assertAlmostEqual(routes.haversine_m((10.0, 20.0), (10.0, 20.0)), 0.0)

    def test_bearing_due_north(self):
        self.assertAlmostEqual(routes.initial_bearing((0.0, 0.0), (1.0, 0.0)), 0.0, places=4)

    def test_bearing_due_east(self):
        self.assertAlmostEqual(routes.initial_bearing((0.0, 0.0), (0.0, 1.0)), 90.0, places=4)

    def test_destination_roundtrip(self):
        start = (19.0760, 72.8777)
        end = routes.destination(start, 45.0, 5000.0)
        self.assertAlmostEqual(routes.haversine_m(start, end), 5000.0, delta=1.0)
        self.assertAlmostEqual(routes.initial_bearing(start, end), 45.0, delta=0.1)

    def test_destination_crossing_antimeridian_stays_in_range(self):
        lat, lon = routes.destination((0.0, 179.9), 90.0, 50_000.0)
        self.assertTrue(-180.0 <= lon <= 180.0, f"lon {lon} out of range")
        self.assertLess(lat, 0.001)


class TestDensify(unittest.TestCase):
    def test_point_spacing_matches_speed(self):
        # 36 km/h = 10 m/s, so at 1 Hz consecutive fixes sit 10 m apart.
        pts = list(routes.densify([(0.0, 0.0), (0.05, 0.0)], speed_kmh=36.0, hz=1.0))
        self.assertGreater(len(pts), 10)
        for a, b in zip(pts[:-2], pts[1:-1]):
            self.assertAlmostEqual(routes.haversine_m(a, b), 10.0, delta=0.5)

    def test_endpoints_preserved(self):
        start, end = (19.0, 72.0), (19.01, 72.01)
        pts = list(routes.densify([start, end], speed_kmh=50.0))
        self.assertEqual(pts[0], start)
        self.assertAlmostEqual(routes.haversine_m(pts[-1], end), 0.0, delta=1.0)

    def test_multi_leg_has_no_gap_at_the_corner(self):
        legs = [(0.0, 0.0), (0.01, 0.0), (0.01, 0.01)]
        pts = list(routes.densify(legs, speed_kmh=36.0, hz=1.0))
        gaps = [routes.haversine_m(a, b) for a, b in zip(pts[:-2], pts[1:-1])]
        # Carry-over across legs should keep spacing uniform, not reset to 0.
        self.assertLess(max(gaps), 11.0, "spacing jumped at a waypoint boundary")
        self.assertGreater(min(gaps), 0.5, "duplicate point emitted at a waypoint")

    def test_single_point(self):
        self.assertEqual(list(routes.densify([(1.0, 2.0)], 40.0)), [(1.0, 2.0)])

    def test_empty(self):
        self.assertEqual(list(routes.densify([], 40.0)), [])

    def test_rejects_bad_speed(self):
        with self.assertRaises(ValueError):
            list(routes.densify([(0.0, 0.0), (1.0, 1.0)], speed_kmh=0.0))


class TestParsing(unittest.TestCase):
    def test_parse_coords_variants(self):
        text = "19.0760, 72.8777\n28.6139 77.2090\n# a comment\n\n12.9716,77.5946"
        self.assertEqual(
            routes.parse_coords(text),
            [(19.0760, 72.8777), (28.6139, 77.2090), (12.9716, 77.5946)],
        )

    def test_parse_coords_semicolons(self):
        self.assertEqual(routes.parse_coords("1,2; 3,4"), [(1.0, 2.0), (3.0, 4.0)])

    def test_parse_coords_rejects_single_number(self):
        with self.assertRaises(ValueError):
            routes.parse_coords("19.07")

    def test_parse_gpx_namespaced(self):
        gpx = """<?xml version="1.0"?>
        <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
          <trk><trkseg>
            <trkpt lat="19.0760" lon="72.8777"><ele>10</ele></trkpt>
            <trkpt lat="19.0800" lon="72.8810"/>
          </trkseg></trk>
        </gpx>"""
        self.assertEqual(routes.parse_gpx(gpx), [(19.0760, 72.8777), (19.0800, 72.8810)])

    def test_parse_gpx_waypoints_and_routes(self):
        gpx = ('<gpx><wpt lat="1" lon="2"/><rte><rtept lat="3" lon="4"/></rte></gpx>')
        self.assertEqual(routes.parse_gpx(gpx), [(1.0, 2.0), (3.0, 4.0)])

    def test_validate_range(self):
        with self.assertRaises(ValueError):
            routes.validate([(91.0, 0.0)])
        with self.assertRaises(ValueError):
            routes.validate([(0.0, 181.0)])
        with self.assertRaises(ValueError):
            routes.validate([])


class TestPlayer(unittest.TestCase):
    def test_plays_and_stops(self):
        fake = FakeBackend()
        player = RoutePlayer(fake)
        total = player.start([(0.0, 0.0), (0.002, 0.0)], speed_kmh=360.0, hz=20.0)
        self.assertGreater(total, 2)
        deadline = time.monotonic() + 10
        while player.snapshot()["playing"] and time.monotonic() < deadline:
            time.sleep(0.05)
        player.stop()
        self.assertFalse(player.snapshot()["playing"])
        self.assertEqual(len(fake.points), total)
        self.assertIsNone(player.snapshot()["error"])

    def test_stop_interrupts_a_long_route(self):
        player = RoutePlayer(FakeBackend())
        player.start([(0.0, 0.0), (1.0, 0.0)], speed_kmh=5.0, hz=1.0)
        time.sleep(0.3)
        player.stop()
        self.assertFalse(player.snapshot()["playing"])

    def test_start_replaces_previous_route(self):
        player = RoutePlayer(FakeBackend())
        player.start([(0.0, 0.0), (1.0, 0.0)], speed_kmh=5.0, hz=1.0)
        player.start([(2.0, 2.0), (2.001, 2.0)], speed_kmh=360.0, hz=20.0)
        self.assertLess(player.snapshot()["total"], 100)
        player.stop()

    def test_backend_error_is_captured_not_raised(self):
        class Boom(FakeBackend):
            def set(self, lat, lon):
                raise RuntimeError("device went away")

        player = RoutePlayer(Boom())
        player.start([(0.0, 0.0), (0.001, 0.0)], speed_kmh=100.0, hz=10.0)
        deadline = time.monotonic() + 5
        while player.snapshot()["playing"] and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertEqual(player.snapshot()["error"], "device went away")


class TestServer(unittest.TestCase):
    """Drive the real HTTP handler against a fake device."""

    @classmethod
    def setUpClass(cls):
        from http.server import ThreadingHTTPServer
        from gpssim.server import Handler

        cls.fake = FakeBackend()
        Handler.backend = cls.fake
        Handler.player = RoutePlayer(cls.fake)
        Handler.last_fix = None
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def call(self, path, body=None):
        url = f"http://127.0.0.1:{self.port}{path}"
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, json.load(resp)
        except urllib.error.HTTPError as exc:
            return exc.code, json.load(exc)

    def test_index_served(self):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/", timeout=5) as r:
            body = r.read().decode()
        self.assertEqual(r.status, 200)
        self.assertIn("iPhone GPS Simulator", body)

    def test_set_location(self):
        status, data = self.call("/api/location", {"lat": 19.076, "lon": 72.8777})
        self.assertEqual(status, 200)
        self.assertEqual(data["lastFix"], [19.076, 72.8777])
        self.assertIn((19.076, 72.8777), self.fake.points)

    def test_set_rejects_out_of_range(self):
        status, data = self.call("/api/location", {"lat": 99.0, "lon": 0.0})
        self.assertEqual(status, 400)
        self.assertIn("latitude", data["error"])

    def test_set_rejects_missing_field(self):
        status, _ = self.call("/api/location", {"lat": 19.0})
        self.assertEqual(status, 400)

    def test_clear(self):
        self.call("/api/location", {"lat": 1.0, "lon": 2.0})
        status, data = self.call("/api/clear", {})
        self.assertEqual(status, 200)
        self.assertIsNone(data["lastFix"])
        self.assertGreater(self.fake.cleared, 0)

    def test_presets_load(self):
        status, data = self.call("/api/presets")
        self.assertEqual(status, 200)
        self.assertIn("mumbai", data)
        self.assertEqual(data["mumbai"]["lat"], 19.0760)

    def test_route_start_and_stop(self):
        status, data = self.call("/api/route/start", {
            "points": [[0.0, 0.0], [0.01, 0.0]], "speed": 100, "hz": 5
        })
        self.assertEqual(status, 200)
        self.assertGreater(data["generated"], 2)
        self.assertAlmostEqual(data["distanceKm"], 1.11, delta=0.05)
        status, data = self.call("/api/route/stop", {})
        self.assertEqual(status, 200)
        self.assertFalse(data["route"]["playing"])

    def test_route_needs_two_points(self):
        status, data = self.call("/api/route/start", {"points": [[0.0, 0.0]]})
        self.assertEqual(status, 400)
        self.assertIn("two points", data["error"])

    def test_parse_endpoint_coords(self):
        status, data = self.call("/api/parse", {"text": "1,2\n3,4"})
        self.assertEqual(status, 200)
        self.assertEqual(data["points"], [[1.0, 2.0], [3.0, 4.0]])

    def test_parse_endpoint_gpx(self):
        status, data = self.call("/api/parse", {"text": '<gpx><wpt lat="5" lon="6"/></gpx>'})
        self.assertEqual(status, 200)
        self.assertEqual(data["points"], [[5.0, 6.0]])

    def test_parse_empty_is_rejected(self):
        status, _ = self.call("/api/parse", {"text": "   "})
        self.assertEqual(status, 400)

    def test_unknown_route_404(self):
        status, _ = self.call("/api/nope", {})
        self.assertEqual(status, 404)


class TestCliParsing(unittest.TestCase):
    def test_set_accepts_space_separated(self):
        from gpssim.cli import build_parser

        args = build_parser().parse_args(["set", "19.07", "72.87"])
        self.assertEqual(args.location, ["19.07", "72.87"])

    def test_route_defaults(self):
        from gpssim.cli import build_parser

        args = build_parser().parse_args(["route", "x.gpx"])
        self.assertEqual(args.speed, 40.0)
        self.assertEqual(args.hz, 1.0)
        self.assertFalse(args.loop)

    def test_resolve_target_preset(self):
        from gpssim.cli import resolve_target

        self.assertEqual(resolve_target("mumbai"), [(19.0760, 72.8777)])

    def test_resolve_target_inline(self):
        from gpssim.cli import resolve_target

        self.assertEqual(resolve_target("19.07,72.87"), [(19.07, 72.87)])


if __name__ == "__main__":
    unittest.main(verbosity=2)
