"use strict";

// =========================
// VISUAIS DO BOTÃO (v11): cosméticos desbloqueados por conquistas (dão objetivo de longo prazo). Ficam para sempre.
// h/s/l: cor do domo; enfeite: desenho extra (pixel.js botao). save.skin = escolhido; save.skinsVistas = já avisados.
// cond: [tipo, alvo] — criados, toques, hordas, renasc, ouros, invasores, torre, raids, tier
// =========================
const SKINS = [
  { id: "classico", h: 356, s: 82, l: 54, cond: null },
  { id: "azul",     h: 212, s: 80, l: 56, cond: ["criados", 50] },
  { id: "verde",    h: 138, s: 62, l: 48, cond: ["hordas", 3] },
  { id: "laranja",  h: 26,  s: 92, l: 54, cond: ["toques", 2000] },
  { id: "roxo",     h: 275, s: 68, l: 58, cond: ["renasc", 1] },
  { id: "dourado",  h: 44,  s: 92, l: 56, cond: ["ouros", 10], enfeite: "estrela" },
  { id: "caveira",  h: 260, s: 12, l: 24, cond: ["invasores", 10], enfeite: "caveira" },
  { id: "neon",     h: 184, s: 100, l: 50, cond: ["torre", 10], enfeite: "neon" },
  { id: "lava",     h: 12,  s: 95, l: 46, cond: ["raids", 3], enfeite: "lava" },
  { id: "diamante", h: 194, s: 70, l: 72, cond: ["tier", 20], enfeite: "diamante" },
  { id: "arcoiris", h: 356, s: 82, l: 56, cond: ["renasc", 5], enfeite: "arcoiris" }
];
const SKIN = {}; SKINS.forEach(function(k) { SKIN[k.id] = k; });
function progressoSkin(k) {
  if (!k.cond) return { v: 1, alvo: 1 };
  const st = save.stats, c = k.cond[0], alvo = k.cond[1];
  const v = c === "criados" ? st.criados || 0 : c === "toques" ? st.toques : c === "hordas" ? save.hordasVencidas : c === "renasc" ? save.renascimentos
    : c === "ouros" ? st.ouros || 0 : c === "invasores" ? st.invasores || 0 : c === "torre" ? save.torre.recorde : c === "raids" ? st.raids || 0
    : Math.max.apply(null, save.robosVistos.concat([0]));
  return { v: Math.min(v, alvo), alvo: alvo };
}
function skinLiberada(k) { const p = progressoSkin(k); return p.v >= p.alvo; }
