import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPreview, isPublishableAsset } from '../scripts/build-pages-preview.mjs';

const outputDir = mkdtempSync(join(tmpdir(), 'zemtools-pages-preview-'));
try {
  const result = buildPreview({ outputDir });
  const copied = new Set(result.copiedFiles);

  assert.ok(existsSync(join(outputDir, 'index.html')), 'Homepage should be included');
  assert.ok(existsSync(join(outputDir, 'sitemap.xml')), 'Sitemap should be included');
  assert.ok(existsSync(join(outputDir, 'privacy', 'index.html')), 'Privacy page should be included');
  assert.ok(existsSync(join(outputDir, 'master-ui.js')), 'Shared browser UI should be included');

  assert.ok(!existsSync(join(outputDir, 'docs')), 'Internal project documentation must be excluded');
  assert.ok(!existsSync(join(outputDir, 'tests')), 'Test sources must be excluded');
  assert.ok(!existsSync(join(outputDir, 'scripts')), 'Build and validation scripts must be excluded');
  assert.ok(!existsSync(join(outputDir, '.github')), 'GitHub workflows must be excluded');
  assert.ok(!existsSync(join(outputDir, 'README.md')), 'Repository README must be excluded');
  assert.ok(!copied.has('docs/PROJECT_SYNC.md'), 'Public sync notes are not website assets');

  const newline = String.fromCharCode(10);
  const robots = readFileSync(join(outputDir, 'robots.txt'), 'utf8');
  assert.equal(robots, ['User-agent: *', 'Disallow: /', ''].join(newline));
  const headers = readFileSync(join(outputDir, '_headers'), 'utf8');
  assert.match(headers, /X-Robots-Tag: noindex, nofollow/);
  assert.match(headers, /Cache-Control: no-store/);

  assert.equal(isPublishableAsset('../outside.txt'), false);
  assert.equal(isPublishableAsset('docs/private-notes.md'), false);
  assert.equal(isPublishableAsset('tests/site.test.mjs'), false);
  assert.equal(isPublishableAsset('.github/workflows/check.yml'), false);
  assert.equal(isPublishableAsset('private/credentials.txt'), false);
  assert.equal(isPublishableAsset('privacy/index.html'), true);
  assert.equal(isPublishableAsset('assets/site.css'), true);

  console.log(`Pages preview build contract passed (${copied.size} public assets copied).`);
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
