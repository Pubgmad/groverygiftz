const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/clientImageUpload.js'), 'utf8')
  .replace(/export /g, '')
  .replace(/await import\('heic-to'\)/g, "Promise.reject(new Error('no heic'))");

// Only need the pure URL helpers — extract by evaluating after stripping async file deps carefully.
const sourceNoExport = source;
const context = { module: { exports: {} }, exports: {}, console, URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} }, Uint8Array, Image: class {}, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(`${sourceNoExport}\nmodule.exports = { stableUploadUrl, editorUploadUrl, liveBlobUrl, previewLoadUrls, cardUploadUrls };`, context);
const { stableUploadUrl, editorUploadUrl, liveBlobUrl, previewLoadUrls, cardUploadUrls } = context.module.exports;

const upload = {
  previewUrl: 'blob:https://groverygiftz.in/abc',
  displayUrl: '/api/customization-upload/customer-file/customizations/x.jpg?exp=1&sig=y',
  url: '/api/customization-upload/original-file/customizations/x.jpg',
};

assert.strictEqual(editorUploadUrl(upload), 'blob:https://groverygiftz.in/abc');
assert.strictEqual(stableUploadUrl(upload), upload.displayUrl);
assert.strictEqual(liveBlobUrl(upload), 'blob:https://groverygiftz.in/abc');
assert.strictEqual(JSON.stringify(previewLoadUrls(upload)), JSON.stringify([upload.previewUrl, upload.displayUrl, upload.url]));
assert.strictEqual(JSON.stringify(cardUploadUrls(upload)), JSON.stringify([upload.previewUrl, upload.displayUrl, upload.url]));

const durableOnly = { displayUrl: upload.displayUrl, url: upload.url };
assert.strictEqual(editorUploadUrl(durableOnly), upload.displayUrl);
assert.strictEqual(liveBlobUrl(durableOnly), '');

const applied = {
  previewUrl: 'data:image/jpeg;base64,AAA',
  displayUrl: '/api/customization-upload/customer-file/customizations/preview.jpg?exp=1&sig=z',
};
assert.strictEqual(JSON.stringify(cardUploadUrls(upload, applied)), JSON.stringify([
  applied.previewUrl,
  applied.displayUrl,
  upload.previewUrl,
  upload.displayUrl,
  upload.url,
]));

console.log('Editor upload URL tests passed');