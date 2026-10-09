const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup({ manualReady = false, stubRender = true } = {}) {
  const nodes = new Map();
  const node = () => ({ dataset: {}, classList: { values: new Set(), toggle(name, on) { on ? this.values.add(name) : this.values.delete(name); } }, replaceChildren() {}, appendChild() {} });
  const context = {
    queueMicrotask, URL, console, loads: [], location: { origin: 'http://localhost:8000' },
    setInterval: () => 1, clearInterval() {}, setTimeout: (fn) => fn(),
    document: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, createElement: node },
    data: JSON.parse(fs.readFileSync('docs/data/entries.json', 'utf8')),
  };
  context.window = { YT: { PlayerState: { ENDED: 0, PLAYING: 1 }, Player: class {
    constructor(id, options) {
      context.events = options.events;
      context.ready = () => { this.isReady = true; options.events.onReady(); };
      if (!manualReady) queueMicrotask(context.ready);
    }
    loadVideoById(video) { assert.ok(this.isReady, 'must wait for onReady'); context.loaded = video; context.loads.push(video); }
    pauseVideo() {}
  } } };
  context.nodes = nodes;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('docs/assets/app.js', 'utf8').replace(/main\(\);\s*$/, ''), context);
  vm.runInContext(`loadYouTubeApi = async () => {}; loadSpotifyApi = async () => null;${stubRender ? ' render = () => {};' : ''}`, context);
  context.state = { data: context.data, provider: 'youtube', sourcePreference: 'full', videoSource: 'full', radioMode: false };
  context.player = vm.runInContext('playerController(state)', context);
  return context;
}

test('next from a full track advances to the following catalog track, not Trailer 1', async () => {
  const c = setup();
  await c.player.playEntry('t1-love-is-a-long-road');
  await c.player.playNextVideo();
  assert.equal(c.state.playingId, 't2-thunder-island');
  assert.equal(c.state.sourcePreference, 'full');
});

test('trailer mode advances to the next distinct trailer and keeps cue tracking', async () => {
  const c = setup();
  await c.player.playEntry('t1-love-is-a-long-road');
  await c.player.setProvider('trailer');
  await c.player.playNextVideo();
  assert.equal(c.state.playingId, 't2-thunder-island');
  assert.equal(c.loaded.videoId, 'VQRLujxTm3c');
  assert.equal(vm.runInContext("entryAtTime(data, 'VQRLujxTm3c', 64).id", c), 't2-hot-together');
});

test('full-track radio visits all official YouTube tracks in catalog order and wraps once', async () => {
  const c = setup();
  const expected = c.data.entries.filter((entry) => entry.youtubeVideoId);
  assert.ok(expected.some((entry) => entry.id === 'radio-flash-fm-midnight-sun-girls-trip'));
  await c.player.startRadio();
  for (const entry of expected) {
    assert.equal(c.state.playingId, entry.id);
    assert.equal(c.loaded.videoId, entry.youtubeVideoId);
    assert.equal(c.state.videoSource, 'full');
    await c.player.playNextVideo();
  }
  assert.equal(c.state.playingId, expected[0].id);
});

test('trailer choice persists and Extended Look keeps its restriction overlay', async () => {
  const c = setup();
  await c.player.playEntry('t1-love-is-a-long-road');
  await c.player.setProvider('trailer');
  await c.player.playEntry('el-pop-bottles');
  assert.equal(c.state.videoSource, 'trailer');
  assert.equal(c.state.radioMode, false);
  await c.player.playNextVideo();
  assert.equal(c.state.playingId, 'ar-travis-scott');
  assert.equal(c.state.sourcePreference, 'trailer');
});

async function initialized(context) {
  for (let i = 0; i < 20 && !context.ready; i++) await Promise.resolve();
  assert.ok(context.ready, 'player was constructed');
}

test('concurrent selections wait for readiness and only load the latest track', async () => {
  const c = setup({ manualReady: true });
  const first = c.player.playEntry('t1-love-is-a-long-road');
  await initialized(c);
  const second = c.player.playEntry('t2-thunder-island');
  c.ready();
  await Promise.all([first, second]);
  assert.deepEqual(c.loads.map(v => v.videoId), ['EI0Tt3UZ5jc']);
});

