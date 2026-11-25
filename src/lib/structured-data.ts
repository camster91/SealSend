import { BETA_MODE, PUBLIC_PRICING_PLANS } from "@/lib/constants";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/metadata";

/** SoftwareApplication JSON-LD with one Offer per public plan, priced from the billing constants. */
export function softwareApplicationJsonLd() {
  const offers = BETA_MODE
    ? [
        {
          "@type": "Offer",
          name: "Free Beta",
          price: "0.00",
          priceCurrency: "USD",
          description: "Free during beta: one active event with up to 100 guests.",
          url: `${SITE_URL}/pricing`,
        },
      ]
    : PUBLIC_PRICING_PLANS.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: plan.price.toFixed(2),
        priceCurrency: "USD",
        description: plan.description,
        url: `${SITE_URL}/pricing`,
      }));
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web browser",
    offers,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
