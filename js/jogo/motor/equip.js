"use strict";

// =========================
// EQUIPAMENTOS (v9): peças que caem de batalhas, da Torre, do Ataque à Fábrica e de encomendas. Cada vaga do TIME
// recebe uma peça, que melhora o robô que estiver ali. As peças são PERMANENTES (passam pelo renascimento).
//   eng (Engrenagem): robô aperta mais rápido · chip (Chip): cada apertada rende mais · trevo (Trevo): chance de x10
// Raridade 0..4 (comum, incomum, rara, épica, lendária). Desmontar uma peça dá pontos de habilidade.
// save.equip = { itens: [{id, t, r}], vagas: [id da peça em cada vaga do time ou 0], prox }
// =========================
const EQUIP_TIPOS = {
  eng:   { ico: "engrenagem", vel:   [0.1, 0.2, 0.35, 0.6, 1.0] },
  chip:  { ico: "chip",       valor: [0.15, 0.3, 0.5, 0.9, 1.5] },
  trevo: { ico: "trevo",      sorte: [0.02, 0.04, 0.07, 0.12, 0.2] }
};
const RARIDADE_COR = ["#9aa3c0", "#3ccf6e", "#4da3ff", "#b06bff", "#ffa53d"];
const Equip = (function() {
  const MAX = 40, PH_DESMONTAR = [1, 1, 2, 4, 8];
  function itens() { return save.equip.itens; }
  function porId(id) { return itens().filter(function(x) { return x.id === id; })[0] || null; }
  // sorteia raridade: q (0..1) puxa para as raras (andar alto, horda difícil, chefão)
  function rolarRaridade(q) {
    q = limitar(q || 0, 0, 1);
    const pesos = [55 - 35 * q, 28, 12 + 15 * q, 4 + 12 * q, 1 + 8 * q];
    let r = Math.random() * pesos.reduce(function(a, b) { return a + b; }, 0);
    for (let k = 0; k < 5; k++) { r -= pesos[k]; if (r < 0) return k; }
    return 0;
  }
  function ganhar(q, tipo) {
    const tipos = Object.keys(EQUIP_TIPOS);
    const item = { id: (save.equip.prox = (save.equip.prox || 0) + 1), t: tipo || tipos[Math.floor(Math.random() * tipos.length)], r: rolarRaridade(q) };
    itens().push(item);
    // inventário cheio: desmonta sozinho a pior peça que não está equipada
    while (itens().length > MAX) {
      const livres = itens().filter(function(x) { return save.equip.vagas.indexOf(x.id) < 0 && x !== item; }).sort(function(a, b) { return a.r - b.r; });
      if (!livres.length) break;
      desmontar(livres[0].id);
    }
    Poki.medir("loot", item.t + "-" + item.r, "reached");
    Jogo.avisar("peca", item);
    return item;
  }
  function bonus(item) {
    const d = EQUIP_TIPOS[item.t];
    return { vel: d.vel ? d.vel[item.r] : 0, valor: d.valor ? d.valor[item.r] : 0, sorte: d.sorte ? d.sorte[item.r] : 0 };
  }
  function bonusVaga(i) { const id = save.equip.vagas[i]; const it = id ? porId(id) : null; return it ? bonus(it) : null; }
  function equipar(id, vaga) {
    const it = porId(id); if (!it) return false;
    const antes = save.equip.vagas.indexOf(id); if (antes >= 0) save.equip.vagas[antes] = 0;   // tira de onde estava
    save.equip.vagas[vaga] = id;
    Jogo.avisar("mudou");
    return true;
  }
  function tirar(vaga) { save.equip.vagas[vaga] = 0; Jogo.avisar("mudou"); }
  function desmontar(id) {
    const it = porId(id); if (!it) return 0;
    const v = save.equip.vagas.indexOf(id); if (v >= 0) save.equip.vagas[v] = 0;
    save.equip.itens = itens().filter(function(x) { return x.id !== id; });
    const ph = PH_DESMONTAR[it.r]; save.ph += ph;
    return ph;
  }
  // texto do bônus: "+35% velocidade" etc.
  function textoBonus(item) {
    const b = bonus(item);
    if (b.vel) return t("eq_vel", Math.round(b.vel * 100));
    if (b.valor) return t("eq_valor", Math.round(b.valor * 100));
    return t("eq_sorte", Math.round(b.sorte * 100));
  }
  function nome(item) { return t("eq_nome", t("eq_" + item.t), t("rar_" + item.r)); }   // ordem pelo idioma ("Legendary Gear", "Engrenagem · Lendária")
  return { ganhar: ganhar, bonusVaga: bonusVaga, bonus: bonus, equipar: equipar, tirar: tirar, desmontar: desmontar, porId: porId,
    textoBonus: textoBonus, nome: nome, phDesmontar: function(it) { return PH_DESMONTAR[it.r]; }, MAX: MAX };
})();
