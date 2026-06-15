"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import {
  FAQ_GROUPS,
  TOUR,
  VIDEO_SECTIONS,
  type Feature,
  type TourBlock,
  type VideoCard,
} from "@/components/help/helpContent";
import {
  HelpCircle,
  Image as ImageIcon,
  Info,
  Lightbulb,
  Map,
  Play,
  Plus,
  Video,
} from "lucide-react";

type TabId = "tour" | "faq" | "video";
const TABS: { id: TabId; label: string; icon: typeof Map }[] = [
  { id: "tour", label: "Tur Menu", icon: Map },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "video", label: "Video Tutorial", icon: Video },
];

/* ── shared pieces ── */

function Shot({ label }: { label: string }) {
  return (
    <div className="my-5 flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#D9CCAF] bg-[#F2EBD9] text-[#7C6352]">
      <ImageIcon className="h-7 w-7 opacity-50" />
      <span className="font-mono text-[11px] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FeatureList({ items }: { items: Feature[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-lg border border-[#E5DACA] bg-[#F2EBD9] px-4 py-3 text-sm text-[#4A3526]"
        >
          <span className="mt-0.5 shrink-0 text-base leading-tight" aria-hidden>
            {it.emoji}
          </span>
          <span className="leading-relaxed">
            <strong className="mb-0.5 block font-semibold text-[#2C1810]">{it.title}</strong>
            {it.body}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ variant, children }: { variant: "tip" | "info"; children: React.ReactNode }) {
  const tip = variant === "tip";
  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed",
        tip
          ? "border-[#C4956A]/60 bg-[#F5EFE0] text-[#6E4A2E]"
          : "border-[#737B4C]/40 bg-[#EEF1E5] text-[#54592F]",
      )}
    >
      {tip ? (
        <Lightbulb className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#A05035]" />
      ) : (
        <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#737B4C]" />
      )}
      <div>{children}</div>
    </div>
  );
}

function Block({ block }: { block: TourBlock }) {
  switch (block.type) {
    case "p":
      return <p className="mb-4 text-[15px] leading-relaxed text-[#4A3526]">{block.node}</p>;
    case "shot":
      return <Shot label={block.label} />;
    case "subhead":
      return <p className="mt-4 text-[15px] text-[#4A3526]">{block.node}</p>;
    case "features":
      return <FeatureList items={block.items} />;
    case "callout":
      return <Callout variant={block.variant}>{block.node}</Callout>;
    default:
      return null;
  }
}

/* ── Tab 1: Tur Menu ── */

