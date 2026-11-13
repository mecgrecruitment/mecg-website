import localFont from "next/font/local";

// Archivo (SIL OFL 1.1, see ARCHIVO-OFL.txt): editorial headings across public and private routes; Source Sans 3 supplies body text.
export const display = localFont({
  src: "./archivo-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-display",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

// Body face supplied with the modern identity. Self-hosted, with explicit fallback.
export const body = localFont({
  src: [
    { path: "./source-sans-3-regular.ttf", weight: "400", style: "normal" },
    { path: "./source-sans-3-semibold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});
