// Capture README screenshots and GIFs from the running app.
//
// Usage:  APP_URL=http://localhost:5199 node capture.mjs [hero|learning|dictionary|dictation|stills|all]
// Output: ../docs/images/*.{gif,png}
//
// GIFs are encoded in pure JS (gifenc) so no ffmpeg/ImageMagick is required.

import { chromium } from 'playwright';
import gifencPkg from 'gifenc';
import pngjsPkg from 'pngjs';
const { GIFEncoder, quantize, applyPalette } = gifencPkg;
const { PNG } = pngjsPkg;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.APP_URL || 'http://localhost:5199';
const OUT = path.resolve(__dirname, '../docs/images');
const GIF_VIEWPORT = { width: 1080, height: 675 };
const STILL_VIEWPORT = { width: 1440, height: 900 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function decodePng(buf) {
    const png = PNG.sync.read(buf);
    return { data: new Uint8Array(png.data), width: png.width, height: png.height };
}

async function captureFrames(page, { seconds, fps, clip, onTick }) {
    const total = Math.round(seconds * fps);
    const interval = 1000 / fps;
    const frames = [];
    for (let i = 0; i < total; i++) {
        const t0 = Date.now();
        if (onTick) await onTick(i / fps, i);
        const buf = await page.screenshot({ type: 'png', ...(clip ? { clip } : {}) });
        frames.push(decodePng(buf));
        const elapsed = Date.now() - t0;
        if (elapsed < interval) await sleep(interval - elapsed);
    }
    return frames;
}

function encodeGif(frames, fps, outFile) {
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    for (const { data, width, height } of frames) {
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, width, height, { palette, delay });
    }
    gif.finish();
    fs.writeFileSync(outFile, gif.bytes());
    const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
    console.log(`  ✓ ${path.basename(outFile)} (${frames.length} frames, ${mb} MB)`);
}

async function newPage(browser, viewport, scale = 1) {
    const ctx = await browser.newContext({
        viewport,
        deviceScaleFactor: scale,
        colorScheme: 'dark',
        reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();
    return page;
}

/** Drive the mouse along a gentle arc so the spotlight visibly follows. */
function mousePath(t, vw, vh) {
    const x = vw / 2 + Math.sin(t * 0.9) * vw * 0.3;
    const y = vh * 0.4 + Math.cos(t * 0.7) * vh * 0.18;
    return { x, y };
}

async function openFirstHistoryVideo(page) {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // Prefer a card that actually has a thumbnail (skips broken/odd entries)
    let card = page.getByTestId('history-card').filter({ has: page.locator('img') }).first();
    if (await card.count() === 0) card = page.getByTestId('history-card').first();
    await card.waitFor({ state: 'visible', timeout: 15000 });
    await card.click();
    // Transcript blocks appear when the video is loaded from history
    await page.locator('[data-index="0"]').waitFor({ state: 'visible', timeout: 20000 });
    await sleep(2500); // allow the YouTube player to spin up
}

// --- Scenes -----------------------------------------------------------------

async function sceneHero(browser) {
    console.log('▶ hero.gif — aurora + mouse spotlight');
    const page = await newPage(browser, GIF_VIEWPORT);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(1200);
    const frames = await captureFrames(page, {
        seconds: 6, fps: 9,
        onTick: async (t) => {
            const { x, y } = mousePath(t, GIF_VIEWPORT.width, GIF_VIEWPORT.height);
            await page.mouse.move(x, y);
        },
    });
    encodeGif(frames, 9, path.join(OUT, 'hero.gif'));
    await page.context().close();
}

async function sceneLearning(browser) {
    console.log('▶ learning.gif — synced transcript + click-to-seek');
    const page = await newPage(browser, GIF_VIEWPORT);
    await openFirstHistoryVideo(page);

    await sleep(5000); // let playback get past the long opening sentence

    const frames = await captureFrames(page, {
        seconds: 10, fps: 8,
        onTick: async (t, i) => {
            // Click a sentence mid-way to show click-to-seek
            if (i === 28) {
                const blocks = page.locator('[data-index]');
                const count = await blocks.count();
                const target = Math.min(8, count - 1);
                await blocks.nth(target).click().catch(() => {});
            }
        },
    });
    encodeGif(frames, 8, path.join(OUT, 'learning.gif'));
    await page.context().close();
}

async function sceneDictionary(browser) {
    console.log('▶ dictionary.gif — click a word, get IPA + definition');
    const page = await newPage(browser, GIF_VIEWPORT);
    await openFirstHistoryVideo(page);

    // Clip to the transcript column (right half)
    const clip = { x: GIF_VIEWPORT.width / 2, y: 64, width: GIF_VIEWPORT.width / 2, height: GIF_VIEWPORT.height - 64 };
    // Pick a real word (≥6 letters) in one of the first sentences
    const word = page.locator('[data-index="1"] p span span').filter({ hasText: /[A-Za-z]{6,}/ }).first();

    const frames = await captureFrames(page, {
        seconds: 7, fps: 8, clip,
        onTick: async (_t, i) => {
            if (i === 8) await word.click().catch(() => {});
        },
    });
    encodeGif(frames, 8, path.join(OUT, 'dictionary.gif'));
    await page.context().close();
}

async function sceneDictation(browser) {
    console.log('▶ dictation.gif — blur English, click to reveal');
    const page = await newPage(browser, GIF_VIEWPORT);
    await openFirstHistoryVideo(page);

    const clip = { x: GIF_VIEWPORT.width / 2, y: 64, width: GIF_VIEWPORT.width / 2, height: GIF_VIEWPORT.height - 64 };
    const frames = await captureFrames(page, {
        seconds: 7, fps: 8, clip,
        onTick: async (_t, i) => {
            if (i === 6) await page.getByText('听写模式').click().catch(() => {});
            if (i === 26) {
                const en = page.locator('[data-index="2"] p').first();
                await en.click().catch(() => {});
            }
        },
    });
    encodeGif(frames, 8, path.join(OUT, 'dictation.gif'));
    await page.context().close();
}

async function sceneStills(browser) {
    console.log('▶ stills — home + learning @2x');
    const page = await newPage(browser, STILL_VIEWPORT, 2);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(1500);
    await page.mouse.move(STILL_VIEWPORT.width * 0.55, STILL_VIEWPORT.height * 0.35);
    await sleep(400);
    await page.screenshot({ path: path.join(OUT, 'home_screenshot.png') });
    console.log('  ✓ home_screenshot.png');

    await openFirstHistoryVideo(page);
    await sleep(2000);
    await page.screenshot({ path: path.join(OUT, 'learning_screenshot.png') });
    console.log('  ✓ learning_screenshot.png');
    await page.context().close();
}

// --- Main -------------------------------------------------------------------

const scene = process.argv[2] || 'all';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
    // System Chrome: Playwright's bundled Chromium lacks the proprietary
    // codecs YouTube needs, so embeds won't play there.
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});

try {
    if (scene === 'hero' || scene === 'all') await sceneHero(browser);
    if (scene === 'learning' || scene === 'all') await sceneLearning(browser);
    if (scene === 'dictionary' || scene === 'all') await sceneDictionary(browser);
    if (scene === 'dictation' || scene === 'all') await sceneDictation(browser);
    if (scene === 'stills' || scene === 'all') await sceneStills(browser);
} finally {
    await browser.close();
}
console.log('Done.');
