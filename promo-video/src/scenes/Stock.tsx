import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { Package, AlertTriangle } from "lucide-react";
import { C } from "../theme";
import { poppins, openSans } from "../fonts";
import { AppBar, Card, Caption } from "../ui";
import { Decor, Grain } from "../decor";

// from -> to (stock %), unit label
const ITEMS = [
  { name: "Dada Ayam", unit: "2,4 kg", from: 0.62, to: 0.18, low: true },
  { name: "Beras", unit: "8,5 kg", from: 0.8, to: 0.66, low: false },
  { name: "Bumbu Dasar", unit: "14 porsi", from: 0.55, to: 0.34, low: false },
  { name: "Minyak Goreng", unit: "0,9 L", from: 0.4, to: 0.12, low: true },
];

export const Stock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 14 } });
  const cardY = interpolate(cardIn, [0, 1], [80, 0]);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Decor seed={1} />
      <AppBar title="Stok Bahan Baku" Icon={Package} kicker="Real-time" />

      <div style={{ padding: "40px 48px", transform: `translateY(${cardY}px)` }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 44 }}>
          {ITEMS.map((it, i) => {
            const appear = interpolate(
              frame,
              [6 + i * 10, 24 + i * 10],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            // deplete after appearing
            const dep = interpolate(frame, [90, 150], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const level = it.from + (it.to - it.from) * dep;
            const isLow = it.low && level < 0.25;
            const barColor = isLow
              ? C.destructive
              : level < 0.4
                ? C.dune
                : C.verde;
            return (
              <div
                key={it.name}
                style={{
                  opacity: appear,
                  transform: `translateX(${(1 - appear) * 40}px)`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: poppins,
                      fontWeight: 600,
                      fontSize: 40,
                      color: C.fg,
                    }}
                  >
                    {it.name}
                  </div>
                  {isLow ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontFamily: poppins,
                        fontWeight: 600,
                        fontSize: 26,
                        color: "#fff",
                        background: C.destructive,
                        padding: "10px 22px",
                        borderRadius: 999,
                      }}
                    >
                      <AlertTriangle size={26} color="#fff" strokeWidth={2.4} />
                      Stok Menipis
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: openSans,
                        fontSize: 32,
                        color: C.muted,
                      }}
                    >
                      {it.unit}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    height: 34,
                    borderRadius: 999,
                    background: "#eadfca",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(0, level) * 100}%`,
                      background: barColor,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Caption>Pantau stok bahan baku secara real-time</Caption>
      <Grain />
    </AbsoluteFill>
  );
};
