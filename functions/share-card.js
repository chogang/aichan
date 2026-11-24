import { Resvg, initWasm } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm';
import font from '../share-assets/ai-chan-preview.bin';
import hangulFont from '../share-assets/ai-chan-preview-ko.bin';
import hanFont from '../share-assets/ai-chan-preview-zh.bin';
import { handleShareCard } from '../share-card.mjs';

let rendererReady;

async function renderPng(svg) {
  rendererReady ??= initWasm(wasm);
  await rendererReady;
  const renderer = new Resvg(svg, { font: { fontBuffers: [font, hangulFont, hanFont].map(buffer => new Uint8Array(buffer)) } });
  try {
    const image = renderer.render();
    try {
      return image.asPng();
    } finally {
      image.free();
    }
  } finally {
    renderer.free();
  }
}

export function onRequestGet(context) {
  return handleShareCard(context.request, renderPng, {
    cache: caches.default,
    waitUntil: promise => context.waitUntil(promise)
  });
}