function TourTab() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[200px_1fr]">
      {/* sticky in-page nav (desktop) */}
      <nav className="sticky top-0 hidden self-start rounded-xl border border-[#D9CCAF] bg-[#FBF8F2] p-4 lg:block">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#7C6352]">Menu</p>
        <div className="space-y-0.5">
          {TOUR.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[#4A3526] transition-colors hover:bg-[#F2EBD9] hover:text-[#A05035]"
              >
                <Icon className="h-[15px] w-[15px] shrink-0" />
                {s.title}
              </a>
            );
          })}
        </div>
      </nav>

      <div>
        {TOUR.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={s.id} className="mb-14 scroll-mt-4 last:mb-0">
              <div className="overflow-hidden rounded-2xl border border-[#D9CCAF] bg-[#FBF8F2] shadow-sm">
                <header className="flex items-start gap-4 border-b border-[#E5DACA] bg-[#F2EBD9] px-6 py-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7C563D] text-[#E9DFC6]">
                    <Icon className="h-[22px] w-[22px]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-[#2C1810]">{s.title}</h3>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-[#7C6352]">{s.route}</p>
                  </div>
                </header>
                <div className="px-6 py-5">
                  {s.blocks.map((b, i) => (
                    <Block key={i} block={b} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ── Tab 2: FAQ ── */

function FaqRow({
  id,
  q,
  a,
  open,
  onToggle,
}: {
  id: string;
  q: string;
  a: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-[#D9CCAF] bg-[#FBF8F2]">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-a`}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-5 px-5 py-4 text-left transition-colors",
          open ? "bg-[#F2EBD9]" : "hover:bg-[#F2EBD9]",
        )}
      >
        <span className="flex-1 text-[15px] font-medium leading-snug text-[#2C1810]">{q}</span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#FBF8F2] transition-all duration-300",
            open ? "rotate-45 bg-[#A05035]" : "bg-[#2C1810]",
          )}
        >
          <Plus className="h-4 w-4" />
        </span>
      </button>
      <div
        id={`${id}-a`}
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#E5DACA] px-5 py-4 text-sm leading-relaxed text-[#4A3526]">{a}</div>
        </div>
      </div>
    </div>
  );
}

function FaqTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-8 text-base leading-relaxed text-[#4A3526]">
        Pertanyaan yang sering ditanyakan pengguna Tata Data Dapur. Klik pertanyaannya buat lihat jawaban.
      </p>
      {FAQ_GROUPS.map((g, gi) => (
        <div key={gi} className="mb-10">
          <div className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-[#A05035]">
            {g.title}
            <span className="h-px flex-1 bg-[#D9CCAF]" />
          </div>
          {g.items.map((it, ii) => {
            const id = `faq-${gi}-${ii}`;
            return (
              <FaqRow
                key={id}
                id={id}
                q={it.q}
                a={it.a}
                open={openId === id}
                onToggle={() => setOpenId(openId === id ? null : id)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Tab 3: Video ── */

function VideoThumb({ card, onPlay }: { card: VideoCard; onPlay: () => void }) {
  const ready = Boolean(card.src);
  return (
    <button
      type="button"
      disabled={!ready}
      onClick={ready ? onPlay : undefined}
      className={cn(
        "group overflow-hidden rounded-xl border text-left transition-all",
        ready
          ? "cursor-pointer border-[#D9CCAF] bg-[#FBF8F2] hover:-translate-y-0.5 hover:shadow-lg"
          : "cursor-default border-dashed border-[#D9CCAF] bg-transparent opacity-60",
      )}
    >
      <div
        className={cn(
          "relative flex aspect-video items-center justify-center bg-gradient-to-br from-[#3A2415] to-[#7C563D]",
          !ready && "opacity-50",
        )}
      >
        {ready && card.badge && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#C4956A] px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-[#2C1810]">
            {card.badge}
          </span>
        )}
        {!ready && (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/70">
            Segera hadir
          </span>
        )}
        <span
          className={cn(
            "flex items-center justify-center rounded-full border-2 transition-colors",
            ready
              ? "border-white/40 bg-white/15 text-white group-hover:border-[#C4956A] group-hover:bg-[#A05035]"
              : "border-white/30 bg-white/10 text-white/80",
          )}
          style={{ height: 52, width: 52 }}
        >
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
        {card.duration && (
          <span className="absolute bottom-2.5 right-2.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {card.duration}
          </span>
        )}
      </div>
      <div className="px-4 py-3.5">
        <h4 className="mb-1 text-sm font-medium leading-snug text-[#2C1810]">{card.title}</h4>
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#7C6352]">{card.meta}</p>
      </div>
    </button>
  );
}

function VideoTab({ onPlay }: { onPlay: (c: VideoCard) => void }) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-10 rounded-2xl bg-gradient-to-br from-[#7C563D] to-[#A05035] p-8 text-white">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#E9DFC6]">Video Tutorial</p>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">Halo, pengguna Tata Data Dapur! 👋</h2>
        <p className="leading-relaxed text-white/80">
          Selamat datang di halaman tutorial. Di sini kami siapkan video panduan buat bantu kamu memaksimalkan tiap
          fitur app — dari setup awal sampai baca laporan bisnis. Tonton urut biar paling nyantol, atau langsung pilih
          topik yang kamu butuhkan.
        </p>
      </div>

      {VIDEO_SECTIONS.map((sec, si) => (
        <div key={si} className="mb-10">
          <h3 className="mb-4 text-lg font-semibold tracking-tight text-[#2C1810]">{sec.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {sec.cards.map((card, ci) => (
              <VideoThumb key={ci} card={card} onPlay={() => onPlay(card)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page ── */

export default function HelpCenterPage() {
  const [tab, setTab] = useState<TabId>("tour");
  const [video, setVideo] = useState<VideoCard | null>(null);

  return (
    <AppLayout title="Pusat Bantuan">
      {/* hero */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#7C563D] to-[#A05035] px-6 py-10 text-center text-white">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-[#E9DFC6]">Pusat Bantuan</p>
        <h2 className="mx-auto mb-3 max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Halo, ada yang bisa kami <span className="text-[#E9DFC6]">bantu?</span>
        </h2>
        <p className="mx-auto max-w-md leading-relaxed text-white/75">
          Temukan panduan, jawaban pertanyaan umum, dan video tutorial biar kamu makin maksimal pakai Tata Data Dapur.
        </p>
      </div>

      {/* tab bar */}
      <div
        role="tablist"
        aria-label="Pusat Bantuan"
        className="mb-8 flex gap-1 overflow-x-auto border-b border-[#D9CCAF]"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors",
                active
                  ? "border-[#A05035] font-semibold text-[#A05035]"
                  : "border-transparent font-medium text-[#7C6352] hover:text-[#2C1810]",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* panels */}
      {tab === "tour" && <TourTab />}
      {tab === "faq" && <FaqTab />}
      {tab === "video" && <VideoTab onPlay={setVideo} />}

      {/* video player */}
      <Modal open={Boolean(video)} onClose={() => setVideo(null)} title={video?.title ?? ""} size="lg">
        {video?.src && (
          <video
            src={video.src}
            controls
            autoPlay
            preload="metadata"
            className="w-full rounded-lg"
          >
            Maaf, video tidak bisa dimuat.
          </video>
        )}
      </Modal>
    </AppLayout>
  );
}
