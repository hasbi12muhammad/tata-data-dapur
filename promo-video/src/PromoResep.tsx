import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { C } from "./theme";
import { Pain } from "./scenes/Pain";
import { Intro } from "./scenes/Intro";
import { RecipeFlow } from "./scenes/RecipeFlow";
import { PriceAdapt } from "./scenes/PriceAdapt";
import { Outro } from "./scenes/Outro";

const Fade: React.FC<{
  dur: number;
  inOnly?: boolean;
  out?: boolean;
  children: React.ReactNode;
}> = ({ dur, inOnly, out, children }) => {
  const f = useCurrentFrame();
  let op = 1;
  if (inOnly) {
    op = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  } else if (out) {
    op = interpolate(f, [dur - 14, dur], [1, 0], { extrapolateLeft: "clamp" });
  }
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>;
};

const PAINS = [
  "Harga bahan naik terus, harga jualmu masih segitu?",
  "Jualan laris, tapi untungnya kok mepet?",
  "Tiap bahan naik, mesti ngitung ulang dari nol?",
];

export const PromoResep: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Pain 0-120 */}
      <Sequence from={0} durationInFrames={120}>
        <Fade dur={120} inOnly>
          <Pain pains={PAINS} turn="Tenang, ada cara gampangnya." />
        </Fade>
      </Sequence>

      {/* Intro 120-210 */}
      <Sequence from={120} durationInFrames={90}>
        <Fade dur={90}>
          <Intro />
        </Fade>
      </Sequence>

      {/* RecipeFlow (rekaman app asli) 210-480 */}
      <Sequence from={210} durationInFrames={270}>
        <Fade dur={270}>
          <RecipeFlow
            kicker="Hitung HPP"
            caption="Masukin bahannya, modal per porsi langsung muncul."
            callout="ngitung sendiri"
            calloutFrame={200}
          />
        </Fade>
      </Sequence>

      {/* PriceAdapt 480-770 */}
      <Sequence from={480} durationInFrames={290}>
        <Fade dur={290}>
          <PriceAdapt />
        </Fade>
      </Sequence>

      {/* Outro 770-900 */}
      <Sequence from={770} durationInFrames={130}>
        <Fade dur={130} out>
          <Outro />
        </Fade>
      </Sequence>
    </AbsoluteFill>
  );
};
