# Unio Landing Page

Static landing page for **Unio** — SYNTARIC's openEHR federation gateway.

Served from <https://unio.syntaric.com/> via GitHub Pages.

## Structure

```
index.html          The page. Hand-edited.
styles.css          All styling. Hand-edited.
thanks.html         Thank-you page the contact form redirects to (noindex).
worker/             Cloudflare Worker that receives the contact form (see below).
CNAME               GitHub Pages custom domain.
robots.txt          Crawler instructions (points to sitemap).
sitemap.xml         Update <lastmod> when the page changes materially.
site.webmanifest    PWA/install metadata.
favicon.ico
favicon-96x96.png
apple-touch-icon.png
etc/                Logos (unio-logo.png, unio-mark.png).
images/             Manifest icons.
images/console/     Operator-console captures, 2x PNG.
images/photos/      Stock photography (Unsplash, see below).
```

No build step and no dependencies for the page itself — open `index.html` or
serve the folder.

```bash
python3 -m http.server 8000    # then visit http://localhost:8000
```

---

## Design notes

**Direction: modern health-IT vendor site**, in the manner of fire.ly,
open-fhir.com and openline-vitaly.com. Photo hero with a straight bottom
edge, pill buttons, a label-left/columns-right audience section, a large
illustrated architecture graphic, a dark console showcase, photo-led solution
cards with tag pills, a photo-backed band, an FAQ accordion, and a contact
form. Product screenshots never overlap the hero photo.

Things deliberately avoided, because they read as generic or AI-generated:
serif display type, italic accent words inside headlines, numbered folios and
figure captions, uppercase eyebrow labels, coloured words inside headlines,
and grids of cards with an icon in a tinted square.

**Palette** is the logo's:

| Token | Value | Role |
|---|---|---|
| `--navy` | `#0c2842` | headings, gateway node, dark sections |
| `--teal` | `#128a8a` | buttons, links, request arrows, accents |
| `--teal-wash` | `#e6f4f4` | member nodes, tag pills |
| `--soft` | `#f3f6f9` | alternate section background |

Headings are Manrope (700/800, tight tracking), body is Inter. Both load
from Google Fonts. The only other colour on the page is the orange used for
the openFHIR node in the FHIR diagram, so the two products read as distinct.

### Content rules

The page is written for programme leads and IT directors at regions, hospital
groups and institutions that run more than one openEHR CDR.

1. **Topology-neutral wording.** Unio is not region-only. Use "federation",
   "member" and "source system" as the umbrella terms; where a concrete picture
   helps, name the three topologies: departments of one institution, hospitals
   of a group, care organisations of a region. Do not make "the region" or
   "the hospital" the default subject.
2. **Plain, full sentences.** No aphorisms, no lists of three for rhythm, no
   "not X but Y". Technical terms (openEHR REST, AQL, Docker, FHIR Connect) are
   fine; this audience expects them.
3. **No invented proof.** There are no customer logos, case studies or
   metrics on the page because none have been supplied. Add them when real.

### Photography

`images/photos/` holds four Unsplash photographs (Unsplash licence: free for
commercial use, attribution not required). Photo IDs, in case you want to
credit or replace them:

| File | Unsplash ID | Used for |
|---|---|---|
| `corridor.jpg` | `1777269749032-d8d458ae594d` | hero |
| `hero-clinicians.jpg` | `1666214277657-e60f05c40b04` | "What joining asks of a source system" band |
| `clinician-monitors.jpg` | `1666214280250-41f16ba24a26` | gateway solution card |
| `clinicians-screen.jpg` | `1666214280391-8ff5bd3c0bf0` | governance solution card |

Replacing these with your own photography is the single biggest upgrade
available to the page.

### The console captures

`images/console/` holds 2x screenshots of the operator console, taken from
the demo stack with the member names replaced by fictional ones
(`rz-noord`, `kliniek-zuid`). Nothing in them is a real organisation or a
real patient. The capture tooling lives next to the design mockup in the main
UNIO repository, not here; to refresh a shot, re-run it there and copy the PNG
across. The fake address bars above the captures show `unio-console.syntaric.com`
paths, matching where the "See the console" links go.

---

## Contact form (own endpoint)

GitHub Pages cannot receive a POST, so the "Get in touch" form posts to a
small Cloudflare Worker in `worker/`, which validates the submission and
forwards it as one email through Resend. Nothing is stored. Both services
have free tiers that cover a contact form many times over.

```
worker/
  src/index.js      The worker. Honeypot, origin check, validation,
                    optional rate limit and Turnstile, then Resend.
  wrangler.toml     Config: allowed origin, recipient, sender, redirect.
  test/smoke.mjs    Runs under plain Node with fetch stubbed: npm test
```

One-time setup, about half an hour:

1. **Resend.** Create an account at <https://resend.com/>, add the domain
   `syntaric.com` (choose the EU region when adding it), and create the DNS
   records it shows you. Create an API key with sending permission.
2. **Cloudflare.** Create a free account if there is none. Then:

   ```bash
   cd worker
   npm install
   npx wrangler login
   npx wrangler secret put RESEND_API_KEY     # paste the Resend key
   npm run deploy
   ```

   The deploy prints the worker URL, of the form
   `https://unio-contact.<account>.workers.dev`.
3. **Form action.** The form in `index.html` posts to
   `https://unio-contact.syntaric.workers.dev/`. If the deploy prints a
   different URL, update the form's `action` to match.
4. **Try it.** Submit the form from the live site. You should land on
   `thanks.html` and receive the email at `info@syntaric.com`, with the
   visitor's address as reply-to.

Settings live in `worker/wrangler.toml` under `[vars]`: the allowed origin,
recipient, sender and thank-you URL. Change them there and redeploy.

Spam defence in place: the hidden `_gotcha` honeypot (bots fill it, people
never see it, filled means silently dropped), an origin check so only posts
from `unio.syntaric.com` are accepted, and a per-IP limit of five submissions
a minute. If spam still gets through, add Cloudflare Turnstile: create a
widget in the Cloudflare dashboard, add its script and `<div
class="cf-turnstile" data-sitekey="...">` inside the form, and set the secret
with `npx wrangler secret put TURNSTILE_SECRET`. The worker verifies the token
automatically once the secret exists.

Local testing: copy `worker/.dev.vars.example` to `worker/.dev.vars`, then
`npm run dev` serves the worker at `http://localhost:8787` and accepts posts
from a local copy of the site on port 8000. Point the form action there
temporarily. `npm test` runs the smoke test without any network.

If you prefer a custom hostname such as `contact.unio.syntaric.com`, the
`syntaric.com` DNS zone has to be on Cloudflare; see the commented `routes`
block in `wrangler.toml`.

`thanks.html` is `noindex` and fires a `generate_lead` event into Google
Analytics, so submissions show up as conversions.

---

## Maintenance

- Update `<lastmod>` in `sitemap.xml` on material changes.
- Favicons are generated from `etc/unio-mark.png` flattened onto white (the
  mark's navy leaf needs an opaque backdrop to stay legible in browser tabs).
- The FHIR section describes openFHIR translating FHIR queries into AQL for
  the federation. Keep its wording in step with what openFHIR actually ships.
