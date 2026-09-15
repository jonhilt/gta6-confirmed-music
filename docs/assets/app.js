const TIER_LABEL = {
  official_promo: "Official promo",
  rockstar_named: "Rockstar-named",
  artist_reported: "Artist-reported",
};

const TIER_INDEX = {
  official_promo: "01",
  rockstar_named: "02",
  artist_reported: "03",
};

const TIER_ORDER = ["official_promo", "rockstar_named", "artist_reported"];

const TIER_COPY = {
  official_promo: "Audio heard in a publisher-posted trailer or extended look.",
  rockstar_named:
    "A Rockstar staff member named the artist in an interview. Not always a specific song.",
  artist_reported:
    "The artist or a channel they control claims involvement. Not Rockstar-verified.",
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
        `<a class="source-link" href="${escapeHtml(s.url)}" rel="noopener noreferrer"><span aria-hidden="true">↗</span> ${escapeHtml(s.label)}</a>`
    )
    .join("");
}

function formatUpdated(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const yy = String(d.getFullYear()).slice(-2);
  return `${months[d.getMonth()]} ’${yy}`;
}

function renderRow(entry) {
  const track = entry.track
    ? `<p class="track">“${escapeHtml(entry.track)}”</p>`
    : `<p class="track no-track">Track not specified</p>`;
  const awaiting = entry.status === "needs_primary_source";
  const badges = [`<span class="badge badge-${entry.tier}">${TIER_LABEL[entry.tier]}</span>`];
  if (entry.inUniverse) {
    badges.push(`<span class="badge badge-universe">In-universe</span>`);
  }
  return `
    <article class="row${awaiting ? " row-awaiting" : ""}" data-id="${escapeHtml(entry.id)}">
      <div class="row-top">
        <p class="artists">${entry.artists.map(escapeHtml).join(", ")}</p>
        <div class="badges">${badges.join("")}</div>
      </div>
      ${track}
      <p class="appearance">${escapeHtml(entry.appearance)}</p>
      ${entry.note ? `<p class="note">${escapeHtml(entry.note)}</p>` : ""}
      ${awaiting ? `<p class="needs-flag">Needs primary source</p>` : ""}
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

function fillSnapshot(data) {
  const counts = { official_promo: 0, rockstar_named: 0, artist_reported: 0 };
  for (const e of data.entries) {
    if (counts[e.tier] !== undefined) counts[e.tier] += 1;
  }
  $("#count-official").textContent = String(counts.official_promo);
  $("#count-named").textContent = String(counts.rockstar_named);
  $("#count-reported").textContent = String(counts.artist_reported);

  const waiting = data.entries.filter((e) => e.status === "needs_primary_source");
  const list = $("#awaiting-list");
  if (!waiting.length) {
    list.innerHTML = `<li>No waiting rows.</li>`;
    return;
  }
  list.innerHTML = waiting
    .map((e) => `<li>${e.artists.map(escapeHtml).join(", ")}</li>`)
    .join("");
}

function render(data, state) {
  const root = $("#catalog");
  const q = state.query.trim().toLowerCase();
  const filtered = data.entries.filter((e) => {
    if (state.tier !== "all" && e.tier !== state.tier) return false;
    return matchesQuery(e, q);
  });

  if (!filtered.length) {
    root.innerHTML = `<p class="empty">No rows match that search.</p>`;
    return;
  }

  const chunks = [];
  for (const tier of TIER_ORDER) {
    if (state.tier !== "all" && state.tier !== tier) continue;
    const rows = filtered.filter((e) => e.tier === tier);
    if (!rows.length) continue;
    const noun = rows.length === 1 ? "entry" : "entries";
    chunks.push(`
      <section class="section tier-${tier}" id="tier-${tier}">
        <div class="section-head">
          <div>
            <h2>
              <span class="tier-index">${TIER_INDEX[tier]}</span>
              ${TIER_LABEL[tier]}
            </h2>
            <p class="section-copy">${TIER_COPY[tier]}</p>
          </div>
          <p class="section-count">${rows.length} ${noun}</p>
        </div>
        <div class="list">${rows.map(renderRow).join("")}</div>
      </section>
    `);
  }

  root.innerHTML = chunks.join("");
}

async function main() {
  const catalog = $("#catalog");
  const res = await fetch("data/entries.json");
  if (!res.ok) {
    catalog.innerHTML = `<p class="empty">Could not load the dataset (${res.status}).</p>`;
    return;
  }
  const data = await res.json();
  const state = { query: "", tier: "all" };

  $("#entry-pill").textContent =
    `${data.entries.length} entries / updated ${formatUpdated(data.updated)}`;
  fillSnapshot(data);

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
