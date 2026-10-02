# AGENTS.md — OpenPin

Instructions for AI coding agents adding a map to a website with this package. Humans should read README.md.

## What this is

`openpin/` is a self-contained folder that renders an OpenStreetMap map with custom colors, using MapLibre GL JS (bundled) and free VersaTiles vector tiles. It needs no API key, no npm install, and no build step. The entry point is the ES module `openpin/openpin.js`. It loads its own CSS, MapLibre, and the style, all resolved relative to its own URL.

## Install into a site (do exactly this)

1. Copy the entire `openpin/` directory into the site's publicly served root, or into its static folder (`public/`, `static/`, `assets/`, ...). Don't rename or remove files inside it, and don't bundle it. The script finds its files by relative path.
2. Add a map element where the map should appear, and give it a height.
3. Add the script tag once per page, with `type="module"`.

```html
<div
  data-openpin
  data-lat="LATITUDE"
  data-lng="LONGITUDE"
  data-zoom="15"
  data-label="Business Name"
  data-home-label="Back to Town"
  data-address="Street, City, State"
  style="height: 480px">
  Street, City, State
</div>
<script type="module" src="/openpin/openpin.js"></script>
```

Adjust `src` to wherever you copied the folder. A relative path like `../openpin/openpin.js` also works.

## Rules that prevent the common mistakes

- **Coordinates:** in arrays the order is `[lng, lat]`. Prefer `data-lat` / `data-lng` attributes or `{ lat, lng }` objects. US latitudes are positive (≈25 to 49) and US longitudes are negative (≈−67 to −125). `toLngLat` throws a descriptive error when values are out of range or look swapped.
- **Don't invent coordinates.** Get them from the user, from existing site content (schema.org `geo`, an existing map embed, a Google Maps URL `@lat,lng`), or from a geocoder the user approves. If none is available, ask the user.
- **Height is required.** The element needs a height from CSS or an inline style. Otherwise it falls back to `min-height: 420px`.
- **Escape `&` in attributes** (`&amp;`). Wrap `data-colors` and `data-markers` JSON in single quotes.
- **Keep the attribution.** OpenStreetMap's license requires the (i) control to stay visible. Don't hide `.maplibregl-ctrl-attrib`.
- **Don't add Google Maps scripts or API keys.** This package replaces them. Plain Google, Apple, or OSM *directions links* are fine (see README "Directions links").
- **Verify over HTTP,** not `file://`. ES modules don't load from `file://`. Use `npx serve .` or `python -m http.server`.
- When you replace an existing Google Maps `<iframe>` or a JS map, remove the old embed and its `<script>`, including any `maps.googleapis.com` loader and its API key.

## Custom colors

Pick a theme with `data-theme` / `theme`: `country` (default, warm rural), `coastal` (light, blue), `mono` (grays), or `midnight` (dark). Override any subset with `data-colors` / `colors`. Unspecified keys keep the theme's value. Values are any CSS color string.

Map keys:
- `background`: open land
- `developed`: towns and built-up areas
- `green`: parks and fields
- `forest`
- `bare`: sand and rock
- `water`
- `waterway`: river and stream lines
- `building`
- `buildingOutline`
- `road`: minor road fill
- `roadCasing`: road edge
- `highway`: major roads
- `rail`
- `boundary`
- `label`: map text
- `labelHalo`: the halo behind map text
- `icon`: POI icons

UI keys:
- `pin`
- `pinIcon`
- `surface`: background of the buttons, pin label, and attribution
- `text`: text on those buttons
- `border`: edges of those buttons

To match a site's brand:
1. Read the site's CSS variables or most-used colors.
2. Set `pin` to the brand's primary or accent color, and `pinIcon` to a color that contrasts with it.
3. Set `surface`, `text`, and `border` to match the site's cards or buttons.
4. Keep the land colors (`background`, `developed`, `green`, `forest`) low in saturation and close in lightness. Make `label` contrast with `background` (aim for ≥ 4.5:1), and set `labelHalo` to about the `background` color.
5. For a dark site, start from `theme: 'midnight'` and override.

```html
<div data-openpin data-lat="40.7128" data-lng="-74.0060"
     data-theme="mono" data-colors='{"pin":"#5b21b6","highway":"#d8b4fe"}'
     style="height:420px"></div>
```

