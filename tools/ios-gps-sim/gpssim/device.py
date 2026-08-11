"""Talks to a tethered iPhone's location-simulation service.

Apple exposes location override through the DVT (instruments) channel that
Xcode itself uses for Debug -> Simulate Location. pymobiledevice3 speaks that
protocol, so this module is a thin, version-tolerant wrapper over it.

Two backends are provided because pymobiledevice3's Python API has churned a
lot across releases (especially around the iOS 17+ RemoteXPC tunnel):

  PythonBackend - imports pymobiledevice3 and holds one DVT session open.
                  Fast enough to stream route points at 1 Hz.
  CliBackend    - shells out to the `pymobiledevice3` executable per point.
                  Slower (a fresh handshake each call, typically 0.5-1.5s)
                  but keeps working when the library's internals move.

pick_backend() tries Python first and falls back to the CLI.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import threading
import urllib.error
import urllib.request

log = logging.getLogger(__name__)

# tunneld's default HTTP endpoint. Only relevant for iOS 17 and newer, where
# the developer services moved behind a RemoteXPC tunnel that needs root.
TUNNELD_URL = "http://127.0.0.1:49151"


class DeviceError(RuntimeError):
    """Raised for anything the operator can fix: no device, no tunnel, etc."""


def tunneld_targets() -> dict:
    """Return tunneld's view of connected devices, or {} if it isn't running."""
    try:
        with urllib.request.urlopen(TUNNELD_URL + "/", timeout=2) as resp:
            return json.load(resp)
    except (urllib.error.URLError, OSError, ValueError):
        return {}


def _first_tunnel(udid: str | None = None) -> tuple[str, int] | None:
    """Pull a (host, port) RSD address out of tunneld's response.

    The payload shape has changed between releases - older builds map a udid to
    a single dict, newer ones to a list of dicts - so handle both.
    """
    targets = tunneld_targets()
    if not targets:
        return None

    for dev_udid, entry in targets.items():
        if udid and dev_udid != udid:
            continue
        candidates = entry if isinstance(entry, list) else [entry]
        for cand in candidates:
            if not isinstance(cand, dict):
                continue
            host = cand.get("tunnel-address") or cand.get("address")
            port = cand.get("tunnel-port") or cand.get("port")
            if host and port:
                return str(host), int(port)
    return None


class PythonBackend:
    """Holds a single DVT session open for the life of the object."""

    name = "python"

    def __init__(self, udid: str | None = None):
        self.udid = udid
        self._lock = threading.Lock()
        self._stack: list = []
        self._sim = None
        self._connect()

    def _connect(self) -> None:
        try:
            from pymobiledevice3.services.dvt.dvt_secure_socket_proxy import (
                DvtSecureSocketProxyService,
            )
            from pymobiledevice3.services.dvt.instruments.location_simulation import (
                LocationSimulation,
            )
        except ImportError as exc:
            raise DeviceError(
                "pymobiledevice3 is not installed or is too old.\n"
                "  pip install -r requirements.txt"
            ) from exc

        service_provider = self._service_provider()
        dvt = DvtSecureSocketProxyService(lockdown=service_provider)
        dvt.__enter__()
        self._stack.append(dvt)
        self._sim = LocationSimulation(dvt)

    def _service_provider(self):
        """Return an RSD handle (iOS 17+) or a plain lockdown client."""
        rsd_addr = _first_tunnel(self.udid)
        if rsd_addr is not None:
            from pymobiledevice3.remote.remote_service_discovery import (
                RemoteServiceDiscoveryService,
            )

            rsd = RemoteServiceDiscoveryService(rsd_addr)
            rsd.connect()
            self._stack.append(rsd)
            log.info("connected via tunneld at %s:%s", *rsd_addr)
            return rsd

        from pymobiledevice3.lockdown import create_using_usbmux
        from pymobiledevice3.exceptions import NoDeviceConnectedError

        try:
            lockdown = create_using_usbmux(serial=self.udid)
        except NoDeviceConnectedError as exc:
            raise DeviceError(
                "No iPhone found over USB. Check the cable, unlock the phone, "
                "and tap Trust if prompted."
            ) from exc
        log.info("connected over usbmux (pre-iOS 17 path)")
        return lockdown

    def set(self, lat: float, lon: float) -> None:
        with self._lock:
            self._sim.set(lat, lon)

    def clear(self) -> None:
        with self._lock:
            self._sim.clear()

    def close(self) -> None:
        with self._lock:
            while self._stack:
                obj = self._stack.pop()
                try:
                    obj.__exit__(None, None, None) if hasattr(obj, "__exit__") else obj.close()
                except Exception:  # noqa: BLE001 - teardown must not mask errors
                    log.debug("ignoring error closing %r", obj, exc_info=True)


class CliBackend:
    """Fallback that shells out once per coordinate.

    Every call pays a fresh handshake, so route playback through this backend
    is coarse. It exists so the tool degrades instead of dying when the Python
    API shifts under us.
    """

    name = "cli"

    def __init__(self, udid: str | None = None):
        self.udid = udid
        if shutil.which("pymobiledevice3") is None:
            raise DeviceError("`pymobiledevice3` executable not found on PATH.")
        self._lock = threading.Lock()

    def _run(self, *args: str) -> None:
        cmd = ["pymobiledevice3", "developer", "dvt", "simulate-location", *args]
        if self.udid:
            cmd += ["--udid", self.udid]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if proc.returncode != 0:
            raise DeviceError(
                f"{' '.join(cmd)} failed ({proc.returncode}):\n"
                f"{proc.stderr.strip() or proc.stdout.strip()}"
            )

    def set(self, lat: float, lon: float) -> None:
        with self._lock:
            self._run("set", "--", str(lat), str(lon))

    def clear(self) -> None:
        with self._lock:
            self._run("clear")

    def close(self) -> None:
        return


def pick_backend(udid: str | None = None, force: str | None = None):
    """Return a connected backend, preferring the faster Python one."""
    if force == "cli":
        return CliBackend(udid)
    if force == "python":
        return PythonBackend(udid)

    try:
        return PythonBackend(udid)
    except DeviceError:
        raise
    except Exception as exc:  # noqa: BLE001 - library internals vary by version
        log.warning("python backend unavailable (%s); falling back to CLI", exc)
        return CliBackend(udid)
