"use strict";

// =========================
// BATALHA CONTRA AS HORDAS (simulação; o desenho fica em interface/batalha_tela.js)
// Os robôs escolhidos (até 10, ou 12 com a árvore) enfrentam 3 ondas; a última traz um chefe (o 3º monstro, 3x
// mais vida e maior). Cada um ataca ~1x por segundo: robôs miram no monstro da frente, monstros num robô
// qualquer. Os robôs NÃO se perdem: é só a luta. Vitória: moedas e, na 1ª vez, os 3 monstros vão para o compêndio
// e a horda seguinte abre. Derrota ou 60 s: nada (dá para tentar de novo).
// =========================
// HABILIDADES do jogador (os robôs lutam sozinhos; você lança): liberadas pelas hordas vencidas ("libera").
// cd em segundos (a árvore "hab_cd" encurta). O poder delas vem do ataque somado dos robôs vivos.
const HABILIDADES = [
  { id: "missil", cd: 8, libera: 0 },        // dano grande no monstro da frente (e um pouco nos outros)
  { id: "choque", cd: 15, libera: 1 },       // atordoa todos por 2,5 s e dá um pouco de dano
  { id: "conserto", cd: 18, libera: 2 },     // cura 40% da vida de todos os robôs vivos
  { id: "sobrecarga", cd: 22, libera: 3 }    // robôs atacam 2x mais rápido por 6 s
];
const Batalha = (function() {
  let b = null;

  function multRobo() { return (1 + 0.25 * nivelUp("blindagem")) * (1 + 0.5 * nivelUp("canhoes")) * (1 + 0.3 * nivelNo("blindagem")); }
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
      lista.push({ id: h.monstros[tipo].id, vida: vida, max: vida, ataque: st.ataque * (chefe ? 1.5 : 1), cd: 1.2 + Math.random() * 0.8, chefe: chefe, golpe: 0, morto: 0, atordoado: 0, entrou: 0 });
    }
    return lista;
  }
  function iniciar(z, tiers) {
    const m = multRobo();
    b = {
      z: z, onda: 0, t: 0, fim: null, tiros: [], numeros: [], fx: [], agenda: [], sobrecarga: 0, cds: {},
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
    for (const k in b.cds) b.cds[k] = Math.max(0, b.cds[k] - dt);
    if (b.sobrecarga > 0) b.sobrecarga -= dt;
    b.agenda = b.agenda.filter(function(a) { if (b.t < a.t) return true; a.fn(); return false; });
    b.fx.forEach(function(x) { x.t += dt; }); b.fx = b.fx.filter(function(x) { return x.t < (x.dur || 0.6); });
    b.monstros.forEach(function(m) { m.entrou = Math.min(1, m.entrou + dt * 1.6); if (m.atordoado > 0) m.atordoado -= dt; });
    const rv = vivos(b.robos), mv = vivos(b.monstros);
    b.robos.concat(b.monstros).forEach(function(x) { if (x.golpe > 0) x.golpe = Math.max(0, x.golpe - dt * 4); if (x.vida <= 0) x.morto += dt; });
    rv.forEach(function(r, i) {
      r.cd -= dt * (b.sobrecarga > 0 ? 2 : 1);
      if (r.cd > 0 || !mv.length) return;
      r.cd = 0.9 + Math.random() * 0.3;
      const alvo = mv[0], dano = r.ataque * (0.85 + Math.random() * 0.3);
      alvo.vida -= dano; r.golpe = 1;
      b.tiros.push({ de: "r", i: b.robos.indexOf(r), para: b.monstros.indexOf(alvo), t: 0 });
      b.numeros.push({ lado: "m", i: b.monstros.indexOf(alvo), v: dano, t: 0 });
    });
    vivos(b.monstros).forEach(function(m) {
      if (m.atordoado > 0 || m.entrou < 1) return;
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

  // ---------- habilidades ----------
  function liberada(h) { return save.hordasVencidas >= h.libera; }
  function cdDe(h) { return h.cd * Math.pow(0.8, nivelNo("hab_cd")); }
  function poder() {
    const m = (1 + 0.5 * nivelUp("canhoes")) * (1 + 0.5 * nivelNo("hab_dano"));
    return vivos(b.robos).reduce(function(s, r) { return s + r.ataque; }, 0) * m;
  }
  function usar(id) {
    const h = HABILIDADES.filter(function(x) { return x.id === id; })[0];
    if (!b || b.fim || !h || !liberada(h) || (b.cds[id] || 0) > 0) return false;
    const mv = vivos(b.monstros); if (!mv.length && id !== "conserto") return false;
    b.cds[id] = cdDe(h);
    const p = poder();
    if (id === "missil") {
      const alvo = mv[0], ia = b.monstros.indexOf(alvo);
      b.fx.push({ tipo: "missil", i: ia, t: 0, dur: 0.4 });
      b.agenda.push({ t: b.t + 0.38, fn: function() {
        alvo.vida -= p * 2.5; b.numeros.push({ lado: "m", i: ia, v: p * 2.5, t: 0, grande: true });
        vivos(b.monstros).forEach(function(m) { if (m !== alvo) m.vida -= p * 0.6; });
        b.fx.push({ tipo: "explosao", i: ia, t: 0, dur: 0.5 });
      } });
    } else if (id === "choque") {
      mv.forEach(function(m) { m.atordoado = 2.5; m.vida -= p * 0.4; });
      b.fx.push({ tipo: "choque", t: 0, dur: 0.5 });
    } else if (id === "conserto") {
      vivos(b.robos).forEach(function(r) { r.vida = Math.min(r.max, r.vida + r.max * 0.4); });
      b.fx.push({ tipo: "conserto", t: 0, dur: 0.9 });
    } else if (id === "sobrecarga") { b.sobrecarga = 6; b.fx.push({ tipo: "sobrecarga", t: 0, dur: 0.6 }); }
    Poki.medir("ability", id, "interact");
    return true;
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
    usar: usar, liberada: liberada, cdDe: cdDe,
    get atual() { return b; }, sair: function() { b = null; } };
})();
