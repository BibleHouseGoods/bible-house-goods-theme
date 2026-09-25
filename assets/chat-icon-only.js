/* Shopify Inbox chat button: icon-only on phones.

   The "Chat" pill is a wide floating control that covers page content (trust chips, return policy,
   payment icons). On phones we hide its text label so it becomes a small round icon button, using
   the widget's own icon-only state. It keeps its accessible name ("Chat") and opens exactly as
   before. Wider screens keep whatever the Inbox app is set to show.

   The widget mounts late, and after it has been opened once it rebuilds itself inside a nested
   shadow root, so this looks through nested roots and re-applies whenever the widget re-renders.
   If Shopify renames the internals, this quietly does nothing and the normal pill returns. */
(function () {
  var phone = window.matchMedia('(max-width: 640px)');
  var watched = typeof WeakSet === 'function' ? new WeakSet() : null;
  if (!watched) return;

  function deepQuery(root, selector) {
    var found = root.querySelector(selector);
    if (found) return found;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        found = deepQuery(all[i].shadowRoot, selector);
        if (found) return found;
      }
    }
    return null;
  }

  function apply() {
    var host = document.querySelector('shopify-chat');
    if (!host || !host.shadowRoot) return;
    var label = deepQuery(host.shadowRoot, '.activator__label');
    if (!label) return;
    if (phone.matches) {
      if (!label.hidden) {
        label.hidden = true;
        label.setAttribute('data-hidden-by-theme', '');
      }
    } else if (label.hasAttribute('data-hidden-by-theme')) {
      label.hidden = false;
      label.removeAttribute('data-hidden-by-theme');
    }
  }

  function watchTree(root) {
    if (!watched.has(root)) {
      watched.add(root);
      new MutationObserver(onChange).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    }
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) watchTree(all[i].shadowRoot);
    }
  }

  function onChange() {
    apply();
    var host = document.querySelector('shopify-chat');
    if (host && host.shadowRoot) watchTree(host.shadowRoot);
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    var host = document.querySelector('shopify-chat');
    if (host && host.shadowRoot && host.shadowRoot.children.length) {
      clearInterval(timer);
      onChange();
      if (phone.addEventListener) phone.addEventListener('change', apply);
    } else if (tries > 60) {
      clearInterval(timer);
    }
  }, 400);
})();
