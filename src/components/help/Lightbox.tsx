"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";

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

/** Thumbnail tunggal yang buka Lightbox saat diklik */
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
        <img src={src} alt={alt} className="w-full h-auto block" loading="lazy" />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export type GalleryImage = { src: string; caption: string };

/** Carousel dengan multiple screenshot — click gambar buat zoom lightbox */
export function TourCarousel({ images }: { images: GalleryImage[] }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const current = images[idx];

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox !== null) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (images.length === 1) {
    return <TourImage src={images[0].src} alt={images[0].caption} />;
  }

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchX.current = null;
  };

  return (
    <div className="mt-3 rounded-xl border border-[#D9CCAF] overflow-hidden bg-[#F4EDE0]">
      {/* image area */}
      <div
        className="relative"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={() => setLightbox(idx)}
          className="w-full block cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A05035]"
          aria-label={`Lihat ${current.caption} lebih besar`}
        >
          <img
            key={current.src}
            src={current.src}
            alt={current.caption}
            className="w-full h-auto block"
            loading="lazy"
          />
        </button>

        {/* arrows — always visible (semi-transparent) */}
        <button
          type="button"
          onClick={prev}
          aria-label="Sebelumnya"
          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Berikutnya"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* caption + dots */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-3">
        <span className="text-xs text-[#7C6352] leading-snug flex-1 min-w-0 truncate">
          {current.caption}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all focus:outline-none ${
                i === idx
                  ? "w-4 bg-[#A05035]"
                  : "w-1.5 bg-[#D9CCAF] hover:bg-[#B88D6A]"
              }`}
            />
          ))}
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox
          src={images[lightbox].src}
          alt={images[lightbox].caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
