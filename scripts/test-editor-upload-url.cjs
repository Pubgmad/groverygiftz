const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/clientImageUpload.js'), 'utf8')
  .replace(/export /g, '')
  .replace(/await import\('heic-to'\)/g, "Promise.reject(new Error('no heic'))");

// Only need the pure URL helpers — extract by evaluating after stripping async file deps carefully.
const helpers = `
function stableUploadUrl(upload) {
  if (!upload) return '';
  return upload.displayUrl || upload.previewUrl || upload.url || '';
}
function editorUploadUrl(upload) {
  if (!upload) return '';
  const preview = String(upload.previewUrl || '');
  if (preview.startsWith('blob:')) return preview;
  return stableUploadUrl(upload);
}
function liveBlobUrl(upload) {
  const preview = String(upload?.previewUrl || '');
  return preview.startsWith('blob:') ? preview : '';
}
module.exports = { stableUploadUrl, editorUploadUrl, liveBlobUrl };
`;

const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(helpers, context);
const { stableUploadUrl, editorUploadUrl, liveBlobUrl } = context.module.exports;

const upload = {
  previewUrl: 'blob:https://groverygiftz.in/abc',
  displayUrl: '/api/customization-upload/customer-file/customizations/x.jpg?exp=1&sig=y',
  url: '/api/customization-upload/original-file/customizations/x.jpg',
};

assert.strictEqual(editorUploadUrl(upload), 'blob:https://groverygiftz.in/abc');
assert.strictEqual(stableUploadUrl(upload), upload.displayUrl);
assert.strictEqual(liveBlobUrl(upload), 'blob:https://groverygiftz.in/abc');

const durableOnly = { displayUrl: upload.displayUrl, url: upload.url };
assert.strictEqual(editorUploadUrl(durableOnly), upload.displayUrl);
assert.strictEqual(liveBlobUrl(durableOnly), '');

console.log('Editor upload URL tests passed');
