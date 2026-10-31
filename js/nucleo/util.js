"use strict";

// Pequenas ferramentas usadas em todo lugar
function limitar(v, min, max) { return v < min ? min : v > max ? max : v; }
function el(id) { return document.getElementById(id); }
function vibrar(ms) { if (save && save.vibrar && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

// Números grandes: 1.234 -> "1.23K"; depois K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc e aa, ab, ac...
const SUFIXOS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
function fmt(n) {
  if (!isFinite(n)) return "∞";
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
  let e = Math.floor(Math.log10(n) / 3), s;
  if (e < SUFIXOS.length) s = SUFIXOS[e];
  else { const k = e - SUFIXOS.length; s = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26); }
  const v = n / Math.pow(1000, e);
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + s;
}
function fmtTempo(seg) {
  seg = Math.max(0, Math.round(seg));
  const h = Math.floor(seg / 3600), m = Math.floor(seg % 3600 / 60), s = seg % 60;
  return h ? h + "h " + m + "m" : m ? m + "m " + s + "s" : s + "s";
}

// Carrega um script uma vez só (idiomas: só o escolhido e o inglês)
const scriptsCarregados = {};
function carregarScript(src) {
  if (!scriptsCarregados[src]) {
    scriptsCarregados[src] = new Promise(function(ok, erro) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = function() { ok(); };
      s.onerror = function() { erro(new Error("falhou: " + src)); };
      document.head.appendChild(s);
    });
  }
  return scriptsCarregados[src];
}

// gerador pseudoaleatório com semente (a arte de cada robô sai sempre igual)
function semente(n) {
  let s = (n * 2654435761) >>> 0;
  return function() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
