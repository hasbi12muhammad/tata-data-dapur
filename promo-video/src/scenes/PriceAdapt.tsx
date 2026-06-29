import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { TrendingUp } from "lucide-react";
import { C, rupiah } from "../theme";
import { poppins, openSans } from "../fonts";
import { AppBar, Card, Caption, Kicker } from "../ui";
import { Decor, Grain } from "../decor";

// Pancake Susu Cokelat — modal per porsi. Susu UHT yang naik harga.
const ROWS = [
  { name: "Tepung", qty: "50 gr", from: 600, to: 600 },
  { name: "Susu UHT", qty: "100 ml", from: 2200, to: 3000 },
  { name: "Telur", qty: "1 butir", from: 2500, to: 2500 },
  { name: "Topping Cokelat", qty: "20 gr", from: 1800, to: 1800 },
  { name: "Gas + Kemasan", qty: "1 porsi", from: 1400, to: 1400 },
];
const HPP_FROM = ROWS.reduce((a, r) => a + r.from, 0); // 8500
const HPP_TO = ROWS.reduce((a, r) => a + r.to, 0); // 9300
const PRICE = 17000;
const SUGGEST = 19000;
const NAIK_PCT = Math.round(((3000 - 2200) / 2200) * 100); // 36

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const PriceAdapt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 16 } });
  const cardY = interpolate(cardIn, [0, 1], [70, 0]);

  // price spike on Susu UHT: frame 40..80
  const priceT = interpolate(frame, [40, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const susuNow = lerp(2200, 3000, priceT);
  const susuFlash = interpolate(frame, [40, 60, 100], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // HPP re-count: frame 80..140
  const hppT = interpolate(frame, [80, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hppNow = lerp(HPP_FROM, HPP_TO, hppT);
  const hppGlow = interpolate(frame, [80, 110, 150], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // margin: frame 120..170 (50% -> 45%)
  const marginT = interpolate(frame, [120, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const marginNow = lerp(
    ((PRICE - HPP_FROM) / PRICE) * 100,
    ((PRICE - HPP_TO) / PRICE) * 100,
    marginT
  );
  // verde -> amber as margin drops
  const marginColor = marginT < 0.5 ? C.verde : "#b8860b";

  // suggestion banner: slide up frame 170..210
  const bannerIn = spring({
    frame: Math.max(0, frame - 170),
    fps,
    config: { damping: 15 },
  });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Decor seed={1} />
      <AppBar title="Pancake Susu Cokelat" Icon={TrendingUp} kicker="Harga bahan baru" />

      <div style={{ padding: "36px 48px", transform: `translateY(${cardY}px)` }}>
        <Card>
          <div style={{ marginBottom: 18 }}>
            <Kicker color={C.dune}>Bahan per porsi</Kicker>
          </div>

          {ROWS.map((r, i) => {
            const isSusu = r.name === "Susu UHT";
            const shownCost = isSusu ? susuNow : r.from;
            return (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "20px 18px",
                  margin: "0 -18px",
                  borderBottom: `2px solid ${C.border}`,
                  borderRadius: 16,
                  background: isSusu
                    ? `rgba(160,80,53,${0.14 * susuFlash})`
                    : "transparent",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: openSans,
                      fontWeight: 600,
                      fontSize: 36,
                      color: C.fg,
                    }}
                  >
                    {r.name}
                  </div>
                  <div style={{ fontFamily: openSans, fontSize: 27, color: C.muted }}>
                    {r.qty}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {isSusu && priceT > 0.05 && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: C.dune,
                        color: "#fff",
                        fontFamily: poppins,
                        fontWeight: 700,
                        fontSize: 26,
                        padding: "8px 18px",
                        borderRadius: 999,
                        opacity: priceT,
                      }}
                    >
                      <TrendingUp size={26} color="#fff" strokeWidth={2.6} />
                      naik {NAIK_PCT}%
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 600,
                      fontSize: 34,
                      color: isSusu && priceT > 0.5 ? C.dune : C.casa,
                    }}
                  >
                    {rupiah(shownCost)}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        {/* HPP + margin result */}
        <div style={{ marginTop: 36 }}>
          <Card
            style={{
              background: C.casa,
              border: "none",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              boxShadow: `0 24px 60px rgba(44,24,16,${0.12 + hppGlow * 0.28})`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: poppins,
                  fontWeight: 600,
                  fontSize: 40,
                  color: C.gold,
                }}
              >
                HPP per porsi
              </div>
              <div
                style={{
                  fontFamily: poppins,
                  fontWeight: 700,
                  fontSize: 72,
                  color: "#fff",
                }}
              >
                {rupiah(hppNow)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 22,
                  padding: "26px 30px",
                }}
              >
                <div style={{ fontFamily: openSans, fontSize: 28, color: C.gold }}>
                  Harga Jual
                </div>
                <div
                  style={{
                    fontFamily: poppins,
                    fontWeight: 700,
                    fontSize: 46,
                    color: "#fff",
                  }}
                >
                  {rupiah(PRICE)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: marginColor,
                  borderRadius: 22,
                  padding: "26px 30px",
                }}
              >
                <div style={{ fontFamily: openSans, fontSize: 28, color: "#eef" }}>
                  Margin
                </div>
                <div
                  style={{
                    fontFamily: poppins,
                    fontWeight: 700,
                    fontSize: 46,
                    color: "#fff",
                  }}
                >
                  {marginNow.toFixed(0)}%
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* suggestion banner */}
        <div
          style={{
            marginTop: 30,
            opacity: bannerIn,
            transform: `translateY(${interpolate(bannerIn, [0, 1], [50, 0])}px)`,
          }}
        >
          <div
            style={{
              background: C.dune,
              borderRadius: 26,
              padding: "30px 36px",
              boxShadow: "0 16px 40px rgba(44,24,16,0.28)",
            }}
          >
            <div
              style={{
                fontFamily: openSans,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.3,
                color: "#fff",
              }}
            >
              Naikin harga ke {rupiah(SUGGEST)}, untungmu balik kayak semula.
            </div>
          </div>
        </div>
      </div>

      <Caption>
        Harga bahan berubah, HPP sama saran harganya ikut nyesuain sendiri.
      </Caption>
      <Grain />
    </AbsoluteFill>
  );
};
