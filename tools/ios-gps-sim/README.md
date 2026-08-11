# iPhone GPS Simulator

Set your iPhone's GPS location to any coordinate you choose, from your Mac, over
the USB cable. Nothing is installed on the phone and nothing goes near the App
Store. The override is **device-wide** — Maps, Weather, and any app you're
testing all see the simulated position.

```
python -m gpssim serve          # map UI: click to teleport, shift-click to draw a route
python -m gpssim set 19.0760 72.8777
python -m gpssim route drive.gpx --speed 60 --loop
python -m gpssim clear          # hand control back to the real GPS
```

---

## Why this isn't an app on your phone

The obvious design — install a small app via TestFlight, type coordinates into
it, done — cannot be built. It's worth understanding why, because the limitation
is architectural and no amount of effort routes around it:

- **TestFlight is not a privilege level.** It's Apple-signed distribution with
  the exact same sandbox as an App Store install. A TestFlight build gets no
  capability an App Store build lacks.
- **No entitlement exists for writing a location fix.** CoreLocation is
  read-only to third-party apps. There is no public API, no private-but-signable
  API, and no developer/enterprise entitlement that lets an installed app change
  what `CLLocationManager` reports to *other* apps. Ad-hoc and enterprise
  signing don't change this either.
- An app can of course *display* coordinates you type. But every other app on
  the phone keeps reporting where you physically are, which makes it useless for
  the testing you actually want to do.

The only two things that genuinely override the device's fix are a jailbreak
tweak, and Apple's own developer location-simulation service — the one Xcode
drives for **Debug → Simulate Location**. That service is reachable over the
cable from any computer. This tool speaks to it directly, which is why it gives
you the device-wide behaviour a phone-side app never could.

---

## Requirements

- A Mac (or Linux box) with Python 3.9+
- Your iPhone connected by **USB cable**, unlocked, and Trusted
- **Developer Mode** enabled on the phone:
  Settings → Privacy & Security → Developer Mode → on, then reboot
- For **iOS 17 and newer**: a root tunnel running (see below)

Xcode itself is *not* required.

## Install

```bash
cd tools/ios-gps-sim
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## iOS 17+ tunnel

From iOS 17 Apple moved the developer services behind a RemoteXPC tunnel that
needs root. Start it once in its own terminal and leave it running:

```bash
sudo pymobiledevice3 remote tunneld
```

Then use this tool normally in another terminal — it finds the tunnel on
`127.0.0.1:49151` automatically. On iOS 16 and earlier you can skip this
entirely; the plain usbmux path is used instead.

## Check your setup

```bash
python -m gpssim doctor
```

Reports whether the library is installed, whether tunneld is reachable, and
whether a device can actually be reached — so a broken setup is obvious before
you start chasing coordinates.

---

## The map UI

```bash
python -m gpssim serve
```

Opens on <http://localhost:8765>.

- **Click** anywhere on the map → phone jumps there immediately
- **Shift-click** several times → builds a route polyline
- Set a speed and press **Play route** → phone moves along it in real time,
  emitting fixes at the rate you pick
- **Paste coordinates or a whole GPX document** into the text box and press
  *Load as route*
- **Clear** releases the override; the phone returns to its real GPS

To drive it from the phone's own browser while it stays tethered, bind to the
LAN and visit `http://<your-mac-ip>:8765`:

```bash
python -m gpssim serve --host 0.0.0.0
```

There's no authentication on that port, so only do this on a network you trust.

## CLI

| Command | What it does |
|---|---|
| `set 19.0760 72.8777` | Pin to one coordinate |
| `set mumbai` | Pin to a named preset from `presets.json` |
| `set path/to/file.gpx` | Pin to the first point in a file |
| `route drive.gpx --speed 60` | Move along a path at 60 km/h |
| `route "19.07,72.87; 19.09,72.90" --speed 20` | Inline two-point route |
| `route drive.gpx --loop --hz 2` | Loop forever, two fixes a second |
| `clear` | Release the override |
| `serve` | Start the map UI |
| `doctor` | Diagnose the setup |

Global flags: `--udid` to pick a specific device when several are attached,
`--backend {python,cli}` to force a transport, `-v` for debug logging.

Routes accept `.gpx` files, plain text files of `lat, lon` lines, or inline
coordinates. Comments (`#`) and blank lines are ignored.

---

## How it works

```
your browser / CLI
      |
      v
gpssim  ──  pymobiledevice3  ──USB──  iPhone
                                      DVT location-simulation service
```

`gpssim/device.py` picks one of two transports:

- **`python`** (preferred) imports pymobiledevice3 and holds a single DVT
  session open, so streaming route points at 1–10 Hz is cheap.
- **`cli`** shells out to the `pymobiledevice3` executable once per coordinate.
  Each call pays a fresh handshake (~0.5–1.5 s), so route playback is coarse —
  but it keeps working when the library's internals shift, which they do
  between releases. Selected automatically if the Python path fails.

A "route" is just a stream of discrete fixes: `routes.densify()` walks the
polyline with great-circle maths and emits a point every `speed / hz` metres,
carrying the remainder across waypoints so spacing stays uniform around corners.
`player.RoutePlayer` paces that stream against a monotonic deadline, so a slow
backend call shortens the next sleep instead of stretching the whole run.

## Tests

```bash
python -m unittest discover -s tests -v
```

38 tests covering the geodesy, route densification, GPX/coordinate parsing, the
playback engine (against a fake backend), and every HTTP endpoint. They need no
device — the device layer is the one part that can only be verified against real
hardware.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No iPhone found over USB` | Unlock the phone, tap Trust, try a different cable — data cables only |
| `tunneld not reachable` on iOS 17+ | Run `sudo pymobiledevice3 remote tunneld` in another terminal |
| Location doesn't change | Confirm Developer Mode is on and the phone was rebooted after enabling it |
| Works, then stops after unplugging | The override only lives while the device is connected; it drops on disconnect |
| Route playback stutters | You're on the `cli` backend — check `doctor` output, or lower `--hz` |

To undo everything: run `clear`, or just unplug the phone and reboot it.

## Scope

This tool is standalone and has no connection to the apps in this repo. It
doesn't import from them, they don't import from it, and nothing here ships in
any build.
