import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
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

export const RecipeFlow: React.FC<{
  kicker: string;
  caption: string;
  callout: string;
  calloutFrame: number;
}> = ({ kicker, caption, callout, calloutFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16, mass: 0.8 } });
  const frameY = interpolate(frameIn, [0, 1], [70, 0]);

  // device frame matched to the recording aspect (780x1688) so nothing is cropped
  const FW = 682;
  const FH = 1438;
  const FX = (1080 - FW) / 2;
  const FY = 196;

  const coIn = spring({
    frame: Math.max(0, frame - calloutFrame),
    fps,
    config: { damping: 14 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${C.cloth} 0%, ${C.bg} 65%)`,
      }}
    >
      <Decor seed={0} opacity={0.5} />

      <div
        style={{
          position: "absolute",
          top: 110,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Kicker color={C.dune}>{kicker}</Kicker>
      </div>

      {/* Device frame with the recorded recipe-building flow */}
      <div
        style={{
          position: "absolute",
          left: FX,
          top: FY,
          width: FW,
          height: FH,
          transform: `translateY(${frameY}px)`,
          borderRadius: 52,
          padding: 16,
          background: "#1c120c",
          boxShadow: "0 50px 110px rgba(44,24,16,0.34)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 38,
            overflow: "hidden",
            background: C.surface,
          }}
        >
          <OffthreadVideo
            src={staticFile("shots/recipe-flow.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* callout pointing at the HPP result (lower part of the modal) */}
        <div
          style={{
            position: "absolute",
            top: FH * 0.82,
            right: -24,
            transform: `translateY(-50%) scale(${coIn})`,
            transformOrigin: "right center",
            opacity: coIn,
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: C.dune,
              color: "#fff",
              fontFamily: poppins,
              fontWeight: 700,
              fontSize: 33,
              padding: "18px 30px",
              borderRadius: 999,
              boxShadow: "0 16px 40px rgba(44,24,16,0.28)",
              whiteSpace: "nowrap",
            }}
          >
            {callout}
          </div>
          <div style={{ width: 48, height: 4, background: C.dune }} />
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "#fff",
              border: `5px solid ${C.dune}`,
            }}
          />
        </div>
      </div>

      <CaptionBar>{caption}</CaptionBar>
      <Grain />
    </AbsoluteFill>
  );
};
