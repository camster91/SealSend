import type { Metadata, Viewport } from "next";
import {
  Hanken_Grotesk,
  Libre_Caslon_Display,
  Inter,
  Poppins,
  Cormorant_Garamond,
  Playfair_Display,
  Fraunces,
  DM_Sans,
} from "next/font/google";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE } from "@/lib/metadata";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/search-indexing";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

const caslon = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-caslon",
  display: "swap",
});

// Self-host invitation fonts; load them only when a selected look uses them.
const eventInter = Inter({ subsets: ["latin"], variable: "--font-event-inter", display: "swap", preload: false });
const eventPoppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-event-poppins", display: "swap", preload: false });
const eventCormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-event-cormorant", display: "swap", preload: false });
const eventPlayfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-event-playfair", display: "swap", preload: false });
const eventFraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-event-fraunces", display: "swap", preload: false });
const eventDmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-event-dm-sans", display: "swap", preload: false });

export const metadata: Metadata = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  keywords: ["online invitations with RSVP", "RSVP tracking", "digital invitations", "event check-in app", "guest list management"],
  authors: [{ name: "SealSend" }],
  creator: "SealSend",
  metadataBase: new URL("https://sealsend.app"),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/brand/favicon-32.png",
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sealsend.app",
    siteName: "SealSend",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: PRIVATE_PAGE_ROBOTS,
};

export const viewport: Viewport = {
  themeColor: "#f4f5f8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${hanken.variable} ${caslon.variable} ${eventInter.variable} ${eventPoppins.variable} ${eventCormorant.variable} ${eventPlayfair.variable} ${eventFraunces.variable} ${eventDmSans.variable}`}>
      <body className="font-sans min-h-screen"><ServiceWorkerRegistration />{children}</body>
    </html>
  );
}
