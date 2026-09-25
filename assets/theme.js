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

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('.product-page--bible-band .product-gallery video[autoplay]').forEach((video) => {
  if (reducedMotion) {
    video.pause();
    video.controls = true;
    return;
  }
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) video.play().catch(() => {});
    else video.pause();
  }, { threshold: 0.25 });
  observer.observe(video);
});
if (reducedMotion) {
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

document.addEventListener('change', (event) => {
  const bandTier = event.target.closest('[data-band-tier]');
  if (bandTier) {
    const form = bandTier.closest('form');
    const quantity = form.querySelector('[data-band-quantity]');
    quantity.value = bandTier.value;
    trackStorefrontEvent('product_option_selected', { purchase_option: `${bandTier.value}_bands` });
    return;
  }
  const select = event.target.closest('[data-variant-select]');
  if (!select) return;
  const option = select.options[select.selectedIndex];
  const form = select.closest('form');
  form.querySelector('[name="id"]').value = option.value;
  const button = form.querySelector('[type="submit"]');
  button.disabled = option.dataset.available !== 'true';
  button.textContent = option.dataset.order === 'true'
    ? 'Order'
    : option.dataset.available === 'true' ? 'Add to cart' : 'Sold out';
  const price = document.querySelector('[data-product-price]');
  if (price) price.textContent = option.dataset.price;
  const stickyPrice = document.querySelector('[data-sticky-price]');
  if (stickyPrice) stickyPrice.textContent = option.dataset.price;
  const stickyButton = document.querySelector('[data-sticky-add]');
  if (stickyButton) {
    stickyButton.disabled = button.disabled;
    stickyButton.textContent = button.textContent === 'Add to cart' && window.location.pathname.includes('/products/the-bible-band')
      ? 'Get Your Bible Band'
      : button.textContent;
  }
  trackStorefrontEvent('product_option_selected', {
    product_title: select.dataset.productTitle,
    variant_id: option.value,
    variant_title: option.dataset.variantTitle,
    price: option.dataset.price
  });
  if (option.dataset.mediaId && !form.querySelector('[data-band-options]')) {
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
    if (stickyButton.dataset.action === 'choose') {
      const options = document.querySelector('[data-band-options]');
      if (options) {
        options.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        options.focus({ preventScroll: true });
      }
      return;
    }
    if (primaryButton && !primaryButton.disabled) {
      trackStorefrontEvent('mobile_sticky_cta_click', { label: stickyButton.textContent.trim() });
      primaryButton.click();
    }
  }

  const checkoutButton = event.target.closest('[data-checkout-start], .shopify-payment-button__button');
  if (checkoutButton) trackStorefrontEvent('checkout_started', { source: checkoutButton.dataset.checkoutStart || 'buy_now' });
});

document.querySelectorAll('.product-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    const variantSelect = form.querySelector('[data-variant-select]');
    const selectedOption = variantSelect?.options[variantSelect.selectedIndex];
    trackStorefrontEvent('add_to_cart', {
      product_title: form.querySelector('[data-primary-product-submit]')?.dataset.productTitle,
      variant_id: form.querySelector('[name="id"]')?.value,
      variant_title: selectedOption?.dataset.variantTitle,
      quantity: Number(form.querySelector('[name="quantity"]')?.value || 1),
      purchase_option: form.querySelector('[data-band-tier]:checked')?.value || 'single'
    });

    const giftReady = form.querySelector('[data-gift-ready-variant]:checked');
    if (!giftReady) return;
    event.preventDefault();

    const submitter = event.submitter;
    const status = form.querySelector('[data-gift-ready-status]');
    const properties = {};
    new FormData(form).forEach((value, key) => {
      const match = key.match(/^properties\[(.+)\]$/);
      if (match && value) properties[match[1]] = value;
    });
    if (submitter) {
      submitter.disabled = true;
      submitter.setAttribute('aria-busy', 'true');
    }
    status.textContent = '';

    try {
      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: Number(form.querySelector('[name="id"]').value),
              quantity: Math.max(1, Number(form.querySelector('[name="quantity"]')?.value) || 1),
              properties
            },
            {
              id: Number(giftReady.value),
              quantity: 1,
              properties: { 'Gift fulfillment': 'Ship to buyer; include blank gift tag' }
            }
          ]
        })
      });
      if (!response.ok) throw new Error('Gift-ready packaging could not be added.');
      trackStorefrontEvent('gift_option_applied', { gift_option: 'Gift-Ready Packaging', source: 'product' });
      window.location.assign(`${window.Shopify.routes.root}cart`);
    } catch (error) {
      status.textContent = `${error.message} Please try again.`;
      if (submitter) {
        submitter.disabled = false;
        submitter.removeAttribute('aria-busy');
      }
    }
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

// Picking a color swatch slides the gallery to that color's photo. Only the gallery track
// moves (horizontal); the page never scrolls, because on phones the buy box sits well below
// the gallery and a page jump would pull the shopper away from the choice they are making.
document.addEventListener('click', (event) => {
  const swatch = event.target.closest('[data-band-color][data-gallery-media]');
  if (!swatch) return;
  const slide = document.querySelector(`[data-product-gallery-slide][data-media-id="${swatch.dataset.galleryMedia}"]`);
  const track = slide && slide.closest('[data-product-gallery-track]');
  if (!track) return;
  const left = slide.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
  track.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
