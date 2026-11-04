import { DemoWatermark, watermarkEnabled } from "@/components/demo-watermark";
import { MotionPreferences } from "@/components/motion-preferences";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "../styles/management-premium.css";
import {NotificationProvider} from '@/components/admin/notification-provider';
const display=localFont({src:"./fonts/cinzel.ttf",weight:"400 900",variable:"--font-serif",display:"swap"});
const manrope=localFont({src:"./fonts/outfit.ttf",weight:"100 900",variable:"--font-sans",display:"swap"});

export const viewport: Viewport = {themeColor:'#080F25', colorScheme:'dark'};
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'Auto Stilo - Gestão',statusBarStyle:'default'},
  icons: {
    icon: [
      { url: "/favicon-dono-branco.ico", sizes: "any" },
      { url: "/brand/auto-stilo/favicon-dark-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-dono-branco.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/pwa/apple-180.png?v=2", sizes: "180x180", type: "image/png" }],
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
      <body className="management-scope min-h-screen bg-bg text-text antialiased selection:bg-accent selection:text-accent-contrast font-sans">
        <MotionPreferences><NotificationProvider>{children}</NotificationProvider></MotionPreferences>
        <DemoWatermark />
      </body>
    </html>
  );
}
