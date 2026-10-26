/* ToyPost-Client für ToyDesk. Spricht die ToyPost-API (Bearer-Token) an.
 * Sicherheit: Server-Adresse muss https:// sein (http:// nur für 127.0.0.1/localhost).
 * Der Token liegt nur in sessionStorage und verschwindet beim Schließen des Browsers.
 * Passwörter werden nie gespeichert. */
(function () {
  "use strict";

  var KEY_URL = "toymesh.toypost.url", KEY_TOK = "toymesh.toypost.token";

  function lsGet(k) { try { return window.localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* egal */ } }
  function ssGet(k) { try { return window.sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function ssSet(k, v) { try { if (v) window.sessionStorage.setItem(k, v); else window.sessionStorage.removeItem(k); } catch (e) { /* egal */ } }

  function validUrl(u) {
    try {
      var x = new URL(u);
      if (x.protocol === "https:") return true;
      if (x.protocol === "http:" && (x.hostname === "127.0.0.1" || x.hostname === "localhost")) return true;
    } catch (e) { /* ungültig */ }
    return false;
  }

  function base() { return lsGet(KEY_URL).replace(/\/$/, ""); }

  function req(method, path, body) {
    var headers = { "content-type": "application/json" };
    var tok = ssGet(KEY_TOK);
    if (tok) headers.authorization = "Bearer " + tok;
    return fetch(base() + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var e = d.error || {};
          if (r.status === 401) ssSet(KEY_TOK, "");
          throw { status: r.status, code: e.code || "error", message: e.message || ("Fehler " + r.status) };
        }
        return d;
      });
    }, function () {
      throw { status: 0, code: "offline", message: "Keine Verbindung zum ToyPost-Server. Adresse und Netz prüfen." };
    });
  }

  window.ToyPost = {
    url: function () { return lsGet(KEY_URL); },
    setUrl: function (u) {
      if (!validUrl(u)) throw new Error("Die Adresse muss mit https:// beginnen (http:// nur für 127.0.0.1 oder localhost).");
      lsSet(KEY_URL, u.replace(/\/$/, ""));
    },
    connected: function () { return !!ssGet(KEY_TOK); },
    login: function (email, password) {
      return req("POST", "/v1/auth/login", { email: email, password: password }).then(function (d) {
        ssSet(KEY_TOK, d.token);
        return d;
      });
    },
    logout: function () { ssSet(KEY_TOK, ""); },
    today: function () { return req("GET", "/v1/today"); },
    cases: function (status, q) {
      var p = [];
      if (status) p.push("status=" + encodeURIComponent(status));
      if (q) p.push("q=" + encodeURIComponent(q));
      return req("GET", "/v1/cases" + (p.length ? "?" + p.join("&") : ""));
    },
    setCase: function (id, patch) { return req("PATCH", "/v1/cases/" + encodeURIComponent(id), patch); },
    messages: function (dir) { return req("GET", "/v1/messages" + (dir ? "?direction=" + dir : "")); },
    channels: function () { return req("GET", "/v1/channels"); },
    toyOverview: function () { return req("GET", "/v1/toy/overview"); },
    check: function (text) { return req("POST", "/v1/toy/check", { text: text, direction: "in" }); }
  };
})();
