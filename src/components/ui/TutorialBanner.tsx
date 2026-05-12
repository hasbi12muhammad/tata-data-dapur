"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "tutorial_banner_dismissed";

export function TutorialBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  // null = belum tahu (hydration guard, hindari flicker)
  if (dismissed === null) return null;

  if (dismissed) {
    return (
      <div className="flex mb-5">
        <Link
          href="/tutorial"
          className="flex items-center gap-1.5 bg-[#F5EFE0] border border-[#C4956A] text-[#7C563D] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#EDE4CF] transition-colors"
        >
          📹 Tutorial
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#7C563D] to-[#A05035] text-white rounded-xl px-4 py-3 mb-5">
      <div>
        <p className="font-bold text-sm">📹 Video Tutorial</p>
        <p className="text-xs text-white/80 mt-0.5">
          Pelajari cara pakai aplikasi ini langkah demi langkah
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/tutorial"
          className="bg-white text-[#7C563D] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#E9DFC6] transition-colors whitespace-nowrap"
        >
          Lihat Tutorial →
        </Link>
        <button
          onClick={dismiss}
          aria-label="Tutup banner tutorial"
          className="bg-white/20 hover:bg-white/30 rounded-lg p-1.5 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
