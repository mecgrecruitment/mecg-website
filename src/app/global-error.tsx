"use client";

import type { CSSProperties } from "react";

// A global error replaces the root layout, so globals.css is unavailable here.
const colors = {
  navy: "#070d1f",
  orange: "#fe904d",
  orangeInk: "#a83e0b",
  paper: "#f5f4ef",
  white: "#ffffff",
} as const;

const pageStyle: CSSProperties = {
  alignItems: "center",
  background: colors.paper,
  color: colors.navy,
  display: "flex",
  fontFamily: '"Avenir Next", Avenir, "Segoe UI", Helvetica, Arial, sans-serif',
  justifyContent: "center",
  margin: 0,
  minHeight: "100vh",
  padding: "32px 24px",
};

const panelStyle: CSSProperties = {
  background: colors.white,
  borderRadius: "28px",
  boxShadow: "0 24px 80px rgba(7, 13, 31, 0.09), inset 0 0 0 1px rgba(7, 13, 31, 0.05)",
  maxWidth: "560px",
  padding: "36px",
  width: "100%",
};

const actionStyle: CSSProperties = {
  alignItems: "center",
  border: 0,
  borderRadius: "2px",
  cursor: "pointer",
  display: "inline-flex",
  font: "inherit",
  fontWeight: 600,
  justifyContent: "center",
  minHeight: "44px",
  padding: "11px 22px",
  textDecoration: "none",
};

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={pageStyle}>
        <title>MECG could not load</title>
        <main style={panelStyle}>
          <p
            style={{
              color: colors.orangeInk,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.16em",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            System / Interrupted
          </p>
          <h1 style={{ fontSize: "36px", letterSpacing: "-0.035em", lineHeight: 1.05, margin: "14px 0 0" }}>
            MECG could not load this page.
          </h1>
          <p style={{ color: "rgba(7, 13, 31, 0.68)", lineHeight: 1.7, margin: "16px 0 0" }}>
            The problem may be temporary. Try again, or return to the public site.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "28px" }}>
            <button
              type="button"
              onClick={reset}
              style={{ ...actionStyle, background: colors.orange, color: colors.navy }}
            >
              Try again
            </button>
            <a
              href="/home"
              style={{
                ...actionStyle,
                boxShadow: "inset 0 0 0 1px rgba(7, 13, 31, 0.18)",
                color: colors.navy,
              }}
            >
              Back to site
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
