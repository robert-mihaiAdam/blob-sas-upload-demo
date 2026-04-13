'use strict';

const { generateUploadSasUrl } = require('../src/sasGenerator');

// Minimal stub credentials – the Azure SDK accepts any non-empty string for
// the account key as long as it is valid base-64.
const VALID_OPTIONS = {
  accountName: 'devstoreaccount1',
  accountKey: Buffer.from('test-key-for-unit-tests').toString('base64'),
  containerName: 'logs',
  blobName: 'test-upload.log',
};

describe('generateUploadSasUrl', () => {
  test('returns sasUrl, blobName and expiresAt', () => {
    const result = generateUploadSasUrl(VALID_OPTIONS);

    expect(result).toHaveProperty('sasUrl');
    expect(result).toHaveProperty('blobName', VALID_OPTIONS.blobName);
    expect(result).toHaveProperty('expiresAt');
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  test('sasUrl contains the account name and container', () => {
    const { sasUrl } = generateUploadSasUrl(VALID_OPTIONS);

    expect(sasUrl).toContain(VALID_OPTIONS.accountName);
    expect(sasUrl).toContain(VALID_OPTIONS.containerName);
    expect(sasUrl).toContain(VALID_OPTIONS.blobName);
  });

  test('sasUrl includes a SAS query string', () => {
    const { sasUrl } = generateUploadSasUrl(VALID_OPTIONS);
    const url = new URL(sasUrl);

    expect(url.searchParams.has('sv')).toBe(true);  // signed version
    expect(url.searchParams.has('sig')).toBe(true); // signature
    expect(url.searchParams.has('se')).toBe(true);  // expiry
    expect(url.searchParams.has('sp')).toBe(true);  // permissions
  });

  test('default expiry is approximately 5 minutes from now', () => {
    const before = new Date();
    const { expiresAt } = generateUploadSasUrl(VALID_OPTIONS);
    const after = new Date();

    const minExpiry = new Date(before.getTime() + 4 * 60 * 1000);
    const maxExpiry = new Date(after.getTime() + 6 * 60 * 1000);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(minExpiry.getTime());
    expect(expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry.getTime());
  });

  test('custom expiryMinutes is respected', () => {
    const before = new Date();
    const { expiresAt } = generateUploadSasUrl({ ...VALID_OPTIONS, expiryMinutes: 10 });
    const after = new Date();

    const minExpiry = new Date(before.getTime() + 9 * 60 * 1000);
    const maxExpiry = new Date(after.getTime() + 11 * 60 * 1000);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(minExpiry.getTime());
    expect(expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry.getTime());
  });

  test('SAS permissions are write-only (cw)', () => {
    const { sasUrl } = generateUploadSasUrl(VALID_OPTIONS);
    const url = new URL(sasUrl);
    const sp = url.searchParams.get('sp');

    // Permissions should only include create (c) and write (w) — NOT read (r),
    // delete (d) or list (l).
    expect(sp).toMatch(/^[cw]+$/);
    expect(sp).not.toContain('r');
    expect(sp).not.toContain('d');
    expect(sp).not.toContain('l');
  });

  test('throws when required options are missing', () => {
    expect(() => generateUploadSasUrl({ ...VALID_OPTIONS, accountName: '' })).toThrow();
    expect(() => generateUploadSasUrl({ ...VALID_OPTIONS, accountKey: '' })).toThrow();
    expect(() => generateUploadSasUrl({ ...VALID_OPTIONS, containerName: '' })).toThrow();
    expect(() => generateUploadSasUrl({ ...VALID_OPTIONS, blobName: '' })).toThrow();
  });
});
