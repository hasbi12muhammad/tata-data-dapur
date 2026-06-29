import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { ChefHat } from "lucide-react";
import { C, rupiah } from "../theme";
import { poppins, openSans } from "../fonts";
import { AppBar, Card, Caption, Kicker } from "../ui";
import { Decor, Grain } from "../decor";

const ROWS = [
  { name: "Dada Ayam", qty: "150 gr", cost: 5400 },
  { name: "Beras", qty: "120 gr", cost: 1800 },
  { name: "Bumbu Dasar", qty: "1 porsi", cost: 2300 },
  { name: "Minyak Goreng", qty: "20 ml", cost: 600 },
  { name: "Gas + Kemasan", qty: "1 porsi", cost: 2400 },
];
const HPP = ROWS.reduce((a, r) => a + r.cost, 0); // 12500
const PRICE = 25000;

export const RecipeHPP: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 14 } });
  const cardY = interpolate(cardIn, [0, 1], [80, 0]);

  // HPP reveal phase starts at 110, then holds long
  const reveal = frame - 110;
  const countT = interpolate(reveal, [0, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hppNow = HPP * countT;
  const margin = ((PRICE - HPP) / PRICE) * 100;
  const resultIn = spring({
    frame: Math.max(0, reveal),
    fps,
    config: { damping: 16 },
  });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Decor seed={0} />
      <AppBar title="Resep Baru" Icon={ChefHat} kicker="Hitung Modal" />

      <div style={{ padding: "40px 48px", transform: `translateY(${cardY}px)` }}>
        <Card>
          <div style={{ marginBottom: 18 }}>
            <Kicker color={C.dune}>Resep</Kicker>
          </div>
          <div
            style={{
              fontFamily: poppins,
              fontWeight: 700,
              fontSize: 46,
              color: C.fg,
              marginBottom: 8,
            }}
          >
            Nasi Ayam Geprek
          </div>
          <div
            style={{
              fontFamily: openSans,
              fontSize: 30,
              color: C.muted,
              marginBottom: 36,
            }}
          >
            Bahan (BoM) · per porsi
          </div>

          {ROWS.map((r, i) => {
            const t = interpolate(
              frame,
              [20 + i * 16, 40 + i * 16],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "22px 0",
                  borderBottom: `2px solid ${C.border}`,
                  opacity: t,
                  transform: `translateX(${(1 - t) * 40}px)`,
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
                  <div
                    style={{ fontFamily: openSans, fontSize: 27, color: C.muted }}
                  >
                    {r.qty}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 600,
                    fontSize: 34,
                    color: C.casa,
                  }}
                >
                  {rupiah(r.cost)}
                </div>
              </div>
            );
          })}
        </Card>

        {/* HPP result */}
        <div
          style={{
            marginTop: 44,
            opacity: resultIn,
            transform: `scale(${0.9 + resultIn * 0.1})`,
          }}
        >
          <Card
            style={{
              background: C.casa,
              border: "none",
              display: "flex",
              flexDirection: "column",
              gap: 24,
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
            <div
              style={{
                display: "flex",
                gap: 20,
                opacity: interpolate(reveal, [40, 60], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
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
                  background: C.verde,
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
                  {margin.toFixed(0)}%
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Caption>Masukkan resep — HPP langsung terhitung</Caption>
      <Grain />
    </AbsoluteFill>
  );
};
