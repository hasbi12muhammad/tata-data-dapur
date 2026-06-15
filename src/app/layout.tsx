import type { Metadata, Viewport } from "next";
import { Providers } from "@/lib/providers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getTenantConfig } from "@/lib/tenant/config";
import "./globals.css";

const appName = getTenantConfig().name;

export const metadata: Metadata = {
  title: appName,
  description: "Kelola HPP, resep, dan laporan bisnis F&B kamu",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appName,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1E3A5F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
