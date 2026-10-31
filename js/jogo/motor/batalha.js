"use strict";

// =========================
// BATALHA CONTRA AS HORDAS (simulação; o desenho fica em interface/batalha_tela.js)
// Os robôs escolhidos (até 10, ou 12 com a árvore) enfrentam 3 ondas; a última traz um chefe (o 3º monstro, 3x
// mais vida e maior). Cada um ataca ~1x por segundo: robôs miram no monstro da frente, monstros num robô
// qualquer. Os robôs NÃO se perdem: é só a luta. Vitória: moedas e, na 1ª vez, os 3 monstros vão para o compêndio
// e a horda seguinte abre. Derrota ou 60 s: nada (dá para tentar de novo).
// =========================
const Batalha = (function() {
  let b = null;

  function multRobo() { return (1 + 0.15 * nivelUp("blindagem")) * (1 + 0.3 * nivelNo("blindagem")); }
  function vagas() { return nivelNo("esquadrao") ? 12 : CONFIG.slotsBatalha; }
  function hordaAberta(z) { return z < 3 || z <= save.hordasVencidas; }
  // "poder" para comparar antes de lutar (vida x ataque somados)
  function poderRobos(tiers) { const m = multRobo(); return tiers.reduce(function(s, n) { return s + Math.sqrt(vidaRobo(n) * ataqueRobo(n)) * m; }, 0); }
  function poderHorda(z) {
    const h = HORDAS[z]; let s = 0;
    for (let o = 0; o < h.ondas; o++) for (let k = 0; k < 3 + o * 2; k++) { const st = statsMonstro(h, k % 3, o); s += Math.sqrt(st.vida * st.ataque) / 3.2; }
    return s;
  }

  function onda(z, o) {
    const h = HORDAS[z], lista = [], n = 3 + o * 2;
    for (let k = 0; k < n; k++) {
      const tipo = o === h.ondas - 1 && k === 0 ? 2 : k % 2, st = statsMonstro(h, tipo, o), chefe = o === h.ondas - 1 && k === 0;
      const vida = st.vida * (chefe ? 3 : 1);
      lista.push({ id: h.monstros[tipo].id, vida: vida, max: vida, ataque: st.ataque * (chefe ? 1.5 : 1), cd: 0.6 + Math.random() * 0.8, chefe: chefe, golpe: 0, morto: 0 });
    }
    return lista;
  }
  function iniciar(z, tiers) {
    const m = multRobo();
    b = {
      z: z, onda: 0, t: 0, fim: null, tiros: [], numeros: [],
      robos: tiers.map(function(n, i) { const v = vidaRobo(n) * m; return { tier: n, vida: v, max: v, ataque: ataqueRobo(n) * m, cd: 0.3 + i * 0.07, golpe: 0, morto: 0 }; }),
      monstros: onda(z, 0)
    };
    save.stats.batalhas++;
    Poki.medir("battle", "horde-" + z, "start");
    return b;
  }
  function vivos(l) { return l.filter(function(x) { return x.vida > 0; }); }

  function passo(dt) {
    if (!b || b.fim) return;
    b.t += dt;
    const rv = vivos(b.robos), mv = vivos(b.monstros);
    b.robos.concat(b.monstros).forEach(function(x) { if (x.golpe > 0) x.golpe = Math.max(0, x.golpe - dt * 4); if (x.vida <= 0) x.morto += dt; });
    rv.forEach(function(r, i) {
      r.cd -= dt;
      if (r.cd > 0 || !mv.length) return;
      r.cd = 0.9 + Math.random() * 0.3;
      const alvo = mv[0], dano = r.ataque * (0.85 + Math.random() * 0.3);
      alvo.vida -= dano; r.golpe = 1;
      b.tiros.push({ de: "r", i: b.robos.indexOf(r), para: b.monstros.indexOf(alvo), t: 0 });
      b.numeros.push({ lado: "m", i: b.monstros.indexOf(alvo), v: dano, t: 0 });
    });
    vivos(b.monstros).forEach(function(m) {
      m.cd -= dt;
      const alvos = vivos(b.robos);
      if (m.cd > 0 || !alvos.length) return;
      m.cd = 1 + Math.random() * 0.4;
      const alvo = alvos[Math.floor(Math.random() * Math.min(3, alvos.length))], dano = m.ataque * (0.85 + Math.random() * 0.3);
      alvo.vida -= dano; m.golpe = 1;
      b.tiros.push({ de: "m", i: b.monstros.indexOf(m), para: b.robos.indexOf(alvo), t: 0 });
    });
    b.tiros.forEach(function(x) { x.t += dt; }); b.tiros = b.tiros.filter(function(x) { return x.t < 0.3; });
    b.numeros.forEach(function(x) { x.t += dt; }); b.numeros = b.numeros.filter(function(x) { return x.t < 0.8; });
    if (!vivos(b.monstros).length) {
      b.onda++;
      if (b.onda >= HORDAS[b.z].ondas) terminar(true);
      else { b.monstros = onda(b.z, b.onda); b.trocouOnda = b.t; }
    } else if (!vivos(b.robos).length || b.t > 60) terminar(false);
  }

  function terminar(venceu) {
    const z = b.z;
    b.fim = { venceu: venceu, premio: 0, novos: [] };
    Poki.medir("battle", "horde-" + z, venceu ? "complete" : "fail");
    if (!venceu) return;
    save.stats.vitorias++;
    const premio = Math.round(HORDAS[z].premio * (1 + 0.5 * nivelNo("saque")) * Jogo.multMoedas());
    b.fim.premio = premio;
    save.p.moedas += premio;
    HORDAS[z].monstros.forEach(function(m) { const d = Jogo.descobrirMonstro(m.id); if (d) b.fim.novos.push(d); });
    if (z + 1 > save.hordasVencidas) save.hordasVencidas = z + 1;
    salvar();
  }

  return { iniciar: iniciar, passo: passo, vagas: vagas, hordaAberta: hordaAberta, poderRobos: poderRobos, poderHorda: poderHorda,
    get atual() { return b; }, sair: function() { b = null; } };
})();
