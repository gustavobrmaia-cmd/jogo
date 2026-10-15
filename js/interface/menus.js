"use strict";

// =========================
// MENUS DE PROGRESSO E OPÇÕES
// Opções (idioma, som, controles), troca de teclas, missões/semana/conquistas e skins (guarda-roupa + loja).
// As listas são montadas em HTML (leve e acessível); as bolinhas das skins são desenhadas em canvas pequenos.
// =========================

let abaMissoes = "missoes";
let abaSkins = "corpo";
let skinEmFoco = null;

function abrirOpcoes() {
  estado = "opcoes";
  atualizarTextos();
  mostrarTela("telaOpcoes");
}

// ---------- troca de teclas ----------
function abrirControles() {
  estado = "controles";
  montarGradeTeclas();
  mostrarTela("telaControles");
}

function teclasAtuais() {
  return JSON.parse(JSON.stringify(entrada.teclas()));
}

function montarGradeTeclas() {
  const g = el("gradeTeclas");
  g.innerHTML = "";
  const tk = teclasAtuais();
  const cab = ["", t("jogador_n", 1), t("jogador_n", 2)];
  cab.forEach(function(c) { const d = document.createElement("div"); d.className = "cab"; d.textContent = c; g.appendChild(d); });
  ACOES.forEach(function(a) {
    const nome = document.createElement("div");
    nome.className = "acao";
    nome.textContent = t("acao_" + a);
    g.appendChild(nome);
    [1, 2].forEach(function(j) {
      const cel = document.createElement("div");
      cel.className = "teclas";
      [0, 1].forEach(function(i) {
        const b = document.createElement("button");
        b.className = "tecla";
        b.textContent = nomeTecla(tk[j][a][i]);
        b.addEventListener("click", function() {
          som("clique");
          b.textContent = "…";
          b.classList.add("esperando");
          entrada.esperarTecla(function(code) {
            if (code) trocarTecla(j, a, i, code);
            montarGradeTeclas();
          });
        });
        cel.appendChild(b);
      });
      g.appendChild(cel);
    });
  });
}

// põe a tecla no lugar e tira de onde ela estava (uma tecla só faz uma coisa)
function trocarTecla(j, a, i, code) {
  const tk = teclasAtuais();
  [1, 2].forEach(function(jj) {
    ACOES.forEach(function(aa) {
      tk[jj][aa] = tk[jj][aa].map(function(c) { return c === code ? null : c; });
    });
  });
  while (tk[j][a].length <= i) tk[j][a].push(null);
  tk[j][a][i] = code;
  save.teclas = tk;
  salvar();
  entrada.refazerMapa();
  Eventos.botao("rebind");
}

function teclasDeFabrica() {
  save.teclas = null;
  salvar();
  entrada.refazerMapa();
  montarGradeTeclas();
}

// ---------- missões, semana e conquistas ----------
function abrirMissoes(aba) {
  save.stats.viuMissoes = 1;   // v18: daqui em diante os prêmios esperam o resgate no menu (progresso.js)
  estado = "missoes";
  abaMissoes = aba || abaMissoes;
  Progresso.preparar();
  montarMissoes();
  mostrarTela("telaMissoes");
}

function cartao(titulo, prog, meta, moedas, estadoCartao, aoClicar, extra) {
  const c = document.createElement("div");
  c.className = "cartao" + (estadoCartao === "pronto" ? " pronto" : estadoCartao === "feito" ? " feito" : "");
  const txt = document.createElement("div");
  txt.className = "texto";
  const h = document.createElement("div"); h.className = "titulo"; h.textContent = titulo; txt.appendChild(h);
  if (extra) { const e = document.createElement("div"); e.className = "sub"; e.textContent = extra; txt.appendChild(e); }
  const barra = document.createElement("div"); barra.className = "barra";
  const enche = document.createElement("div"); enche.style.width = Math.min(100, 100 * prog / meta) + "%"; barra.appendChild(enche);
  const num = document.createElement("span"); num.textContent = formatar(Math.min(prog, meta)) + " / " + formatar(meta); barra.appendChild(num);
  txt.appendChild(barra);
  c.appendChild(txt);
  const lado = document.createElement("div"); lado.className = "premio";
  const m = document.createElement("div"); m.className = "valor"; m.textContent = moedas; lado.appendChild(m);
  if (estadoCartao === "pronto") {
    const b = document.createElement("button"); b.className = "premiado pequeno"; b.textContent = t("resgatar");
    b.addEventListener("click", function() { aoClicar(); });
    lado.appendChild(b);
  } else if (estadoCartao === "feito") {
    const ok = document.createElement("div"); ok.className = "ok"; ok.textContent = "✓"; lado.appendChild(ok);
  } else if (estadoCartao === "trocar") {
    const b = document.createElement("button"); b.className = "pequeno"; b.textContent = "↻ " + t("trocar");
    b.addEventListener("click", function() { aoClicar(); });
    lado.appendChild(b);
  }
  c.appendChild(lado);
  return c;
}