test('Spotify selection invalidates a pending YouTube load', async () => {
  const c = setup({ manualReady: true });
  const pending = c.player.playEntry('ar-travis-scott');
  await initialized(c);
  await c.player.setProvider('spotify');
  c.ready();
  await pending;
  assert.equal(c.loads.length, 0);
  assert.equal(c.state.provider, 'spotify');
});

test('YouTube errors stop radio and expose a fallback instead of retrying forever', async () => {
  const c = setup();
  await c.player.startRadio();
  c.events.onError({ data: 150 });
  await Promise.resolve();
  assert.equal(c.state.radioMode, false);
  assert.equal(c.loads.length, 1);
  assert.equal(c.state.provider, 'youtube');
  assert.match(c.nodes.get('#dock-empty').innerHTML, /Not playable here/);
  assert.match(c.nodes.get('#dock-empty').innerHTML, /Open on YouTube/);
  assert.equal(c.nodes.get('#dock-empty').hidden, false);
});

test('YouTube embed errors 100/101/150 switch to Spotify when the row has a track id', async () => {
  const c = setup();
  await c.player.playEntry('radio-the-chamber-106-6-raining-blood');
  assert.equal(c.state.provider, 'youtube');
  assert.equal(c.loaded.videoId, 'Gy3BOmvLf2w');
  for (const code of [100, 101, 150]) {
    c.state.provider = 'youtube';
    c.state.radioMode = true;
    c.events.onError({ data: code });
    await Promise.resolve();
    assert.equal(c.state.provider, 'spotify');
    assert.equal(c.state.radioMode, false);
    assert.equal(c.state.playingId, 'radio-the-chamber-106-6-raining-blood');
    assert.equal(c.nodes.get('#spotify-host').hidden, false);
    assert.equal(c.nodes.get('#dock-empty').hidden, true);
  }
  c.state.provider = 'youtube';
  c.events.onError({ data: 5 });
  await Promise.resolve();
  assert.equal(c.state.provider, 'youtube');
  assert.match(c.nodes.get('#dock-empty').innerHTML, /Not playable here/);
});

test('Play uses Spotify when a row has no YouTube id', async () => {
  const c = setup();
  await c.player.playEntry('radio-the-chamber-106-6-i');
  assert.equal(c.state.playingId, 'radio-the-chamber-106-6-i');
  assert.equal(c.state.provider, 'spotify');
  assert.equal(c.state.radioMode, false);
  assert.equal(c.loads.length, 0);
  assert.equal(c.nodes.get('#spotify-host').hidden, false);
});

test('visualiser only animates during YouTube playback and stops on pause or error', async () => {
  const c = setup();
  await c.player.playEntry('t1-love-is-a-long-road');
  const graphic = c.nodes.get('.hero-graphic');
  assert.equal(graphic.classList.values.has('is-playing'), false);
  c.events.onStateChange({ data: 1 });
  assert.equal(graphic.classList.values.has('is-playing'), true);
  c.events.onStateChange({ data: 2 });
  assert.equal(graphic.classList.values.has('is-playing'), false);
  c.events.onStateChange({ data: 1 });
  c.events.onError({ data: 150 });
  assert.equal(graphic.classList.values.has('is-playing'), false);
});

test('visualiser follows Spotify playback and ignores events after switching away', async () => {
  const c = setup();
  c.spotifyEvents = {};
  vm.runInContext('loadSpotifyApi = async () => ({ createController(mount, options, callback) { callback({ destroy() {}, addListener(name, fn) { spotifyEvents[name] = fn; } }); } });', c);
  await c.player.playEntry('ar-travis-scott');
  await c.player.setProvider('spotify');
  const graphic = c.nodes.get('.hero-graphic');
  assert.equal(graphic.classList.values.has('is-playing'), false);
  c.spotifyEvents.playback_update({ data: { isPaused: false, isBuffering: false } });
  assert.equal(graphic.classList.values.has('is-playing'), true);
  c.spotifyEvents.playback_update({ data: { isPaused: true, isBuffering: false } });
  assert.equal(graphic.classList.values.has('is-playing'), false);
  await c.player.setProvider('full');
  c.spotifyEvents.playback_update({ data: { isPaused: false, isBuffering: false } });
  assert.equal(graphic.classList.values.has('is-playing'), false);
});

