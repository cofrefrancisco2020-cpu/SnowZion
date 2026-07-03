'use strict';

const TOTAL_FRAMES = 129;
const FRAME_DIR = 'frames/';
const FRAME_PREFIX = 'frames_';
const FRAME_EXT = '.png';

const padFrame = (value) => String(value).padStart(4, '0');
const frameSrc = (index) => `${FRAME_DIR}${FRAME_PREFIX}${padFrame(index)}${FRAME_EXT}`;

const header = document.getElementById('site-header');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderPct = document.getElementById('loader-pct');
const pageProgressFill = document.getElementById('page-progress-fill');

window.addEventListener('scroll', () => {
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > 40);
  }

  if (pageProgressFill) {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    pageProgressFill.style.width = `${progress * 100}%`;
  }
}, { passive: true });

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

(() => {
  const section = document.getElementById('scroll');
  const canvas = document.getElementById('frame-canvas');
  const fallback = document.getElementById('frame-fallback');
  const captions = Array.from(document.querySelectorAll('.caption'));
  const storyDots = Array.from(document.querySelectorAll('[data-progress-jump]'));

  if (!section || !canvas) {
    loader?.classList.add('hidden');
    return;
  }

  const context = canvas.getContext('2d', { alpha: false });
  const frames = new Array(TOTAL_FRAMES);
  let loadedFrames = 0;
  let currentIndex = -1;
  let sectionTop = 0;
  let scrollRange = 1;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let rafPending = false;
  let nextIndex = 0;

  function updateLoader() {
    const percent = Math.round((loadedFrames / TOTAL_FRAMES) * 100);
    if (loaderFill) loaderFill.style.width = `${percent}%`;
    if (loaderPct) loaderPct.textContent = `${percent}%`;
  }

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    viewportWidth = Math.max(1, rect.width);
    viewportHeight = Math.max(1, rect.height);
    canvas.width = Math.round(viewportWidth * dpr);
    canvas.height = Math.round(viewportHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawCover(image) {
    if (!image || !image.naturalWidth) return;

    const imageAspect = image.naturalWidth / image.naturalHeight;
    const canvasAspect = viewportWidth / viewportHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (canvasAspect > imageAspect) {
      sourceHeight = image.naturalWidth / canvasAspect;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    } else {
      sourceWidth = image.naturalHeight * canvasAspect;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      viewportWidth,
      viewportHeight
    );
  }

  function setCaptions(progress) {
    captions.forEach((caption) => {
      const from = Number.parseFloat(caption.dataset.from || '0');
      const to = Number.parseFloat(caption.dataset.to || '1');
      const isLast = to === 1 && progress >= from;
      const active = isLast || (progress >= from && progress < to);
      caption.classList.toggle('active', active);
    });

    storyDots.forEach((dot) => {
      const target = Number.parseFloat(dot.dataset.progressJump || '0');
      dot.classList.toggle('active', Math.abs(progress - target) < 0.18);
    });
  }

  function drawFrame(index) {
    if (index === currentIndex) return;
    currentIndex = index;
    drawCover(frames[index]);

    const progress = index / (TOTAL_FRAMES - 1);
    setCaptions(progress);
  }

  function updateMetrics() {
    sectionTop = section.offsetTop;
    scrollRange = Math.max(1, section.offsetHeight - window.innerHeight);
  }

  function handleScroll() {
    const scrolled = window.scrollY - sectionTop;
    const progress = Math.max(0, Math.min(1, scrolled / scrollRange));
    nextIndex = Math.min(TOTAL_FRAMES - 1, Math.floor(progress * TOTAL_FRAMES));

    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        drawFrame(nextIndex);
        rafPending = false;
      });
    }
  }

  storyDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const target = Number.parseFloat(dot.dataset.progressJump || '0');
      const scrollTarget = sectionTop + (scrollRange * target);
      window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    });
  });

  function preloadFrames() {
    return Promise.all(Array.from({ length: TOTAL_FRAMES }, (_, index) => (
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          loadedFrames += 1;
          updateLoader();
          resolve(image);
        };
        image.onerror = () => {
          loadedFrames += 1;
          updateLoader();
          resolve(null);
        };
        image.src = frameSrc(index + 1);
        frames[index] = image;
      })
    )));
  }

  sizeCanvas();
  updateMetrics();

  preloadFrames().then(() => {
    if (!frames[0]?.naturalWidth) {
      canvas.style.display = 'none';
      if (fallback) fallback.style.display = 'block';
      loader?.classList.add('hidden');
      return;
    }

    loader?.classList.add('hidden');
    drawFrame(0);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
  });

  window.addEventListener('resize', () => {
    sizeCanvas();
    updateMetrics();
    const savedIndex = currentIndex < 0 ? 0 : currentIndex;
    currentIndex = -1;
    drawFrame(savedIndex);
    handleScroll();
  }, { passive: true });

  window.setTimeout(() => {
    loader?.classList.add('hidden');
  }, 6000);
})();

