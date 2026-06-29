import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { TrendingUp, ArrowRight } from "lucide-react";
import { C, rupiah } from "../theme";
import { poppins, openSans } from "../fonts";
import { AppBar, Card } from "../ui";
import { Decor, Grain } from "../decor";

// Pancake Susu Cokelat per porsi. Susu UHT yang naik harga drives everything.
const ROWS = [
  { name: "Tepung", from: 600, to: 600 },
  { name: "Susu UHT", from: 2200, to: 3000 },
  { name: "Telur", from: 2500, to: 2500 },
  { name: "Topping Cokelat", from: 1800, to: 1800 },
  { name: "Gas + Kemasan", from: 1400, to: 1400 },
];
const HPP_FROM = ROWS.reduce((a, r) => a + r.from, 0); // 8500
const HPP_TO = ROWS.reduce((a, r) => a + r.to, 0); // 9300
const SUSU_FROM = 2200;
const SUSU_TO = 3000;
const PRICE = 17000;
const SUGGEST = 19000;
const NAIK_PCT = Math.round(((SUSU_TO - SUSU_FROM) / SUSU_FROM) * 100); // 36

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Simplified scene: one ingredient (Susu UHT) goes up, then HPP + margin
// update, then the suggested price. No full BoM list, no bottom caption —
// the eye follows top to bottom in three beats.
export const PriceAdapt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // beat 1 — price change card in
  const card1 = spring({ frame, fps, config: { damping: 16 } });
  const card1Y = interpolate(card1, [0, 1], [60, 0]);

  // Susu UHT price count: frame 18..48
  const priceT = interpolate(frame, [18, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const susuNow = lerp(SUSU_FROM, SUSU_TO, priceT);

  // beat 2 — HPP card in at frame 48, values count 48..96
  const card2 = spring({
    frame: Math.max(0, frame - 48),
    fps,
    config: { damping: 16 },
  });
  const hppT = interpolate(frame, [48, 96], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hppNow = lerp(HPP_FROM, HPP_TO, hppT);
  const marginNow = lerp(
    ((PRICE - HPP_FROM) / PRICE) * 100,
    ((PRICE - HPP_TO) / PRICE) * 100,
    hppT
  );
  const marginColor = hppT < 0.5 ? C.verde : "#b8860b"; // green -> amber as it drops
  const hppGlow = interpolate(frame, [48, 78, 120], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // beat 3 — suggestion banner slide up at frame 110
  const banner = spring({
    frame: Math.max(0, frame - 110),
    fps,
    config: { damping: 15 },
  });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Decor seed={1} />
      <AppBar title="Pancake Susu Cokelat" Icon={TrendingUp} kicker="Harga bahan baru" />

      <div style={{ padding: "48px 48px 0", display: "flex", flexDirection: "column", gap: 36 }}>
        {/* Beat 1 — the ingredient that went up */}
        <div style={{ opacity: card1, transform: `translateY(${card1Y}px)` }}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontFamily: openSans, fontSize: 30, color: C.muted }}>
              Harga bahan naik
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: poppins, fontWeight: 700, fontSize: 46, color: C.fg }}>
                Susu UHT
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: C.dune,
                  color: "#fff",
                  fontFamily: poppins,
                  fontWeight: 700,
                  fontSize: 30,
                  padding: "10px 22px",
                  borderRadius: 999,
                  opacity: priceT,
                }}
              >
                <TrendingUp size={30} color="#fff" strokeWidth={2.6} />
                naik {NAIK_PCT}%
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 46, color: C.muted }}>
                {rupiah(SUSU_FROM)}
              </span>
              <ArrowRight size={40} color={C.dune} strokeWidth={2.6} />
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 56, color: C.dune }}>
                {rupiah(susuNow)}
              </span>
            </div>
          </Card>
        </div>

        {/* Beat 2 — HPP + margin react */}
        <div style={{ opacity: card2, transform: `translateY(${interpolate(card2, [0, 1], [60, 0])}px)` }}>
          <Card
            style={{
              background: C.casa,
              border: "none",
              display: "flex",
              flexDirection: "column",
              gap: 22,
              boxShadow: `0 24px 60px rgba(44,24,16,${0.12 + hppGlow * 0.28})`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: poppins, fontWeight: 600, fontSize: 40, color: C.gold }}>
                HPP per porsi
              </div>
              <div style={{ fontFamily: poppins, fontWeight: 700, fontSize: 76, color: "#fff" }}>
                {rupiah(hppNow)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 22, padding: "24px 28px" }}>
                <div style={{ fontFamily: openSans, fontSize: 28, color: C.gold }}>Harga Jual</div>
                <div style={{ fontFamily: poppins, fontWeight: 700, fontSize: 46, color: "#fff" }}>
                  {rupiah(PRICE)}
                </div>
              </div>
              <div style={{ flex: 1, background: marginColor, borderRadius: 22, padding: "24px 28px" }}>
                <div style={{ fontFamily: openSans, fontSize: 28, color: "#eef" }}>Margin</div>
                <div style={{ fontFamily: poppins, fontWeight: 700, fontSize: 46, color: "#fff" }}>
                  {marginNow.toFixed(0)}%
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Beat 3 — suggestion */}
        <div style={{ opacity: banner, transform: `translateY(${interpolate(banner, [0, 1], [50, 0])}px)` }}>
          <div
            style={{
              background: C.dune,
              borderRadius: 26,
              padding: "30px 36px",
              boxShadow: "0 16px 40px rgba(44,24,16,0.28)",
            }}
          >
            <div style={{ fontFamily: openSans, fontWeight: 700, fontSize: 42, lineHeight: 1.3, color: "#fff" }}>
              Naikin harga ke {rupiah(SUGGEST)}, untungmu balik kayak semula.
            </div>
          </div>
        </div>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};
