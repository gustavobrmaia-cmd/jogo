"use strict";

// =========================
// FUNDOS EM SVG (v20.4): o modo escuro automático de alguns navegadores (Night mode do Brave, "dark mode for web
// contents" do Chrome, Samsung Internet) escurece cores e degradês CLAROS do CSS — o topo dos botões e cartões ficava
// marrom/escuro — mas não mexe em imagens claras. Aqui os degradês e as cores claras de fundo viram uma imagem SVG com as
// MESMAS cores: no modo normal nada muda; no modo escuro as telas ficam com as cores certas. Só os CLAROS: imagem escura
// o navegador inverte. Texto escuro ele ainda clareia (não tem como evitar sem mudar o visual).
// Vale para o que já está no HTML e para o que aparece depois (MutationObserver: elementos novos e troca de classe).
// =========================

const FundosSVG = (function() {
  const cache = {};
  const MARCA = "fsvg";

  // "rgb(255, 231, 90)" / "rgba(0, 0, 0, 0.5)" -> { c: "rgb(...)", a: 0.5, lum: 0..1 }
  function cor(s) {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return null;
    const p = m[1].split(",").map(function(x) { return parseFloat(x); });
    const a = p.length > 3 ? p[3] : 1;
    return { c: "rgb(" + p[0] + "," + p[1] + "," + p[2] + ")", a: a, lum: (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) / 255 };
  }
  // separa por vírgula fora de parênteses
  function partes(s) {
    const out = []; let n = 0, ini = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "(") n++;
      else if (ch === ")") n--;
      else if (ch === "," && n === 0) { out.push(s.slice(ini, i).trim()); ini = i + 1; }
    }
    out.push(s.slice(ini).trim());
    return out;
  }
  function url(svg) { return "url(\"data:image/svg+xml;utf8," + encodeURIComponent(svg) + "\")"; }

  // linear-gradient(...) calculado pelo navegador -> SVG (null se não der para converter)
  function degrade(bi, w, h) {
    if (bi.indexOf("linear-gradient(") !== 0) return null;
    const dentro = bi.slice("linear-gradient(".length, bi.lastIndexOf(")"));
    const ps = partes(dentro);
    let ang = 180;
    if (/deg$/.test(ps[0])) { ang = parseFloat(ps.shift()); }
    else if (/^to /.test(ps[0])) {
      const d = ps.shift();
      ang = d === "to top" ? 0 : d === "to right" ? 90 : d === "to left" ? 270 : d === "to bottom" ? 180 : NaN;
      if (isNaN(ang)) return null;
    }
    const rad = ang * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
    const tam = Math.abs(dx) * (w || 1) + Math.abs(dy) * (h || 1);
    const paradas = [];
    for (let i = 0; i < ps.length; i++) {
      const m = /^(rgba?\([^)]*\))\s*(.*)$/.exec(ps[i]);
      if (!m) return null;
      const c = cor(m[1]);
      const pos = m[2] ? m[2].split(/\s+/) : [];
      if (!pos.length) paradas.push({ c: c, p: null });
      pos.forEach(function(v) {
        const p = /%$/.test(v) ? parseFloat(v) / 100 : /px$/.test(v) ? parseFloat(v) / tam : null;
        paradas.push({ c: c, p: p });
      });
    }
    if (paradas.length < 2) return null;
    // só os degradês CLAROS: o modo escuro deixa os escuros como estão, mas INVERTE imagens escuras (ficariam claras)
    let soma = 0;
    paradas.forEach(function(s) { soma += s.c.lum; });
    if (soma / paradas.length < 0.42) return null;
    // sem posição: distribui
    paradas.forEach(function(s, i) { if (s.p === null) s.p = Math.max(0, Math.min(1, i / (paradas.length - 1))); else s.p = Math.max(0, Math.min(1, s.p)); });
    // só vertical ou horizontal; o degradê vira FAIXAS de retângulos lisos: o modo escuro do Chrome escurece as cores de
    // um <linearGradient> dentro do SVG, mas não as de um <rect> com cor lisa (testado com o modo escuro forçado)
    const vert = ang % 180 === 0, inv = ang === 0 || ang === 270;
    if (!vert && ang % 90 !== 0) return null;
    const rects = [];
    function faixa(p0, p1, c) {
      if (p1 <= p0) return;
      const a = inv ? 1 - p1 : p0, b = (p1 - p0);
      const op = c.a < 1 ? " fill-opacity='" + c.a + "'" : "";
      rects.push(vert ? "<rect x='0' y='" + (a * 100).toFixed(2) + "' width='100' height='" + (b * 100 + 0.3).toFixed(2) + "' fill='" + c.c + "'" + op + "/>"
                      : "<rect y='0' x='" + (a * 100).toFixed(2) + "' height='100' width='" + (b * 100 + 0.3).toFixed(2) + "' fill='" + c.c + "'" + op + "/>");
    }
    if (paradas[0].p > 0) faixa(0, paradas[0].p, paradas[0].c);
    for (let i = 0; i < paradas.length - 1; i++) {
      const s0 = paradas[i], s1 = paradas[i + 1];
      if (s0.c.c === s1.c.c && s0.c.a === s1.c.a) { faixa(s0.p, s1.p, s0.c); continue; }
      // transição suave: 12 faixas com a cor no meio do caminho
      const n = 12, a0 = /rgb\((\d+),(\d+),(\d+)\)/.exec(s0.c.c), a1 = /rgb\((\d+),(\d+),(\d+)\)/.exec(s1.c.c);
      for (let k = 0; k < n; k++) {
        const q = (k + 0.5) / n, mix = function(i2) { return Math.round(+a0[i2] + (+a1[i2] - +a0[i2]) * q); };
        faixa(s0.p + (s1.p - s0.p) * k / n, s0.p + (s1.p - s0.p) * (k + 1) / n,
          { c: "rgb(" + mix(1) + "," + mix(2) + "," + mix(3) + ")", a: s0.c.a + (s1.c.a - s0.c.a) * q });
      }
    }
    const ult = paradas[paradas.length - 1];
    if (ult.p < 1) faixa(ult.p, 1, ult.c);
    return "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none' shape-rendering='crispEdges'>" + rects.join("") + "</svg>";
  }

  function tratar(e) {
    if (!e || e.nodeType !== 1 || e.tagName === "CANVAS" || e.tagName === "SCRIPT") return;
    // fundo que outro código pôs direto no elemento (ícones, prévias): não é nosso
    if (e.style.backgroundImage && e.dataset[MARCA] === undefined) return;
    if (e.dataset[MARCA] !== undefined) { e.style.backgroundImage = ""; e.style.backgroundSize = ""; e.style.backgroundRepeat = ""; }
    const cs = getComputedStyle(e);
    const bi = cs.backgroundImage;
    let svg = null;
    if (bi && bi !== "none") {
      if (partes(bi).length === 1) svg = degrade(bi, e.offsetWidth, e.offsetHeight);
    } else {
      const c = cor(cs.backgroundColor);
      // cor lisa clara (o modo escuro só escurece as claras)
      if (c && c.a > 0.99 && c.lum > 0.42) svg = "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='" + c.c + "'/></svg>";
    }
    if (!svg) { delete e.dataset[MARCA]; return; }
    const u = cache[svg] || (cache[svg] = url(svg));
    e.dataset[MARCA] = "";
    e.style.backgroundImage = u;
    e.style.backgroundSize = "100% 100%";
    e.style.backgroundRepeat = "no-repeat";
  }
  function arvore(raiz) {
    if (!raiz || raiz.nodeType !== 1) return;
    tratar(raiz);
    const l = raiz.getElementsByTagName("*");
    for (let i = 0; i < l.length; i++) tratar(l[i]);
  }

  function iniciar() {
    arvore(document.body);
    new MutationObserver(function(ms) {
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        if (m.type === "childList") m.addedNodes.forEach(arvore);
        else if (m.type === "attributes") arvore(m.target);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else setTimeout(iniciar, 0);

  return { tratar: tratar, arvore: arvore };
})();
