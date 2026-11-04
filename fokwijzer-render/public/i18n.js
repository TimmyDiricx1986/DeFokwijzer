/* De Fokwijzer: taalkeuze (Nederlands / English).
   De app zelf blijft Nederlands. In het Engels vervangt dit script de schermtekst live door de vertaling
   uit i18n-en.js: vaste teksten, knoppen, invulvelden, meldingen en de stamboomkaart.
   Paardnamen en wat gebruikers zelf schrijven (opmerkingen, bronnen) blijven onvertaald.
   Taal kiezen: knop NL / EN bovenaan, of het adres /en (of ?lang=en). De keuze wordt in de browser bewaard. */
(function () {
  "use strict";
  var KEY = "fw-lang";
  var EN = window.FW_EN || { text: {}, patterns: [], card: {}, cardWords: {} };

  function store(v) { try { localStorage.setItem(KEY, v); } catch (_) {} }
  function pick() {
    var q = null;
    try { q = new URLSearchParams(location.search).get("lang"); } catch (_) {}
    if (q === "en" || q === "nl") { store(q); return q; }
    try { var s = localStorage.getItem(KEY); if (s === "en" || s === "nl") return s; } catch (_) {}
    // Eerste bezoek: Engels voor wie zijn browser niet in het Nederlands heeft staan (zoekmachines krijgen Nederlands).
    if (/bot|crawl|spider|slurp|lighthouse/i.test(navigator.userAgent || "")) return "nl";
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "nl"];
    return /^nl\b/i.test(langs[0] || "nl") ? "nl" : "en";
  }
  var lang = pick();
  document.documentElement.lang = lang;

  // ------------------------------------------------------------ vertalen
  var T = Object.create(null);
  Object.keys(EN.text).forEach(function (k) { T[norm(k)] = EN.text[k]; });
  var P = EN.patterns || [];
  var cache = new Map();
  var done = new Set();     // teksten die al vertaald zijn: niet opnieuw vertalen
  var missing = new Set();
  var HAS_LETTER = /[A-Za-zÀ-ÿ]/;

  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
  function has(k) { return Object.prototype.hasOwnProperty.call(T, k); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function low(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  // Vertaling van één zin of fragment (al genormaliseerd). Geeft null als er niets gevonden is.
  function exact(n) {
    if (has(n)) return T[n];
    for (var i = 0; i < P.length; i++) {
      var m = n.match(P[i][0]);
      if (!m) continue;
      var r = typeof P[i][1] === "function" ? P[i][1].apply(null, m) : n.replace(P[i][0], P[i][1]);
      if (r != null) return r;
    }
    return null;
  }
  function withCase(n) {
    var r = exact(n);
    if (r != null) return r;
    var c0 = n.charAt(0);
    if (n.length > 1 && n === n.toUpperCase() && n !== n.toLowerCase()) {
      r = exact(n.toLowerCase()); if (r == null) r = exact(cap(n.toLowerCase()));
      return r == null ? null : r.toUpperCase();
    }
    if (c0 !== c0.toLowerCase()) { r = exact(low(n)); return r == null ? null : cap(r); }
    if (c0 !== c0.toUpperCase()) { r = exact(cap(n)); return r == null ? null : low(r); }
    return null;
  }
  var EDGE = /^([\s·•.,:;(\[\-–—\/+|*"'‘“]*)([\s\S]*?)([\s·•,:;)\]\-–—\/+|*.!?…"'’”]*)$/;
  function edged(n) {
    var r = withCase(n);
    if (r != null) return r;
    var m = n.match(EDGE);
    if (m && m[2] && (m[1] || m[3])) {
      r = withCase(m[2]);
      if (r != null) return m[1] + r + m[3];
      // eindpunt hoort soms bij de zin
      if (m[3] && /^[.!?…]/.test(m[3])) { r = withCase(m[2] + m[3].charAt(0)); if (r != null) return m[1] + r + m[3].slice(1); }
    }
    // alleen leestekens aan het eind weglaten (haakjes blijven bij de tekst)
    var m2 = n.match(/^([\s\S]*?)([.,:;!?…]+)$/);
    if (m2 && m2[1]) { r = withCase(m2[1]); if (r != null) return r + m2[2]; }
    return null;
  }
  var SEPS = [" · ", " - ", " / ", " | ", ": ", ", ", " (", ") ", " x ", "; "];
  function split(n, depth) {
    for (var i = 0; i < SEPS.length; i++) {
      var sep = SEPS[i];
      if (n.indexOf(sep) < 0) continue;
      var parts = n.split(sep), changed = false;
      var out = parts.map(function (p) {
        if (!HAS_LETTER.test(p)) return p;
        var r = edged(p);
        if (r == null && depth < 2) r = split(p, depth + 1);
        if (r == null) return p;
        changed = true; return r;
      });
      if (changed) return out.join(sep);
    }
    return null;
  }
  function months(s) {
    return s.replace(/\b(\d{1,2}) (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\b\.?/g, function (all, d, m) {
      var M = { januari: "January", februari: "February", maart: "March", april: "April", mei: "May", juni: "June", juli: "July", augustus: "August", september: "September", oktober: "October", november: "November", december: "December", jan: "Jan", feb: "Feb", mrt: "Mar", apr: "Apr", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", okt: "Oct", nov: "Nov", dec: "Dec" };
      return d + " " + M[m];
    });
  }
  function core(n) {
    var c = cache.get(n);
    if (c !== undefined) return c;
    var r = edged(n);
    if (r == null) r = split(n, 0);
    if (r == null) { var mm = months(n); if (mm !== n) r = mm; }
    else r = months(r);
    if (r == null && n.indexOf("\n") < 0 && HAS_LETTER.test(n)) missing.add(n);
    cache.set(n, r);
    return r;
  }
  function t(s) {
    if (lang !== "en" || s == null) return s;
    s = String(s);
    var n = norm(s);
    if (!n || !HAS_LETTER.test(n) || done.has(n)) return s;
    var r = core(n);
    if (r == null && /\n/.test(s)) {
      // meerdere regels: per regel vertalen
      var lines = s.split("\n"), ch = false;
      lines = lines.map(function (l) { var x = norm(l); if (!x || !HAS_LETTER.test(x)) return l; var y = core(x); if (y == null) return l; ch = true; return l.match(/^\s*/)[0] + y + l.match(/\s*$/)[0]; });
      if (ch) { lines.forEach(function (l) { var x = norm(l); if (x) done.add(x); }); return lines.join("\n"); }
      return s;
    }
    if (r == null) return s;
    done.add(norm(r.charAt(0) === "\b" ? r.slice(1) : r));
    // Een vertaling die met \b begint, sluit aan bij het vorige woord (bv. ", or log in.").
    if (r.charAt(0) === "\b") return r.slice(1) + s.match(/\s*$/)[0];
    return s.match(/^\s*/)[0] + r + s.match(/\s*$/)[0];
  }

  // ------------------------------------------------------------ stamboomkaart (afbeelding en PDF)
  var CARD = EN.card || {}, CW = EN.cardWords || {};
  function cardT(s) {
    if (typeof s !== "string" || !s) return s;
    if (Object.prototype.hasOwnProperty.call(CARD, s)) return CARD[s];
    var m = s.match(/^Gemaakt op (.+?)\. Controleer gegevens altijd bij het stamboek\.$/);
    if (m) return "Made on " + m[1] + ". Always check the data with the studbook.";
    return s.replace(/\b(\d)m(\d\d)\b/g, "$1.$2m").replace(/[A-Za-zÀ-ÿ]+/g, function (w) {
      var k = w.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(CW, k)) return w;
      var v = CW[k];
      return w === w.toUpperCase() && w.length > 1 ? v.toUpperCase() : w.charAt(0) !== k.charAt(0) ? cap(v) : v;
    });
  }
  function wrapCtx(c) {
    if (lang !== "en" || !c || typeof Proxy === "undefined") return c;
    return new Proxy(c, {
      get: function (o, p) {
        if (p === "fillText") return function (s, x, y, w) { return w === undefined ? o.fillText(cardT(s), x, y) : o.fillText(cardT(s), x, y, w); };
        if (p === "measureText") return function (s) { return o.measureText(cardT(s)); };
        var v = o[p];
        return typeof v === "function" ? v.bind(o) : v;
      },
      set: function (o, p, v) { o[p] = v; return true; },
    });
  }

  window.fwI18n = { lang: lang, t: t, wrapCtx: wrapCtx, missing: function () { return Array.from(missing); } };
  if (lang !== "en") { onReady(addSwitch); return; }

  // ------------------------------------------------------------ AI-advies in het Engels
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        var u = typeof input === "string" ? input : input && input.url;
        if (u && /\/api\/ai\/json$/.test(u) && init && typeof init.body === "string") {
          init = Object.assign({}, init, { body: init.body.replace(/Schrijf in het Nederlands \(Vlaams\)/g, "Write in English (British spelling)") });
        }
      } catch (_) {}
      return origFetch.call(this, input, init);
    };
  }

  // ------------------------------------------------------------ meldingen
  ["alert", "confirm", "prompt"].forEach(function (f) {
    var o = window[f];
    if (typeof o !== "function") return;
    window[f] = function (msg, def) { return f === "prompt" ? o.call(window, t(msg), def) : o.call(window, t(msg)); };
  });

  // ------------------------------------------------------------ pagina vertalen
  var ATTRS = ["placeholder", "title", "aria-label", "alt", "label", "data-tip"];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  // attrs: voor attributen (bv. placeholder van een textarea) gelden alleen script/style en translate="no".
  function skipEl(el, attrs) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (attrs && e === el ? (e.tagName === "SCRIPT" || e.tagName === "STYLE") : (SKIP[e.tagName] || e.isContentEditable)) return true;
      if (e.getAttribute("translate") === "no" || (e.classList && e.classList.contains("notranslate"))) return true;
    }
    return false;
  }
  function doText(node) {
    var v = node.nodeValue;
    if (!v || !HAS_LETTER.test(v) || !node.parentNode || skipEl(node.parentNode)) return;
    var r = t(v);
    // "<b>1</b> hengsten" -> "1 stallion": enkelvoud als het getal ervoor 1 is
    var prev = node.previousSibling;
    if (r !== v && prev && /^\s*1\s*$/.test(prev.textContent || "")) {
      r = r.replace(/^(\s*)(horses|stallions|mares|days|visitors|prices|fields)\b/, function (a, sp, w) { return sp + w.slice(0, -1); });
    }
    if (r !== v) node.nodeValue = r;
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a), r = t(v);
      if (r !== v) el.setAttribute(a, r);
    }
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && el.value) {
      var w = t(el.value);
      if (w !== el.value) el.value = w;
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (!skipEl(root, true)) doAttrs(root); if (skipEl(root)) return; }
    var tw = document.createTreeWalker(root, 5, null); // elementen en tekst
    var n = tw.nextNode();
    while (n) {
      if (n.nodeType === 3) doText(n);
      else if (!skipEl(n, true)) doAttrs(n);
      n = tw.nextNode();
    }
  }
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") { if (m.target.nodeType === 1 && !skipEl(m.target, true)) doAttrs(m.target); }
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(["value"]) });

  // dialoogvensters (<dialog>) en titel
  var titleT = function () { var x = t(document.title); if (x !== document.title) document.title = x; };
  onReady(function () {
    walk(document.body);
    titleT();
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", t(md.getAttribute("content")));
    var tl = document.querySelector("title");
    if (tl) new MutationObserver(titleT).observe(tl, { childList: true, characterData: true, subtree: true });
    addSwitch();
  });

  // ------------------------------------------------------------ taalknop NL / EN
  function onReady(f) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", f); else f(); }
  function addSwitch() {
    if (document.getElementById("fwLang")) return;
    var box = document.createElement("div");
    box.id = "fwLang";
    box.className = "fw-lang";
    box.setAttribute("translate", "no");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", lang === "en" ? "Language" : "Taal");
    [["nl", "NL", "Nederlands"], ["en", "EN", "English"]].forEach(function (x) {
      var a = document.createElement("a");
      a.textContent = x[1];
      a.lang = x[0];
      a.hreflang = x[0];
      a.title = x[2];
      a.href = location.pathname + "?lang=" + x[0];
      if (x[0] === lang) a.setAttribute("aria-current", "true");
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (x[0] === lang) return;
        store(x[0]);
        location.href = location.pathname + "?lang=" + x[0] + location.hash;
      });
      box.appendChild(a);
    });
    var side = document.querySelector("header.top .hdr-side");
    if (side) { side.insertBefore(box, side.firstChild); return; }
    var page = document.querySelector(".page");
    if (page) { box.classList.add("fw-lang-page"); page.insertBefore(box, page.firstChild); return; }
    document.body.insertBefore(box, document.body.firstChild);
  }
})();
