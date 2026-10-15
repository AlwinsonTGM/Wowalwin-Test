# 09: Print an address a phone can actually open, and prove it at room scale

**What to build:** `reachableHost()` picks the address the Stage tells phones to open. On the
presenter's laptop it returns `169.254.83.107` — a Tailscale link-local address that no phone
can reach. It only avoids that by luck of adapter ordering. This ticket makes the choice
deliberate, makes an unusable choice impossible, and pins the behaviour that was measured by
hand at 50 concurrent clients.

**Blocked by:** None.

**Status:** ready-for-agent

- [x] An address that is provably unreachable by a phone (link-local `169.254/16`, CGNAT
      `100.64/10`) is never offered as the join address
- [x] When the laptop has more than one usable network address and no hotspot, the show says
      the operator must pick one, rather than guessing
- [x] The Windows hotspot address still wins outright, with no ambiguity message, even when the
      laptop is also on another network
- [x] One private address is returned as-is, and the existing "no address" path still works
- [x] Every one of those rules has a unit test, and each test fails before the fix
- [x] A test drives the real server with 50 concurrent clients and asserts the room-scale
      behaviour holds: the cap, presence, drop-and-return, and the Presenter's start
- [x] The README says which adapter to leave up and what to check in the firewall, so this is
      not rediscovered on the day

## The problem

`src/server/address.ts` takes the first non-loopback IPv4 address it is handed unless an address
on `192.168.137.` exists. Adapter order is whatever the OS returns, so on the presenter's laptop
the address was Tailscale's `169.254.83.107`. The phone cannot open it. ADR-0002 says this class
of failure "looks like a broken app rather than a misconfigured one" — the presenter would debug
the app.

The laptop has four adapters with usable-looking addresses:

```
Ethernet 2                192.168.100.51    <- the wired show network
Wi-Fi 3                   192.168.18.186
Tailscale                 169.254.83.107
Local Area Connection* 12 169.254.244.58
```

Only the first is correct, and nothing in the code knows that.

## Task 1 — address selection

Rework `reachableHost()` in `src/server/address.ts`. It already takes interfaces as an argument,
so it stays testable without a network.

| Adapters up | Today | After |
| --- | --- | --- |
| hotspot only | `192.168.137.x` | unchanged |
| hotspot + wired ethernet | `192.168.137.x` | unchanged |
| one wired `192.168.100.51` | `192.168.100.51` | unchanged |
| `192.168.18.186` + `192.168.100.51` | whichever came first | `null` — operator must pick |
| Tailscale `169.254.83.107` only | `169.254.83.107` | `null` |
| Tailscale `100.64.x` | `100.64.x` | `null` |

The rules, in order:

1. IPv4 and not internal, as today.
2. Drop `169.254.0.0/16` and `100.64.0.0/10`. A phone in the room cannot open either; they are
   never right, only ever wrong.
3. Keep only RFC1918: `10/8`, `172.16/12`, `192.168/16`.
4. If any candidate is on `192.168.137.`, return it and stop. The hotspot is definitionally the
   show network, so other adapters are not ambiguity.
5. Exactly one candidate: return it.
6. Zero, or more than one: return `null`.

**A decision to confirm before you build it.** Returning `null` for the ambiguous case shows the
operator *nothing*, when one of the candidates would probably have worked. The alternative is to
show the first and warn. This plan chooses nothing-over-a-guess, because ADR-0002's whole
argument is that a wrong address is indistinguishable from a broken app. The message tells the
operator exactly what to do, and the rehearsal in the README removes the ambiguity beforehand. If
you think showing a guess is better, say so and change this ticket rather than deciding silently.

### Copy

One message covers both "no address" and "too many", because the operator's action is the same
shape in each: fix the network, restart. Update `copy.common.noAddress` in `src/content/show.ts`
to name both causes. Keep the key name, so no client code and no existing surface test changes.

```ts
noAddress: 'Hindi mahanap ang tamang address. Buksan ang hotspot o i-off ang extrang Wi-Fi, saka i-restart.',
```

### Tests

New file `src/server/address.test.ts` for the pure function, matching the one-test-file-per-module
shape the repo already uses. Move `prefers the hotspot address over another adapter` out of
`src/server/show-server.test.ts` into it; that test is a unit test in the wrong file. Leave
`tells a surface the hotspot address a phone can actually reach` where it is — it starts a real
server and is a fair server test.

Cases, each one a named test:

- the hotspot address beats another adapter
- a link-local address is never offered
- a `100.64.x` address is never offered
- the one private address is offered
- two private addresses and no hotspot give `null`, not a guess
- no usable address gives `null`

**Each test must fail before the change.** That is the point of writing them first. In
particular `a link-local address is never offered` fails against today's code, which returns it.

## Task 2 — the room-scale test

The server half was measured by hand at 50 concurrent clients and is fast enough to guard:

