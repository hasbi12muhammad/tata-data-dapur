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
import { C } from "../theme";
import { poppins, openSans, fraunces } from "../fonts";
import { Decor, Grain } from "../decor";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, mass: 0.7 } });
  const logoY = interpolate(logoScale, [0, 1], [60, 0]);

  const titleOp = interpolate(frame, [22, 42], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [22, 42], [40, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 38%, ${C.cloth} 0%, ${C.bg} 60%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Decor seed={3} opacity={0.55} />
      <div
        style={{
          fontFamily: fraunces,
          fontStyle: "italic",
          fontSize: 38,
          color: C.dune,
          marginBottom: 40,
          opacity: titleOp,
          letterSpacing: 1,
        }}
      >
        — buat usaha dapur kecil —
      </div>
      <div
        style={{
          width: 360,
          height: 360,
          borderRadius: 64,
          background: C.casa,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${logoY}px) scale(${logoScale})`,
          boxShadow: "0 40px 90px rgba(124,86,61,0.35)",
        }}
      >
        <Img
          src={staticFile("td-logo.png")}
          style={{ width: 240, height: 240 }}
        />
      </div>

      <div
        style={{
          fontFamily: fraunces,
          fontWeight: 700,
          fontSize: 96,
          color: C.casa,
          marginTop: 70,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          letterSpacing: -1,
        }}
      >
        Tata Data Dapur
      </div>
      <div
        style={{
          fontFamily: openSans,
          fontSize: 40,
          color: C.muted,
          marginTop: 18,
          opacity: titleOp,
        }}
      >
        Jualan makanan, untungnya kelihatan jelas.
      </div>
      <Grain />
    </AbsoluteFill>
  );
};
