document.documentElement.classList.remove('no-js');

const storefrontDeviceType = window.matchMedia('(max-width: 749px)').matches ? 'mobile' : 'desktop';
const trackStorefrontEvent = (eventName, details = {}) => {
  const payload = { ...details, device_type: storefrontDeviceType, page_path: window.location.pathname };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...payload });
  try {
    if (window.Shopify?.analytics?.publish) window.Shopify.analytics.publish(eventName, payload);
  } catch (error) {
    // A third-party analytics subscriber should never interrupt shopping.
  }
};

trackStorefrontEvent('storefront_view');

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.hero__media video, [data-tap-demo] video').forEach((video) => video.pause());
}

document.querySelectorAll('[data-tap-demo] video').forEach((video) => {
  const duration = Number(video.closest('[data-tap-demo]').dataset.demoDuration || 5);
  video.addEventListener('timeupdate', () => {
    if (video.currentTime >= duration) {
      video.currentTime = 0;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) video.play();
    }
  });
});

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-menu-toggle]');
  if (!toggle) return;
  const menu = document.getElementById(toggle.getAttribute('aria-controls'));
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  menu.hidden = open;
});

const updateVariantPurchaseState = (form, select, option) => {
  const requestedQuantity = Number(form.querySelector('[name="quantity"]')?.value || 1);
  const inventoryQuantity = Number(option.dataset.inventoryQuantity || 0);
  const inventoryManaged = option.dataset.inventoryManaged === 'true';
  const continuesSelling = option.dataset.inventoryPolicy === 'continue';
  const insufficientStock = inventoryManaged && !continuesSelling && inventoryQuantity > 0 && inventoryQuantity < requestedQuantity;
  const isPreorder = inventoryManaged && continuesSelling && inventoryQuantity < requestedQuantity;
  const isLowStock = inventoryManaged && inventoryQuantity > 0 && inventoryQuantity <= Number(select.dataset.lowStockThreshold || 5);
  const canPurchase = option.dataset.available === 'true' && !insufficientStock;
  const statusMessage = isPreorder
    ? select.dataset.preorderMessage
    : insufficientStock
      ? `Only ${Math.max(inventoryQuantity, 0)} available — choose a smaller quantity.`
      : option.dataset.available !== 'true'
        ? 'Sold out.'
        : isLowStock ? `Only ${inventoryQuantity} left — ships now.` : select.dataset.inStockMessage;
  const button = form.querySelector('[data-primary-product-submit]');
  button.disabled = !canPurchase;
  button.textContent = isPreorder ? 'Preorder now' : canPurchase ? 'Add to cart' : insufficientStock ? 'Adjust quantity' : 'Sold out';
  const inventoryStatus = document.querySelector('[data-inventory-status]');
  if (inventoryStatus) {
    inventoryStatus.textContent = statusMessage;
    inventoryStatus.dataset.state = isPreorder ? 'preorder' : isLowStock || insufficientStock ? 'low-stock' : canPurchase ? 'in-stock' : 'sold-out';
  }
  document.querySelectorAll('[data-delivery-summary], [data-delivery-message]').forEach((message) => {
    message.textContent = statusMessage;
  });
  const deliveryLabel = document.querySelector('[data-delivery-label]');
  if (deliveryLabel) deliveryLabel.textContent = isPreorder ? 'Preorder timing' : 'Shipping';
  const preorderProperty = form.querySelector('[data-preorder-property]');
  if (preorderProperty) {
    preorderProperty.disabled = !isPreorder;
    preorderProperty.value = statusMessage;
  }
  const soldOutSignup = document.querySelector('[data-sold-out-signup]');
  if (soldOutSignup) {
    soldOutSignup.hidden = option.dataset.available === 'true';
    const restockVariant = soldOutSignup.querySelector('[data-restock-variant]');
    if (restockVariant) restockVariant.value = option.dataset.variantTitle;
  }
  const stickyButton = document.querySelector('[data-sticky-add]');
  if (stickyButton) {
    stickyButton.disabled = button.disabled;
    stickyButton.textContent = button.textContent === 'Add to cart' && window.location.pathname.includes('/products/the-bible-band')
      ? 'Get Your Bible Band'
      : button.textContent;
  }
};