test('radio rows share station sources and play official Spotify or YouTube ids', () => {
  const c = setup();
  const radio = c.data.entries.filter((e) => String(e.appearanceKey).startsWith('radio_'));
  assert.equal(radio.length, 18);
  assert.equal(radio.every((e) => e.previewSource === 'spotify' && e.spotifyTrackId), true);
  const gye = radio.find((e) => e.id === 'radio-afrobank-fm-gye-wani');
  assert.equal(gye.youtubeVideoId, undefined);
  const sabbath = radio.find((e) => e.id === 'radio-the-chamber-106-6-i');
  assert.equal(sabbath.youtubeVideoId, undefined);
  assert.equal(sabbath.spotifyTrackId, '7CAuk3iMezAKo58pvwBGQC');
  const slayer = radio.find((e) => e.id === 'radio-the-chamber-106-6-raining-blood');
  assert.equal(slayer.youtubeVideoId, 'Gy3BOmvLf2w');
  assert.match(gye.appleMusicUrl, /music\.apple\.com\/us\//);
  const midnight = radio.find((e) => e.id === 'radio-flash-fm-midnight-sun-girls-trip');
  assert.equal(midnight.spotifyTrackId, '2FHGYrQEmuWGX24QoQtQ13');
  assert.equal(midnight.youtubeVideoId, 'BkGaKI7zwmg');
  const html = vm.runInContext(`(() => {
    const entry = data.entries.find(e => e.id === 'radio-cocoteo-fm-eoo');
    state.expandedId = entry.id;
    return renderRow(entry, 1, state);
  })()`, c);
  assert.match(html, /id="radio-cocoteo-fm-eoo"/);
  assert.match(html, /Cocoteo FM · Radio preview · 8 Oct 2026/);
  assert.match(html, /Shared station sources/);
  assert.match(html, /Official publisher station page/);
  assert.match(html, /row-action--play/);
  assert.match(html, /Sources/);
  const midnightHtml = vm.runInContext(`(() => {
    const entry = data.entries.find(e => e.id === 'radio-flash-fm-midnight-sun-girls-trip');
    state.expandedId = entry.id;
    return renderRow(entry, 1, state);
  })()`, c);
  assert.match(midnightHtml, /id="radio-flash-fm-midnight-sun-girls-trip"/);
  assert.match(midnightHtml, /row-action--play/);
  assert.match(midnightHtml, /Official streaming page for this track/);
});

test('catalog hash opens the matching row and leaves #radio for the player', () => {
  const c = setup();
  c.location.hash = '#radio-flash-fm-midnight-sun-girls-trip';
  const result = vm.runInContext('applyCatalogHash(data, state)', c);
  assert.equal(c.state.expandedId, 'radio-flash-fm-midnight-sun-girls-trip');
  assert.equal(c.state.anchorId, 'radio-flash-fm-midnight-sun-girls-trip');
  assert.equal(result.scrollTo, 'radio-flash-fm-midnight-sun-girls-trip');
  assert.equal(result.startRadio, false);
  c.location.hash = '#radio';
  const radio = vm.runInContext('applyCatalogHash(data, state)', c);
  assert.equal(radio.startRadio, true);
  assert.equal(c.state.anchorId, null);
});

test('Rockstar album singles replace leak rows, alias old hashes, and hide the empty unconfirmed section', async () => {
  const c = setup({ stubRender: false });
  const leaks = c.data.entries.filter((e) => e.tier === 'unconfirmed_leak');
  assert.equal(leaks.length, 0);
  assert.equal(c.data.entries.length, 53);
  assert.equal(c.data.entries.filter((e) => e.tier !== 'unconfirmed_leak').length, 53);
  const catalog = JSON.stringify(c.data);
  assert.equal(catalog.includes('ItsNotDistinct'), false);
  assert.equal(catalog.includes('2107998030536527892'), false);
  assert.equal(catalog.includes('leak-fuerza-regida-suzuki'), false);
  assert.equal(catalog.includes('leak-cardi-b-track-19'), false);
  const suzuki = c.data.entries.find((e) => e.id === 'ar-fuerza-regida-suzuki');
  const cardi = c.data.entries.find((e) => e.id === 'ar-cardi-b-dont-chart');
  assert.equal(suzuki.track, 'Suzuki');
  assert.equal(suzuki.artists[0], 'Fuerza Regida');
  assert.equal(suzuki.appearanceKey, 'the_album');
  assert.equal(suzuki.tier, 'official_promo');
  assert.equal(suzuki.spotifyTrackId, '6VDw2mGBIa4csypjOhS6JT');
  assert.equal(suzuki.youtubeVideoId, 'wROPn_SFE5s');
  assert.equal(suzuki.appleMusicUrl, 'https://music.apple.com/gb/album/suzuki-from-gtavi-the-album-single/6820156381');
  assert.equal(cardi.track, "Don't Chart");
  assert.equal(cardi.track.includes('\u2019'), false);
  assert.equal(cardi.spotifyTrackId, '4NaBitL0J4PBSODIL1sUg7');
  assert.equal(cardi.youtubeVideoId, '0BxQ6hi3lXY');
  assert.equal(cardi.appleMusicUrl, 'https://music.apple.com/us/album/dont-chart/6812476961?i=6812477308');
  assert.equal(vm.runInContext("canPlay(data.entries.find(e => e.id === 'ar-fuerza-regida-suzuki'), data)", c), true);
  assert.equal(vm.runInContext("canPlay(data.entries.find(e => e.id === 'ar-cardi-b-dont-chart'), data)", c), true);
  const html = vm.runInContext(`(() => {
    state.tier = 'all';
    state.query = '';
    render(data, state);
    return document.querySelector('#catalog').innerHTML;
  })()`, c);
  assert.doesNotMatch(html, /id="tier-unconfirmed_leak"/);
  assert.doesNotMatch(html, /Not released/);
  assert.doesNotMatch(html, /row-badge--unconfirmed/);
  assert.match(html, /id="ar-fuerza-regida-suzuki"/);
  assert.match(html, /id="ar-cardi-b-dont-chart"/);
  assert.match(html, /row-action--play/);
  assert.doesNotMatch(html, /ItsNotDistinct/);
  assert.equal(c.nodes.get('.tier-key--leak').hidden, true);
  assert.match(c.nodes.get('#hero-kicker').textContent, /53 entries/);
  c.location.hash = '#leak-fuerza-regida-suzuki';
  const suzukiHash = vm.runInContext('applyCatalogHash(data, state)', c);
  assert.equal(suzukiHash.scrollTo, 'ar-fuerza-regida-suzuki');
  assert.equal(c.state.expandedId, 'ar-fuerza-regida-suzuki');
  c.location.hash = '#leak-cardi-b-track-19';
  const cardiHash = vm.runInContext('applyCatalogHash(data, state)', c);
  assert.equal(cardiHash.scrollTo, 'ar-cardi-b-dont-chart');
  await c.player.playEntry('ar-fuerza-regida-suzuki');
  assert.equal(c.state.playingId, 'ar-fuerza-regida-suzuki');
  assert.equal(c.state.provider, 'youtube');
  await c.player.playEntry('ar-cardi-b-dont-chart');
  assert.equal(c.state.playingId, 'ar-cardi-b-dont-chart');
  assert.equal(c.state.provider, 'youtube');
});

test('album grouping preserves evidence labels in the row and source panel', () => {
  const c = setup();
  const html = vm.runInContext(`(() => {
    const entry = data.entries.find(e => e.id === 'ar-travis-scott');
    state.expandedId = entry.id;
    return renderRow(entry, 22, state);
  })()`, c);
  assert.match(html, /class="row-evidence">Official promo</);
  assert.match(html, /The source \/ Official promo/);
  assert.equal(vm.runInContext("catalogSection(data.entries.find(e => e.id === 'ar-travis-scott'))", c), 'the_album');
});

test('catalog rows link to Radio and never render Rockstar embed iframes', () => {
  const c = setup({ stubRender: false });
  const html = vm.runInContext(`(() => {
    state.tier = 'all';
    state.query = '';
    render(data, state);
    return document.querySelector('#catalog').innerHTML;
  })()`, c);
  assert.match(html, /id="radio-flash-fm-midnight-sun-girls-trip"/);
  assert.match(html, /Hear it on Flash FM/);
  assert.match(html, /href="radio\/#flash-fm"/);
  assert.doesNotMatch(html, /rockstargames\.com\/VI\/music\/embed/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /data-action="load-station-embed"/);
  assert.doesNotMatch(html, /Official station preview/);
  assert.doesNotMatch(html, /\u2014/);
});

test('Radio view click-to-load Rockstar simple embeds and lists preview cues', () => {
  const c = setup({ stubRender: false });
  const html = vm.runInContext(`(() => {
    state.loadedStationEmbed = null;
    renderRadio(data, state);
    return document.querySelector('#radio-stations').innerHTML;
  })()`, c);
  assert.match(html, /id="flash-fm"/);
  assert.match(html, /Official station preview/);
  assert.match(html, /Hosted by Robyn and Alex/);
  assert.match(html, /Flash FM on Rockstar/);
  assert.match(html, /https:\/\/www\.rockstargames\.com\/VI\/music\/flash-fm/);
  assert.match(html, /at 0:10 in the preview/);
  assert.match(html, /data-action="load-station-embed"/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /yt-host|spotify-host|player-dock/);
  const loaded = vm.runInContext(`(() => {
    state.loadedStationEmbed = 'radio_flash_fm';
    renderRadio(data, state);
    return document.querySelector('#radio-stations').innerHTML;
  })()`, c);
  assert.match(loaded, /src="https:\/\/www\.rockstargames\.com\/VI\/music\/embed\/flash-fm\/simple"/);
  assert.match(loaded, /allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"/);
  assert.equal((loaded.match(/<iframe/g) || []).length, 1);
  assert.doesNotMatch(loaded, /rockstargames\.com\/VI\/music\/embed\/cocoteo-fm\/simple/);
  assert.doesNotMatch(loaded, /\u2014/);
});

test('radio and leak copy keeps official ids without em dashes or leak audio links', () => {
  const c = setup();
  const radio = c.data.entries.filter((e) => String(e.appearanceKey).startsWith('radio_'));
  const leaks = c.data.entries.filter((e) => e.tier === 'unconfirmed_leak');
  const singles = c.data.entries.filter((e) => ['ar-fuerza-regida-suzuki', 'ar-cardi-b-dont-chart'].includes(e.id));
  const stations = Object.values(c.data.stations);
  for (const entry of [...radio, ...leaks, ...singles]) {
    assert.equal(`${entry.note || ''}${entry.previewSource || ''}`.includes('\u2014'), false);
    for (const source of entry.sources || []) {
      assert.equal(`${source.label}${source.url}`.includes('\u2014'), false);
      assert.equal(/itsnotdistinct/i.test(source.url), false);
    }
  }
  for (const station of stations) {
    assert.equal(`${station.embedUrl}${station.previewPage}`.includes('\u2014'), false);
    assert.match(station.embedUrl, /^https:\/\/www\.rockstargames\.com\/VI\/music\/embed\/[a-z0-9-]+\/simple$/);
  }
  const copy = vm.runInContext('stationEmbedFrame(data.stations.radio_flash_fm, "radio_flash_fm", state)', c);
  assert.equal(copy.includes('\u2014'), false);
  assert.match(copy, /Load official player/);
  assert.match(copy, /Official station preview/);
});
