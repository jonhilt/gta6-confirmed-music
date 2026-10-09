const TIER_LABEL = {
  official_promo: "Official promo",
  the_album: "GTA VI: The Album",
  rockstar_named: "Rockstar-named",
  artist_reported: "Artist-reported",
  unconfirmed_leak: "Unconfirmed",
};

const TIER_ORDER = ["official_promo", "the_album", "rockstar_named", "artist_reported", "unconfirmed_leak"];

const TIER_SECTION_NUM = {
  official_promo: "01",
  the_album: "02",
  rockstar_named: "03",
  artist_reported: "04",
  unconfirmed_leak: "05",
};

const TIER_COPY = {
  official_promo:
    "Music heard in Rockstar trailers, the Extended Look, and Rockstar's radio station previews. Choose a full track or jump to a trailer cue when one exists.",
  the_album: "Original music from Grand Theft Auto VI: The Album. Listen to the debut singles on YouTube or Spotify, and check the album announcement below.",
  rockstar_named: "Rockstar staff named the artist in an interview. The track may still be unknown.",
  artist_reported:
    "Artist or fan-account claims. We want a link from the artist before treating a row as solid.",
  unconfirmed_leak:
    "Briefly listed, unconfirmed. These names showed up on streaming listings or copyright claims before being pulled. Rockstar, Atlantic and the artists have not confirmed them. We will move them up or remove them as soon as there is an official source.",
};

const EVIDENCE_HEADLINE = {
  official_promo: "Publisher-backed promo credit, with linked sources.",
  rockstar_named: "An artist mention. Not a song credit.",
  artist_reported_needs: "A reported teaser. Proof still pending.",
  artist_reported: "Artist-reported claim with linked sources.",
  unconfirmed_leak: "Unconfirmed listing. Not a confirmed credit.",
};

function isUnconfirmed(entry) {
  return entry?.tier === "unconfirmed_leak";
}

function $(sel, root = document) {
  return root.querySelector(sel);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stationFor(entry, data) {
  const key = entry?.appearanceKey;
  return data?.stations?.[key] || null;
}

function formatCueLine(entry, data) {
  const key = entry.appearanceKey;
  const station = stationFor(entry, data);
  let slot;
  if (key === "trailer1") slot = "Trailer 1 · 04 Dec 2023";
  if (key === "trailer2") slot = "Trailer 2 · 06 May 2025";
  if (key === "extendedLook") slot = "Extended Look · 27 Aug 2026";
  if (key === "the_album") slot = "The Album · 17 Sep 2026";
  if (key === "interview") slot = "Named by Rockstar · Aug 2026";
  if (key === "artist_claim") slot = "Artist teaser · Sep 2026";
  if (key === "unconfirmed_leak") slot = entry.appearance;
  if (station) slot = `${station.name} · Radio preview · 8 Oct 2026`;
  if (!slot) slot = entry.appearance;

  const cue = entry.cueSeconds ?? entry.previewCueSeconds;
  if (entry.tier === "official_promo" && cue != null) {
    return `${slot} · ${formatTimestamp(cue)}`;
  }
  return slot;
}

function spotifyTrackId(entry) {
  const id = entry?.spotifyTrackId;
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!/^[A-Za-z0-9]{22}$/.test(trimmed)) return null;
  return trimmed;
}

function spotifyEmbedUrl(trackId) {
  return `https://open.spotify.com/embed/track/${trackId}`;
}

function spotifyOpenUrl(trackId) {
  return `https://open.spotify.com/track/${trackId}`;
}

function youtubeVideoId(entry) {
  const id = entry?.youtubeVideoId;
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return null;
  return trimmed;
}

function youtubeWatchFromId(id, startSeconds) {
  const url = new URL(`https://www.youtube.com/watch?v=${id}`);
  if (startSeconds) url.searchParams.set("t", String(Math.floor(startSeconds)));
  return url.toString();
}

function sharedSourcesFor(entry, data) {
  const key = entry?.appearanceKey;
  const list = data?.sharedSources?.[key];
  return Array.isArray(list) ? list : [];
}

function sourceCount(entry, data) {
  return (entry.sources || []).length + sharedSourcesFor(entry, data).length;
}

function videoMeta(data, entry) {
  const key = entry.appearanceKey;
  if (!key || !data.officialVideos?.[key]) return null;
  const rec = data.officialVideos[key];
  const id = youtubeId(rec.url);
  if (!id) return null;
  const start = entry.cueSeconds ?? 0;
  return { ...rec, id, start, embedRestricted: Boolean(rec.embedRestricted) };
}

function ytSource(entry, data, source = "trailer") {
  const trailer = videoMeta(data, entry);
  if (trailer && (source === "trailer" || !youtubeVideoId(entry))) {
    return {
      videoId: trailer.id,
      start: trailer.start,
      label: trailer.label,
      url: trailer.url,
      embedRestricted: Boolean(trailer.embedRestricted),
    };
  }
  const id = youtubeVideoId(entry);
  if (!id) return null;
  return {
    videoId: id,
    start: 0,
    label: "Official full track on YouTube",
    url: youtubeWatchFromId(id),
    embedRestricted: false,
  };
}

function canPlay(entry, data) {
  if (isUnconfirmed(entry) || entry?.previewSource === "none") return false;
  return Boolean(ytSource(entry, data) || spotifyTrackId(entry));
}

function playVariant(entry, data) {
  const yt = ytSource(entry, data);
  const sp = Boolean(spotifyTrackId(entry));
  if (sp && yt) return "play-both";
  if (sp && !yt) return "play-audio";
  return "play-video";
}

