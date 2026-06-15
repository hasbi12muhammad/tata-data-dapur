"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { FIELD_HELP, helpHref } from "./fieldHelp";

/**
 * Contextual help affordance for form fields. Renders a small "?" button that
 * reveals a popover with the same explanation shown in Pusat Bantuan.
 * Opens on hover/focus (desktop) and tap (mobile); closes on Escape or
 * outside click. Content + deep-link come from the shared FIELD_HELP registry.
 */
export function HelpTip({ fieldId, className = "" }: { fieldId: string; className?: string }) {
  const entry = FIELD_HELP[fieldId];
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!entry) return null;

  const reveal = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setAbove(rect.bottom > window.innerHeight - 200);
    setOpen(true);
  };

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={reveal}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Bantuan: ${entry.title}`}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : reveal())}
        onFocus={reveal}
        onBlur={() => setOpen(false)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[#B88D6A] transition-colors hover:text-[#A05035] focus:text-[#A05035] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A05035]"
      >
        <HelpCircle className="h-[15px] w-[15px]" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute left-1/2 z-50 w-[min(260px,78vw)] -translate-x-1/2 rounded-xl border border-[#D9CCAF] bg-[#FBF8F2] p-3 text-left shadow-xl ${
            above ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ cursor: "default" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="mb-1 block text-[13px] font-semibold text-[#2C1810]">{entry.title}</span>
          <span className="block text-[13px] leading-relaxed text-[#4A3728]">{entry.short}</span>
          {entry.helpAnchor && (
            <Link
              href={helpHref(entry.helpAnchor)}
              className="mt-2 inline-flex text-[12px] font-semibold text-[#A05035] hover:underline"
            >
              Pelajari selengkapnya →
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
