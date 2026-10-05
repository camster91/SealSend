import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
export const SITE_NAME = "SealSend";
export const DEFAULT_TITLE = "SealSend: Online Invitations with RSVP Tracking & Check-in";
export const DEFAULT_DESCRIPTION =
  "Send beautiful online invitations, track every RSVP, message guests by email or text, and check them in at the door. Free for your first event.";

// One static Open Graph card for every page (public/brand/og.jpg, 1200x630).
export const OG_IMAGE = {
  url: "/brand/og.jpg",
  width: 1200,
  height: 630,
  alt: "A SealSend invitation sealed with a wax S, beside a phone showing who is going",
};

export function createMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  keywords,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
}): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    // Next.js replaces (not merges) openGraph and twitter objects from the root layout,
    // so every page repeats the shared image here.
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
