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
      {/* Pain 0-108 */}
      <Sequence from={0} durationInFrames={108}>
        <Fade dur={108} inOnly>
          <Pain pains={PAINS} turn="Tenang, ada cara gampangnya." />
        </Fade>
      </Sequence>

      {/* Intro 108-192 */}
      <Sequence from={108} durationInFrames={84}>
        <Fade dur={84}>
          <Intro />
        </Fade>
      </Sequence>

      {/* RecipeFlow (rekaman app asli) 192-618 - full 14.2s recording so the whole bahan input + HPP is readable */}
      <Sequence from={192} durationInFrames={426}>
        <Fade dur={426}>
          <RecipeFlow
            kicker="Hitung HPP"
            caption="Masukin bahannya, modal per porsi langsung muncul."
            callout="ngitung sendiri"
            calloutFrame={360}
          />
        </Fade>
      </Sequence>

      {/* PriceAdapt 618-792 */}
      <Sequence from={618} durationInFrames={174}>
        <Fade dur={174}>
          <PriceAdapt />
        </Fade>
      </Sequence>

      {/* Outro 792-900 */}
      <Sequence from={792} durationInFrames={108}>
        <Fade dur={108} out>
          <Outro />
        </Fade>
      </Sequence>
    </AbsoluteFill>
  );
};
