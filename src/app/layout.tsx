import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "SealSend - Beautiful Digital Invitations & RSVP Management",
  description: "Create stunning digital invitations, collect RSVPs instantly, and manage your events with ease. The modern way to invite and track guests.",
  keywords: ["digital invitations", "RSVP", "event management", "online invitations", "wedding invitations", "party invitations"],
  authors: [{ name: "SealSend" }],
  creator: "SealSend",
  metadataBase: new URL("https://sealsend.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sealsend.app",
    siteName: "SealSend",
    title: "SealSend - Beautiful Digital Invitations",
    description: "Create stunning digital invitations and manage RSVPs with ease.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SealSend - Digital Invitations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SealSend - Beautiful Digital Invitations",
    description: "Create stunning digital invitations and manage RSVPs with ease.",
    images: ["/og-image.jpg"],
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
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
