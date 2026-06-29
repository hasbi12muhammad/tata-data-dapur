import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { C } from "./theme";

// Real hand-drawn culinary illustrations from the landing page
// (public/decor/*.webp — vintage etching style, transparent PNG/WebP).
const ALL = [
  "onion",
  "garlic",
  "chili",
  "parsley",
  "sage",
  "basil",
  "tomato",
  "mushroom",
  "ginger",
  "cinnamon",
];

type Spot = { img: string; x: number; y: number; size: number; rot: number; drift: number };

// Six placements around the frame edges. `seed` rotates which illustration
// lands in each slot so scenes don't all look identical.
// Kept clear of the bottom caption band (y > ~1620) so text stays readable.
const SLOTS: Omit<Spot, "img">[] = [
  { x: -70, y: 60, size: 300, rot: -12, drift: 14 },
  { x: 830, y: 20, size: 260, rot: 16, drift: -10 },
  { x: 915, y: 1300, size: 240, rot: 8, drift: 12 },
  { x: -80, y: 1280, size: 250, rot: -20, drift: -12 },
  { x: 60, y: 760, size: 175, rot: 30, drift: 8 },
  { x: 885, y: 800, size: 185, rot: -24, drift: -8 },
];

export const Decor: React.FC<{ seed?: number; opacity?: number }> = ({
  seed = 0,
  opacity = 0.5,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity }}>
      {SLOTS.map((s, i) => {
        const img = ALL[(i * 2 + seed * 3) % ALL.length];
        const dy = Math.sin(frame / 42 + i) * s.drift;
        const dr = Math.sin(frame / 64 + i) * 2.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              transform: `rotate(${s.rot + dr}deg) translateY(${dy}px)`,
            }}
          >
            <Img
              src={staticFile(`decor/${img}.webp`)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "saturate(0.92)",
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Film-grain + vignette overlay for a premium finish
export const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(44,24,16,0.16) 100%)",
      mixBlendMode: "multiply",
    }}
  />
);

export const fadeUp = (frame: number, start: number, dist = 40) => ({
  opacity: interpolate(frame, [start, start + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
  ty: interpolate(frame, [start, start + 18], [dist, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
});
