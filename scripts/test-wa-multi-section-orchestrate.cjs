/** Smoke: CreateWhatsAppOrderModal multi-enable orchestration (no exclusive productMode). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modal = fs.readFileSync(
  path.join(__dirname, '../src/components/admin/CreateWhatsAppOrderModal.js'),
  'utf8',
);

test('multi-enable flags replace exclusive productMode', () => {
  assert.match(modal, /includeCatalog/);
  assert.match(modal, /includeCombo/);
  assert.match(modal, /includeCollagePhotos/);
  assert.match(modal, /toggleOrderSection/);
  assert.doesNotMatch(modal, /productMode/);
  assert.doesNotMatch(modal, /setProductMode/);
});

test('submit merges all enabled section builders', () => {
  assert.match(modal, /let catalogItems = \[\]/);
  assert.match(modal, /let comboItems = \[\]/);
  assert.match(modal, /let collageItems = \[\]/);
  assert.match(modal, /\[\.\.\.catalogItems, \.\.\.comboItems, \.\.\.collageItems\]/);
  assert.match(modal, /buildCatalogLineItems\(\)/);
  assert.match(modal, /buildComboLineItemsForSubmit\(\)/);
  assert.match(modal, /buildCollagePhotosLineItems\(\)/);
});

test('overall order price is mode-agnostic and combo flag is item-level', () => {
  assert.match(modal, /Overall Order Price \*/);
  assert.match(modal, /Enter the overall order price/);
  assert.match(modal, /isCustomizedCombo: item\.isCustomizedCombo \|\| undefined/);
  assert.doesNotMatch(modal, /isCustomizedCombo: productMode/);
});

test('section components are still used unchanged', () => {
  assert.match(modal, /<CatalogProductSection/);
  assert.match(modal, /<ComboProductSection/);
  assert.match(modal, /<CollagePhotosSection/);
  assert.match(modal, /products=\{products\}/);
});
