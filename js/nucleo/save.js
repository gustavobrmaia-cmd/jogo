"use strict";

// =========================
// SAVE (localStorage). "Da partida" some no renascimento; "permanente" fica (compêndio, árvore, PH, opções).
// =========================
function partidaNova() {
  return {
    moedas: 0,
    grade: [],            // nível do robô em cada vaga (0 = vazia)
    time: [],             // robôs que apertam o botão
    criados: 0,           // robôs criados na partida (o preço sobe com eles)
    up: {},               // nível de cada upgrade
    maxTier: 1,           // maior robô da partida (PH do renascimento)
    pegos: [],
    tr: { grade: [], time: [] },
    encomendas: [],       // pedidos ativos (v9, encomendas.js)
    desafio: "",          // desafio escolhido ao renascer (v9)
    desafioFeito: false,
    sabotagem: 0,         // até quando a fábrica fica danificada pelo chefão (Date.now, v9)   // traço de cada vaga (tracos.js), mesmo tamanho de grade/time            // níveis de robô que já deram pontos nesta partida (renasceu: zera e dá de novo)
    esteira: 11           // segundos acumulados da esteira (v10: começa perto, o 1º robô grátis cai em ~4 s)
  };
}
function saveNovo() {
  return {
    versao: 1,
    p: partidaNova(),
    ph: 0,                // pontos de habilidade (gastos só ao renascer)
    arvore: {},           // nível de cada nó
    robosVistos: [],      // compêndio (níveis já descobertos)
    monstrosVistos: [],   // compêndio (ids)
    hordasVencidas: 0,    // maior horda vencida + 1 (libera a seguinte); permanente
    renascimentos: 0,
    stats: { toques: 0, batalhas: 0, vitorias: 0, juncoes: 0, tempo: 0, criados: 0, ouros: 0, invasores: 0 },
    missao: null,
    skin: "classico", skinsVistas: ["classico"],   // visual do botão (v11, skins.js)
    torre: { andar: 1, recorde: 0 },   // Torre Infinita (v9): andar atual e maior andar vencido
    equip: { itens: [], vagas: [] },   // equipamentos (v9): inventário e o que está em cada vaga do time (índice do item)
    encomendasFeitas: 0,         // missão atual {n, tipo, alvo, id?, ph?, base} (missoes.js)
    mudo: false, semMusica: false, vibrar: true, idioma: "",
    ultimo: Date.now(),   // ganhos offline
    tutorial: 0           // 0 toque no botão, 1 criar, 2 juntar, 3 time, 4 pronto
  };
}
let save = saveNovo();

function carregarSave() {
  try {
    const s = JSON.parse(localStorage.getItem(CONFIG.chaveSave) || "null");
    if (s && s.versao === 1) {
      const base = saveNovo();
      for (const k in base) if (s[k] !== undefined && typeof s[k] === typeof base[k]) base[k] = s[k];
      base.p = Object.assign(partidaNova(), s.p || {});
      // save antigo: a partida em andamento já "pegou" os níveis até o maior (senão daria pontos de graça agora)
      if (!s.p || !Array.isArray(s.p.pegos)) { base.p.pegos = []; for (let n = 1; n <= base.p.maxTier; n++) base.p.pegos.push(n); }
      base.stats = Object.assign(saveNovo().stats, base.stats);
      if (!base.torre || typeof base.torre.andar !== "number") base.torre = { andar: 1, recorde: 0 };
      if (!Array.isArray(base.skinsVistas)) base.skinsVistas = ["classico"];
      if (!base.equip || !Array.isArray(base.equip.itens)) base.equip = { itens: [], vagas: [] };
      save = base;
    }
  } catch (e) { /* sem armazenamento: segue com o save novo */ }
  arrumarVagas();
}
let salvarAgendado = 0;
function salvar() {
  save.ultimo = Date.now();
  try { localStorage.setItem(CONFIG.chaveSave, JSON.stringify(save)); } catch (e) { /* cheio ou bloqueado */ }
}
// vagas do tamanho certo (a árvore pode aumentar a grade e o time)
function arrumarVagas() {
  const g = vagasGrade(), t = vagasTime(), p = save.p;
  while (p.grade.length < g) p.grade.push(0);
  while (p.time.length < t) p.time.push(0);
  if (!p.tr || !Array.isArray(p.tr.grade)) p.tr = { grade: [], time: [] };
  while (p.tr.grade.length < p.grade.length) p.tr.grade.push("");
  while (p.tr.time.length < p.time.length) p.tr.time.push("");
}
function vagasGrade() { return CONFIG.slotsGrade + (nivelNo("grade") ? 6 : 0) + (nivelNo("grade2") ? 6 : 0); }
function vagasTime() { return Math.max(1, CONFIG.slotsTime + (nivelNo("sexto") ? 1 : 0) + (nivelNo("setimo") ? 1 : 0) - (save.p && save.p.desafio === "time3" ? 2 : 0)); }
function nivelNo(id) { return save.arvore[id] || 0; }
function nivelUp(id) { return save.p.up[id] || 0; }
