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