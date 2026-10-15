import { describe, expect, it } from 'vitest';
import { reachableHost } from './address.ts';

/** The adapters up on a laptop, in the shape `networkInterfaces()` hands over. */
const up = (...addresses: string[]) =>
  Object.fromEntries(addresses.map((address) => [address, [{ address, family: 'IPv4', internal: false }]])) as never;

describe('the address a phone can open', () => {
  it('is the hotspot address, even with another adapter up beside it', () => {
    expect(reachableHost(up('192.168.100.51', '192.168.137.1'))).toBe('192.168.137.1');
  });

  it('is never a link-local address', () => {
    expect(reachableHost(up('169.254.83.107'))).toBeNull();
  });

  it('is never a CGNAT address', () => {
    expect(reachableHost(up('100.64.0.7'))).toBeNull();
  });

  it('is the one private address when there is exactly one', () => {
    expect(reachableHost(up('192.168.100.51'))).toBe('192.168.100.51');
  });

  it('is nothing when two private addresses are up, rather than a guess', () => {
    expect(reachableHost(up('192.168.18.186', '192.168.100.51'))).toBeNull();
  });

  it('is nothing when there is no address a phone could use', () => {
    expect(reachableHost(up('203.0.113.9'))).toBeNull();
  });
});