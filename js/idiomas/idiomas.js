"use strict";

// =========================
// IDIOMAS
// Português + inglês + os 10 idiomas mais fortes no público do Poki (v20.7: + vietnamita, ucraniano e japonês).
// Cada idioma fica em js/idiomas/textos/xx.js (TEXTOS.xx = { chave: "texto" }) e só é baixado quem for usar:
// o idioma escolhido + o inglês (reserva para qualquer texto que faltar).
// No código: t("jogar"), t("pontos", 120) -> "Pontos: 120" ({0}, {1}... são trocados pelos valores).
// No HTML: <button data-t="jogar"></button> é preenchido por traduzirDom().
// =========================

const IDIOMAS = [
  { id: "pt", nome: "Português" },
  { id: "en", nome: "English" },
  { id: "es", nome: "Español" },
  { id: "fr", nome: "Français" },
  { id: "de", nome: "Deutsch" },
  { id: "it", nome: "Italiano" },
  { id: "nl", nome: "Nederlands" },
  { id: "pl", nome: "Polski" },
  { id: "tr", nome: "Türkçe" },
  { id: "ru", nome: "Русский" },
  { id: "ro", nome: "Română" },
  { id: "id", nome: "Bahasa Indonesia" },
  { id: "vi", nome: "Tiếng Việt" },
  { id: "uk", nome: "Українська" },
  { id: "ja", nome: "日本語" }
];

const TEXTOS = {};      // preenchido por js/idiomas/textos/xx.js
let IDIOMA = "en";

function idiomaValido(id) {
  return IDIOMAS.some(function(i) { return i.id === id; });
}

// Escolhido antes pela pessoa > idioma do navegador > inglês
function detectarIdioma(salvo) {
  if (idiomaValido(salvo)) return salvo;
  const lista = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
  for (let i = 0; i < lista.length; i++) {
    const id = String(lista[i] || "").slice(0, 2).toLowerCase();
    if (idiomaValido(id)) return id;
  }
  return "en";
}

// Baixa o idioma (e o inglês de reserva). Se falhar, o jogo segue em inglês.
function carregarIdioma(id) {
  const pedidos = [carregarScript("js/idiomas/textos/en.js")];
  if (id !== "en") pedidos.push(carregarScript("js/idiomas/textos/" + id + ".js"));
  return Promise.all(pedidos).then(function() {
    IDIOMA = TEXTOS[id] ? id : "en";
  }, function() {
    IDIOMA = TEXTOS[id] ? id : "en";
  });
}

function t(chave) {
  const d = TEXTOS[IDIOMA];
  let s = d && d[chave] !== undefined ? d[chave] : TEXTOS.en && TEXTOS.en[chave] !== undefined ? TEXTOS.en[chave] : chave;
  for (let i = 1; i < arguments.length; i++) s = s.split("{" + (i - 1) + "}").join(arguments[i]);
  return s;
}

// Preenche todo elemento com data-t="chave"
function traduzirDom(raiz) {
  (raiz || document).querySelectorAll("[data-t]").forEach(function(e) { e.textContent = t(e.dataset.t); });
  document.documentElement.lang = IDIOMA === "pt" ? "pt-BR" : IDIOMA;
  document.title = t("titulo");
}
