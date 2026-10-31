"use strict";

// =========================
// HORDAS DE MONSTROS: 9 dificuldades; as 3 primeiras abertas desde o começo, cada vitória libera a seguinte.
// Cada horda tem 3 monstros (entram no compêndio na 1ª vitória) e 3 ondas. "nivel" = nível de robô equivalente.
// =========================
const FORMAS_MONSTRO = ["gosma", "morcego", "olho", "cogumelo", "fantasma", "caranguejo", "caveira", "golem", "dragao"];
const NOMES_MONSTROS = ["Glorp", "Fluff", "Bzzt", "Morg", "Squee", "Krak", "Ploop", "Grizz", "Vex",
  "Ooze", "Fang", "Blink", "Spore", "Wisp", "Pinch", "Rattle", "Rumble", "Scorch",
  "Gloom", "Dread", "Hex", "Toxa", "Shade", "Clamp", "Bone", "Crag", "Inferno",
  "Abyss", "Riftor", "Chaos", "Mire", "Phantom", "Tyrant", "Lich", "Titanus", "Wyrm"];
const HORDAS = [];
for (let z = 0; z < 9; z++) {
  const nivel = 2 + z * 2.5;
  HORDAS.push({
    id: z, nivel: nivel,
    monstros: [0, 1, 2].map(function(k) { return { id: z * 3 + k, forma: FORMAS_MONSTRO[(z * 3 + k) % 9], nome: NOMES_MONSTROS[z * 3 + k] }; }),
    ondas: 3,
    premio: Math.round(300 * valorRobo(nivel))    // ~1 min do que um time desse nível faz
  });
}
const N_MONSTROS = HORDAS.length * 3;
// um monstro da onda: vida e ataque do nível da horda (um pouco variado por forma)
function statsMonstro(horda, k, onda) {
  const n = horda.nivel + onda * 0.4 + (k === 2 ? 0.6 : 0);
  return { vida: 34 * Math.pow(1.8, n - 1), ataque: 4.4 * Math.pow(1.8, n - 1) };
}
