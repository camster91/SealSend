## 2026-05-30 - Insecure Randomness in Authentication
**Vulnerability:** Use of `Math.random()` for generating 6-digit OTP codes and temporary passwords.
**Learning:** `Math.random()` is a PRNG that is not cryptographically secure, making generated tokens potentially predictable if an attacker can determine the seed or internal state.
**Prevention:** Always use `crypto.randomInt` or `crypto.randomBytes` for any security-sensitive random values. Use Fisher-Yates shuffle with a CSPRNG for shuffling sensitive arrays.
