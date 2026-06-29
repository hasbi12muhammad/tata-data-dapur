import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { Receipt, TrendingUp } from "lucide-react";
import { C, rupiah } from "../theme";
import { poppins, openSans } from "../fonts";
import { AppBar, Card, Caption, Field } from "../ui";
import { Decor, Grain } from "../decor";

const PRICE = 25000;
const HPP = 12500;
const QTY = 8;

export const Sales: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 14 } });
  const cardY = interpolate(cardIn, [0, 1], [80, 0]);

  // qty types up 0 -> 8 between 40-90
  const qtyNow = Math.round(
    interpolate(frame, [40, 90], [0, QTY], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const omzet = qtyNow * PRICE;
  const modal = qtyNow * HPP;
  const laba = omzet - modal;

  const cursorOn = Math.floor(frame / 8) % 2 === 0 && frame < 90;

  const resultIn = spring({
    frame: Math.max(0, frame - 100),
    fps,
    config: { damping: 16 },
  });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Decor seed={2} />
      <AppBar title="Catat Penjualan" Icon={Receipt} kicker="Untung Otomatis" />

      <div style={{ padding: "40px 48px", transform: `translateY(${cardY}px)` }}>
        <Card>
          <Field label="Produk" value="Nasi Ayam Geprek" accent />
          <Field
            label="Jumlah Terjual (qty)"
            value={
              <span>
                {qtyNow}
                <span style={{ opacity: cursorOn ? 1 : 0, color: C.dune }}>|</span>
              </span>
            }
            mono
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
              padding: "26px 30px",
              background: "#f4ede0",
              borderRadius: 18,
              border: `2px solid ${C.border}`,
            }}
          >
            <span
              style={{ fontFamily: openSans, fontSize: 32, color: C.muted }}
            >
              Total Penjualan
            </span>
            <span
              style={{
                fontFamily: poppins,
                fontWeight: 700,
                fontSize: 52,
                color: C.casa,
              }}
            >
              {rupiah(omzet)}
            </span>
          </div>
        </Card>

        <div
          style={{
            marginTop: 44,
            opacity: resultIn,
            transform: `translateY(${(1 - resultIn) * 40}px)`,
            display: "flex",
            gap: 22,
          }}
        >
          <Stat label="Omzet" value={rupiah(omzet)} bg={C.casa} />
          <Stat label="Modal" value={rupiah(modal)} bg={C.clay} />
          <Stat label="Laba" value={rupiah(laba)} bg={C.verde} big icon />
        </div>
      </div>

      <Caption>Catat penjualan — laba terhitung otomatis</Caption>
      <Grain />
    </AbsoluteFill>
  );
};

const Stat: React.FC<{
  label: string;
  value: string;
  bg: string;
  big?: boolean;
  icon?: boolean;
}> = ({ label, value, bg, big, icon }) => (
  <div
    style={{
      flex: big ? 1.25 : 1,
      background: bg,
      borderRadius: 28,
      padding: "30px 28px",
      boxShadow: "0 18px 40px rgba(44,24,16,0.12)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: openSans,
        fontSize: 28,
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {icon ? <TrendingUp size={28} color="#fff" strokeWidth={2.4} /> : null}
      {label}
    </div>
    <div
      style={{
        fontFamily: poppins,
        fontWeight: 700,
        fontSize: big ? 50 : 40,
        color: "#fff",
        marginTop: 8,
      }}
    >
      {value}
    </div>
  </div>
);
