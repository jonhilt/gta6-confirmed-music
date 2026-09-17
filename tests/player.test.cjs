const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const nodes = new Map();
  const node = () => ({ dataset: {}, classList: { toggle() {} }, replaceChildren() {}, appendChild() {} });
  const context = {
    URL, console, location: { origin: 'http://localhost:8000' },
    setInterval: () => 1, clearInterval() {}, setTimeout: (fn) => fn(),
    document: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, createElement: node },
    data: JSON.parse(fs.readFileSync('docs/data/entries.json', 'utf8')),
  };
  context.window = { YT: { PlayerState: { ENDED: 0, PLAYING: 1 }, Player: class { loadVideoById(video) { context.loaded = video; } pauseVideo() {} } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('docs/assets/app.js', 'utf8').replace(/main\(\);\s*$/, ''), context);
  vm.runInContext('render = () => {}; loadYouTubeApi = async () => {};', context);
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

test('full-track radio visits all 26 tracks in catalog order and wraps once', async () => {
  const c = setup();
  const expected = c.data.entries.filter((entry) => entry.youtubeVideoId);
  assert.equal(expected.length, 26);
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
