import type { Metadata } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Painel Administrativo — Barbearia Premium",
  description: "Gestão completa de agenda, clientes, financeiro e automações.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-bg text-text antialiased selection:bg-accent selection:text-accent-contrast font-sans">
        {children}
      </body>
    </html>
  );
}
