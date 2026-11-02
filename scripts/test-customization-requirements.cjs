const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/customizationRequirements.js'), 'utf8').replace(/export /g, '');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}
module.exports = { assertCustomizationRequirements, getPreviewAreas, CustomizationRequirementError };
`, context);
const { assertCustomizationRequirements, CustomizationRequirementError } = context.module.exports;

const product = {
  _id: 'p1',
  title: 'Frame Set',
  customizationPreview: {
    enabled: true,
    requiredImageCount: 2,
    maxImageCount: 3,
    areas: [
      { label: 'Photo 1', required: true, requiresImageUpload: true },
      { label: 'Photo 2', required: true, requiresImageUpload: true },
      { label: 'Photo 3', required: false, requiresImageUpload: true },
    ],
  },
};
const productsById = { p1: product };

assert.throws(
  () => assertCustomizationRequirements([{ productId: 'p1', customFields: { 'Customer Photos': [{ url: '/a' }] } }], productsById),
  (error) => error instanceof CustomizationRequirementError
);

assert.doesNotThrow(() => assertCustomizationRequirements([{
  productId: 'p1',
  customFields: { 'Customer Photos': [{ url: '/a' }, { url: '/b' }] },
}], productsById));

assert.throws(
  () => assertCustomizationRequirements([{
    productId: 'p1',
    customFields: { 'Customer Photos': [{ url: '/a' }, { url: '/b' }, { url: '/c' }, { url: '/d' }] },
  }], productsById),
  (error) => error instanceof CustomizationRequirementError
);

console.log('Customization requirement tests passed');