CSS hooks (put them in the site's stylesheet): `.openpin { --openpin-font; --openpin-radius; --openpin-shadow }`. The script sets the `--openpin-pin`, `--openpin-pin-icon`, `--openpin-surface`, `--openpin-text`, `--openpin-border`, and `--openpin-background` variables inline on the element from the theme. Change colors through the `colors` option, not CSS, so the map and UI stay in sync.

## JavaScript API (when attributes aren't enough)

```js
import { createMap, themes, getMap } from '/openpin/openpin.js';

const controller = createMap(elementOrSelector, {
  center: { lat, lng },            // or [lng, lat]; optional if markers is given
  zoom: 15,                        // omit with 2+ markers to auto-fit
  label: 'Name',                   // single-pin label
  markers: [{ lat, lng, label, link, color, pin: 'house' | 'dot' | 'none', showLabel }],
  marker: false,                   // no pin
  theme: 'country', colors: {},
  homeLabel: 'Back to Town',       // false hides the button
  address: 'shown while loading or on failure',
  link: 'pin click URL (default: OpenStreetMap)',
  scrollZoom: 'cooperative',       // true | false
  lazy: true,                      // load when near the viewport
  zoomButtons: true, showLabels: true,
  minZoom: 2, maxZoom: 18, padding: { top: 100, bottom: 40, left: 70, right: 70 },
  timeout: 20000, attribution: 'extra HTML credit',
  onReady(map, maplibregl) {},
  mapOptions: {},                  // passed to new maplibregl.Map()
});

controller.ready        // Promise<maplibregl.Map | null>
controller.map          // MapLibre Map once loaded
controller.setColors('midnight') // or setColors({ pin: '#f00' })
controller.recenter(); controller.load(); controller.destroy();
getMap(element)         // controller for an auto-initialized element
```

- Events on the element: `openpin:ready` (`detail.map`, `detail.maplibregl`) and `openpin:error`.
- Calling `createMap` on an element that already has a map destroys the old one first.
- `window.OpenPin` exposes the same API for non-module code.
- For content inserted after page load (SPAs), call `OpenPin.autoInit()` or `createMap()` after insertion, and `destroy()` on unmount.
- In React, Vue, or Svelte, keep the folder in `public/` and load the module at runtime with `import(/* @vite-ignore */ '/openpin/openpin.js')`, so the bundler doesn't process MapLibre.

## Behavior to know

- The map shows a fallback panel (address, plus an "Open in OpenStreetMap" link) while loading, and also when WebGL is unavailable, tiles fail, or 20 s pass with the page visible. If tiles arrive later, the map replaces the fallback and fires `openpin:ready`.
- Page scrolling isn't captured. By default, Ctrl/⌘ + scroll zooms the map and touch users pan with two fingers. Rotation and pitch are disabled.
- With 2+ markers and no `zoom`, the map fits all pins. The home button returns to that view.

## Files

| Path | Purpose | Edit? |
|---|---|---|
| `openpin/openpin.js` | Loader, themes, API | Only to add themes or features |
| `openpin/openpin.css` | Pin, buttons, fallback | OK, but prefer overriding in site CSS |
| `openpin/style.json` | MapLibre style (VersaTiles Shortbread schema) | To change the tile/glyph servers, or for advanced layer tweaks |
| `openpin/sprites/` | POI icon sprite (SDF, recolored by `icon`) | No |
| `openpin/maplibre/` | MapLibre GL JS 6.3.0. Renamed from `.mjs` to `.js` with the one internal import path updated, so any host serves it with a JS MIME type | No |
| `index.html` | Theme builder that generates embed code | Demo only, don't deploy |
| `examples/` | Working examples | Demo only |

### How recoloring works

Each role's default hex value appears in `style.json` only for that role. For example, `#edbd69` is only ever `highway`. `buildStyle()` swaps those hex strings in a single pass. If you edit `style.json`, keep each default color unique to its role, and update `STYLE_COLORS` in `openpin.js` to match. To add a theme, add an entry to `themes` that sets every key in `colorRoles`.

## Verify your work

1. Serve the site over HTTP and open the page.
2. The element should get `data-openpin-state="ready"` once it's scrolled into view. It shouldn't stay at `unavailable`.
3. The console should show no errors. Check that the pin sits on the right spot and the attribution (i) is visible.
4. On a phone-width viewport (375px), the page shouldn't scroll horizontally.
