/** Paletas e estilos das 4 skins do TETROK */
export const SKIN_IDS = ["neon", "candy", "crt", "pixel"];

export const SKIN_META = {
  neon: { label: "Neon", themeColor: "#050814" },
  candy: { label: "Doce", themeColor: "#fff1e0" },
  crt: { label: "CRT", themeColor: "#0a0800" },
  pixel: { label: "Pixel", themeColor: "#0b1220" },
};

/** Cores por peça em cada skin */
export const SKIN_PALETTE = {
  neon: {
    viga: { color: "#22d3ee", deep: "#0891b2" },
    quadro: { color: "#fde047", deep: "#ca8a04" },
    ancora: { color: "#e879f9", deep: "#a21caf" },
    onda: { color: "#a3e635", deep: "#4d7c0f" },
    raio: { color: "#fb7185", deep: "#be123c" },
    gancho: { color: "#60a5fa", deep: "#1d4ed8" },
    cotovelo: { color: "#fb923c", deep: "#c2410c" },
  },
  candy: {
    viga: { color: "#7dd3fc", deep: "#38bdf8" },
    quadro: { color: "#fde68a", deep: "#fbbf24" },
    ancora: { color: "#d8b4fe", deep: "#c084fc" },
    onda: { color: "#86efac", deep: "#4ade80" },
    raio: { color: "#fda4af", deep: "#fb7185" },
    gancho: { color: "#a5b4fc", deep: "#818cf8" },
    cotovelo: { color: "#fdba74", deep: "#fb923c" },
  },
  crt: {
    // monocromático âmbar — variação por textura no draw
    viga: { color: "#ffb000", deep: "#a35c00", hatch: false },
    quadro: { color: "#ffc933", deep: "#b36b00", hatch: true },
    ancora: { color: "#ffb000", deep: "#8a4b00", hatch: false },
    onda: { color: "#e09a00", deep: "#7a4200", hatch: true },
    raio: { color: "#ffcc44", deep: "#a35c00", hatch: false },
    gancho: { color: "#ffb000", deep: "#6e3a00", hatch: true },
    cotovelo: { color: "#ffc933", deep: "#8a4b00", hatch: false },
  },
  pixel: {
    viga: { color: "#2ee6ff", deep: "#0088aa" },
    quadro: { color: "#ffe14a", deep: "#c9a000" },
    ancora: { color: "#d46bff", deep: "#8a20c9" },
    onda: { color: "#4dff6a", deep: "#129a2a" },
    raio: { color: "#ff4d5e", deep: "#b01020" },
    gancho: { color: "#4d7dff", deep: "#1a3aaa" },
    cotovelo: { color: "#ff9a3c", deep: "#c45a00" },
  },
};

export function skinColors(theme, pieceId) {
  const t = SKIN_PALETTE[theme] || SKIN_PALETTE.neon;
  return t[pieceId] || t.viga || { color: "#22d3ee", deep: "#0891b2" };
}

export function skinStyle(theme) {
  if (theme === "candy") return "soft";
  if (theme === "crt") return "crt";
  if (theme === "pixel") return "pixel";
  return "neon";
}
