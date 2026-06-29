import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { HelpCircle, Sparkles } from "lucide-react";
import { C } from "../theme";
import { poppins, fraunces } from "../fonts";
import { Decor, Grain } from "../decor";

const DEFAULT_PAINS = [
  "Nentuin harga jual masih main feeling?",
  "Jualan rame, tapi untungnya kok tipis?",
  "Stok bahan abis pas lagi laku-lakunya?",
];
const DEFAULT_TURN = "Ada cara yang lebih gampang.";

export const Pain: React.FC<{ pains?: string[]; turn?: string }> = ({
  pains = DEFAULT_PAINS,
  turn = DEFAULT_TURN,
}) => {
  const frame = useCurrentFrame();

  const closeIn = interpolate(frame, [82, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, #3a2618 0%, ${C.casa} 100%)`,
        justifyContent: "center",
        padding: "0 90px",
      }}
    >
      <Decor seed={2} opacity={0.13} />

      <div style={{ display: "flex", flexDirection: "column", gap: 52 }}>
        {pains.map((p, i) => {
          const start = 6 + i * 24;
          const op = interpolate(frame, [start, start + 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const tx = interpolate(frame, [start, start + 16], [-40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `translateX(${tx}px)`,
                display: "flex",
                alignItems: "flex-start",
                gap: 24,
              }}
            >
              <div style={{ marginTop: 6 }}>
                <HelpCircle size={56} color={C.clay} strokeWidth={2.2} />
              </div>
              <div
                style={{
                  fontFamily: poppins,
                  fontWeight: 600,
                  fontSize: 58,
                  lineHeight: 1.22,
                  color: "#f3ead8",
                }}
              >
                {p}
              </div>
            </div>
          );
        })}
      </div>

      {/* turn line */}
      <div
        style={{
          marginTop: 90,
          opacity: closeIn,
          transform: `translateY(${(1 - closeIn) * 30}px)`,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Sparkles size={50} color={C.gold} strokeWidth={2.2} />
        <div
          style={{
            fontFamily: fraunces,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 56,
            color: C.gold,
          }}
        >
          {turn}
        </div>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};
