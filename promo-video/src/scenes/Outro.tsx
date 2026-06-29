import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { ArrowRight } from "lucide-react";
import { C } from "../theme";
import { poppins, openSans, fraunces } from "../fonts";
import { Decor } from "../decor";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 13 } });
  const ctaIn = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 14 },
  });
  const pulse = 1 + Math.sin(frame / 9) * 0.025;

  return (
    <AbsoluteFill
      style={{
        background: C.casa,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Decor seed={4} opacity={0.32} />
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: 56,
          background: "rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoIn})`,
        }}
      >
        <Img src={staticFile("td-logo.png")} style={{ width: 210, height: 210 }} />
      </div>

      <div
        style={{
          fontFamily: fraunces,
          fontWeight: 700,
          fontSize: 92,
          color: "#fff",
          marginTop: 60,
          opacity: logoIn,
          textAlign: "center",
        }}
      >
        Tata Data Dapur
      </div>
      <div
        style={{
          fontFamily: openSans,
          fontSize: 38,
          color: C.gold,
          marginTop: 16,
          opacity: logoIn,
        }}
      >
        Resep, stok, jualan — semua di satu app
      </div>

      <div
        style={{
          marginTop: 90,
          opacity: ctaIn,
          transform: `scale(${ctaIn * pulse})`,
          background: C.dune,
          color: "#fff",
          fontFamily: poppins,
          fontWeight: 700,
          fontSize: 52,
          padding: "36px 84px",
          borderRadius: 999,
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        Coba Sekarang
        <ArrowRight size={50} color="#fff" strokeWidth={2.6} />
      </div>
    </AbsoluteFill>
  );
};
