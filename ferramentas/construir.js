"use strict";
// =========================
// VERSÃO PARA O POKI (v20.7): node ferramentas/construir.js  ->  dist/ (é o que vai no zip)
// O código do repositório continua igual (legível; o GitHub Pages serve ele mesmo). Aqui:
// - os ~40 scripts do index.html viram UM arquivo minificado (jogo.min.js), na mesma ordem;
// - os que carregam depois (adiados, idiomas, netlib) são minificados um a um, no MESMO caminho (carregarScript);
// - os 2 CSS viram um (estilo.min.css); a fonte vai copiada.
// Precisa do esbuild (npm install, uma vez). Os nomes de fora das funções (globais) não mudam: os arquivos se
// enxergam por eles, como no repositório.
// =========================
const fs = require("fs"), path = require("path");
const esbuild = require("esbuild");

const RAIZ = path.join(__dirname, ".."), DIST = path.join(RAIZ, "dist");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");
const gravar = (p, s) => { const f = path.join(DIST, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const kb = (n) => (n / 1024).toFixed(0) + " KB";
const OPC = { minify: true, legalComments: "none", charset: "utf8", target: "es2017" };

fs.rmSync(DIST, { recursive: true, force: true });
let html = ler("index.html");

// 1) scripts locais do index.html, na ordem
const tags = [...html.matchAll(/^[ \t]*<script src="(js\/[^"]+)"><\/script>\r?\n/gm)];
if (!tags.length) throw new Error("nenhum <script src=\"js/...\"> no index.html");
const noIndex = new Set(tags.map((m) => m[1]));
let antes = 0;
const junto = tags.map((m) => { const s = ler(m[1]); antes += s.length; return "// " + m[1] + "\n" + s + "\n;"; }).join("\n");
const jogo = esbuild.transformSync(junto, OPC).code;
gravar("jogo.min.js", jogo);
html = html.replace(tags[0][0], '  <script src="jogo.min.js"></script>\n');
for (let i = 1; i < tags.length; i++) html = html.replace(tags[i][0], "");

// 2) os outros .js (carregados depois): minificados no mesmo caminho
const outros = [];
(function varrer(dir) {
  for (const n of fs.readdirSync(path.join(RAIZ, dir))) {
    const p = dir + "/" + n;
    if (fs.statSync(path.join(RAIZ, p)).isDirectory()) varrer(p);
    else if (n.endsWith(".js") && !noIndex.has(p)) outros.push(p);
  }
})("js");
let antesOutros = 0, depoisOutros = 0;
for (const p of outros) {
  const s = ler(p); antesOutros += s.length;
  // licença no topo (netlib: ISC) fica como está
  const lic = /^\/\*[\s\S]*?License[\s\S]*?\*\//.exec(s);
  const m = (lic ? lic[0] + "\n" : "") + esbuild.transformSync(s, OPC).code;
  depoisOutros += m.length;
  gravar(p, m);
}

// 3) CSS: os <link rel="stylesheet"> locais viram um
const links = [...html.matchAll(/^[ \t]*<link rel="stylesheet" href="([^"]+\.css)">\r?\n/gm)].filter((m) => !/^https?:/.test(m[1]));
const css = esbuild.transformSync(links.map((m) => ler(m[1])).join("\n"), { loader: "css", minify: true, charset: "utf8" }).code;
gravar("estilo.min.css", css);
html = html.replace(links[0][0], '  <link rel="stylesheet" href="estilo.min.css">\n');
for (let i = 1; i < links.length; i++) html = html.replace(links[i][0], "");

// 4) html (sem os comentários) e fonte
html = html.replace(/<!--[\s\S]*?-->/g, "");
gravar("index.html", html);
for (const n of fs.readdirSync(path.join(RAIZ, "fonte"))) fs.copyFileSync(path.join(RAIZ, "fonte", n), path.join(fs.mkdirSync(path.join(DIST, "fonte"), { recursive: true }) || path.join(DIST, "fonte"), n));

console.log("jogo.min.js: " + tags.length + " scripts, " + kb(antes) + " -> " + kb(jogo.length));
console.log("carregados depois: " + outros.length + " arquivos, " + kb(antesOutros) + " -> " + kb(depoisOutros));
console.log("css: " + links.length + " arquivos -> " + kb(css.length));
