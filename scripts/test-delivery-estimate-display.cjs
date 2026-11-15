const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const strip = (text) => text.replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace(/export /g, '');
const calendar = strip(fs.readFileSync(path.join(__dirname, '../src/lib/businessCalendar.js'), 'utf8'));
const deliveryDate = strip(fs.readFileSync(path.join(__dirname, '../src/lib/deliveryDate.js'), 'utf8'));
const central = strip(fs.readFileSync(path.join(__dirname, '../src/lib/centralDeliveryEstimates.js'), 'utf8'));
const display = strip(fs.readFileSync(path.join(__dirname, '../src/lib/deliveryEstimateDisplay.js'), 'utf8'));

const context = { module: { exports: {} }, exports: {}, console, Intl, Date };
vm.createContext(context);
vm.runInContext(`${calendar}\n${deliveryDate}\n${central}\n${display}\nmodule.exports = { getDeliveryEstimateDisplay, buildCurrentDeliveryEstimate, getCentralDeliveryEstimate };`, context);
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