function formatar(n) { return n >= 10000 ? Math.round(n / 1000) + "k" : String(Math.round(n)); }

function montarMissoes() {
  document.querySelectorAll("#telaMissoes .abas button").forEach(function(b) { b.classList.toggle("ativo", b.dataset.aba === abaMissoes); });
  const lista = el("listaMissoes");
  lista.innerHTML = "";
  if (abaMissoes === "missoes") {
    const podeTrocar = save.trocaDia !== Math.floor(Date.now() / 86400000);
    save.missoes.forEach(function(m, i) {
      const titulo = t("mi_" + m.id, m.meta, m.cenario ? t("c_" + m.cenario) : "");
      const est = m.feito ? "pronto" : podeTrocar ? "trocar" : "";
      lista.appendChild(cartao(titulo, m.prog, m.meta, "🪙 " + m.moedas, est, function() {
        if (m.feito) { Progresso.resgatarMissao(i); som("pegar"); }
        else Progresso.trocarMissao(i);
        montarMissoes(); atualizarMenuProgresso();
      }));
    });
    const p = document.createElement("p"); p.className = "info pequena"; p.textContent = t("missoes_explica"); lista.appendChild(p);
  } else if (abaMissoes === "semana") {
    const fim = (Progresso.semanaAtual() + 1) * 7 - 3;   // próxima segunda (em dias desde 1970)
    const resta = fim * 86400000 - Date.now();
    const p = document.createElement("p"); p.className = "info pequena";
    p.textContent = t("semana_termina", Math.floor(resta / 86400000), Math.floor(resta / 3600000) % 24);
    lista.appendChild(p);
    save.semana.desafios.forEach(function(d, i) {
      const est = d.resgatado ? "feito" : d.feito ? "pronto" : "";
      lista.appendChild(cartao(t("de_" + d.id, d.meta), d.prog, d.meta, "🪙 " + d.moedas, est, function() {
        Progresso.resgatarDesafio(i); som("pegar"); montarMissoes(); atualizarMenuProgresso();
      }));
    });
    // prêmio da semana: skin exclusiva
    const feitos = save.semana.desafios.filter(function(d) { return d.feito; }).length;
    const pr = save.semana.premio;
    const c = cartao(t("premio_semana"), feitos, 4, "", save.semana.premioResgatado ? "feito" : Progresso.semanaCompleta() ? "pronto" : "",
      function() { Progresso.resgatarPremioSemana(); som("carta"); montarMissoes(); atualizarMenuProgresso(); }, t("sk_" + pr));
    c.classList.add("especial");
    const cv = document.createElement("canvas"); cv.width = cv.height = 96; cv.className = "mini";
    desenharMiniSkin(cv, pr);
    c.insertBefore(cv, c.firstChild);
    lista.appendChild(c);
  } else {
    CONQUISTAS.forEach(function(cq) {
      const st = save.conquistas[cq.id];
      const est = st === "resgatada" ? "feito" : st === "feita" ? "pronto" : "";
      const premio = "🪙 " + cq.moedas + (cq.skin ? " + " + t("sk_" + cq.skin) : "");
      lista.appendChild(cartao(t("co_" + cq.id), Progresso.valorStat(cq.stat), cq.meta, premio, est, function() {
        Progresso.resgatarConquista(cq.id); som("carta"); montarMissoes(); atualizarMenuProgresso();
      }, t("cod_" + cq.id, cq.meta)));
    });
  }
  atualizarMenuProgresso();
}

// ---------- skins ----------
function abrirSkins(aba) {
  estado = "skins";
  abaSkins = aba || abaSkins;
  Progresso.preparar();
  montarSkins();
  mostrarTela("telaSkins");
}

