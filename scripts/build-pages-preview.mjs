import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = process.cwd();
const DEFAULT_OUTPUT_DIR = resolve(PROJECT_ROOT, 'dist');
const NEWLINE = String.fromCharCode(10);

const EXCLUDED_TOP_LEVEL = new Set([
  '.git',
  '.github',
  'coverage',
  'docs',
  'dist',
  'node_modules',
  'playwright-report',
  'scripts',
  'test-results',
  'tests'
]);

const EXCLUDED_NAMES = new Set([
  '.ds_store',
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  'bun.lockb',
  'cname',
  'license',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'readme.md',
  'tsconfig.json',
  'wrangler.jsonc',
  'wrangler.toml',
  'yarn.lock'
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.cjs',
  '.log',
  '.map',
  '.md',
  '.mdx',
  '.mjs',
  '.pdf',
  '.sh',
  '.ts',
  '.yaml',
  '.yml',
  '.zip'
]);

export function isPublishableAsset(relativePath) {
  const normalized = relativePath;
  const parts = normalized.split('/');
  const lowerName = basename(normalized).toLowerCase();
  const extension = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';

  if (!normalized || normalized.startsWith('/') || parts.some(part => part === '..')) return false;
  if (EXCLUDED_TOP_LEVEL.has(parts[0])) return false;
  if (EXCLUDED_NAMES.has(lowerName)) return false;
  if (EXCLUDED_EXTENSIONS.has(extension)) return false;
  if (parts.some(part => part.startsWith('.') && part !== '.well-known')) return false;
  if (parts.some(part => ['private', 'backups', 'internal'].includes(part.toLowerCase()))) return false;

  return true;
}

export function buildPreview({ outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const output = resolve(outputDir);
  const outputPrefix = output.endsWith(sep) ? output : output + sep;
  assert.ok(output !== PROJECT_ROOT && !PROJECT_ROOT.startsWith(outputPrefix),
    'Preview output must not overwrite the repository or a parent directory.');

  const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8'
  }).split(String.fromCharCode(0)).filter(Boolean);

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });

  const copied = [];
  for (const relativePath of trackedFiles) {
    if (!isPublishableAsset(relativePath)) continue;

    const source = resolve(PROJECT_ROOT, relativePath);
    const destination = resolve(output, relativePath);
    assert.ok(destination === output || destination.startsWith(outputPrefix),
      `Unsafe output path derived from tracked file: ${relativePath}`);

    if (!existsSync(source) || !lstatSync(source).isFile()) continue;
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    copied.push(relativePath);
  }

  for (const required of ['index.html', 'sitemap.xml']) {
    assert.ok(existsSync(resolve(output, required)), `Required public asset missing: ${required}`);
  }

  // Preview hosts must not be indexed or treated as canonical public destinations.
  writeFileSync(
    resolve(output, 'robots.txt'),
    ['User-agent: *', 'Disallow: /', ''].join(NEWLINE),
    'utf8'
  );
  writeFileSync(
    resolve(output, '_headers'),
    ['/*', '  X-Robots-Tag: noindex, nofollow', '  Cache-Control: no-store', ''].join(NEWLINE),
    'utf8'
  );

  return { outputDir: output, copiedFiles: copied };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = buildPreview();
  console.log(`Prepared ${result.copiedFiles.length} public assets in ${result.outputDir}`);
  console.log('Preview robots.txt and X-Robots-Tag noindex protections applied.');
}
