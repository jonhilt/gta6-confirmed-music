# GTA VI confirmed music tracker

Public, citeable list of artists and tracks tied to Grand Theft Auto VI marketing, plus a smaller set of Rockstar-named and artist-reported names.

**Live site:** https://leonidadrop.com (GitHub Pages from `docs/`)

This is fan documentation. It is not affiliated with Rockstar Games or Take-Two Interactive.

## What belongs on the list

Four catalog tiers. Confirmed rows sit in the first three. Unconfirmed leak rows are a one-off fourth section at the bottom and do not count as confirmed.

1. **official_promo**: audio heard in Rockstar-published Trailer 1, Trailer 2, Extended Look, or the 8 Oct 2026 in-game radio station previews, or a track/album Rockstar + Atlantic named for *Grand Theft Auto VI: The Album*.
2. **rockstar_named** — Rockstar staff named the artist in an interview. There may be no track yet.
3. **artist_reported** — the artist (or a channel they control) claims involvement. Link a **primary** source. Flag it as not Rockstar-verified.
4. **unconfirmed_leak**: briefly listed on streaming pages or copyright claims, then pulled. Not confirmed by Rockstar, Atlantic, or the artist. No Play button, no embeds. Do not link posts that carry leaked audio.

Aggregators such as @videotech are discovery only. Keep them as a breadcrumb until you have the artist’s own post. Anonymous rumors stay off the confirmed list.

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
| `tier` | yes | `official_promo` \| `rockstar_named` \| `artist_reported` \| `unconfirmed_leak` |
| `appearance` | yes | short human sentence |
| `appearanceKey` | yes | `trailer1` \| `trailer2` \| `extendedLook` \| `the_album` \| `interview` \| `artist_claim` \| `radio_cocoteo_fm` \| `radio_back_country` \| `radio_afrobank_fm` \| `radio_the_chamber` \| `radio_flash_fm` \| `radio_dirty_south_classics` \| `unconfirmed_leak` |
| `sources` | yes | `{ "label", "url" }[]` — first link should be the strongest |
| `status` | no | `needs_primary_source` for artist-reported rows without a primary URL; `unconfirmed` for leak rows |
| `note` | no | one factual caveat |
| `cueSeconds` | no | integer start time on the Rockstar YouTube upload; Play uses this |
| `previewCueSeconds` | no | integer start time of the track in Rockstar's station preview mp3 (display only; we do not host or embed those files) |
| `spotifyTrackId` | no | 22-character Spotify track ID. Play loads the official Spotify track embed |
| `youtubeVideoId` | no | 11-character official full-track YouTube upload ID. Can coexist with a trailer cue |
| `appleMusicUrl` | no | Official Apple Music track URL. Shown as a source link, never as a hosted file |
| `previewSource` | no | `spotify` \| `youtube` \| `rockstar_station_embed` \| `none`. Radio rows use `spotify` when a verified Spotify id exists. Leak rows are `none` |
| `inUniverse` | no | `true` for fictional in-game acts |

`sharedSources` is a catalog-level map keyed by `appearanceKey`. The Album rows keep Rockstar X and gtavi-thealbum.com on the row, plus Spotify/YouTube/Linkfire on each debut single. Shared press (Music Universe, Gematsu, GAMINGbible) lives under `sharedSources.the_album` and is appended in the Sources panel. Radio preview rows share the station page, the station's @RockstarGames post, and the Newswire article under `sharedSources.<stationKey>`.

`stations` is a catalog-level map keyed by the same radio `appearanceKey` values. Each station has `name`, `hosts` (in-game DJ names as Rockstar prints them), `blurb`, `previewPage`, and `embedUrl` for Rockstar's official `/VI/music/embed/{key}/simple` player. Hosts stay as Rockstar's DJ names; press-reported real-world identities stay off the catalog. Station players are click-to-load iframes of that official embed. We do not host, rip, or proxy the preview audio.

Each catalog row's `id` is also its page anchor (`https://leonidadrop.com/#<id>`). Visiting that hash scrolls to the row and opens Sources.

`officialVideos` entries may set `embedRestricted: true` when YouTube blocks third-party embeds
(Extended Look). Those rows show an age restriction message in the player, with a YouTube link at `cueSeconds`.

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

## Current coverage (2026-10-09)

- Trailer 1 + 2: six tracks (Petty; Ferguson; Zenglen; Wang Chung; Wynette; Pointer Sisters).
- Extended Look: fourteen IDs as listed by Polygon, checked against IGN / Music Ally.
- Radio station previews (8 Oct 2026): 18 named tracks, three each on Cocoteo FM, Back Country Radio, AfroBank FM, The Chamber 106.6, Flash FM, and Dirty South Classics. Rows cite Rockstar's station page, the matching @RockstarGames post, and the Newswire article. Each station subsection can load Rockstar's official simple embed. Verified Spotify ids drive Play; official artist/VEVO/Topic YouTube ids are the fallback; Apple Music is a source link. Gye Wani has no YouTube id (label upload, not artist/VEVO/Topic). Unconfirmed leak rows stay `previewSource: none` with no embeds.
- The Album: six debut singles as `official_promo` (`appearanceKey: the_album`), plus album product row `album-gta-vi-the-album`. Collabs canonicalized to `ar-ca7riel-paco-amoroso` (Sexy Magic) and `ar-yung-lean` (That's It). Those six track rows carry `spotifyTrackId` and `youtubeVideoId` for the official Atlantic/Rockstar singles.
- Rockstar-named: Real Dimez (Dazed). Kodak Black and Sexyy Red Dazed mentions are notes on the Extended Look Skrilla and Pound Town rows.
- Artist-reported awaiting a primary URL: Hendrix Smoke story-tag cluster (Don Toliver, Kodak Black story-tag row, Hendrix Smoke, ATL Jacob, RushDee).
- Unconfirmed (not in the confirmed count): Fuerza Regida "Suzuki" (album track 10) and Cardi B untitled (album track 19). Discovery sources only; no Play or embeds.

## License

Code: MIT (`LICENSE`). The dataset is a factual compilation with source links, not copied marketing copy.

## Player sources

The player offers Full track, a named trailer with its cue time, and Spotify when available. Full track on YouTube is the default, falling back to the trailer. A source choice stays selected while browsing, with unavailable sources falling back without changing the preference. Trailer playback follows the current song as cue times pass. Full-track radio follows every catalog row that has an official YouTube id, in list order, then wraps to the first track. Trailer mode advances between distinct uploads and skips restricted trailers. Switching modes keeps the current song selected.

Run player regression checks with `node --test tests/player.test.cjs`.
