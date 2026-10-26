// ToySurf user.js — hardening for Firefox ESR (arkenfox-inspired, trimmed for
// a single-user appliance). Copied into the ToySurf profile by setup-toysurf.sh.
// Loopback (http://127.0.0.1) is exempt from HTTPS-Only, so your local ToyVerse
// apps keep working. Comment out any line that breaks a site you need.

/* --- Telemetry / data collection: OFF --- */
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.unified", false);
user_pref("toolkit.telemetry.archive.enabled", false);
user_pref("app.shield.optoutstudies.enabled", false);
user_pref("app.normandy.enabled", false);
user_pref("breakpad.reportURL", "");
user_pref("browser.tabs.crashReporting.sendReport", false);

/* --- Captive portal / background connections --- */
user_pref("captivedetect.canonicalURL", "");
user_pref("network.captive-portal-service.enabled", false);
user_pref("network.connectivity-service.enabled", false);
user_pref("browser.safebrowsing.downloads.remote.enabled", false);

/* --- Prefetch / speculative connections: OFF (less leakage) --- */
user_pref("network.prefetch-next", false);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.predictor.enabled", false);
user_pref("network.http.speculative-parallel-limit", 0);
user_pref("browser.urlbar.speculativeConnect.enabled", false);

/* --- HTTPS everywhere --- */
user_pref("dom.security.https_only_mode", true);
user_pref("dom.security.https_only_mode_ever_enabled", true);
user_pref("security.ssl.require_safe_negotiation", true);
user_pref("security.tls.enable_0rtt_data", false);

/* --- DNS-over-HTTPS (mode 2 = DoH with fallback; 3 = strict) --- */
user_pref("network.trr.mode", 2);
user_pref("network.trr.uri", "https://dns.quad9.net/dns-query");

/* --- Cookies & cross-site isolation (Total Cookie Protection) --- */
user_pref("network.cookie.cookieBehavior", 5);
user_pref("privacy.partition.network_state", true);
user_pref("privacy.firstparty.isolate", true);

/* --- Tracking Protection: strict --- */
user_pref("browser.contentblocking.category", "strict");
user_pref("privacy.trackingprotection.enabled", true);
user_pref("privacy.trackingprotection.socialtracking.enabled", true);
user_pref("privacy.trackingprotection.cryptomining.enabled", true);
user_pref("privacy.trackingprotection.fingerprinting.enabled", true);

/* --- Fingerprinting resistance (may letterbox windows; that's expected) --- */
user_pref("privacy.resistFingerprinting", true);
user_pref("privacy.resistFingerprinting.letterboxing", true);
user_pref("webgl.disabled", true);
user_pref("media.navigator.enabled", false);

/* --- WebRTC leak protection --- */
user_pref("media.peerconnection.enabled", false);
user_pref("media.peerconnection.ice.default_address_only", true);
user_pref("media.peerconnection.ice.no_host", true);

/* --- Referer trimming --- */
user_pref("network.http.referer.XOriginPolicy", 2);
user_pref("network.http.referer.XOriginTrimmingPolicy", 2);

/* --- Disk: don't persist more than needed --- */
user_pref("browser.cache.disk.enable", false);
user_pref("browser.sessionstore.privacy_level", 2);
user_pref("places.history.enabled", true); // set false for no history at all
user_pref("signon.rememberSignons", false);

/* --- Misc surface reduction --- */
user_pref("dom.disable_window_move_resize", true);
user_pref("browser.uitour.enabled", false);
user_pref("extensions.pocket.enabled", false);
user_pref("identity.fxaccounts.enabled", false);
user_pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
user_pref("geo.enabled", false);

/* --- Search: ToySearch stays default (also enforced by policies.json) --- */
user_pref("browser.search.suggest.enabled", false);
user_pref("browser.urlbar.suggest.searches", false);
