import { networkInterfaces } from 'node:os';

const HOTSPOT_PREFIX = '192.168.137.';

/** RFC1918 private space: 10/8, 172.16/12, 192.168/16. Nothing else counts. */
const isPrivate = (address: string) => {
  const octets = address.split('.');
  const first = Number(octets[0]);
  const second = Number(octets[1]);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
};

/**
 * The address a Player's phone can open. ADR-0002: the laptop's hotspot
 * adapter is normally 192.168.137.1, and loopback is never an answer.
 *
 * Link-local (169.254/16) and CGNAT (100.64/10) are dropped: they are never
 * the show network, only ever the wrong answer. More than one private address
 * and no hotspot is ambiguous, and the answer is null — a wrong address is
 * indistinguishable from a broken app (ADR-0002), so nothing beats the
 * operator's own choice.
 */
export function reachableHost(ifaces: ReturnType<typeof networkInterfaces> = networkInterfaces()): string | null {
  const candidates = Object.values(ifaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
    .filter(isPrivate);

  const hotspot = candidates.find((address) => address.startsWith(HOTSPOT_PREFIX));
  if (hotspot) return hotspot;
  return candidates.length === 1 ? candidates[0]! : null;
}