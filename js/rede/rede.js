"use strict";

// =========================
// REDE (v19): conexão entre dois aparelhos para o modo online.
// - Usa a Poki Networking Library (js/rede/netlib.js, WebRTC P2P; sala, sinalização e TURN de graça no servidor do Poki).
//   Só é baixada quando a pessoa abre o online (não pesa na abertura do jogo).
// - Com ?rede=teste na URL usa um "cabo" local (BroadcastChannel entre duas abas do mesmo navegador) para testar sem internet.
// - Uma sala tem 2 pessoas: quem cria é o anfitrião (roda a partida); quem entra é o convidado (manda os controles e desenha).
// API: Rede.criar(publica) -> Promise(código) | Rede.entrar(código) -> Promise(true/false) | Rede.rapida() -> Promise(código)
//      Rede.enviar(canal, obj) (canal "r" confiável, "u" rápido, pode perder) | Rede.sair()
//      Rede.ao(evento, fn): "conectou", "msg"(canal, obj), "caiu", "erro"(tipo)
//      Rede.anfitriao, Rede.conectado, Rede.codigo, Rede.ping (ms)
// =========================

const Rede = (function() {
  const VERSAO = 1;              // muda quando o protocolo do online mudar (versões diferentes não se encontram)
  const ouvintes = {};
  let net = null, teste = null, par = null;
  const api = { anfitriao: false, conectado: false, codigo: "", ping: 0 };

  function emitir(ev) {
    const args = Array.prototype.slice.call(arguments, 1);
    (ouvintes[ev] || []).forEach(function(fn) { try { fn.apply(null, args); } catch (e) { console.error(e); } });
  }
  api.ao = function(ev, fn) { (ouvintes[ev] = ouvintes[ev] || []).push(fn); };

  function modoTeste() { return /[?&]rede=teste/.test(location.search); }

  // ---------- cabo local de teste (duas abas) ----------
  function Cabo() {
    const id = Math.random().toString(36).slice(2, 8);
    const bc = new BroadcastChannel("cbd-rede");
    const c = { id: id, sala: "", outro: "" };
    bc.onmessage = function(e) {
      const m = e.data;
      if (m.sala !== c.sala && m.tipo !== "procura" && m.tipo !== "anuncio" && !(m.tipo === "aceito" && m.para === id)) return;
      if (m.tipo === "procura" && c.sala && api.anfitriao && !c.outro && (m.sala === c.sala || (m.sala === "*" && c.publica))) {
        c.outro = m.de;
        bc.postMessage({ tipo: "aceito", sala: c.sala, de: id, para: m.de });
        conectou();
      } else if (m.tipo === "aceito" && m.para === id) {
        c.sala = m.sala; c.outro = m.de; api.codigo = m.sala;
        if (c.esperando) { c.esperando(true); c.esperando = null; }
        conectou();
      } else if (m.tipo === "dado" && m.de === c.outro) {
        // simula perda no canal rápido (2%; com &perda=N na URL, N% — 100 = rede que bloqueia o canal rápido)
        const pu = /[?&]perda=(\d+)/.exec(location.search), perda = pu ? +pu[1] / 100 : 0.02;
        if (m.canal === "u" && Math.random() < perda) return;
        setTimeout(function() { receber(m.canal, m.obj); }, 30 + Math.random() * 20);   // simula atraso
      } else if (m.tipo === "anuncio" && c.publica && api.anfitriao && !c.outro && m.de < id) {
        // duas salas públicas esperando (igual à vigia da netlib): a de id maior sai e entra na outra
        c.publica = false; api.anfitriao = false;
        c.sala = m.sala;
        c.esperando = function() {};
        bc.postMessage({ tipo: "procura", sala: m.sala, de: id });
      } else if (m.tipo === "saiu" && m.de === c.outro) {
        caiu();
      }
    };
    c.criar = function(publica) {
      c.sala = String(1000 + Math.floor(Math.random() * 9000)); c.publica = publica;
      if (publica) {
        const anunciar = setInterval(function() {
          if (!c.publica || c.outro || !api.anfitriao) { clearInterval(anunciar); return; }
          bc.postMessage({ tipo: "anuncio", sala: c.sala, de: id });
        }, 1000);
      }
      return Promise.resolve(c.sala);
    };
    c.entrar = function(sala) {
      c.sala = sala === "*" ? "" : sala;
      return new Promise(function(ok) {
        c.esperando = ok;
        bc.postMessage({ tipo: "procura", sala: sala, de: id });
        setTimeout(function() { if (c.esperando) bc.postMessage({ tipo: "procura", sala: sala, de: id }); }, 700);
        setTimeout(function() { if (c.esperando) { c.esperando(false); c.esperando = null; } }, 1500);
      });
    };
    c.enviar = function(canal, obj) { bc.postMessage({ tipo: "dado", sala: c.sala, de: id, canal: canal, obj: obj }); };
    c.sair = function() { bc.postMessage({ tipo: "saiu", sala: c.sala, de: id }); c.sala = ""; c.outro = ""; };
    return c;
  }

  // ---------- Poki netlib ----------
  function abrirNet() {
    if (net) return Promise.resolve(net);
    return carregarScript("js/rede/netlib.js").then(function() {
      return new Promise(function(ok, falhaBruta) {
        net = new window.netlib.Network(CONFIG.idRede);
        let pronto = false;
        // v19.5: se não ficou pronta, a próxima tentativa começa do zero (antes reaproveitava a conexão quebrada)
        const falha = function(m) { if (pronto) return; try { net.close(); } catch (e) {} net = null; falhaBruta(m); };
        net.on("ready", function() { pronto = true; ok(net); });
        net.on("failed", function() { falha("falhou"); emitir("erro", "falhou"); });
        net.on("signalingerror", function(e) { falha("servidor" + (e && e.code ? "-" + e.code : e && e.type ? "-" + e.type : "")); });
        net.on("connected", function(p) {
          if (par) return;
          par = p; conectou();
        });
        // v20: etapas da conexão com o outro aparelho (para a tela e para os eventos): "conectando" e erro "p2p" quando
        // a conexão direta/relé não fecha (antes a tela ficava em "Conectando..." para sempre)
        net.on("connecting", function() { if (!par) emitir("etapa", "conectando"); });
        net.on("disconnected", function(p) { if (par && p.id === par.id) caiu(); else if (!par) emitir("erro", "p2p"); });
        net.on("rtcerror", function() { if (!par) emitir("erro", "rtc"); });
        net.on("message", function(p, canal, dado) {
          if (!par || p.id !== par.id) return;
          let obj;
          try { obj = JSON.parse(dado); } catch (e) { return; }
          receber(canal === "unreliable" ? "u" : "r", obj);
        });
        setTimeout(function() { falha("tempo"); }, 10000);
      });
    });
  }

  function conectou() {
    api.conectado = true;
    emitir("conectou");
  }
  function caiu() {
    if (!api.conectado) return;
    api.conectado = false; par = null;
    emitir("caiu");
  }

  // mede o ping com uma mensagem própria (não depende da biblioteca)
  let tPing = 0;
  function receber(canal, obj) {
    if (obj && obj.k === "pi") { enviarBruto("r", { k: "po", t: obj.t }); return; }
    if (obj && obj.k === "po") { api.ping = Math.round(api.ping ? api.ping * 0.7 + (performance.now() - obj.t) * 0.3 : performance.now() - obj.t); return; }
    emitir("msg", canal, obj);
  }
  setInterval(function() {
    if (api.conectado) enviarBruto("r", { k: "pi", t: performance.now() });
  }, 1000);

  function enviarBruto(canal, obj) {
    if (teste) { teste.enviar(canal, obj); return; }
    if (net && par) {
      try { net.send(canal === "u" ? "unreliable" : "reliable", par.id, JSON.stringify(obj)); } catch (e) {}
    }
  }

  api.enviar = function(canal, obj) { if (api.conectado) enviarBruto(canal, obj); };

  api.criar = function(publica) {
    api.anfitriao = true;
    if (modoTeste()) {
      teste = teste || Cabo();
      return teste.criar(publica).then(function(c) { api.codigo = c; return c; });
    }
    return abrirNet().then(function(n) {
      return n.create({ maxPlayers: 2, public: !!publica, codeFormat: "short", customData: { v: VERSAO } });
    }).then(function(c) { api.codigo = c; return c; });
  };

  api.entrar = function(codigo) {
    api.anfitriao = false;
    if (modoTeste()) {
      teste = teste || Cabo();
      return teste.entrar(codigo);
    }
    return abrirNet().then(function(n) { return n.join(String(codigo).trim().toLowerCase()); })
      .then(function(info) { if (info) api.codigo = info.code; return !!info; });
  };

  // partida rápida: entra numa sala pública da mesma versão que esteja esperando; se não tiver, cria uma
  api.rapida = function() {
    if (modoTeste()) {
      teste = teste || Cabo();
      return teste.entrar("*").then(function(ok) {
        if (ok) { api.anfitriao = false; return api.codigo; }
        return api.criar(true);
      });
    }
    return abrirNet().then(function(n) { return n.list(); }).then(function(lista) {
      const livres = salasLivres(lista);
      if (!livres.length) return api.criar(true).then(function(c) { vigiar(); return c; });
      api.anfitriao = false;
      return net.join(livres[0].code).then(function(info) {
        if (info) { api.codigo = info.code; return info.code; }
        return api.criar(true).then(function(c) { vigiar(); return c; });
      });
    });
  };
  function salasLivres(lista) {
    return (lista || []).filter(function(l) {
      return l.public && !l.hasPassword && l.playerCount === 1 && l.customData && l.customData.v === VERSAO && l.code !== api.codigo;
    }).sort(function(a, b) { return (a.latency || 999) - (b.latency || 999); });
  }
  // duas pessoas procurando ao mesmo tempo criavam duas salas e esperavam para sempre: quem espera numa sala pública
  // olha de 3 em 3 s se tem outra sala esperando, mais antiga que a sua; se tiver, sai da sua e entra nela
  let vigia = null;
  function vigiar() {
    pararVigia();
    vigia = setInterval(function() {
      if (api.conectado || !api.anfitriao || !net) { pararVigia(); return; }
      const minha = net.currentLobbyInfo;
      net.list().then(function(lista) {
        if (api.conectado || !api.anfitriao) return;
        const outra = salasLivres(lista).filter(function(l) {
          return !minha || !minha.createdAt || l.createdAt < minha.createdAt || (l.createdAt === minha.createdAt && l.code < minha.code);
        })[0];
        if (!outra) return;
        pararVigia();
        net.leave().then(function() { return net.join(outra.code); }).then(function(info) {
          if (info) { api.anfitriao = false; api.codigo = info.code; }
          else api.criar(true).then(vigiar);
        }).catch(function() { api.criar(true).then(vigiar); });
      }).catch(function() {});
    }, 3000);
  }
  function pararVigia() { if (vigia) { clearInterval(vigia); vigia = null; } }

  api.sair = function() {
    pararVigia();
    if (teste) teste.sair();
    if (net) { try { net.leave(); } catch (e) {} }
    par = null;
    api.conectado = false; api.codigo = ""; api.ping = 0;
  };

  return api;
})();
