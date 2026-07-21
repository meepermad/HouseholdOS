/**
 * Inline script (no React). Shows recovery if /app/* never paints Home.
 * Runs even when AppProviders / layouts are still blocked on the server.
 */
export const DOCUMENT_LOAD_WATCHDOG_SCRIPT = `(function(){
  try {
    if (typeof window === "undefined") return;
    var started = Date.now();
    var SHOWN = "householdos_doc_watchdog_shown";
    function pathOk() {
      var p = location.pathname || "";
      return p.indexOf("/app/") === 0 && p.length > 5;
    }
    function homeReady() {
      return !!document.querySelector('[data-testid="home-action-center"]');
    }
    function already() {
      return !!document.querySelector('[data-testid="document-load-watchdog"]');
    }
    function show() {
      if (!pathOk() || homeReady() || already()) return;
      try {
        if (sessionStorage.getItem(SHOWN) === location.pathname) return;
        sessionStorage.setItem(SHOWN, location.pathname);
      } catch (e) {}
      var el = document.createElement("div");
      el.setAttribute("data-testid", "document-load-watchdog");
      el.setAttribute("role", "alert");
      el.style.cssText = "position:fixed;inset:auto 12px 12px 12px;z-index:2147483646;max-width:32rem;margin:0 auto;padding:1rem 1.1rem;border-radius:0.5rem;border:1px solid #c4b8a5;background:#f7f3eb;color:#1c1917;font:500 14px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.12);";
      el.innerHTML = "<p style=\\"margin:0 0 .35rem;font-weight:650\\">This page is taking too long to load.</p>"
        + "<p style=\\"margin:0 0 .75rem;font-weight:400;color:#44403c\\">You may already be signed in. Reload, or return to sign in.</p>"
        + "<div style=\\"display:flex;flex-wrap:wrap;gap:.5rem\\">"
        + "<button type=\\"button\\" data-action=\\"reload\\" style=\\"min-height:44px;padding:.5rem 1rem;border:0;border-radius:.375rem;background:#3f6f5b;color:#fff;font-weight:650;cursor:pointer\\">Reload page</button>"
        + "<a href=\\"/login\\" style=\\"min-height:44px;padding:.5rem 1rem;border:1px solid #c4b8a5;border-radius:.375rem;background:#fff;color:#1c1917;font-weight:650;text-decoration:none;display:inline-flex;align-items:center\\">Return to sign in</a>"
        + "</div>";
      el.addEventListener("click", function(ev) {
        var t = ev.target;
        if (t && t.getAttribute && t.getAttribute("data-action") === "reload") {
          try { sessionStorage.removeItem(SHOWN); } catch (e) {}
          location.reload();
        }
      });
      document.body.appendChild(el);
    }
    function tick() {
      if (homeReady()) return;
      if (Date.now() - started >= 8000) show();
      else setTimeout(tick, 500);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function(){ setTimeout(tick, 0); });
    } else {
      setTimeout(tick, 0);
    }
  } catch (e) {}
})();`;
