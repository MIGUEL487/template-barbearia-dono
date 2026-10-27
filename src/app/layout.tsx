import { DemoWatermark, watermarkEnabled } from "@/components/demo-watermark";
import { MotionPreferences } from "@/components/motion-preferences";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const display = localFont({
  src: "../../fonts/display.woff2",
  variable: "--font-serif",
  display: "swap",
});
const manrope = localFont({
  src: "../../fonts/body.woff2",
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  robots: watermarkEnabled ? { index: false, follow: false } : undefined,
  title:
    "Auto Stilo — Painel Administrativo" +
    (watermarkEnabled ? " (Demo)" : ""),
  description: "Gestão completa de agenda, clientes, financeiro e automações.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-bg text-text antialiased selection:bg-accent selection:text-accent-contrast font-sans">
        <MotionPreferences>{children}</MotionPreferences>
        <DemoWatermark />
      </body>
    </html>
  );
}
