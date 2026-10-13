# The show runs over a local hotspot and a WebSocket server, not a deployment

There are three client surfaces: the Backbone on the presenter's laptop, the Stage on the projector, and one Player phone per contestant, up to forty of them. They all need to see the same state within a second or the show dies. We serve all three from a single Node WebSocket server running on the presenter's own machine, with players reaching it over a Windows mobile hotspot.

The rejected option was `BroadcastChannel`, which shares state between same-origin browser windows with no server at all. It is simpler, cannot fail to connect, and survives total network failure — and it was the right call until the Player phones became separate devices rather than extra windows on the laptop. `BroadcastChannel` cannot cross devices, so it cannot carry the tournament.

This is worth recording because the code will look wrong to a reader who assumes an internet deployment. **The server must bind to `0.0.0.0`, not `localhost`.** `localhost` means *this machine only*, so a phone on the hotspot can never reach it, and the failure looks like a broken app rather than a misconfigured one. Vite's dev server also binds localhost-only by default and needs `--host`. Windows Firewall can silently drop inbound connections on the hotspot interface. The address players actually open is the laptop's hotspot address, normally `192.168.137.1`.

The consequence for rehearsal: nothing works until a phone has joined the hotspot once. Test on a real phone before the day, not on the laptop.