import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
export const SITE_NAME = "Seal & Send";
export const DEFAULT_DESCRIPTION =
  "SealSend helps recurring community organizers turn an event brief into an approved guest workflow for invitations, RSVPs, guest updates, and check-in.";

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
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
