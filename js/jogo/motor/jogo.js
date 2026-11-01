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
  function multMoedas() {
    return Math.pow(1.5, nivelUp("cofre")) * Math.pow(2, nivelUp("reator")) * Math.pow(3, nivelUp("estelar")) * Math.pow(2, nivelNo("dobro")) *
      (1 + 0.1 * nivelNo("nucleo")) * (1 + 0.5 * nivelNo("ganancia")) * (1 + 0.2 * arv("renda")) * Math.pow(BONUS_RENASCER, save.renascimentos) *
      (1 + Math.min(2, 0.002 * nivelUp("producao") * save.p.criados));   // Produção em Massa: +0,2%/nível por robô criado
  }
  // turbo (robô dourado): toques e time rendem x3 por alguns segundos (fora do multMoedas: não mexe em prêmios nem offline)
  let turboAte = 0;
  function multTurbo() { return performance.now() < turboAte ? 3 + 0.5 * nivelUp("turbo_forte") : 1; }
  function turboRestante() { return Math.max(0, (turboAte - performance.now()) / 1000); }
  function ligarTurbo(seg) { turboAte = performance.now() + seg * 1000; }
  function velocidadeTime() { return (1 + 0.15 * nivelUp("motor") + 0.25 * nivelUp("turbina") + 0.4 * nivelUp("overclock") + 0.6 * nivelUp("hidraulica")) * (1 + 0.25 * nivelNo("turbo")) * (1 + 0.15 * arv("time")); }
  // moedas por segundo do time (cada robô aperta o botão "velocidade" vezes por segundo)
  function prodTime() {
    let s = 0;
    save.p.time.forEach(function(n) { if (n) s += valorRobo(n); });
    return (s * velocidadeTime() + prodBancada()) * multMoedas();
  }
  // Bancada: robôs parados na grade rendem 1%/nível do valor deles por segundo (sem o multiplicador de velocidade)
  function prodBancada() {
    const k = 0.01 * nivelUp("bancada"); if (!k) return 0;
    let s = 0; save.p.grade.forEach(function(n) { if (n) s += valorRobo(n); });
    return s * k;
  }
  function valorToque() {
    const base = (1 + 3 * nivelUp("dedo")) * Math.pow(2, nivelUp("dedo2")) * Math.pow(3, nivelUp("dedo3")) * Math.pow(2, nivelNo("dedo_aco")) * (1 + 0.5 * arv("toque"));
    return (base + ECO.toqueTime * prodTime() / multMoedas()) * multMoedas();
  }
  // preço de criar: sobe 12% a cada robô criado na partida (zera ao renascer); Linha, Prensa e Desconto baixam
  function custoCriar() {
    return Math.ceil(ECO.criarBase * Math.pow(ECO.criarCresce, save.p.criados) * Math.pow(0.85, nivelUp("linha")) * Math.pow(0.8, nivelUp("prensa")) * Math.pow(0.85, nivelNo("desconto")) * Math.pow(0.94, arv("criar")));
  }
  function tierNasce() { return Math.min(MAX_TIER, 1 + nivelUp("fabrica") + nivelUp("fabrica2") + nivelUp("fabrica3") + (Math.random() < 0.1 * nivelNo("sorte") ? 1 : 0) +
    (Math.random() < 0.03 * nivelUp("caixa_premiada") ? 2 : 0)); }   // Caixa Premiada: nasce 2 níveis acima
  function intervaloEsteira() { return 15 * Math.pow(0.85, nivelUp("esteira")) * Math.pow(0.8, nivelUp("esteira2")) * Math.pow(0.8, nivelNo("esteira_r")) * Math.pow(0.92, arv("esteira")); }

  // ---------- toque no botão ----------
  // v8: COMBO (Ritmo): tocar rápido enche o combo (0..1); parado ele esvazia. FÚRIA: a cada 100 toques, toque x3.
  let combo = 0, ultimoToque = 0, toquesFuria = 0, furiaAte = 0;
  function chanceCritico() { return 0.1 * nivelNo("critico") + 0.03 * nivelUp("mira"); }
  function multCritico() { return (nivelNo("critico2") ? 25 : nivelNo("critico") ? 10 : 5) + 5 * nivelUp("critico_sup"); }
  function emFuria() { return performance.now() < furiaAte; }
  function tocar() {
    const agora = performance.now();
    if (nivelUp("ritmo")) { combo = agora - ultimoToque < 450 ? Math.min(1, combo + 0.05) : Math.max(0, combo - 0.2); }
    ultimoToque = agora;
    let v = valorToque() * (1 + combo * 0.2 * nivelUp("ritmo")), critico = false;
    v *= multTurbo();
    if (emFuria()) v *= 3;
    if (Math.random() < chanceCritico()) { v *= multCritico(); critico = true; }
    if (nivelUp("furia") && !emFuria() && ++toquesFuria >= 100) { toquesFuria = 0; furiaAte = agora + (4 + 2 * nivelUp("furia")) * 1000; avisar("furia"); }
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
    save.stats.criados = (save.stats.criados || 0) + 1;
    colocar(tierNasce());
    return true;
  }
  // arrastar: de {lista, i} para {lista, i}. Igual -> junta; vazio -> move; diferente -> troca
  function mover(de, para) {
    if (de.lista === para.lista && de.i === para.i) return;
    const p = save.p, a = p[de.lista][de.i], b = p[para.lista][para.i];
    if (!a) return;
    if (b === a && a < MAX_TIER) {
      const novo = nivelJunta(a), clone = clonou();
      p[para.lista][para.i] = novo; p[de.lista][de.i] = clone ? a : 0;
      juntou(para, novo, novo > a + 1, clone);
    } else { p[para.lista][para.i] = a; p[de.lista][de.i] = b; }
    avisar("mudou");
  }
  // Fusão Instável (tier 7): 6% por nível de chance de a junção pular um nível
  // Clonagem (tier 6): 3%/nível de o robô de baixo não ser gasto ao juntar
  function clonou() { return Math.random() < 0.03 * nivelUp("clonagem"); }
  function nivelJunta(n) { return Math.min(MAX_TIER, n + 1 + (n + 1 < MAX_TIER && Math.random() < 0.06 * nivelUp("fusao_inst") ? 1 : 0)); }
  function juntou(onde, tier, pulou, clone) {
    save.stats.juncoes++;
    if (nivelUp("reciclagem")) save.p.moedas += custoCriar() * 0.05 * nivelUp("reciclagem");   // Reciclagem
    if (pulou) descobrir(tier - 1);
    descobrir(tier);
    avisar("juntou", { lista: onde.lista, i: onde.i, tier: tier, pulou: !!pulou, clone: !!clone });
  }
  // tocar num robô (celular: sem arrastar): junta com outro igual da grade; senão vai para o time (ou volta)
  function tocarRobo(lista, i) {
    const p = save.p, n = p[lista][i];
    if (!n) return;
    const par = p.grade.findIndex(function(m, k) { return m === n && !(lista === "grade" && k === i); });
    if (par >= 0 && n < MAX_TIER) { const novo = nivelJunta(n), clone = clonou(); p.grade[par] = clone ? n : 0; p[lista][i] = novo; juntou({ lista: lista, i: i }, novo, novo > n + 1, clone); avisar("mudou"); return; }
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
    const novo = nivelJunta(melhor.n), clone = clonou();
    g[melhor.a] = novo; g[melhor.b] = clone ? melhor.n : 0;
    juntou({ lista: "grade", i: melhor.a }, novo, novo > melhor.n + 1, clone);
    avisar("mudou");
    return true;
  }

  // ---------- compêndio ----------
  // cada nível de robô dá pontos UMA vez por partida: o 1º de todos ainda abre a tela "NOVO ROBÔ!" (compêndio);
  // nas partidas depois de renascer, chegar de novo num nível já conhecido dá os mesmos pontos, só com a faixa
  function descobrir(tier) {
    if (tier > save.p.maxTier) { save.p.maxTier = tier; Poki.medir("robot", "tier-" + tier, "reached"); }
    if (save.p.pegos.indexOf(tier) >= 0) return;
    save.p.pegos.push(tier);
    const novo = save.robosVistos.indexOf(tier) < 0;
    if (novo) save.robosVistos.push(tier);
    const ph = Math.ceil(phRobo(tier) * fatorPh()), moedas = Math.round(valorRobo(tier) * 20 * multMoedas());   // v8: metade (mais difícil)
    save.ph += ph; save.p.moedas += moedas;
    if (novo) Poki.medir("compendium", "robot-" + tier, "reached");
    avisar("descobriu", { tipo: "robo", id: tier, ph: ph, moedas: moedas, repetido: !novo });
  }
  function descobrirMonstro(id) {
    if (save.monstrosVistos.indexOf(id) >= 0) return null;
    save.monstrosVistos.push(id);
    const ph = Math.ceil(3 * (nivelNo("cacador") ? 2 : 1) * fatorPh()), z = Math.floor(id / 3), moedas = Math.round(HORDAS[z].premio * 0.3 * multMoedas());
    save.ph += ph; save.p.moedas += moedas;
    Poki.medir("compendium", "monster-" + id, "reached");
    const d = { tipo: "monstro", id: id, ph: ph, moedas: moedas };
    avisar("descobriu", d);
    return d;
  }

  // ---------- relógio ----------
  const relTime = [];
  let relFusao = 0, relAuto = 0, relJuros = 0;
  function passo(dt) {
    const p = save.p, vel = velocidadeTime(), mult = multMoedas() * multTurbo();
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
    // Bancada: robôs da grade rendem sem apertar
    const banc = prodBancada(); if (banc) p.moedas += banc * multMoedas() * dt;
    // Cofrinho: juros a cada 10 s (0,5%/nível das moedas, no máximo 30 s da produção)
    if (nivelUp("cofrinho")) { relJuros += dt; if (relJuros >= 10) { relJuros = 0; const j = Math.min(p.moedas * 0.005 * nivelUp("cofrinho"), prodTime() * 30 + valorToque() * 20); if (j >= 1) { p.moedas += j; avisar("juros", { valor: j }); } } }
    if (combo > 0 && performance.now() - ultimoToque > 450) combo = Math.max(0, combo - dt * 0.4);
    // esteira: robô grátis (Esteira Dupla: às vezes vêm 2)
    p.esteira += dt;
    if (p.esteira >= intervaloEsteira()) {
      if (vagaLivre("grade") >= 0) { p.esteira = 0; colocar(tierNasce()); if (Math.random() < 0.08 * nivelUp("esteira_dupla") && vagaLivre("grade") >= 0) colocar(tierNasce()); }
      else p.esteira = intervaloEsteira();
    }
    // Criador Automático (árvore): cria um robô sozinho a cada 5 s se der
    if (nivelNo("auto_criar")) { relAuto += dt; if (relAuto >= 5) { relAuto = 0; if (save.p.moedas >= custoCriar() && vagaLivre("grade") >= 0) criar(); } }
    if (nivelNo("fusao")) { relFusao += dt; if (relFusao >= 1.5) { relFusao = 0; fundirUm(); } }
    save.stats.tempo += dt;
  }

  // ---------- ganhos offline ----------
  function ganhoOffline() {
    const longe = (Date.now() - (save.ultimo || Date.now())) / 1000;
    if (longe < 60) return null;
    const maxSeg = CONFIG.offlineMax + nivelNo("offline") * 7200 + arv("offline") * 3600;
    const seg = Math.min(longe, maxSeg), valor = prodTime() * seg * CONFIG.offlineFator * (1 + 0.4 * nivelUp("plantao"));
    return valor >= 1 ? { seg: seg, valor: valor } : null;
  }

  // ---------- upgrades ----------
  // tier aberto: o 1º sempre; os outros quando o principal do anterior chega no nível 3
  function tierAberto(t) { if (t <= 1) return true; const p = principalDoTier(t - 1); return !!p && nivelUp(p.id) >= 3; }
  function comprarUpgrade(id) {
    const n = nivelUp(id), u = UPGRADE[id];
    if (n >= NIVEIS_UPGRADE || !tierAberto(u.tier)) return false;
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
    const ganho = 0;   // v7: renascer não dá pontos
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
    if (nivelNo("rico2")) save.p.moedas = 1e6;
    if (nivelNo("fab_ini2")) save.p.up.fabrica2 = 1;
    if (nivelNo("fab_ini")) save.p.up.fabrica = Math.min(NIVEIS_UPGRADE, nivelNo("fab_ini"));
    arrumarVagas();
    relTime.length = 0;
    avisar("mudou");
  }
  function comprarNo(id) {
    const no = NO[id], n = nivelNo(id);
    if (n >= no.max || !noAberto(id)) return false;
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
    custoCriar: custoCriar, tierAberto: tierAberto, intervaloEsteira: intervaloEsteira, tocar: tocar, criar: criar, mover: mover, tocarRobo: tocarRobo,
    descobrirMonstro: descobrirMonstro, passo: passo, ganhoOffline: ganhoOffline, comprarUpgrade: comprarUpgrade,
    podeRenascer: podeRenascer, renascer: renascer, novaPartida: novaPartida, comprarNo: comprarNo,
    multTurbo: multTurbo, turboRestante: turboRestante, ligarTurbo: ligarTurbo,
    get combo() { return combo; }, emFuria: emFuria, furiaRestante: function() { return Math.max(0, (furiaAte - performance.now()) / 1000); },
    presente: function(tier) { return colocar(Math.max(1, Math.min(MAX_TIER, tier))) >= 0; }   // robô de graça na grade (robô dourado)
  };
})();
