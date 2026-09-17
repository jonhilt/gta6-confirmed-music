const TIER_LABEL = {
  official_promo: "Official promo",
  rockstar_named: "Rockstar-named",
  artist_reported: "Artist-reported",
};

const TIER_ORDER = ["official_promo", "rockstar_named", "artist_reported"];

const TIER_SECTION_NUM = {
  official_promo: "01",
  rockstar_named: "02",
  artist_reported: "03",
};

const TIER_COPY = {
  official_promo:
    "Audio from Rockstar trailers, the Extended Look, and Grand Theft Auto VI: The Album. Trailer cues play in the official video; album rows open the source list.",
  rockstar_named: "Rockstar staff named the artist in an interview. The track may still be unknown.",
  artist_reported:
    "Artist or fan-account claims. We want a link from the artist before treating a row as solid.",
};

const EVIDENCE_HEADLINE = {
  official_promo: "Publisher-backed promo credit, with linked sources.",
  rockstar_named: "An artist mention. Not a song credit.",
  artist_reported_needs: "A reported teaser. Proof still pending.",
  artist_reported: "Artist-reported claim with linked sources.",
};

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

function formatCueLine(entry) {
  const key = entry.appearanceKey;
  let slot;
  if (key === "trailer1") slot = "Trailer 1 · 04 Dec 2023";
  else if (key === "trailer2") slot = "Trailer 2 · 06 May 2025";
  else if (key === "extendedLook") slot = "Extended Look · 27 Aug 2026";
  else if (key === "the_album") slot = "The Album · 17 Sep 2026";
  else if (key === "interview") slot = "Named by Rockstar · Aug 2026";
  else if (key === "artist_claim") slot = "Artist teaser · Sep 2026";
  else slot = entry.appearance;

  if (entry.tier === "official_promo" && entry.cueSeconds != null) {
    return `${slot} · ${formatTimestamp(entry.cueSeconds)}`;
  }
  return slot;
}

function youtubeWatchUrl(url, startSeconds) {
  if (!url || startSeconds == null || startSeconds < 0) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("t", String(Math.floor(startSeconds)));
    return u.toString();
  } catch {
    return url;
  }
}

function formatPanelEyebrow(entry) {
  const tier = TIER_LABEL[entry.tier].toUpperCase();
  if (entry.tier === "official_promo") {
    const slot =
      entry.appearanceKey === "trailer1"
        ? "Trailer 1"
        : entry.appearanceKey === "trailer2"
          ? "Trailer 2"
          : entry.appearanceKey === "extendedLook"
            ? "Extended Look"
            : entry.appearanceKey === "the_album"
              ? "The Album"
              : entry.appearance;
    return `${tier} / ${slot}`;
  }
  return tier;
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

function sourceRole(label, entry) {
  const lower = label.toLowerCase();
  if (entry.status === "needs_primary_source" && lower.includes("videotech")) {
    return "Discovery only—not proof.";
  }
  if (lower.includes("dazed")) return "Primary interview source.";
  if (lower.includes("rockstar youtube")) return "Official publisher video.";
  if (lower.includes("rockstar games on x") || lower.includes("the album official store")) {
    return "Official publisher announcement.";
  }
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
  if (entry.status === "needs_primary_source") return EVIDENCE_HEADLINE.artist_reported_needs;
  return EVIDENCE_HEADLINE.artist_reported;
}

function externalIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6V3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-6h-2v6H5V5Z"/></svg>`;
}

