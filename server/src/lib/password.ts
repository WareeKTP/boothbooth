/**
 * Password hashing (argon2id) + a minimal strength policy.
 * backend-final.md §1, §3.10 (weak_password on PATCH /api/me/password).
 */
import argon2 from 'argon2';

// argon2id with sane defaults; argon2's library defaults already use argon2id.
const HASH_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP-recommended floor for argon2id
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Malformed hash etc. — treat as a non-match, never throw to the caller.
    return false;
  }
}

/** Returns true if the password meets the minimum policy. */
export function isStrongEnough(password: string): boolean {
  // Minimum: 8+ chars. Keep it modest — this is a booth-staff POS, not a bank,
  // and an over-strict policy on shared tablets causes password reuse on paper.
  return typeof password === 'string' && password.length >= 8;
}
