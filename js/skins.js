/** Paletas e estilos das 4 skins do TETROK */
export const SKIN_IDS = ["neon", "magma", "crt", "pixel"];

export const SKIN_META = {
  neon: { label: "Neon", themeColor: "#050814" },
  magma: { label: "Magma", themeColor: "#0a0402" },
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
  magma: {
    // lava: amarelo-branco quente → vermelho → carvão
    viga: { color: "#ff6b2c", deep: "#7f1d1d" },
    quadro: { color: "#ffd166", deep: "#b45309" },
    ancora: { color: "#ff3d5a", deep: "#6b0f1a" },
    onda: { color: "#ff9f1c", deep: "#9a3412" },
    raio: { color: "#ffef9f", deep: "#c2410c" },
    gancho: { color: "#ef4444", deep: "#450a0a" },
    cotovelo: { color: "#fb923c", deep: "#7c2d12" },
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
  if (theme === "magma") return "magma";
  if (theme === "crt") return "crt";
  if (theme === "pixel") return "pixel";
  return "neon";
}
