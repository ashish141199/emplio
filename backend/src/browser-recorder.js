// "Show Emplio how" (browser-show.ts): notes what the person does on the page, as words rather than screen positions.
// It only listens, in the capture phase, so a page that stops events still gets noted and nothing on the page changes.
// Never reads what's typed into a box that looks secret.
(function () {
  if (window.__emplioShowing) return;
  window.__emplioShowing = true;
  var SECRET = /pass|pwd|otp|cvv|cvc|card|secret|token|pin\b|one-time/i;
  var tell = function (step) { try { window.__emplioShow(JSON.stringify(step)); } catch (e) {} };
  var short = function (s) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, 80); };

  function nameOf(el) {
    var byId = el.getAttribute("aria-labelledby");
    var labelled = byId && document.getElementById(byId.split(" ")[0]);
    return short(
      el.getAttribute("aria-label") || (labelled && labelled.innerText) || (el.labels && el.labels[0] && el.labels[0].innerText) ||
      el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") ||
      (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ? el.getAttribute("name") || el.id : el.innerText),
    );
  }

  function kindOf(el) {
    return el.getAttribute("role") || { A: "link", BUTTON: "button", SELECT: "dropdown", TEXTAREA: "box", INPUT: "box" }[el.tagName] || el.tagName.toLowerCase();
  }

  // Something on the element that survives a reload, for telling apart things with the same name. Never classes, or
  // ids a framework generates (rc_select_61, :r1:).
  var GENERATED = /\d{2,}|^(rc[_-]|radix|headlessui|mui|react|ember|:)/i;
  function markerOf(el) {
    var attrs = ["data-testid", "data-test-id", "data-test", "data-cy", "data-qa"];
    for (var i = 0; i < attrs.length; i++) if (el.getAttribute(attrs[i])) return attrs[i] + '="' + short(el.getAttribute(attrs[i])) + '"';
    if (el.getAttribute("name")) return 'name="' + short(el.getAttribute("name")) + '"';
    if (el.id && !GENERATED.test(el.id)) return 'id="' + short(el.id) + '"';
    // the path only: a query can hold a login token
    if (el.tagName === "A" && el.pathname) return 'href="' + short(el.pathname) + '"';
    return "";
  }

  // Which row or dialog it's in: the second "Edit" in a table is known by its row.
  function placeOf(el) {
    var row = el.closest("tr,[role=row],li,[role=listitem]");
    if (row && row !== el) return 'row "' + short(row.innerText) + '"';
    var dialog = el.closest("dialog,[role=dialog],[role=alertdialog]");
    var title = dialog && dialog.querySelector("h1,h2,h3,[role=heading]");
    return title ? 'dialog "' + short(title.innerText) + '"' : "";
  }

  var isSecret = function (el) {
    return el.type === "password" || SECRET.test([el.name, el.id, el.autocomplete, el.getAttribute("aria-label"), el.getAttribute("placeholder")].join(" "));
  };

  addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    // what was meant: the button or row around the icon that was hit
    var el = t.closest("a,button,[role],input,select,textarea,label,li,td,th") || t;
    // the box itself is reported when its value changes
    if (/^(TEXTAREA)$/.test(el.tagName) || (el.tagName === "INPUT" && !/^(checkbox|radio|submit|button)$/.test(el.type))) return;
    tell({ type: "click", kind: kindOf(el), name: nameOf(el), marker: markerOf(el), place: placeOf(el) });
  }, true);

  addEventListener("change", function (e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    var value = el.type === "checkbox" || el.type === "radio" ? (el.checked ? "on" : "off") : el.tagName === "SELECT" ? el.selectedOptions[0] && el.selectedOptions[0].text : el.value;
    tell({ type: "fill", name: nameOf(el), value: isSecret(el) ? null : short(value), marker: markerOf(el), place: placeOf(el) });
  }, true);

  addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === "Escape") tell({ type: "key", key: e.key });
  }, true);
})();
