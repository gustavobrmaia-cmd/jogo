"use strict";

// =========================
// MOTOR DO JOGO (regras; a interface só chama e escuta)
// Avisos para a interface: Jogo.ao("evento", fn). Eventos: "toque" {valor, critico}, "timeClicou" {i, valor},
// "mudou" (grade/time/moedas mudaram), "juntou" {lista, i, tier}, "descobriu" {tipo, id, ph, moedas},
// "criou" {i, tier}, "cheio".
// =========================
const Jogo = (function() {
  const ouvintes = {};
  function ao(ev, fn) { (ouvintes[ev] || (ouvintes[ev] = [])).push(fn); }
  function avisar(ev, dado) { (ouvintes[ev] || []).forEach(function(fn) { fn(dado); }); }

  // ---------- números ----------
  function multMoedas() { return Math.pow(1.3, nivelUp("moedas")) * Math.pow(2, nivelNo("dobro")); }
  function velocidadeTime() { return (1 + 0.12 * nivelUp("motor")) * (1 + 0.25 * nivelNo("turbo")); }
  // moedas por segundo do time (cada robô aperta o botão "velocidade" vezes por segundo)
  function prodTime() {
    let s = 0;
    save.p.time.forEach(function(n) { if (n) s += valorRobo(n); });
    return s * velocidadeTime() * multMoedas();
  }
  function valorToque() {
    const base = (1 + 2 * nivelUp("dedo")) * Math.pow(2, nivelNo("dedo_aco"));
    return (base + ECO.toqueTime * prodTime() / multMoedas()) * multMoedas();
  }
  function custoCriar() { return Math.ceil(ECO.criarBase * Math.pow(ECO.criarCresce, save.p.criados) * Math.pow(0.88, nivelUp("linha"))); }
  function tierNasce() { return Math.min(MAX_TIER, 1 + nivelUp("fabrica") + (Math.random() < 0.1 * nivelNo("sorte") ? 1 : 0)); }
  function intervaloEsteira() { return 15 * Math.pow(0.82, nivelUp("esteira")); }

  // ---------- toque no botão ----------
  function tocar() {
    let v = valorToque(), critico = false;
    if (nivelNo("critico") && Math.random() < 0.1) { v *= 10; critico = true; }
    save.p.moedas += v;
    save.stats.toques++;
    avisar("toque", { valor: v, critico: critico });
  }

  // ---------- criar e juntar ----------
  function vagaLivre(lista) { return save.p[lista].indexOf(0); }
  function colocar(tier) {
    const i = vagaLivre("grade");
    if (i < 0) { avisar("cheio"); return -1; }
    save.p.grade[i] = tier;
    descobrir(tier);
    avisar("criou", { i: i, tier: tier });
    avisar("mudou");
    return i;
  }
  function criar() {
    const c = custoCriar();
    if (save.p.moedas < c) return false;
    if (vagaLivre("grade") < 0) { avisar("cheio"); return false; }
    save.p.moedas -= c;
    save.p.criados++;
    colocar(tierNasce());
    return true;
  }
  // arrastar: de {lista, i} para {lista, i}. Igual -> junta; vazio -> move; diferente -> troca
  function mover(de, para) {
    if (de.lista === para.lista && de.i === para.i) return;
    const p = save.p, a = p[de.lista][de.i], b = p[para.lista][para.i];
    if (!a) return;
    if (b === a && a < MAX_TIER) {
      p[para.lista][para.i] = a + 1; p[de.lista][de.i] = 0;
      juntou(para, a + 1);
    } else { p[para.lista][para.i] = a; p[de.lista][de.i] = b; }
    avisar("mudou");
  }
  function juntou(onde, tier) {
    save.stats.juncoes++;
    descobrir(tier);
    avisar("juntou", { lista: onde.lista, i: onde.i, tier: tier });
  }
  // tocar num robô (celular: sem arrastar): junta com outro igual da grade; senão vai para o time (ou volta)
  function tocarRobo(lista, i) {
    const p = save.p, n = p[lista][i];
    if (!n) return;
    const par = p.grade.findIndex(function(m, k) { return m === n && !(lista === "grade" && k === i); });
    if (par >= 0 && n < MAX_TIER) { p.grade[par] = 0; p[lista][i] = n + 1; juntou({ lista: lista, i: i }, n + 1); avisar("mudou"); return; }
    const outra = lista === "grade" ? "time" : "grade", v = vagaLivre(outra);
    if (v >= 0) { p[outra][v] = n; p[lista][i] = 0; avisar("mudou"); }
  }
  // fusão automática (árvore): junta o par mais baixo da grade, um por vez
  function fundirUm() {
    const g = save.p.grade, visto = {};
    let melhor = null;
    for (let i = 0; i < g.length; i++) {
      const n = g[i]; if (!n || n >= MAX_TIER) continue;
      if (visto[n] !== undefined && (!melhor || n < melhor.n)) melhor = { n: n, a: visto[n], b: i };
      else if (visto[n] === undefined) visto[n] = i;
    }
    if (!melhor) return false;
    g[melhor.a] = melhor.n + 1; g[melhor.b] = 0;
    juntou({ lista: "grade", i: melhor.a }, melhor.n + 1);
    avisar("mudou");
    return true;
  }

  // ---------- compêndio ----------
  function descobrir(tier) {
    if (tier > save.p.maxTier) { save.p.maxTier = tier; Poki.medir("robot", "tier-" + tier, "reached"); }
    if (save.robosVistos.indexOf(tier) >= 0) return;
    save.robosVistos.push(tier);
    const ph = phRobo(tier), moedas = Math.round(valorRobo(tier) * 40 * multMoedas());
    save.ph += ph; save.p.moedas += moedas;
    Poki.medir("compendium", "robot-" + tier, "reached");
    avisar("descobriu", { tipo: "robo", id: tier, ph: ph, moedas: moedas });
  }
  function descobrirMonstro(id) {
    if (save.monstrosVistos.indexOf(id) >= 0) return null;
    save.monstrosVistos.push(id);
    const ph = 1 * (nivelNo("cacador") ? 2 : 1), z = Math.floor(id / 3), moedas = Math.round(HORDAS[z].premio * 0.3 * multMoedas());
    save.ph += ph; save.p.moedas += moedas;
    Poki.medir("compendium", "monster-" + id, "reached");
    const d = { tipo: "monstro", id: id, ph: ph, moedas: moedas };
    avisar("descobriu", d);
    return d;
  }

  // ---------- relógio ----------
  const relTime = [];
  let relFusao = 0;
  function passo(dt) {
    const p = save.p, vel = velocidadeTime(), mult = multMoedas();
    // time: cada robô aperta o botão no seu ritmo (desencontrados, para o botão não piscar junto)
    for (let i = 0; i < p.time.length; i++) {
      if (!p.time[i]) { relTime[i] = 0; continue; }
      relTime[i] = (relTime[i] || i * 0.17) + dt * vel;
      if (relTime[i] >= 1) {
        relTime[i] -= 1;
        const v = valorRobo(p.time[i]) * mult;
        p.moedas += v;
        avisar("timeClicou", { i: i, valor: v });
      }
    }
    // esteira: robô grátis
    p.esteira += dt;
    if (p.esteira >= intervaloEsteira()) {
      if (vagaLivre("grade") >= 0) { p.esteira = 0; colocar(tierNasce()); }
      else p.esteira = intervaloEsteira();
    }
    if (nivelNo("fusao")) { relFusao += dt; if (relFusao >= 1.5) { relFusao = 0; fundirUm(); } }
    save.stats.tempo += dt;
  }

  // ---------- ganhos offline ----------
  function ganhoOffline() {
    const longe = (Date.now() - (save.ultimo || Date.now())) / 1000;
    if (longe < 60) return null;
    const maxSeg = CONFIG.offlineMax + nivelNo("offline") * 7200;
    const seg = Math.min(longe, maxSeg), valor = prodTime() * seg * CONFIG.offlineFator;
    return valor >= 1 ? { seg: seg, valor: valor } : null;
  }

  // ---------- upgrades ----------
  function comprarUpgrade(id) {
    const n = nivelUp(id), u = UPGRADE[id];
    if (n >= u.max) return false;
    const c = custoUpgrade(id, n);
    if (save.p.moedas < c) return false;
    save.p.moedas -= c;
    save.p.up[id] = n + 1;
    Poki.medir("upgrade", id + "-" + (n + 1), "interact");
    avisar("mudou");
    return true;
  }

  // ---------- renascimento ----------
  function podeRenascer() { return save.p.maxTier >= CONFIG.tierRenascer; }
  function renascer() {
    if (!podeRenascer()) return false;
    const ganho = phRenascer(save.p.maxTier);
    save.ph += ganho;
    save.renascimentos++;
    Poki.medir("rebirth", "n-" + save.renascimentos, "complete");
    novaPartida();   // já zera aqui (recarregar a página na árvore não pode renascer de novo); "Começar" refaz com a árvore
    salvar();
    return ganho;
  }
  // começa a partida nova com o que a árvore dá
  function novaPartida() {
    save.p = partidaNova();
    if (nivelNo("rico")) save.p.moedas = 2000;
    if (nivelNo("fab_ini")) save.p.up.fabrica = nivelNo("fab_ini");
    arrumarVagas();
    relTime.length = 0;
    avisar("mudou");
  }
  function comprarNo(id) {
    const no = NO[id], n = nivelNo(id);
    if (n >= no.max || (no.req && !nivelNo(no.req))) return false;
    const c = custoNo(id, n);
    if (save.ph < c) return false;
    save.ph -= c;
    save.arvore[id] = n + 1;
    Poki.medir("skill", id + "-" + (n + 1), "interact");
    arrumarVagas();
    return true;
  }

  return {
    ao: ao, avisar: avisar, multMoedas: multMoedas, velocidadeTime: velocidadeTime, prodTime: prodTime, valorToque: valorToque,
    custoCriar: custoCriar, intervaloEsteira: intervaloEsteira, tocar: tocar, criar: criar, mover: mover, tocarRobo: tocarRobo,
    descobrirMonstro: descobrirMonstro, passo: passo, ganhoOffline: ganhoOffline, comprarUpgrade: comprarUpgrade,
    podeRenascer: podeRenascer, renascer: renascer, novaPartida: novaPartida, comprarNo: comprarNo
  };
})();
