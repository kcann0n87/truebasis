import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// Social/preview card. Generated at build time so there's no binary in the
// repo and it stays in step with the palette.
export const alt = `${SITE_NAME} — your real cost basis after option premium`;
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
          justifyContent: "center",
          background: "#0b1220",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#34d399", fontSize: 30, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 44, height: 44, borderRadius: 12, border: "3px solid #34d399" }} />
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", color: "#f3f4f6", fontSize: 68, fontWeight: 800, lineHeight: 1.1, marginTop: 28, letterSpacing: "-0.02em" }}>
          What your shares really cost, after premium.
        </div>
        <div style={{ display: "flex", color: "#9ca3af", fontSize: 28, marginTop: 24, lineHeight: 1.4 }}>
          Drop in an IBKR or Robinhood statement. Every call, put and assignment netted
          against your shares — in your browser.
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 40, color: "#34d399", fontSize: 24, fontWeight: 600 }}>
          <div style={{ display: "flex" }}>Free</div>
          <div style={{ display: "flex", color: "#4b5563" }}>·</div>
          <div style={{ display: "flex" }}>No account</div>
          <div style={{ display: "flex", color: "#4b5563" }}>·</div>
          <div style={{ display: "flex" }}>Nothing uploaded</div>
        </div>
      </div>
    ),
    size,
  );
}
