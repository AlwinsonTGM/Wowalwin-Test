# Wowolwin

A live game show for Module 8, played in a classroom: one laptop, a projector, and up to forty phones on the presenter's hotspot.

## Running it

| Command | What it does | What it prints |
| --- | --- | --- |
| `npm start` | Builds the client, clears the event log, serves everything from one server. **This is the show-day command.** | `http://192.168.137.1:8787/play` — the join link for the phones |
| `npm run dev` | Server plus Vite, for working on it. | The same link on Vite's port `5173`, since Vite serves the client there |
| `npm run resume` | Restarts the server keeping the event log, after a crash or a restart. | The same link on `8787` |

Phones must be on the laptop's Windows hotspot first, and nothing works until one has joined it. Test on a real phone before the day.

The Backbone is `http://localhost:<port>/` on the presenter's laptop; the Stage is `/stage`.

## Sound

The tick, the sting and the reveal are declared in `src/content/show.ts` and
expected in `public/audio/`. **Nothing ships with them**, so the show starts
silent: a missing or unreadable file is named on the Backbone and never stops a
question or a reveal. See `public/audio/README.md` for what each one is.

## Rehearsing on the day

- **One network adapter up, on the show network.** On the presenter's laptop that is the wired
  ethernet and the ONT's Wi-Fi, with laptop Wi-Fi, Tailscale and any VPN off. The console prints
  one address and will not guess: with two private addresses up it prints `??` and says why,
  because a wrong address is indistinguishable from a broken app.
- **The printed address is the wired adapter's**, on `192.168.100.` — not the Tailscale one
  (`169.254.`) that a phone can never open.
- **The Windows Firewall rule must allow node.exe on the Private profile.** The rule on this
  machine allows `Public` only while the ethernet profile is `Private`, so inbound is blocked
  and the symptom is a phone that loads nothing at all.
- **The 2.4GHz and 5GHz bands have different SSIDs.** On one shared SSID the ONT enables band
  steering and pushes phones onto the shorter-range band, so the back of the room drops.
  Separate SSIDs turn it off and let the room split across both bands, which is what keeps each
  one under Huawei's own 30-per-band guidance.