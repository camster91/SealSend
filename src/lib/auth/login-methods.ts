import type { AuthMethod } from "./types";

/** Sign-in methods that can actually work, with the one to open first at the front. */
export function loginMethods(providers: { emailEnabled: boolean; smsEnabled: boolean }): AuthMethod[] {
  return [
    ...(providers.emailEnabled ? (["email"] as const) : []),
    "password",
    ...(providers.smsEnabled ? (["phone"] as const) : []),
  ];
}
