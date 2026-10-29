/* De Fokwijzer: koppeling tussen de app en de eigen server.
   Biedt dezelfde functies die de app vroeger in Claude gebruikte (db, user, sample, downloads, mcp),
   plus inloggen, accountbeheer en wiki-geschiedenis. Alle tekst gaat via textContent (geen HTML-injectie). */
(function () {
  "use strict";
  var LEVEL = { anoniem: 0, gebruiker: 1, paardenbeheerder: 2, beheerder: 3, lezer: 1, bijdrager: 2 };
  var ROL_LABEL = { gebruiker: "Gebruiker", paardenbeheerder: "Paarden-beheerder", beheerder: "Beheerder", lezer: "Gebruiker", bijdrager: "Paarden-beheerder" };
  var ROL_UITLEG = {
    lezer: "Lezer: zoeken, stambomen bekijken en vergelijken. Daarvoor heb je geen account nodig.",
    gebruiker: "Gebruiker: vult de wiki aan met bronnen en opmerkingen en kan paarden aanvragen.",
    paardenbeheerder: "Paarden-beheerder: voegt paarden toe, beheert zijn eigen paarden en kan gegevens van andere paarden aanpassen.",
    beheerder: "Beheerder: beheert de hele site, gebruikers, partners en back-ups."
  };

  function api(method, url, body, signal) {
    return fetch(url, {
      method: method,
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-fokwijzer": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal,
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) {
          var e = new Error((j && j.fout) || "Fout " + r.status);
          e.status = r.status;
          e.code = (j && j.code) || (r.status === 401 ? "not_granted" : r.status === 403 ? "forbidden" : r.status === 429 ? "rate_limited" : "error");
          throw e;
        }
        return j;
      });
    }, function (err) {
      if (err && err.name === "AbortError") { var e = new Error("Gestopt."); e.code = "cancelled"; throw e; }
      var e2 = new Error("Geen verbinding met de server."); e2.code = "network"; throw e2;
    });
  }

  // ------------------------------------------------------------ sessie
  var me = api("GET", "/api/me").catch(function () { return { gebruiker: null, registratie: false, ai: false, taken: {} }; });
  me.then(function (m) {
    var rol = (m.gebruiker && m.gebruiker.rol) || "anoniem";
    document.documentElement.setAttribute("data-rol", rol);
  });

  // ------------------------------------------------------------ live updates
  var listeners = {};
  var es = null, hadError = false;
  function ensureStream() {
    if (es || typeof EventSource === "undefined") return;
    es = new EventSource("/api/stream");
    es.addEventListener("change", function (ev) {
      var d; try { d = JSON.parse(ev.data); } catch (_) { return; }
      (listeners[d.coll] || []).slice().forEach(function (f) { f(d.id); });
    });
    es.addEventListener("error", function () { hadError = true; });
    es.addEventListener("open", function () {
      if (!hadError) return;
      hadError = false;
      Object.keys(listeners).forEach(function (c) { listeners[c].slice().forEach(function (f) { f(null); }); });
    });
  }
  function sub(coll, fn) {
    ensureStream();
    (listeners[coll] = listeners[coll] || []).push(fn);
    return function () { listeners[coll] = (listeners[coll] || []).filter(function (x) { return x !== fn; }); };
  }

  // ------------------------------------------------------------ database
  var SEG = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$/;
  function randomId() {
    var a = new Uint8Array(10); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function enc(s) { if (!SEG.test(s)) throw new Error("Ongeldig id."); return encodeURIComponent(s); }
  // Wat je zonder (voldoende) login niet mag lezen, wordt niet opgevraagd. De server controleert dit ook zelf.
  var READ = { aanvragen: 1, veiling_backlog: 3, partner_admin: 3, "systeem/instellingen": 3 };
  function readLevel(coll, id) { return READ[coll + "/" + id] || READ[coll] || 0; }
  function docSnap(id, data) { return { id: id, exists: data !== undefined, data: function () { return data; } }; }

  function docRef(coll, id) {
    var url = "/api/c/" + enc(coll) + "/" + enc(id);
    return {
      id: id,
      set: function (data) { return api("PUT", url, { data: data }).then(function () {}); },
      update: function (data) { return api("PATCH", url, { data: data }).then(function () {}); },
      delete: function () { return api("DELETE", url).then(function () {}); },
      get: function () {
        return me.then(function (m) {
          if (level(m) < readLevel(coll, id)) return docSnap(id, undefined);
          return api("GET", url).then(function (j) { return docSnap(id, j.data === null ? undefined : j.data); });
        });
      },
      onSnapshot: function (cb, onErr) {
        var alive = true, t = null;
        var load = function () {
          this.get().then(function (s) { if (alive) cb(s); }, function (e) { if (alive && onErr) onErr(e); });
        }.bind(this);
        load();
        var un = sub(coll, function (changed) { if (changed && changed !== id) return; clearTimeout(t); t = setTimeout(load, 150); });
        return function () { alive = false; un(); };
      },
    };
  }
  function collRef(coll) {
    return {
      doc: function (id) { return docRef(coll, id || randomId()); },
      onSnapshot: function (cb, onErr) {
        var alive = true, t = null;
        var load = function () {
          me.then(function (m) {
            if (level(m) < readLevel(coll)) return [];
            return api("GET", "/api/c/" + enc(coll));
          }).then(function (list) {
            if (alive) cb({ docs: list.map(function (x) { return docSnap(x.id, x.data); }), size: list.length });
          }, function (e) { if (alive && onErr) onErr(e); });
        };
        load();
        var un = sub(coll, function () { clearTimeout(t); t = setTimeout(load, 300); });
        return function () { alive = false; un(); };
      },
    };
  }
  var dbNs = {
    collection: collRef,
    doc: function (p) { var s = String(p).split("/"); return docRef(s[0], s[1]); },
  };

  // ------------------------------------------------------------ overige functies voor de app
  function level(m) { return LEVEL[(m.gebruiker && m.gebruiker.rol) || "anoniem"] || 0; }
  var userNs = me.then(function (m) {
    return {
      level: level(m),
      rol: (m.gebruiker && m.gebruiker.rol) || "anoniem",
      partner: !!(m.gebruiker && m.gebruiker.partner),
      id: function () { return Promise.resolve(m.gebruiker && m.gebruiker.id != null ? String(m.gebruiker.id) : ""); },
      can: function (p) { return Promise.resolve(p === "data.write" ? level(m) >= 2 : p === "wiki.write" ? level(m) >= 1 : false); },
    };
  });
  var sampleNs = {
    json: function (prompt, opts) {
      opts = opts || {};
      return api("POST", "/api/ai/json", { prompt: prompt, tier: opts.modelTier === "complex" ? "complex" : "standard", cache: opts.cache !== false }, opts.signal)
        .then(function (j) { return j.resultaat; });
    },
  };
  var downloadsNs = {
    save: function (o) {
      var blob = (o.data instanceof Blob && !o.mimeType) ? o.data : new Blob([o.data], { type: o.mimeType || (o.data && o.data.type) || "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = String(o.filename || "download").replace(/[^\w.\-]+/g, "_");
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      return Promise.resolve({ ok: true });
    },
  };
  var mcpNs = {
    callTool: function (server, tool, args) {
      var t = String((args && args.trigger_id) || "");
      var naam = t === "veilingmeester" ? "veilingmeester" : "verwerking";
      return api("POST", "/api/taak/" + naam, {});
    },
  };

  window.claude = {
    use: function (name) {
      if (name === "db") return Promise.resolve(dbNs);
      if (name === "user") return userNs;
      if (name === "downloads") return Promise.resolve(downloadsNs);
      if (name === "sample") return me.then(function (m) {
        if (!m.ai || level(m) < 2) { var e = new Error("niet beschikbaar"); e.code = "sampling_disabled"; throw e; }
        return sampleNs;
      });
      if (name === "mcp") return me.then(function (m) {
        if (!m.taken || !(m.taken.verwerking || m.taken.veilingmeester) || level(m) < 2) { var e = new Error("niet ingesteld"); e.code = "niet_ingesteld"; throw e; }
        return mcpNs;
      });
      return Promise.reject(new Error("Onbekende functie"));
    },
  };

  // ------------------------------------------------------------ hulpfuncties voor de interface
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function dialog(title, body) {
    var d = el("dialog", { class: "fw-dlg", "aria-label": title });
    var close = el("button", { class: "btn ghost", type: "button", text: "Sluiten" });
    close.addEventListener("click", function () { d.close(); });
    d.appendChild(el("div", { class: "fw-dlg-head" }, [el("h2", { text: title }), close]));
    d.appendChild(el("div", { class: "fw-dlg-body" }, [body]));
    d.addEventListener("close", function () { d.remove(); });
    document.body.appendChild(d);
    d.showModal();
    return d;
  }
  function field(label, type, name, extra) {
    var id = "fw-" + name + "-" + Math.random().toString(36).slice(2, 7);
    var inp = el("input", Object.assign({ id: id, type: type, name: name, required: "required" }, extra || {}));
    return { wrap: el("div", { class: "field" }, [el("label", { class: "label", for: id, text: label }), inp]), input: inp };
  }
  function status() { return el("div", { class: "status", role: "status" }); }
  function fail(st, e) { st.className = "status err"; st.textContent = e.message || "Er ging iets mis."; }

  // ------------------------------------------------------------ inloggen en registreren
  function loginDialog(m, mode, kiesPb, kiesPartner) {
    var form = el("form", { class: "stack", novalidate: "novalidate" });
    var reg = mode === "registreren";
    var fName = field("Naam", "text", "naam", { autocomplete: "name", maxlength: "60" });
    var fMail = field("E-mailadres", "email", "email", { autocomplete: "email", maxlength: "254" });
    var fPw = field(reg ? "Wachtwoord (minstens 12 tekens)" : "Wachtwoord", "password", "password", { autocomplete: reg ? "new-password" : "current-password", maxlength: "200" });
    if (reg) form.appendChild(fName.wrap);
    form.appendChild(fMail.wrap);
    form.appendChild(fPw.wrap);
    var keuze = null;
    if (reg) {
      keuze = el("fieldset", { class: "fw-rolkeuze" }, [el("legend", { text: "Wat wil je doen op De Fokwijzer?" })]);
      [["gebruiker", "Gebruiker", "Bronnen en opmerkingen aanvullen en paarden aanvragen. Meteen actief."],
       ["paardenbeheerder", "Paarden-beheerder", "Je eigen paarden toevoegen en beheren, en gegevens van andere paarden aanpassen. Ook meteen actief."]].forEach(function (o, i) {
        var id = "fw-rol-" + o[0];
        var r = el("input", { type: "radio", name: "fw-rol", id: id, value: o[0] });
        if ((i === 1) === !!kiesPb) r.checked = true;
        keuze.appendChild(el("label", { class: "fw-rol", for: id }, [r, el("span", {}, [el("b", { text: o[1] }), el("span", { class: "small muted", text: o[2] })])]));
      });
      form.appendChild(keuze);
      var pid = "fw-partner-" + Math.random().toString(36).slice(2, 7);
      var pchk = el("input", { type: "checkbox", id: pid, name: "fw-partner" });
      if (kiesPartner) pchk.checked = true;
      form.appendChild(el("label", { class: "fw-rol fw-partnerkeuze", for: pid }, [pchk, el("span", {}, [el("b", { text: "Ik wil ook partner worden" }), el("span", { class: "small muted", text: "Zet je bedrijf of dienst in de kijker op De Fokwijzer, met je logo bij je hengsten, in de kop of onderaan. Voorlopig gratis. Kan ook later, op de pagina Partners." })])]));
      form.appendChild(el("p", { class: "small muted", text: "Alleen lezen? Daarvoor heb je geen account nodig." }));
    }
    var st = status();
    var btn = el("button", { class: "btn", type: "submit", text: reg ? "Account maken" : "Inloggen" });
    form.appendChild(el("div", { class: "row" }, [btn]));
    form.appendChild(st);
    if (m.registratie) {
      var sw = el("button", { class: "btn ghost fw-link", type: "button", text: reg ? "Ik heb al een account" : "Nog geen account? Maak er een" });
      sw.addEventListener("click", function () { d.close(); loginDialog(m, reg ? "inloggen" : "registreren"); });
      form.appendChild(sw);
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      btn.disabled = true; st.className = "status"; st.textContent = "Even geduld...";
      var body = reg ? { naam: fName.input.value, name: fName.input.value, email: fMail.input.value, password: fPw.input.value, rol: keuze.querySelector("input:checked").value === "paardenbeheerder" ? "paardenbeheerder" : "gebruiker", partner: !!form.querySelector("input[name=fw-partner]:checked") } : { email: fMail.input.value, password: fPw.input.value };
      api("POST", reg ? "/api/auth/register" : "/api/auth/login", body).then(function () { location.reload(); }, function (err) { btn.disabled = false; fail(st, err); });
    });
    var d = dialog(reg ? "Account maken" : "Inloggen", form);
    (reg ? fName : fMail).input.focus();
  }

  function passwordDialog() {
    var form = el("form", { class: "stack", novalidate: "novalidate" });
    var fOld = field("Huidig wachtwoord", "password", "oud", { autocomplete: "current-password" });
    var fNew = field("Nieuw wachtwoord (minstens 12 tekens)", "password", "nieuw", { autocomplete: "new-password" });
    var st = status();
    var btn = el("button", { class: "btn", type: "submit", text: "Wijzigen" });
    [fOld.wrap, fNew.wrap, el("div", { class: "row" }, [btn]), st].forEach(function (x) { form.appendChild(x); });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); btn.disabled = true;
      api("POST", "/api/auth/password", { oud: fOld.input.value, nieuw: fNew.input.value }).then(function () {
        st.className = "status ok"; st.textContent = "Je wachtwoord is gewijzigd. Andere sessies zijn afgemeld.";
      }, function (err) { btn.disabled = false; fail(st, err); });
    });
    dialog("Wachtwoord wijzigen", form);
  }

  // Gebruikersoverzicht op de Beheer-pagina (alleen beheerders).
  function usersPanel(m, root, onCount) {
    var st = status();
    var table = el("table", { class: "fw-users" });
    root.appendChild(el("p", { class: "small muted", text: [ROL_UITLEG.gebruiker, ROL_UITLEG.paardenbeheerder, ROL_UITLEG.beheerder].join(" ") }));
    var wrap = el("div", { class: "fw-users-wrap" }, [table]);
    root.appendChild(wrap); root.appendChild(st);
    function load() {
      api("GET", "/api/users").then(function (list) {
        list.sort(function (a, b) { return (b.aanvraag ? 1 : 0) - (a.aanvraag ? 1 : 0); });
        var open = list.filter(function (u) { return u.aanvraag; }).length;
        if (onCount) onCount(open, list.length);
        table.textContent = "";
        table.appendChild(el("tr", {}, ["Naam", "E-mail", "Rol", "Partner", "Laatst ingelogd", ""].map(function (h) { return el("th", { text: h }); })));
        list.forEach(function (u) {
          var sel = el("select", { "aria-label": "Rol van " + u.name });
          ["gebruiker", "paardenbeheerder", "beheerder"].forEach(function (r) { var o = el("option", { value: r, text: ROL_LABEL[r] }); if (r === u.role) o.selected = true; sel.appendChild(o); });
          function setRol(r, msg) { api("PATCH", "/api/users/" + u.id, { rol: r }).then(function () { st.className = "status ok"; st.textContent = msg || ("Rol van " + u.name + " gewijzigd. Dit geldt vanaf de volgende keer dat " + u.name + " inlogt."); load(); }, function (e) { fail(st, e); load(); }); }
          sel.addEventListener("change", function () { setRol(sel.value); });
          var pc = el("input", { type: "checkbox", "aria-label": u.name + " is partner" });
          pc.checked = !!u.partner;
          pc.addEventListener("change", function () { api("PATCH", "/api/users/" + u.id, { partner: pc.checked }).then(function () { st.className = "status ok"; st.textContent = u.name + (pc.checked ? " is nu partner." : " is geen partner meer.") + " Dit geldt vanaf de volgende keer dat " + u.name + " inlogt."; }, function (e) { fail(st, e); load(); }); });
          var del = el("button", { class: "btn danger", type: "button", text: "Verwijderen" });
          if (m.gebruiker && u.id === m.gebruiker.id) del.disabled = true;
          del.addEventListener("click", function () {
            if (!confirm("Account van " + u.name + " verwijderen?")) return;
            api("DELETE", "/api/users/" + u.id).then(load, function (e) { fail(st, e); });
          });
          table.appendChild(el("tr", {}, [el("td", { text: u.name }), el("td", { text: u.email }), el("td", {}, [sel]), el("td", {}, [pc]), el("td", { text: u.last_login ? new Date(u.last_login).toLocaleString("nl-BE") : "nooit" }), el("td", {}, [del])]));
        });
      }, function (e) { fail(st, e); });
    }
    load();
    return load;
  }

  // ------------------------------------------------------------ wiki-geschiedenis van een paard
  function historyDialog(id, canRestore) {
    var box = el("div", { class: "stack" });
    var st = status();
    box.appendChild(st);
    var list = el("ol", { class: "fw-hist" });
    box.appendChild(list);
    function fmt(v) { if (v == null) return "leeg"; var s = typeof v === "string" ? v : JSON.stringify(v); return s.length > 140 ? s.slice(0, 140) + "..." : s; }
    api("GET", "/api/history/paarden/" + encodeURIComponent(id)).then(function (rows) {
      if (!rows.length) { st.textContent = "Nog geen wijzigingen geregistreerd."; return; }
      rows.forEach(function (r) {
        var li = el("li");
        li.appendChild(el("div", {}, [el("b", { text: new Date(r.ts).toLocaleString("nl-BE") }), " · " + r.action + " door " + r.actor.replace(/\s*<[^>]*>$/, "")]));
        var b = r.before || {}, a = r.after || {};
        var keys = Object.keys(Object.assign({}, b, a)).filter(function (k) { return JSON.stringify(b[k]) !== JSON.stringify(a[k]); });
        if (keys.length) {
          var ul = el("ul", { class: "small" });
          keys.slice(0, 12).forEach(function (k) { ul.appendChild(el("li", { text: k + ": " + fmt(b[k]) + " → " + fmt(a[k]) })); });
          if (keys.length > 12) ul.appendChild(el("li", { text: "en nog " + (keys.length - 12) + " velden" }));
          li.appendChild(ul);
        }
        if (canRestore && r.after) {
          var rb = el("button", { class: "btn ghost", type: "button", text: "Deze versie terugzetten" });
          rb.addEventListener("click", function () {
            if (!confirm("Deze versie van het paard terugzetten?")) return;
            api("PUT", "/api/c/paarden/" + encodeURIComponent(id), { data: r.after }).then(function () { st.className = "status ok"; st.textContent = "Versie teruggezet."; }, function (e) { fail(st, e); });
          });
          li.appendChild(rb);
        }
        list.appendChild(li);
      });
    }, function (e) { fail(st, e); });
    dialog("Geschiedenis", box);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest('[data-act="hist"]');
    if (b) { e.preventDefault(); me.then(function (m) { historyDialog(b.getAttribute("data-id"), level(m) >= 2); }); }
  });

  // ------------------------------------------------------------ accountknoppen in de kop
  function mountAccount(m) {
    if (m.opslag && m.opslag.vast === false) {
      var wb = el("div", { class: "fw-warn-disk", role: "alert" }, [el("b", { text: "Let op, beheerder: " }), "de database staat niet op een vaste schijf (" + m.opslag.pad + "). Bij elke nieuwe versie gaan alle paarden en accounts verloren. Koppel in Render een Disk op " + m.opslag.pad + " en maak nu een export."]);
      var hd = document.querySelector("header.top"); if (hd && hd.parentNode) hd.parentNode.insertBefore(wb, hd.nextSibling);
    }
    var side = document.querySelector("header.top .hdr-side") || document.querySelector("header.top");
    if (!side) return;
    var g = m.gebruiker;
    // De Claude-versie toont "Eigenaar - Beheerder"; op de website komt daar het echte account.
    var al = document.getElementById("adminLink");
    if (al && al.parentNode) al.parentNode.removeChild(al);
    if (!al) al = el("button", { type: "button", class: "fw-lnk", id: "adminLink", text: "Beheer" });
    var aw = document.getElementById("artWho");
    if (aw) aw.parentNode.removeChild(aw);
    function who() { return el("span", { class: "fw-who" }, [el("b", { text: g.naam }), " - " + (ROL_LABEL[g.rol] || g.rol) + (g.partner && g.rol !== "beheerder" ? " · Partner" : "")]); }
    function pwBtn() { var b = el("button", { class: "fw-lnk", type: "button", text: "Wachtwoord" }); b.addEventListener("click", passwordDialog); return b; }
    function outBtn() { var b = el("button", { class: "fw-lnk", type: "button", text: "Uitloggen" }); b.addEventListener("click", function () { api("POST", "/api/auth/logout", {}).then(function () { location.reload(); }); }); return b; }
    function inBtns(target) {
      var lb = el("button", { class: "fw-lnk strong", type: "button", text: "Inloggen" });
      lb.addEventListener("click", function () { loginDialog(m, "inloggen"); });
      target.appendChild(lb);
      if (m.registratie) {
        var rb = el("button", { class: "fw-lnk", type: "button", text: "Account maken" });
        rb.addEventListener("click", function () { loginDialog(m, "registreren"); });
        target.appendChild(rb);
      }
    }
    var box = el("div", { class: "fw-acct" });
    // Ook rechtsboven op de Beheer-pagina: wie is ingelogd, met in- en uitloggen.
    var acc = document.getElementById("adminAcct");
    if (acc) { acc.textContent = ""; acc.className = "fw-acct"; }
    if (g) {
      box.appendChild(who());
      if (g.rol === "beheerder") {
        if (al) box.appendChild(al);
        var ax = document.getElementById("adminExtra");
        if (ax && !ax.firstChild) {
          var ucard = el("div", { class: "card", style: "margin-bottom:12px" });
          var h = el("h3", { text: "Gebruikers en rollen", style: "margin:0 0 6px" });
          ucard.appendChild(h); ax.appendChild(ucard);
          usersPanel(m, ucard, function (open, n) {
            h.textContent = "Gebruikers en rollen (" + n + ")";
          });
        }
      }
      box.appendChild(pwBtn()); box.appendChild(outBtn());
      if (acc) { acc.appendChild(el("span", { class: "small muted", text: "Ingelogd als" })); acc.appendChild(who()); acc.appendChild(pwBtn()); acc.appendChild(outBtn()); }
    } else {
      inBtns(box);
      if (acc) inBtns(acc);
    }
    side.insertBefore(box, side.firstChild);
  }
  // Knoppen in de app (bv. op Paarden beheren): account maken, inloggen, paarden-beheerder worden.
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-acct]");
    if (!b) return;
    e.preventDefault();
    var a = b.getAttribute("data-acct");
    me.then(function (m) {
      if (a === "inloggen") loginDialog(m, "inloggen");
      else if (a === "registreren" || a === "registreren-pb" || a === "registreren-partner") loginDialog(m, "registreren", a === "registreren-pb", a === "registreren-partner");
      else if (a === "word-partner") {
        b.disabled = true;
        api("POST", "/api/auth/partner", {}).then(function () { location.reload(); }, function (err) { b.disabled = false; var st = document.getElementById("ptStatus"); if (st) fail(st, err); });
      }
      else if (a === "word-pb") {
        b.disabled = true;
        api("POST", "/api/auth/word-paardenbeheerder", {}).then(function () { location.reload(); }, function (err) { b.disabled = false; var st = document.getElementById("pbStatus"); if (st) fail(st, err); });
      }
    });
  });
  function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(function () { me.then(mountAccount); });
})();
