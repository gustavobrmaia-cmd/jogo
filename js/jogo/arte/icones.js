"use strict";

// =========================
// ÍCONES (v19): substituem os emojis em todo o jogo (canvas e HTML).
// Contrato (não mudar os nomes nem as funções; a arte de cada ícone pode mudar à vontade):
//   Icone.desenhar(ctx, nome, x, y, tam)  -> desenha centrado em (x, y), com tam px de altura
//   Icone.html(nome, classe)              -> string "<i class='ico ...'>" com o desenho (usar em innerHTML)
//   Icone.NOMES                           -> lista dos nomes que existem
// Nome desconhecido: desenha um círculo neutro (nunca quebra).
// =========================

const Icone = (function() {
  var NOMES = ["moeda", "brilho", "raio", "ok", "trofeu", "presente", "nota", "som", "mudo", "estrela", "explosao",
    "coracao", "repetir", "robo", "casa", "mao", "celular", "alvo", "pincel", "engrenagem", "globo", "controle",
    "dupla", "fogo", "bau", "cadeado", "trevo", "arma", "mapa", "loja", "roleta", "coroa", "escudo", "relogio",
    "seta", "voltar", "play", "fechar", "copiar", "wifi", "usuario", "chapeu", "olho", "rastro", "caveira"];
  var cache = {};

  function desenhar(ctx, nome, x, y, tam) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(tam / 100, tam / 100);
    ctx.fillStyle = "#ffd23f";
    ctx.strokeStyle = "#1a0d33";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function url(nome) {
    if (cache[nome]) return cache[nome];
    var c = document.createElement("canvas");
    c.width = c.height = 96;
    desenhar(c.getContext("2d"), nome, 48, 48, 92);
    return (cache[nome] = c.toDataURL());
  }

  function html(nome, classe) {
    return "<i class='ico" + (classe ? " " + classe : "") + "' style=\"background-image:url(" + url(nome) + ")\"></i>";
  }

  return { NOMES: NOMES, desenhar: desenhar, html: html };
})();
