const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const deliveryDate = fs.readFileSync(path.join(__dirname, '../src/lib/deliveryDate.js'), 'utf8').replace(/export /g, '');
const central = fs.readFileSync(path.join(__dirname, '../src/lib/centralDeliveryEstimates.js'), 'utf8')
  .replace(/export /g, '')
  .replace(/import \{ buildDeliveryEstimateText \} from '@\/lib\/deliveryDate';/, '');
const display = fs.readFileSync(path.join(__dirname, '../src/lib/deliveryEstimateDisplay.js'), 'utf8')
  .replace(/export /g, '')
  .replace(/import \{ buildCurrentDeliveryEstimate, getCentralDeliveryEstimate \} from '@\/lib\/centralDeliveryEstimates';/, '');

const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${deliveryDate}\n${central}\n${display}\nmodule.exports = { getDeliveryEstimateDisplay, buildCurrentDeliveryEstimate, getCentralDeliveryEstimate };`, context);
const { getDeliveryEstimateDisplay, buildCurrentDeliveryEstimate } = context.module.exports;

const settings = {
  tamilNaduDeliveryEstimate: 'Within 8 days',
  otherStateDeliveryEstimate: '10-15 days',
  deliveryHolidays: [],
};

const needState = getDeliveryEstimateDisplay(settings, '');
assert.strictEqual(needState.status, 'need-state');

const tn = getDeliveryEstimateDisplay(settings, 'Tamil Nadu');
assert.strictEqual(tn.status, 'ready');
assert.strictEqual(tn.durationLabel, 'Within 8 days');
assert.ok(tn.expectedByLabel);
assert.strictEqual(tn.fullText, buildCurrentDeliveryEstimate(settings, 'Tamil Nadu'));

const other = getDeliveryEstimateDisplay(settings, 'Karnataka');
assert.strictEqual(other.durationLabel, '10-15 days');
assert.ok(other.fullText.includes('expected by'));

console.log('Delivery estimate display tests passed');
