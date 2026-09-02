export type AnnualProCtaMode = "waitlist" | "checkout" | "signup";

export function getAnnualProCtaMode(
  annualCheckoutAvailable: boolean,
  isAuthenticated: boolean,
): AnnualProCtaMode {
  if (!annualCheckoutAvailable) return "waitlist";
  return isAuthenticated ? "checkout" : "signup";
}
