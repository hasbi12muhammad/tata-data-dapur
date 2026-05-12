"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const TUTORIALS = [
  {
    step: "LANGKAH 1",
    title: "Panduan Login dan Ganti Password",
    src: "/videos/panduan-login.mp4",
  },
  {
    step: "LANGKAH 2",
    title: "Panduan Pengelolaan Bahan Baku dan Membuat HPP Produk",
    src: "/videos/panduan-bahan-baku-hpp.mp4",
  },
  {
    step: "LANGKAH 3",
    title: "Menambahkan Pembelian Bahan Baku",
    src: "/videos/panduan-pembelian.mp4",
  },
];

export default function TutorialPage() {
  return (
    <AppLayout title="Tutorial">
      <div className="space-y-6">
        {TUTORIALS.map(({ step, title, src }) => (
          <Card key={step}>
            <CardHeader>
              <p className="text-xs font-bold text-[#7C563D] uppercase tracking-wide mb-1">
                {step}
              </p>
              <h3 className="text-sm font-semibold text-[#2C1810]">{title}</h3>
            </CardHeader>
            <CardBody>
              <video src={src} controls preload="metadata" className="w-full rounded-lg">
                Maaf, video tidak bisa dimuat.
              </video>
            </CardBody>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
