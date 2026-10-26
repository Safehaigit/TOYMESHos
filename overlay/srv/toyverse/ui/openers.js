/* ToyMesh openers: spielt beim Start einen animierten Opener ab.
 * Modi: "random" (zufällig, Standard), "fixed" (feste, änderbare Reihenfolge), "off".
 * Die Opener laufen in einem iframe ohne same-origin (sandbox="allow-scripts"),
 * damit ein Opener keinen Zugriff auf die Oberfläche bekommt. Keine externen Anfragen.
 * Alle Einstellungen in localStorage bzw. sessionStorage, jeweils mit try/catch. */
(function () {
  "use strict";

  var KEY_MODE = "toymesh.opener.mode", KEY_ORDER = "toymesh.opener.order";
  var KEY_POS = "toymesh.opener.pos", KEY_LAST = "toymesh.opener.last";
  var SESS_SHOWN = "toymesh.opener.shown";
  var MAX_MS = 9000; // Sicherheitsende, falls ein Opener nicht meldet
  // Basisadresse aus der Skriptdatei, damit die Pfade auch aus ToyBIOS (bios/) stimmen
  var BASE = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/ui\/openers\.js[^/]*$/, "") : "";
  })();

  var LIST = [
    { id: "graffiti", name: "Graffiti (modern)", file: "openers/toymesh-graffiti.html" },
    { id: "shield", name: "ToySafe-Schild", file: "openers/toysafe-shield.html" },
    { id: "nacht", name: "1001 Nacht (ToyQuest)", file: "openers/toyquest-nacht.html" },
    { id: "plasma", name: "Plasma (ToyPlasma)", file: "openers/toyplasma.html" },
    { id: "flash", name: "Flash (Glitch)", file: "openers/toyglitch.html" },
    { id: "circuit", name: "Schaltkreis", file: "openers/toycircuit.html" }
  ];

  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } }
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* egal */ } }

  function byId(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return null;
  }

  // Gespeicherte Reihenfolge prüfen: unbekannte IDs raus, fehlende hinten dran.
  function order() {
    var ids = LIST.map(function (o) { return o.id; });
    var raw = null;
    try { raw = JSON.parse(get(KEY_ORDER, "null")); } catch (e) { raw = null; }
    var out = [];
    if (Array.isArray(raw)) {
      raw.forEach(function (x) { if (ids.indexOf(x) > -1 && out.indexOf(x) < 0) out.push(x); });
    }
    ids.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  function saveOrder(arr) { set(KEY_ORDER, JSON.stringify(arr)); }

  function mode() {
    var m = get(KEY_MODE, "random");
    return (m === "random" || m === "fixed" || m === "off") ? m : "random";
  }

  // Wählt den nächsten Opener nach dem Modus. preview = true: vorführen, ohne die Reihenfolge weiterzuschalten.
  function pick(preview) {
    var m = mode();
    if (m === "off" && !preview) return null;
    if (m === "fixed") {
      var ord = order();
      var p = parseInt(get(KEY_POS, "0"), 10);
      if (!(p >= 0 && p < ord.length)) p = 0;
      if (!preview) set(KEY_POS, String((p + 1) % ord.length));
      return byId(ord[p]);
    }
    // zufällig, aber nicht zweimal hintereinander derselbe
    var last = get(KEY_LAST, "");
    var pool = LIST.filter(function (o) { return o.id !== last; });
    var c = pool[Math.floor(Math.random() * pool.length)];
    set(KEY_LAST, c.id);
    return c;
  }

  // play(opts, fertig): opts.force = true spielt immer (Vorschau) und ignoriert "einmal pro Sitzung".
  // fertig() wird genau einmal aufgerufen, wenn der Opener vorbei ist (oder übersprungen wurde).
  function play(opts, fertig) {
    opts = opts || {};
    var done = typeof fertig === "function" ? fertig : function () {};
    if (!opts.force) {
      if (mode() === "off" || sget(SESS_SHOWN) === "1") { done(); return; }
    }
    var o = pick(!!opts.force);
    if (!o) { done(); return; }
    sset(SESS_SHOWN, "1");

    var layer = document.createElement("div");
    layer.className = "opener-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-label", "Begrüßung");
    layer.style.cssText = "position:fixed;inset:0;z-index:2000;background:#05040c;";

    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("title", "ToyMesh-Begrüßung: " + o.name);
    frame.style.cssText = "border:0;width:100%;height:100%;display:block;";
    frame.src = BASE + o.file;
    layer.appendChild(frame);
    document.body.appendChild(layer);

    var finished = false, timer = null;
    function end() {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMsg);
      document.removeEventListener("keydown", onKey, true);
      if (timer) clearTimeout(timer);
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      done();
    }
    function onMsg(e) {
      // Nur Nachrichten aus genau diesem iframe und nur das bekannte Stichwort
      if (e.source === frame.contentWindow && e.data === "opener-done") end();
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation(); // sonst schließt der Tastenhandler der Oberfläche gleich den Assistenten
        end();
      }
    }
    window.addEventListener("message", onMsg);
    document.addEventListener("keydown", onKey, true);
    timer = setTimeout(end, MAX_MS);
  }

  // ---------- Einstellungen (im Assistenten) ----------
  // panel(box, n): hängt die Einstellungen an box an. n ist der DOM-Helfer aus shell.js.
  function panel(box, n) {
    box.appendChild(n("p", { t: "Der Opener läuft beim Start. Einmal pro Sitzung, damit er nicht bei jedem Neuladen erscheint." }));

    var labels = [
      ["random", "Zufällig (Standard)", "Bei jedem Start ein anderer Opener, nie zweimal hintereinander derselbe."],
      ["fixed", "Feste Reihenfolge", "Die Opener laufen der Reihe nach, in der unten festgelegten Ordnung."],
      ["off", "Aus", "Kein Opener beim Start."]
    ];
    var cur = mode();
    labels.forEach(function (l) {
      var inp = n("input", { attr: { type: "radio", name: "omode", value: l[0] } });
      inp.checked = cur === l[0];
      inp.addEventListener("change", function () { set(KEY_MODE, l[0]); set(KEY_POS, "0"); renderList(); });
      box.appendChild(n("label", { cls: "wopt" }, [inp, n("b", { t: " " + l[1] }), n("br"), n("small", { t: l[2] })]));
    });

    var listBox = n("div", { cls: "ol-list", attr: { style: "display:flex;flex-direction:column;gap:6px;margin-top:8px;" } });
    box.appendChild(listBox);

    function renderList() {
      listBox.textContent = "";
      var ord = order();
      var fixed = mode() === "fixed";
      ord.forEach(function (id, i) {
        var o = byId(id);
        var up = n("button", { cls: "hdr-btn", t: "↑", attr: { "aria-label": o.name + " nach oben" }, on: { click: function () { move(i, -1); } } });
        var down = n("button", { cls: "hdr-btn", t: "↓", attr: { "aria-label": o.name + " nach unten" }, on: { click: function () { move(i, 1); } } });
        up.disabled = !fixed || i === 0;
        down.disabled = !fixed || i === ord.length - 1;
        listBox.appendChild(n("div", { cls: "ol-row", attr: { style: "display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:8px 10px;border:1px solid currentColor;border-radius:8px;opacity:.95;" } }, [
          n("span", { t: (i + 1) + ". " + o.name, attr: { style: "flex:1 1 150px;min-width:0;" } }),
          up, down,
          n("button", { cls: "hdr-btn", t: "Vorschau", attr: { "aria-label": o.name + " ansehen" }, on: { click: function () { play({ force: true }, function () {}); } } })
        ]));
      });
      if (!fixed) {
        listBox.appendChild(n("p", { cls: "hint", t: "Die Reihenfolge wird erst bei „Feste Reihenfolge“ verwendet." }));
      }
    }

    function move(i, d) {
      var ord = order();
      var j = i + d;
      if (j < 0 || j >= ord.length) return;
      var tmp = ord[i]; ord[i] = ord[j]; ord[j] = tmp;
      saveOrder(ord);
      set(KEY_POS, "0");
      renderList();
    }

    renderList();
    box.appendChild(n("p", { cls: "hint", t: "Die Vorschau zeigt den Opener sofort, auch wenn er heute schon lief." }));
  }

  window.ToyOpeners = { play: play, panel: panel, list: LIST.slice() };
})();
