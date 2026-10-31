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
    esteira: 0            // segundos até o próximo robô grátis
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
    stats: { toques: 0, batalhas: 0, vitorias: 0, juncoes: 0, tempo: 0 },
    mudo: false, vibrar: true, idioma: "",
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
}
function vagasGrade() { return CONFIG.slotsGrade + (nivelNo("grade") ? 6 : 0); }
function vagasTime() { return CONFIG.slotsTime + (nivelNo("sexto") ? 1 : 0); }
function nivelNo(id) { return save.arvore[id] || 0; }
function nivelUp(id) { return save.p.up[id] || 0; }
