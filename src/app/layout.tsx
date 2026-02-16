import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app"),
  title: {
    default:
      "Seal & Send — Beautiful Digital Invitations & RSVP Management",
    template: "%s | Seal & Send",
  },
  description:
    "Create beautiful digital invitations, collect RSVPs instantly, and manage your event — all in one place. No stamps, no stress.",
  keywords: [
    "digital invitations",
    "invitation",
    "RSVP",
    "online invitations",
    "event management",
    "digital wedding invitations",
    "baby shower invitations",
    "birthday invitations",
    "corporate event invitations",
    "RSVP management",
    "free digital invitations",
  ],
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#7c3aed" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} font-sans antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
