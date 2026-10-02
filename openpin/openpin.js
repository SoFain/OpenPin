/*!
 * OpenPin 1.0.0
 * Drop-in OpenStreetMap maps with custom colors. No API key, no Google.
 * MIT License. Bundles MapLibre GL JS (BSD-3-Clause, see maplibre/LICENSE.txt).
 * Map data © OpenStreetMap contributors, served by VersaTiles.
 */

// Every file path is resolved from this module's own URL, so the folder can
// live anywhere on a site (/openpin/, /assets/maps/, a CDN, ...).
const asset = path => new URL(path, import.meta.url).href;

export const version = '1.0.0';

// Each map color role, and the literal hex value it has in style.json.
// buildStyle() swaps these values for the active theme's colors.
const STYLE_COLORS = {
  background: '#f3eedf',
  developed: '#e6decc',
  green: '#dfe6c9',
  forest: '#cbd8b5',
  bare: '#e9dfc7',
  water: '#b6cebc',
  waterway: '#a7c6b2',
  building: '#ddd1b8',
  buildingOutline: '#c7bba4',
  road: '#fffaf0',
  roadCasing: '#cbbda1',
  highway: '#edbd69',
  rail: '#a5a78c',
  boundary: '#b8b8a0',
  label: '#435740',
  labelHalo: '#fbf6e9',
  icon: '#68795a',
};

// Colors for the pin and the buttons drawn over the map (CSS custom properties).
const UI_COLORS = {
  pin: '--openpin-pin',
  pinIcon: '--openpin-pin-icon',
  surface: '--openpin-surface',
  text: '--openpin-text',
  border: '--openpin-border',
  background: '--openpin-background',
};

export const colorRoles = Object.freeze([...Object.keys(STYLE_COLORS), 'pin', 'pinIcon', 'surface', 'text', 'border']);

export const themes = Object.freeze({
  country: Object.freeze({
    ...STYLE_COLORS,
    pin: '#982f23', pinIcon: '#fff4d7', surface: '#fbf6e9', text: '#213e32', border: '#c9ccb8',
  }),
  coastal: Object.freeze({
    background: '#f4f6f7', developed: '#eceff1', green: '#d7ead3', forest: '#c4dfc0', bare: '#ece7dc',
    water: '#a9d3e4', waterway: '#8cc3d9', building: '#dde2e6', buildingOutline: '#c3cad0',
    road: '#ffffff', roadCasing: '#c9d1d8', highway: '#f2c46d', rail: '#9aa5ae', boundary: '#a9b3bb',
    label: '#2f4552', labelHalo: '#ffffff', icon: '#557080',
    pin: '#1f6f8b', pinIcon: '#ffffff', surface: '#ffffff', text: '#1f3a48', border: '#c9d4dc',
  }),
  mono: Object.freeze({
    background: '#f2f2f0', developed: '#e9e9e6', green: '#e1e4dd', forest: '#d6dad2', bare: '#ebebe8',
    water: '#cfd6da', waterway: '#bcc5ca', building: '#dcdcd8', buildingOutline: '#c4c4bf',
    road: '#ffffff', roadCasing: '#cdcdc8', highway: '#bdbdb6', rail: '#a6a6a0', boundary: '#b5b5b0',
    label: '#3a3a38', labelHalo: '#ffffff', icon: '#77776f',
    pin: '#222222', pinIcon: '#ffffff', surface: '#ffffff', text: '#222222', border: '#cfcfcf',
  }),
  midnight: Object.freeze({
    background: '#1d2321', developed: '#232926', green: '#243127', forest: '#263a2b', bare: '#262b27',
    water: '#20363a', waterway: '#2b4a4e', building: '#2e3531', buildingOutline: '#3a423d',
    road: '#3b443f', roadCasing: '#161b19', highway: '#c49a4a', rail: '#4f5a52', boundary: '#56605a',
    label: '#d9dfd6', labelHalo: '#1d2321', icon: '#9aa89c',
    pin: '#e0a046', pinIcon: '#1d2321', surface: '#262d2a', text: '#e6ebe3', border: '#3c4641',
  }),
});

