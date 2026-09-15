const TIER_LABEL = {
  official_promo: "Official promo",
  rockstar_named: "Rockstar-named",
  artist_reported: "Artist-reported",
};

const TIER_ORDER = ["official_promo", "rockstar_named", "artist_reported"];

const TIER_COPY = {
  official_promo:
    "Audio heard in a Rockstar-published Trailer 1, Trailer 2, or Extended Look. Track IDs come from that video plus reputable write-ups (Polygon, Music Ally, GTA Wiki, NME).",
  rockstar_named:
    "A Rockstar staffer named the artist (or in-universe act) in an interview. That is not the same as a confirmed radio track unless a promo also used a specific song.",
  artist_reported:
    "The artist or a verified channel is said to have claimed involvement. These rows are not Rockstar-verified. Aggregator posts are discovery only until a primary artist link exists.",
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

function sourceList(sources) {
  return (sources || [])
    .map(
      (s) =>
        `<a href="${escapeHtml(s.url)}" rel="noopener noreferrer">${escapeHtml(s.label)}</a>`
    )
    .join("");
}

function artistBlurbs(entry, artists) {
  const seen = new Set();
  const bits = [];
  for (const name of entry.artists) {
    if (seen.has(name)) continue;
    seen.add(name);
    const rec = artists[name];
    if (!rec) continue;
    bits.push(
      `<p class="blurb">${escapeHtml(rec.blurb)} <a href="${escapeHtml(rec.cite)}" rel="noopener noreferrer">cite</a></p>`
    );
  }
  return bits.slice(0, 1).join("");
}

function renderRow(entry, artists) {
  const track = entry.track
    ? `<p class="track">“${escapeHtml(entry.track)}”${entry.year ? ` <span>(${entry.year})</span>` : ""}</p>`
    : `<p class="track no-track">No specific track attached</p>`;
  const awaiting = entry.status === "needs_primary_source";
  const badges = [
    `<span class="badge badge-${entry.tier}">${TIER_LABEL[entry.tier]}</span>`,
  ];
  if (awaiting) {
    badges.push(`<span class="badge badge-awaiting">Awaiting primary source</span>`);
  }
  if (entry.inUniverse) {
    badges.push(`<span class="badge badge-rockstar_named">In-universe</span>`);
  }
  return `
    <article class="row" data-id="${escapeHtml(entry.id)}">
      <div class="row-top">
        <h3 class="artists">${entry.artists.map(escapeHtml).join(", ")}</h3>
        <div>${badges.join(" ")}</div>
      </div>
      ${track}
      <p class="appearance">${escapeHtml(entry.appearance)}</p>
      ${entry.note ? `<p class="note">${escapeHtml(entry.note)}</p>` : ""}
      ${artistBlurbs(entry, artists)}
      <div class="sources">${sourceList(entry.sources)}</div>
    </article>
  `;
}

function matchesQuery(entry, q) {
  if (!q) return true;
  const hay = [...entry.artists, entry.track || "", entry.appearance, entry.note || ""]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function render(data, state) {
  const root = $("#catalog");
  const q = state.query.trim().toLowerCase();
  const filtered = data.entries.filter((e) => {
    if (state.tier !== "all" && e.tier !== state.tier) return false;
    return matchesQuery(e, q);
  });

  $("#count").textContent = `${filtered.length} shown / ${data.entries.length} in dataset`;
  $("#updated").textContent = `Dataset ${data.updated}`;

  if (!filtered.length) {
    root.innerHTML = `<p class="empty">No rows match that search.</p>`;
    return;
  }

  const chunks = [];
  for (const tier of TIER_ORDER) {
    if (state.tier !== "all" && state.tier !== tier) continue;
    const rows = filtered.filter((e) => e.tier === tier);
    if (!rows.length) continue;

    if (tier === "artist_reported") {
      const solid = rows.filter((e) => e.status !== "needs_primary_source");
      const waiting = rows.filter((e) => e.status === "needs_primary_source");
      chunks.push(`
        <section class="section" id="tier-${tier}">
          <h2>${TIER_LABEL[tier]}</h2>
          <p class="section-copy">${TIER_COPY[tier]}</p>
          ${
            solid.length
              ? `<div class="list">${solid.map((e) => renderRow(e, data.artists)).join("")}</div>`
              : `<p class="empty">No artist-reported rows with a primary source yet.</p>`
          }
          ${
            waiting.length
              ? `<div class="subsection">
                  <h3>Awaiting primary source</h3>
                  <p class="section-copy">Discovery breadcrumbs only. Do not treat these as Rockstar-verified soundtrack credits.</p>
                  <div class="list">${waiting.map((e) => renderRow(e, data.artists)).join("")}</div>
                </div>`
              : ""
          }
        </section>
      `);
      continue;
    }

    chunks.push(`
      <section class="section" id="tier-${tier}">
        <h2>${TIER_LABEL[tier]}</h2>
        <p class="section-copy">${TIER_COPY[tier]}</p>
        <div class="list">${rows.map((e) => renderRow(e, data.artists)).join("")}</div>
      </section>
    `);
  }

  root.innerHTML = chunks.join("");
}

async function main() {
  const res = await fetch("data/entries.json");
  if (!res.ok) {
    $("#catalog").innerHTML = `<p class="empty">Could not load data/entries.json (${res.status}).</p>`;
    return;
  }
  const data = await res.json();
  const state = { query: "", tier: "all" };

  const search = $("#search");
  search.addEventListener("input", () => {
    state.query = search.value;
    render(data, state);
  });

  document.querySelectorAll(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tier = btn.dataset.tier;
      document.querySelectorAll(".filter").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      render(data, state);
    });
  });

  render(data, state);
}

main();
