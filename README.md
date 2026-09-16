# GTA VI confirmed music tracker

Public, citeable list of artists and tracks tied to Grand Theft Auto VI marketing, plus a smaller set of Rockstar-named and artist-reported names.

**Live site:** https://leonidadrop.com (GitHub Pages from `docs/`)

This is fan documentation. It is not affiliated with Rockstar Games or Take-Two Interactive.

## What belongs on the list

Three tiers. Nothing else goes on the home page.

1. **official_promo** — audio heard in Rockstar-published Trailer 1, Trailer 2, or Extended Look.
2. **rockstar_named** — Rockstar staff named the artist in an interview. There may be no track yet.
3. **artist_reported** — the artist (or a channel they control) claims involvement. Link a **primary** source. Flag it as not Rockstar-verified.

Aggregators such as @videotech are discovery only. Keep them as a breadcrumb until you have the artist’s own post. Anonymous rumors stay off the main UI.

Copyright: no lyrics, no pasted bios. One or two factual sentences per artist with a citeable URL. Track titles and artist names are fine. Linking to official Rockstar media with a citation is fine. Do not host their video or audio files, or scrape logos and box art into the site chrome.

## Data file

The site is static HTML. It reads:

`docs/data/entries.json`

`schemaVersion` is `1`. Fields on each entry:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | kebab-case, unique |
| `artists` | yes | array of strings |
| `track` | no | `null` if unknown |
| `year` | no | original release year if known |
| `tier` | yes | `official_promo` \| `rockstar_named` \| `artist_reported` |
| `appearance` | yes | short human sentence |
| `appearanceKey` | yes | `trailer1` \| `trailer2` \| `extendedLook` \| `interview` \| `artist_claim` |
| `sources` | yes | `{ "label", "url" }[]` — first link should be the strongest |
| `status` | no | `needs_primary_source` for artist-reported rows without a primary URL |
| `note` | no | one factual caveat |
| `cueSeconds` | no | integer start time on the Rockstar YouTube upload; Play uses this |
| `inUniverse` | no | `true` for fictional in-game acts |

`officialVideos` entries may set `embedRestricted: true` when YouTube blocks third-party embeds
(Extended Look). Those rows link out at `cueSeconds` instead of loading an iframe.

Artist blurbs live under `artists` in the same file (not inside each row). Keep them to two sentences and a `cite` URL.

## Add an entry

1. Confirm the tier against the rules above. If you only have an aggregator, set `"status": "needs_primary_source"` and put the aggregator last, labeled as discovery.
2. Prefer a Rockstar video URL for promo audio:
   - Trailer 1: https://www.youtube.com/watch?v=QdBZY2fkU-0
   - Trailer 2: https://www.youtube.com/watch?v=VQRLujxTm3c
   - Extended Look: https://www.youtube.com/watch?v=tJbzMqJGH4k
3. Append the object to `entries` and, if needed, a blurb in `artists`.
4. Bump `updated` (ISO date).
5. Open a PR. Do not paste lyrics.

## Current coverage (2026-09-15)

- Trailer 1 + 2: six tracks (Petty; Ferguson; Zenglen; Wang Chung; Wynette; Pointer Sisters).
- Extended Look: fourteen IDs as listed by Polygon, checked against IGN / Music Ally.
- Rockstar-named: Kodak Black, Sexyy Red, Real Dimez (Dazed).
- Artist-reported awaiting a primary URL: Travis Scott, Future, Morgan Wallen.

## License

Code: MIT (`LICENSE`). The dataset is a factual compilation with source links, not copied marketing copy.
