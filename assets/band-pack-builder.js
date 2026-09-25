(function () {
  function init(root) {
    if (root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';
    var form = root.closest('form');
    if (!form) return;
    var select = form.querySelector('[data-variant-select]');
    var qtyInput = form.querySelector('[data-band-quantity]');
    var submitBtn = form.querySelector('[data-primary-product-submit]');
    var stickyBtn = document.querySelector('[data-sticky-add]');
    var productPrice = document.querySelector('[data-product-price]');
    var stickyPrice = document.querySelector('[data-sticky-price]');
    var preorderProperty = form.querySelector('[data-preorder-property]');
    var deliveryReassurance = form.querySelector('[data-delivery-reassurance]');
    var deliveryDate = form.querySelector('[data-delivery-date]');
    var deliveryLabel = form.querySelector('[data-delivery-label]');
    var packStepEl = root.querySelector('[data-pack-step]');
    var mapEl = root.querySelector('[data-band-variant-map]');
    if (!select || !mapEl) return;
    var variants = [];
    try { variants = JSON.parse(mapEl.textContent); } catch (e) { return; }

    var nextBatchMessage = (root.dataset.nextBatchMessage || '').trim();
    var preorderNote = (root.dataset.preorderNote || '').trim();
    // Buy box order test: ?buybox=color-first on any product link previews the color, size, then pack order.
    if (/[?&]buybox=color-first(&|$)/.test(window.location.search)) root.dataset.buyboxOrder = 'color_first';
    var deliveryMin = parseInt(root.dataset.deliveryMin, 10) || 6;
    var deliveryMax = parseInt(root.dataset.deliveryMax, 10) || 13;
    var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var selectionTouched = false;
    var orderSummary = form.querySelector('[data-band-order-summary]');
    var stickySelection = document.querySelector('[data-sticky-selection]');
    var packSize = 1;
    var slots = [null];
    var active = 0;
    var draft = { size: null, color: null };

    var ps = root.querySelector('[data-band-size][aria-pressed="true"]');
    var pc = root.querySelector('[data-band-color][aria-pressed="true"]');
    if (ps) draft.size = ps.getAttribute('data-band-size');
    if (pc) draft.color = pc.getAttribute('data-band-color');
    if (draft.size && draft.color) slots[0] = { size: draft.size, color: draft.color };

    function isColorFirst() { return root.dataset.buyboxOrder === 'color_first'; }
    // Business days from today, skipping Saturdays and Sundays (not holidays).
    function addBusinessDays(n) {
      var now = new Date();
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var added = 0;
      while (added < n) {
        d.setDate(d.getDate() + 1);
        var day = d.getDay();
        if (day !== 0 && day !== 6) added++;
      }
      return d;
    }
    function shortDate(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    function deliveryWindow() {
      return shortDate(addBusinessDays(deliveryMin)) + ' – ' + shortDate(addBusinessDays(deliveryMax));
    }

    function find(size, color) {
      for (var i = 0; i < variants.length; i++) {
        if (variants[i].size === size && variants[i].color === color) return variants[i];
      }
      return null;
    }
    function filled() { return slots.filter(function (s) { return s; }).length; }
    function firstEmpty() {
      for (var i = 0; i < slots.length; i++) { if (!slots[i]) return i; }
      return -1;
    }
    function isFull() { return firstEmpty() === -1; }
    function displayedPrice() {
      if (packSize === 1) {
        var option = select.options[select.selectedIndex];
        if (option && option.dataset.price) return option.dataset.price;
      }
      var choice = root.querySelector('[data-pack-choice="' + packSize + '"] .pack-choice__price');
      return choice ? choice.textContent.trim() : '';
    }
    function anyPreorder() {
      return slots.some(function (s) { var v = s && find(s.size, s.color); return !!(v && v.preorder); });
    }
    // Lowest-stock band currently in the pack (or the single selected band).
    function lowestInPack() {
      var low = null;
      slots.forEach(function (s) {
        var v = s && find(s.size, s.color);
        if (v && v.low && (!low || v.qty < low.qty)) low = v;
      });
      return low;
    }

    function setPack(n) {
      packSize = n;
      var next = [];
      for (var i = 0; i < n; i++) next.push(slots[i] || null);
      slots = next;
      if (n === 1 && !slots[0] && draft.size && draft.color) {
        slots[0] = { size: draft.size, color: draft.color };
      }
      var e = firstEmpty();
      active = e === -1 ? (n - 1) : e;
      if (n === 1) {
        if (slots[0]) draft = { size: slots[0].size, color: slots[0].color };
      } else if (slots[active]) {
        draft = { size: slots[active].size, color: slots[active].color };
      } else {
        draft = { size: draft.size, color: null };
      }
      render();
    }

    // Only writes into a slot that is currently open (null).
    function commit() {
      if (!draft.size || !draft.color) return false;
      if (slots[active] !== null && slots[active] !== undefined) return false;
      slots[active] = { size: draft.size, color: draft.color };
      var e = firstEmpty();
      if (e !== -1) { active = e; draft = { size: draft.size, color: null }; }
      render();
      return true;
    }

    function renderTray() {
      var tray = root.querySelector('[data-pack-tray]');
      var list = root.querySelector('[data-pack-list]');
      var count = root.querySelector('[data-pack-count]');
      var mix = root.querySelector('[data-mix-note]');
      tray.hidden = packSize < 2;
      mix.hidden = packSize < 2;
      if (packSize < 2) return;
      count.textContent = filled() + ' of ' + packSize + ' chosen';
      list.innerHTML = '';
      slots.forEach(function (s, i) {
        var v = s ? find(s.size, s.color) : null;
        var li = document.createElement('li');
        li.className = 'pack-slot' + (i === active && !v ? ' is-active' : '') + (v ? '' : ' is-empty');
        var num = document.createElement('span');
        num.className = 'pack-slot__num';
        num.textContent = String(i + 1);
        var thumb = document.createElement('span');
        thumb.className = 'pack-slot__thumb';
        if (v && v.img) {
          var im = document.createElement('img');
          im.src = v.img; im.alt = ''; im.loading = 'lazy';
          thumb.appendChild(im);
        }
        var text = document.createElement('span');
        text.className = 'pack-slot__text';
        var b = document.createElement('b');
        var sub = document.createElement('span');
        if (v) { b.textContent = v.colorShort; sub.textContent = v.sizeShort; }
        else { b.textContent = 'Choose band ' + (i + 1); sub.textContent = 'Pick a size and color ' + (isColorFirst() ? 'above' : 'below'); }
        text.appendChild(b); text.appendChild(sub);
        li.appendChild(num); li.appendChild(thumb); li.appendChild(text);
        if (v && v.preorder) {
          var tag = document.createElement('span');
          tag.className = 'pack-slot__tag';
          tag.textContent = 'Pre-order';
          li.appendChild(tag);
        } else if (v && v.low) {
          var lowTag = document.createElement('span');
          lowTag.className = 'pack-slot__tag pack-slot__tag--low';
          lowTag.textContent = v.qty + ' left';
          li.appendChild(lowTag);
        }
        if (v) {
          var ed = document.createElement('button');
          ed.type = 'button';
          ed.className = 'pack-slot__edit';
          ed.setAttribute('data-edit-slot', String(i));
          ed.textContent = 'Change';
          li.appendChild(ed);
        }
        list.appendChild(li);
      });
    }

    function render() {
      root.querySelectorAll('[data-pack-choice]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-pack-choice')) === packSize));
      });
      root.querySelectorAll('[data-band-size]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-band-size') === draft.size));
      });
      root.querySelectorAll('[data-band-color]').forEach(function (b) {
        var val = b.getAttribute('data-band-color');
        b.setAttribute('aria-pressed', String(val === draft.color));
        var v = find(draft.size, val);
        var flag = b.querySelector('[data-flag]');
        b.classList.toggle('is-unavailable', !!v && !v.available && !v.preorder);
        if (flag) {
          flag.classList.remove('band-swatch__flag--low', 'band-swatch__flag--stock');
          if (v && v.preorder) { flag.hidden = false; flag.textContent = 'Pre-order'; }
          else if (v && v.low) { flag.hidden = false; flag.textContent = v.qty + ' left'; flag.classList.add('band-swatch__flag--low'); }
          else if (v && !v.available) { flag.hidden = false; flag.textContent = 'Sold out'; }
          else if (v && v.available) { flag.hidden = false; flag.textContent = 'Ships now'; flag.classList.add('band-swatch__flag--stock'); }
          else { flag.hidden = true; }
        }
      });

      var sel = root.querySelector('[data-band-selection]');
      if (sel) sel.textContent = draft.color || '';

      var full = packSize > 1 && isFull();
      var ss = root.querySelector('[data-size-step]');
      var cs = root.querySelector('[data-color-step]');
      // Step numbers follow the on-screen order: pack, size, color (default) or color, size, pack (test).
      var colorFirst = isColorFirst();
      var nSize = 2;
      var nColor = colorFirst ? 1 : 3;
      var nPack = colorFirst ? 3 : 1;
      if (packStepEl) packStepEl.textContent = nPack + '. Choose your pack';
      if (packSize > 1) {
        if (ss) ss.textContent = full ? nSize + '. Size' : nSize + '. Band ' + (active + 1) + ' of ' + packSize + ' — size';
        if (cs) cs.textContent = full ? nColor + '. Color' : nColor + '. Band ' + (active + 1) + ' of ' + packSize + ' — color';
      } else {
        if (ss) ss.textContent = nSize + '. Choose your size';
        if (cs) cs.textContent = nColor + '. Choose your color';
      }

      var mix = root.querySelector('[data-mix-note]');
      if (mix && packSize > 1) {
        mix.textContent = full
          ? 'Your pack is full. Press Change on any band to swap it.'
          : (mix.getAttribute('data-default') || mix.textContent);
      }

      renderTray();

      var cur = find(draft.size, draft.color);
      var pre = packSize > 1 ? anyPreorder() : !!(cur && cur.preorder);
      var callout = root.querySelector('[data-preorder-callout]');
      if (callout) callout.hidden = !pre;
      if (preorderProperty) {
        var singlePreorder = packSize === 1 && pre;
        preorderProperty.disabled = !singlePreorder;
        preorderProperty.value = 'PREORDER · ' + preorderNote;
      }
      if (deliveryReassurance) {
        deliveryReassurance.textContent = pre
          ? preorderNote
          : root.dataset.deliveryEstimate;
      }
      // Delivery line under Add to Cart: real dates for in-stock bands, the preorder note otherwise.
      if (deliveryDate) {
        if (pre) {
          if (deliveryLabel) deliveryLabel.textContent = 'Preorder:';
          deliveryDate.textContent = preorderNote;
        } else {
          if (deliveryLabel) deliveryLabel.textContent = 'Estimated delivery:';
          deliveryDate.textContent = deliveryWindow();
        }
      }

      // Low stock urgency — only shown when the band is in stock but running out.
      var low = packSize > 1 ? lowestInPack() : ((cur && cur.low) ? cur : null);
      var lowCallout = root.querySelector('[data-lowstock-callout]');
      if (lowCallout) {
        lowCallout.hidden = !low;
        if (low) {
          var lt = lowCallout.querySelector('[data-lowstock-text]');
          if (lt) {
            lt.textContent = 'Only ' + low.qty + ' left in ' + low.sizeShort + ' — ' + low.colorShort + '.' + (nextBatchMessage ? ' ' + nextBatchMessage : '');
          }
        }
      }

      if (packSize === 1 && cur && String(select.value) !== String(cur.id)) {
        select.value = String(cur.id);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (qtyInput) qtyInput.value = 1;
      form.classList.toggle('is-pack', packSize > 1);
      window.upcartShouldSkipAddToCartInterceptor = packSize > 1;

      var price = displayedPrice();
      if (price) {
        if (productPrice) productPrice.textContent = price;
        if (stickyPrice) stickyPrice.textContent = price;
      }

      var label, disabled;
      if (packSize === 1) {
        if (!cur) { label = 'Choose a size and color'; disabled = true; }
        else if (cur.preorder) { label = 'Pre-Order — Add to Cart'; disabled = false; }
        else if (!cur.available) { label = 'Sold out'; disabled = true; }
        else { label = 'Add to cart'; disabled = false; }
      } else {
        disabled = !isFull();
        label = isFull()
          ? (pre ? 'Pre-Order ' + packSize + ' Bands' : 'Add ' + packSize + ' bands to cart')
          : 'Choose ' + (packSize - filled()) + ' more';
      }
      var summary = packSize === 1 && cur ? cur.sizeShort + ' · ' + cur.colorShort : filled() + ' of ' + packSize + ' bands chosen';
      if (orderSummary) orderSummary.textContent = root.dataset.selectedLabel + ' ' + summary;
      if (submitBtn) { submitBtn.textContent = disabled ? label : label + ' — ' + price; submitBtn.disabled = disabled; }
      if (stickySelection) stickySelection.textContent = selectionTouched ? summary : 'The Bible Band™';
      if (stickyBtn) {
        var choose = !selectionTouched || disabled;
        stickyBtn.dataset.action = choose ? 'choose' : 'add';
        stickyBtn.disabled = false;
        stickyBtn.textContent = choose ? root.dataset.chooseLabel : root.dataset.addLabel + ' — ' + price;
      }
    }

    root.addEventListener('click', function (ev) {
      var more = ev.target.closest('[data-pack-more-toggle]');
      if (more) {
        root.querySelectorAll('[data-pack-extra]').forEach(function (b) { b.hidden = false; });
        more.setAttribute('aria-expanded', 'true');
        more.hidden = true;
        return;
      }
      var p = ev.target.closest('[data-pack-choice]');
      if (p) {
        setPack(Number(p.getAttribute('data-pack-choice')));
        // In the color-first order the pickers sit above the pack chooser, so bring the shopper back to them.
        if (isColorFirst() && packSize > 1 && !isFull()) {
          var colorStep = root.querySelector('[data-step="color"]');
          if (colorStep) colorStep.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        }
        return;
      }

      var ed = ev.target.closest('[data-edit-slot]');
      if (ed) {
        var idx = Number(ed.getAttribute('data-edit-slot'));
        var sl = slots[idx];
        active = idx;
        if (sl) { draft = { size: sl.size, color: sl.color }; slots[idx] = null; }
        render();
        return;
      }

      var s = ev.target.closest('[data-band-size]');
      if (s) {
        selectionTouched = true;
        draft.size = s.getAttribute('data-band-size');
        if (packSize > 1) { if (!commit()) render(); }
        else { slots[0] = draft.color ? { size: draft.size, color: draft.color } : null; render(); }
        return;
      }

      var c = ev.target.closest('[data-band-color]');
      if (c) {
        selectionTouched = true;
        draft.color = c.getAttribute('data-band-color');
        if (packSize > 1) { if (!commit()) render(); }
        else { slots[0] = draft.size ? { size: draft.size, color: draft.color } : null; render(); }
        return;
      }

      var h = ev.target.closest('[data-size-help-toggle]');
      if (h) {
        var panel = root.querySelector('[data-size-help]');
        var open = h.getAttribute('aria-expanded') === 'true';
        h.setAttribute('aria-expanded', String(!open));
        if (panel) panel.hidden = open;
      }
    });

    form.addEventListener('submit', function (ev) {
      if (packSize < 2) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!isFull()) return;
      var packHasPreorder = anyPreorder();
      var items = slots.map(function (s) {
        var v = find(s.size, s.color);
        var item = { id: v.id, quantity: 1 };
        if (packHasPreorder) {
          item.properties = {
            'Ships': v.preorder
              ? 'PREORDER · ' + preorderNote
              : 'WITH PRE-ORDER · Entire order ' + preorderNote
          };
        }
        return item;
      });
      var original = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Adding…'; }
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items })
      }).then(function (r) {
        if (!r.ok) throw new Error('add failed');
        window.location.href = '/cart';
      }).catch(function () {
        if (orderSummary) { orderSummary.setAttribute('role', 'alert'); orderSummary.textContent = root.dataset.addError; }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original || 'Try again'; }
      });
    }, true);

    var mixEl = root.querySelector('[data-mix-note]');
    if (mixEl) mixEl.setAttribute('data-default', mixEl.textContent.trim());

    setPack(1);
    // Lets analytics tell the two buy box orders apart when the test is running.
    if (typeof trackStorefrontEvent === 'function') trackStorefrontEvent('buybox_variant', { variant: root.dataset.buyboxOrder });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () { document.querySelectorAll('[data-band-options]').forEach(init); });
  document.addEventListener('shopify:section:load', function (event) {
    event.target.querySelectorAll('[data-band-options]').forEach(init);
  });
})();
