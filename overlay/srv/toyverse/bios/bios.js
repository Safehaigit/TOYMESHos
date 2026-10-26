/* ToyBIOS: Einstellungsseite für ToyMesh. Läuft im Launcher (gleiche Herkunft), daher teilen sich
 * Launcher und ToyBIOS localStorage. Alle Texte per textContent, kein innerHTML.
 * Die Liste der Oberflächen muss mit ui/shell.js übereinstimmen (IDs und Namen). */
(function () {
  "use strict";

  var UIS = [
    ["toyclassic", "ToyClassic"], ["toyaqua", "ToyAqua"], ["toyquest", "ToyQuest"],
    ["toyplasma", "ToyPlasma"], ["toysafe", "ToySafe"], ["toytiles", "ToyTiles"],
    ["toyguide", "ToyGuide"], ["toyfocus", "ToyFocus"], ["toydroid", "ToyDroid"], ["toydesk", "ToyDesk"]
  ];
  var PRIV = [["standard", "Standard"], ["streng", "Streng"], ["maximum", "Maximum"]];
  var MODES = { random: "Zufällig", fixed: "Feste Reihenfolge", off: "Aus" };

  function $(id) { return document.getElementById(id); }
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } }

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

  // Tag mit Wirkung: now = sofort, reload = nach Neuladen, saved = gespeichert, info = nur Anzeige
  function tag(kind, text) { return n("span", { cls: "tag " + kind, t: text }); }

  function row(title, sub, control, kind, kindText) {
    var left = n("div", {}, [n("b", { t: title }), kind ? tag(kind, kindText) : null, sub ? n("small", { t: sub }) : null]);
    return n("div", { cls: "row" }, [left, control || null]);
  }

  function code(cmd) { return n("code", { t: cmd }); }

  function select(opts, cur, onChange) {
    var s = n("select", { attr: { "aria-label": "Auswahl" } });
    opts.forEach(function (o) { s.appendChild(n("option", { t: o[1], attr: { value: o[0] } })); });
    s.value = cur;
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }

  // Launcher neu laden, damit eine Änderung dort wirkt (gleiche Herkunft, daher erlaubt)
  function reloadLauncher() {
    try { window.parent.location.reload(); } catch (e) { window.location.reload(); }
  }

  function showToast(text) {
    $("toast-t").textContent = text;
    $("toast").classList.remove("hidden");
  }

  // ---------- Systeminfo ----------
  function fillSystem() {
    var box = $("sysinfo");
    var uiName = (UIS.filter(function (u) { return u[0] === get("toymesh.ui", "toyclassic"); })[0] || UIS[0])[1];
    var rows = [
      ["Aktive Oberfläche", uiName],
      ["Begrüßung", MODES[get("toymesh.opener.mode", "random")] || "Zufällig"],
      ["Datenschutz", get("toymesh.privacy", "streng")],
      ["Zeitzone", (Intl.DateTimeFormat().resolvedOptions().timeZone || "unbekannt")],
      ["Browser", navigator.userAgent],
      ["Build-Ziel", "Laut Build-Kit: samsung-espresso10 (Tablet) oder qemu-amd64 (PC-VM)"]
    ];
    var uiver = n("dd", { t: "wird geladen…" });
    box.appendChild(n("dt", { t: "UI-Version" })); box.appendChild(uiver);
    rows.forEach(function (r) {
      box.appendChild(n("dt", { t: r[0] })); box.appendChild(n("dd", { t: r[1] }));
    });
    fetch("../ui/manifest.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { uiver.textContent = m && m.version ? "v" + m.version : "unbekannt"; })
      .catch(function () { uiver.textContent = "unbekannt"; });
  }

  // ---------- Oberfläche ----------
  function fillUi() {
    var box = $("ui-box");
    box.appendChild(row("Oberfläche wählen", "Acht bis zehn Oberflächen, jede mit eigenem Aufbau.",
      select(UIS, get("toymesh.ui", "toyclassic"), function (v) {
        set("toymesh.ui", v);
        showToast("Oberfläche gespeichert. Neu laden, dann wirkt sie.");
      }), "reload", "nach Neuladen"));
  }

  // ---------- Begrüßung (wiederverwendet die Steuerung aus ui/openers.js) ----------
  function fillOpeners() {
    var box = $("op-box");
    if (window.ToyOpeners) window.ToyOpeners.panel(box, n);
    else box.appendChild(n("p", { cls: "hint", t: "Begrüßung nicht verfügbar." }));
  }

  // ---------- Sicherheit ----------
  function fillSecurity() {
    var box = $("sec-box");
    box.appendChild(row("Datenschutz-Stufe", "Wird gespeichert. ToySurf übernimmt sie noch nicht automatisch.",
      select(PRIV, get("toymesh.privacy", "streng"), function (v) {
        set("toymesh.privacy", v);
        showToast("Datenschutz-Stufe gespeichert.");
      }), "saved", "gespeichert"));
    box.appendChild(row("Schutz-Prüfung", "Prüft Verschlüsselung, Firewall, Updates und Schlüssel. Ergebnis als Ampel.", code("toysafe-check"), "info", "nur Befehl"));
    box.appendChild(row("Warnliste", "Bekannte Betrugs-Domains und Adressen. Nur Warnung, nie Sperre.", code("toysafe-warn --status"), "info", "nur Befehl"));
  }

  // ---------- Darstellung (wirkt sofort, auch im Launcher) ----------
  function fillLook() {
    var box = $("look-box");
    var p = window.ToyPrefs ? window.ToyPrefs.load() : { scale: 100, motion: false };
    function apply(next) {
      window.ToyPrefs.save(next);
      window.ToyPrefs.apply(next);
      try { window.parent.ToyPrefs.apply(next); } catch (e) { /* kein Launcher über uns: egal */ }
    }
    var scaleOpts = (window.ToyPrefs ? window.ToyPrefs.SCALES : [100]).map(function (s) { return [String(s), s + " %"]; });
    box.appendChild(row("Schriftgröße", "Vergrößert Text und Bedienelemente im ganzen System.",
      select(scaleOpts, String(p.scale), function (v) { p.scale = Number(v); apply(p); }), "now", "sofort"));
    var cb = n("input", { attr: { type: "checkbox", id: "motion" } });
    cb.checked = p.motion;
    cb.addEventListener("change", function () { p.motion = cb.checked; apply(p); });
    box.appendChild(row("Bewegung reduzieren", "Weniger Animation, hilfreich bei Schwindel oder auf schwachen Geräten.",
      n("label", {}, [cb, n("span", { t: " an" })]), "now", "sofort"));
  }

  // ---------- Setup-Assistent ----------
  function fillAssist() {
    var box = $("as-box");
    var tone = get("toymesh.assist.tone", "serious");
    var toneSel = select([["serious", "Seriös"], ["fun", "Lustig"]], tone === "fun" ? "fun" : "serious", function (v) {
      set("toymesh.assist.tone", v);
    });
    box.appendChild(row("Tonlage", "Lustig mit Figur und Animation, seriös ruhig und sachlich.", toneSel, "now", "sofort"));
    var voiceOn = get("toymesh.assist.voice", "0") === "1";
    var cb = n("input", { attr: { type: "checkbox" } });
    cb.checked = voiceOn;
    cb.addEventListener("change", function () { set("toymesh.assist.voice", cb.checked ? "1" : "0"); });
    box.appendChild(row("Erklärungen vorlesen", "Nur wenn das Gerät eine Stimme anbietet. Standard: aus.", n("label", {}, [cb, n("span", { t: " an" })]), "now", "sofort"));
    box.appendChild(row("Assistent erneut starten", "Öffnet die Einrichtung im Launcher.", n("button", { t: "Starten", on: { click: function () {
      // Der Assistent läuft im Launcher. Nach dem Abschluss lädt der Launcher neu, damit die Oberfläche wirkt.
      try { window.parent.ToyAssist.open({ onUi: function () {}, onDone: reloadLauncher }); }
      catch (e) { showToast("Der Assistent ist im Launcher nicht verfügbar."); }
    } } }), null, null));
  }

  // ---------- Updates ----------
  function fillUpdates() {
    var box = $("upd-box");
    box.appendChild(row("Oberfläche aktualisieren", "Nur aus einer signierten Quelle, mindestens 2 von 3 Signierern. Quelle in /etc/toymesh/ui-update.conf.", code("toyui-update"), "info", "nur Befehl"));
    box.appendChild(row("Oberfläche zurückrollen", "Stellt die letzte Version der Oberfläche wieder her.", code("toyui-update --rollback"), "info", "nur Befehl"));
    box.appendChild(row("System aktualisieren", "Legt vorher einen Snapshot an. Bei Kernel-Updates ist danach ein Neustart nötig.", code("toyverse-update"), "info", "nur Befehl"));
    box.appendChild(row("Snapshots anzeigen", "Zeigt die Liste und den Status der letzten Updates.", code("toyverse-update --list"), "info", "nur Befehl"));
    box.appendChild(row("System zurückrollen", "Ersetzt S durch einen Snapshot aus der Liste.", code("toyverse-update --restore S"), "info", "nur Befehl"));
  }

  // ---------- Dienste und Netz ----------
  function fillNet() {
    var box = $("net-box");
    box.appendChild(row("ToyChat-Server", "Läuft nur lokal auf Port 8090, nicht aus dem Netz erreichbar.", code("rc-service toychat-server status"), "info", "nur Befehl"));
    box.appendChild(row("Firewall", "Standard: alles gesperrt, außer was ausdrücklich erlaubt ist.", code("rc-service nftables status"), "info", "nur Befehl"));
    box.appendChild(row("Alle Dienste", "Übersicht, welche Dienste laufen.", code("rc-status"), "info", "nur Befehl"));
  }

  // ---------- Zurücksetzen ----------
  function fillReset() {
    var box = $("reset-box");
    var btn = n("button", { cls: "danger", t: "ToyMesh-Einstellungen zurücksetzen", on: { click: function () {
      var ok = window.confirm("Alle ToyMesh-Einstellungen auf Standard setzen? Die Einrichtung wird beim nächsten Start wieder angeboten. ToyChat-Daten bleiben erhalten.");
      if (!ok) return;
      var keys = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("toymesh.") === 0) keys.push(k);
        }
        keys.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* Speicher gesperrt */ }
      try { sessionStorage.removeItem("toymesh.opener.shown"); } catch (e) { /* egal */ }
      showToast("Zurückgesetzt (" + keys.length + " Einträge). Neu laden, dann gilt der Standard.");
    } } });
    box.appendChild(n("p", { cls: "hint", t: "Setzt nur Einstellungen mit dem Präfix toymesh. zurück. ToyChat-Daten, Dateien und das System bleiben unverändert." }));
    box.appendChild(btn);
  }

  $("toast-b").addEventListener("click", reloadLauncher);

  fillSystem();
  fillUi();
  fillOpeners();
  fillSecurity();
  fillLook();
  fillAssist();
  fillUpdates();
  fillNet();
  fillReset();
})();
