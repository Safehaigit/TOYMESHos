ToyVerse app webroot
====================

This folder is served by the `toyverse-web` service on http://127.0.0.1:8080/
(loopback only — not exposed to the network).

  index.html              the launcher / home screen
  apps/toysafe-cockpit.html   ToySafe Cockpit dashboard
  web/                        ToyVerse website, all languages (web/de/ is German)
                              built by scripts/fetch-website.sh, updated by toyweb-update

To update an app: drop a new .html here (same filename) and reload the page.
No rebuild or reflash needed. To add an app, add an entry to apps.json.
