"""Command line entry point.

    python -m gpssim set 19.0760 72.8777
    python -m gpssim route waypoints.gpx --speed 40 --loop
    python -m gpssim clear
    python -m gpssim serve
    python -m gpssim doctor
"""

from __future__ import annotations

import argparse
import json
import logging
import pathlib
import sys

from . import routes
from .device import DeviceError, pick_backend, tunneld_targets
from .player import RoutePlayer

PRESETS_PATH = pathlib.Path(__file__).resolve().parent.parent / "presets.json"


def load_presets() -> dict:
    try:
        return json.loads(PRESETS_PATH.read_text())
    except (OSError, ValueError):
        return {}


def resolve_target(value: str) -> list[tuple[float, float]]:
    """Accept a preset name, a file path, or a literal 'lat,lon'."""
    presets = load_presets()
    if value in presets:
        p = presets[value]
        return [(float(p["lat"]), float(p["lon"]))]

    path = pathlib.Path(value)
    if path.exists():
        text = path.read_text()
        pts = routes.parse_gpx(text) if path.suffix.lower() == ".gpx" else routes.parse_coords(text)
        if not pts:
            raise ValueError(f"no coordinates found in {path}")
        return pts

    return routes.parse_coords(value)


def cmd_set(args) -> int:
    pts = routes.validate(resolve_target(args.location))
    lat, lon = pts[0]
    backend = pick_backend(args.udid, args.backend)
    try:
        backend.set(lat, lon)
        print(f"location set to {lat}, {lon} (via {backend.name} backend)")
    finally:
        backend.close()
    return 0


def cmd_clear(args) -> int:
    backend = pick_backend(args.udid, args.backend)
    try:
        backend.clear()
        print("simulated location cleared - device is back on its real fix")
    finally:
        backend.close()
    return 0


def cmd_route(args) -> int:
    waypoints = routes.validate(resolve_target(args.path))
    if len(waypoints) < 2:
        print("route needs at least two waypoints", file=sys.stderr)
        return 2

    backend = pick_backend(args.udid, args.backend)
    player = RoutePlayer(backend)
    total = player.start(waypoints, args.speed, args.hz, args.loop)
    dist_km = routes.path_length_m(waypoints) / 1000.0
    print(
        f"playing {len(waypoints)} waypoints -> {total} fixes "
        f"({dist_km:.2f} km at {args.speed} km/h, {args.hz} Hz). Ctrl-C to stop."
    )
    try:
        while player.snapshot()["playing"]:
            snap = player.snapshot()
            cur = snap["current"]
            if cur:
                print(f"\r  {snap['index']}/{snap['total']}  {cur[0]:.6f}, {cur[1]:.6f}",
                      end="", flush=True)
            import time
            time.sleep(0.25)
    except KeyboardInterrupt:
        print("\nstopping...")
    finally:
        player.stop()
        backend.close()
    print()
    err = player.snapshot()["error"]
    if err:
        print(f"playback error: {err}", file=sys.stderr)
        return 1
    return 0


def cmd_serve(args) -> int:
    from .server import run_server

    return run_server(host=args.host, port=args.port, udid=args.udid, backend=args.backend)


def cmd_doctor(args) -> int:
    """Report what the tool can see, so setup problems are obvious."""
    print("ios-gps-sim environment check\n")

    try:
        import pymobiledevice3

        version = getattr(pymobiledevice3, "__version__", "unknown")
        print(f"  [ok]   pymobiledevice3 importable (version {version})")
    except ImportError:
        print("  [FAIL] pymobiledevice3 not installed -> pip install -r requirements.txt")
        return 1

    tunnels = tunneld_targets()
    if tunnels:
        print(f"  [ok]   tunneld reachable, {len(tunnels)} device(s): {', '.join(tunnels)}")
    else:
        print("  [warn] tunneld not reachable at 127.0.0.1:49151")
        print("         Required on iOS 17+. Start it in another terminal with:")
        print("           sudo pymobiledevice3 remote tunneld")

    try:
        backend = pick_backend(args.udid, args.backend)
    except DeviceError as exc:
        print(f"  [FAIL] no usable connection: {exc}")
        return 1
    print(f"  [ok]   connected using the {backend.name} backend")
    backend.close()
    print("\nReady. Try:  python -m gpssim set 19.0760 72.8777")
    return 0


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="gpssim",
        description="Simulate GPS on a USB-tethered iPhone using Apple's developer services.",
    )
    ap.add_argument("--udid", help="target a specific device (default: first found)")
    ap.add_argument("--backend", choices=["python", "cli"],
                    help="force a transport instead of auto-selecting")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="command", required=True)

    p = sub.add_parser("set", help="pin the device to one coordinate")
    p.add_argument("location", nargs="+",
                   help="'lat lon', 'lat,lon', a preset name, or a file path")
    p.set_defaults(func=cmd_set)

    p = sub.add_parser("clear", help="release the override, back to the real fix")
    p.set_defaults(func=cmd_clear)

    p = sub.add_parser("route", help="move the device along a path over time")
    p.add_argument("path", help="a .gpx file, a file of 'lat,lon' lines, or inline coords")
    p.add_argument("--speed", type=float, default=40.0, help="ground speed in km/h (default 40)")
    p.add_argument("--hz", type=float, default=1.0, help="fixes per second (default 1)")
    p.add_argument("--loop", action="store_true", help="repeat when the route ends")
    p.set_defaults(func=cmd_route)

    p = sub.add_parser("serve", help="run the local map UI")
    p.add_argument("--host", default="127.0.0.1",
                   help="bind address; use 0.0.0.0 to reach it from the phone over LAN")
    p.add_argument("--port", type=int, default=8765)
    p.set_defaults(func=cmd_serve)

    p = sub.add_parser("doctor", help="check prerequisites and connectivity")
    p.set_defaults(func=cmd_doctor)
    return ap


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )
    # `set` takes nargs=+ so "set 19.07 72.87" works as well as "set 19.07,72.87"
    if getattr(args, "location", None) is not None:
        args.location = " ".join(args.location)

    try:
        return args.func(args)
    except DeviceError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
