"use strict";

// =========================
// PROGRESSO: moedas, missões (3 ativas), desafios da semana, conquistas e skins compradas/ganhas.
// Tudo fica no save (localStorage). O jogo só chama Progresso.registrar("rodadas", 1, { cenario }) nos momentos
// certos (partida.js / telas.js); aqui decide o que avançou, o que completou e avisa (Progresso.avisos -> HUD/menu).
// Semana: começa na segunda-feira (UTC); os 4 desafios são sorteados com a semana como semente (iguais para todos).
// =========================

const Progresso = (function() {
  const avisos = [];   // { texto, cor, t } mostrados no HUD durante a partida

  function semanaAtual() { return Math.floor((Date.now() / 86400000 + 3) / 7); }   // semanas desde 1970 (seg.)

  // sorteio que dá sempre o mesmo resultado para a mesma semente
  function sorteador(semente) {
    let s = (semente * 9301 + 49297) % 233280;
    return function() { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function nova(base) { return Object.assign({ prog: 0, feito: false, resgatado: false }, base); }

  // ---------- missões ----------
  function sortearMissao(evitar) {
    const ids = (evitar || []).map(function(m) { return m.id; });
    const opcoes = MISSOES_MODELOS.filter(function(m) { return ids.indexOf(m.id) < 0; });
    const mod = opcoes[Math.floor(Math.random() * opcoes.length)];
    // o nível cresce devagar com o número de missões feitas
    const feitas = save.stats.missoes || 0;
    const nivel = Math.min(2, Math.floor(Math.random() * (1 + Math.min(2, feitas / 4))));
    const m = nova({ id: mod.id, chave: mod.chave, meta: mod.metas[nivel], moedas: mod.moedas[nivel] });
    if (mod.porCenario) m.cenario = CENARIOS[Math.floor(Math.random() * CENARIOS.length)].id;
    return m;
  }

  // ---------- semana ----------
  function desafiosDaSemana(sem) {
    const r = sorteador(sem);
    const lista = DESAFIOS_MODELOS.slice();
    const escolhidos = [];
    while (escolhidos.length < 4) escolhidos.push(lista.splice(Math.floor(r() * lista.length), 1)[0]);
    return escolhidos.map(function(d) { return nova({ id: d.id, chave: d.chave, meta: d.meta, moedas: d.moedas }); });
  }
  function skinDaSemana(sem) {
    const lista = SKINS_CORPO.concat(SKINS_ACESSORIO).filter(function(s) { return s.semanal; });
    return lista[sem % lista.length].id;
  }

  // Prepara o save (primeira vez, semana nova, missões faltando)
  function preparar() {
    save.stats = save.stats || {};
    save.donos = save.donos && save.donos.length ? save.donos : ["classico", "nenhum"];
    save.conquistas = save.conquistas || {};
    ["armasVistas", "cartasVistas", "cenariosVencidos"].forEach(function(k) { if (!Array.isArray(save[k])) save[k] = []; });
    if (!Array.isArray(save.missoes)) save.missoes = [];
    while (save.missoes.length < 3) save.missoes.push(sortearMissao(save.missoes));
    const sem = semanaAtual();
    if (!save.semana || save.semana.id !== sem) {
      save.semana = { id: sem, desafios: desafiosDaSemana(sem), cenarios: [], premio: skinDaSemana(sem), premioResgatado: false };
    }
    salvar();
  }

  function valorStat(chave) {
    if (chave === "armasVistas" || chave === "cartasVistas" || chave === "cenariosVencidos") return save[chave].length;
    if (chave === "recordeOnda") return save.recordeOnda || 0;
    return save.stats[chave] || 0;
  }

  // ---------- registrar ----------
  // extra: { cenario, arma, carta }
  function registrar(chave, n, extra) {
    n = n || 1;
    extra = extra || {};
    save.stats[chave] = (save.stats[chave] || 0) + n;
    // coleções
    if (chave === "caixas" && extra.arma && save.armasVistas.indexOf(extra.arma) < 0) save.armasVistas.push(extra.arma);
    if (chave === "cartas" && extra.carta && save.cartasVistas.indexOf(extra.carta) < 0) save.cartasVistas.push(extra.carta);
    if (chave === "rodadas" && extra.cenario) {
      if (save.cenariosVencidos.indexOf(extra.cenario) < 0) save.cenariosVencidos.push(extra.cenario);
      if (save.semana.cenarios.indexOf(extra.cenario) < 0) { save.semana.cenarios.push(extra.cenario); registrar("cenarioNovoSemana", 1); }
      registrar("rodadaCenario", 1, { cenario: extra.cenario, interno: true });
    }
    // missões e desafios. v18: quem nunca abriu o menu de Missões (o novato) recebe na hora e vê só "+N 🪙"
    // (antes os prêmios ficavam esperando num menu que ele não conhecia e o aviso falava de algo que ele nunca viu)
    const auto = !save.stats.viuMissoes, prontas = [];
    save.missoes.forEach(function(m, i) {
      if (m.feito || m.chave !== chave) return;
      if (m.cenario && m.cenario !== extra.cenario) return;
      m.prog = Math.min(m.meta, m.prog + n);
      if (m.prog >= m.meta) { m.feito = true; Poki.medir("mission", m.id, "complete"); if (auto) prontas.push(i); else avisar(t("aviso_missao"), "#69db7c"); }
    });
    prontas.reverse().forEach(function(i) { avisar("+" + resgatarMissao(i) + " 🪙", "#69db7c"); });
    save.semana.desafios.forEach(function(d, i) {
      if (d.feito || d.chave !== chave) return;
      d.prog = Math.min(d.meta, d.prog + n);
      if (d.prog >= d.meta) { d.feito = true; Poki.medir("weekly", d.id, "complete"); if (auto) avisar("+" + resgatarDesafio(i) + " 🪙", "#ffd43b"); else avisar(t("aviso_desafio"), "#ffd43b"); }
    });
    conferirConquistas();
  }

  function conferirConquistas() {
    CONQUISTAS.forEach(function(c) {
      if (save.conquistas[c.id]) return;
      if (valorStat(c.stat) >= c.meta) {
        save.conquistas[c.id] = "feita";
        if (!save.stats.viuMissoes && !c.skin && resgatarConquista(c.id)) avisar("+" + c.moedas + " 🪙", "#b197fc");
        else avisar(t("aviso_conquista", t("co_" + c.id)), "#b197fc");
        Poki.medir("achievement", c.id, "complete");
      }
    });
  }

  function avisar(texto, cor) {
    avisos.push({ texto: texto, cor: cor, t: 0 });
    if (avisos.length > 4) avisos.shift();
    som("carta");
  }

  // ---------- resgatar prêmios ----------
  function ganharMoedas(n) { save.moedas += n; }
  function ganharSkin(id) { if (save.donos.indexOf(id) < 0) save.donos.push(id); }

  function resgatarMissao(i) {
    const m = save.missoes[i];
    if (!m || !m.feito) return 0;
    ganharMoedas(m.moedas);
    save.stats.missoes = (save.stats.missoes || 0) + 1;
    save.missoes.splice(i, 1, sortearMissao(save.missoes));
    conferirConquistas();
    salvar();
    return m.moedas;
  }

  // trocar uma missão difícil por outra (1 vez a cada missão resgatada... grátis 1 vez por dia)
  function trocarMissao(i) {
    const hoje = Math.floor(Date.now() / 86400000);
    if (save.trocaDia === hoje) return false;
    save.trocaDia = hoje;
    save.missoes.splice(i, 1, sortearMissao(save.missoes));
    salvar();
    return true;
  }

  function resgatarDesafio(i) {
    const d = save.semana.desafios[i];
    if (!d || !d.feito || d.resgatado) return 0;
    d.resgatado = true;
    ganharMoedas(d.moedas);
    salvar();
    return d.moedas;
  }

  function semanaCompleta() { return save.semana.desafios.every(function(d) { return d.feito; }); }
  function resgatarPremioSemana() {
    if (!semanaCompleta() || save.semana.premioResgatado) return null;
    save.semana.premioResgatado = true;
    save.stats.semanais = (save.stats.semanais || 0) + 1;
    let premio = save.semana.premio;
    if (save.donos.indexOf(premio) >= 0) { ganharMoedas(400); premio = null; }
    else ganharSkin(premio);
    conferirConquistas();
    salvar();
    return premio || "moedas";
  }

  function resgatarConquista(id) {
    const c = CONQUISTAS.find(function(x) { return x.id === id; });
    if (!c || save.conquistas[id] !== "feita") return false;
    save.conquistas[id] = "resgatada";
    ganharMoedas(c.moedas);
    if (c.skin) ganharSkin(c.skin);
    salvar();
    return true;
  }

  // ---------- skins ----------
  function temSkin(id) { return save.donos.indexOf(id) >= 0; }
  function comprarSkin(id) {
    const s = SKIN[id];
    if (!s || temSkin(id) || !s.preco || save.moedas < s.preco) return false;
    save.moedas -= s.preco;
    ganharSkin(id);
    salvar();
    Poki.medir("skin", id, "interact");
    return true;
  }
  function equipar(id) {
    const s = SKIN[id];
    if (!s || !temSkin(id)) return false;
    if (s.tipo === "corpo") save.skinCorpo = id; else save.skinAcessorio = id;
    salvar();
    return true;
  }

  // Quantos prêmios esperando para resgatar (bolinha de aviso no botão do menu)
  function pendentes() {
    let n = 0;
    save.missoes.forEach(function(m) { if (m.feito) n++; });
    save.semana.desafios.forEach(function(d) { if (d.feito && !d.resgatado) n++; });
    if (semanaCompleta() && !save.semana.premioResgatado) n++;
    for (const id in save.conquistas) if (save.conquistas[id] === "feita") n++;
    return n;
  }

  // Moedas de uma partida (contra o bot: mais se vencer; 2 jogadores: fixo)
  function moedasDaPartida(j) {
    if (j.modo === "2p") return 20;
    if (j.modo === "sobrevivencia") return 10 + (j.onda - 1) * 12;
    const rodadas = j.total.rodadas.filter(function(v) { return v === 1; }).length;
    return 15 + rodadas * 6 + (j.vencedorPartida === 1 ? 25 : 0);
  }

  // ---------- XP e nível do jogador ----------
  function xpParaSubir(nivel) { return 80 + 40 * (nivel - 1); }
  // Dá XP e devolve o que aconteceu (para a barra animar): { nivelAntes, xpAntes, nivel, xp, subiu }
  function ganharXP(n) {
    const r = { nivelAntes: save.nivel, xpAntes: save.xp, ganho: n, subiu: 0 };
    save.xp += n;
    while (save.xp >= xpParaSubir(save.nivel)) { save.xp -= xpParaSubir(save.nivel); save.nivel++; r.subiu++; }
    r.nivel = save.nivel; r.xp = save.xp;
    if (r.subiu) Poki.medir("player", "level-" + save.nivel, "reached");
    salvar();
    return r;
  }
  // XP de uma partida: rodadas vencidas, vitória e ondas da sobrevivência
  function xpDaPartida(j) {
    if (j.modo === "sobrevivencia") return 20 + (j.onda - 1) * 25;
    const rodadas = j.total.rodadas.filter(function(v) { return v === 1; }).length;
    return 30 + rodadas * 15 + (j.vencedorPartida === 1 ? 40 : 0);
  }

  // ---------- baús ----------
  // "normal" (todo fim de partida), "nivel" (subiu de nível), "lendario" (7º dia da recompensa diária)
  function skinSorteada(raridadeMax) {
    const lista = SKINS_CORPO.concat(SKINS_ACESSORIO).filter(function(s) {
      return s.preco && !temSkin(s.id) && s.raridade <= raridadeMax;
    });
    return lista.length ? lista[Math.floor(Math.random() * lista.length)].id : null;
  }
  // garantir: o baú da 1ª partida da vida sempre traz um acessório, que já vem equipado na partida seguinte
  // (a pessoa vê o prêmio em cima da bolinha logo de cara)
  function abrirBau(tipo, garantir) {
    const regra = { normal: [15, 40, 0.08, 2], nivel: [80, 150, 0.35, 3], lendario: [250, 400, 1, 4] }[tipo] || [15, 40, 0, 1];
    const premio = { tipo: tipo, moedas: Math.round(regra[0] + Math.random() * (regra[1] - regra[0])), skin: null };
    if (garantir) {
      const lista = SKINS_ACESSORIO.filter(function(s) { return s.preco && !temSkin(s.id) && s.raridade <= 2; });
      if (lista.length) { premio.skin = lista[Math.floor(Math.random() * lista.length)].id; premio.equipou = true; }
    }
    if (!premio.skin && Math.random() < regra[2]) premio.skin = skinSorteada(regra[3]);
    ganharMoedas(premio.moedas);
    if (premio.skin) ganharSkin(premio.skin);
    if (premio.equipou) save.skinAcessorio = premio.skin;
    salvar();
    Poki.medir("chest", tipo, "interact");
    return premio;
  }

  // ---------- recompensa diária (sequência de 7 dias) ----------
  const DIARIAS = [
    { moedas: 50 }, { moedas: 75 }, { moedas: 60, bau: "normal" }, { moedas: 125 },
    { moedas: 150 }, { moedas: 200 }, { moedas: 100, bau: "lendario" }
  ];
  function hoje() { return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000); }   // dia local
  // Qual dia da sequência a pessoa pode pegar hoje (1..7), ou 0 se já pegou
  function diaDisponivel() {
    const d = save.diario || { ultimo: 0, seq: 0 };
    const h = hoje();
    if (d.ultimo === h) return 0;
    const continua = d.ultimo === h - 1;
    return continua ? (d.seq % 7) + 1 : 1;
  }
  function pegarDiaria() {
    const dia = diaDisponivel();
    if (!dia) return null;
    save.diario = { ultimo: hoje(), seq: dia };
    const r = DIARIAS[dia - 1];
    ganharMoedas(r.moedas);
    const premio = { dia: dia, moedas: r.moedas, bau: r.bau ? abrirBau(r.bau) : null };
    salvar();
    Poki.medir("daily", "day-" + dia, "interact");
    return premio;
  }

  // v18: um aviso por vez (fila); esperar = a faixa de prêmios está na tela (desenho.js mostra depois dela)
  function atualizarAvisos(dt, esperar) {
    if (!avisos.length || esperar) return;
    avisos[0].t += dt;
    if (avisos[0].t > 2.6) avisos.shift();
  }

  return {
    preparar: preparar, registrar: registrar, semanaAtual: semanaAtual, valorStat: valorStat,
    resgatarMissao: resgatarMissao, trocarMissao: trocarMissao, resgatarDesafio: resgatarDesafio,
    semanaCompleta: semanaCompleta, resgatarPremioSemana: resgatarPremioSemana, resgatarConquista: resgatarConquista,
    temSkin: temSkin, ganharSkin: ganharSkin, comprarSkin: comprarSkin, equipar: equipar, pendentes: pendentes,
    moedasDaPartida: moedasDaPartida, ganharMoedas: ganharMoedas, avisos: avisos, atualizarAvisos: atualizarAvisos,
    xpParaSubir: xpParaSubir, ganharXP: ganharXP, xpDaPartida: xpDaPartida, abrirBau: abrirBau,
    DIARIAS: DIARIAS, diaDisponivel: diaDisponivel, pegarDiaria: pegarDiaria
  };
})();
