import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acompaña · Cada mañana sabes cómo está tu mamá",
  description:
    "Platicamos con tu mamá o tu papá todos los días por WhatsApp y te mandamos un resumen de cómo está, con alertas si algo anda mal. Sin instalar nada. 14 días gratis.",
  openGraph: {
    title: "Acompaña",
    description: "Cada mañana platicamos con tu mamá. Cada mañana te contamos cómo está.",
    locale: "es_MX",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#1e4a44", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
