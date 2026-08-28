import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SealSend — Approved Guest Workflows for Organizers",
  description: "SealSend helps recurring community organizers turn an event brief into an approved guest workflow for invitations, RSVPs, guest updates, and check-in.",
  keywords: ["event guest workflow", "community event management", "RSVP management", "guest check-in", "recurring event organizers"],
  authors: [{ name: "SealSend" }],
  creator: "SealSend",
  metadataBase: new URL("https://sealsend.app"),
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icons/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sealsend.app",
    siteName: "SealSend",
    title: "SealSend — Approved Guest Workflows for Organizers",
    description: "For recurring community organizers: move from event brief to an approved guest workflow, RSVP tracking, updates, and check-in.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SealSend controlled beta for recurring community organizers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SealSend — Approved Guest Workflows for Organizers",
    description: "For recurring community organizers: event brief, host approval, RSVP tracking, guest updates, and check-in.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