(() => {
  const slider = document.getElementById('uv-slider');
  const output = document.getElementById('uv-output');
  const uvTitle = document.getElementById('uv-title');
  const uvCopy = document.getElementById('uv-copy');
  const uvScore = document.getElementById('uv-score');
  const uvMeterFill = document.getElementById('uv-meter-fill');
  const snowPhoto = document.querySelector('.uv-photo-snow');
  const cloudPhoto = document.querySelector('.uv-photo-cloud');
  const sunPhoto = document.querySelector('.uv-photo-sun');

  function updateUv(value) {
    const numericValue = Number(value);
    const progress = Math.max(0, Math.min(1, numericValue / 100));
    const snowOpacity = Math.max(0, 1 - progress * 2);
    const cloudOpacity = Math.max(0, 1 - Math.abs(progress - 0.5) * 2);
    const sunOpacity = Math.max(0, (progress - 0.5) * 2);

    if (snowPhoto) snowPhoto.style.opacity = snowOpacity.toFixed(2);
    if (cloudPhoto) cloudPhoto.style.opacity = cloudOpacity.toFixed(2);
    if (sunPhoto) sunPhoto.style.opacity = sunOpacity.toFixed(2);
    if (uvMeterFill) uvMeterFill.style.width = `${numericValue}%`;

    if (numericValue < 34) {
      if (uvTitle) uvTitle.textContent = 'Nieve y baja luz';
      if (uvCopy) uvCopy.textContent = 'La mica se mantiene mas clara para ayudar a leer relieve, sombras y movimiento de nieve.';
      if (uvScore) uvScore.textContent = 'Tinte claro activo';
      output.textContent = 'Sombra o bosque: lente mas claro para leer el relieve.';
    } else if (numericValue < 70) {
      if (uvTitle) uvTitle.textContent = 'Nublado';
      if (uvCopy) uvCopy.textContent = 'La mica queda en un punto medio para que puedas leer sombras, relieve y cambios de nieve con comodidad.';
      if (uvScore) uvScore.textContent = 'Tinte medio activo';
      output.textContent = 'Nublado: claridad equilibrada para leer relieves y sombras.';
    } else {
      if (uvTitle) uvTitle.textContent = 'Soleado';
      if (uvCopy) uvCopy.textContent = 'Con mayor intensidad UV, la mica se oscurece para filtrar reflejos fuertes y mantener comodidad visual.';
      if (uvScore) uvScore.textContent = 'Tinte oscuro activo';
      output.textContent = 'Soleado: mica mas oscura para filtrar reflejo intenso.';
    }
  }

  slider?.addEventListener('input', () => updateUv(slider.value));

  if (slider) updateUv(slider.value);
})();

(() => {
  const drawer = document.getElementById('detail-drawer');
  const closeButton = document.getElementById('drawer-close');
  const whatsappButton = document.getElementById('whatsapp-button');
  const drawerNote = document.getElementById('drawer-note');
  const drawerImage = drawer?.querySelector('.drawer-panel img');
  const drawerTitle = document.getElementById('drawer-title');
  const detailButtons = Array.from(document.querySelectorAll('[data-open-detail]'));

  if (!drawer) return;

  function openDrawer(button) {
    const card = button.closest('.product-card');
    const cardImage = card?.querySelector('.product-media img');
    const cardTitle = card?.querySelector('h3')?.textContent?.trim();

    if (drawerImage && cardImage) {
      drawerImage.src = cardImage.getAttribute('src');
      drawerImage.alt = cardImage.getAttribute('alt') || 'Antiparra Snow Zion en detalle';
    }

    if (drawerTitle && cardTitle) {
      drawerTitle.textContent = `${cardTitle} fotocromatica`;
    }

    if (whatsappButton && cardTitle) {
      const message = `Hola, estoy interesado en comprar la ${cardTitle.toLowerCase()} fotocromatica de Snow Zion de $39.990.`;
      whatsappButton.href = `https://wa.me/56944888945?text=${encodeURIComponent(message)}`;
    }

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
    closeButton?.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
    if (drawerNote) drawerNote.textContent = '';
  }

  detailButtons.forEach((button) => {
    button.addEventListener('click', () => openDrawer(button));
  });

  closeButton?.addEventListener('click', closeDrawer);

  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });

  whatsappButton?.addEventListener('click', () => {
    if (drawerNote) drawerNote.textContent = 'Abriendo WhatsApp con el mensaje de compra listo.';
  });
})();
