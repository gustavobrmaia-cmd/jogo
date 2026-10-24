"use strict";

// =========================
// ONLINE (v19): partida de verdade entre dois aparelhos (js/rede/rede.js faz a conexão).
// - Anfitrião (criou a sala) roda a partida inteira, igual ao "2 jogadores", com a bolinha 2 controlada pela rede.
//   A cada 2 passos (30 por segundo) manda o estado (jogo + M) e os efeitos e sons que aconteceram no meio.
// - Convidado não simula: manda os controles dele a cada passo e desenha o estado que chega.
//   Para ele, tudo chega ESPELHADO (bolinha dele = índice 0, lado 1): HUD, "VOCÊ", mira, câmera e tela vermelha
//   funcionam igual a uma partida normal, sem mexer no desenho.
// - Anúncio comum antes de procurar sala e antes de cada revanche (nunca no meio da partida).
// =========================

const Online = (function() {
  const api = { ativo: false, gravando: false };
  let tela = "inicio";            // inicio | procurando | sala | conectado | fim
  let outro = null;               // o "ola" do outro (visual, cor, arma inicial)
  let prontoEu = false, prontoOutro = false;
  let entRemota = { esq: false, dir: false, sp: false, bx: false, t: false, pc: 0, tc: 0, cc: 0, dc: 0, m: null };
  let usados = { pc: 0, tc: 0, cc: 0, dc: 0 };
  let seq = 0, passos = 0, ultimoEstado = 0;
  let fila = [];                  // efeitos/sons do anfitrião desde o último envio
  let alvo = null, antes = null, tAlvo = 0;   // convidado: posições para suavizar entre dois estados
  const cont = { pc: 0, tc: 0, cc: 0, dc: 0 };   // v21.2: dc = dashes
  let primeiroEstado = true;
  // v20: canal dos pacotes de jogo ("u" rápido; vira "r" se a rede do outro não deixar o rápido passar) e contagens
  let canalJogo = "u", enviadosJogo = 0, recebidosJogo = 0, timerP2P = 0;
  let outroOculto = false;        // a aba do outro está escondida (o jogo dele para; não é queda de conexão)

  // ---------- serialização (anfitrião) ----------
  // referências viram marcas: bolinha {$b}, plataforma {$p}, arma {$a}, cenário {$c}; canvas e funções ficam de fora
  const LOCAIS = { prerender: 1, prerenderCen: 1, prerenderH: 1, prerenderRodada: 1, est: 1, bots: 1, popPontos: 1,
    lotado: 1, lotadoRodada: 1, chuva: 1, tuto: 1, acumLento: 1 };
  // pilha = objetos no caminho atual (evita laço); o mesmo objeto em dois lugares vai nos dois
  function empacotar(v, M, prof, pilha) {
    if (v === null || v === undefined) return v;
    const tp = typeof v;
    if (tp === "number") return isFinite(v) ? Math.round(v * 100) / 100 : v > 0 ? { $i: 1 } : v < 0 ? { $i: -1 } : 0;
    if (tp === "string" || tp === "boolean") return v;
    if (tp !== "object") return undefined;
    if (M) {
      const ib = M.bolinhas.indexOf(v); if (ib >= 0) return { $b: ib };
      const ip = M.plats.indexOf(v); if (ip >= 0) return { $p: ip };
    }
    if (v.id && typeof ARMA !== "undefined" && ARMA[v.id] === v) return { $a: v.id };
    if (v.id && typeof CENARIO !== "undefined" && CENARIO[v.id] === v) return { $c: v.id };
    if (v.id && typeof CARTA !== "undefined" && CARTA[v.id] === v) return { $k: v.id };
    if (v.getContext || v.nodeType || v instanceof Set || v instanceof Map) return undefined;
    if (pilha.indexOf(v) >= 0 || prof > 7) return undefined;
    pilha.push(v);
    let o;
    if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      o = Array.prototype.map.call(v, function(x) { const r = empacotar(x, M, prof + 1, pilha); return r === undefined ? null : r; });
    } else {
      o = {};
      for (const k in v) {
        const r = empacotar(v[k], M, prof + 1, pilha);
        if (r !== undefined) o[k] = r;
      }
    }
    pilha.pop();
    return o;
  }
  function campos(obj, M, pular) {
    const o = {};
    for (const k in obj) {
      if (pular[k]) continue;
      const r = empacotar(obj[k], M, 1, [obj]);
      if (r !== undefined) o[k] = r;
    }
    return o;
  }
  const PULAR_M = { bolinhas: 1, plats: 1 };
  const PULAR_B = { cache: 1, desc: 1, __cu: 1 };
  function estadoAtual() {
    const j = jogo, M = j.M;
    const Mp = campos(M, M, PULAR_M);
    Mp.bolinhas = M.bolinhas.map(function(b) { return campos(b, M, PULAR_B); });
    Mp.plats = M.plats.map(function(p) { return empacotar(p, null, 1, []); });
    const pular = Object.assign({ M: 1 }, LOCAIS);
    const jp = campos(j, M, pular);
    jp.M = Mp;
    // a variação do cenário (dia, noite...) é sorteada no desenho: vai junto para os dois verem o mesmo
    if (typeof ArteCenarios !== "undefined" && ArteCenarios.variacao) jp.varCen = ArteCenarios.variacao();
    return jp;
  }

  // ---------- espelho e reconstrução (convidado) ----------
  const PARES = { bolinhas: 1, pontos: 1, cores: 1, visuais: 1, skins: 1, armaInicial: 1, superEquip: 1, dano: 1, tiros: 1, acertos: 1, armas: 1 };
  const LADOS = { lado: 1, vencedorRodada: 1, vencedorPartida: 1, vencedor: 1 };
  function espelhar(v, chave) {
    if (Array.isArray(v)) {
      const a = v.map(function(x) { return espelhar(x); });
      if (chave === "rodadas") return a.map(function(x) { return x === 1 || x === 2 ? 3 - x : x; });
      return PARES[chave] && a.length === 2 ? [a[1], a[0]] : a;
    }
    if (!v || typeof v !== "object") return v;
    if (v.$b !== undefined) return { $b: 1 - v.$b };
    const o = {};
    for (const k in v) {
      const x = v[k];
      if (LADOS[k] && (x === 1 || x === 2)) o[k] = 3 - x;
      else o[k] = espelhar(x, k);
    }
    // queda de braço: a barra e os toques são vistos do outro lado
    if (o.pos !== undefined && o.toques1 !== undefined) {
      o.pos = -o.pos;
      const t1 = o.toques1; o.toques1 = o.toques2; o.toques2 = t1;
      const p1 = o.pulso1; o.pulso1 = o.pulso2; o.pulso2 = p1;
    }
    return o;
  }
  function reviver(v, M) {
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = reviver(v[i], M); return v; }
    if (!v || typeof v !== "object") return v;
    if (v.$b !== undefined) return M.bolinhas[v.$b];
    if (v.$p !== undefined) return M.plats[v.$p];
    if (v.$a !== undefined) return ARMA[v.$a];
    if (v.$c !== undefined) return CENARIO[v.$c];
    if (v.$k !== undefined) return CARTA[v.$k];
    if (v.$i !== undefined) return v.$i * Infinity;
    for (const k in v) v[k] = reviver(v[k], M);
    return v;
  }

  function aplicarEstado(s) {
    const j = jogo;
    if (!j || j.modo !== "online") return;
    s = espelhar(s);
    const Ms = s.M;
    delete s.M;
    let M = j.M;
    const novaRodada = !M || (s.rodada !== undefined && s.rodada !== j.rodada) || primeiroEstado;
    primeiroEstado = false;
    if (novaRodada) {
      // rodada nova: M novo (as bolinhas antigas guardavam os desenhos da rodada anterior)
      M = j.M = { bolinhas: [{}, {}], plats: [] };
      alvo = null;
    }
    if (Ms.plats) {
      Ms.plats.forEach(function(p, i) { M.plats[i] = Object.assign(M.plats[i] || {}, p); });
      M.plats.length = Ms.plats.length;
    }
    const bols = Ms.bolinhas;
    delete Ms.bolinhas; delete Ms.plats;
    for (const k in Ms) M[k] = reviver(Ms[k], M);
    // bolinhas: atualiza os objetos que já existem (os desenhos guardados nelas continuam valendo)
    antes = M.bolinhas.map(function(b) { return { x: b.x, y: b.y }; });
    bols.forEach(function(bs, i) {
      const b = M.bolinhas[i];
      for (const k in bs) b[k] = reviver(bs[k], M);
    });
    alvo = M.bolinhas.map(function(b) { return { x: b.x, y: b.y }; });
    if (novaRodada) antes = alvo.map(function(a) { return { x: a.x, y: a.y }; });
    tAlvo = 0;
    const faseAntes = j.fase;
    for (const k in s) j[k] = reviver(s[k], M);
    j.M = M;
    // mesma variação do cenário do anfitrião: se a daqui for outra, refaz o fundo com a dele
    if (j.varCen && typeof ArteCenarios !== "undefined" && ArteCenarios.variacao && ArteCenarios.variacao() !== j.varCen) {
      ArteCenarios.forcarVariacao(j.varCen);
      j.prerender = null; j.prerenderRodada = -1;
    }
    // gameplay do Poki: só conta a luta
    if (faseAntes !== j.fase) Poki.jogando(j.fase === "luta" && estado === "jogo");
  }

  // ---------- efeitos e sons do anfitrião ----------
  function embrulhar(obj, nomes, nomeGrupo) {
    nomes.forEach(function(n) {
      const f = obj[n];
      if (typeof f !== "function" || f.__online) return;
      const novo = function() {
        if (api.gravando) {
          const M = jogo && jogo.M;
          const args = Array.prototype.slice.call(arguments).map(function(a) { const r = empacotar(a, M, 1, []); return r === undefined ? null : r; });
          fila.push([nomeGrupo, n, args]);
        }
        return f.apply(this, arguments);
      };
      novo.__online = true;
      obj[n] = novo;
    });
  }
  function prepararGravacao() {
    if (prepararGravacao.feito) return;
    prepararGravacao.feito = true;
    if (typeof Efeitos !== "undefined") {
      embrulhar(Efeitos, Object.keys(Efeitos).filter(function(n) {
        return typeof Efeitos[n] === "function" && ["atualizar", "desenhar", "limpar", "preparar", "aquecer"].indexOf(n) < 0;
      }), "fx");
    }
    if (typeof ArteArmas !== "undefined") embrulhar(ArteArmas, ["disparo", "soltar"], "arma");
    if (typeof efeitoKO === "function") embrulhar(window, ["efeitoKO"], "w");
    embrulhar(window, ["som"], "w");
  }
  function tocarFila(lista) {
    const M = jogo && jogo.M;
    lista.forEach(function(it) {
      const alvo2 = it[0] === "fx" ? Efeitos : it[0] === "arma" ? ArteArmas : window;
      const f = alvo2 && alvo2[it[1]];
      if (typeof f !== "function") return;
      try { f.apply(alvo2, reviver(espelhar(it[2]), M)); } catch (e) { /* um efeito que não reconstrói não pode travar */ }
    });
  }

  // ---------- partida ----------
  function ola() {
    const ai = save.armaInicial && ARMA[save.armaInicial] && (save.armas || []).indexOf(save.armaInicial) >= 0 ? save.armaInicial : "";
    const su = save.superEquip && typeof Progresso !== "undefined" && Progresso.temSuper(save.superEquip) ? save.superEquip : "";
    Rede.enviar("r", { k: "ola", v: 1, visual: save.visual || null, cor: typeof corDoVisual === "function" ? corDoVisual(save.visual) : null, arma: ai, sup: su });
  }

  function comecar() {
    // só o anfitrião começa; o convidado começa quando chega o "ini"
    prontoEu = prontoOutro = false;
    ultimo.j = {}; ultimo.M = {}; ultimo.b = [{}, {}]; ultimaRodada = 0; seq = 0;
    ultimoEstado = performance.now();   // o relógio de queda começa do zero (na revanche ele vinha da tela de fim)
    // v19.9: toques que sobraram da partida anterior não viram pulo/tiro na nova (na revanche o convidado zerava os
    // contadores e o anfitrião não, e os toques dele sumiam até passar a conta antiga)
    usados = { pc: entRemota.pc || 0, tc: entRemota.tc || 0, cc: entRemota.cc || 0, dc: entRemota.dc || 0 };
    save.partidas++;
    salvar();
    // v19.9: o visual, a cor e a arma inicial do convidado entram ANTES da 1ª rodada (antes eram aplicados depois e a
    // roleta já tinha sido montada sem a arma inicial dele)
    novaPartida("online", { outro: outro });
    entrarNoJogo();
    Rede.enviar("r", { k: "ini" });
    Poki.medir("match", "online", "start");
  }
  // o visual, a cor e a arma inicial do convidado ficam na bolinha 2
  // chamado por partida.js (novaPartida, modo "online", só no anfitrião) antes de iniciarRodada
  function configurarOutro(j, outro) {
    if (!outro) return;
    if (outro.visual) j.visuais[1] = Object.assign({}, VISUAL_PADRAO, outro.visual);
    const c = outro.cor;
    j.cores[1] = c && coresDiferentes(c, j.cores[0]) ? c : corDiferente(j.cores[0]);
    atualizarSkins(j);
    const a = outro.arma;
    if (a && ARMA[a] && ["mina", "ceu", "torreta"].indexOf(ARMA[a].tipo) < 0) j.armaInicial[1] = a;
    if (outro.sup && typeof SUPER_DE !== "undefined" && SUPER_DE[outro.sup]) j.superEquip[1] = outro.sup;   // v21.6
  }
  api.configurarOutro = configurarOutro;
  function entrarNoJogo() {
    api.ativo = true;
    estado = "jogo";
    entrada.ativa = true;
    entrada.solo = true;
    entrada.limparApertos();
    mostrarTela(null);
    Poki.jogando(true);
  }

  // anfitrião: chamado por partida.js no lugar de ler o teclado da bolinha 2
  api.entradaRemota = function(b) {
    const e = entRemota;
    b.miraLivre = typeof e.m === "number" ? e.m : null;
    const pulo = e.pc > usados.pc, tiroAp = e.tc > usados.tc, dash = (e.dc || 0) > usados.dc;
    if (pulo) usados.pc++;
    if (tiroAp) usados.tc++;
    if (dash) usados.dc++;
    return { esq: e.esq, dir: e.dir, pulo: pulo, segPulo: e.sp, baixo: e.bx, tiro: e.t || tiroAp, apertouTiro: tiroAp, dash: dash };
  };
  // anfitrião: cliques do convidado na queda de braço
  api.cliqueRemoto = function() {
    if (entRemota.cc > usados.cc) { usados.cc++; return true; }
    return false;
  };

  // tira de "o" as chaves iguais às do último envio (guardadas em "memo")
  let ultimaRodada = 0;
  const ultimo = { j: {}, M: {}, b: [{}, {}] };
  function diferenca(o, memo, cheio, manter) {
    for (const k in o) {
      if (manter[k]) continue;
      const txt = JSON.stringify(o[k]);
      if (!cheio && memo[k] === txt) delete o[k];
      else memo[k] = txt;
    }
  }

  // anfitrião: grava os efeitos durante o passo e manda o estado a cada 2 passos
  api.antesDoPasso = function() {
    prepararGravacao(); api.gravando = true;
    // v19.6: o anfitrião também tem tempo-limite: sem os controles do convidado por 6 s (40 s se ele escondeu a aba)
    // é queda. Antes ficava jogando contra uma bolinha parada se a rede caísse sem avisar
    if (Rede.conectado && performance.now() - ultimoEstado > (outroOculto ? 40000 : 8000)) caiuConexao();
  };
  api.depoisDoPasso = function() {
    api.gravando = false;
    passos++;
    if (passos % 2 && jogo.fase === "luta") return;
    let s;
    try { s = estadoAtual(); } catch (e) { console.error(e); return; }
    // só vai o que mudou; a cada 30 pacotes (1 s) e na rodada nova vai tudo (recupera o que se perdeu no caminho)
    const cheio = seq % 30 === 0 || s.rodada !== ultimaRodada;
    ultimaRodada = s.rodada;
    diferenca(s, ultimo.j, cheio, { M: 1 });
    diferenca(s.M, ultimo.M, cheio, { bolinhas: 1 });
    s.M.bolinhas.forEach(function(b, i) { diferenca(b, ultimo.b[i], cheio, {}); });
    Rede.enviar(canalJogo, { k: "s", n: ++seq, c: cheio ? 1 : 0, s: s, f: canalJogo === "r" ? [] : fila });
    enviadosJogo++;
    // efeitos não podem se perder: se o rápido perder o pacote, eles vão de novo no confiável
    if (fila.length) Rede.enviar("r", { k: "f", n: seq, f: fila });
    fila = [];
  };

  // convidado: no lugar de simular, manda os controles e suaviza o desenho entre dois estados
  api.passoConvidado = function(dt) {
    const j = jogo;
    if (typeof Efeitos !== "undefined") Efeitos.atualizar(dt);
    const M = j.M;
    if (!M || !M.bolinhas || !M.bolinhas[0] || M.bolinhas[0].x === undefined) return;
    const b = M.bolinhas[0];
    const toque = entrada.apertou(1, "toque");
    const ent = entradaHumana(1, b);
    if (ent.pulo) cont.pc++;
    if (ent.dash) cont.dc++;
    if (ent.apertouTiro) cont.tc++;
    if (toque || ent.apertouTiro || ent.pulo) cont.cc++;
    enviadosJogo++;
    Rede.enviar(canalJogo, { k: "e", esq: ent.esq, dir: ent.dir, sp: ent.segPulo, bx: ent.baixo, t: ent.tiro,
      pc: cont.pc, tc: cont.tc, cc: cont.cc, dc: cont.dc, m: typeof b.miraLivre === "number" ? Math.round(b.miraLivre * 1000) / 1000 : null });
    // entre dois estados (1/30 s) a bolinha anda do ponto antigo ao novo
    if (alvo && antes) {
      tAlvo = Math.min(1, tAlvo + dt / 1000 * 30);
      M.bolinhas.forEach(function(bb, i) {
        if (!alvo[i] || !antes[i]) return;
        bb.x = antes[i].x + (alvo[i].x - antes[i].x) * tAlvo;
        bb.y = antes[i].y + (alvo[i].y - antes[i].y) * tAlvo;
      });
    }
    // sem notícia do anfitrião: 6 s é queda; se ele só escondeu a aba, espera até 40 s
    if (performance.now() - ultimoEstado > (outroOculto ? 40000 : 8000) && Rede.conectado) caiuConexao();
  };

  // ---------- mensagens ----------
  let fxVistos = 0;
  Rede.ao("msg", function(canal, m) {
    if (!m || !m.k) return;
    ultimoEstado = performance.now();   // v20: qualquer mensagem (inclusive o "vivo" de 1 em 1 s) mostra que o outro está lá
    if (m.k === "vivo") {
      // v20: o outro conta quantos pacotes de jogo recebeu; se quase nada do canal rápido chega (rede que bloqueia),
      // passa a mandar tudo pelo confiável (antes a partida caía em 6 s)
      if (canalJogo === "u" && enviadosJogo > 90 && (m.n || 0) < enviadosJogo * 0.4) {
        canalJogo = "r";
        Poki.medir("online", "reliable", "reached");
      }
      return;
    }
    if (m.k === "ola") {
      if (m.v !== 1) { status(t("on_versao")); return; }
      outro = m;
      if (Rede.anfitriao) { status(t("on_achou")); setTimeout(function() { if (Rede.conectado && tela !== "jogo") { tela = "jogo"; comecar(); } }, 700); }
    } else if (m.k === "e" && Rede.anfitriao) {
      entRemota = m;
      recebidosJogo++;
      ultimoEstado = performance.now();
    } else if (m.k === "ini" && !Rede.anfitriao) {
      tela = "jogo";
      prontoEu = prontoOutro = false;
      save.partidas++;
      salvar();
      novaPartida("online", {});
      primeiroEstado = true;
      seq = 0;
      // (os contadores de toque do convidado não zeram: só crescem durante a conexão; o anfitrião acompanha)
      fxVistos = 0;
      ultimoEstado = performance.now();
      entrarNoJogo();
      Poki.medir("match", "online", "start");
    } else if (m.k === "s" && !Rede.anfitriao) {
      recebidosJogo++;
      if (m.n < seq) return;   // chegou fora de ordem
      if (!m.c && (primeiroEstado || (m.s.rodada !== undefined && jogo && m.s.rodada !== jogo.rodada))) return;
      seq = m.n;
      ultimoEstado = performance.now();
      try { aplicarEstado(m.s); } catch (e) { console.error(e); }
      if (m.f && m.f.length && m.n > fxVistos) { fxVistos = m.n; tocarFila(m.f); }
    } else if (m.k === "f" && !Rede.anfitriao) {
      if (m.n > fxVistos) { fxVistos = m.n; tocarFila(m.f); }
    } else if (m.k === "fim" && !Rede.anfitriao) {
      if (jogo && jogo.modo === "online") { jogo.vencedorPartida = 3 - m.v; jogo.pontos = [m.p[1], m.p[0]]; fimPartida(jogo); }
    } else if (m.k === "pronto") {
      prontoOutro = true;
      if (tela === "fim") status(t("on_quer_revanche"));
      if (Rede.anfitriao && prontoEu) comecar();
    } else if (m.k === "oculto") {
      outroOculto = !!m.v;
      ultimoEstado = performance.now();
      if (m.v && Rede.anfitriao) entRemota = { esq: false, dir: false, sp: false, bx: false, t: false, pc: entRemota.pc, tc: entRemota.tc, cc: entRemota.cc, dc: entRemota.dc, m: null };
    } else if (m.k === "tchau") {
      caiuConexao();
    }
  });
  Rede.ao("conectou", function() {
    clearTimeout(timerP2P);
    Poki.medir("online", "p2p", "complete");
    canalJogo = "u"; enviadosJogo = 0; recebidosJogo = 0;
    pararBusca();
    tela = "conectado";
    seq = 0; passos = 0; usados = { pc: 0, tc: 0, cc: 0 };
    cont.pc = cont.tc = cont.cc = cont.dc = 0;   // conexão nova: os dois lados começam a contar do zero
    entRemota = { esq: false, dir: false, sp: false, bx: false, t: false, pc: 0, tc: 0, cc: 0, dc: 0, m: null };
    status(t("on_conectando"));
    ola();
  });
  Rede.ao("caiu", function() { caiuConexao(); });
  setInterval(function() { if (Rede.conectado) Rede.enviar("r", { k: "vivo", n: recebidosJogo }); }, 1000);
  // v20: achou alguém e a conexão com ele começou: se não fechar em 15 s, desiste dessa pessoa (na partida rápida
  // procura outra). Os eventos online/p2p (start, complete, fail) mostram no painel onde a conexão para
  Rede.ao("etapa", function(nome) {
    if (nome === "entrou") { if (busca && !Rede.conectado) esperarResposta(Rede.codigo); return; }
    if (nome !== "conectando" || Rede.conectado) return;
    if (busca) busca.achou = true;
    Poki.medir("online", "p2p", "start");
    status(t("on_achou"));
    clearTimeout(timerP2P);
    timerP2P = setTimeout(function() { if (!Rede.conectado) falhaP2P("p2p-tempo"); }, 15000);
  });
  Rede.ao("erro", function(tipo) { if ((tipo === "p2p" || tipo === "rtc") && !Rede.conectado) falhaP2P(tipo); });
  // entrou numa sala: se o dono não responder em 12 s, a sala é evitada e conta como falha de conexão
  function esperarResposta(codigo) {
    clearTimeout(timerP2P);
    timerP2P = setTimeout(function() {
      if (Rede.conectado) return;
      Rede.evitar(codigo);
      falhaP2P("sem-resposta");
    }, 12000);
  }
  function falhaP2P(motivo) {
    clearTimeout(timerP2P);
    if (Rede.conectado) return;
    Poki.medir("online", "p2p", "fail");
    console.warn("online: conexão com o outro jogador falhou (" + motivo + ")");
    // quem criou a sala com código continua nela, esperando (o amigo pode tentar de novo com o mesmo código)
    if (tela === "sala" && Rede.anfitriao) { status(t("on_sala") + " (" + motivo + ")"); return; }
    Rede.sair();
    if (busca) {   // partida rápida: continua procurando outra pessoa
      busca.erro = motivo;
      busca.achou = false;
      clearTimeout(busca.tentar);
      busca.tentar = setTimeout(busca.tentarDeNovo, 1000);
      return;
    }
    if (tela === "inicio" || tela === "jogo" || tela === "fim") return;
    tela = "inicio";
    status(t("on_erro") + " (" + motivo + ")");
    mostrarBotoes("inicio");
  }

  function caiuConexao() {
    if (typeof ArteCenarios !== "undefined" && ArteCenarios.forcarVariacao) ArteCenarios.forcarVariacao(null);
    outroOculto = false;
    const estava = api.ativo || tela === "fim" || tela === "conectado";
    Rede.sair();
    api.ativo = false;
    tela = "inicio";
    if (!estava) return;
    if (estado === "jogo" || estado === "pausa") {
      entrada.ativa = false;
      Poki.jogando(false);
      Poki.medir("match", "online", "disconnect");
    }
    abrir(t("on_saiu"));
  }

  // ---------- fim da partida ----------
  // anfitrião: chamado por telas.js (aoTerminarPartida); convidado: quando chega o "fim"
  function fimPartida(j) {
    if (Rede.anfitriao) Rede.enviar("r", { k: "fim", v: j.vencedorPartida, p: j.pontos });
    entrada.ativa = false;
    Poki.jogando(false);
    const venceu = j.vencedorPartida === 1;
    const ganho = venceu ? 40 : 15;
    Progresso.ganharMoedas(ganho);
    Progresso.registrar("partidas", 1);
    salvar();
    Poki.medir("match", "online", venceu ? "complete" : "fail");
    tela = "fim";
    estado = "online";
    el("onTitulo").textContent = venceu ? t("on_venceu") : t("on_perdeu");
    el("onPlacar").textContent = j.pontos[0] + " – " + j.pontos[1];
    el("onPlacar").classList.remove("escondido");
    el("onGanho").innerHTML = Icone.html("moeda") + " +" + ganho;
    el("onGanho").classList.remove("escondido");
    status(prontoOutro ? t("on_quer_revanche") : "");
    mostrarBotoes("fim");
    mostrarTela("telaOnline");
    garantirDemo();
  }
  api.fimPartida = fimPartida;

  // ---------- tela ----------
  function status(txt) { const e = el("onStatus"); if (e) e.textContent = txt || ""; }
  function mostrarBotoes(qual) {
    el("onInicio").classList.toggle("escondido", qual !== "inicio");
    el("onFim").classList.toggle("escondido", qual !== "fim");
    el("onNinguem").classList.toggle("escondido", qual !== "ninguem");
    el("onLinhaCodigo").classList.add("escondido");
    el("onCancelar").classList.toggle("escondido", qual !== "esperando");
    el("onVoltar").classList.toggle("escondido", qual === "esperando");
    if (qual !== "fim") { el("onPlacar").classList.add("escondido"); el("onGanho").classList.add("escondido"); }
    if (qual !== "sala") el("onCodigo").classList.add("escondido");
  }
  function abrir(msg) {
    estado = "online";
    tela = "inicio";
    garantirDemo();
    el("onTitulo").textContent = t("modo_online");
    el("onInput").placeholder = t("on_codigo");
    status(msg || t("on_dica"));
    mostrarBotoes("inicio");
    atualizarTextos();
    mostrarTela("telaOnline");
  }
  api.abrir = function() { Eventos.botao("mode-online"); abrir(""); };

  // antes de procurar alguém: anúncio comum (o Poki decide se mostra) e a rede
  // v19.5: a partida rápida procura por até 1 minuto (tempo na tela, globo girando, dá para cancelar a qualquer hora).
  // Erro de rede não desiste na hora: tenta de novo a cada 3 s. Sem ninguém: "Tentar de novo" ou "Jogar contra o bot".
  const ESPERA_RAPIDA = 60;
  // v19.8: com pouca gente online, o botão "Jogar contra o bot" aparece já aos 12 s (a busca continua por trás)
  const BOT_DEPOIS = 12;
  let busca = null;
  function pararBusca() {
    if (busca) { clearInterval(busca.timer); clearTimeout(busca.tentar); busca = null; }
    el("onRoda").classList.add("escondido");
    el("onBotBusca").classList.add("escondido");
  }
  function buscarRapida() {
    pararBusca();
    tela = "procurando";
    const b = busca = { t0: performance.now(), timer: 0, tentar: 0, erro: "" };
    el("onRoda").classList.remove("escondido");
    function falta() { return Math.max(0, ESPERA_RAPIDA - Math.floor((performance.now() - b.t0) / 1000)); }
    function mostrar() {
      if (busca !== b || Rede.conectado) return;
      const f = falta();
      status((b.achou ? t("on_achou") : t("on_procurando")) + "  " + Math.floor(f / 60) + ":" + String(f % 60).padStart(2, "0"));
      if (ESPERA_RAPIDA - f >= BOT_DEPOIS && el("onBotBusca").classList.contains("escondido")) {
        el("onBotBusca").classList.remove("escondido");
        Poki.medir("online", "quick-bot", "visible");
      }
      if (f > 0) return;
      pararBusca();
      Rede.sair();
      tela = "inicio";
      status(t("on_ninguem") + (b.erro ? " (" + b.erro + ")" : ""));
      mostrarBotoes("ninguem");
      Poki.medir("online", "quick", b.erro ? "error" : "timeout");
    }
    function tentar() {
      if (busca !== b) return;
      Rede.rapida().then(function() {
        // v20.1: entrou na sala de alguém e ninguém respondeu em 12 s (sala velha de quem já saiu): evita e procura outra
        if (busca === b && !Rede.anfitriao && !Rede.conectado) esperarResposta(Rede.codigo);
      }).catch(function(e) {
        if (busca !== b) return;
        b.erro = String(e && e.message || e && e.type || e || "erro").slice(0, 30);
        console.warn("online: partida rápida falhou (" + b.erro + "), tentando de novo");
        Rede.sair();
        if (falta() > 3) b.tentar = setTimeout(tentar, 3000);
      });
    }
    b.tentarDeNovo = tentar;
    b.timer = setInterval(mostrar, 250);
    mostrar();
    tentar();
  }

  function procurar(como, codigo) {
    if (ocupado) return;
    ocupado = true;
    mostrarBotoes("esperando");
    status(t("on_conectando"));
    Poki.intervalo().then(function() {
      ocupado = false;
      if (como === "rapida") { buscarRapida(); return; }
      tela = "procurando";
      const p = como === "rapida" ? Rede.rapida() : como === "criar" ? Rede.criar(false) : Rede.entrar(codigo);
      return p.then(function(r) {
        if (tela !== "procurando") return;
        if (como === "entrar" && !r) { status(t("on_nao_achou")); mostrarBotoes("inicio"); tela = "inicio"; Rede.sair(); return; }
        if (como === "entrar" && !Rede.conectado) esperarResposta(Rede.codigo);
        if (Rede.conectado) return;
        if (Rede.anfitriao) {
          if (como === "criar") {
            tela = "sala";
            el("onCodigo").textContent = String(Rede.codigo).toUpperCase();
            el("onCodigo").classList.remove("escondido");
            status(t("on_sala"));
          } else status(t("on_procurando"));
        } else status(t("on_conectando"));
      });
    }).catch(function(e) {
      ocupado = false;
      tela = "inicio";
      Rede.sair();
      // código que não existe: o servidor responde com erro "lobby-not-found" (não é falha de rede)
      const cod = String(e && (e.code || e.message) || e || "erro");
      if (/not.?found/i.test(cod)) status(t("on_nao_achou"));
      else status(t("on_erro") + " (" + cod.slice(0, 30) + ")");
      mostrarBotoes("inicio");
    });
  }

  api.acoes = {
    modoOnline: function() { api.abrir(); },
    onRapida: function() { Eventos.botao("online-quick"); procurar("rapida"); },
    onCriar: function() { Eventos.botao("online-create"); procurar("criar"); },
    onEntrar: function() {
      el("onLinhaCodigo").classList.remove("escondido");
      el("onInicio").classList.add("escondido");
      const i = el("onInput"); i.value = ""; setTimeout(function() { i.focus(); }, 50);
    },
    onOk: function() {
      const c = el("onInput").value.trim();
      if (!c) return;
      Eventos.botao("online-join");
      procurar("entrar", c);
    },
    onCancelar: function() { pararBusca(); Rede.sair(); tela = "inicio"; status(t("on_dica")); mostrarBotoes("inicio"); },
    onRevanche: function() {
      if (ocupado || !Rede.conectado) { if (!Rede.conectado) abrir(t("on_saiu")); return; }
      ocupado = true;
      status(t("on_esperando"));
      el("onFim").classList.add("escondido");
      Poki.intervalo().then(function() {
        ocupado = false;
        prontoEu = true;
        Rede.enviar("r", { k: "pronto" });
        if (Rede.anfitriao && prontoOutro) comecar();
      });
    },
    onVoltar: function() {
      // v19.9: digitando o código, "Voltar" volta para os botões do online (antes ia direto para o menu)
      if (!el("onLinhaCodigo").classList.contains("escondido")) { mostrarBotoes("inicio"); status(t("on_dica")); return; }
      pararBusca(); sair(); irParaMenu("");
    },
    onBot: function() { pararBusca(); sair(); Eventos.botao("online-bot"); comecarPartida("bot"); }
  };

  document.addEventListener("visibilitychange", function() {
    if (api.ativo && Rede.conectado) Rede.enviar("r", { k: "oculto", v: document.hidden });
  });

  function sair() {
    if (typeof ArteCenarios !== "undefined" && ArteCenarios.forcarVariacao) ArteCenarios.forcarVariacao(null);
    if (Rede.conectado) Rede.enviar("r", { k: "tchau" });
    Rede.sair();
    api.ativo = false;
    tela = "inicio";
  }
  api.sair = sair;

  // o código da sala só tem letras e números
  document.addEventListener("keydown", function(e) {
    if (estado === "online" && e.key === "Enter" && document.activeElement === el("onInput")) api.acoes.onOk();
  });

  return api;
})();