function corDoJogador() { return CORES_BOLINHAS[0]; }

function desenharMiniSkin(cv, id) {
  const g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  const s = SKIN[id];
  const corpo = s.tipo === "corpo" ? id : save.skinCorpo;
  const ace = s.tipo === "acessorio" ? id : (s.tipo === "corpo" ? "nenhum" : save.skinAcessorio);
  const r = cv.width * 0.3;
  const cor = SKIN[corpo].cor !== "jogador" ? SKIN[corpo].cor : corDoJogador();
  if (typeof ArteSkins !== "undefined") ArteSkins.miniatura(g, corpo, ace, cor, cv.width / 2, cv.height * 0.56, r, 0);
  else { g.fillStyle = cor; g.beginPath(); g.arc(cv.width / 2, cv.height * 0.56, r, 0, 7); g.fill(); }
}

function montarSkins() {
  document.querySelectorAll("#telaSkins .abas button").forEach(function(b) { b.classList.toggle("ativo", b.dataset.aba === abaSkins); });
  const grade = el("gradeSkins");
  grade.innerHTML = "";
  const lista = abaSkins === "corpo" ? SKINS_CORPO : SKINS_ACESSORIO;
  lista.forEach(function(s) {
    const c = document.createElement("button");
    const tem = Progresso.temSkin(s.id);
    const usando = save.skinCorpo === s.id || save.skinAcessorio === s.id;
    c.className = "skin r" + s.raridade + (usando ? " usando" : "") + (tem ? "" : " bloqueada");
    const cv = document.createElement("canvas"); cv.width = cv.height = 110;
    desenharMiniSkin(cv, s.id);
    c.appendChild(cv);
    const nome = document.createElement("div"); nome.className = "nome"; nome.textContent = t("sk_" + s.id); c.appendChild(nome);
    const st = document.createElement("div"); st.className = "status";
    if (usando) st.textContent = t("equipado");
    else if (tem) st.textContent = t("equipar");
    else if (s.preco) st.textContent = "🪙 " + s.preco;
    else if (s.conquista) st.textContent = "🏆 " + t("co_" + s.conquista);
    else if (s.semanal) st.textContent = "⭐ " + t("so_semanal");
    c.appendChild(st);
    c.addEventListener("click", function() {
      skinEmFoco = s.id;
      if (tem) { Progresso.equipar(s.id); som("clique"); Poki.medir("skin", s.id, "equip"); }
      else if (s.preco && save.moedas >= s.preco) { if (Progresso.comprarSkin(s.id)) { Progresso.equipar(s.id); som("carta"); } }
      else som("acerto");
      montarSkins();
      atualizarMenuProgresso();
    });
    grade.appendChild(c);
  });
  el("previaNome").textContent = t("sk_" + save.skinCorpo) + (save.skinAcessorio !== "nenhum" ? " + " + t("sk_" + save.skinAcessorio) : "");
  atualizarMenuProgresso();
}

// prévia grande animada (chamada pelo loop enquanto a tela de skins está aberta)
function desenharPreviaSkin(tempo) {
  const cv = el("previaSkin");
  const g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  const corpo = save.skinCorpo, ace = save.skinAcessorio;
  const cor = SKIN[corpo].cor !== "jogador" ? SKIN[corpo].cor : corDoJogador();
  const y = cv.height * 0.56 + Math.sin(tempo * 2.2) * 6;
  if (typeof ArteBolinha !== "undefined") ArteBolinha.sombra(g, cv.width / 2, cv.height * 0.9, 72, 40 - Math.sin(tempo * 2.2) * 6);
  if (typeof ArteSkins !== "undefined") ArteSkins.miniatura(g, corpo, ace, cor, cv.width / 2, y, 80, tempo);
  else { g.fillStyle = cor; g.beginPath(); g.arc(cv.width / 2, y, 80, 0, 7); g.fill(); }
}

// abas (data-aba) das duas telas
document.querySelectorAll("#telaMissoes .abas button").forEach(function(b) {
  b.addEventListener("click", function() { som("clique"); abaMissoes = b.dataset.aba; montarMissoes(); });
});
document.querySelectorAll("#telaSkins .abas button").forEach(function(b) {
  b.addEventListener("click", function() { som("clique"); abaSkins = b.dataset.aba; montarSkins(); });
});
