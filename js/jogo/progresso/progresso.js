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
    // v23: só mapas que a pessoa encontra cedo (antes podia pedir um mapa que só aparece na Prata: missão impossível)
    if (mod.porCenario) { const comuns = ["campo", "fabrica", "floresta", "fliperama", "templo"]; m.cenario = comuns[Math.floor(Math.random() * comuns.length)]; }
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
    const lista = SKINS.filter(function(s) { return s.semanal; });
    return lista[sem % lista.length].id;
  }

  // Prepara o save (primeira vez, semana nova, missões faltando)
  function preparar() {
    save.stats = save.stats || {};
    save.donos = save.donos && save.donos.length ? save.donos : ["classico", "nenhum"];
    prepararVisual();
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
    // missões e desafios. v18: quem nunca abriu o menu de Missões (o novato) recebe na hora e vê só "+N moedas"
    // (antes os prêmios ficavam esperando num menu que ele não conhecia e o aviso falava de algo que ele nunca viu)
    const auto = !save.stats.viuMissoes, prontas = [];
    save.missoes.forEach(function(m, i) {
      if (m.feito || m.chave !== chave) return;
      if (m.cenario && m.cenario !== extra.cenario) return;
      m.prog = Math.min(m.meta, m.prog + n);
      if (m.prog >= m.meta) { m.feito = true; Poki.medir("mission", m.id, "complete"); if (auto) prontas.push(i); else avisar(t("aviso_missao"), "#69db7c"); }
    });
    prontas.reverse().forEach(function(i) { avisar(t("n_moedas", resgatarMissao(i)), "#69db7c", "moeda"); });
    save.semana.desafios.forEach(function(d, i) {
      if (d.feito || d.chave !== chave) return;
      d.prog = Math.min(d.meta, d.prog + n);
      if (d.prog >= d.meta) { d.feito = true; Poki.medir("weekly", d.id, "complete"); if (auto) avisar(t("n_moedas", resgatarDesafio(i)), "#ffd43b", "moeda"); else avisar(t("aviso_desafio"), "#ffd43b"); }
    });
    conferirConquistas();
  }

  function conferirConquistas() {
    CONQUISTAS.forEach(function(c) {
      if (save.conquistas[c.id]) return;
      if (valorStat(c.stat) >= c.meta) {
        save.conquistas[c.id] = "feita";
        if (!save.stats.viuMissoes && !c.skin && resgatarConquista(c.id)) avisar(t("n_moedas", c.moedas), "#b197fc", "moeda");
        else avisar(t("aviso_conquista", t("co_" + c.id)), "#b197fc");
        Poki.medir("achievement", c.id, "complete");
      }
    });
  }

  // icone (opcional, nome de Icone.NOMES): o desenho pode pôr o ícone ao lado do texto (o texto não tem emoji)
  function avisar(texto, cor, icone) {
    avisos.push({ texto: texto, cor: cor, t: 0, icone: icone || "" });
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

  // ---------- skins / personalização (v19) ----------
  // tem: comprou/ganhou, vem com o jogo (gratis) ou já chegou no nível que libera
  function temSkin(id) {
    const s = SKIN[id];
    if (id === "nenhum" || id === "") return true;
    if (save.donos.indexOf(id) >= 0) return true;
    return !!(s && (s.gratis || (s.nivel && save.nivel >= s.nivel)));
  }
  function comprarSkin(id) {
    const s = SKIN[id];
    if (!s || temSkin(id) || !s.preco || save.moedas < s.preco) return false;
    save.moedas -= s.preco;
    ganharSkin(id);
    salvar();
    Poki.medir("skin", id, "interact");
    return true;
  }
  // põe o item na categoria dele (id "" + tipo = tirar). Mantém o espelho antigo (skinCorpo / skinAcessorio)
  function equipar(id, tipo) {
    const s = SKIN[id];
    if (id === "" || id === "nenhum") {
      if (!tipo || !VISUAL_OPCIONAL[tipo]) return false;
      save.visual[tipo] = "";
    } else {
      if (!s || !temSkin(id)) return false;
      save.visual[s.tipo] = id;
    }
    espelhoAntigo();
    salvar();
    return true;
  }
  function espelhoAntigo() {
    const v = save.visual;
    save.skinCorpo = v.corpo || "classico";
    save.skinAcessorio = v.chapeu || v.acessorio || v.olhos || "nenhum";
  }
  // v19: save antigo (v18: corpo + 1 acessório) vira o visual novo; ids inválidos voltam ao padrão
  function prepararVisual() {
    if (!save.visual || typeof save.visual !== "object") save.visual = Object.assign({}, VISUAL_PADRAO);
    if (!(save.versao >= 2)) {
      save.visual = visualDeAntigo(save.skinCorpo, save.skinAcessorio);
      save.versao = 2;
    }
    CATEGORIAS_VISUAL.forEach(function(c) {
      const id = save.visual[c];
      if (typeof id !== "string") save.visual[c] = VISUAL_PADRAO[c];
      else if (id && (!SKIN[id] || SKIN[id].tipo !== c || !temSkin(id))) save.visual[c] = VISUAL_PADRAO[c];
    });
    if (!save.poder || typeof save.poder !== "object") save.poder = { forca: 0, vida: 0, veloc: 0, sorte: 0 };
    if (typeof save.poder.sorte !== "number") save.poder.sorte = 0;
    if (!Array.isArray(save.armas)) save.armas = [];
    save.armas = save.armas.filter(function(id) { return typeof ARMA !== "undefined" && ARMA[id]; });
    if (save.armaInicial && save.armas.indexOf(save.armaInicial) < 0) save.armaInicial = "";
    if (!Array.isArray(save.supers)) save.supers = [];
    save.supers = save.supers.filter(function(id) { return typeof SUPER_DE !== "undefined" && SUPER_DE[id] && !SUPER_DE[id].gratis; });
    if (save.superEquip && !temSuper(save.superEquip)) save.superEquip = "";
    espelhoAntigo();
  }

  // ---------- loja de armas (v19) ----------
  // Preço por raridade, medido com a economia da v18.3 (scratchpad/v19/trab-c/economia.js): uma vitória contra rival
  // da Bronze dá ~150–230 moedas (partida + prêmio do rival + baú). Comum ~2 vitórias, rara ~5, lendária ~14.
  // v21.4: o dono pediu as boas MUITO caras (a arma comprada virou reserva com munição infinita; não pode ficar apelão).
  // Os 10 rivais da Bronze dão ~1.100 moedas de prêmio (~1.500–2.500 com missões e baús): lendária = 3–4 ligas
  const PRECO_ARMA = [0, 400, 3000, 9000];
  function precoArma(id) { const a = ARMA[id]; return a ? PRECO_ARMA[a.raridade] || 0 : 0; }
  function temArma(id) { return save.armas.indexOf(id) >= 0; }
  // a loja só aparece depois que o novato passou pelo começo (rival 5 vencido ou já viu a tela das melhorias)
  function lojaLiberada() { return !!(save.stats.viuPoder || save.rival >= 5 || save.liga > 0); }
  function comprarArma(id) {
    const p = precoArma(id);
    if (!p || temArma(id) || save.moedas < p) return false;
    save.moedas -= p;
    save.armas.push(id);
    if (!save.armaInicial) save.armaInicial = id;   // a 1ª arma comprada já vira a inicial
    salvar();
    Poki.medir("shop", "buy-" + id, "interact");
    return true;
  }
  function equiparArma(id) {
    if (id && !temArma(id)) return false;
    save.armaInicial = id || "";
    salvar();
    Poki.medir("shop", id ? "start-" + id : "start-none", "interact");
    return true;
  }

  // ---------- supers (v21.6; aba Supers da loja) ----------
  function precoSuper(id) { const s = SUPER_DE[id]; return s && !s.gratis ? s.preco : 0; }
  function temSuper(id) { return save.supers.indexOf(id) >= 0; }
  function comprarSuper(id) {
    const p = precoSuper(id);
    if (!p || temSuper(id) || save.moedas < p) return false;
    save.moedas -= p;
    save.supers.push(id);
    save.superEquip = id;   // o comprado já vira o escolhido
    salvar();
    Poki.medir("shop", "buy-super-" + id, "interact");
    return true;
  }
  function equiparSuper(id) {
    if (id && !temSuper(id)) return false;
    save.superEquip = id || "";
    salvar();
    Poki.medir("shop", "super-" + (id || "none"), "interact");
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
  // v23: curva mais plana (era 80 + 40 por nível, sem teto): um nível a cada ~2 partidas também lá na frente
  function xpParaSubir(nivel) { return Math.min(260, 80 + 30 * (nivel - 1)); }

  // ---------- v23: TRILHA DE PRÊMIOS (Web Fit da v18.3: 3:23 de média; o Poki pede ~5:46) ----------
  // Todo nível dá um prêmio GARANTIDO (antes: baú com 35% de chance de item) e a próxima recompensa fica sempre à vista
  // (barra na faixa de prêmios). Nível múltiplo de 5: arma (a mais barata que falta; vira a reserva se não tiver);
  // múltiplo de 3: super (o mais barato que falta; vira o escolhido se não tiver); os outros: item do baú do nível.
  function armasDaTrilha() {
    return ARMAS.filter(function(a) { return a.raridade >= 1 && a.tipo !== "mina" && a.tipo !== "ceu" && a.tipo !== "torreta"; })
      .sort(function(a, b) { return a.raridade - b.raridade; });
  }
  function premioDoNivel(nivel) {
    if (nivel % 5 === 0) { const a = armasDaTrilha().filter(function(a) { return !temArma(a.id); })[0]; if (a) return { tipo: "arma", id: a.id }; }
    if (nivel % 3 === 0 || nivel % 5 === 0) { const s = SUPERS.filter(function(s) { return !s.gratis && !temSuper(s.id); })[0]; if (s) return { tipo: "super", id: s.id }; }
    return { tipo: "skin" };
  }
  function darPremioDoNivel(nivel) {
    const p = premioDoNivel(nivel);
    if (p.tipo === "super") { save.supers.push(p.id); if (!save.superEquip) save.superEquip = p.id; }
    else if (p.tipo === "arma") { save.armas.push(p.id); if (!save.armaInicial) save.armaInicial = p.id; }
    if (p.id) Poki.medir("track", p.tipo + "-" + p.id, "reached");
    return p;
  }
  // o que vem no próximo nível e quanto falta (para a barra)
  function proximoPremio() {
    const n = save.nivel + 1, p = premioDoNivel(n);
    return { nivel: n, tipo: p.tipo, id: p.id, xp: save.xp, total: xpParaSubir(save.nivel) };
  }
  // missões prontas são resgatadas sozinhas no fluxo direto (antes esperavam a pessoa abrir o menu, o que quase
  // ninguém faz entre os rivais: a missão completa nunca virava prêmio)
  function resgatarProntas() {
    let total = 0;
    for (let i = 0; i < save.missoes.length; i++) if (save.missoes[i].feito) total += resgatarMissao(i);
    return total;
  }
  function missaoAtual() {
    for (let i = 0; i < save.missoes.length; i++) if (!save.missoes[i].feito) return save.missoes[i];
    return null;
  }
  // Dá XP e devolve o que aconteceu (para a barra animar): { nivelAntes, xpAntes, nivel, xp, subiu }
  function ganharXP(n) {
    const r = { nivelAntes: save.nivel, xpAntes: save.xp, ganho: n, subiu: 0 };
    save.xp += n;
    while (save.xp >= xpParaSubir(save.nivel)) { save.xp -= xpParaSubir(save.nivel); save.nivel++; r.subiu++; }
    r.nivel = save.nivel; r.xp = save.xp;
    // v19: itens que o nível novo libera (personalização)
    r.liberados = r.subiu ? SKINS.filter(function(s) { return s.nivel && s.nivel > r.nivelAntes && s.nivel <= r.nivel; }).map(function(s) { return s.id; }) : [];
    r.premios = [];
    for (let n = r.nivelAntes + 1; n <= r.nivel; n++) { const p = darPremioDoNivel(n); if (p.id) r.premios.push(p); }
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
  // v19: os itens "só de baú" entram aqui; com Sorte a raridade pesa mais para cima
  function skinSorteada(raridadeMax) {
    const sorte = typeof sorteJogador === "function" ? sorteJogador() : 0;
    const lista = SKINS.filter(function(s) {
      return (s.preco || s.bau) && !temSkin(s.id) && s.raridade <= raridadeMax;
    });
    if (!lista.length) return null;
    let soma = 0;
    const peso = function(s) { return (s.bau ? 1.6 : 1) * Math.pow(1 + sorte * 1.5, s.raridade - 1); };
    lista.forEach(function(s) { soma += peso(s); });
    let r = Math.random() * soma;
    for (let i = 0; i < lista.length; i++) { r -= peso(lista[i]); if (r <= 0) return lista[i].id; }
    return lista[0].id;
  }
  // garantir: o baú da 1ª partida da vida sempre traz um acessório, que já vem equipado na partida seguinte
  // (a pessoa vê o prêmio em cima da bolinha logo de cara)
  function abrirBau(tipo, garantir) {
    const regra = { normal: [15, 40, 0.08, 2], nivel: [80, 150, 1, 3], lendario: [250, 400, 1, 4] }[tipo] || [15, 40, 0, 1];
    // v19: Sorte (0 a 1) = baú melhor: +40% de moedas e o dobro da chance de item no máximo; o baú normal pode
    // trazer até épico
    const sorte = typeof sorteJogador === "function" ? sorteJogador() : 0;
    const premio = { tipo: tipo, moedas: Math.round((regra[0] + Math.random() * (regra[1] - regra[0])) * (1 + 0.4 * sorte)), skin: null };
    if (garantir) {
      const lista = SKINS_POR_TIPO.chapeu.filter(function(s) { return s.preco && !temSkin(s.id) && s.raridade <= 2; });
      if (lista.length) { premio.skin = lista[Math.floor(Math.random() * lista.length)].id; premio.equipou = true; }
    }
    if (!premio.skin && Math.random() < regra[2] * (1 + sorte)) premio.skin = skinSorteada(Math.min(4, regra[3] + (sorte >= 0.5 ? 1 : 0)));
    ganharMoedas(premio.moedas);
    if (premio.skin) ganharSkin(premio.skin);
    if (premio.equipou) equipar(premio.skin);
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
    prepararVisual: prepararVisual, precoArma: precoArma, temArma: temArma, comprarArma: comprarArma, equiparArma: equiparArma,
    lojaLiberada: lojaLiberada, PRECO_ARMA: PRECO_ARMA,
    premioDoNivel: premioDoNivel, proximoPremio: proximoPremio, resgatarProntas: resgatarProntas, missaoAtual: missaoAtual,
    precoSuper: precoSuper, temSuper: temSuper, comprarSuper: comprarSuper, equiparSuper: equiparSuper,
    moedasDaPartida: moedasDaPartida, ganharMoedas: ganharMoedas, avisos: avisos, atualizarAvisos: atualizarAvisos,
    xpParaSubir: xpParaSubir, ganharXP: ganharXP, xpDaPartida: xpDaPartida, abrirBau: abrirBau,
    DIARIAS: DIARIAS, diaDisponivel: diaDisponivel, pegarDiaria: pegarDiaria
  };
})();
