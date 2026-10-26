/* ToyChat — verschlüsselter Teamchat, Aufgaben und Videoanrufe.
 * Alles Sensible passiert hier im Browser: Der Raumschlüssel steckt nur im Einladungslink
 * (Teil nach dem #, wird nie an den Server geschickt). Jede Nachricht ist mit dem Schlüssel
 * des Absenders signiert, damit niemand im Raum im Namen anderer schreiben kann.
 * Der Server sieht nur Chiffrat. Videostreams laufen per WebRTC (DTLS-SRTP, verschlüsselt). */
(function () {
  "use strict";

  var subtle = window.crypto && window.crypto.subtle;
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var EC = { name: "ECDSA", namedCurve: "P-256" };
  var SIGN = { name: "ECDSA", hash: "SHA-256" };
  var RTC = window.RTCPeerConnection || null;
  var VIEWS = [["chat", "Chat"], ["tasks", "Aufgaben"], ["team", "Team"]];
  var app = document.getElementById("app");

  // ---------- Helfer ----------
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "on") Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === "value") e.value = v;
      else if (k === "muted") e.muted = !!v;
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function store(k, v) {
    try {
      if (v === undefined) localStorage.removeItem("toychat." + k);
      else localStorage.setItem("toychat." + k, JSON.stringify(v));
    } catch (e) { /* Speicher gesperrt: ToyChat läuft trotzdem, nur ohne Merken */ }
  }
  function load(k) {
    try {
      var r = localStorage.getItem("toychat." + k);
      return r ? JSON.parse(r) : null;
    } catch (e) { return null; }
  }
  function toB64(u8) {
    var s = "";
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function fromB64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function b64u(u8) { return toB64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64u(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return fromB64(s);
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }
  function rnd(n) { var b = new Uint8Array(n); window.crypto.getRandomValues(b); return b; }
  function rid(n) { return hex(rnd(n)); }
  function cat(a, b) { var c = new Uint8Array(a.length + b.length); c.set(a, 0); c.set(b, a.length); return c; }
  function clean(s, max) {
    return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max || 120);
  }
  function cleanText(s) {
    return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 4000);
  }
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  function canonJwk(j) { return JSON.stringify([j.crv, j.x, j.y]); }
  function toast(msg) {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    ui.toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { ui.toast.classList.remove("show"); }, 3800);
  }
  function errText(e) { return e && e.message ? e.message : String(e); }
  function logErr(e) { console.warn("ToyChat:", errText(e)); }
  function normServer(s) {
    var u;
    try { u = new URL(String(s || "").trim()); } catch (e) { throw new Error("Server-Adresse ungültig"); }
    var local = /^(127\.0\.0\.1|localhost)$/.test(u.hostname);
    if (!(u.protocol === "https:" || (u.protocol === "http:" && local))) {
      throw new Error("Server braucht https:// (http nur für 127.0.0.1)");
    }
    return u.origin;
  }

  // ---------- Zustand ----------
  var room = null;   // {id, aes}
  var me = null;     // {id, name, privKey, pubKey, pubJwk}
  var ws = null;     // {server, key, name}
  var ICE = [];
  var call = null;   // {local, localVideo, peers:{id:P}}
  var S = null;
  var ui = {};

  function resetState() {
    S = {
      chans: [], msgs: {}, tasks: {}, members: {},
      lastSeq: 0, rejected: 0, cur: null, view: "chat",
      es: null, queue: Promise.resolve(), status: "", fp: "",
      adding: false, callOpen: false, lastView: null, lastCur: null
    };
  }
  resetState();

  // ---------- Kryptografie ----------
  async function deriveRoom(keyBytes) {
    var h = await subtle.digest("SHA-256", cat(enc.encode("toychat-room-id|"), keyBytes));
    var aes = await subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
    return { id: hex(h).slice(0, 32), aes: aes };
  }
  async function seal(obj) {
    var iv = rnd(12);
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, room.aes, enc.encode(JSON.stringify(obj)));
    return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
  }
  async function open(env) {
    try {
      var pt = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(env.iv) }, room.aes, fromB64(env.ct));
      return JSON.parse(dec.decode(pt));
    } catch (e) { return null; }
  }
  async function sign(text) {
    return toB64(new Uint8Array(await subtle.sign(SIGN, me.privKey, enc.encode(text))));
  }
  async function verify(pub, text, sig) {
    try { return await subtle.verify(SIGN, pub, fromB64(sig), enc.encode(text)); }
    catch (e) { return false; }
  }
  async function fingerprint(keyB64u) {
    var h = await subtle.digest("SHA-256", unb64u(keyB64u));
    return hex(h).slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
  }

  async function ensureIdentity(name) {
    var s = load("me");
    if (s && s.privJwk && s.pubJwk && s.id) {
      me = {
        id: s.id, name: clean(s.name, 40), pubJwk: s.pubJwk,
        privKey: await subtle.importKey("jwk", s.privJwk, EC, true, ["sign"]),
        pubKey: await subtle.importKey("jwk", s.pubJwk, EC, true, ["verify"])
      };
      return;
    }
    var kp = await subtle.generateKey(EC, true, ["sign", "verify"]);
    var pubJwk = await subtle.exportKey("jwk", kp.publicKey);
    var privJwk = await subtle.exportKey("jwk", kp.privateKey);
    me = { id: rid(8), name: clean(name, 40), privKey: kp.privateKey, pubKey: kp.publicKey, pubJwk: pubJwk };
    store("me", { id: me.id, name: me.name, pubJwk: pubJwk, privJwk: privJwk });
  }

  // ---------- Verschlüsselte Ereignisse ----------
  function enqueue(fn) {
    S.queue = S.queue.then(fn).catch(logErr);
  }

  async function publish(ev) {
    ev.from = me.id;
    ev.ts = Date.now();
    var body = JSON.stringify(ev);
    var env = await seal({ body: body, sig: await sign(body) });
    var r = await fetch(ws.server + "/api/r/" + room.id + "/events", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(env)
    });
    if (!r.ok) throw new Error(r.status === 507 ? "Raum ist voll" : "Senden fehlgeschlagen (" + r.status + ")");
  }

  async function apply(d) {
    if (d.seq <= S.lastSeq) return;   // doppelt (Wiederverbindung) -> ignorieren
    S.lastSeq = d.seq;
    var p = await open(d);
    if (!p || typeof p.body !== "string" || typeof p.sig !== "string") { S.rejected++; return; }
    var ev;
    try { ev = JSON.parse(p.body); } catch (e) { S.rejected++; return; }

    if (ev.t === "hello") {
      var pub = await subtle.importKey("jwk", ev.pub, EC, true, ["verify"]).catch(function () { return null; });
      if (!pub || typeof ev.id !== "string" || !(await verify(pub, p.body, p.sig))) { S.rejected++; return; }
      var old = S.members[ev.id];
      if (old && old.canon !== canonJwk(ev.pub)) { S.rejected++; return; }   // Schlüssel darf sich nie ändern
      S.members[ev.id] = { id: ev.id, name: clean(ev.name, 40), pub: pub, canon: canonJwk(ev.pub) };
    } else {
      var m = S.members[ev.from];
      if (!m || !(await verify(m.pub, p.body, p.sig))) { S.rejected++; return; }
      var idOk = typeof ev.id === "string" && /^[0-9a-f]{6,32}$/.test(ev.id);
      var chOk = typeof ev.ch === "string" && !!S.msgs[ev.ch] && Object.prototype.hasOwnProperty.call(S.msgs, ev.ch);
      if (ev.t === "chan" && idOk) {
        if (!S.msgs[ev.id]) {
          S.chans.push({ id: ev.id, name: clean(ev.name, 40) });
          S.msgs[ev.id] = [];
          if (!S.cur) S.cur = ev.id;
        }
      } else if (ev.t === "msg" && idOk && chOk) {
        S.msgs[ev.ch].push({ id: ev.id, from: ev.from, text: cleanText(ev.text), ts: Number(ev.ts) || 0 });
      } else if (ev.t === "task" && idOk && chOk) {
        S.tasks[ev.id] = {
          id: ev.id, ch: ev.ch, title: clean(ev.title, 160),
          assignee: typeof ev.assignee === "string" ? ev.assignee : "",
          status: "open", from: ev.from, ts: Number(ev.ts) || 0
        };
      } else if (ev.t === "tstat" && typeof ev.task === "string" && Object.prototype.hasOwnProperty.call(S.tasks, ev.task)) {
        S.tasks[ev.task].status = ev.status === "done" ? "done" : "open";
      }
    }
    render();
  }

  // ---------- Verbindung ----------
  function status(text) {
    S.status = text;
    var s = document.getElementById("status");
    if (s) s.textContent = text;
  }

  function connect() {
    if (S.es) S.es.close();
    var es = new EventSource(ws.server + "/api/r/" + room.id + "/stream?after=" + S.lastSeq);
    S.es = es;
    es.addEventListener("ev", function (e) {
      var d = JSON.parse(e.data);
      enqueue(function () { return apply(d); });
    });
    es.addEventListener("sig", function (e) {
      var d = JSON.parse(e.data);
      enqueue(function () { return onSignal(d); });
    });
    es.onopen = function () { status("verbunden"); };
    es.onerror = function () { status("Verbindung unterbrochen – verbinde neu …"); };
  }

  async function signal(to, kind, data) {
    var body = JSON.stringify({ to: to, from: me.id, kind: kind, data: data || {} });
    var env = await seal({ body: body, sig: await sign(body) });
    fetch(ws.server + "/api/r/" + room.id + "/signal", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(env)
    }).catch(logErr);
  }

  async function onSignal(d) {
    var p = await open(d);
    if (!p || typeof p.body !== "string" || typeof p.sig !== "string") return;
    var s;
    try { s = JSON.parse(p.body); } catch (e) { return; }
    var m = S.members[s.from];
    if (!m || s.from === me.id || (s.to !== "*" && s.to !== me.id)) return;
    if (!(await verify(m.pub, p.body, p.sig))) return;
    callSignal(s.from, s.kind, s.data || {});
  }

  // ---------- Anrufe (WebRTC, Mesh bis ca. 4 Teilnehmer) ----------
  function nameOf(id) { return S.members[id] ? S.members[id].name : id.slice(0, 6); }

  async function startCall() {
    if (!RTC) { toast("Video braucht WebRTC. Dafür den Browser ToySurf Voll nutzen."); return; }
    if (call) return;
    var local = null, note = "";
    try {
      local = await navigator.mediaDevices.getUserMedia({
        audio: true, video: { width: 640, height: 360, frameRate: 15 }
      });
    } catch (e) {
      try {
        local = await navigator.mediaDevices.getUserMedia({ audio: true });
        note = "Ohne Kamera – nur Ton.";
      } catch (e2) {
        note = "Kein Mikrofon erlaubt – du hörst nur zu.";
      }
    }
    call = { local: local, localVideo: null, peers: {} };
    if (local) {
      call.localVideo = el("video", { autoplay: "", playsinline: "", muted: true });
      call.localVideo.srcObject = local;
    }
    S.callOpen = true;
    if (note) toast(note);
    signal("*", "join", { name: me.name }).catch(logErr);
    render();
  }

  function callSignal(from, kind, data) {
    if (kind === "bye") { dropPeer(from); return; }
    if (!call) return;
    if (kind === "join") {
      if (!call.peers[from]) makeOffer(from).catch(logErr);
      return;
    }
    if (kind === "offer") { onOffer(from, data.sdp).catch(logErr); return; }
    var P = call.peers[from];
    if (!P) return;
    if (kind === "answer") {
      P.pc.setRemoteDescription({ type: "answer", sdp: data.sdp }).then(function () {
        P.remote = true;
        flushIce(P);
      }).catch(logErr);
    } else if (kind === "ice" && data.c) {
      if (P.remote) P.pc.addIceCandidate(data.c).catch(logErr);
      else P.pending.push(data.c);
    }
  }

  function makePeer(id) {
    var pc = new RTC({ iceServers: ICE });
    var P = { id: id, pc: pc, pending: [], remote: false, video: el("video", { autoplay: "", playsinline: "" }) };
    call.peers[id] = P;
    if (call.local) {
      call.local.getTracks().forEach(function (t) { pc.addTrack(t, call.local); });
    } else {
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });
    }
    pc.onicecandidate = function (e) {
      if (e.candidate) signal(id, "ice", { c: e.candidate.toJSON() }).catch(logErr);
    };
    pc.ontrack = function (e) {
      P.video.srcObject = e.streams[0] || new MediaStream([e.track]);
      render();
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") dropPeer(id);
    };
    return P;
  }

  async function makeOffer(id) {
    var P = makePeer(id);
    await P.pc.setLocalDescription(await P.pc.createOffer());
    signal(id, "offer", { sdp: P.pc.localDescription.sdp }).catch(logErr);
    render();
  }

  async function onOffer(id, sdp) {
    var P = call.peers[id] || makePeer(id);
    var pc = P.pc;
    if (pc.signalingState === "have-local-offer") {
      // Gleichzeitige Angebote: der mit dem größeren Kennwert gibt nach, damit es keinen Patt gibt
      if (me.id < id) return;
      await pc.setLocalDescription({ type: "rollback" });
    }
    await pc.setRemoteDescription({ type: "offer", sdp: sdp });
    P.remote = true;
    flushIce(P);
    await pc.setLocalDescription(await pc.createAnswer());
    signal(id, "answer", { sdp: pc.localDescription.sdp }).catch(logErr);
    render();
  }

  function flushIce(P) {
    P.pending.splice(0).forEach(function (c) { P.pc.addIceCandidate(c).catch(logErr); });
  }

  function dropPeer(id) {
    var P = call && call.peers[id];
    if (!P) return;
    P.pc.close();
    delete call.peers[id];
    render();
  }

  function hangUp() {
    if (!call) return;
    signal("*", "bye", {}).catch(logErr);
    Object.keys(call.peers).forEach(function (id) { call.peers[id].pc.close(); });
    if (call.local) call.local.getTracks().forEach(function (t) { t.stop(); });
    call = null;
    S.callOpen = false;
    render();
  }

  function toggleTrack(kind) {
    if (!call || !call.local) return;
    call.local.getTracks().forEach(function (t) { if (t.kind === kind) t.enabled = !t.enabled; });
    render();
  }

  function trackOn(kind) {
    if (!call || !call.local) return false;
    return call.local.getTracks().some(function (t) { return t.kind === kind && t.enabled; });
  }

  function onCallBtn() {
    if (!call) startCall();
    else { S.callOpen = !S.callOpen; render(); }
  }

  // ---------- Aufbau der Oberfläche ----------
  function shell() {
    app.textContent = "";
    ui.wsname = el("span", { class: "ws", id: "wsname" });
    ui.status = el("span", { class: "status", id: "status" }, [S.status]);
    ui.callbtn = el("button", { class: "btn", id: "callbtn", on: { click: onCallBtn } }, ["Anruf starten"]);
    ui.top = el("header", { class: "top" }, [
      el("div", { class: "brand" }, ["ToyChat ", ui.wsname]),
      ui.status,
      ui.callbtn
    ]);
    ui.nav = el("nav", { class: "tabs" }, VIEWS.map(function (v) {
      return el("button", {
        class: "tab", "data-view": v[0],
        on: { click: function () { S.view = v[0]; render(); } }
      }, [v[1]]);
    }));
    ui.view = el("main", { class: "view", id: "view" });
    ui.taskform = el("form", { class: "composer", id: "taskform", on: { submit: onTaskSubmit } }, [
      el("input", { id: "tTitle", class: "grow", autocomplete: "off", maxlength: "160", placeholder: "Neue Aufgabe …", required: "" }),
      el("select", { id: "tAssign", "aria-label": "Zuständig" }),
      el("select", { id: "tChan", "aria-label": "Kanal" }),
      el("button", { class: "btn", type: "submit" }, ["Anlegen"])
    ]);
    ui.composer = el("form", { class: "composer", id: "composer", on: { submit: onSend } }, [
      el("input", { id: "msgin", class: "grow", autocomplete: "off", maxlength: "4000", placeholder: "Nachricht schreiben – Ende-zu-Ende verschlüsselt" }),
      el("button", { class: "btn", type: "submit" }, ["Senden"])
    ]);
    ui.call = el("section", { class: "call", id: "call", hidden: "" });
    ui.toast = el("div", { class: "toast", id: "toast", role: "status" });
    [ui.top, ui.nav, ui.view, ui.taskform, ui.composer, ui.call, ui.toast].forEach(function (n) { app.appendChild(n); });
  }

  function chanName(id) {
    var c = S.chans.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "?";
  }

  function render() {
    if (!ui.view || !me || !ws) return;
    ui.wsname.textContent = ws.name;
    ui.callbtn.textContent = call ? "Anruf öffnen" : "Anruf starten";
    ui.nav.querySelectorAll(".tab").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-view") === S.view);
    });

    var list = document.getElementById("msgs");
    var viewChanged = S.lastView !== S.view || S.lastCur !== S.cur;
    var atBottom = viewChanged || !list || list.scrollTop + list.clientHeight >= list.scrollHeight - 60;
    S.lastView = S.view;
    S.lastCur = S.cur;

    ui.view.textContent = "";
    if (S.view === "chat") ui.view.appendChild(viewChat());
    else if (S.view === "tasks") ui.view.appendChild(viewTasks());
    else ui.view.appendChild(viewTeam());

    ui.composer.hidden = S.view !== "chat";
    ui.taskform.hidden = S.view !== "tasks";
    if (S.view === "tasks") refillTaskForm();

    var nl = document.getElementById("msgs");
    if (nl && atBottom) nl.scrollTop = nl.scrollHeight;
    renderCall();
  }

  function viewChat() {
    var bar = el("div", { class: "chans" });
    S.chans.forEach(function (c) {
      bar.appendChild(el("button", {
        class: "chip" + (c.id === S.cur ? " on" : ""),
        on: { click: function () { S.cur = c.id; render(); } }
      }, ["# " + c.name]));
    });
    if (S.adding) {
      bar.appendChild(el("input", {
        id: "newChan", class: "chip-in", maxlength: "40", placeholder: "Kanalname", autocomplete: "off",
        on: { keydown: function (ev) {
          if (ev.key === "Enter") {
            var n = clean(ev.target.value, 40);
            S.adding = false;
            if (n) publish({ t: "chan", id: rid(6), name: n }).catch(function (e) { toast(errText(e)); });
            else render();
          } else if (ev.key === "Escape") { S.adding = false; render(); }
        } }
      }));
    } else {
      bar.appendChild(el("button", { class: "chip add", on: { click: function () { S.adding = true; render(); } } }, ["+ Kanal"]));
    }

    var msgs = el("div", { class: "msgs", id: "msgs" });
    var items = S.msgs[S.cur] || [];
    if (!S.cur) msgs.appendChild(el("p", { class: "muted" }, ["Noch kein Kanal vorhanden."]));
    items.forEach(function (m) {
      var mine = m.from === me.id;
      msgs.appendChild(el("div", { class: "msg" + (mine ? " mine" : "") }, [
        el("div", { class: "meta" }, [
          el("b", {}, [S.members[m.from] ? S.members[m.from].name : "Unbekannt"]),
          " · " + fmtTime(m.ts) + " · ✓ signiert"
        ]),
        el("div", { class: "txt" }, [m.text])
      ]));
    });
    return el("div", { class: "chat" }, [bar, msgs]);
  }

  function viewTasks() {
    var list = el("div", { class: "list" });
    var items = Object.keys(S.tasks).map(function (k) { return S.tasks[k]; })
      .sort(function (a, b) { return a.ts - b.ts; });
    if (!items.length) list.appendChild(el("p", { class: "muted" }, ["Noch keine Aufgaben. Unten anlegen."]));
    items.forEach(function (t) {
      var done = t.status === "done";
      var who = t.assignee && S.members[t.assignee] ? S.members[t.assignee].name : "niemand";
      list.appendChild(el("div", { class: "task" + (done ? " done" : "") }, [
        el("button", {
          class: "chk", "aria-label": done ? "wieder öffnen" : "als erledigt markieren",
          on: { click: function () {
            publish({ t: "tstat", task: t.id, status: done ? "open" : "done" }).catch(function (e) { toast(errText(e)); });
          } }
        }, [done ? "☑" : "☐"]),
        el("div", { class: "tt" }, [
          el("div", {}, [t.title]),
          el("div", { class: "muted" }, ["#" + chanName(t.ch) + " · zuständig: " + who])
        ])
      ]));
    });
    return list;
  }

  function refillTaskForm() {
    var a = document.getElementById("tAssign"), c = document.getElementById("tChan");
    if (!a || !c) return;
    var va = a.value, vc = c.value;
    a.textContent = ""; c.textContent = "";
    a.appendChild(el("option", { value: "" }, ["niemand"]));
    Object.keys(S.members).forEach(function (id) {
      a.appendChild(el("option", { value: id }, [S.members[id].name]));
    });
    S.chans.forEach(function (ch) {
      c.appendChild(el("option", { value: ch.id }, ["#" + ch.name]));
    });
    if (va) a.value = va;
    if (vc) c.value = vc;
  }

  function viewTeam() {
    var box = el("div", { class: "team" });
    box.appendChild(el("h3", {}, ["Mitglieder"]));
    Object.keys(S.members).forEach(function (id) {
      var m = S.members[id];
      var inCall = !!call && (id === me.id || !!call.peers[id]);
      box.appendChild(el("div", { class: "member" }, [
        m.name + (id === me.id ? " (du)" : ""),
        inCall ? el("span", { class: "tag" }, ["im Anruf"]) : null
      ]));
    });

    box.appendChild(el("h3", {}, ["Einladen"]));
    box.appendChild(el("p", { class: "muted" }, [
      "Der Link enthält den Raumschlüssel. Nur an Personen geben, die dazugehören sollen."
    ]));
    var ta = el("textarea", { class: "invite", readonly: "", rows: "3", "aria-label": "Einladungslink" });
    ta.value = inviteLink();
    box.appendChild(ta);
    box.appendChild(el("button", {
      class: "btn", on: { click: function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.value)
            .then(function () { toast("Einladung kopiert"); })
            .catch(function () { ta.select(); toast("Markieren und kopieren"); });
        } else { ta.select(); toast("Markieren und kopieren"); }
      } }
    }, ["Link kopieren"]));

    box.appendChild(el("h3", {}, ["Sicherheit"]));
    box.appendChild(el("p", { class: "muted" }, [
      "Sicherheitscode des Raums: " + S.fp + ". Bei Zweifel mit den anderen am Telefon vergleichen."
    ]));
    box.appendChild(el("p", { class: "muted" }, [
      "Abgewiesene Einträge: " + S.rejected + " (Signatur oder Schlüssel ungültig)."
    ]));
    box.appendChild(el("button", { class: "btn ghost", on: { click: leaveWorkspace } }, ["Arbeitsbereich auf diesem Gerät verlassen"]));
    return box;
  }

  function inviteLink() {
    return location.origin + location.pathname + "#join=" +
      b64u(enc.encode(JSON.stringify({ s: ws.server, k: ws.key, n: ws.name })));
  }

  function renderCall() {
    ui.call.hidden = !call || !S.callOpen;
    ui.call.textContent = "";
    if (!call || !S.callOpen) return;
    var names = Object.keys(call.peers).map(nameOf);
    var tiles = [];
    if (call.localVideo) tiles.push(tile(call.localVideo, "Du"));
    else tiles.push(tile(el("div", { class: "novid" }, ["keine Kamera"]), "Du"));
    Object.keys(call.peers).forEach(function (id) {
      tiles.push(tile(call.peers[id].video, nameOf(id)));
    });
    ui.call.appendChild(el("header", { class: "top" }, [
      el("div", { class: "brand" }, ["Anruf · " + (ws ? ws.name : "")]),
      el("span", { class: "status" }, [names.length ? "mit " + names.join(", ") : "warte auf andere …"]),
      el("button", { class: "btn ghost", on: { click: function () { S.callOpen = false; render(); } } }, ["Ausblenden"])
    ]));
    ui.call.appendChild(el("div", { class: "grid" }, tiles));
    ui.call.appendChild(el("div", { class: "controls" }, [
      el("button", { class: "btn", on: { click: function () { toggleTrack("audio"); } } },
        [trackOn("audio") ? "Mikrofon aus" : "Mikrofon an"]),
      el("button", { class: "btn", on: { click: function () { toggleTrack("video"); } } },
        [trackOn("video") ? "Kamera aus" : "Kamera an"]),
      el("button", { class: "btn danger", on: { click: hangUp } }, ["Auflegen"])
    ]));
  }

  function tile(video, label) {
    return el("div", { class: "tile" }, [video, el("div", { class: "lbl" }, [label])]);
  }

  // ---------- Aktionen ----------
  function onSend(ev) {
    ev.preventDefault();
    var inp = document.getElementById("msgin");
    var text = cleanText(inp.value).trim();
    if (!text || !S.cur) return;
    inp.value = "";
    publish({ t: "msg", id: rid(8), ch: S.cur, text: text }).catch(function (e) {
      inp.value = text;
      toast(errText(e));
    });
  }

  function onTaskSubmit(ev) {
    ev.preventDefault();
    var title = clean(document.getElementById("tTitle").value, 160);
    var ch = document.getElementById("tChan").value;
    var who = document.getElementById("tAssign").value;
    if (!title || !S.msgs[ch]) return;
    document.getElementById("tTitle").value = "";
    publish({ t: "task", id: rid(8), ch: ch, title: title, assignee: who }).catch(function (e) { toast(errText(e)); });
  }

  function leaveWorkspace() {
    hangUp();
    if (S.es) S.es.close();
    store("ws", undefined);
    ws = null; room = null;
    resetState();
    renderOnboard(null);
  }

  // ---------- Einrichtung ----------
  function renderOnboard(invite) {
    app.textContent = "";
    var defServer = /:8080$/.test(location.origin) ? "http://127.0.0.1:8090" : location.origin;
    var nameIn = el("input", { id: "oName", maxlength: "40", required: "", autocomplete: "name", placeholder: "Dein Name" });
    var wsIn = el("input", { id: "oWs", maxlength: "60", placeholder: "z. B. Team Nord", value: "Mein Team" });
    var srvIn = el("input", { id: "oSrv", placeholder: "https://…", value: defServer });
    var invIn = el("textarea", { id: "oInv", rows: "3", placeholder: "Einladungslink hier einfügen" });
    if (invite) invIn.value = invite;
    var secNew = el("div", { class: "sec" }, [
      el("label", {}, ["Arbeitsbereich", wsIn]),
      el("label", {}, ["Server", srvIn]),
      el("p", { class: "muted" }, ["Der Server speichert nur verschlüsselte Daten. Für Nutzer außerhalb dieses Geräts braucht er https://."])
    ]);
    var secJoin = el("div", { class: "sec" }, [el("label", {}, ["Einladung", invIn])]);
    var modeNew = el("input", { type: "radio", name: "oMode", value: "new" });
    var modeJoin = el("input", { type: "radio", name: "oMode", value: "join" });
    if (invite) modeJoin.checked = true; else modeNew.checked = true;
    function toggle() {
      var join = modeJoin.checked;
      secNew.hidden = join;
      secJoin.hidden = !join;
    }
    modeNew.addEventListener("change", toggle);
    modeJoin.addEventListener("change", toggle);
    toggle();

    var form = el("form", { class: "onboard", on: { submit: function (ev) {
      ev.preventDefault();
      onboardSubmit({
        name: nameIn.value, mode: modeJoin.checked ? "join" : "new",
        wsName: wsIn.value, server: srvIn.value, invite: invIn.value
      });
    } } }, [
      el("h1", {}, ["ToyChat"]),
      el("p", { class: "muted" }, ["Verschlüsselter Teamchat, Aufgaben und Videoanrufe. Kein Konto, kein Passwort. Wer den Einladungslink hat, gehört dazu."]),
      el("label", {}, ["Dein Name", nameIn]),
      el("div", { class: "modes" }, [
        el("label", {}, [modeNew, " Neuer Arbeitsbereich"]),
        el("label", {}, [modeJoin, " Einladung annehmen"])
      ]),
      secNew, secJoin,
      el("button", { class: "btn wide", type: "submit" }, ["Los"])
    ]);
    app.appendChild(form);
    app.appendChild(el("div", { class: "toast", id: "toast", role: "status" }));
    ui = { toast: document.getElementById("toast") };
  }

  function parseInvite(raw) {
    var s = String(raw || "").trim();
    var i = s.indexOf("join=");
    if (i < 0) return null;
    var token = s.slice(i + 5).split(/[&\s]/)[0];
    var o;
    try { o = JSON.parse(dec.decode(unb64u(token))); } catch (e) { return null; }
    if (!o || typeof o.k !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(o.k)) return null;
    return { server: normServer(o.s), key: o.k, name: clean(o.n || "Team", 60) };
  }

  async function onboardSubmit(v) {
    try {
      var name = clean(v.name, 40);
      if (!name) throw new Error("Bitte einen Namen eingeben");
      await ensureIdentity(name);
      var w;
      if (v.mode === "new") {
        w = { server: normServer(v.server), key: b64u(rnd(32)), name: clean(v.wsName || "Mein Team", 60) };
      } else {
        w = parseInvite(v.invite);
        if (!w) throw new Error("Einladung ungültig");
      }
      ws = w;
      store("ws", ws);
      await enter(v.mode === "new");
    } catch (e) {
      toast(errText(e));
    }
  }

  async function enter(isNew) {
    var keyBytes = unb64u(ws.key);
    if (keyBytes.length !== 32) throw new Error("Schlüssel ungültig");
    room = await deriveRoom(keyBytes);
    resetState();
    S.fp = await fingerprint(ws.key);
    shell();
    render();
    ICE = await fetch(ws.server + "/api/config")
      .then(function (r) { return r.json(); })
      .then(function (c) { return c.iceServers || []; })
      .catch(function () { return []; });
    connect();
    await publish({ t: "hello", id: me.id, name: me.name, pub: me.pubJwk });
    if (isNew) await publish({ t: "chan", id: rid(6), name: "allgemein" });
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
  }

  // ---------- Start ----------
  async function init() {
    if (!subtle) {
      app.textContent = "ToyChat braucht Web Crypto. Öffne die Seite über http://127.0.0.1 oder https://.";
      return;
    }
    var invite = location.hash.indexOf("#join=") === 0 ? location.hash : null;
    ws = load("ws");
    var ident = load("me");
    if (invite || !ws || !ident) {
      renderOnboard(invite);
      return;
    }
    try {
      await ensureIdentity();
      if (!me) throw new Error("Identität fehlt");
      room = null;
      ws = load("ws");
      await enter(false);
    } catch (e) {
      toast(errText(e));
      renderOnboard(null);
    }
  }

  window.addEventListener("pagehide", function () { if (call) hangUp(); });
  init();
})();
