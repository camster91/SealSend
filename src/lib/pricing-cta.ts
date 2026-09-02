export type AnnualProCtaMode = "contact" | "checkout" | "signup";

export function getAnnualProCtaMode(
  annualCheckoutAvailable: boolean,
  isAuthenticated: boolean,
): AnnualProCtaMode {
  if (!annualCheckoutAvailable) return "contact";
  return isAuthenticated ? "checkout" : "signup";
}
