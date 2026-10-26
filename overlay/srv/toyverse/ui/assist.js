/* ToyMesh-Setup-Assistent in zwei Tonlagen: "fun" (lustig, animiert) und "serious" (seriös).
 * Je Oberfläche eigene Farben, Figur, Animation und Texte. Erklärungen können optional vorgelesen werden
 * (Web Speech API, nur wenn das Gerät sie anbietet, Standard aus). Alle Texte per textContent, kein innerHTML.
 * Speicher: toymesh.assist.tone, toymesh.assist.voice, toymesh.ui, toymesh.privacy (try/catch). */
(function () {
  "use strict";

  var KEY_TONE = "toymesh.assist.tone", KEY_VOICE = "toymesh.assist.voice";
  var KEY_UI = "toymesh.ui", KEY_PRIV = "toymesh.privacy", KEY_DONE = "toymesh.setupDone";

  // Je Oberfläche: Figur (mascot), Animation (anim), Lustig-Motto, Seriös-Beschreibung
  var UIS = [
    { id: "toyclassic", name: "ToyClassic", mascot: "square", anim: "slide",
      fun: "Willkommen im Klassiker: alles hat seinen Platz.", serious: "Taskleiste, Startmenü und Desktop-Symbole." },
    { id: "toyaqua", name: "ToyAqua", mascot: "drop", anim: "drop",
      fun: "Glas, Wasser, Ruhe. Fast wie ein Aquarium.", serious: "Glasoptik mit Menüleiste und Dock." },
    { id: "toyquest", name: "ToyQuest", mascot: "arch", anim: "zoom",
      fun: "Dein Abenteuer beginnt. Mission 1: Einrichtung!", serious: "Kartenansicht mit Orten und Missionen." },
    { id: "toyplasma", name: "ToyPlasma", mascot: "ring", anim: "spin",
      fun: "Plasma-Power! In einer Minute startklar.", serious: "Panel mit App-Menü, Suche und Widgets." },
    { id: "toysafe", name: "ToySafe", mascot: "shield", anim: "pulse",
      fun: "Dein Schild ist aufgeladen. Wir richten ihn gemeinsam ein.", serious: "Sicherheits-Cockpit mit Status, Apps und Hinweisen." },
    { id: "toytiles", name: "ToyTiles", mascot: "cube", anim: "flip",
      fun: "Tipp, tipp, fertig. Alles mit dem Daumen!", serious: "Große Kacheln, für die Bedienung per Touch." },
    { id: "toyguide", name: "ToyGuide", mascot: "dot", anim: "bounce",
      fun: "Ich führe dich Schritt für Schritt. Versprochen!", serious: "Schritt-für-Schritt-Führung für den Einstieg." },
    { id: "toyfocus", name: "ToyFocus", mascot: "dot", anim: "pulse",
      fun: "Ganz ruhig. Nur das Nötige, nichts Ablenkendes.", serious: "Minimal: eine Liste, Suche, keine Ablenkung." },
    { id: "toydroid", name: "ToyDroid", mascot: "card", anim: "bounce",
      fun: "Hallo! Ich bin dein neuer Startbildschirm.", serious: "Startbildschirm mit Widget, Dock und App-Schublade." },
    { id: "toydesk", name: "ToyDesk", mascot: "bar", anim: "drop",
      fun: "Heute geht's los. Aufgaben und Notizen sind bereit.", serious: "Für die Arbeit: Start, Aufgaben, Notizen und ToyPost." }
  ];

  // Texte je Schritt und Tonlage. {name} wird durch den Oberflächennamen ersetzt, sofern nötig.
  var TXT = {
    fun: {
      welcome: ["Hallo!", "Ich helfe dir, ToyMesh einzurichten. Das dauert keine fünf Minuten."],
      ui: ["Dein Look", "Such dir eine Oberfläche aus. Du kannst jederzeit wechseln."],
      open: ["Der Auftritt", "Beim Start darf ein kleiner Film laufen. Oder du lässt ihn weg."],
      priv: ["Wie neugierig?", "Wie viel dürfen Webseiten von dir wissen? Du entscheidest."],
      safe: ["Der Schutz-Check", "Ich prüfe später, ob alles dicht ist. Das Ergebnis ist eine Ampel."],
      done: ["Geschafft!", "ToyMesh ist bereit. Alle Einstellungen findest du im BIOS."]
    },
    serious: {
      welcome: ["Willkommen", "Dieser Assistent richtet Oberfläche, Begrüßung und Datenschutz ein. Dauer etwa fünf Minuten."],
      ui: ["Oberfläche", "Wähle die Oberfläche. Sie lässt sich jederzeit im BIOS ändern."],
      open: ["Begrüßung", "Lege fest, ob beim Start eine Begrüßung gezeigt wird und in welcher Reihenfolge."],
      priv: ["Datenschutz", "Standard ist für den Alltag empfohlen. Streng schützt stärker. Maximum ist am strengsten und langsamer."],
      safe: ["Schutz-Prüfung", "Die Prüfung zeigt Verschlüsselung, Firewall, Updates und Schlüssel als Ampel. Sie warnt nur und sperrt nichts."],
      done: ["Abgeschlossen", "Die Einrichtung ist beendet. Alle Einstellungen findest du im BIOS."]
    }
  };
  var PRIV = [
    ["standard", "Standard", "Empfohlen für den Alltag: Tracking-Schutz, HTTPS, DNS über HTTPS."],
    ["streng", "Streng", "Zusätzlich Fingerprint-Schutz. Kann einzelne Seiten stören."],
    ["maximum", "Maximum", "Strengste Einstellungen plus Tor-Routing. Langsamer."]
  ];
  var STEPS = ["welcome", "ui", "open", "priv", "safe", "done"];

  var ST = { i: 0, tone: "serious", voice: false, ui: "toyclassic", onUi: null, onDone: null };
  var root = null, box = null;

  // Pfad zu ui/ aus der Skriptdatei, damit das 3D-Modul auch aus ToyBIOS geladen wird
  var UI_BASE = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/assist\.js[^/]*$/, "") : "ui/";
  })();
  var fig3d = null, figToken = 0;

  function disposeFig() {
    figToken++;
    pendingAct = null;
    if (fig3d) { try { fig3d.dispose(); } catch (e) { /* egal */ } fig3d = null; }
  }

  // Lustige Fassung: 3D-Figur, wenn WebGL da ist. Sonst bleibt die 2D-Figur.
  function mount3d(fig, uiId) {
    var tok = ++figToken;
    import(UI_BASE + "figure3d.js").then(function (m) {
      if (tok !== figToken || !fig.isConnected || ST.tone !== "fun") return;
      fig.classList.add("as-fig3d");
      fig.textContent = "";
      var r = m.mount(fig, uiId);
      if (!r) { // ohne WebGL: 2D-Figur wiederherstellen
        fig.classList.remove("as-fig3d");
        fig.textContent = "";
        fig.appendChild(n("i"));
        return;
      }
      fig3d = r;
      if (pendingAct) { r.play(pendingAct); pendingAct = null; }
    }).catch(function () { /* Modul nicht ladbar: 2D-Figur bleibt */ });
  }

  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } }
  function uiDef(id) { for (var i = 0; i < UIS.length; i++) if (UIS[i].id === id) return UIS[i]; return UIS[0]; }

  function n(tag, o, kids) {
    var e = document.createElement(tag);
    o = o || {};
    if (o.cls) e.className = o.cls;
    if (o.t != null) e.textContent = o.t;
    if (o.attr) for (var a in o.attr) e.setAttribute(a, o.attr[a]);
    if (o.on) for (var ev in o.on) e.addEventListener(ev, o.on[ev]);
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  // ---------- Sprachausgabe (optional, nur wenn das Gerät sie anbietet) ----------
  var canSpeak = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";

  function say(text) {
    if (!canSpeak || !ST.voice) return;
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(text);
      u.lang = "de-DE";
      u.rate = ST.tone === "fun" ? 1.05 : 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) { /* Sprachausgabe fehlgeschlagen: egal */ }
  }
  function stopSpeak() {
    try { if (canSpeak) window.speechSynthesis.cancel(); } catch (e) { /* egal */ }
  }

  // ---------- Aufbau ----------
  function ensureRoot() {
    if (root) return;
    box = n("div", { cls: "as-b" });
    var head = n("div", { cls: "as-h" });
    var fig = n("div", { cls: "as-fig" }, [n("i")]);
    root = n("div", { cls: "as-ov", attr: { hidden: "" } }, [
      n("div", { cls: "as", attr: { role: "dialog", "aria-modal": "true", "aria-label": "Einrichtungs-Assistent" } }, [
        head, n("div", { cls: "as-step" }), box, n("div", { cls: "as-nav" })
      ])
    ]);
    root.querySelector(".as").__head = head;
    root.querySelector(".as").__fig = fig;
    document.body.appendChild(root);
    document.addEventListener("keydown", function (e) {
      if (!root.hidden && e.key === "Escape") { e.stopPropagation(); close(); }
    }, true);
  }

  function paint() {
    var as = root.querySelector(".as");
    var ui = uiDef(ST.ui);
    as.setAttribute("data-ui", ui.id);
    as.setAttribute("data-tone", ST.tone);
    as.setAttribute("data-anim", ui.anim);
    var head = as.__head;
    head.textContent = "";
    disposeFig();
    var fig = n("div", { cls: "as-fig", attr: { "data-mascot": ui.mascot } }, [n("i")]);
    as.__fig = fig;
    head.appendChild(fig);
    if (ST.tone === "fun") mount3d(fig, ui.id);
    var key = STEPS[ST.i];
    var title = TXT[ST.tone][key][0];
    head.appendChild(n("div", {}, [
      n("p", { cls: "as-t", t: title }),
      n("p", { cls: "as-s", t: ST.tone === "fun" ? ui.fun : ui.serious })
    ]));
    as.querySelector(".as-step").textContent = "Schritt " + (ST.i + 1) + " von " + STEPS.length + " · " + ui.name;
    box.textContent = "";
    var body = n("div");
    box.appendChild(body);
    renderStep(key, body);
    renderNav();
    say(title + ". " + TXT[ST.tone][key][1]);
  }

  function explain(body, text) {
    body.appendChild(n("p", { t: text }));
    if (canSpeak) {
      body.appendChild(n("button", { cls: "say", t: "Vorlesen", attr: { "aria-label": "Erklärung vorlesen" }, on: { click: function () { say(text); } } }));
    }
  }

  function renderStep(key, body) {
    var txt = TXT[ST.tone][key][1];
    if (key === "welcome") {
      explain(body, txt);
      var tones = [["fun", "Lustig", "Mit Figur und kleinen Animationen."], ["serious", "Seriös", "Ruhig und sachlich, ohne Animation."]];
      tones.forEach(function (t) {
        var r = n("input", { attr: { type: "radio", name: "tone", value: t[0] } });
        r.checked = ST.tone === t[0];
        r.addEventListener("change", function () { ST.tone = t[0]; set(KEY_TONE, t[0]); paint(); });
        body.appendChild(n("label", { cls: "as-card" }, [r, n("div", {}, [n("b", { t: t[1] }), n("small", { t: t[2] })])]));
      });
      if (canSpeak) {
        var v = n("input", { attr: { type: "checkbox", id: "voice" } });
        v.checked = ST.voice;
        v.addEventListener("change", function () { ST.voice = v.checked; set(KEY_VOICE, v.checked ? "1" : "0"); if (!v.checked) stopSpeak(); });
        body.appendChild(n("label", { cls: "as-card" }, [v, n("div", {}, [n("b", { t: "Erklärungen vorlesen" }), n("small", { t: "Liest jede Erklärung vor. Nutzt die Stimme des Geräts." })])]));
      } else {
        body.appendChild(n("p", { cls: "hint", t: "Vorlesen ist auf diesem Gerät nicht verfügbar." }));
      }
    }

    if (key === "ui") {
      explain(body, txt);
      var grid = n("div", { cls: "as-ui" });
      UIS.forEach(function (u) {
        var b = n("button", { attr: { type: "button", "aria-pressed": ST.ui === u.id ? "true" : "false" }, on: { click: function () {
          ST.ui = u.id; set(KEY_UI, u.id); if (ST.onUi) ST.onUi(u.id); paint();
        } } }, [n("b", { t: u.name }), n("small", { t: ST.tone === "fun" ? u.fun : u.serious })]);
        grid.appendChild(b);
      });
      body.appendChild(grid);
    }

    if (key === "open") {
      explain(body, txt);
      if (window.ToyOpeners) window.ToyOpeners.panel(body, n);
      else body.appendChild(n("p", { cls: "hint", t: "Begrüßung ist auf diesem Gerät nicht verfügbar." }));
    }

    if (key === "priv") {
      explain(body, txt);
      var cur = get(KEY_PRIV, "streng");
      PRIV.forEach(function (p) {
        var r = n("input", { attr: { type: "radio", name: "priv", value: p[0] } });
        r.checked = cur === p[0];
        r.addEventListener("change", function () { set(KEY_PRIV, p[0]); });
        body.appendChild(n("label", { cls: "as-card" }, [r, n("div", {}, [n("b", { t: p[1] }), n("small", { t: p[2] })])]));
      });
    }

    if (key === "safe") {
      explain(body, txt);
      body.appendChild(n("p", { cls: "hint", t: "Starten kannst du die Prüfung später im BIOS oder mit dem Befehl toysafe-check." }));
    }

    if (key === "done") {
      explain(body, txt);
      var u = uiDef(ST.ui);
      body.appendChild(n("p", { t: "Oberfläche: " + u.name + " · Datenschutz: " + get(KEY_PRIV, "streng") + " · Begrüßung: " + (window.ToyOpeners ? "wie eingestellt" : "aus") + "." }));
    }
  }

  function renderNav() {
    var nav = root.querySelector(".as-nav");
    nav.textContent = "";
    var last = ST.i === STEPS.length - 1;
    var fun = ST.tone === "fun";
    var back = n("button", { t: "Zurück", on: { click: function () { go(-1); } } });
    back.disabled = ST.i === 0;
    var skip = n("button", { t: "Abbrechen", on: { click: close } });
    var next = n("button", { cls: "pri", t: last ? (fun ? "Los geht's!" : "Abschließen") : (fun ? "Weiter!" : "Weiter"), on: { click: function () {
      if (last) finish(); else go(1);
    } } });
    nav.appendChild(back);
    nav.appendChild(skip);
    nav.appendChild(next);
    next.focus();
  }

  // Lustige Fassung: die 3D-Figur führt eine Aktion aus (sonst nichts)
  // Ist die Figur noch nicht geladen, wird die Aktion gemerkt und nach dem Laden abgespielt.
  var pendingAct = null;
  function act(name) {
    if (ST.tone !== "fun") return;
    if (fig3d && fig3d.play) fig3d.play(name); else pendingAct = name;
  }

  function go(d) {
    stopSpeak();
    ST.i = Math.max(0, Math.min(STEPS.length - 1, ST.i + d));
    paint();                                   // baut die Figur neu auf
    if (d > 0) act(["punch", "kick", "jump"][Math.floor(Math.random() * 3)]);
  }

  function finish() {
    stopSpeak();
    set(KEY_DONE, "1");
    if (ST.onDone) ST.onDone();
    act("victory");
    // Erst nach dem Jubel ausblenden, und danach die 3D-Figur freigeben
    setTimeout(function () { if (root && !root.hidden) close(); }, fig3d && ST.tone === "fun" ? 1800 : 0);
  }

  function close() {
    stopSpeak();
    disposeFig();
    if (root) root.hidden = true; // vor dem ersten Öffnen gibt es noch keine Oberfläche
  }

  // open({onUi, onDone}): zeigt den Assistenten. onUi(id) wird bei Oberflächenwahl aufgerufen,
  // onDone() beim Abschluss.
  function open(opts) {
    opts = opts || {};
    ensureRoot();
    ST.tone = get(KEY_TONE, "serious") === "fun" ? "fun" : "serious";
    ST.voice = canSpeak && get(KEY_VOICE, "0") === "1";
    ST.ui = uiDef(get(KEY_UI, "toyclassic")).id;
    ST.onUi = opts.onUi || null;
    ST.onDone = opts.onDone || null;
    ST.i = 0;
    root.hidden = false;
    paint();
  }

  window.ToyAssist = { open: open, close: close, UIS: UIS.map(function (u) { return { id: u.id, name: u.name }; }) };
})();
