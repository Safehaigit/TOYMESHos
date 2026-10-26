/* ToyMesh shell: acht wählbare Oberflächen auf einer gemeinsamen App-Liste.
 * Reines HTML/CSS/JS, keine externen Anfragen. Auswahl in localStorage (mit try/catch). */
(function () {
  "use strict";

  var KEY_UI = "toymesh.ui", KEY_DONE = "toymesh.setupDone", KEY_PRIV = "toymesh.privacy";
  var LBL = { live: "Live", dev: "In Entwicklung", planned: "In Planung", concept: "Konzept" };

  // Die acht Oberflächen. "layout" wählt den Renderer, das CSS wählt die Optik.
  var UIS = [
    { id: "toyclassic", name: "ToyClassic", layout: "desktop",
      by: "Taskleiste unten, Startmenü, Desktop-Symbole (Desktop-Prinzip)" },
    { id: "toyaqua", name: "ToyAqua", layout: "dock",
      by: "Menüleiste oben, schwebendes Dock unten, Glas-Optik" },
    { id: "toyquest", name: "ToyQuest", layout: "quest",
      by: "Karte mit Orten statt Menüs, Missionen im 1001-Nacht-Stil" },
    { id: "toyplasma", name: "ToyPlasma", layout: "plasma",
      by: "Panel mit App-Menü und Suche, Widgets auf dem Desktop (Plasma-Prinzip)" },
    { id: "toysafe", name: "ToySafe", layout: "safe",
      by: "Sicherheits-Cockpit mit Status-Karten, Apps und Hinweisen" },
    { id: "toytiles", name: "ToyTiles", layout: "tiles",
      by: "Große Kacheln, touch-first, Ein-Hand-Bedienung" },
    { id: "toyguide", name: "ToyGuide", layout: "guide",
      by: "Schritt-für-Schritt-Assistent mit Seitenleiste, für Einsteiger" },
    { id: "toyfocus", name: "ToyFocus", layout: "focus",
      by: "Minimal: eine Liste, Suche mit Strg+K, keine Ablenkung" },
    { id: "toydroid", name: "ToyDroid", layout: "droid",
      by: "Startbildschirm mit Widget und Dock, App-Schublade, Übersicht (Android-Prinzip, Material-3-Gestaltung)" },
    { id: "toydesk", name: "ToyDesk", layout: "desk",
      by: "Für die Arbeit: Start, Aufgaben, Notizen, ToyPost (Heute, Vorgänge, Posteingang, Prüfen), Apps" }
  ];

  var S = { apps: [], ui: "toyclassic", privacy: "streng", search: null, recent: [] };
  var W = { i: 0, steps: ["Willkommen", "Oberfläche", "Datenschutz", "Fertig"] };

  // ---------- Hilfsfunktionen ----------
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* Speicher gesperrt: egal */ } }
  function def(id) { for (var i = 0; i < UIS.length; i++) if (UIS[i].id === id) return UIS[i]; return UIS[0]; }
  function $(id) { return document.getElementById(id); }

  // n("div", {cls, t, attr, on}, [kinder])  – baut DOM ohne innerHTML (kein XSS-Risiko)
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

  function clockEl(cls) {
    var e = n("span", { cls: cls || "clk" });
    function tick() { e.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
    tick(); setInterval(tick, 15000);
    return e;
  }

  function matches(a, q) { return !q || ((a.name || "") + " " + (a.desc || "")).toLowerCase().indexOf(q) > -1; }

  function ico(a, cls) {
    return n("button", { cls: "ico " + (cls || ""), attr: { type: "button", title: a.name },
      on: { click: function () { openApp(a); } } },
      [a.icon
        ? n("span", { cls: "ico-g ico-img" }, [n("img", { attr: { src: a.icon, alt: "", width: "64", height: "64", decoding: "async" } })])
        : n("span", { cls: "ico-g", t: initials(a.name) }),
       n("span", { cls: "ico-l", t: a.name })]);
  }

  // Kürzel aus dem Namen ohne "Toy": ToySafe -> SA, ToyVerse -> VE, ToySearch -> SE, TOYPAY -> PA
  function initials(name) {
    var s = String(name || "?").replace(/^toy/i, "");
    return (s.slice(0, 2) || "?").toUpperCase();
  }

  // ---------- App-Fenster (gemeinsam für alle Oberflächen) ----------
  function openApp(a) {
    // type "desk": App ist in ToyDesk eingebaut (z. B. ToyPost). Wechselt für
    // diese Sitzung zu ToyDesk und öffnet die Ansicht, ohne die Wahl zu speichern.
    if (a.type === "desk") {
      S.deskView = a.entry;
      S.ui = "toydesk";
      $("uisel").value = S.ui;
      render();
      return;
    }
    $("win-t").textContent = a.name + " · " + (LBL[a.status] || "");
    S.recent = [a].concat(S.recent.filter(function (x) { return x.id !== a.id; })).slice(0, 6);
    $("win-f").src = a.entry;
    $("win").hidden = false;
    $("win-x").focus();
  }
  function closeWin() { $("win").hidden = true; $("win-f").src = "about:blank"; }

  // ---------- Layouts: je eine Funktion, die in #root rendert ----------
  var L = {};

  // ToyClassic: Desktop-Symbole, Taskleiste, Startmenü
  L.desktop = function (root, apps) {
    var menu = n("div", { cls: "startmenu", attr: { hidden: "" } }, apps.map(function (a) {
      return n("button", { cls: "sm-i", t: a.name + "  ·  " + (LBL[a.status] || ""),
        on: { click: function () { menu.hidden = true; openApp(a); } } });
    }));
    root.appendChild(n("div", { cls: "desk" }, apps.map(function (a) { return ico(a); })));
    root.appendChild(menu);
    root.appendChild(n("div", { cls: "taskbar" }, [
      n("button", { cls: "tb-start", t: "Start", on: { click: function () { menu.hidden = !menu.hidden; } } }),
      n("div", { cls: "tb-apps" }, apps.slice(0, 5).map(function (a) {
        return n("button", { cls: "tb-i", t: a.name, on: { click: function () { openApp(a); } } });
      })),
      clockEl()
    ]));
  };

  // ToyAqua: Menüleiste oben, Dock unten
  L.dock = function (root, apps) {
    root.appendChild(n("div", { cls: "menubar" }, [
      n("b", { t: "ToyMesh" }), n("span", { cls: "mb-s", t: "Ablage · Ansicht · Hilfe" }),
      n("span", { cls: "sp" }), clockEl()
    ]));
    root.appendChild(n("div", { cls: "desk" }, apps.filter(function (a) { return a.type === "local"; })
      .map(function (a) { return ico(a, "big"); })));
    root.appendChild(n("div", { cls: "dock" }, apps.map(function (a) { return ico(a, "dk"); })));
  };

  // ToyPlasma: Panel mit App-Menü + Suche, Widgets
  L.plasma = function (root, apps) {
    var search = n("input", { cls: "fsearch", attr: { type: "search", placeholder: "Anwendungen suchen…", "aria-label": "Suche" } });
    var list = n("div", { cls: "km-l" });
    function fill() {
      var q = search.value.toLowerCase();
      list.textContent = "";
      apps.filter(function (a) { return matches(a, q); }).forEach(function (a) {
        list.appendChild(n("button", { cls: "km-i", t: a.name + "  ·  " + (LBL[a.status] || ""),
          on: { click: function () { menu.hidden = true; openApp(a); } } }));
      });
    }
    search.addEventListener("input", fill);
    var menu = n("div", { cls: "kmenu", attr: { hidden: "" } }, [search, list]);
    fill();
    root.appendChild(n("div", { cls: "widgets" }, [
      n("div", { cls: "widget" }, [n("div", { cls: "clkw", t: "" }), n("small", { cls: "mu", t: "Uhrzeit" })]),
      n("div", { cls: "widget" }, [n("b", { t: "Schnellzugriff" }),
        n("div", { cls: "desk qk" }, apps.slice(0, 4).map(function (a) { return ico(a); }))])
    ]));
    // Uhr-Widget mit echter Zeit füllen
    var w = root.querySelector(".clkw"); if (w) w.appendChild(clockEl("clk-big"));
    root.appendChild(menu);
    root.appendChild(n("div", { cls: "panel" }, [
      n("button", { cls: "pn-menu", t: "Menü", on: { click: function () { menu.hidden = !menu.hidden; if (!menu.hidden) search.focus(); } } }),
      n("div", { cls: "pn-tasks" }, apps.slice(0, 4).map(function (a) {
        return n("button", { cls: "tb-i", t: a.name, on: { click: function () { openApp(a); } } });
      })),
      n("button", { cls: "tb-i", t: "Assistent", on: { click: openWizard } }),
      clockEl()
    ]));
  };

  // ToyQuest: Karte mit Orten, Missionskarte
  L.quest = function (root, apps) {
    var map = n("div", { cls: "qmap" });
    var card = n("div", { cls: "qcard" }, [n("p", { cls: "hint", t: "Wähle einen Ort auf der Karte." })]);
    function show(a) {
      card.textContent = "";
      card.appendChild(n("h3", { t: a.name }));
      card.appendChild(n("p", { t: a.desc || "" }));
      card.appendChild(n("span", { cls: "badge", t: LBL[a.status] || "" }));
      card.appendChild(n("div", null, [n("button", { cls: "qgo", t: "Betreten", on: { click: function () { openApp(a); } } })]));
    }
    apps.forEach(function (a, i) {
      var x = 12 + (i % 4) * 22 + (Math.floor(i / 4) % 2) * 6;
      var y = 18 + Math.floor(i / 4) * 40;
      map.appendChild(n("button", { cls: "qnode", t: a.name, attr: { style: "left:" + x + "%;top:" + y + "%" },
        on: { click: function () { show(a); } } }));
    });
    root.appendChild(n("h2", { cls: "qtitle", t: "Die Welt von ToyVerse" }));
    root.appendChild(map);
    root.appendChild(card);
  };

  // ToySafe: Status-Karten, Apps, Hinweise. Ehrlich: Werte sind Konfiguration, keine Live-Messung.
  L.safe = function (root, apps) {
    var st = [
      ["Firewall", "nftables · standardmäßig alles blockieren"],
      ["Verschlüsselung", "LUKS-Datenpartition (beim Build)"],
      ["Updates", "System wöchentlich · Apps täglich"],
      ["Browser", "ToySurf · Tracking-Schutz, HTTPS-Only"]
    ];
    root.appendChild(n("div", { cls: "safe-h", t: "Konfiguration" }));
    root.appendChild(n("div", { cls: "scards" }, st.map(function (s) {
      return n("div", { cls: "scard" }, [n("b", { t: s[0] }), n("small", { t: s[1] })]);
    })));
    root.appendChild(n("div", { cls: "safe-h", t: "Apps" }));
    root.appendChild(n("div", { cls: "desk" }, apps.map(function (a) { return ico(a); })));
    root.appendChild(n("div", { cls: "safe-h", t: "Hinweise" }));
    root.appendChild(n("div", { cls: "note", t: "Keine Hinweise vorliegend. Eine Live-Prüfung des Laufzeitstatus ist noch nicht eingebaut; die Karten oben beschreiben die Konfiguration." }));
  };

  // ToyTiles: große Kacheln
  L.tiles = function (root, apps) {
    root.appendChild(n("div", { cls: "tgrid" }, apps.map(function (a, i) {
      var t = n("button", { cls: "tile t" + (i % 6) + (a.icon ? " tile-ico" : ""), on: { click: function () { openApp(a); } } },
        [a.icon ? n("img", { attr: { src: a.icon, alt: "", width: "56", height: "56", decoding: "async" } }) : null,
         n("b", { t: a.name }), n("small", { t: LBL[a.status] || "" })]);
      if (a.color && /^#[0-9A-Fa-f]{6}$/.test(a.color)) t.style.background = a.color;
      return t;
    }).concat([n("button", { cls: "tile t0", on: { click: openWizard } }, [n("b", { t: "Assistent" }), n("small", { t: "Einrichtung" })])])));
  };

  // ToyGuide: Assistent mit Schritten
  L.guide = function (root, apps) {
    var steps = [
      { t: "Willkommen", p: "ToyMesh ist dein Gerät für ToyVerse. Dieser Assistent zeigt dir die wichtigsten Schritte." },
      { t: "Apps öffnen", p: "Klicke auf eine App. Sie öffnet sich in einem Fenster; mit ✕ schließt du sie.", apps: true },
      { t: "Sicher surfen", p: "Nutze ToySurf für Webseiten. Die Startseite ist ToySearch: erst lokal in deinen ToyVerse-Inhalten suchen, Web-Suche nur auf deinen Klick." },
      { t: "Updates & Sicherheit", p: "Die Firewall blockt eingehende Verbindungen standardmäßig. Apps aktualisieren sich täglich, das System wöchentlich. Details in SECURITY.md." }
    ];
    var i = 0;
    var side = n("ol", { cls: "gsteps" });
    var body = n("div", { cls: "gbody" });
    function show() {
      side.textContent = "";
      steps.forEach(function (s, k) {
        side.appendChild(n("li", { cls: k === i ? "on" : "", t: (k + 1) + ". " + s.t,
          on: { click: function () { i = k; show(); } } }));
      });
      body.textContent = "";
      body.appendChild(n("h2", { t: steps[i].t }));
      body.appendChild(n("p", { t: steps[i].p }));
      if (steps[i].apps) body.appendChild(n("div", { cls: "desk" }, apps.map(function (a) { return ico(a); })));
      var back = n("button", { t: "Zurück", on: { click: function () { i--; show(); } } });
      var next = n("button", { t: i === steps.length - 1 ? "Fertig" : "Weiter",
        on: { click: function () { if (i < steps.length - 1) { i++; show(); } } } });
      if (i === 0) back.disabled = true;
      body.appendChild(n("div", { cls: "gnav" }, [back, next]));
    }
    show();
    root.appendChild(n("div", { cls: "guide" }, [side, body]));
  };

  // ToyFocus: minimal, Suche + Liste
  L.focus = function (root, apps) {
    var q = n("input", { cls: "fsearch", attr: { type: "search", placeholder: "Suchen oder öffnen… (Strg+K)", "aria-label": "Suche" } });
    var list = n("ul", { cls: "flist" });
    function fill() {
      var t = q.value.toLowerCase();
      list.textContent = "";
      apps.filter(function (a) { return matches(a, t); }).forEach(function (a) {
        list.appendChild(n("li", null, [n("button", { cls: "fi", on: { click: function () { openApp(a); } } },
          [n("b", { t: a.name }), n("span", { t: a.desc ? " " + a.desc : "" })])]));
      });
    }
    q.addEventListener("input", fill);
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var f = list.querySelector("button"); if (f) f.click(); }
    });
    fill();
    S.search = q;
    root.appendChild(q);
    root.appendChild(list);
  };

  // ToyDroid: Startbildschirm mit Uhr-Widget, Dock, App-Schublade, Übersicht, Gesten-Leiste
  L.droid = function (root, apps) {
    var clockBig = n("div", { cls: "dr-clock" });
    function tick() { clockBig.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
    tick(); setInterval(tick, 15000);
    var dateLine = n("div", { cls: "mu", t: new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) });
    var over = n("div", { cls: "dr-over", attr: { hidden: "" } });

    function closeOver() { over.hidden = true; over.textContent = ""; }
    function fillDrawer() {
      var q = n("input", { cls: "fsearch", attr: { type: "search", placeholder: "Apps suchen…", "aria-label": "Suche" } });
      var grid = n("div", { cls: "dr-grid dr-all" });
      function f() {
        var t = q.value.toLowerCase();
        grid.textContent = "";
        apps.filter(function (a) { return matches(a, t); }).forEach(function (a) { grid.appendChild(ico(a)); });
      }
      q.addEventListener("input", f); f();
      over.appendChild(n("div", { cls: "dr-overhead" }, [n("button", { t: "Schließen", on: { click: closeOver } })]));
      over.appendChild(n("div", { cls: "dr-pad" }, [q, grid]));
    }
    function fillRecents() {
      over.appendChild(n("div", { cls: "dr-overhead" }, [n("button", { t: "Schließen", on: { click: closeOver } })]));
      var items = S.recent.length
        ? S.recent.map(function (a) {
            return n("button", { cls: "dr-rc", t: a.name + "  ·  " + (LBL[a.status] || ""),
              on: { click: function () { closeOver(); openApp(a); } } });
          })
        : [n("p", { cls: "mu", t: "Noch keine App geöffnet." })];
      over.appendChild(n("div", { cls: "dr-pad" }, items));
    }
    function openOver(kind) {
      over.textContent = "";
      over.hidden = false;
      if (kind === "drawer") fillDrawer(); else fillRecents();
    }

    var home = n("div", { cls: "dr-home" }, [
      n("div", { cls: "dr-widget" }, [clockBig, dateLine]),
      n("div", { cls: "dr-grid" }, apps.slice(4).map(function (a) { return ico(a); }))
    ]);
    var screen = n("div", { cls: "dr-screen" }, [home, over]);
    root.appendChild(n("div", { cls: "dr-status" }, [n("span", { t: "ToyMesh" }), clockEl()]));
    root.appendChild(screen);
    root.appendChild(n("div", { cls: "dr-dock" }, apps.slice(0, 4).map(function (a) { return ico(a, "dk"); })));
    root.appendChild(n("div", { cls: "dr-nav" }, [
      n("button", { t: "◀ Zurück", on: { click: closeOver } }),
      n("button", { t: "● Home", on: { click: closeOver } }),
      n("button", { t: "▲ Apps", on: { click: function () { openOver("drawer"); } } }),
      n("button", { t: "■ Übersicht", on: { click: function () { openOver("recent"); } } })
    ]));
  };

  // ToyDesk: Arbeitsoberfläche mit Seitenleiste. Aufgaben und Notizen sind lokal gespeichert.
  L.desk = function (root, apps) {
    var NAV = [["start", "Start"], ["tasks", "Aufgaben"], ["notes", "Notizen"], ["post", "ToyPost"], ["apps", "Apps"]];
    var view = S.deskView || "start";
    S.deskView = null;
    var nav = n("nav", { cls: "dsk-nav" });
    var main = n("main", { cls: "dsk-main" });

    function tasks() {
      try { var v = JSON.parse(get("toymesh.desk.tasks", "[]")); return Array.isArray(v) ? v : []; }
      catch (e) { return []; }
    }
    function saveTasks(t) { set("toymesh.desk.tasks", JSON.stringify(t)); }
    function go(v) { view = v; draw(); }

    function vStart() {
      var h = new Date().getHours();
      var greet = h < 11 ? "Guten Morgen" : (h < 18 ? "Guten Tag" : "Guten Abend");
      var open = tasks().filter(function (t) { return !t.done; }).length;
      var search = apps.filter(function (a) { return a.id === "toysearch"; })[0];
      return n("section", null, [
        n("h2", { t: greet }),
        n("p", { cls: "mu", t: "Offene Aufgaben: " + open }),
        n("div", { cls: "dsk-cards" }, [
          n("button", { cls: "dsk-card", on: { click: function () { go("tasks"); } } }, [n("b", { t: "Aufgabe hinzufügen" }), n("small", { t: "Lokal gespeichert" })]),
          n("button", { cls: "dsk-card", on: { click: function () { go("notes"); } } }, [n("b", { t: "Notiz schreiben" }), n("small", { t: "Lokal gespeichert" })]),
          n("button", { cls: "dsk-card", on: { click: function () { if (search) openApp(search); } } }, [n("b", { t: "Suche öffnen" }), n("small", { t: "ToySearch" })])
        ]),
        n("h3", { t: "Zuletzt geöffnet" }),
        S.recent.length
          ? n("div", { cls: "dsk-list" }, S.recent.slice(0, 5).map(function (a) {
              return n("button", { cls: "dsk-row", t: a.name, on: { click: function () { openApp(a); } } });
            }))
          : n("p", { cls: "mu", t: "Noch nichts geöffnet." })
      ]);
    }

    function vTasks() {
      var list = tasks();
      var input = n("input", { cls: "fsearch", attr: { placeholder: "Neue Aufgabe… (Enter)", "aria-label": "Neue Aufgabe" } });
      function add() {
        var v = input.value.trim();
        if (!v) return;
        list.push({ t: v, done: false });
        saveTasks(list);
        draw();
      }
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
      var ul = n("ul", { cls: "dsk-list" });
      list.forEach(function (t, i) {
        var cb = n("input", { attr: { type: "checkbox", "aria-label": "Erledigt" } });
        cb.checked = !!t.done;
        cb.addEventListener("change", function () { list[i].done = cb.checked; saveTasks(list); draw(); });
        ul.appendChild(n("li", { cls: t.done ? "done" : "" }, [
          cb,
          n("span", { t: t.t }),
          n("button", { cls: "dsk-x", t: "Löschen", on: { click: function () { list.splice(i, 1); saveTasks(list); draw(); } } })
        ]));
      });
      return n("section", null, [
        n("h2", { t: "Aufgaben" }),
        n("div", { cls: "dsk-add" }, [input, n("button", { cls: "dsk-go", t: "Hinzufügen", on: { click: add } })]),
        list.length ? ul : n("p", { cls: "mu", t: "Noch keine Aufgaben." })
      ]);
    }

    function vNotes() {
      var ta = n("textarea", { cls: "dsk-notes", attr: { placeholder: "Notizen… werden lokal gespeichert", "aria-label": "Notizen" } });
      ta.value = get("toymesh.desk.notes", "");
      ta.addEventListener("input", function () { set("toymesh.desk.notes", ta.value); });
      return n("section", null, [n("h2", { t: "Notizen" }), ta]);
    }

    // ---- ToyPost innerhalb von ToyDesk (spricht die ToyPost-API an, siehe ui/toypost.js) ----
    var TP = window.ToyPost;
    var tp = "today", tpMsg = "";

    function later(fn) {
      var box = n("div", { cls: "mu", t: "Lade…" });
      Promise.resolve().then(fn).then(function (el) { box.textContent = ""; box.appendChild(el); })
        .catch(function (e) { box.textContent = ""; box.appendChild(tpError(e)); });
      return box;
    }

    function tpError(e) {
      var kids = [n("div", { cls: "note", t: (e && e.message) || "Unbekannter Fehler." })];
      if (e && (e.status === 0 || e.status === 401 || e.code === "offline")) {
        kids.push(n("button", { cls: "dsk-go", t: "Zur Verbindung", on: { click: function () { tp = "conn"; draw(); } } }));
      }
      return n("div", null, kids);
    }

    function sevLine(s) { return n("div", { cls: "tp-sev sev-" + s.severity, t: s.message }); }

    function caseCard(c, quick) {
      var kids = [
        n("div", { cls: "tp-title", t: c.title }),
        n("div", { cls: "mu", t: (c.correspondent || "") + (c.nextAction ? "  ·  Nächster Schritt: " + c.nextAction : "") }),
        n("div", { t: c.summary || "" })
      ];
      (c.safety || []).forEach(function (s) { kids.push(sevLine(s)); });
      if (c.toyRequest) {
        kids.push(n("div", { cls: "tp-sev sev-yellow",
          t: "Zahlungsaufforderung in TOY: " + (c.toyRequest.amount || "?") + " an " + (c.toyRequest.address || "?") + ". Nie aus einer Nachricht heraus zahlen." }));
      }
      if (quick && c.status !== "done") {
        kids.push(n("button", { cls: "dsk-x", t: "Erledigt", on: { click: function () {
          TP.setCase(c.id, { status: "done" }).then(function () { tpMsg = ""; draw(); })
            .catch(function (e) { tpMsg = e.message || "Speichern fehlgeschlagen."; draw(); });
        } } }));
      }
      return n("div", { cls: "tp-card" }, kids);
    }

    function tpConn() {
      var urlIn = n("input", { cls: "fsearch", attr: { type: "url", placeholder: "https://toypost.example.de", "aria-label": "Server-Adresse" } });
      urlIn.value = TP.url() || "";
      var mail = n("input", { cls: "fsearch", attr: { type: "email", placeholder: "E-Mail", "aria-label": "E-Mail", autocomplete: "username" } });
      var pw = n("input", { cls: "fsearch", attr: { type: "password", placeholder: "Passwort", "aria-label": "Passwort", autocomplete: "current-password" } });
      var status = n("p", { cls: "mu" });
      function login() {
        try { TP.setUrl(urlIn.value.trim()); } catch (e) { status.textContent = e.message; return; }
        status.textContent = "Melde an…";
        TP.login(mail.value.trim(), pw.value).then(function () { pw.value = ""; tp = "today"; tpMsg = ""; draw(); })
          .catch(function (e) { status.textContent = e.message || "Anmeldung fehlgeschlagen."; });
      }
      pw.addEventListener("keydown", function (e) { if (e.key === "Enter") login(); });
      var kids = [urlIn, mail, pw, n("button", { cls: "dsk-go", t: "Anmelden", on: { click: login } }), status,
        n("p", { cls: "hint", t: "Passwort und Zugangsdaten werden nicht gespeichert. Der Anmelde-Token bleibt nur für diese Sitzung im Browser und ist beim Schließen weg. Die Adresse muss https:// sein; http:// ist nur für 127.0.0.1 und localhost erlaubt." })];
      if (TP.connected()) {
        kids.push(n("button", { cls: "dsk-x", t: "Abmelden", on: { click: function () { TP.logout(); tp = "conn"; draw(); } } }));
      }
      return n("div", { cls: "tp-form" }, kids);
    }

    function tpToday() {
      return later(function () {
        return TP.today().then(function (d) {
          var wrap = n("div", null, [n("p", { cls: "mu", t: "Stand: " + (d.today || "") })]);
          var groups = [["Handlung nötig", d.action], ["Nachfassen fällig", d.followUpDue], ["Wartet auf Antwort", d.waiting], ["Neue Infos", d.newInfo]];
          var any = false;
          groups.forEach(function (g) {
            var items = g[1] || [];
            if (!items.length) return;
            any = true;
            wrap.appendChild(n("h3", { t: g[0] + " (" + items.length + ")" }));
            items.forEach(function (c) { wrap.appendChild(caseCard(c, true)); });
          });
          if (!any) wrap.appendChild(n("div", { cls: "note", t: "Nichts zu tun. Alle Vorgänge sind erledigt oder ohne Frist." }));
          return wrap;
        });
      });
    }

    function tpCases() {
      var st = n("select", { cls: "fsearch", attr: { "aria-label": "Status" } }, [
        n("option", { t: "Alle", attr: { value: "" } }),
        n("option", { t: "Handlung nötig", attr: { value: "action" } }),
        n("option", { t: "Wartet", attr: { value: "waiting" } }),
        n("option", { t: "Zur Kenntnis", attr: { value: "info" } }),
        n("option", { t: "Erledigt", attr: { value: "done" } })
      ]);
      var q = n("input", { cls: "fsearch", attr: { type: "search", placeholder: "Vorgänge suchen…", "aria-label": "Suche" } });
      var list = n("div", null);
      function load() {
        list.textContent = "";
        list.appendChild(later(function () {
          return TP.cases(st.value, q.value.trim()).then(function (arr) {
            var w = n("div", null);
            if (!arr.length) w.appendChild(n("p", { cls: "mu", t: "Keine Vorgänge gefunden." }));
            arr.forEach(function (c) { w.appendChild(caseCard(c, false)); });
            return w;
          });
        }));
      }
      var timer = null;
      st.addEventListener("change", load);
      q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(load, 350); });
      load();
      return n("div", null, [n("div", { cls: "dsk-add" }, [q, st]), list]);
    }

    function tpInbox() {
      return later(function () {
        return TP.messages("in").then(function (arr) {
          var w = n("div", null);
          if (!arr.length) w.appendChild(n("p", { cls: "mu", t: "Keine Nachrichten." }));
          arr.forEach(function (m) {
            var kids = [
              n("div", { cls: "tp-title", t: m.subject || (m.contact ? m.contact.name : "Nachricht") }),
              n("div", { cls: "mu", t: (m.channelName || m.channelKind) + "  ·  " + (m.contact ? m.contact.name : "unbekannter Absender") + "  ·  " + new Date(m.createdAt).toLocaleString("de-DE") }),
              n("div", { t: m.preview || "" })
            ];
            (m.safety || []).forEach(function (s) { kids.push(sevLine(s)); });
            if (m.status === "blocked") kids.push(n("div", { cls: "tp-sev sev-block", t: "Blockiert" }));
            w.appendChild(n("div", { cls: "tp-card" }, kids));
          });
          return w;
        });
      });
    }

    function tpCheck() {
      var ta = n("textarea", { cls: "dsk-notes", attr: { placeholder: "Text einer Nachricht einfügen, z. B. eine verdächtige Mail…", "aria-label": "Text prüfen" } });
      var out = n("div", null);
      var go = n("button", { cls: "dsk-go", t: "Prüfen", on: { click: function () {
        out.textContent = "";
        out.appendChild(n("p", { cls: "mu", t: "Prüfe…" }));
        TP.check(ta.value).then(function (r) {
          out.textContent = "";
          if (!r.findings.length && !r.toyRequest) {
            out.appendChild(n("div", { cls: "note", t: "Keine Auffälligkeiten gefunden. Das ist keine Garantie: prüfe Absender und Links trotzdem selbst." }));
          }
          r.findings.forEach(function (f) { out.appendChild(sevLine(f)); });
          if (r.toyRequest) {
            out.appendChild(n("div", { cls: "tp-sev sev-yellow",
              t: "Zahlungsaufforderung in TOY: " + (r.toyRequest.amount || "?") + " an " + (r.toyRequest.address || "?") + ". Prüfe die Adresse in deiner Wallet, bevor du etwas sendest." }));
          }
        }).catch(function (e) { out.textContent = ""; out.appendChild(tpError(e)); });
      } } });
      return n("div", null, [ta, go, out, n("p", { cls: "hint", t: "Der Text wird zur Prüfung an deinen ToyPost-Server geschickt." })]);
    }

    function tpToy() {
      return later(function () {
        return TP.toyOverview().then(function (o) {
          var amp = o.ampel;
          return n("div", null, [
            n("div", { cls: "tp-card" }, [n("b", { t: "Ampel" }),
              n("div", { t: amp ? ("Farbe: " + amp.color + (amp.bigRedLamp ? "  ·  Rote Lampe aktiv" : "") + "  ·  Stand " + new Date(amp.checkedAt).toLocaleString("de-DE")) : "Noch keine Prüfung." })]),
            n("div", { cls: "tp-card" }, [n("b", { t: "Rechnungen" }), n("div", { t: "Offen: " + o.invoices.open + "  ·  Bezahlt: " + o.invoices.paid })]),
            n("div", { cls: "tp-card" }, [n("b", { t: "Meilensteine" })].concat(o.milestones.map(function (m) {
              return n("div", { t: (m.done ? "✓ " : "○ ") + m.title + "  ·  " + m.status });
            }))),
            n("div", { cls: "tp-card" }, [n("b", { t: "Ausstehende Mitteilungen" }), n("div", { t: String(o.pendingBroadcasts) })])
          ]);
        });
      });
    }

    function tpChannels() {
      return later(function () {
        return TP.channels().then(function (d) {
          var w = n("div", null);
          if (!d.channels.length) w.appendChild(n("p", { cls: "mu", t: "Noch keine Kanäle eingerichtet." }));
          d.channels.forEach(function (c) {
            w.appendChild(n("div", { cls: "tp-card" }, [
              n("div", { cls: "tp-title", t: c.name + "  ·  " + c.kindLabel + (c.enabled ? "" : "  (aus)") }),
              n("div", { cls: "mu", t: c.summary || "" }),
              c.lastError ? n("div", { cls: "tp-sev sev-red", t: "Fehler: " + c.lastError }) : null
            ]));
          });
          return w;
        });
      });
    }

    function vToyPost() {
      var TABS = [["today", "Heute"], ["cases", "Vorgänge"], ["inbox", "Posteingang"], ["check", "Prüfen"], ["toy", "Toy"], ["channels", "Kanäle"], ["conn", "Verbindung"]];
      if (!TP.connected() && tp !== "conn") tp = "conn";
      var F = { today: tpToday, cases: tpCases, inbox: tpInbox, check: tpCheck, toy: tpToy, channels: tpChannels, conn: tpConn };
      var kids = [n("h2", { t: "ToyPost" })];
      kids.push(n("div", { cls: "tp-tabs" }, TABS.filter(function (x) {
        return TP.connected() || x[0] === "conn" || x[0] === "check";
      }).map(function (x) {
        return n("button", { cls: "tp-tab" + (x[0] === tp ? " on" : ""), t: x[1], on: { click: function () { tp = x[0]; tpMsg = ""; draw(); } } });
      })));
      if (tpMsg) kids.push(n("div", { cls: "note", t: tpMsg }));
      if (!TP.connected() && tp !== "conn") kids.push(n("p", { cls: "mu", t: "Noch nicht verbunden." }));
      kids.push(F[tp]());
      return n("section", null, kids);
    }

    function vApps() {
      var groups = [["live", "Live"], ["dev", "In Entwicklung"], ["planned", "In Planung"], ["concept", "Konzept"]];
      return n("section", null, [n("h2", { t: "Alle Apps" })].concat(groups.map(function (g) {
        var items = apps.filter(function (a) { return a.status === g[0]; });
        if (!items.length) return null;
        return n("div", null, [n("h3", { t: g[1] }), n("div", { cls: "desk dsk-apps" }, items.map(function (a) { return ico(a); }))]);
      })));
    }

    var VIEWS = { start: vStart, tasks: vTasks, notes: vNotes, post: vToyPost, apps: vApps };

    function draw() {
      nav.textContent = "";
      NAV.forEach(function (x) {
        var b = n("button", { cls: "dsk-tab" + (x[0] === view ? " on" : ""), t: x[1], on: { click: function () { go(x[0]); } } });
        if (x[0] === view) b.setAttribute("aria-current", "page");
        nav.appendChild(b);
      });
      main.textContent = "";
      main.appendChild(VIEWS[view]());
    }

    root.appendChild(n("div", { cls: "dsk" }, [nav, main]));
    draw();
  };

  // ---------- Rendern ----------
  function render() {
    var d = def(S.ui);
    document.body.setAttribute("data-ui", d.id);
    S.search = null;
    var root = $("root");
    root.textContent = "";
    root.className = "ly-" + d.layout;
    if (!S.apps.length) {
      root.appendChild(n("p", { cls: "empty", t: "Keine App-Liste gefunden. Läuft der App-Server? (rc-service toyverse-web start)" }));
      return;
    }
    L[d.layout](root, S.apps);
  }

  function setUI(id) {
    S.ui = def(id).id;
    set(KEY_UI, S.ui);
    $("uisel").value = S.ui;
    render();
  }

  // ---------- Einrichtungs-Assistent ----------
  function openWizard() { W.i = 0; $("wiz").hidden = false; showWiz(); }
  function closeWiz() { $("wiz").hidden = true; }

  function showWiz() {
    var box = $("wiz-b");
    box.textContent = "";
    box.appendChild(n("p", { cls: "wstep", t: "Schritt " + (W.i + 1) + " von 4 · " + W.steps[W.i] }));

    if (W.i === 0) {
      box.appendChild(n("p", { t: "Willkommen bei ToyMesh. In wenigen Schritten wählst du Oberfläche und Datenschutz. Alles lässt sich später ändern." }));
    }

    if (W.i === 1) {
      box.appendChild(n("div", { cls: "wgrid" }, UIS.map(function (u) {
        return n("button", { cls: "wcard" + (u.id === S.ui ? " on" : ""),
          on: { click: function () { setUI(u.id); showWiz(); } } },
          [n("b", { t: u.name }), n("small", { t: u.by })]);
      })));
      box.appendChild(n("p", { cls: "hint", t: "Ein Klick wechselt die Oberfläche sofort." }));
    }

    if (W.i === 2) {
      var opts = [
        ["standard", "Standard", "Empfohlen für den Alltag: Tracking-Schutz, HTTPS, DNS über HTTPS."],
        ["streng", "Streng", "Zusätzlich Fingerprint-Schutz. Kann einzelne Seiten stören."],
        ["maximum", "Maximum", "Strengste Einstellungen plus Tor-Routing. Langsamer."]
      ];
      opts.forEach(function (o) {
        var inp = n("input", { attr: { type: "radio", name: "priv", value: o[0] } });
        inp.checked = S.privacy === o[0];
        inp.addEventListener("change", function () { S.privacy = o[0]; set(KEY_PRIV, o[0]); });
        box.appendChild(n("label", { cls: "wopt" }, [inp, n("b", { t: " " + o[1] }), n("br"), n("small", { t: o[2] })]));
      });
      box.appendChild(n("p", { cls: "hint", t: "Hinweis: Diese Wahl wird gespeichert. ToySurf übernimmt sie noch nicht automatisch; passe dafür /etc/toysurf/toysurf.conf an." }));
    }

    if (W.i === 3) {
      box.appendChild(n("p", { t: "Fertig. Oberfläche: " + def(S.ui).name + " · Datenschutz: " + S.privacy + "." }));
    }

    var back = n("button", { t: "Zurück", on: { click: function () { W.i--; showWiz(); } } });
    if (W.i === 0) back.disabled = true;
    var next = n("button", { t: W.i === W.steps.length - 1 ? "Los geht's" : "Weiter",
      on: { click: function () {
        if (W.i === W.steps.length - 1) { set(KEY_DONE, "1"); closeWiz(); }
        else { W.i++; showWiz(); }
      } } });
    box.appendChild(n("div", { cls: "wnav" }, [back, next]));
  }

  // ---------- Start ----------
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeWin(); closeWiz(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && S.search) { e.preventDefault(); S.search.focus(); }
    if (e.key === "/" && S.search && document.activeElement.tagName !== "INPUT") { e.preventDefault(); S.search.focus(); }
  });

  // Geräte-Profil von toymesh-profil (/srv/toyverse/geraet.json): schaltet
  // Animationen und Glas-Effekte passend zur Hardware. Eine selbst gewählte
  // Oberfläche hat immer Vorrang, das Profil gibt nur den Start vor.
  function applyProfile(p) {
    if (!p || !p.profil) return;
    var pr = p.profil;
    document.body.setAttribute("data-anim", pr.animationen || "normal");
    document.body.setAttribute("data-glass", pr.glas_effekte ? "1" : "0");
    document.body.setAttribute("data-klasse", pr.klasse || "");
    S.profile = pr;
    if (!get(KEY_UI, "") && pr.oberflaeche && def(pr.oberflaeche).id === pr.oberflaeche) {
      // nicht speichern: das Profil darf sich mit der Hardware weiter anpassen
      S.ui = pr.oberflaeche;
      var sel = $("uisel");
      if (sel) sel.value = pr.oberflaeche;
      if (S.apps.length) render();
    }
  }

  function init() {
    var saved = get(KEY_UI, "toyclassic");
    S.ui = def(saved).id;
    S.privacy = get(KEY_PRIV, "streng");

    var sel = $("uisel");
    UIS.forEach(function (u) { sel.appendChild(n("option", { t: u.name, attr: { value: u.id } })); });
    sel.value = S.ui;
    sel.addEventListener("change", function () { setUI(sel.value); });

    $("wizbtn").addEventListener("click", openWizard);
    $("win-x").addEventListener("click", closeWin);
    $("wiz-x").addEventListener("click", closeWiz);

    // Installierte UI-Version anzeigen (ui/manifest.json, siehe toyui-update)
    fetch("ui/manifest.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { if (m && m.version) $("uiver").textContent = "v" + m.version; })
      .catch(function () { /* ohne Version weiter */ });

    fetch("geraet.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(applyProfile)
      .catch(function () { /* ohne Profil: Standard */ });

    fetch("apps.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (d) { S.apps = d.apps || []; })
      .catch(function () { S.apps = []; })
      .then(function () {
        render();
        if (!get(KEY_DONE, "")) openWizard();
      });
  }

  init();
})();
