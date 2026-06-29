import React from "react";
import type { LucideIcon } from "lucide-react";
import { C } from "./theme";
import { poppins, openSans, fraunces } from "./fonts";

// Top status/app bar of a phone app screen
export const AppBar: React.FC<{
  title: string;
  Icon: LucideIcon;
  kicker?: string;
}> = ({ title, Icon, kicker }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 28,
      padding: "56px 56px 40px",
      background: `linear-gradient(135deg, ${C.casa} 0%, #6a4733 100%)`,
      color: C.gold,
    }}
  >
    <div
      style={{
        width: 92,
        height: 92,
        borderRadius: 26,
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={48} color={C.gold} strokeWidth={1.8} />
    </div>
    <div>
      {kicker ? (
        <div
          style={{
            fontFamily: fraunces,
            fontStyle: "italic",
            fontSize: 28,
            color: "rgba(227,214,179,0.8)",
            marginBottom: 4,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: poppins,
          fontWeight: 600,
          fontSize: 54,
          letterSpacing: -0.5,
          color: "#fff",
        }}
      >
        {title}
      </div>
    </div>
  </div>
);

// Readable caption bar — solid frosted backdrop so text never clashes with decor
export const CaptionBar: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 70,
      left: 70,
      right: 70,
      display: "flex",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        background: "rgba(251,248,242,0.92)",
        border: `2px solid ${C.border}`,
        borderRadius: 28,
        padding: "26px 40px",
        boxShadow: "0 16px 40px rgba(44,24,16,0.18)",
        textAlign: "center",
        fontFamily: openSans,
        fontWeight: 600,
        fontSize: 46,
        lineHeight: 1.28,
        color: C.casa,
        maxWidth: 900,
      }}
    >
      {children}
    </div>
  </div>
);

// Premium editorial kicker (serif italic accent over a gold rule)
export const Kicker: React.FC<{
  children: React.ReactNode;
  color?: string;
}> = ({ children, color = C.dune }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
    <div style={{ width: 56, height: 3, background: color, borderRadius: 2 }} />
    <span
      style={{
        fontFamily: fraunces,
        fontStyle: "italic",
        fontWeight: 600,
        fontSize: 34,
        color,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </span>
  </div>
);

export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: C.surface,
      borderRadius: 36,
      border: `2px solid ${C.border}`,
      boxShadow: "0 24px 60px rgba(44,24,16,0.10)",
      padding: 48,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{
  children: React.ReactNode;
  bg: string;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, bg, color = "#fff", style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      background: bg,
      color,
      fontFamily: poppins,
      fontWeight: 600,
      fontSize: 30,
      padding: "14px 28px",
      borderRadius: 999,
      ...style,
    }}
  >
    {children}
  </div>
);

// Caption shown at the bottom describing the action
export const Caption: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 110,
      left: 0,
      right: 0,
      textAlign: "center",
      padding: "0 80px",
      fontFamily: openSans,
      fontWeight: 600,
      fontSize: 46,
      lineHeight: 1.3,
      color: C.casa,
    }}
  >
    {children}
  </div>
);

export const Field: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}> = ({ label, value, mono, accent }) => (
  <div style={{ marginBottom: 28 }}>
    <div
      style={{
        fontFamily: openSans,
        fontSize: 28,
        color: C.muted,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
    <div
      style={{
        background: accent ? "#f4ede0" : "#fff",
        border: `2px solid ${C.border}`,
        borderRadius: 18,
        padding: "22px 28px",
        fontSize: 34,
        fontFamily: mono ? "monospace" : openSans,
        fontWeight: 600,
        color: C.fg,
      }}
    >
      {value}
    </div>
  </div>
);
