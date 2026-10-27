import { DemoWatermark, watermarkEnabled } from "@/components/demo-watermark";
import { MotionPreferences } from "@/components/motion-preferences";
import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
const display = Fraunces({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-serif", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: "400", variable: "--font-sans", display: "swap" });

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
