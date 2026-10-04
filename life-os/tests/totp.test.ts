import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateSecret, hotp, verifyTotp } from '@/lib/totp';

// RFC 6238 Appendix B test secret (ASCII "12345678901234567890")
const RFC_SECRET = Buffer.from('12345678901234567890');

describe('totp', () => {
  it('matches RFC 6238 SHA-1 vectors (last 6 digits)', () => {
    expect(hotp(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(hotp(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(hotp(RFC_SECRET, Math.floor(1234567890 / 30))).toBe('005924');
    expect(hotp(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('round-trips base32', () => {
    const s = generateSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(base32Decode(s)).toHaveLength(20);
  });

  it('verifies with drift window and rejects replays and junk', () => {
    const b32 = base32Encode(RFC_SECRET);
    const t = 1111111109 * 1000;
    expect(verifyTotp(b32, '081804', t)).toBe(Math.floor(1111111109 / 30));
    expect(verifyTotp(b32, '081804', t + 30_000)).not.toBeNull(); // one step late is ok
    expect(verifyTotp(b32, '081804', t + 90_000)).toBeNull(); // too late
    const step = verifyTotp(b32, '081804', t)!;
    expect(verifyTotp(b32, '081804', t, step)).toBeNull(); // replay
    expect(verifyTotp(b32, '12345', t)).toBeNull();
    expect(verifyTotp(b32, 'abcdef', t)).toBeNull();
  });
});
