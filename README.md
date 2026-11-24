# Pro Marketing — website

Bilingual (Arabic-first, RTL / English LTR) digital marketing agency site. No build step or npm dependencies: deploy this folder to Vercel as-is.

```
index.html        whole site: design system, router, all pages, 3D hero, form
api/contact.js    Vercel serverless function that delivers leads
vercel.json       headers + function config (merge with your existing one)
robots.txt / sitemap.xml
```

## 1. Edit company details
Open `index.html`, find `const CONFIG` near the top of the second `<script>` and set:

| Key | What |
|---|---|
| `logoSrc` | Already set to `logo.png`: the original logo with its background removed, used in the navbar, footer and loading screen. `logo-badge.png` (the round version with a transparent background) is used for `favicon.png`, `apple-touch-icon.png` and the social-sharing image. |
| `whatsapp` | Set to `201158482587`. Every WhatsApp button (floating button, hero, service, portfolio and contact CTAs) opens `https://wa.me/201158482587` directly, with the welcome message `waMessage` prefilled and encoded via `encodeURIComponent`. |
| `email`, `phoneDisplay`, `bookingUrl` | Shown on the contact page and footer once filled. |
| `siteUrl` | Your real domain. Also update it in `<link rel="canonical">`, `robots.txt` and `sitemap.xml`. |
| `budgets`, `industries`, `countries` | Form dropdowns (budgets in SAR). |

All copy is held in plain arrays. Every string is `[Arabic, English]`:
- `SERVICES`, `SOCIAL`, `ADS`, `PORTFOLIO`, `ABOUT`, `WHY` hold the base content.
- `SERVICE_X` adds each service's problems, audience, inclusions and deliverables.
- `SOCIAL_X` / `ADS_X` add the platform deep-dives.
- `WEB_TYPES`, `LOGO_VS`, `VIDEO_FLOW`, `AD_COSTS`, `INDUSTRIES`, `OBJECTIVES` (Service Explorer rules), `JOURNEY`, `TRUST`, `QUOTE_STEPS` and `GENERAL_FAQ` hold the v2 sections.

**Testimonials:** `TESTIMONIALS` is empty, so the section stays hidden. Add only real quotes with written client approval; the section then appears on the home page automatically.

## 2. Brand logos, contact details and the map
- **Platform logos (Facebook, Instagram, TikTok, Google Ads, GA4…):** add the official SVGs from each brand's own kit to `brand-icons/` and list their ids in `CONFIG.brandIcons`. See `brand-icons/README.txt` for the file names. Until you do, each slot shows a neutral short-name tile.
- **Phone / email / WhatsApp / booking:** `CONFIG.phone`, `phoneDisplay`, `email`, `whatsapp`, `bookingUrl`. Empty values show "Added once confirmed" instead of invented numbers.
- **Agency social accounts:** `CONFIG.social` (in content3 / index.html). Facebook is set to `https://www.facebook.com/promarketin4040/reels/`. Instagram, LinkedIn and YouTube are empty, so they show as greyed-out "Coming soon" icons in the footer. Paste a URL to turn each one into a live link. Nothing else needs changing.
- **Google Map (contact page):** set `CONFIG.address` to the real Cairo office address ([Arabic, English]). Optionally set `mapsQuery` (exact place name or `lat,lng`) for a precise pin. With no address, the map shows Cairo at city level and no directions button. The keyless Google Maps embed works by default. For the official Maps Embed API, create a browser API key in Google Cloud (enable "Maps Embed API" and restrict it by HTTP referrer to your domain) and put it in `CONFIG.mapsApiKey`. It's a public browser key, not a secret.

**Hero rocket:** the 3D rocket, flame, rings and particles are drawn live on canvas with no libraries (code under "HERO: 3D MARKETING ROCKET" in index.html). The orbiting platforms are Instagram, Facebook, TikTok, YouTube, WhatsApp, Snapchat, LinkedIn, X and Google. They use the same `brand-icons/` slots: once you add the official SVGs and their ids, the real logos orbit in their original colours on a light round tile. Phones get fewer particles. Visitors who ask for reduced motion see one still frame. Dragging the rocket spins it.

## 3. Portfolio (8 creative concepts)
`CONCEPTS` (under "PORTFOLIO" in index.html) holds 8 independent creative concepts designed by PRO MARKETING: NEXORA, BUNYAN, VELORA, MOTION AUTO, NOVACARE, URBANIX, PRIME BUILD and SYNCFLOW. Each one has an original logo and variations, palette, typography, identity board, business card, stationery, social profile, 6 posts, 3 stories, 3 ads, 2 banners, desktop and mobile site mockups, campaign direction, a signature application and a 7-step case study.
- Each project is labelled "مشروع إبداعي تصوري / Independent Creative Concept" and signed "Concept & Creative Direction — PRO MARKETING". No clients, results or testimonials are claimed.
- Imagery is illustrated art direction drawn in SVG. Replace it with real photography after a shoot.
- **To add a real client project:** append an object with the same fields and set `concept: false`, then update the badge text for that project. Logos are drawn by functions in `MARKS`, and photography-direction illustrations by functions in `SCENES`.
- The old routes (`#case-restaurant`, etc.) redirect to the matching concepts.

## 4. Contact form backend (required for submissions)
Set these in Vercel → Settings → Environment Variables, then redeploy:

