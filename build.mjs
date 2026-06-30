#!/usr/bin/env node
/**
 * Build script for @nirholas/x402-payment-modal.
 *
 * The source (src/index.js) is already a standalone, dependency-free ES module:
 * the only imports it performs are runtime `import()` of pinned esm.sh URLs, made
 * lazily and only when a Solana or EVM-sign-in payment is actually attempted. So
 * there is nothing to *bundle* — we just emit a readable copy and a minified copy
 * for CDN delivery. We deliberately use esbuild's single-file `transform` (not
 * `build`) so those `https://…` dynamic imports are left untouched instead of
 * esbuild trying (and failing) to resolve them at build time.
 */

import esbuild from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcFile = join(here, 'src/index.js');
const distDir = join(here, 'dist');
mkdirSync(distDir, { recursive: true });

const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const source = readFileSync(srcFile, 'utf8');
const banner = `/*! ${pkg.name} v${pkg.version} — ${pkg.license} — ${pkg.homepage} */\n`;

// 1. Readable, unminified copy for CDN debugging and source maps in DevTools.
writeFileSync(join(distDir, 'x402.js'), banner + source);

// 2. Minified copy for production CDN delivery (unpkg/jsDelivr point here).
const minified = await esbuild.transform(source, {
	minify: true,
	format: 'esm',
	target: 'es2020',
	loader: 'js',
	legalComments: 'none',
});
writeFileSync(join(distDir, 'x402.min.js'), banner + minified.code);

// 3. Ship the type definitions next to the dist bundles too.
copyFileSync(join(here, 'types/index.d.ts'), join(distDir, 'index.d.ts'));

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
console.log(`[x402-payment-modal] built dist/x402.js      ${kb(banner + source)}`);
console.log(`[x402-payment-modal] built dist/x402.min.js  ${kb(banner + minified.code)}`);
console.log('[x402-payment-modal] copied dist/index.d.ts');
