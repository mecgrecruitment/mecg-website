import localFont from "next/font/local";

// Archivo (SIL OFL 1.1, see ARCHIVO-OFL.txt): display type for public pages and workspace titles; body text stays on the system stack.
export const display = localFont({
  src: "./archivo-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-display",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});
