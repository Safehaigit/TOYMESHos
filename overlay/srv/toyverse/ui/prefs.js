/* ToyMesh-Darstellung: Schriftgröße und "Bewegung reduzieren".
 * Wird von Launcher und ToyBIOS geladen. Speicher in localStorage (Schlüssel toymesh.prefs), mit try/catch.
 * Keine externen Anfragen. */
(function () {
  "use strict";

  var KEY = "toymesh.prefs";
  var SCALES = [100, 115, 130];
  var CSS_ID = "tm-prefs-css";
  var CSS = ".tm-still *,.tm-still *::before,.tm-still *::after{animation-duration:.01s!important;" +
            "animation-delay:0s!important;transition-duration:.01s!important;}";

  function load() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { p = null; }
    p = p && typeof p === "object" ? p : {};
    return {
      scale: SCALES.indexOf(p.scale) > -1 ? p.scale : 100,
      motion: p.motion === true
    };
  }

  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify({ scale: p.scale, motion: p.motion === true })); } catch (e) { /* egal */ }
  }

  function ensureStyle() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function apply(p) {
    var r = document.documentElement;
    r.style.fontSize = p.scale + "%";
    ensureStyle();
    if (p.motion) r.classList.add("tm-still"); else r.classList.remove("tm-still");
  }

  apply(load());
  window.ToyPrefs = { KEY: KEY, SCALES: SCALES, load: load, save: save, apply: apply };
})();
