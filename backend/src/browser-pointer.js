// A pretend mouse pointer drawn in the page, so whoever watches the live browser sees where the AI clicks, types and
// scrolls. agent-browser runs this at the start of every page (--init-script). It only follows what the page feels
// happen, so it never slows or stops an action.
// ponytail: a page already open when the browser tool connects has no pointer until its next page load
(function () {
  if (window.top !== window || window.__ezPointer) return;
  window.__ezPointer = true;
  var COLOR = "#14875d", d = document, c;
  var saved = function () { try { return JSON.parse(sessionStorage.getItem("__ez_pointer")) || {}; } catch (e) { return {}; } };
  var el = function (css, parent) { var e = d.createElement("div"); e.style.cssText = css; parent.appendChild(e); return e; };

  function pointer() {
    if (c && c.isConnected) return c;
    var at = saved();
    // like a teammate's pointer in Figma: a small colored arrow with a white edge, and a name tag
    c = el("position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform .3s cubic-bezier(.22,.8,.25,1);" +
      "transform:translate(" + (at.x == null ? innerWidth / 2 : at.x) + "px," + (at.y == null ? innerHeight / 2 : at.y) + "px)", d.documentElement);
    c.id = "__ez_cursor";
    c.setAttribute("aria-hidden", "true");
    el("width:16px;height:18px;background:" + COLOR + ";clip-path:polygon(0 0,100% 60%,52% 66%,30% 100%)",
      el("position:absolute;left:0;top:0;filter:drop-shadow(1.5px 0 #fff) drop-shadow(-1.5px 0 #fff) drop-shadow(0 1.5px #fff) " +
        "drop-shadow(0 -1.5px #fff) drop-shadow(0 2px 3px rgba(0,0,0,.3))", c));
    el("position:absolute;left:14px;top:17px;white-space:nowrap;padding:3px 8px;border-radius:3px 9px 9px 9px;" +
      "background:" + COLOR + ";color:#fff;font:600 12px/16px system-ui,-apple-system,sans-serif;letter-spacing:.01em;" +
      "box-shadow:0 0 0 1.5px #fff,0 2px 6px rgba(0,0,0,.25)", c).textContent = "Emplio";
    c.getBoundingClientRect();
    return c;
  }

  function move(x, y) {
    pointer().style.transform = "translate(" + x + "px," + y + "px)";
    try { sessionStorage.setItem("__ez_pointer", JSON.stringify({ x: x, y: y })); } catch (e) {}
  }

  function ripple(x, y) {
    var p = el("position:fixed;left:" + (x - 14) + "px;top:" + (y - 14) + "px;width:28px;height:28px;border-radius:50%;background:" + COLOR +
      ";opacity:.35;z-index:2147483646;pointer-events:none;transition:transform .5s,opacity .5s", d.documentElement);
    p.setAttribute("aria-hidden", "true");
    p.getBoundingClientRect();
    p.style.transform = "scale(2)";
    p.style.opacity = "0";
    setTimeout(function () { p.remove(); }, 600);
  }

  // capture, so a page that stops events doesn't lose the pointer
  // the person has the mouse (Take control, Show Emplio how: hidePointer in browser-show.ts), so what the page feels isn't Emplio
  var off = function () { return window.__ezPointerOff; };
  addEventListener("mousedown", function (e) { if (off()) return; move(e.clientX, e.clientY); ripple(e.clientX, e.clientY); }, true);
  addEventListener("wheel", function (e) { if (!off()) move(e.clientX, e.clientY); }, { capture: true, passive: true });
  addEventListener("focusin", function (e) {
    if (off()) return;
    var a = e.target;
    if (!a || !a.getBoundingClientRect || a === d.body) return;
    var r = a.getBoundingClientRect();
    move(r.left + Math.min(r.width / 2, 24), r.top + r.height / 2);
  }, true);
})();