function chevronIcon(up) {
  const d = up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6";
  return `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
}

function playIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
}

function renderSourceList(entry) {
  return (entry.sources || [])
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

function renderEmbeddedVideoShell(video, entry, loaded) {
  const videoLabel = video.label.replace(/^Rockstar — /, "GTA VI · ");

  if (loaded) {
    return `<div class="video-shell" data-video-shell="${escapeHtml(entry.id)}">
      <iframe
        title="${escapeHtml(video.label)}"
        src="https://www.youtube-nocookie.com/embed/${escapeHtml(video.id)}?autoplay=1&start=${video.start}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>`;
  }

  return `<div class="video-shell" data-video-shell="${escapeHtml(entry.id)}">
    <div class="video-placeholder">
      <div class="video-placeholder-icon">${playIcon()}</div>
      <p class="video-placeholder-title">${escapeHtml(videoLabel)}</p>
      <p class="video-placeholder-copy">Official YouTube player loads here</p>
    </div>
  </div>`;
}

function renderExternalVideoShell(video, entry) {
  const videoLabel = video.label.replace(/^Rockstar — /, "GTA VI · ");
  const watchUrl = youtubeWatchUrl(video.url, video.start);
  const cta =
    entry.cueSeconds != null
      ? `Play on YouTube at ${formatTimestamp(entry.cueSeconds)}`
      : "Play on YouTube";

  return `<a
      class="video-shell video-shell--external"
      data-video-shell="${escapeHtml(entry.id)}"
      href="${escapeHtml(watchUrl)}"
      rel="noopener noreferrer"
      target="_blank"
    >
      <div class="video-placeholder">
        <div class="video-placeholder-icon">${playIcon()}</div>
        <p class="video-placeholder-title">${escapeHtml(videoLabel)}</p>
        <span class="video-open-cta">${escapeHtml(cta)} ${externalIcon()}</span>
        <p class="video-placeholder-copy">Age-restricted on YouTube — opens on youtube.com at the verified cue.</p>
      </div>
    </a>`;
}

function renderPlayerPanel(entry, data, artists, loaded) {
  const video = videoMeta(data, entry);
  const trackTitle = entry.track ? escapeHtml(entry.track) : "Track not specified";
  const artistLine = escapeHtml(entry.artists.join(", "));
  const cueVerified = entry.cueSeconds != null;
  const cueNote = cueVerified
    ? `Verified cue at ${formatTimestamp(entry.cueSeconds)} on Rockstar YouTube.`
    : "Cue time awaiting verification.\nOpens from the beginning for now.";
  const external = Boolean(video?.embedRestricted);
  const videoShell = video
    ? external
      ? renderExternalVideoShell(video, entry)
      : renderEmbeddedVideoShell(video, entry, loaded)
    : "";

  return `
    <div class="row-panel" id="panel-${escapeHtml(entry.id)}" data-panel-for="${escapeHtml(entry.id)}">
      <div class="player-layout">
        ${videoShell}
        <div class="panel-context">
          <p class="panel-eyebrow">${escapeHtml(formatPanelEyebrow(entry))}</p>
          <p class="panel-track-title">${trackTitle}${entry.year ? ` (${entry.year})` : ""}</p>
          <p class="panel-artist">${artistLine}</p>
          <p class="panel-meta">${escapeHtml(video?.label || entry.appearance)}</p>
          <p class="panel-cue-note">${escapeHtml(cueNote)}</p>
          ${
            video && !external
              ? `<a class="panel-youtube-link" href="${escapeHtml(youtubeWatchUrl(video.url, video.start))}" rel="noopener noreferrer" target="_blank">
                  Watch on YouTube ${externalIcon()}
                </a>`
              : ""
          }
        </div>
      </div>
      <p class="playback-note">
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V6h2Z"/></svg>
        ${
          external
            ? "Extended Look plays on YouTube. Expanding another track closes this panel."
            : "One video at a time. Playing another track closes this player."
        }
      </p>
    </div>`;
}

