const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/safeJsonResponse.js'), 'utf8').replace(/export /g, '');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}\nmodule.exports = { readJsonResponse, messageForUploadHttpStatus };`, context);
const { readJsonResponse, messageForUploadHttpStatus } = context.module.exports;

function fakeResponse({ status = 200, contentType = 'application/json', body = '' }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  };
}

test('maps HTML gateway responses to a customer-safe message instead of Unexpected token', async () => {
  await assert.rejects(
    () => readJsonResponse(fakeResponse({
      status: 502,
      contentType: 'text/html',
      body: '<html><body>Bad Gateway</body></html>',
    })),
    /temporarily unavailable|timed out|Server error|too large|invalid response|Unable to save/i
  );
});

test('parses successful JSON upload payloads', async () => {
  const data = await readJsonResponse(fakeResponse({
    status: 201,
    body: JSON.stringify({ url: '/api/customization-upload/original-file/x.jpg', displayUrl: '/api/x' }),
  }));
  assert.equal(data.url, '/api/customization-upload/original-file/x.jpg');
});

test('surfaces JSON error bodies from the API', async () => {
  await assert.rejects(
    () => readJsonResponse(fakeResponse({
      status: 415,
      body: JSON.stringify({ error: 'HEIC/HEIF preview conversion failed. Please choose the image again.' }),
    })),
    /HEIC\/HEIF preview conversion failed/
  );
});

test('413 status has an actionable photo-size message', () => {
  assert.match(messageForUploadHttpStatus(413), /too large/i);
});

test('ProductDetail no longer calls bare res.json on customization uploads', () => {
  const detail = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
  assert.match(detail, /readJsonResponse/);
  assert.equal((detail.match(/await res\.json\(\)/g) || []).length, 0);
});
