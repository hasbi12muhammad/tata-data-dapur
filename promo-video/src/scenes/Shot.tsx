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
import { poppins } from "../fonts";
import { Kicker, CaptionBar } from "../ui";
import { Decor, Grain } from "../decor";

export type Callout = {
  text: string;
  atY: number; // 0..1 vertical position over the device frame
  color: string;
  side?: "left" | "right";
};

export const Shot: React.FC<{
  src: string;
  kicker: string;
  caption: string;
  callout: Callout;
  decorSeed?: number;
}> = ({ src, kicker, caption, callout, decorSeed = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16, mass: 0.8 } });
  const frameY = interpolate(frameIn, [0, 1], [70, 0]);

  // Slow Ken-Burns zoom on the screenshot
  const zoom = interpolate(frame, [0, 200], [1.04, 1.13]);

  // device frame geometry
  const FW = 820;
  const FH = 1480;
  const FX = (1080 - FW) / 2;
  const FY = 250;

  const coStart = 55;
  const coIn = spring({
    frame: Math.max(0, frame - coStart),
    fps,
    config: { damping: 14 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${C.cloth} 0%, ${C.bg} 65%)`,
      }}
    >
      <Decor seed={decorSeed} opacity={0.5} />

      {/* Kicker header */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Kicker color={callout.color}>{kicker}</Kicker>
      </div>

      {/* Device frame with screenshot */}
      <div
        style={{
          position: "absolute",
          left: FX,
          top: FY,
          width: FW,
          height: FH,
          transform: `translateY(${frameY}px)`,
          borderRadius: 56,
          padding: 16,
          background: "#1c120c",
          boxShadow: "0 50px 110px rgba(44,24,16,0.34)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 42,
            overflow: "hidden",
            background: C.surface,
            position: "relative",
          }}
        >
          <Img
            src={staticFile(src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
          />
        </div>

        {/* Callout annotation */}
        <Annotation
          text={callout.text}
          color={callout.color}
          side={callout.side ?? "right"}
          y={callout.atY * FH}
          op={coIn}
        />
      </div>

      <CaptionBar>{caption}</CaptionBar>

      <Grain />
    </AbsoluteFill>
  );
};

const Annotation: React.FC<{
  text: string;
  color: string;
  side: "left" | "right";
  y: number;
  op: number;
}> = ({ text, color, side, y, op }) => {
  const right = side === "right";
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        [right ? "right" : "left"]: -28,
        transform: `translateY(-50%) scale(${op})`,
        transformOrigin: right ? "right center" : "left center",
        opacity: op,
        display: "flex",
        flexDirection: right ? "row-reverse" : "row",
        alignItems: "center",
        gap: 0,
      }}
    >
      <div
        style={{
          background: color,
          color: "#fff",
          fontFamily: poppins,
          fontWeight: 700,
          fontSize: 34,
          padding: "20px 32px",
          borderRadius: 999,
          boxShadow: "0 16px 40px rgba(44,24,16,0.28)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      {/* little pointer dot + line into the frame */}
      <div
        style={{
          width: 52,
          height: 4,
          background: color,
          [right ? "marginRight" : "marginLeft"]: -2,
        }}
      />
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "#fff",
          border: `5px solid ${color}`,
        }}
      />
    </div>
  );
};