function renderDetailsPanel(entry, data, artists) {
  const headline = evidenceHeadline(entry);
  const body = evidenceSummary(entry, artists);
  const blurb = entry.artists
    .map((name) => artists[name])
    .filter(Boolean)
    .slice(0, 1)
    .map(
      (rec) =>
        `<p class="evidence-body">${escapeHtml(rec.blurb)} <a href="${escapeHtml(rec.cite)}" rel="noopener noreferrer">cite</a></p>`
    )
    .join("");

  return `
    <div class="row-panel" id="panel-${escapeHtml(entry.id)}" data-panel-for="${escapeHtml(entry.id)}">
      <div class="row-panel-inner">
        <div>
          <p class="panel-eyebrow">Evidence summary</p>
          <h3 class="evidence-headline">${escapeHtml(headline)}</h3>
          <p class="evidence-body">${escapeHtml(body)}</p>
          ${blurb}
          <p class="evidence-disclosure">Summary of the linked reporting—not a direct quotation.</p>
        </div>
        <div class="source-list-wrap">
          <p class="panel-eyebrow">Source references</p>
          <div class="source-list">${renderSourceList(entry)}</div>
        </div>
      </div>
    </div>`;
}

function rowActions(entry, expanded, mode) {
  const video = videoMeta(window.__catalogData, entry);
  if (entry.tier === "official_promo" && video) {
    const open = !(expanded && mode === "player");
    const label = open ? "Play video" : "Close";
    const icon = open ? playIcon() : chevronIcon(true);
    return `
      <button
        type="button"
        class="row-action"
        data-action="toggle-player"
        data-id="${escapeHtml(entry.id)}"
        aria-expanded="${String(!open)}"
      >
        ${icon}<span class="row-action-label">${label}</span>
      </button>`;
  }

  const count = (entry.sources || []).length;
  const open = !(expanded && mode === "details");
  const label = open ? `${count} source${count === 1 ? "" : "s"}` : "Close";
  const icon = open ? chevronIcon(false) : chevronIcon(true);
  return `
    <button
      type="button"
      class="row-action"
      data-action="toggle-details"
      data-id="${escapeHtml(entry.id)}"
      aria-expanded="${String(!open)}"
    >
      ${icon}<span class="row-action-label">${label}</span>
    </button>`;
}

function renderRow(entry, indexNum, state) {
  const expanded = state.expandedId === entry.id;
  const mode = state.expandedMode;
  const track = entry.track
    ? `<p class="row-track">“${escapeHtml(entry.track)}”</p>`
    : `<p class="row-track is-empty">Track not specified</p>`;

  const activeClass = expanded ? " is-active" : "";
  const panel =
    expanded && mode === "player"
      ? renderPlayerPanel(entry, state.data, state.data.artists, state.playerLoaded)
      : expanded && mode === "details"
        ? renderDetailsPanel(entry, state.data, state.data.artists)
        : "";

  return `
    <article class="index-row index-row--${entry.tier}${activeClass}" data-id="${escapeHtml(entry.id)}">
      <div class="row-summary">
        <span class="row-num">${String(indexNum).padStart(2, "0")}</span>
        <div class="row-identity">
          <h3 class="row-artist">${entry.artists.map(escapeHtml).join(", ")}</h3>
          <p class="row-cue">${escapeHtml(formatCueLine(entry))}</p>
        </div>
        ${track}
        <div class="row-actions">${rowActions(entry, expanded, mode)}</div>
      </div>
      ${panel}
    </article>`;
}

