import { ImageResponse } from "next/og";

export const alt = "Michigan Engineering Consulting Group";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#070d1f", color: "white", display: "flex", height: "100%", padding: "80px", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: "980px" }}>
        <div style={{ color: "#fe904d", fontSize: 34, fontWeight: 700 }}>MECG</div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-3px", lineHeight: 1.05, marginTop: 28 }}>Michigan Engineering Consulting Group</div>
        <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 30, marginTop: 34 }}>Pro-bono consulting at the University of Michigan</div>
      </div>
    </div>,
    size,
  );
}
