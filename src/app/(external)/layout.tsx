import { Archivo } from "next/font/google";
import SmoothScroll from "./components/SmoothScroll";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${archivo.variable} flex min-h-full flex-col`}
      data-zone="external"
    >
      <SmoothScroll>{children}</SmoothScroll>
    </div>
  );
}