/** Merge a theme name (or theme object) with color overrides. Unknown keys are ignored. */
export function resolveColors(theme = 'country', colors = {}) {
  let base = theme;
  if (typeof theme === 'string') {
    base = themes[theme];
    if (!base) {
      console.warn(`OpenPin: unknown theme "${theme}". Using "country". Themes: ${Object.keys(themes).join(', ')}.`);
      base = themes.country;
    }
  }
  const merged = { ...themes.country, ...base, ...colors };
  return Object.fromEntries(colorRoles.map(role => [role, merged[role]]));
}

/** Return a MapLibre style object recolored with the given (resolved) colors. */
export function buildStyle(styleText, colors) {
  const swap = {};
  for (const [role, hex] of Object.entries(STYLE_COLORS)) swap[`"${hex}"`] = JSON.stringify(colors[role] ?? hex);
  // One pass, so a new color that equals another role's old hex is never swapped twice.
  const style = JSON.parse(styleText.replace(/"#[0-9a-f]{6}"/g, match => swap[match] ?? match));
  style.sprite = [{ id: 'base', url: asset('sprites/base') }];
  return style;
}

let libraryPromise;
let stylePromise;
const stylesheets = new Map();

function addStylesheet(href) {
  if (!stylesheets.has(href)) {
    stylesheets.set(href, new Promise((resolve, reject) => {
      if ([...document.styleSheets].some(sheet => sheet.href === href)) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = () => { stylesheets.delete(href); reject(new Error(`Could not load ${href}`)); };
      document.head.append(link);
    }));
  }
  return stylesheets.get(href);
}

/** Load MapLibre GL JS once per page. Resolves with the MapLibre module. */
export function loadMapLibre() {
  libraryPromise ??= Promise.all([
    import(asset('maplibre/maplibre-gl.js')),
    addStylesheet(asset('maplibre/maplibre-gl.css')),
  ]).then(([library]) => {
    library.setWorkerUrl(asset('maplibre/maplibre-gl-worker.js'));
    return library;
  }).catch(error => { libraryPromise = undefined; throw error; });
  return libraryPromise;
}

function loadStyleText() {
  stylePromise ??= fetch(asset('style.json')).then(response => {
    if (!response.ok) throw new Error(`style.json returned HTTP ${response.status}`);
    return response.text();
  }).catch(error => { stylePromise = undefined; throw error; });
  return stylePromise;
}

/** Accepts [lng, lat], {lat, lng}, {lat, lon} or {latitude, longitude}. Returns [lng, lat]. */
export function toLngLat(value) {
  if (value == null) return null;
  const pair = Array.isArray(value)
    ? [value[0], value[1]]
    : [value.lng ?? value.lon ?? value.longitude, value.lat ?? value.latitude];
  const [lng, lat] = pair.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error(`OpenPin: ${JSON.stringify(value)} is not a location. Use [lng, lat] or { lat, lng }.`);
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    const hint = Math.abs(lat) > 90 && Math.abs(lng) <= 90 ? ' Latitude and longitude look swapped: arrays are [lng, lat].' : '';
    throw new Error(`OpenPin: [${lng}, ${lat}] is outside the world.${hint}`);
  }
  return [lng, lat];
}

