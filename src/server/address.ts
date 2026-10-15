import { networkInterfaces } from 'node:os';

const HOTSPOT_PREFIX = '192.168.137.';

/**
 * The address a Player's phone can open. ADR-0002: the laptop's hotspot
 * adapter is normally 192.168.137.1, and loopback is never an answer.
 */
export function reachableHost(ifaces: ReturnType<typeof networkInterfaces> = networkInterfaces()): string | null {
  const addresses = Object.values(ifaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);

  return addresses.find((address) => address.startsWith(HOTSPOT_PREFIX)) ?? addresses[0] ?? null;
}