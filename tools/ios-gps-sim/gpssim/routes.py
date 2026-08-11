"""Great-circle maths and GPX parsing for route playback.

The device service only accepts discrete points, so a "route" is really just a
stream of fixes emitted at a fixed rate. densify() turns a handful of waypoints
into that stream at a chosen ground speed.
"""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET
from typing import Iterable, Iterator

EARTH_RADIUS_M = 6_371_008.8

Point = tuple[float, float]


def haversine_m(a: Point, b: Point) -> float:
    """Distance in metres between two (lat, lon) pairs."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def initial_bearing(a: Point, b: Point) -> float:
    """Bearing in degrees when leaving a for b."""
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlon = math.radians(b[1] - a[1])
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def destination(origin: Point, bearing_deg: float, distance_m: float) -> Point:
    """Walk distance_m from origin along bearing_deg."""
    lat1, lon1 = math.radians(origin[0]), math.radians(origin[1])
    brng = math.radians(bearing_deg)
    ang = distance_m / EARTH_RADIUS_M

    lat2 = math.asin(math.sin(lat1) * math.cos(ang) + math.cos(lat1) * math.sin(ang) * math.cos(brng))
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(ang) * math.cos(lat1),
        math.cos(ang) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540.0) % 360.0 - 180.0


def path_length_m(points: list[Point]) -> float:
    return sum(haversine_m(points[i], points[i + 1]) for i in range(len(points) - 1))


def densify(points: list[Point], speed_kmh: float, hz: float = 1.0) -> Iterator[Point]:
    """Yield fixes along the polyline at `hz` samples per second.

    Speed is constant across the whole path; corners are not smoothed, which is
    fine for testing since real GPS traces are not smooth either.
    """
    if len(points) < 2:
        if points:
            yield points[0]
        return
    if speed_kmh <= 0:
        raise ValueError("speed_kmh must be positive")
    if hz <= 0:
        raise ValueError("hz must be positive")

    step_m = (speed_kmh * 1000.0 / 3600.0) / hz
    if step_m <= 0:
        raise ValueError("computed step distance is zero")

    yield points[0]
    # Distance along the current leg where the next fix belongs. Carrying the
    # overshoot into the following leg keeps spacing uniform across corners.
    next_at = step_m

    for i in range(len(points) - 1):
        start, end = points[i], points[i + 1]
        leg_len = haversine_m(start, end)
        if leg_len == 0:
            continue
        bearing = initial_bearing(start, end)
        while next_at <= leg_len:
            yield destination(start, bearing, next_at)
            next_at += step_m
        next_at -= leg_len

    if points[-1] != points[0]:
        yield points[-1]


def parse_gpx(text: str) -> list[Point]:
    """Extract track/route/waypoint coordinates from a GPX document."""
    root = ET.fromstring(text)
    # GPX namespaces vary by producer, so match on the local tag name instead.
    out: list[Point] = []
    for elem in root.iter():
        tag = elem.tag.rsplit("}", 1)[-1]
        if tag not in ("trkpt", "rtept", "wpt"):
            continue
        lat, lon = elem.get("lat"), elem.get("lon")
        if lat is None or lon is None:
            continue
        try:
            out.append((float(lat), float(lon)))
        except ValueError:
            continue
    return out


def parse_coords(text: str) -> list[Point]:
    """Parse loose 'lat, lon' input - one pair per line, comma or space split."""
    out: list[Point] = []
    for raw in text.replace(";", "\n").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p for p in line.replace(",", " ").split() if p]
        if len(parts) < 2:
            raise ValueError(f"could not read a lat/lon pair from {raw!r}")
        out.append((float(parts[0]), float(parts[1])))
    return out


def validate(points: Iterable[Point]) -> list[Point]:
    checked = []
    for lat, lon in points:
        if not -90.0 <= lat <= 90.0:
            raise ValueError(f"latitude {lat} out of range")
        if not -180.0 <= lon <= 180.0:
            raise ValueError(f"longitude {lon} out of range")
        checked.append((lat, lon))
    if not checked:
        raise ValueError("no coordinates given")
    return checked
