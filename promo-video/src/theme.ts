// Warm Earthy Palette — mirrors app globals.css
export const C = {
  cloth: "#e9dfc6",
  clay: "#b88d6a",
  casa: "#7c563d", // primary / sidebar (brown)
  dune: "#a05035", // CTA / action (terracotta)
  verde: "#737b4c", // success / profit (green)
  bg: "#f2ebd9",
  surface: "#fbf8f2",
  fg: "#2c1810",
  muted: "#7c6352",
  border: "#d9ccaf",
  destructive: "#c0392b",
  gold: "#e3d6b3", // logo cream
};

export const rupiah = (n: number) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");
