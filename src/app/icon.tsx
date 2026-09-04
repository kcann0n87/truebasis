import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Ledger mark: lines stepping down to the basis, in the brand mint.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4,
          background: "#0b1220",
          padding: 6,
        }}
      >
        <div style={{ display: "flex", height: 3, width: 20, background: "#6b7280", borderRadius: 2 }} />
        <div style={{ display: "flex", height: 3, width: 13, background: "#6b7280", borderRadius: 2 }} />
        <div style={{ display: "flex", height: 4, width: 9, background: "#34d399", borderRadius: 2 }} />
      </div>
    ),
    size,
  );
}
