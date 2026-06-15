"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Modal } from "@/components/ui/Modal";
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

/* ── Palette + type (mirrors the landing-page Help Center) ── */
const C = {
  bg: "#F4EDE0",
  paper: "#FBF6EC",
  ink: "#1B1208",
  inkSoft: "#3D2A18",
  muted: "#876A4E",
  line: "#D9C9AE",
  terra: "#B5532A",
  gold: "#C49A3F",
  goldSoft: "#FDF0D9",
  blue: "#2D6A9F",
  blueSoft: "#E0EBF5",
  navBg: "#2A1A0E",
};
const SERIF = "Fraunces, Georgia, serif";
const BODY = 'Inter, "Open Sans", system-ui, sans-serif';
const MONO = '"DM Mono", monospace';
const NOISE =
  "data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.55 0 0 0 0 0.3 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

type TabId = "tour" | "faq" | "video";
const TABS: { id: TabId; label: string; icon: typeof Map }[] = [
  { id: "tour", label: "Tur Menu", icon: Map },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "video", label: "Video Tutorial", icon: Video },
];

/* ════════ shared pieces ════════ */

function Shot({ label }: { label: string }) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1.5px dashed ${C.line}`,
        borderRadius: 10,
        aspectRatio: "16 / 9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        margin: "20px 0",
        color: C.muted,
      }}
    >
      <ImageIcon className="h-[30px] w-[30px]" style={{ opacity: 0.55 }} />
      <span style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </span>
    </div>
  );
}

function FeatureList({ items }: { items: Feature[] }) {
  return (
    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, margin: "16px 0 0", padding: 0 }}>
      {items.map((it, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            gap: 12,
            fontSize: 14,
            color: C.inkSoft,
            alignItems: "flex-start",
            padding: "12px 16px",
            background: C.bg,
            borderRadius: 8,
            border: `1px solid ${C.line}`,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1, lineHeight: 1.4 }} aria-hidden>
            {it.emoji}
          </span>
          <span style={{ lineHeight: 1.6 }}>
            <strong style={{ display: "block", color: C.ink, fontWeight: 600, marginBottom: 2 }}>{it.title}</strong>
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
      style={{
        background: tip ? C.goldSoft : C.blueSoft,
        border: `1px solid ${tip ? "rgba(196,154,63,0.3)" : "rgba(45,106,159,0.2)"}`,
        borderRadius: 10,
        padding: "14px 18px",
        fontSize: 14,
        color: tip ? "#7A5C10" : C.blue,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginTop: 16,
        lineHeight: 1.6,
      }}
    >
      {tip ? (
        <Lightbulb className="h-[18px] w-[18px] shrink-0" style={{ marginTop: 1, color: "#B5862A" }} />
      ) : (
        <Info className="h-[18px] w-[18px] shrink-0" style={{ marginTop: 1, color: C.blue }} />
      )}
      <div>{children}</div>
    </div>
  );
}

function Block({ block }: { block: TourBlock }) {
  switch (block.type) {
    case "p":
      return <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.7, margin: "0 0 16px" }}>{block.node}</p>;
    case "shot":
      return <Shot label={block.label} />;
    case "subhead":
      return <p style={{ fontSize: 15, color: C.inkSoft, margin: "16px 0 0" }}>{block.node}</p>;
    case "features":
      return <FeatureList items={block.items} />;
    case "callout":
      return <Callout variant={block.variant}>{block.node}</Callout>;
    default:
      return null;
  }
}

/* ════════ Tab 1 — Tur Menu ════════ */

function TourTab() {
  return (
    <div className="help-tour-layout">
      <nav
        className="help-tour-nav"
        style={{
          position: "sticky",
          top: 64,
          background: C.paper,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: 16,
          alignSelf: "start",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: C.muted, marginBottom: 12 }}>
          Menu
        </div>
        {TOUR.map((s) => {
          const Icon = s.icon;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="help-nav-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                color: C.inkSoft,
              }}
            >
              <Icon className="h-[15px] w-[15px] shrink-0" />
              {s.title}
            </a>
          );
        })}
      </nav>

      <div>
        {TOUR.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={s.id} style={{ marginBottom: 56, scrollMarginTop: 72 }}>
              <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                <header
                  style={{
                    padding: "24px 28px 20px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 18,
                    borderBottom: `1px solid ${C.line}`,
                    background: C.bg,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: C.navBg,
                      color: C.gold,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon className="h-[22px] w-[22px]" style={{ color: C.gold }} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px", color: C.ink }}>
                      {s.title}
                    </h3>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {s.route}
                    </div>
                  </div>
                </header>
                <div style={{ padding: "24px 28px" }}>
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

/* ════════ Tab 2 — FAQ ════════ */

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
    <div id={id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 10, background: C.paper, scrollMarginTop: 72 }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-a`}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "18px 22px",
          gap: 20,
          cursor: "pointer",
          background: open ? C.bg : "transparent",
          border: "none",
          textAlign: "left",
          fontFamily: BODY,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 500, color: C.ink, flex: 1, lineHeight: 1.4 }}>{q}</span>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: open ? C.terra : C.ink,
            color: C.paper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.3s",
            transform: open ? "rotate(45deg)" : "none",
          }}
        >
          <Plus className="h-4 w-4" />
        </span>
      </button>
      <div id={`${id}-a`} style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 0.3s ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 22px 20px", fontSize: 14, color: C.inkSoft, lineHeight: 1.7, borderTop: `1px solid ${C.line}` }}>
            {a}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqTab({ initialOpen }: { initialOpen?: string | null }) {
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <p style={{ fontSize: 16, color: C.inkSoft, marginBottom: 32, lineHeight: 1.7 }}>
        Pertanyaan yang sering ditanyakan pengguna Tata Data Dapur. Klik pertanyaannya buat lihat jawaban.
      </p>
      {FAQ_GROUPS.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 40 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: C.terra,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {g.title}
            <span style={{ flex: 1, height: 1, background: C.line }} />
          </div>
          {g.items.map((it, ii) => {
            const id = `faq-${gi}-${ii}`;
            return (
              <FaqRow key={id} id={id} q={it.q} a={it.a} open={openId === id} onToggle={() => setOpenId(openId === id ? null : id)} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ════════ Tab 3 — Video ════════ */

function VideoThumb({ card, onPlay }: { card: VideoCard; onPlay: () => void }) {
  const ready = Boolean(card.src);
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      disabled={!ready}
      onClick={ready ? onPlay : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: ready ? C.paper : "transparent",
        border: ready ? `1px solid ${C.line}` : `1.5px dashed ${C.line}`,
        borderRadius: 12,
        overflow: "hidden",
        cursor: ready ? "pointer" : "default",
        opacity: ready ? 1 : 0.62,
        textAlign: "left",
        padding: 0,
        transform: ready && hover ? "translateY(-3px)" : "none",
        boxShadow: ready && hover ? "0 12px 32px rgba(27,18,8,0.1)" : "none",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 9",
          background: C.navBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          opacity: ready ? 1 : 0.5,
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${NOISE}")`, pointerEvents: "none" }} />
        {ready && card.badge && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: C.gold,
              color: C.navBg,
              fontFamily: MONO,
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "3px 8px",
              borderRadius: 100,
              fontWeight: 500,
              zIndex: 1,
            }}
          >
            {card.badge}
          </span>
        )}
        {!ready && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontFamily: MONO,
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "3px 8px",
              borderRadius: 100,
              zIndex: 1,
            }}
          >
            Segera hadir
          </span>
        )}
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: ready && hover ? C.terra : "rgba(255,255,255,0.15)",
            border: `2px solid ${ready && hover ? C.terra : "rgba(255,255,255,0.4)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            position: "relative",
            transition: "all 0.2s",
            paddingLeft: 4,
          }}
        >
          <Play className="h-[18px] w-[18px] fill-current" />
        </span>
        {card.duration && (
          <span
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontFamily: MONO,
              fontSize: 11,
              padding: "2px 7px",
              borderRadius: 4,
            }}
          >
            {card.duration}
          </span>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <h4 style={{ fontWeight: 500, fontSize: 14, margin: "0 0 4px", color: C.ink, lineHeight: 1.4 }}>{card.title}</h4>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {card.meta}
        </div>
      </div>
    </button>
  );
}

function VideoTab({ onPlay }: { onPlay: (c: VideoCard) => void }) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ background: C.navBg, borderRadius: 16, padding: 32, marginBottom: 40, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${NOISE}")`, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: C.gold, marginBottom: 12 }}>
            Video Tutorial
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 24, color: "#fff", fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
            Halo, pengguna Tata Data Dapur! 👋
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.65, margin: 0 }}>
            Selamat datang di halaman tutorial. Di sini kami siapkan video panduan buat bantu kamu memaksimalkan tiap fitur app —
            dari setup awal sampai baca laporan bisnis. Tonton urut biar paling nyantol, atau langsung pilih topik yang kamu butuhkan.
          </p>
        </div>
      </div>

      {VIDEO_SECTIONS.map((sec, si) => (
        <div key={si}>
          <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em", color: C.ink }}>
            {sec.title}
          </h3>
          <div className="help-video-grid" style={{ marginBottom: 40 }}>
            {sec.cards.map((card, ci) => (
              <VideoThumb key={ci} card={card} onPlay={() => onPlay(card)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════ Page ════════ */

export default function HelpCenterPage() {
  const [tab, setTab] = useState<TabId>("tour");
  const [video, setVideo] = useState<VideoCard | null>(null);
  const [faqOpen, setFaqOpen] = useState<string | null>(null);

  // Deep-link support: /help?tab=faq#faq-0-0 (from field HelpTip "Pelajari selengkapnya")
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "tour" || t === "faq" || t === "video") setTab(t);
    const hash = decodeURIComponent(window.location.hash.replace("#", ""));
    if (hash) {
      if (hash.startsWith("faq-")) setFaqOpen(hash);
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, []);

  return (
    <AppLayout title="Pusat Bantuan">
      <style>{`
        .help-shell { font-family: ${BODY}; }
        .help-tour-layout { display: grid; grid-template-columns: 200px 1fr; gap: 40px; align-items: start; }
        .help-video-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .help-nav-link:hover { background: ${C.bg}; color: ${C.terra}; }
        .help-tabbar { position: sticky; top: -16px; z-index: 20; display: flex; overflow-x: auto; background: ${C.paper}; border-bottom: 1px solid ${C.line}; padding: 16px 24px 0; }
        @media (min-width: 640px) { .help-tabbar { top: -24px; padding: 24px 24px 0; } }
        @media (max-width: 760px) {
          .help-tour-layout { grid-template-columns: 1fr; }
          .help-tour-nav { display: none !important; }
        }
        @media (max-width: 600px) { .help-video-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* full-bleed within AppLayout content padding */}
      <div className="help-shell -mx-4 -mt-4 sm:-mx-6 sm:-mt-6" style={{ background: C.bg, color: C.ink, minHeight: "100%" }}>
        {/* dark hero */}
        <header style={{ background: C.navBg, padding: "48px 24px 64px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${NOISE}")`, pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: C.gold, marginBottom: 14 }}>
              Pusat Bantuan
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: "clamp(28px, 5vw, 48px)", color: "#fff", fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              Halo, ada yang bisa
              <br />
              kami <em style={{ fontStyle: "italic", color: C.gold, fontWeight: 400 }}>bantu?</em>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
              Temukan panduan, jawaban pertanyaan umum, dan video tutorial biar kamu makin maksimal pakai Tata Data Dapur.
            </p>
          </div>
        </header>

        {/* sticky tab bar */}
        <div role="tablist" aria-label="Pusat Bantuan" className="help-tabbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "16px 22px",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? C.terra : C.muted,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  borderBottom: `2px solid ${active ? C.terra : "transparent"}`,
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                  fontFamily: BODY,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* panels */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 80px" }}>
          {tab === "tour" && <TourTab />}
          {tab === "faq" && <FaqTab initialOpen={faqOpen} />}
          {tab === "video" && <VideoTab onPlay={setVideo} />}
        </div>
      </div>

      {/* video player */}
      <Modal open={Boolean(video)} onClose={() => setVideo(null)} title={video?.title ?? ""} size="lg">
        {video?.src && (
          <video src={video.src} controls autoPlay preload="metadata" className="w-full rounded-lg">
            Maaf, video tidak bisa dimuat.
          </video>
        )}
      </Modal>
    </AppLayout>
  );
}
