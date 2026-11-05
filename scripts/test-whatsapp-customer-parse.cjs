const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../src/lib/whatsappCustomerParse.js'), 'utf8')
  .replace(/export function /g, 'function ')
  .replace(/export const /g, 'const ');

const ctx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, Set, RegExp };
vm.createContext(ctx);
vm.runInContext(`${src}\nmodule.exports={parseWhatsAppCustomerDetails,validateParsedCustomer};`, ctx);
const { parseWhatsAppCustomerDetails, validateParsedCustomer } = ctx.module.exports;

{
  const pasted = `Priya Krishnan
9876543210
WhatsApp: 9123456789
12, Anna Nagar Main Road
Near Metro Station
Chennai
Tamil Nadu
600040`;
  const { fields, warnings } = parseWhatsAppCustomerDetails(pasted);
  assert.strictEqual(fields.customerName, 'Priya Krishnan');
  assert.strictEqual(fields.phone, '9876543210');
  assert.strictEqual(fields.whatsappNumber, '9123456789');
  assert.ok(fields.line1.includes('Anna Nagar'), `line1=${fields.line1}`);
  assert.strictEqual(fields.pincode, '600040');
  assert.strictEqual(fields.state, 'Tamil Nadu');
  assert.strictEqual(fields.city, 'Chennai');
  assert.ok(/metro/i.test(fields.landmark));
  const v = validateParsedCustomer(fields);
  assert.strictEqual(v.ok, true, v.errors.join('; '));
}

{
  const pasted = `Name: Ravi
Phone: 9988776655
No 8 Gandhi Street
Coimbatore, Tamil Nadu
641001`;
  const { fields } = parseWhatsAppCustomerDetails(pasted);
  assert.strictEqual(fields.phone, '9988776655');
  assert.strictEqual(fields.pincode, '641001');
  assert.strictEqual(fields.state, 'Tamil Nadu');
}

{
  const bad = validateParsedCustomer({
    customerName: '',
    phone: '123',
    pincode: '12',
    line1: '',
    city: '',
    state: '',
  });
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.errors.length >= 4);
}

{
  // Uncertain parse should not invent a fake phone
  const { fields } = parseWhatsAppCustomerDetails('Just some notes without contact');
  assert.strictEqual(fields.phone, '');
  assert.strictEqual(fields.pincode, '');
}

{
  // Short substring must NOT invent a state (e.g. "and" → Andaman)
  const { fields } = parseWhatsAppCustomerDetails('Ravi\n9876543210\nand\n600001');
  assert.notStrictEqual(fields.state, 'Andaman and Nicobar Islands');
}

{
  // Exact state still works
  const { fields } = parseWhatsAppCustomerDetails('Ravi\n9876543210\n12 Main Road\nChennai\nTamil Nadu\n600001');
  assert.strictEqual(fields.state, 'Tamil Nadu');
}

{
  // Phone + pincode on same line — keep both
  const { fields } = parseWhatsAppCustomerDetails('Ravi\n9876543210 600001\n12 Main Road\nChennai\nTamil Nadu');
  assert.strictEqual(fields.phone, '9876543210');
  assert.strictEqual(fields.pincode, '600001');
  assert.ok(fields.line1.includes('Main Road'), `line1=${fields.line1}`);
  assert.strictEqual(fields.state, 'Tamil Nadu');
  assert.strictEqual(fields.city, 'Chennai');
}

{
  // Street containing a state name must NOT steal state
  const { fields } = parseWhatsAppCustomerDetails('Ravi Kumar\nAssam Colony Road\nChennai\nTamil Nadu\n600001\n9876543210');
  assert.strictEqual(fields.state, 'Tamil Nadu');
  assert.ok(/Assam Colony/i.test(fields.line1), `line1=${fields.line1}`);
  assert.strictEqual(fields.city, 'Chennai');
}

{
  // Pincode embedded in street line — keep street remainder
  const { fields } = parseWhatsAppCustomerDetails('Ravi\n9876543210\n12 Anna Nagar 600040\nChennai\nTamil Nadu');
  assert.strictEqual(fields.pincode, '600040');
  assert.ok(/Anna Nagar/i.test(fields.line1), `line1=${fields.line1}`);
}

{
  // Ambiguous fragments must not invent state
  const { fields } = parseWhatsAppCustomerDetails('pradesh\n600001');
  assert.strictEqual(fields.state, '');
}

console.log('WhatsApp customer parse tests passed');
