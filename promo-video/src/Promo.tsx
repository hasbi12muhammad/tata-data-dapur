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
import { Shot } from "./scenes/Shot";
import { RecipeFlow } from "./scenes/RecipeFlow";
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

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Pain hook 0–120 */}
      <Sequence from={0} durationInFrames={120}>
        <Fade dur={120} inOnly>
          <Pain />
        </Fade>
      </Sequence>

      {/* Intro / solution reveal 120–210 */}
      <Sequence from={120} durationInFrames={90}>
        <Fade dur={90}>
          <Intro />
        </Fade>
      </Sequence>

      {/* Recipe → HPP flow (real recording) 210–480 */}
      <Sequence from={210} durationInFrames={270}>
        <Fade dur={270}>
          <RecipeFlow
            kicker="Hitung HPP"
            caption="Masukin bahannya, modal per porsi langsung muncul"
            callout="ngitung sendiri"
            calloutFrame={200}
          />
        </Fade>
      </Sequence>

      {/* Sales 480–630 */}
      <Sequence from={480} durationInFrames={150}>
        <Fade dur={150}>
          <Shot
            src="shots/sales.png"
            kicker="Catat Jualan"
            caption="Tiap transaksi, untungnya langsung kelihatan"
            decorSeed={2}
            callout={{ text: "untung kehitung", atY: 0.24, color: C.verde, side: "right" }}
          />
        </Fade>
      </Sequence>

      {/* Stock 630–780 */}
      <Sequence from={630} durationInFrames={150}>
        <Fade dur={150}>
          <Shot
            src="shots/items.png"
            kicker="Pantau Stok"
            caption="Sisa stok tiap bahan kepantau, gak usah nebak"
            decorSeed={1}
            callout={{ text: "sisa stok", atY: 0.34, color: C.verde, side: "right" }}
          />
        </Fade>
      </Sequence>

      {/* Outro 780–900 */}
      <Sequence from={780} durationInFrames={120}>
        <Fade dur={120} out>
          <Outro />
        </Fade>
      </Sequence>
    </AbsoluteFill>
  );
};
