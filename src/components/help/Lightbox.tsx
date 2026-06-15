"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

interface LightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const zoom = (delta: number) =>
    setScale((s) => Math.min(5, Math.max(0.5, s + delta)));

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoom(-e.deltaY * 0.001);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPos({
      x: dragOrigin.current.px + e.clientX - dragOrigin.current.mx,
      y: dragOrigin.current.py + e.clientY - dragOrigin.current.my,
    });
  };

  const onMouseUp = () => { dragging.current = false; };

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  const btnCls = "flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      onWheel={onWheel}
      onClick={onClose}
    >
      {/* controls */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={btnCls} onClick={() => zoom(0.3)} aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button className={btnCls} onClick={() => zoom(-0.3)} aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        {scale !== 1 && (
          <button className={btnCls} onClick={reset} aria-label="Reset zoom">
            <span className="text-xs font-bold">1:1</span>
          </button>
        )}
        <button className={btnCls} onClick={onClose} aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* hint */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40 pointer-events-none select-none">
        Scroll untuk zoom · Drag untuk geser · Esc untuk tutup
      </p>

      {/* image */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`,
          cursor: scale > 1 ? "grab" : "zoom-in",
          transition: dragging.current ? "none" : "transform 0.15s ease",
          maxWidth: "90vw",
          maxHeight: "88vh",
          objectFit: "contain",
          userSelect: "none",
          borderRadius: 8,
        }}
      />
    </div>
  );
}

/** Thumbnail yang buka Lightbox saat diklik */
export function TourImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full overflow-hidden rounded-xl border border-[#D9CCAF] cursor-zoom-in hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A05035]"
        aria-label={`Lihat ${alt} lebih besar`}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-auto block"
          loading="lazy"
        />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