| Variable | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | for email | API key from resend.com (verify your sending domain there) |
| `CONTACT_TO_EMAIL` | for email | Inbox for leads (comma-separate several) |
| `CONTACT_FROM_EMAIL` | for email | Verified sender, e.g. `Pro Website <noreply@yourdomain.com>` |
| `CONTACT_WEBHOOK_URL` | optional | Also POST each lead as JSON (CRM, Google Sheets Apps Script, Zapier, Make) |
| `ALLOWED_ORIGIN` | optional | e.g. `https://yourdomain.com` |

You need at least one channel: email or webhook. The API returns `{ok:true}` only when delivery succeeds. Otherwise the form shows an error and never fakes success. The API also validates input, has a honeypot field and basic rate limiting.

## 5. Routes
Hash routes, in both languages: `#home`, `#services`, `#s-social`, `#s-ads`, `#s-web`, `#s-brand`, `#s-video`, `#s-seo`, `#s-crm`, `#social-{instagram|facebook|tiktok|snapchat|x|linkedin|youtube}`, `#ads-{meta|google|tiktok-ads|snapchat-ads|linkedin-ads|youtube-ads}`, `#work`, `#case-*`, `#about`, `#s-google`, `#google-{ads|maps|ga4|gtm|gsc|merchant}`, `#ads-{meta|google|tiktok-ads|snapchat-ads|linkedin-ads|youtube-ads|x-ads|pinterest-ads}`, `#industries`, `#industry-{realestate|hospitality|healthcare|ecommerce|retail|education|corporate|construction}`, `#explorer`, `#faq`, `#contact`, `#quote`, `#book`, `#quote-{service}` / `#contact-{service}` (opens with that service preselected).

The form sends `requestType` (`quote`, `book` or `contact`), which appears in the lead email subject.

**SEO note:** each route updates the page title, meta description, Open Graph tags and JSON-LD (Organization, Service, FAQPage). However, search engines index hash routes less reliably than real URLs. The next SEO step is pre-rendering each route to its own static path (e.g. `/services/social`).

## 6. Admin
Content is edited in the `CONFIG` and data arrays above. To let non-developers edit, connect a headless CMS (Sanity, Contentful, Decap) and load those arrays from it. The site has no public admin surface.


## Platform icons (v9)
The official app icons supplied by the client live in `brand-icons/*.png` and are enabled in `CONFIG.brandIcons` + `CONFIG.brandIconFiles`. They appear in the hero rocket orbit, the platforms wall, the service and platform pages, the footer, the contact page and the WhatsApp buttons. See `brand-icons/README.txt` to add more.

## 3D illustrations (v10)
Client-supplied 3D art lives in `art/` (transparent WebP) and is set in `CONFIG.art`:
seo → SEO hero + 404 page · mapPin → contact hero + map block · whatsapp → floating button, WhatsApp buttons, contact hero, footer CTA · facebook → contact hero.
Set any key to '' to fall back to the built-in visuals.

## On-site assistant (v12)
A Gulf-dialect (Arabic) / English chatbot (`src/chatbot.js`). It collects name, mobile, business, city and service first, then answers questions from the site's own content (no invented prices, durations or guarantees).
- Leads + questions are POSTed to `CONFIG.leadsEndpoint`: a Google Apps Script web app that writes them to a Google Sheet and emails/Telegrams the owner. Setup: `leads/README-ar.md`, code: `leads/apps-script.gs`.
- Without an endpoint, or if saving fails, the bot never claims success: it offers a WhatsApp message prefilled with the visitor's details.
- Turn it off with `CONFIG.chatbot = false`.

## Creative Studio (v15)
- Route `#studio` (nav: "استوديو الإبداع / Creative Studio") plus a studio section on the home page.
- Showreel videos live in `media/` (H.264 MP4 + WebP posters). They are concept demos produced in-house and are labelled as such on screen and on the page. Add real projects by adding entries to `REEL` in `src/studio.js` (or the built `index.html`).
- Voice-over samples play only when real files are set in `CONFIG.voiceSamples` (e.g. `egyptian: 'audio/voice-egyptian.mp3'`); otherwise the player shows "Sample coming soon".
- Project form → `/api/contact` with `requestType: "studio"` and an optional reference file (≤ 3 MB, sent as an email attachment via Resend). If that endpoint is unavailable, it falls back to `CONFIG.leadsEndpoint` (Google Apps Script: row in "طلبات الاستوديو" + file saved to Drive). If both fail, the visitor gets a prefilled WhatsApp message; success is never faked.

## Web Development page (v18)
- Route `#s-web` now renders `webDevPage()` (`src/webdev.js`) instead of the generic service template. All original blocks are kept (problems, audience, what's included, website types, deliverables, benefits, FAQ); hero, process, portfolio and form were upgraded in place.
- Technology logos: official SVGs from Simple Icons (CC0) in `tech-icons/`, rendered as CSS masks tinted with brand colours (`TECH` in `src/webdev.js`).
- Portfolio: concept projects only (labelled). To add real work, add `{ b: '<concept id or new>', cat, stack, d, url: 'https://…' }` to `WD_WORK`; a "View project" button appears only when `url` exists.
- Website request form → `/api/contact` with `requestType: "web"` (name, phone, business activity, website type, features, description), then `CONFIG.leadsEndpoint`, then a prefilled WhatsApp message. Success is never faked.
- See `PERFORMANCE.md` for the performance audit and results.

## Music removed (v19)
The background music, the floating music player, the 10-second intro and the interface sounds were removed at the client's request.
Nothing on the site creates audio any more. Voice-over samples on the studio page still play when real files are added to `CONFIG.voiceSamples` (visitor presses Play).
