import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');

  return `${HASH_PREFIX}:${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [prefix, salt, hash] = passwordHash.split(':');

  if (prefix !== HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
