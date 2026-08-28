import { ImageResponse } from "next/og";

export const alt = "SealSend controlled beta for recurring event organizers";
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
          An Approved Guest Workflow from Brief to Check-in
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
          <span>Controlled Beta</span>
          <span>One Event · Up to 100 Guests</span>
          <span>No Payment Card</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
