import assert from "node:assert/strict";
import { test } from "node:test";
import { createBackgroundMusic, type AudioLike, type MusicState, type VisibilityLike } from "./backgroundMusic.ts";

function fakeAudio(playResult: () => Promise<void> = () => Promise.resolve()) {
  const listeners = new Set<() => void>();
  const audio = {
    src: "",
    loop: false,
    volume: 1,
    preload: "",
    paused: true,
    plays: 0,
    play() {
      audio.plays += 1;
      audio.paused = false;
      return playResult();
    },
    pause() {
      audio.paused = true;
    },
    addEventListener: (_type: "error", listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: "error", listener: () => void) => void listeners.delete(listener),
    fireError: () => listeners.forEach(listener => listener()),
    listenerCount: () => listeners.size,
  };
  return audio satisfies AudioLike & Record<string, unknown>;
}

function fakeVisibility() {
  const listeners = new Set<() => void>();
  const page = {
    hidden: false,
    addEventListener: (_type: "visibilitychange", listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: "visibilitychange", listener: () => void) => void listeners.delete(listener),
    set(hidden: boolean) {
      (page as { hidden: boolean }).hidden = hidden;
      listeners.forEach(listener => listener());
    },
    listenerCount: () => listeners.size,
  };
  return page satisfies VisibilityLike & Record<string, unknown>;
}

function setup(playResult?: () => Promise<void>) {
  const audio = fakeAudio(playResult);
  const page = fakeVisibility();
  const states: MusicState[] = [];
  let created = 0;
  const music = createBackgroundMusic("audio/track.mp3", {
    volume: 0.3,
    onChange: state => states.push(state),
    createAudio: () => { created += 1; return audio; },
    visibility: page,
  });
  return { audio, page, states, music, created: () => created };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test("nothing is created or requested until the first toggle", () => {
  const { audio, music, created } = setup();
  assert.equal(music.state, "idle");
  assert.equal(created(), 0);
  assert.equal(audio.plays, 0);
});

test("the first toggle starts a quiet looping track and a second toggle pauses it", async () => {
  const { audio, music, states } = setup();
  music.toggle();
  await settle();
  assert.equal(audio.src, "audio/track.mp3");
  assert.equal(audio.loop, true);
  assert.equal(audio.volume, 0.3);
  assert.equal(music.state, "playing");
  music.toggle();
  assert.equal(music.state, "paused");
  assert.equal(audio.paused, true);
  music.toggle();
  assert.equal(music.state, "playing");
  assert.deepEqual(states, ["playing", "paused", "playing"]);
});

test("playback pauses while the page is hidden and resumes when it returns", async () => {
  const { audio, page, music } = setup();
  music.toggle();
  await settle();
  page.set(true);
  assert.equal(audio.paused, true);
  assert.equal(music.state, "playing");
  page.set(false);
  assert.equal(audio.paused, false);
  assert.equal(audio.plays, 2);
});

test("a hidden page does not start music that was never started or was paused", async () => {
  const { audio, page, music } = setup();
  page.set(true);
  page.set(false);
  assert.equal(audio.plays, 0);
  music.toggle();
  await settle();
  music.toggle();
  page.set(true);
  page.set(false);
  assert.equal(audio.plays, 1);
});

test("a start refused by the browser leaves the control usable", async () => {
  const refusal = () => Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
  const { music } = setup(refusal);
  music.toggle();
  await settle();
  assert.equal(music.state, "paused");
});

test("a file that fails to load ends in the failed state", async () => {
  const { audio, music, states } = setup();
  music.toggle();
  await settle();
  audio.fireError();
  assert.equal(music.state, "failed");
  assert.deepEqual(states, ["playing", "failed"]);
});

test("toggling after a failure retries with a fresh audio element", async () => {
  const created: ReturnType<typeof fakeAudio>[] = [];
  const page = fakeVisibility();
  const states: MusicState[] = [];
  const music = createBackgroundMusic("track.mp3", {
    volume: 0.5,
    onChange: state => states.push(state),
    createAudio: () => {
      const next = fakeAudio();
      created.push(next);
      return next;
    },
    visibility: page,
  });
  music.toggle();
  await settle();
  created[0].fireError();
  music.toggle();
  await settle();
  assert.equal(created.length, 2);
  assert.equal(created[0].listenerCount(), 0);
  assert.equal(created[0].src, "");
  assert.equal(created[1].plays, 1);
  assert.equal(music.state, "playing");
  assert.deepEqual(states, ["playing", "failed", "playing"]);
});

test("a rejection from the pause for a hidden page does not stop the resume", async () => {
  let rejectStart: (error: Error) => void = () => {};
  const pending = () => new Promise<void>((_resolve, reject) => { rejectStart = reject; });
  const { audio, page, music } = setup(pending);
  music.toggle();
  page.set(true);
  rejectStart(Object.assign(new Error("interrupted"), { name: "AbortError" }));
  await settle();
  assert.equal(music.state, "playing");
  page.set(false);
  assert.equal(audio.plays, 2);
});

test("a playback error that is not a refusal also ends in the failed state", async () => {
  const broken = () => Promise.reject(Object.assign(new Error("no source"), { name: "NotSupportedError" }));
  const { music } = setup(broken);
  music.toggle();
  await settle();
  assert.equal(music.state, "failed");
});

test("dispose stops the audio, releases listeners and silences later changes", async () => {
  const { audio, page, music, states } = setup();
  music.toggle();
  await settle();
  music.dispose();
  assert.equal(audio.paused, true);
  assert.equal(audio.src, "");
  assert.equal(audio.listenerCount(), 0);
  assert.equal(page.listenerCount(), 0);
  music.toggle();
  assert.deepEqual(states, ["playing"]);
});
