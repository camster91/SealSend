import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Seal and Send — Beautiful Digital Invitations & RSVP Management";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 72, fontWeight: 800 }}>Seal</span>
          <span style={{ fontSize: 72, fontWeight: 800, color: "#e9d5ff" }}>Send</span>
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 500,
            opacity: 0.9,
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Beautiful Digital Invitations & RSVP Management
        </div>
        <div
          style={{
            display: "flex",
            gap: 48,
            marginTop: 48,
            fontSize: 20,
            opacity: 0.8,
          }}
        >
          <span>10,000+ Events</span>
          <span>200,000+ Guests</span>
          <span>Free to Start</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
