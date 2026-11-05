import * as esbuild from 'esbuild';
import { createRequire } from 'module';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'soldout-interest-'));
const outfile = join(tmp, 'bundle.cjs');

await esbuild.build({
  stdin: {
    contents: `export {
      getInterestBounds,
      generateProductInterestEstimate,
      nudgeInterestEstimate,
    } from './src/lib/productInterest.js';`,
    resolveDir: root,
    sourcefile: 'entry.js',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { '@': join(root, 'src') },
  logLevel: 'silent',
});

const require = createRequire(import.meta.url);
const m = require(outfile);

const bounds = m.getInterestBounds({}, { soldOut: true });
if (bounds.min !== 3 || bounds.max !== 18) {
  throw new Error(`Unexpected sold-out bounds: ${JSON.stringify(bounds)}`);
}

let value = m.generateProductInterestEstimate('sold-out-demo', {}, { soldOut: true });
if (value < bounds.min || value > bounds.max) {
  throw new Error(`Initial sold-out value out of range: ${value}`);
}

let changed = false;
for (let i = 0; i < 40; i += 1) {
  const next = m.nudgeInterestEstimate(value, {}, i % 3 === 0 ? 'quicker' : 'normal', { soldOut: true });
  if (next < bounds.min || next > bounds.max) {
    throw new Error(`Nudge left sold-out range: ${next}`);
  }
  if (next !== value) changed = true;
  value = next;
}

if (!changed) throw new Error('Sold-out interest did not fluctuate');

const inStock = m.getInterestBounds({ minViews: 250, maxViews: 1000 }, { soldOut: false });
if (inStock.min !== 250 || inStock.max !== 1000) {
  throw new Error(`In-stock bounds broken: ${JSON.stringify(inStock)}`);
}

console.log('sold-out interest ok', { sample: value, bounds, changed });
rmSync(tmp, { recursive: true, force: true });
