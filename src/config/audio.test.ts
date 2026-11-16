import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { BACKGROUND_TRACK, MUSIC_VOLUME } from "./audio.ts";

const publicDir = new URL("../../public/", import.meta.url);

test("music volume stays at a conservative level", () => {
  assert.ok(MUSIC_VOLUME > 0 && MUSIC_VOLUME <= 0.5);
});

test(
  "a configured track exists under public/audio with its source and licence recorded",
  { skip: BACKGROUND_TRACK === null && "no track configured yet, the Sound control stays disabled" },
  () => {
    const file = BACKGROUND_TRACK!.file;
    assert.match(file, /^audio\/[^/]+$/, "the track must sit directly in public/audio");
    assert.ok(existsSync(new URL(file, publicDir)), `public/${file} is missing`);

    const sources = new URL("audio/SOURCES.md", publicDir);
    assert.ok(existsSync(sources), "public/audio/SOURCES.md is missing");
    const text = readFileSync(sources, "utf8");
    assert.ok(text.includes(file.replace("audio/", "")), "SOURCES.md does not name the track file");
    assert.match(text, /licen[cs]e/i, "SOURCES.md does not record a licence");
  },
);
