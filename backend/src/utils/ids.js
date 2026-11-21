import { randomBytes } from 'node:crypto';

export function createId(bytes = 6) {
  return randomBytes(bytes).toString('base64url').toUpperCase();
}
