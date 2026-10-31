"use strict";

// =========================
// ROBÔS: 30 níveis. Juntar dois iguais dá o próximo. O desenho (pixel art) sai de arte/pixel.js a partir do nível
// (partes e cores escolhidas pelo número: sempre o mesmo robô). Nomes inventados: valem em todos os idiomas.
// =========================
const NOMES_ROBOS = ["Bip", "Bolt", "Zap", "Tico", "Gizmo", "Rivet", "Sprocket", "Volt", "Pixel", "Nano",
  "Turbo", "Cogz", "Mecha", "Blitz", "Atlas", "Titan", "Nova", "Vortex", "Quasar", "Pulsar",
  "Nebula", "Zenith", "Aurora", "Kronos", "Helios", "Orion", "Apex", "Prime", "Omega", "Infinity"];
const MAX_TIER = NOMES_ROBOS.length;

// força na batalha (vida e ataque por segundo); a blindagem e a árvore multiplicam
function vidaRobo(n) { return 30 * Math.pow(1.8, n - 1); }
function ataqueRobo(n) { return 5 * Math.pow(1.8, n - 1); }
// pontos de habilidade por descobrir o robô (1, e +1 a cada 5 níveis)
function phRobo(n) { return 1 + Math.floor(n / 5); }