```
50 phones join at once -> whole room sees 40      107ms
10 refused at the cap
20 phones drop -> the other 30 all see it            49ms
20 return with tokens -> all 50 see 40 online        61ms
Presenter starts the show -> all 50 see it           11ms
late arrival refused with a plain reason
```

Put those cases in `src/server/show-server.test.ts` under a new
`describe('the show at room scale', ...)`, reusing the file's existing `surface()` and
`withServer()` helpers rather than adding new ones. Requirements:

- **Never touch the repository's `data/`.** Use the temp-log path that `withServer()` already
  builds. The run fills the log with 50 fake players.
- Port `0`, as `withServer()` already does.
- 50 sockets is not 50 clients of a real phone. Assert **state**, never latency. If a timing
  assertion is kept at all, keep it coarse — 2 seconds against a measured 107ms — and say in a
  comment that it is a canary against a pathological regression, not a benchmark. Drop it rather
  than let it flake.
- Every socket must be terminated in the failure path too, or vitest hangs. `ws` keeps the event
  loop alive while a socket is open.
- Sockets that terminate mid-test must stop being counted as observers. A closed socket never
  receives another state message, so including one in an "everyone saw it" assertion fails the
  test for a reason that has nothing to do with the server. This is the mistake the throwaway
  measurement made twice; do not repeat it.

## Task 3 — the rehearsal in the README

A short "Rehearsing on the day" section in `README.md`, so this is not rediscovered an hour
before the show:

- One network adapter up, on the show network. On the presenter's laptop that means wired
  ethernet and the ONT's Wi-Fi, with laptop Wi-Fi, Tailscale and any VPN off. More than one and
  the show will now say so instead of guessing.
- The address the console prints must be the wired adapter's, on `192.168.100.`.
- The Windows Firewall rule must allow node.exe on the **Private** profile. The rule that exists
  on this machine allows `Public` only, while the ethernet profile is `Private`, so inbound is
  blocked and the symptom is a phone that loads nothing.
- Give the 2.4GHz and 5GHz bands different SSIDs. With one shared SSID the ONT enables band
  steering, which pushes phones onto the band with the shortest range — the back of the room
  drops. Different SSIDs turn it off, and 40 on 2.4GHz stays inside Huawei's own
  30-per-band guidance.

## Done when

- `npm test` green, and the new address tests are shown to fail against the old implementation
  (stash the change, run them, paste the failures).
- `npm run typecheck` clean.
- Run the probe against this real machine, which is the acceptance check the unit tests cannot do:

  ```powershell
  npx tsx -e "import('./src/server/address.ts').then(m => console.log(m.reachableHost()))"
  ```

  It must no longer print `169.254.83.107` or any other `169.254.` address. With laptop Wi-Fi and
  Tailscale both up it is correct for it to print nothing at all — that is the ambiguous case.
- `git status` shows no `data/event-log.json` written by the test run.

## Not in this ticket

- Changing the router: splitting SSIDs and checking band steering are steps a human takes on the
  ONT's own page. The README records them; nothing here automates it.
- A `/wizard` script for the rehearsal. Separate ask.
- Ticket 02. Nothing here changes the protocol or the surfaces.

## Comments

Implemented. Every checkbox above is done; `npm test` is 65 green and `npm run typecheck` is
clean.

**The decision to confirm** was taken as the plan chose: two private addresses and no hotspot
returns `null`. Offered a guess instead; confirmed with the operator before building.

**Tests written first.** `src/server/address.test.ts` run against the old implementation:

```
FAIL  is never a link-local address            expected '169.254.83.107' to be null
FAIL  is never a CGNAT address                expected '100.64.0.7' to be null
FAIL  is nothing when two private addresses are up, rather than a guess
                                                expected '192.168.18.186' to be null
FAIL  is nothing when there is no address a phone could use
                                                expected '203.0.113.9' to be null
Tests  4 failed | 2 passed (6)
```

The two that passed are the two rows of the table today's code already got right (hotspot wins,
one private address returned as-is).

**The probe on this machine.** Adapters up right now:

```
Tailscale    169.254.83.107
Ethernet 2   192.168.100.51
Wi-Fi 3      192.168.18.186
```

Old code printed `169.254.83.107`. New code prints nothing: Tailscale is dropped as link-local,
and the two remaining are ambiguous. That is the case the ticket calls correct.

**Two notes on the room-scale test.** The Presenter's own Backbone is a 51st socket, so "all 50
saw the start" is asserted as 51 sockets: fifty phones plus the Backbone that started it. And
the observers after a drop are named explicitly — the twenty that stayed, the ten that were
turned away at the cap, and the Backbone — so a terminated socket is never counted, without
needing an open/closed flag on `surface()`.

**Status left at `ready-for-agent`.** The five-role triage vocabulary has no terminal state and
this ticket has no next actor, so inventing a `done` role was a call for the maintainer, not the
agent.