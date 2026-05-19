import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDM — Factoring Signals Engine",
  description: "Motor ML para identificar cuándo ofrecer factoring a cada proveedor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
