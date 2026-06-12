// Capture README screenshots and GIFs from the running app.
//
// Usage:  APP_URL=http://localhost:5199 node capture.mjs [hero|learning|dictionary|dictation|mobile|stills|all]
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
const PHONE_VIEWPORT = { width: 390, height: 844 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;

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

function encodeGif(frames, fps, outFile, { transparent = false } = {}) {
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    for (const { data, width, height } of frames) {
        if (transparent) {
            const palette = quantize(data, 256, { format: 'rgba4444' });
            const index = applyPalette(data, palette, 'rgba4444');
            const ti = palette.findIndex(p => p[3] === 0);
            gif.writeFrame(index, width, height, {
                palette, delay, dispose: 2,
                transparent: ti >= 0, transparentIndex: ti >= 0 ? ti : 0,
            });
        } else {
            const palette = quantize(data, 256);
            const index = applyPalette(data, palette);
            gif.writeFrame(index, width, height, { palette, delay });
        }
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
    return ctx.newPage();
}

async function openFirstHistoryVideo(page) {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    let card = page.getByTestId('history-card').filter({ has: page.locator('img') }).first();
    if (await card.count() === 0) card = page.getByTestId('history-card').first();
    await card.waitFor({ state: 'visible', timeout: 15000 });
    await card.click();
    await page.locator('[data-index="0"]').waitFor({ state: 'visible', timeout: 20000 });
    await sleep(2500);
}

// Composite a phone screen frame inside a rounded transparent bezel.
function framePhone(screen) {
    const bezel = 16, notchW = 116, notchH = 30;
    const sw = screen.width, sh = screen.height;
    const ow = sw + bezel * 2, oh = sh + bezel * 2;
    const sr = 50;                 // screen corner radius
    const br = sr + Math.round(bezel * 0.7); // body corner radius
    const out = new Uint8Array(ow * oh * 4); // zero-filled => transparent
    const body = [7, 7, 9];

    const insideRR = (x, y, w, h, r) => {
        const cx = Math.min(Math.max(x, r), w - r);
        const cy = Math.min(Math.max(y, r), h - r);
        const dx = x - cx, dy = y - cy;
        return dx * dx + dy * dy <= r * r;
    };

    for (let y = 0; y < oh; y++) {
        for (let x = 0; x < ow; x++) {
            if (!insideRR(x, y, ow, oh, br)) continue; // transparent outside body
            const o = (y * ow + x) * 4;
            out[o] = body[0]; out[o + 1] = body[1]; out[o + 2] = body[2]; out[o + 3] = 255;
            const sx = x - bezel, sy = y - bezel;
            if (sx >= 0 && sy >= 0 && sx < sw && sy < sh && insideRR(sx, sy, sw, sh, sr)) {
                const so = (sy * sw + sx) * 4;
                out[o] = screen.data[so]; out[o + 1] = screen.data[so + 1];
                out[o + 2] = screen.data[so + 2]; out[o + 3] = 255;
            }
        }
    }
    // Dynamic-island notch
    const nx0 = Math.round(bezel + (sw - notchW) / 2), ny0 = bezel + 13;
    for (let y = 0; y < notchH; y++) {
        for (let x = 0; x < notchW; x++) {
            if (!insideRR(x, y, notchW, notchH, notchH / 2)) continue;
            const o = ((ny0 + y) * ow + (nx0 + x)) * 4;
            out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 255;
        }
    }
    return { data: out, width: ow, height: oh };
}

// --- Scenes -----------------------------------------------------------------

async function sceneHero(browser) {
    console.log('▶ hero.gif — aurora, shimmer, tilt cards, vocab axis');
    // Slightly smaller canvas: the aurora's grain + gradients compress poorly,
    // so this keeps the GIF light without a visible quality drop in the README.
    const HERO_VIEWPORT = { width: 920, height: 700 };
    const page = await newPage(browser, HERO_VIEWPORT);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // The film-grain overlay adds random noise that balloons GIF size with no
    // visible benefit at this scale — hide it just for the recording.
    await page.addStyleTag({ content: '.aurora-noise{display:none !important}' });
    await sleep(1800); // let the entrance stagger settle

    // Grab the vocab-axis stop positions up front
    const stopBox = (label) =>
        page.evaluate((l) => {
            const b = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === l);
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, label);
    const stops = {
        liftoff: await stopBox('Liftoff'),
        moonwalk: await stopBox('Moonwalk'),
        deepspace: await stopBox('Deep Space'),
        supernova: await stopBox('Supernova'),
    };

    const vw = HERO_VIEWPORT.width, vh = HERO_VIEWPORT.height;
    const axisY = stops.liftoff?.y ?? vh * 0.78;
    // Mouse choreography: drift over the hero (cursor spotlight sweeps the
    // aurora), then walk the vocabulary axis, clicking each stop in turn.
    const wp = [
        { t: 0.0, x: vw * 0.42, y: vh * 0.26 },
        { t: 1.2, x: vw * 0.62, y: vh * 0.40 },
        { t: 2.1, x: (stops.liftoff?.x ?? vw * 0.18), y: axisY },
        { t: 3.1, x: (stops.moonwalk?.x ?? vw * 0.45), y: axisY },
        { t: 4.1, x: (stops.deepspace?.x ?? vw * 0.72), y: axisY },
        { t: 5.1, x: (stops.supernova?.x ?? vw * 0.88), y: axisY },
        { t: 6.4, x: vw * 0.5, y: vh * 0.40 },
    ];
    const clicks = [
        { t: 2.1, p: stops.liftoff },
        { t: 3.1, p: stops.moonwalk },
        { t: 4.1, p: stops.deepspace },
        { t: 5.1, p: stops.supernova },
    ];
    let nextClick = 0;

    const posAt = (t) => {
        let a = wp[0], b = wp[wp.length - 1];
        for (let i = 0; i < wp.length - 1; i++) {
            if (t >= wp[i].t && t <= wp[i + 1].t) { a = wp[i]; b = wp[i + 1]; break; }
        }
        const span = b.t - a.t || 1;
        const k = Math.min(1, Math.max(0, (t - a.t) / span));
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOut
        return { x: lerp(a.x, b.x, ease), y: lerp(a.y, b.y, ease) };
    };

    const HERO_FPS = 10;
    const frames = await captureFrames(page, {
        seconds: 6.4, fps: HERO_FPS,
        onTick: async (t) => {
            const { x, y } = posAt(t);
            await page.mouse.move(x, y);
            if (nextClick < clicks.length && t >= clicks[nextClick].t) {
                const c = clicks[nextClick].p;
                if (c) await page.mouse.click(c.x, c.y).catch(() => {});
                nextClick++;
            }
        },
    });
    encodeGif(frames, HERO_FPS, path.join(OUT, 'hero.gif'));
    await page.context().close();
}

async function sceneLearning(browser) {
    console.log('▶ learning.gif — smooth synced transcript + click-to-seek');
    const page = await newPage(browser, GIF_VIEWPORT);
    await openFirstHistoryVideo(page);
    await sleep(5000); // get past the long opening sentence

    const LEARN_FPS = 10;
    const frames = await captureFrames(page, {
        seconds: 8, fps: LEARN_FPS,
        onTick: async (_t, i) => {
            if (i === 34) {
                const blocks = page.locator('[data-index]');
                const count = await blocks.count();
                await blocks.nth(Math.min(10, count - 1)).click().catch(() => {});
            }
        },
    });
    encodeGif(frames, LEARN_FPS, path.join(OUT, 'learning.gif'));
    await page.context().close();
}

async function sceneDictionary(browser) {
    console.log('▶ dictionary.gif — click a word, get IPA + definition');
    const page = await newPage(browser, GIF_VIEWPORT);
    await openFirstHistoryVideo(page);

    const clip = { x: GIF_VIEWPORT.width / 2, y: 64, width: GIF_VIEWPORT.width / 2, height: GIF_VIEWPORT.height - 64 };
    const word = page.locator('[data-index="1"] p span span').filter({ hasText: /[A-Za-z]{6,}/ }).first();

    const frames = await captureFrames(page, {
        seconds: 6.5, fps: 11, clip,
        onTick: async (_t, i) => {
            if (i === 9) await word.click().catch(() => {});
        },
    });
    encodeGif(frames, 11, path.join(OUT, 'dictionary.gif'));
    await page.context().close();
}

async function sceneDictation(browser) {
    console.log('▶ dictation.gif — blur English, click to reveal');
    const page = await newPage(browser, GIF_VIEWPORT);
    await openFirstHistoryVideo(page);

    const clip = { x: GIF_VIEWPORT.width / 2, y: 64, width: GIF_VIEWPORT.width / 2, height: GIF_VIEWPORT.height - 64 };
    const frames = await captureFrames(page, {
        seconds: 6.5, fps: 11, clip,
        onTick: async (_t, i) => {
            if (i === 7) await page.getByText('听写模式').click().catch(() => {});
            if (i === 34) await page.locator('[data-index="2"] p').first().click().catch(() => {});
        },
    });
    encodeGif(frames, 11, path.join(OUT, 'dictation.gif'));
    await page.context().close();
}

async function sceneMobile(browser) {
    console.log('▶ mobile.gif — phone-framed learning view');
    const page = await newPage(browser, PHONE_VIEWPORT);
    await openFirstHistoryVideo(page);
    await sleep(5000); // let playback advance so the transcript follows

    const raw = await captureFrames(page, { seconds: 8, fps: 10 });
    const framed = raw.map(framePhone);
    encodeGif(framed, 10, path.join(OUT, 'mobile.gif'), { transparent: true });
    await page.context().close();
}

async function sceneStills(browser) {
    console.log('▶ stills — home + learning @2x');
    const page = await newPage(browser, STILL_VIEWPORT, 2);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(1800);
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
    if (scene === 'mobile' || scene === 'all') await sceneMobile(browser);
    if (scene === 'stills' || scene === 'all') await sceneStills(browser);
} finally {
    await browser.close();
}
console.log('Done.');
