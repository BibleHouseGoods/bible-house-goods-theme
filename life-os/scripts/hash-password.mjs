// Usage: npm run hash-password -- 'your long passphrase'
// Prints a value for APP_PASSWORD_HASH (scrypt, random salt).
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Provide a passphrase of at least 12 characters.');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`);
