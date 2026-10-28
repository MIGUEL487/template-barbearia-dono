import { DemoWatermark, watermarkEnabled } from "@/components/demo-watermark";
import { MotionPreferences } from "@/components/motion-preferences";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const display=localFont({src:[{path:"./fonts/fraunces-latin-400-normal.woff2",weight:"400",style:"normal"},{path:"./fonts/fraunces-latin-500-normal.woff2",weight:"500",style:"normal"},{path:"./fonts/fraunces-latin-400-italic.woff2",weight:"400",style:"italic"}],variable:"--font-serif",display:"swap"});
const manrope=localFont({src:"./fonts/Manrope-400.ttf",weight:"400",variable:"--font-sans",display:"swap"});

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon-dono-branco.ico", sizes: "any" },
      { url: "/brand/auto-stilo/favicon-dark-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-dono-branco.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