function radioVideos(data, source = "full") {
  const seen = new Set();
  const list = [];
  for (const entry of data.entries) {
    if (isUnconfirmed(entry)) continue;
    const yt = ytSource(entry, data, source);
    if (!yt || yt.embedRestricted) continue;
    if (seen.has(yt.videoId)) continue;
    seen.add(yt.videoId);
    list.push({
      videoId: yt.videoId,
      start: yt.start || 0,
      label: yt.label,
      url: yt.url,
      firstEntryId: entry.id,
    });
  }
  return list;
}

function entriesForVideo(data, videoId) {
  return data.entries
    .filter((entry) => ytSource(entry, data)?.videoId === videoId)
    .sort((a, b) => (ytSource(a, data).start || 0) - (ytSource(b, data).start || 0));
}

function entryAtTime(data, videoId, seconds) {
  const rows = entriesForVideo(data, videoId);
  if (!rows.length) return null;
  let current = rows[0];
  for (const row of rows) {
    const start = ytSource(row, data).start || 0;
    if (seconds + 0.35 >= start) current = row;
  }
  return current;
}

function sourceRole(label, entry) {
  const lower = label.toLowerCase();
  if (isUnconfirmed(entry) || entry.status === "unconfirmed") {
    if (lower.includes("videotech") || lower.includes("igrandtheftauto") || lower.includes("carrero")) {
      return "Discovery only. Not proof.";
    }
    if (lower.includes("instagram")) return "Artist visual teaser. Does not name the song.";
    if (lower.includes("consequence") || lower.includes("beebom")) return "Secondary news report.";
  }
  if (entry.status === "needs_primary_source" && lower.includes("videotech")) {
    return "Discovery only. Not proof.";
  }
  if (lower.includes("dazed")) return "Primary interview source.";
  if (lower.includes("rockstar youtube")) return "Official publisher video.";
  if (lower.includes("gta vi music page")) return "Official publisher station page.";
  if (lower.includes("rockstar newswire")) return "Official publisher announcement.";
  if (lower.includes("rockstar games on x") || lower.includes("the album official store")) {
    return "Official publisher announcement.";
  }
  if (lower.includes("official spotify track") || lower.includes("apple music track")) {
    return entry.appearanceKey === "the_album"
      ? "Official streaming page for this debut single."
      : "Official streaming page for this track.";
  }
  if (
    lower.includes("official audio on youtube") ||
    lower.includes("official video on youtube") ||
    lower.includes("official visualizer on youtube")
  ) {
    return "Official video for this track.";
  }
  if (lower.includes("atlantic records youtube")) return "Official label video for this debut single.";
  if (lower.includes("linkfire hub")) return "Official smart link for this debut single.";
  if (lower.includes("atlantic records")) return "Label announcement (track titles).";
  if (lower.includes("push square") || lower.includes("ign")) return "Secondary news report.";
  return "Supporting citation.";
}

function evidenceSummary(entry, artists) {
  if (entry.note) return entry.note;
  const name = entry.artists[0];
  const rec = artists[name];
  return rec?.blurb || entry.appearance;
}

function evidenceHeadline(entry) {
  if (entry.tier === "official_promo") return EVIDENCE_HEADLINE.official_promo;
  if (entry.tier === "rockstar_named") return EVIDENCE_HEADLINE.rockstar_named;
  if (isUnconfirmed(entry)) return EVIDENCE_HEADLINE.unconfirmed_leak;
  if (entry.status === "needs_primary_source") return EVIDENCE_HEADLINE.artist_reported_needs;
  return EVIDENCE_HEADLINE.artist_reported;
}

function externalIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6V3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-6h-2v6H5V5Z"/></svg>`;
}