export function openStreetMapUrl([lng, lat], zoom = 16) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${Math.round(zoom)}/${lat}/${lng}`;
}

function isDark(color) {
  const probe = document.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  document.body.append(probe);
  const [r, g, b] = (getComputedStyle(probe).color.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
  probe.remove();
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

function applyUiColors(element, colors) {
  for (const [role, property] of Object.entries(UI_COLORS)) element.style.setProperty(property, colors[role]);
  element.toggleAttribute('data-openpin-dark', isDark(colors.surface));
}

const PIN_ICONS = {
  house: '<path class="openpin-pin-icon" d="m12 21 10-8 10 8v12H12Z"/><path class="openpin-pin-body openpin-no-stroke" d="M20 25h5v8h-5Z"/><path class="openpin-pin-line" d="M10 21h24"/>',
  dot: '<circle class="openpin-pin-icon" cx="22" cy="21" r="7.5"/>',
  none: '',
};
const pinSvg = icon => `<svg class="openpin-pin-svg" viewBox="0 0 44 56" aria-hidden="true"><path class="openpin-pin-body" d="M22 54C17 43 2 32 2 21a20 20 0 1 1 40 0c0 11-15 22-20 33Z"/>${PIN_ICONS[icon] ?? PIN_ICONS.house}</svg>`;
const RECENTER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function normalizeMarkers(options) {
  if (options.marker === false) return [];
  const list = options.markers ?? (options.center ? [{ center: options.center, label: options.label, link: options.link }] : []);
  return list.map(marker => ({
    ...marker,
    center: toLngLat(marker.center ?? marker.lngLat ?? marker),
  }));
}

const instances = new WeakMap();

/** Return the controller for a map element created by createMap or auto-init. */
export function getMap(element) {
  return instances.get(typeof element === 'string' ? document.querySelector(element) : element);
}

/**
 * Create a map inside `target` (an element or CSS selector).
 * Returns a controller right away; `controller.ready` resolves with the
 * MapLibre map once tiles are drawn, or with null if the map could not load.
 */
export function createMap(target, options = {}) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) throw new Error(`OpenPin: no element matches ${JSON.stringify(target)}.`);
  instances.get(element)?.destroy();

  const markers = normalizeMarkers(options);
  const center = options.center ? toLngLat(options.center) : markers[0]?.center;
  if (!center) throw new Error('OpenPin: give a `center` ([lng, lat] or { lat, lng }) or at least one marker.');
  const zoom = options.zoom ?? 14;
  const fitMarkers = markers.length > 1 && options.zoom == null;
  const placeName = options.label ?? markers[0]?.label;
  const scrollZoom = options.scrollZoom ?? 'cooperative';
  // Extra room at the top so a pin's label is not cut off when fitting several pins.
  const padding = options.padding ?? { top: 100, bottom: 40, left: 70, right: 70 };
  let colors = resolveColors(options.theme, options.colors);

  // Build the map shell. Any existing children (for example a plain address
  // shown to visitors without JavaScript) are replaced.
  element.classList.add('openpin');
  element.dataset.openpinState = 'idle';
  applyUiColors(element, colors);

  const canvas = document.createElement('div');
  canvas.className = 'openpin-map';
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', options.ariaLabel ?? (placeName ? `Map showing ${placeName}` : 'Map'));
  canvas.inert = true;

  const fallback = document.createElement('div');
  fallback.className = 'openpin-fallback';
  fallback.innerHTML = `${pinSvg('dot')}<p class="openpin-status" role="status"></p><a class="openpin-fallback-link" target="_blank" rel="noopener">Open in OpenStreetMap</a>`;
  const status = fallback.querySelector('.openpin-status');
  const restingText = options.address ?? placeName ?? 'Map';
  status.textContent = restingText;
  fallback.querySelector('a').href = options.link ?? openStreetMapUrl(center, Math.max(zoom, 16));

  const home = document.createElement('button');
  home.type = 'button';
  home.className = 'openpin-home';
  home.hidden = true;
  home.innerHTML = `${RECENTER_ICON}<span></span>`;
  home.querySelector('span').textContent = options.homeLabel || 'Re-center';

  element.replaceChildren(canvas, fallback, home);

  let map = null;
  let library = null;
  let styleText = null;
  let destroyed = false;
  let resizeObserver;
  let lazyObserver;
  let timeout;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  const fire = (name, detail) => element.dispatchEvent(new CustomEvent(name, { detail }));

  // Slow or failed tiles show the fallback but keep the map, so it still
  // appears (and fires openpin:ready) if the tiles arrive later. A hard failure,
  // such as no WebGL or missing files, removes the map.
  function fail(error, hard = false) {
    if (destroyed || element.dataset.openpinState === 'ready') return;
    if (hard) {
      clearTimeout(timeout);
      map?.remove();
      map = null;
    }
    if (element.dataset.openpinState === 'unavailable') return;
    element.dataset.openpinState = 'unavailable';
    status.textContent = options.unavailableText ?? 'The map could not load.';
    if (error) console.warn('OpenPin:', error);
    resolveReady(null);
    fire('openpin:error', { error });
  }

  function armTimeout() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      // Browsers pause drawing in background tabs. Wait until the page is seen.
      if (document.hidden) document.addEventListener('visibilitychange', armTimeout, { once: true });
      else fail(new Error('Timed out waiting for map tiles.'));
    }, options.timeout ?? 20000);
  }

  function recenter() {
    if (!map) return;
    if (fitMarkers) map.fitBounds(bounds(), { padding, maxZoom: options.maxFitZoom ?? 16, animate: false });
    else map.jumpTo({ center, zoom });
  }

  function bounds() {
    const box = new library.LngLatBounds();
    markers.forEach(marker => box.extend(marker.center));
    return box;
  }

  function addMarker(marker) {
    const pin = document.createElement(marker.link === false ? 'div' : 'a');
    pin.className = 'openpin-pin';
    const label = marker.label ?? '';
    if (pin.tagName === 'A') {
      pin.href = marker.link ?? openStreetMapUrl(marker.center);
      pin.target = '_blank';
      pin.rel = 'noopener';
      pin.setAttribute('aria-label', label ? `${label}. Open in OpenStreetMap.` : 'Open in OpenStreetMap');
    }
    if (marker.color) pin.style.setProperty('--openpin-pin', marker.color);
    const showLabel = label && marker.showLabel !== false && options.showLabels !== false;
    pin.innerHTML = (showLabel ? `<span class="openpin-pin-label">${escapeHtml(label)}</span>` : '') + pinSvg(marker.pin ?? options.pin);
    return new library.Marker({ element: pin, anchor: 'bottom' }).setLngLat(marker.center).addTo(map);
  }

  async function start() {
    if (destroyed || element.dataset.openpinState !== 'idle') return;
    element.dataset.openpinState = 'loading';
    status.textContent = options.loadingText ?? 'Loading map…';
    armTimeout();
    try {
      [library, styleText] = await Promise.all([loadMapLibre(), loadStyleText()]);
      if (destroyed) return;
      map = new library.Map({
        container: canvas,
        style: buildStyle(styleText, colors),
        center,
        zoom,
        ...(fitMarkers ? { bounds: bounds(), fitBoundsOptions: { padding, maxZoom: options.maxFitZoom ?? 16 } } : {}),
        minZoom: options.minZoom ?? 2,
        maxZoom: options.maxZoom ?? 18,
        attributionControl: false,
        cooperativeGestures: scrollZoom === 'cooperative',
        scrollZoom: scrollZoom !== false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        ...options.mapOptions,
      });
      map.touchZoomRotate.disableRotation();
      if (options.zoomButtons !== false) map.addControl(new library.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new library.AttributionControl({ compact: true, customAttribution: options.attribution }), 'bottom-right');
      markers.forEach(addMarker);
      home.addEventListener('click', recenter);

      const showReadyMap = () => {
        // A style can finish loading even if every tile request failed.
        // Keep the fallback until real geographic features are on screen.
        if (!map || element.dataset.openpinState === 'ready' || !map.queryRenderedFeatures().length) return;
        clearTimeout(timeout);
        element.dataset.openpinState = 'ready';
        canvas.inert = false;
        home.hidden = options.homeLabel === false;
        status.textContent = restingText;
        // Start the attribution as the small (i) button; MapLibre opens it by default.
        const attribution = element.querySelector('.maplibregl-ctrl-attrib');
        attribution?.classList.remove('maplibregl-compact-show');
        if (attribution) attribution.open = false;
        resolveReady(map);
        options.onReady?.(map, library);
        fire('openpin:ready', { map, maplibregl: library });
      };
      map.once('load', showReadyMap);
      map.on('idle', showReadyMap);
      map.on('error', event => { if (element.dataset.openpinState !== 'ready') fail(event?.error); });
      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(element);
    } catch (error) {
      fail(error, true);
    }
  }

  const controller = {
    element,
    ready,
    get map() { return map; },
    get maplibregl() { return library; },
    get colors() { return { ...colors }; },
    /** Load now, even if the map is lazy and still off screen. */
    load() { lazyObserver?.disconnect(); start(); return ready; },
    recenter,
    /** Recolor the map. Pass a theme name, a colors object, or both. */
    setColors(next = {}, theme) {
      colors = typeof next === 'string' ? resolveColors(next) : resolveColors(theme ?? colors, next);
      applyUiColors(element, colors);
      if (map && styleText) map.setStyle(buildStyle(styleText, colors), { diff: true });
      return controller;
    },
    destroy() {
      destroyed = true;
      clearTimeout(timeout);
      lazyObserver?.disconnect();
      resizeObserver?.disconnect();
      map?.remove();
      map = null;
      element.replaceChildren();
      element.classList.remove('openpin');
      element.removeAttribute('data-openpin-state');
      element.removeAttribute('data-openpin-dark');
      Object.values(UI_COLORS).forEach(property => element.style.removeProperty(property));
      instances.delete(element);
      resolveReady(null);
    },
  };
  instances.set(element, controller);

  // By default the map (about 1 MB of JavaScript) loads only when it nears the screen.
  if (options.lazy !== false && 'IntersectionObserver' in window) {
    lazyObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      lazyObserver.disconnect();
      start();
    }, { rootMargin: '350px' });
    lazyObserver.observe(element);
  } else {
    start();
  }
  return controller;
}

/** Read createMap options from an element's data-* attributes. */
export function optionsFromAttributes(element) {
  const data = element.dataset;
  const number = value => (value == null || value === '' ? undefined : Number(value));
  const json = name => {
    const value = data[name];
    if (!value) return undefined;
    try { return JSON.parse(value); } catch { throw new Error(`OpenPin: data-${name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())} is not valid JSON.`); }
  };
  const flag = value => (value === 'true' ? true : value === 'false' ? false : value || undefined);
  return {
    center: data.lat != null && data.lng != null ? { lat: number(data.lat), lng: number(data.lng) } : undefined,
    zoom: number(data.zoom),
    label: data.label,
    address: data.address,
    link: data.link,
    homeLabel: flag(data.homeLabel),
    theme: data.theme,
    colors: json('colors'),
    markers: json('markers'),
    pin: data.pin,
    attribution: data.attribution,
    ariaLabel: element.getAttribute('aria-label') ?? undefined,
    lazy: data.lazy !== 'false',
    scrollZoom: flag(data.scrollZoom),
    zoomButtons: data.zoomButtons !== 'false',
    showLabels: data.showLabels !== 'false',
  };
}

/** Create maps for every element with a data-openpin attribute. */
export function autoInit(root = document) {
  root.querySelectorAll('[data-openpin]').forEach(element => {
    if (instances.has(element)) return;
    try {
      createMap(element, optionsFromAttributes(element));
    } catch (error) {
      console.error(error, element);
    }
  });
}

addStylesheet(asset('openpin.css')).catch(error => console.error('OpenPin:', error));

const api = { version, themes, colorRoles, createMap, getMap, autoInit, resolveColors, buildStyle, loadMapLibre, toLngLat, openStreetMapUrl, optionsFromAttributes };
window.OpenPin = api;
// Module scripts run after the document is parsed, so the elements exist.
autoInit();
export default api;