document.addEventListener('change', (event) => {
  const bandTier = event.target.closest('[data-band-tier]');
  if (bandTier) {
    const form = bandTier.closest('form');
    const quantity = form.querySelector('[data-band-quantity]');
    quantity.value = bandTier.value;
    const select = form.querySelector('[data-variant-select]');
    if (select) updateVariantPurchaseState(form, select, select.options[select.selectedIndex]);
    trackStorefrontEvent('product_option_selected', { purchase_option: `${bandTier.value}_bands` });
    return;
  }
  const select = event.target.closest('[data-variant-select]');
  if (!select) return;
  const option = select.options[select.selectedIndex];
  const form = select.closest('form');
  form.querySelector('[name="id"]').value = option.value;
  updateVariantPurchaseState(form, select, option);
  const price = document.querySelector('[data-product-price]');
  if (price) price.textContent = option.dataset.price;
  const stickyPrice = document.querySelector('[data-sticky-price]');
  if (stickyPrice) stickyPrice.textContent = option.dataset.price;
  trackStorefrontEvent('product_option_selected', {
    product_title: select.dataset.productTitle,
    variant_id: option.value,
    variant_title: option.dataset.variantTitle,
    price: option.dataset.price
  });
  if (option.dataset.mediaId) {
    const media = document.querySelector(`[data-product-gallery-slide][data-media-id="${option.dataset.mediaId}"]`);
    if (media) {
      media.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'start'
      });
    }
  }
});

document.addEventListener('click', (event) => {
  const trackedElement = event.target.closest('[data-analytics-event]');
  if (trackedElement) {
    trackStorefrontEvent(trackedElement.dataset.analyticsEvent, {
      label: trackedElement.dataset.analyticsLabel,
      product_title: trackedElement.dataset.productTitle,
      variant_title: trackedElement.dataset.variantTitle,
      destination: trackedElement.href
    });
  }

  const stickyButton = event.target.closest('[data-sticky-add]');
  if (stickyButton) {
    const primaryButton = document.querySelector('[data-primary-product-submit]');
    if (primaryButton && !primaryButton.disabled) {
      trackStorefrontEvent('mobile_sticky_cta_click', { label: stickyButton.textContent.trim() });
      primaryButton.click();
    }
  }

  const checkoutButton = event.target.closest('[data-checkout-start], .shopify-payment-button__button');
  if (checkoutButton) trackStorefrontEvent('checkout_started', { source: checkoutButton.dataset.checkoutStart || 'buy_now' });
});

document.querySelectorAll('.product-form').forEach((form) => {
  form.addEventListener('submit', () => {
    const variantSelect = form.querySelector('[data-variant-select]');
    const selectedOption = variantSelect?.options[variantSelect.selectedIndex];
    trackStorefrontEvent('add_to_cart', {
      product_title: form.querySelector('[data-primary-product-submit]')?.dataset.productTitle,
      variant_id: form.querySelector('[name="id"]')?.value,
      variant_title: selectedOption?.dataset.variantTitle,
      quantity: Number(form.querySelector('[name="quantity"]')?.value || 1),
      purchase_option: form.querySelector('[data-band-tier]:checked')?.value || 'single'
    });
  });
});

const mobilePurchaseBar = document.querySelector('[data-mobile-purchase-bar]');
const primaryPurchaseButton = document.querySelector('[data-primary-product-submit]');
if (mobilePurchaseBar && primaryPurchaseButton) {
  const purchaseObserver = new IntersectionObserver(([entry]) => {
    mobilePurchaseBar.hidden = entry.isIntersecting;
  }, { threshold: 0.25 });
  purchaseObserver.observe(primaryPurchaseButton);
}

document.querySelectorAll('[data-product-gallery]').forEach((gallery) => {
  const track = gallery.querySelector('[data-product-gallery-track]');
  const slides = Array.from(gallery.querySelectorAll('[data-product-gallery-slide]'));
  const current = gallery.querySelector('[data-gallery-current]');
  if (!track || slides.length < 2 || !current) return;

  const goTo = (index) => {
    slides[(index + slides.length) % slides.length].scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start'
    });
  };
  const activeIndex = () => Math.round(track.scrollLeft / track.clientWidth);

  gallery.querySelector('[data-gallery-previous]').addEventListener('click', () => goTo(activeIndex() - 1));
  gallery.querySelector('[data-gallery-next]').addEventListener('click', () => goTo(activeIndex() + 1));
  track.addEventListener('scroll', () => {
    window.requestAnimationFrame(() => { current.textContent = String(activeIndex() + 1); });
  }, { passive: true });
});

const copyShareUrl = async (share) => {
  const status = share.querySelector('[data-share-status]');
  try {
    await navigator.clipboard.writeText(share.dataset.shareUrl);
    status.textContent = status.dataset.copied;
  } catch {
    const field = document.createElement('textarea');
    field.value = share.dataset.shareUrl;
    field.setAttribute('readonly', '');
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
    status.textContent = status.dataset.copied;
  }
};

document.querySelectorAll('[data-product-share]').forEach((share) => {
  share.querySelector('[data-copy-share]').addEventListener('click', () => copyShareUrl(share));
  share.querySelector('[data-native-share]').addEventListener('click', async () => {
    if (!navigator.share) {
      await copyShareUrl(share);
      return;
    }
    try {
      await navigator.share({ title: share.dataset.shareTitle, text: share.dataset.shareText, url: share.dataset.shareUrl });
    } catch (error) {
      if (error.name !== 'AbortError') await copyShareUrl(share);
    }
  });
});
