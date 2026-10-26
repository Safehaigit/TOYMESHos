#!/usr/bin/env node
// ToyChat-Server — reines Relais. Speichert und leitet NUR verschlüsselte Blobs weiter.
// Kein Klartext, keine Namen, keine Schlüssel auf dem Server. Keine Abhängigkeiten.
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");

var HOST = process.env.TOYCHAT_HOST || "127.0.0.1";
var PORT = parseInt(process.env.TOYCHAT_PORT || "8090", 10);
var DATA = process.env.TOYCHAT_DATA || "/var/lib/toychat";
var WEB = path.resolve(process.env.TOYCHAT_WEB || "/srv/toyverse/toychat");
var CONF = process.env.TOYCHAT_CONF || "/etc/toychat/server.json";
var MAX_BODY = 65536;
var MAX_EVENTS = 20000;

var config = {
  iceServers: [],
  allowedOrigins: ["http://127.0.0.1:8080", "http://localhost:8080"]
};
try {
  Object.assign(config, JSON.parse(fs.readFileSync(CONF, "utf8")));
} catch (e) { /* keine Konfiguration: Standardwerte */ }

var rooms = new Map();
var ROOM_RE = /^\/api\/r\/([0-9a-f]{32})\/(events|stream|signal)$/;
var B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function getRoom(id) {
  var r = rooms.get(id);
  if (r) return r;
  r = { events: [], subs: new Set(), file: path.join(DATA, id + ".jsonl") };
  try {
    fs.readFileSync(r.file, "utf8").split("\n").forEach(function (line) {
      if (!line) return;
      try { r.events.push(JSON.parse(line)); } catch (e) { /* defekte Zeile überspringen */ }
    });
  } catch (e) { /* neuer Raum */ }
  rooms.set(id, r);
  return r;
}

function validEnv(o) {
  return !!o && typeof o.iv === "string" && typeof o.ct === "string" &&
    o.iv.length >= 12 && o.iv.length <= 32 && B64_RE.test(o.iv) &&
    o.ct.length > 0 && o.ct.length <= MAX_BODY && B64_RE.test(o.ct);
}

function readJSON(req, cb) {
  var size = 0, chunks = [], done = false;
  req.on("data", function (c) {
    size += c.length;
    if (size > MAX_BODY) {
      if (!done) { done = true; cb(new Error("zu groß")); }
      req.destroy();
    } else {
      chunks.push(c);
    }
  });
  req.on("end", function () {
    if (done) return;
    done = true;
    try { cb(null, JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
    catch (e) { cb(e); }
  });
}

function setHeaders(req, res) {
  var origin = req.headers.origin;
  if (origin && config.allowedOrigins.indexOf(origin) !== -1) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function sse(res, event, data) {
  res.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");
}

function roomRoute(req, res, room, action, url) {
  if (action === "events" && req.method === "POST") {
    return readJSON(req, function (err, body) {
      if (err) return sendJSON(res, 400, { error: "ungültige Anfrage" });
      if (!validEnv(body)) return sendJSON(res, 400, { error: "ungültige Anfrage" });
      if (room.events.length >= MAX_EVENTS) return sendJSON(res, 507, { error: "Raum voll" });
      var rec = { seq: room.events.length + 1, iv: body.iv, ct: body.ct };
      room.events.push(rec);
      fs.appendFile(room.file, JSON.stringify(rec) + "\n", function () {});
      room.subs.forEach(function (s) { sse(s, "ev", rec); });
      sendJSON(res, 200, { seq: rec.seq });
    });
  }

  if (action === "signal" && req.method === "POST") {
    return readJSON(req, function (err, body) {
      if (err || !validEnv(body)) return sendJSON(res, 400, { error: "ungültige Anfrage" });
      // Anruf-Signale werden nicht gespeichert, nur an gerade verbundene Teilnehmer geschickt
      room.subs.forEach(function (s) { sse(s, "sig", { iv: body.iv, ct: body.ct }); });
      res.writeHead(204);
      res.end();
    });
  }

  if (action === "stream" && req.method === "GET") {
    var after = parseInt(url.searchParams.get("after") || "0", 10);
    if (!(after >= 0)) after = 0;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write("retry: 3000\n\n");
    room.events.forEach(function (ev) { if (ev.seq > after) sse(res, "ev", ev); });
    room.subs.add(res);
    var ping = setInterval(function () { res.write(": ping\n\n"); }, 25000);
    req.on("close", function () {
      clearInterval(ping);
      room.subs.delete(res);
    });
    return;
  }

  return sendJSON(res, 405, { error: "Methode nicht erlaubt" });
}

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2"
};
var CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; " +
  "frame-ancestors 'self'; base-uri 'none'; form-action 'none'";

function serveStatic(res, pathname) {
  var rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  var file = path.normalize(path.join(WEB, rel));
  if (file.indexOf(WEB + path.sep) !== 0) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("nicht gefunden");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Content-Security-Policy": CSP,
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(file).pipe(res);
  });
}

var server = http.createServer(function (req, res) {
  setHeaders(req, res);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    var url = new URL(req.url, "http://localhost");
    var p = url.pathname;
    if (p === "/api/config") return sendJSON(res, 200, { iceServers: config.iceServers || [] });
    var m = p.match(ROOM_RE);
    if (m) return roomRoute(req, res, getRoom(m[1]), m[2], url);
    if (p.indexOf("/api/") === 0) return sendJSON(res, 404, { error: "nicht gefunden" });
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      return res.end();
    }
    return serveStatic(res, p);
  } catch (e) {
    if (!res.headersSent) sendJSON(res, 500, { error: "intern" });
  }
});

fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });
server.listen(PORT, HOST, function () {
  console.log("ToyChat-Server läuft auf http://" + HOST + ":" + PORT);
});
