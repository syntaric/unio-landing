# Unio Landing Page

Static landing page for **Unio** — SYNTARIC's openEHR federation gateway.

Served from <https://unio.syntaric.com/> via GitHub Pages.

## Structure

```
index.html          The page. Hand-edited.
styles.css          All styling. Hand-edited.
CNAME               GitHub Pages custom domain.
robots.txt          Crawler instructions (points to sitemap).
sitemap.xml         Update <lastmod> when the page changes materially.
site.webmanifest    PWA/install metadata.
favicon.ico
favicon-96x96.png
apple-touch-icon.png
etc/                Logos (unio-logo.png, unio-mark.png).
images/             Manifest icons.
images/console/     Operator-console captures for section V (Fig. 5–7), 2x PNG.
```

No build step and no dependencies — open `index.html` or serve the folder.

```bash
python3 -m http.server 8000    # then visit http://localhost:8000
```

---

## Design notes

**Direction: editorial / cartographic.** The page reads as a health-policy
publication rather than a SaaS site — warm paper, serif headlines, numbered
folios (I–VI), hairline rules instead of cards, and numbered figures with
captions.

**Palette** is sampled from the logo and used as map ink:

| Token | Value | Role |
|---|---|---|
| `--navy` | `#0c2842` | wordmark, dark band, buttons |
| `--teal` | `#128a8a` | primary accent, links, figure ink |
| `--teal-lt` | `#19b3b3` | accent on dark surfaces |
| `--deep` | `#1a6272` | button hover, mid tones |
| `--slate` | `#3a5878` | body text, secondary figure ink |
| `--mist` | `#98b0c0` | hairlines, coastline, map labels |

Surfaces are warm (`--paper` `#fbfaf7`) rather than white, so the page reads
as print. Fonts are Fraunces (serif) and Inter (sans), loaded from Google Fonts.

### The hero map

`Fig. 1` is hand-drawn inline SVG depicting **Zuid-Limburg** — the Dutch region
that introduced openEHR to the Netherlands via RSO Zuid-Limburg.

Geography is deliberately accurate: the tall north–south strip, the Maas down
the western edge, the Geul cutting north-east through the Heuvelland, Parkstad
tinted to the east, **België** to the west *and* south, **Duitsland** to the
east, and the Drielandenpunt marked at the south-eastern corner.

Care organisations are real and positioned true to one another: Zuyderland
Sittard-Geleen (north), Zuyderland Heerlen (mid-east), Maastricht UMC+
(south-west, on the Maas), Maastro (Maastricht), Mondriaan (Parkstad).

### Content rules

The page is written for **regional health authorities first, hospital IT
second**. Two constraints worth preserving when editing:

1. **No specification jargon.** No N-numbers, no CP-numbers, no `FED_*` codes,
   no AQL, no HTTP status codes. Technical guarantees appear as consequences
   ("a partial answer that admits it is partial is safe"), never as clauses.
2. **Figures carry the argument.** Four numbered SVG figures do the explaining;
   prose stays short around them. Section V adds three photographic figures
   (Fig. 5–7): console captures framed as plates, not product chrome.
3. **Plain sentences.** No lists of three for rhythm, no "not X but Y", no
   clauses hung off a dash. Short sentences are welcome.

### The console captures

`images/console/` holds 2x screenshots of the operator console, taken from
the demo stack with the member names replaced by fictional regional ones
(Regionaal Ziekenhuis Noord, Kliniek Zuid). Nothing in them is a real
organisation or a real patient. The capture tooling lives next to the design
mockup in the main UNIO repository, not here; to refresh a shot, re-run it
there and copy the PNG across.

---

## Before going live

- [ ] **Replace the Google Analytics ID.** `G-XXXXXXXXXX` in `index.html`
      (two places) is a placeholder.
- [ ] **Confirm the documentation URL.** Currently points at
      `https://github.com/syntaric/unio`; update if docs are hosted elsewhere.
- [ ] **Check the clinician pull-quote.** Currently framed as a paraphrase of
      what clinicians describe. If a real, attributable quote exists, use it.
- [ ] **Verify the Zuid-Limburg framing** with RSO Zuid-Limburg before public
      launch — the organisations named are real, so treat this as illustrative
      unless they have agreed to be cited.
- [ ] Point the `unio.syntaric.com` DNS CNAME at GitHub Pages and enable
      HTTPS in repository settings.

## Maintenance

- Update `<lastmod>` in `sitemap.xml` on material changes.
- Favicons are generated from `etc/unio-mark.png` flattened onto white (the
  mark's navy leaf needs an opaque backdrop to stay legible in browser tabs).
