import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import { writeFile as namedWriteFile, mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { guardedContentDir, takeContentWriteViolations } from '../../vitest.content-guard';

/**
 * The unit suite used to write a real journal entry into the checkout's
 * content/ — the live site's directory in a deployment — and leave a
 * .deleted.bak behind on every run. vitest.content-guard.ts refuses such
 * writes; these tests pin that it catches each way code writes a file, and
 * that it leaves reads and temp directories alone.
 */
const repoContent = path.resolve(__dirname, '..', '..', 'content');
const target = path.join(repoContent, `.content-guard-test-${process.pid}`);

function expectBlocked(write: () => unknown) {
  expect(write).toThrow(/real content\/ directory/);
  expect(fs.existsSync(target)).toBe(false);
  expect(takeContentWriteViolations()).toHaveLength(1);
}

async function expectRejected(write: () => Promise<unknown>) {
  await expect(write()).rejects.toThrow(/real content\/ directory/);
  expect(fs.existsSync(target)).toBe(false);
  expect(takeContentWriteViolations()).toHaveLength(1);
}

describe('content write guard', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'folio-guard-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    takeContentWriteViolations();
    await rm(tmp, { recursive: true, force: true });
  });

  it('protects the checkout content/ directory', () => {
    expect(guardedContentDir).toBe(repoContent);
  });

  it('rejects fs.promises writes, the named fs/promises import included', async () => {
    await expectRejected(() => fs.promises.writeFile(target, 'x'));
    await expectRejected(() => namedWriteFile(target, 'x'));
    await expectRejected(() => fs.promises.mkdir(target, { recursive: true }));
    await expectRejected(() => fs.promises.open(target, 'a+'));
  });

  it('blocks sync, callback and stream writes', () => {
    expectBlocked(() => fs.writeFileSync(target, 'x'));
    expectBlocked(() => fs.writeFile(target, 'x', () => {}));
    expectBlocked(() => fs.mkdirSync(target, { recursive: true }));
    expectBlocked(() => fs.appendFileSync(target, 'x'));
    expectBlocked(() => fs.createWriteStream(target));
  });

  it('blocks opening for writing and moving, copying or removing a file', () => {
    const outside = path.join(tmp, 'file');
    fs.writeFileSync(outside, 'x');
    expectBlocked(() => fs.openSync(target, 'w'));
    expectBlocked(() => fs.renameSync(outside, target));
    expectBlocked(() => fs.copyFileSync(outside, target));
    expectBlocked(() => fs.unlinkSync(target));
    expectBlocked(() => fs.rmSync(target, { force: true }));
  });

  it('still blocks when a test points process.cwd() elsewhere', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmp);
    expectBlocked(() => fs.writeFileSync(target, 'x'));
  });

  it('records a blocked write even when the caller swallows the error', async () => {
    await fs.promises.writeFile(target, 'x').catch(() => {});
    expect(takeContentWriteViolations()).toHaveLength(1);
  });

  it('allows reads from content/ and writes anywhere else', async () => {
    const example = path.join(repoContent, 'gallery.yaml.example');
    await expect(readFile(example, 'utf8')).resolves.toContain('albums');
    fs.closeSync(fs.openSync(example, 'r'));

    const elsewhere = path.join(tmp, 'content', 'journal', 'entry.md');
    fs.mkdirSync(path.dirname(elsewhere), { recursive: true });
    await namedWriteFile(elsewhere, 'ok');
    await expect(readFile(elsewhere, 'utf8')).resolves.toBe('ok');
    expect(takeContentWriteViolations()).toEqual([]);
  });
});
