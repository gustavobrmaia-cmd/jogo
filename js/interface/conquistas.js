"use strict";

// =========================
// CONQUISTAS na tela (v14): aba do Compêndio, faixa "Conquista!" e bolinha quando tem medalha para pegar.
// =========================
const Conquistas = (function() {
  let prontasAntes = -1;
  function pegas(c) { return (save.conquistas && save.conquistas[c.id]) || 0; }
  function pode(c) { const n = pegas(c); return n < c.alvos.length && valorConquista(c) >= c.alvos[n]; }
  function prontas() { return CONQUISTAS.filter(pode).length; }
  function total() { return CONQUISTAS.reduce(function(a, c) { return a + pegas(c); }, 0); }
  function pegar(c, x, y) {
    if (!pode(c)) return false;
    const n = pegas(c); save.conquistas[c.id] = n + 1;
    save.ph += CQ_PH[n];
    Fx.numero(x, y, "+" + CQ_PH[n] + " PH", "#7cf0ff", 30); Fx.faiscas(x, y, CQ_COR[n], 24);
    Som.som("missao"); vibrar(25);
    Poki.medir("achievement", c.id + "-" + (n + 1), "complete");
    prontasAntes = prontas();
    salvar();
    return true;
  }
  // a cada 0,25 s (Paineis.pontos): medalha nova -> faixa + bolinha no Compêndio
  function checar() {
    if (!save.conquistas || typeof save.conquistas !== "object") save.conquistas = {};
    const p = prontas();
    if (p > 0 && Paineis.aba !== "compendio") el("pontoComp").classList.add("on");
    if (prontasAntes >= 0 && p > prontasAntes) {
      const c = CONQUISTAS.filter(pode)[0];
      if (c) { Paineis.faixa(Pixel.icone(c.ico), t("cq_nova"), t(c.txt, fmt(c.alvos[pegas(c)]))); Som.som("descobrir"); }
    }
    prontasAntes = p;
  }
  function montar(corpo) {
    corpo.appendChild(Paineis.elem("p", "titulo2", Paineis.esc(t("cq_explica"))));
    const l = Paineis.elem("div", "conquistas");
    CONQUISTAS.forEach(function(c) {
      const n = pegas(c), fim = n >= c.alvos.length, alvo = c.alvos[Math.min(n, c.alvos.length - 1)], v = valorConquista(c);
      const d = Paineis.elem("div", "card conquista" + (pode(c) ? " pronta" : "") + (fim ? " fim" : ""));
      const med = Paineis.elem("div", "medalha");
      med.style.setProperty("--m", n ? CQ_COR[n - 1] : "#4a4266");
      med.appendChild(Paineis.icone(c.ico));
      d.appendChild(med);
      let pips = "<div class='pipsCq'>"; for (let k = 0; k < c.alvos.length; k++) pips += "<i style='background:" + (k < n ? CQ_COR[k] : "#2a2342") + "'></i>"; pips += "</div>";
      d.appendChild(Paineis.elem("div", "info", "<b>" + Paineis.esc(t(c.txt, fmt(alvo))) + "</b>" + pips +
        (fim ? "" : "<div class='barraP'><i style='width:" + Math.min(100, Math.round(v / alvo * 100)) + "%'></i></div><small>" + fmt(Math.min(v, alvo)) + "/" + fmt(alvo) + "</small>")));
      if (fim) d.appendChild(Paineis.elem("span", "cqFim", Paineis.esc(t("cq_completa"))));
      else {
        const b = Paineis.elem("button", "btn" + (pode(c) ? "" : " sem"), "");
        b.appendChild(Paineis.icone("ph")); b.appendChild(document.createTextNode("+" + CQ_PH[n]));
        b.addEventListener("click", function() {
          const r = b.getBoundingClientRect();
          if (pegar(c, r.left + r.width / 2, r.top)) Paineis.remontar(); else Som.som("erro");
        });
        d.appendChild(b);
      }
      l.appendChild(d);
    });
    corpo.appendChild(l);
  }
  return { checar: checar, montar: montar, prontas: prontas, total: total };
})();