function lucideIcon(name, size = 16) {
  const inner = {
    play: `<polygon points="6 3 20 12 6 21 6 3"/>`,
    headphones: `<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>`,
    "chevron-up": `<path d="m18 15-6-6-6 6"/>`,
    "arrow-up-right": `<path d="M7 7h10v10"/><path d="M7 17 17 7"/>`,
    "clock-3": `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 12"/>`,
    x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  }[name];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

function renderSourceItems(sources, entry) {
  return (sources || [])
    .map(
      (s) => `
        <div class="source-item">
          <a class="source-link" href="${escapeHtml(s.url)}" rel="noopener noreferrer">
            <span>${escapeHtml(s.label)}</span>
            ${externalIcon()}
          </a>
          <p class="source-role">${escapeHtml(sourceRole(s.label, entry))}</p>
        </div>`
    )
    .join("");
}

function sharedSourcesLabel(entry, data) {
  if (stationFor(entry, data)) return "Shared station sources";
  if (entry.appearanceKey === "the_album") return "Shared album press";
  return "Shared sources";
}

function stationEmbedsLoaded(state) {
  if (!state.loadedStationEmbeds) state.loadedStationEmbeds = new Set();
  return state.loadedStationEmbeds;
}

function parkStationEmbeds(root) {
  const parked = new Map();
  if (!root || typeof root.querySelectorAll !== "function") return parked;
  root.querySelectorAll("[data-station-embed]").forEach((host) => {
    const iframe = host.querySelector("iframe");
    if (iframe) parked.set(host.dataset.stationEmbed, iframe);
  });
  return parked;
}

function stationHostLine(station) {
  const hosts = station?.hosts || [];
  if (!hosts.length) return "";
  if (hosts.length === 1) return `Hosted by ${hosts[0]}`;
  return `Hosted by ${hosts.slice(0, -1).join(", ")} and ${hosts[hosts.length - 1]}`;
}

function appleMusicUrl(entry) {
  const url = entry?.appleMusicUrl;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://music.apple.com/")) return null;
  return trimmed;
}

function appleMusicLabel(entry) {
  const url = appleMusicUrl(entry);
  if (!url) return null;
  return url.includes("/us/") ? "Listen on Apple Music (US store)" : "Listen on Apple Music";
}

function previewCueLine(entry) {
  if (entry?.previewCueSeconds == null || Number.isNaN(Number(entry.previewCueSeconds))) return "";
  return `at ${formatTimestamp(entry.previewCueSeconds)} in the preview`;
}

function stationEmbedFrame(station, key, state) {
  const loaded = stationEmbedsLoaded(state).has(key);
  const src = station.embedUrl;
  const hosts = stationHostLine(station);
  if (!src) {
    return `<p class="station-player-fallback"><a href="${escapeHtml(station.previewPage)}" rel="noopener noreferrer">Open ${escapeHtml(station.name)} on Rockstar</a></p>`;
  }
  const frame = loaded
    ? `<iframe title="${escapeHtml(`${station.name} official station preview`)}" src="${escapeHtml(src)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`
    : `<button type="button" class="station-player-load" data-action="load-station-embed" data-station-key="${escapeHtml(key)}" aria-label="${escapeHtml(`Load official ${station.name} station preview`)}">
        ${lucideIcon("play", 14)}<span>Load official player</span>
      </button>`;
  return `
    <div class="station-player">
      <p class="station-player-label">Official station preview</p>
      ${hosts ? `<p class="station-player-hosts">${escapeHtml(hosts)}</p>` : ""}
      <div class="station-player-frame" data-station-embed="${escapeHtml(key)}">${frame}</div>
      <p class="station-player-hint">Pause the station preview before playing a track</p>
      <a class="station-player-link" href="${escapeHtml(station.previewPage)}" rel="noopener noreferrer">
        ${escapeHtml(station.name)} on Rockstar
        ${externalIcon()}
      </a>
    </div>`;
}

function restoreStationEmbeds(root, parked, state) {
  const loaded = stationEmbedsLoaded(state);
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("[data-station-embed]").forEach((host) => {
    const key = host.dataset.stationEmbed;
    const parkedFrame = parked.get(key);
    if (parkedFrame) {
      host.replaceChildren(parkedFrame);
      return;
    }
    if (!loaded.has(key) || host.querySelector("iframe")) return;
    const station = state.data?.stations?.[key];
    if (!station?.embedUrl) return;
    host.innerHTML = `<iframe title="${escapeHtml(`${station.name} on Rockstar`)}" src="${escapeHtml(station.embedUrl)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  });
}

function renderSourceList(entry, data) {
  const own = renderSourceItems(entry.sources || [], entry);
  const shared = sharedSourcesFor(entry, data);
  if (!shared.length) return own;
  return `${own}
    <p class="panel-eyebrow source-shared-label">${escapeHtml(sharedSourcesLabel(entry, data))}</p>
    ${renderSourceItems(shared, entry)}`;
}

function renderDetailsPanel(entry, data, artists) {
  const headline = evidenceHeadline(entry);
  const body = evidenceSummary(entry, artists);
  const artist = entry.artists
    .map((name) => artists[name])
    .find((rec) => rec?.blurb);
  const summary = body && body !== artist?.blurb
    ? `<p class="evidence-body">${escapeHtml(body)}</p>`
    : "";
  const citation = artist?.cite
    ? ` <a href="${escapeHtml(artist.cite)}" rel="noopener noreferrer">cite</a>`
    : "";
  const blurb = artist
    ? `<p class="evidence-body">${escapeHtml(artist.blurb)}${citation}</p>`
    : "";

  return `
    <div class="row-panel" id="panel-${escapeHtml(entry.id)}" data-panel-for="${escapeHtml(entry.id)}">
      <div class="row-panel-inner">
        <div>
          <p class="panel-eyebrow">The source / ${escapeHtml(TIER_LABEL[entry.tier])}</p>
          <h3 class="evidence-headline">${escapeHtml(headline)}</h3>
          ${summary}
          ${blurb}
          <p class="evidence-disclosure">Summary of the linked reporting, not a direct quotation.</p>
        </div>
        <div class="source-list-wrap">
          <p class="panel-eyebrow">Source references</p>
          <div class="source-list">${renderSourceList(entry, data)}</div>
        </div>
      </div>
    </div>`;
}

function playButton(entry, state) {
  if (!canPlay(entry, state.data)) return "";
  const playing = state.playingId === entry.id;
  const restricted = playing && state.provider === "youtube" && ytSource(entry, state.data, state.videoSource)?.embedRestricted;
  const variant = playVariant(entry, state.data);
  const label = playing
    ? restricted ? "Selected" : "Playing"
    : variant === "play-audio"
      ? "Play audio"
      : variant === "play-both"
        ? "Play"
        : "Play video";
  const who = `${entry.track || "track"} by ${entry.artists.join(", ")}`;
  const aria = playing
    ? restricted
      ? `Selected in player. Open on YouTube to watch ${who}.`
      : `Now playing ${who}`
    : `Play ${who} in the shared player`;
  const icon = lucideIcon(playing ? "headphones" : variant === "play-audio" ? "headphones" : "play", 14);
  return `
    <button
      type="button"
      class="row-action row-action--play${playing ? " is-playing" : ""}"
      data-action="play-entry"
      data-id="${escapeHtml(entry.id)}"
      aria-pressed="${String(playing)}"
      aria-label="${escapeHtml(aria)}"
    >
      ${icon}<span class="row-action-label">${escapeHtml(label)}</span>
    </button>`;
}

function sourceButton(entry, state) {
  const count = sourceCount(entry, state.data);
  if (!count) return "";
  const open = state.expandedId === entry.id;
  const awaiting = entry.status === "needs_primary_source";
  const label = awaiting ? "Awaiting" : "Sources";
  return `
    <button
      type="button"
      class="row-action row-action--sources${open ? " is-open" : ""}"
      data-action="toggle-details"
      data-id="${escapeHtml(entry.id)}"
      aria-expanded="${String(open)}"
    >
      <span class="row-action-label">${escapeHtml(label)}</span>
      ${lucideIcon(open ? "chevron-up" : awaiting ? "clock-3" : "arrow-up-right", 12)}
    </button>`;
}

function renderRow(entry, indexNum, state) {
  const expanded = state.expandedId === entry.id;
  const playing = state.playingId === entry.id;
  const anchored = state.anchorId === entry.id;
  const track = entry.track
    ? `<p class="row-track">“${escapeHtml(entry.track)}”</p>`
    : `<p class="row-track is-empty">Track not specified</p>`;
  const classes = [
    "index-row",
    `index-row--${entry.tier}`,
    expanded ? "is-active" : "",
    playing ? "is-playing" : "",
    anchored ? "is-anchor" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${classes}" id="${escapeHtml(entry.id)}" data-id="${escapeHtml(entry.id)}">
      <div class="row-summary">
        <span class="row-num">${String(indexNum).padStart(2, "0")}</span>
        <div class="row-identity">
          <h3 class="row-artist">${entry.artists.map(escapeHtml).join(", ")}</h3>
          ${track}
          <p class="row-cue">${escapeHtml(formatCueLine(entry, state.data))}</p>
        </div>
        <p class="row-evidence">${
          isUnconfirmed(entry)
            ? `<span class="row-badge row-badge--unconfirmed">Not released</span>`
            : escapeHtml(TIER_LABEL[entry.tier])
        }</p>
        <div class="row-actions">${playButton(entry, state)}</div>
        <div class="row-source">${sourceButton(entry, state)}</div>
      </div>
      ${expanded ? renderDetailsPanel(entry, state.data, state.data.artists) : ""}
    </article>`;
}

function renderStationTrack(entry, state) {
  const expanded = state.expandedId === entry.id;
  const playing = state.playingId === entry.id;
  const anchored = state.anchorId === entry.id;
  const cue = previewCueLine(entry);
  const apple = appleMusicUrl(entry);
  const appleLabel = appleMusicLabel(entry);
  const sp = spotifyTrackId(entry);
  const listen = [
    apple
      ? `<a class="station-apple" href="${escapeHtml(apple)}" rel="noopener noreferrer">${escapeHtml(appleLabel)}</a>`
      : "",
    sp
      ? `<a class="station-apple" href="${escapeHtml(spotifyOpenUrl(sp))}" rel="noopener noreferrer">Open on Spotify</a>`
      : "",
  ].filter(Boolean);
  const classes = [
    "station-track",
    playing ? "is-playing" : "",
    expanded ? "is-active" : "",
    anchored ? "is-anchor" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <article class="${classes}" id="${escapeHtml(entry.id)}" data-id="${escapeHtml(entry.id)}">
      <div class="station-track-main">
        <h4 class="station-track-artist">${entry.artists.map(escapeHtml).join(", ")}</h4>
        <p class="station-track-title">${entry.track ? `“${escapeHtml(entry.track)}”` : "Track not specified"}</p>
        ${cue ? `<p class="station-track-cue">${escapeHtml(cue)}</p>` : ""}
        ${listen.length ? `<p class="station-listen">${listen.join(" · ")}</p>` : ""}
      </div>
      <div class="station-track-actions">${playButton(entry, state)}${sourceButton(entry, state)}</div>
      ${expanded ? renderDetailsPanel(entry, state.data, state.data.artists) : ""}
    </article>`;
}

function renderStationCard(station, key, tracks, state) {
  return `
    <section class="station-card" data-station-card="${escapeHtml(key)}">
      <header class="station-card-head">
        <h3 class="station-card-title">${escapeHtml(station.name)}</h3>
      </header>
      ${stationEmbedFrame(station, key, state)}
      <div class="station-track-list">
        ${tracks.map((entry) => renderStationTrack(entry, state)).join("")}
      </div>
    </section>`;
}

function matchesQuery(entry, q, data) {
  if (!q) return true;
  const station = stationFor(entry, data);
  const hay = [
    ...entry.artists,
    entry.track || "",
    entry.appearance,
    entry.note || "",
    station?.name || "",
    ...(station?.hosts || []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function catalogSection(entry) {
  return entry.tier === "official_promo" && entry.appearanceKey === "the_album"
    ? "the_album"
    : entry.tier;
}

function filteredEntries(data, state) {
  return data.entries.filter((e) => {
    if (state.tier !== "all" && catalogSection(e) !== state.tier) return false;
    return matchesQuery(e, state.query.trim().toLowerCase(), data);
  });
}

function render(data, state, options = {}) {
  state.data = data;
  window.__catalogData = data;
  const root = $("#catalog");
  if (!root) return;
  const filtered = filteredEntries(data, state);
  const total = data.entries.filter((e) => !isUnconfirmed(e)).length;
  const leakCount = data.entries.filter(isUnconfirmed).length;
  const scrollY = options.preserveScroll ? window.scrollY : null;

  const awaitingPrimary = data.entries.filter((e) => e.status === "needs_primary_source").length;
  const kicker = $("#hero-kicker");
  if (kicker) {
    kicker.textContent = `The sound of Leonida / ${total} entries · updated ${data.updated}`;
  }
  const introMeta = $("#intro-meta");
    if (introMeta) {
      const bits = [];
      if (awaitingPrimary > 0) {
        bits.push(`${awaitingPrimary} artist-reported row${awaitingPrimary === 1 ? "" : "s"} still need a primary link`);
      }
      if (leakCount > 0) {
        bits.push(`${leakCount} unconfirmed row${leakCount === 1 ? "" : "s"} sit below the confirmed list`);
      }
      introMeta.textContent = bits.join(". ");
    }
    const leakKey = $(".tier-key--leak");
    if (leakKey) leakKey.hidden = leakCount === 0;

  if (!filtered.length) {
    root.innerHTML = `<p class="empty">No rows match that filter.</p>`;
    return;
  }

  let globalNum = 0;
  const chunks = [];
  const head = `<div class="table-head" aria-hidden="true">
    <span>#</span><span>Artist / track</span><span>Evidence</span><span>Play</span><span>Source</span>
  </div>`;

  for (const tier of TIER_ORDER) {
    if (state.tier !== "all" && state.tier !== tier) continue;
    const rows = filtered.filter((e) => catalogSection(e) === tier);
    if (!rows.length) continue;

    const renderRows = (list) =>
      list
        .map((entry, index) => {
          if (tier === "unconfirmed_leak") return renderRow(entry, index + 1, state);
          globalNum += 1;
          return renderRow(entry, globalNum, state);
        })
        .join("");

    let bodyHtml = "";
    if (tier === "artist_reported") {
      const solid = rows.filter((e) => e.status !== "needs_primary_source");
      const waiting = rows.filter((e) => e.status === "needs_primary_source");
      if (solid.length) bodyHtml = `<div class="index-list">${head}${renderRows(solid)}</div>`;
      if (waiting.length) {
        const waitingBlock = `<div class="index-list">${solid.length ? "" : head}${renderRows(waiting)}</div>`;
        bodyHtml += solid.length
          ? `<div class="subsection">
              <h3 class="subsection-title">Awaiting primary source</h3>
              <p class="subsection-copy">Discovery breadcrumbs only. Not Rockstar-verified soundtrack credits.</p>
              ${waitingBlock}
            </div>`
          : waitingBlock;
      }
    } else if (tier === "official_promo") {
      const promo = rows.filter((e) => !stationFor(e, data));
      const radio = rows.filter((e) => stationFor(e, data));
      if (promo.length) bodyHtml = `<div class="index-list">${head}${renderRows(promo)}</div>`;
      const stationKeys = [];
      const seen = new Set();
      for (const entry of radio) {
        if (seen.has(entry.appearanceKey)) continue;
        seen.add(entry.appearanceKey);
        stationKeys.push(entry.appearanceKey);
      }
      stationKeys.forEach((key, index) => {
        const station = data.stations[key];
        const list = radio.filter((e) => e.appearanceKey === key);
        bodyHtml += renderStationCard(station, key, list, state);
      });
    } else {
      bodyHtml = `<div class="index-list">${head}${renderRows(rows)}</div>`;
    }

    chunks.push(`
      <section class="tier-section tier-section--${tier}" id="tier-${tier}">
        <div class="tier-header">
          <div class="tier-header-title">
            <span class="tier-header-num">${TIER_SECTION_NUM[tier]}</span>
            <h2 class="tier-header-name">${TIER_LABEL[tier]}</h2>
          </div>
          <span class="tier-header-count">${rows.length} ${rows.length === 1 ? "entry" : "entries"}</span>
        </div>
        <p class="tier-description">${TIER_COPY[tier]}</p>
        ${bodyHtml}
      </section>`);
  }

  const parked = parkStationEmbeds(root);
  root.innerHTML = chunks.join("");
  restoreStationEmbeds(root, parked, state);
  if (scrollY != null) window.scrollTo(0, scrollY);
}

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (window.__ytApiPromise) return window.__ytApiPromise;
  window.__ytApiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };
  });
  return window.__ytApiPromise;
}

function loadSpotifyApi() {
  if (window.__spotifyApiPromise) return window.__spotifyApiPromise;
  window.__spotifyApiPromise = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return window.__spotifyApiPromise;
}

function playerController(state) {
  const ytHost = $("#yt-host");
  const spotifyHost = $("#spotify-host");
  const empty = $("#dock-empty");
  if (!ytHost) return { sync() {}, playEntry() {}, startRadio() {} };

  function setVisualizerPlaying(playing) {
    $(".hero-graphic")?.classList.toggle("is-playing", playing);
  }

  let spotifyController = null;
  let spotifyGeneration = 0;
  let ytPlayer = null;
  let playerReady = null;
  let playbackRequest = 0;
  let playbackError = false;
  let cueTimer = null;
  let ignoreEnded = false;

  function pauseSpotify() {
    if (spotifyController && typeof spotifyController.pause === "function") {
      try {
        spotifyController.pause();
      } catch {
        /* cross-origin pause can throw if the widget is gone */
      }
    }
  }

  function pauseYouTube() {
    if (ytPlayer && typeof ytPlayer.pauseVideo === "function") {
      try {
        ytPlayer.pauseVideo();
      } catch {
        /* player may not be ready */
      }
    }
  }

  function silenceStationPreviews() {
    const root = $("#catalog");
    stationEmbedsLoaded(state).clear();
    if (!root || typeof root.querySelectorAll !== "function") return;
    root.querySelectorAll("[data-station-embed] iframe").forEach((iframe) => {
      iframe.src = "about:blank";
      iframe.remove();
    });
  }

  function pauseAllMedia({ stations = false } = {}) {
    pauseSpotify();
    pauseYouTube();
    if (stations) silenceStationPreviews();
  }

  function syncDockChrome() {
    const dock = $("#player-dock");
    const open = Boolean(state.playingId) && !state.dockClosed;
    dock?.classList.toggle("is-open", open);
    dock?.classList.toggle("has-selection", open);
    if (dock) dock.hidden = !open;
    document.body?.classList.toggle("has-dock", open);
    const applySpace = () => {
      const space = open && dock && typeof dock.getBoundingClientRect === "function"
        ? `${Math.ceil(dock.getBoundingClientRect().height)}px`
        : "0px";
      document.documentElement?.style?.setProperty("--player-dock-space", space);
      if (document.body?.style) document.body.style.paddingBottom = open ? space : "";
    };
    applySpace();
    if (open && typeof requestAnimationFrame === "function") requestAnimationFrame(applySpace);
  }

  function selectedYoutube(entry) {
    return ytSource(entry, state.data, state.videoSource);
  }

  function videos() {
    return radioVideos(state.data, state.sourcePreference === "trailer" ? "trailer" : "full");
  }

  function currentEntry() {
    return state.data.entries.find((e) => e.id === state.playingId) || null;
  }

  function setPlaying(id, opts = {}) {
    state.playingId = id;
    if (!opts.keepMode) state.radioMode = opts.radioMode ?? state.radioMode;
    render(state.data, state, { preserveScroll: true });
    syncDock();
  }

  function nextVideoIndex(videoId) {
    const list = videos();
    const idx = list.findIndex((v) => v.videoId === videoId);
    if (idx < 0) {
      const currentIndex = state.data.entries.findIndex((entry) => entry.id === state.playingId);
      const nextIndex = list.findIndex((video) => state.data.entries.findIndex((entry) => entry.id === video.firstEntryId) > currentIndex);
      return nextIndex < 0 ? 0 : nextIndex;
    }
    return (idx + 1) % list.length;
  }

  function syncDock() {
    const entry = currentEntry();
    if (!entry) state.dockClosed = true;
    syncDockChrome();
    const yt = entry ? selectedYoutube(entry) : null;
    const sp = entry ? spotifyTrackId(entry) : null;
    const track = $("#dock-track");
    const artist = $("#dock-artist");
    const navStatus = $("#nav-radio-status");
    const radioEntry = document.querySelector(".radio-entry");
    const inRadio = state.provider === "youtube" && state.radioMode;
    const sourceLabel = state.provider === "spotify" ? "Spotify" : inRadio ? "YouTube radio" : "YouTube";
    if (track) {
      track.textContent = entry?.track || (inRadio ? "Leonida Radio" : "Select a track");
    }
    if (artist) {
      artist.textContent = entry ? `${entry.artists.join(", ")} · ${sourceLabel}` : "";
    }
    if (navStatus) {
      navStatus.textContent = state.playingId && inRadio ? "Radio open" : "YouTube playlist";
    }
    if (radioEntry && radioEntry.tagName === "BUTTON") {
      radioEntry.classList.toggle("is-live", Boolean(state.playingId) && inRadio);
    }

    const showSpotify = Boolean(entry && state.provider === "spotify" && sp);
    const showYt = Boolean(entry && state.provider === "youtube" && yt && !yt.embedRestricted && ytPlayer && !playbackError);
    if (spotifyHost) {
      spotifyHost.hidden = !showSpotify;
      if (showSpotify) {
        const uri = `spotify:track:${sp}`;
        if (spotifyHost.dataset.track === sp && spotifyController) {
          /* already on this track */
        } else if (spotifyController && typeof spotifyController.loadUri === "function") {
          spotifyHost.dataset.track = sp;
          spotifyController.loadUri(uri);
        } else if (spotifyHost.dataset.track !== sp) {
          const generation = ++spotifyGeneration;
          spotifyController?.destroy();
          spotifyController = null;
          spotifyHost.dataset.track = sp;
          loadSpotifyApi().then((api) => {
            if (!api || generation !== spotifyGeneration || state.provider !== "spotify") return;
            const mount = document.createElement("div");
            spotifyHost.replaceChildren(mount);
            api.createController(mount, { uri, width: "100%", height: "80" }, (controller) => {
              if (generation !== spotifyGeneration || state.provider !== "spotify") {
                controller.destroy();
                return;
              }
              spotifyController = controller;
              controller.addListener("playback_update", ({ data }) => {
                if (generation !== spotifyGeneration || state.provider !== "spotify") return;
                setVisualizerPlaying(data.isPaused === false && data.isBuffering === false);
              });
            });
          });
        }
      } else {
        pauseSpotify();
      }
    }
    ytHost.hidden = !showYt;
    if (empty) {
      empty.hidden = showSpotify || showYt;
      if (playbackError && yt && state.provider === "youtube") {
        empty.innerHTML = `<div class="dock-restricted">
            <strong>Video unavailable here</strong>
            <p>Open it on YouTube, or close the player.</p>
            <a class="dock-outbound" href="${escapeHtml(youtubeWatchFromId(yt.videoId, yt.start))}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
          </div>`;
      } else if (yt?.embedRestricted && state.provider === "youtube") {
        empty.innerHTML = `<div class="dock-restricted">
            <strong>Age-restricted video</strong>
            <p>Watch on YouTube to verify your age.</p>
            <a class="dock-outbound" href="${escapeHtml(youtubeWatchFromId(yt.videoId, yt.start))}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
          </div>`;
      } else if (entry && state.provider === "spotify") {
        empty.innerHTML = "<p>Loading Spotify…</p>";
      } else if (entry) {
        empty.innerHTML = "<p>Loading YouTube video…</p>";
      } else {
        empty.innerHTML = "<p>Play a track to listen here.</p>";
      }
    }
  }

  function stopCueTimer() {
    if (cueTimer) {
      clearInterval(cueTimer);
      cueTimer = null;
    }
  }

  function startCueTimer(videoId) {
    stopCueTimer();
    cueTimer = setInterval(() => {
      if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
      if (state.provider !== "youtube" || state.videoSource !== "trailer") return;
      const t = ytPlayer.getCurrentTime();
      const match = entryAtTime(state.data, videoId, t);
      if (match && match.id !== state.playingId) {
        setPlaying(match.id, { radioMode: state.radioMode });
      }
    }, 800);
  }

  function ensurePlayer() {
    if (playerReady) return playerReady;
    playerReady = (async () => {
      await loadYouTubeApi();
      ytHost.replaceChildren();
      const mount = document.createElement("div");
      mount.id = "yt-player-mount";
      ytHost.appendChild(mount);
      await new Promise((resolve) => {
        ytPlayer = new window.YT.Player("yt-player-mount", {
          width: "100%",
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            origin: location.origin,
          },
          events: {
            onReady() {
              resolve();
            },
            onStateChange(event) {
              if (state.provider !== "youtube" || playbackError) return;
              setVisualizerPlaying(event.data === window.YT.PlayerState.PLAYING);
              if (event.data === window.YT.PlayerState.ENDED) {
                if (ignoreEnded) return;
                if (state.provider === "youtube" && state.radioMode) {
                  playNextVideo();
                }
              }
              if (event.data === window.YT.PlayerState.PLAYING) {
                const id = ytPlayer.getVideoData?.().video_id;
                if (id) startCueTimer(id);
              }
            },
            onError() {
              if (state.provider !== "youtube") return;
              setVisualizerPlaying(false);
              playbackError = true;
              state.radioMode = false;
              playbackRequest++;
              stopCueTimer();
              if (typeof ytPlayer?.pauseVideo === "function") ytPlayer.pauseVideo();
              syncDock();
            },
          },
        });
      });
      return ytPlayer;
    })();
    return playerReady;
  }

  async function loadVideo(videoId, start, request) {
    ignoreEnded = true;
    await ensurePlayer();
    if (request !== playbackRequest || state.provider !== "youtube") return;
    ytPlayer.loadVideoById({ videoId, startSeconds: start || 0 });
    startCueTimer(videoId);
    setTimeout(() => {
      if (request === playbackRequest) ignoreEnded = false;
    }, 1200);
  }

  async function playVideoForEntry(entry, { radioMode }) {
    const request = ++playbackRequest;
    setVisualizerPlaying(false);
    playbackError = false;
    stopCueTimer();
    state.dockClosed = false;
    pauseAllMedia({ stations: true });
    const preferred = state.sourcePreference;
    const hasFull = Boolean(youtubeVideoId(entry));
    const hasTrailer = Boolean(videoMeta(state.data, entry));
    const sp = spotifyTrackId(entry);
    const wantSpotify = Boolean(sp) && (preferred === "spotify" || (preferred !== "full" && preferred !== "trailer"));
    state.provider = wantSpotify ? "spotify" : "youtube";
    state.videoSource = preferred === "trailer" && hasTrailer ? "trailer" : hasFull ? "full" : "trailer";
    const yt = selectedYoutube(entry);
    state.radioMode = radioMode;
    if (state.provider !== "spotify" && yt?.embedRestricted) {
      state.provider = "youtube";
      pauseSpotify();
      setPlaying(entry.id, { radioMode: false });
      stopCueTimer();
      return;
    }
    if (state.provider === "spotify" && sp) {
      pauseYouTube();
      stopCueTimer();
      setPlaying(entry.id, { radioMode: false });
      return;
    }
    state.provider = "youtube";
    if (!yt) {
      if (sp) {
        state.provider = "spotify";
        pauseYouTube();
        setPlaying(entry.id, { radioMode: false });
      }
      return;
    }
    pauseSpotify();
    setPlaying(entry.id, { radioMode });
    await loadVideo(yt.videoId, yt.start, request);
    syncDock();
  }

  async function playNextVideo() {
    const list = videos();
    if (!list.length) return;
    const entry = currentEntry();
    const currentYt = entry ? selectedYoutube(entry) : null;
    const next = list[nextVideoIndex(currentYt?.videoId)];
    const nextEntry = state.data.entries.find((e) => e.id === next.firstEntryId);
    if (state.sourcePreference === "spotify") state.sourcePreference = "full";
    if (nextEntry) await playVideoForEntry(nextEntry, { radioMode: true });
  }

  async function startRadio() {
    if (state.sourcePreference === "spotify") state.sourcePreference = "full";
    state.provider = "youtube";
    state.radioMode = true;
    if (state.playingId) {
      await playNextVideo();
      return;
    }
    const list = videos();
    const first = list[0] && state.data.entries.find((e) => e.id === list[0].firstEntryId);
    if (first) await playVideoForEntry(first, { radioMode: true });
  }

  async function playEntry(id) {
    const entry = state.data.entries.find((e) => e.id === id);
    if (!entry || !canPlay(entry, state.data)) return;
    if (spotifyTrackId(entry)) {
      state.sourcePreference = "spotify";
      await playVideoForEntry(entry, { radioMode: false });
      return;
    }
    const yt = ytSource(entry, state.data, state.sourcePreference);
    const continueRadio = Boolean(yt && !yt.embedRestricted);
    await playVideoForEntry(entry, { radioMode: continueRadio });
  }

  function closePlayer() {
    state.dockClosed = true;
    state.playingId = null;
    state.radioMode = false;
    pauseAllMedia();
    setVisualizerPlaying(false);
    render(state.data, state, { preserveScroll: true });
    syncDock();
  }

  async function setProvider(source) {
    const entry = currentEntry();
    if (!entry) return;
    if (!["full", "trailer", "spotify"].includes(source)) return;
    if (source === "full" && !youtubeVideoId(entry)) return;
    if (source === "trailer" && !videoMeta(state.data, entry)) return;
    if (source === "spotify" && !spotifyTrackId(entry)) return;
    state.sourcePreference = source;
    await playVideoForEntry(entry, { radioMode: source !== "spotify" });
  }

  syncDock();
  return { sync: syncDock, playEntry, startRadio, setProvider, playNextVideo, closePlayer, pauseAllMedia };
}

function bindCatalog(data, state, player) {
  const root = $("#catalog");
  if (!root) return;
  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === "toggle-details") {
      state.expandedId = state.expandedId === id ? null : id;
      render(data, state, { preserveScroll: true });
    } else if (action === "play-entry") {
      player.playEntry(id);
    } else if (action === "load-station-embed") {
      const key = btn.dataset.stationKey;
      if (player.pauseAllMedia) player.pauseAllMedia();
      if (key) stationEmbedsLoaded(state).add(key);
      render(data, state, { preserveScroll: true });
    }
  });
}

const CATALOG_ID_ALIASES = {
  "leak-fuerza-regida-suzuki": "ar-fuerza-regida-suzuki",
  "leak-cardi-b-track-19": "ar-cardi-b-dont-chart",
};

function catalogHashId() {
  const raw = (typeof location !== "undefined" && location.hash ? location.hash : "").replace(/^#/, "");
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  if (id === "radio" || id.startsWith("tier-")) return null;
  return CATALOG_ID_ALIASES[id] || id;
}

function applyCatalogHash(data, state) {
  const id = catalogHashId();
  if (!id) {
    state.anchorId = null;
    return { startRadio: typeof location !== "undefined" && location.hash === "#radio" };
  }
  const entry = data.entries.find((e) => e.id === id);
  if (!entry) {
    state.anchorId = null;
    return { startRadio: false };
  }
  state.query = "";
  state.tier = "all";
  state.expandedId = id;
  state.anchorId = id;
  return { startRadio: false, scrollTo: id };
}

function scrollToEntry(id) {
  const el = document.getElementById(id);
  if (!el || typeof el.scrollIntoView !== "function") return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function main() {
  const catalog = $("#catalog");
  const res = await fetch("data/entries.json", { cache: "no-store" });
  if (!res.ok) {
    if (catalog) catalog.innerHTML = `<p class="empty">Could not load data/entries.json (${res.status}).</p>`;
    return;
  }

  const data = await res.json();
  const state = {
    query: "",
    tier: "all",
    expandedId: null,
    playingId: null,
    provider: "youtube",
    sourcePreference: "full",
    videoSource: "full",
    radioMode: true,
    anchorId: null,
    data,
  };

  const player = playerController(state);

  const search = $("#search");
  if (search) {
    search.addEventListener("input", () => {
      state.query = search.value;
      render(data, state);
      player.sync();
    });
  }

  const header = $(".archive-hero");
  const nav = $(".archive-nav");
  let compactHeader = false;
  const updateHeaderCompactness = () => {
    const next = compactHeader ? window.scrollY > 32 : window.scrollY > 160;
    if (next === compactHeader) return;
    compactHeader = next;
    header?.classList.toggle("is-compact", next);
  };
  window.addEventListener("scroll", updateHeaderCompactness, { passive: true });
  updateHeaderCompactness();
  const updateStickyOffsets = () => {
    const navHeight = window.matchMedia("(max-width: 1100px)").matches ? nav?.getBoundingClientRect().height || 0 : 0;
    document.documentElement.style.setProperty("--sticky-nav-height", `${navHeight}px`);
    document.documentElement.style.setProperty("--sticky-header-height", `${header?.getBoundingClientRect().height || 0}px`);
  };
  const headerObserver = new ResizeObserver(updateStickyOffsets);
  if (header) headerObserver.observe(header);
  if (nav) headerObserver.observe(nav);
  window.addEventListener("resize", updateStickyOffsets);
  updateStickyOffsets();

  document.querySelectorAll(".tier-key").forEach((link) => {
    link.addEventListener("click", () => {
      // Restore searched-out sections before the anchor's default navigation.
      if (state.query) {
        state.query = "";
        if (search) search.value = "";
        render(data, state);
      }
    });
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    if (btn.closest("#catalog")) return;
    const action = btn.dataset.action;
    if (action === "start-radio") player.startRadio();
    if (action === "set-provider") player.setProvider(btn.dataset.source);
    if (action === "close-player") player.closePlayer();
  });

  bindCatalog(data, state, player);
  const hashResult = applyCatalogHash(data, state);
  if (search && hashResult.scrollTo) search.value = "";
  render(data, state);
  player.sync();
  if (hashResult.scrollTo) {
    requestAnimationFrame(() => scrollToEntry(hashResult.scrollTo));
  }
  if (hashResult.startRadio) player.startRadio();

  window.addEventListener("hashchange", () => {
    const next = applyCatalogHash(data, state);
    if (search && !state.query) search.value = "";
    render(data, state);
    player.sync();
    if (next.scrollTo) requestAnimationFrame(() => scrollToEntry(next.scrollTo));
    if (next.startRadio) player.startRadio();
  });
}

main();