function matchesQuery(entry, q) {
  if (!q) return true;
  const hay = [...entry.artists, entry.track || "", entry.appearance, entry.note || ""]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function filteredEntries(data, state) {
  return data.entries.filter((e) => {
    if (state.tier !== "all" && e.tier !== state.tier) return false;
    return matchesQuery(e, state.query.trim().toLowerCase());
  });
}

function render(data, state, options = {}) {
  state.data = data;
  window.__catalogData = data;
  const root = $("#catalog");
  const filtered = filteredEntries(data, state);
  const total = data.entries.length;
  const scrollY = options.preserveScroll ? window.scrollY : null;

  const awaitingPrimary = data.entries.filter(
    (e) => e.status === "needs_primary_source"
  ).length;
  $("#hero-kicker").textContent = `${total} entries · Updated ${data.updated}`;
  const introMeta = $("#intro-meta");
  if (introMeta) {
    introMeta.textContent =
      awaitingPrimary > 0
        ? `${awaitingPrimary} artist-reported row${awaitingPrimary === 1 ? "" : "s"} still need a primary link`
        : "";
  }

  if (!filtered.length) {
    root.innerHTML = `<p class="empty">No rows match that filter.</p>`;
    return;
  }

  let globalNum = 0;
  const chunks = [];

  for (const tier of TIER_ORDER) {
    if (state.tier !== "all" && state.tier !== tier) continue;
    const rows = filtered.filter((e) => e.tier === tier);
    if (!rows.length) continue;

    const sectionRows = [];

    if (tier === "artist_reported") {
      const solid = rows.filter((e) => e.status !== "needs_primary_source");
      const waiting = rows.filter((e) => e.status === "needs_primary_source");

      const renderWaitingRows = () =>
        waiting
          .map((entry) => {
            globalNum += 1;
            return renderRow(entry, globalNum, state);
          })
          .join("");

      let bodyHtml = "";
      if (solid.length) {
        bodyHtml = `<div class="index-list">${solid
          .map((entry) => {
            globalNum += 1;
            return renderRow(entry, globalNum, state);
          })
          .join("")}</div>`;
      }

      if (waiting.length) {
        if (solid.length) {
          bodyHtml += `
            <div class="subsection">
              <h3 class="subsection-title">Awaiting primary source</h3>
              <p class="subsection-copy">Discovery breadcrumbs only. Not Rockstar-verified soundtrack credits.</p>
              <div class="index-list">${renderWaitingRows()}</div>
            </div>`;
        } else {
          bodyHtml = `<div class="index-list">${renderWaitingRows()}</div>`;
        }
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
      continue;
    }

    for (const entry of rows) {
      globalNum += 1;
      sectionRows.push(renderRow(entry, globalNum, state));
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
        <div class="index-list">${sectionRows.join("")}</div>
      </section>`);
  }

  root.innerHTML = chunks.join("");

  if (scrollY != null) {
    window.scrollTo(0, scrollY);
  }
}

function closeExpanded(state) {
  state.expandedId = null;
  state.expandedMode = null;
  state.playerLoaded = false;
}

function openEntry(state, id, mode) {
  if (state.expandedId === id && state.expandedMode === mode) {
    closeExpanded(state);
    return;
  }
  state.expandedId = id;
  state.expandedMode = mode;
  state.playerLoaded = mode === "player";
}

function bindCatalog(data, state) {
  const root = $("#catalog");

  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === "toggle-player") {
      openEntry(state, id, "player");
    } else if (action === "toggle-details") {
      openEntry(state, id, "details");
    }
    render(data, state, { preserveScroll: true });
  });
}

async function main() {
  const res = await fetch("data/entries.json", { cache: "no-store" });
  if (!res.ok) {
    $("#catalog").innerHTML = `<p class="empty">Could not load data/entries.json (${res.status}).</p>`;
    return;
  }

  const data = await res.json();
  const state = {
    query: "",
    tier: "all",
    expandedId: null,
    expandedMode: null,
    playerLoaded: false,
    data,
  };

  const search = $("#search");
  search.addEventListener("input", () => {
    state.query = search.value;
    closeExpanded(state);
    render(data, state);
  });

  document.querySelectorAll(".tier-key").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      const tier = btn.dataset.tier;
      const next = state.tier === tier ? "all" : tier;
      state.tier = next;
      closeExpanded(state);
      document.querySelectorAll(".tier-key").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.tier === next));
      });
      render(data, state);
      if (next !== "all") {
        document.getElementById(`tier-${next}`)?.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  bindCatalog(data, state);
  render(data, state);
}

main();
