const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const strip = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
  .replace(/export /g, '');

function loadCalendar() {
  const context = { console, Intl };
  vm.createContext(context);
  vm.runInContext(`${strip('src/lib/businessCalendar.js')}\nthis.api = { istYmd, parseMaxWorkingDays, isSundayYmd, isNonWorkingYmd, addWorkingDaysFromOrderDate, subtractWorkingDaysFromDate, continuousDeliveryYmd, computeConfirmationSchedule, formatLongIstDate, weekdayUtcYmd, addCalendarDaysYmd, CONTINUOUS_QUEUE_EPOCH_IST, CONFIRMATION_CALENDAR_VERSION };`, context);
  return context.api;
}

function loadEmail() {
  const calendar = strip('src/lib/businessCalendar.js');
  const email = strip('src/lib/orderConfirmationEmail.js');
  const context = { console, Intl, Number, String, Array, Math };
  vm.createContext(context);
  vm.runInContext(`function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(price) || 0);
}
function confirmationRecipientEmail(order = {}) {
  return String(order?.shippingAddress?.email || order?.guestEmail || '').trim().toLowerCase();
}
${calendar}
${email}
this.api = { buildOrderConfirmationEmail, escapeHtml, formatLongIstDate };`, context);
  return context.api;
}

test('max of Admin range is used and invalid estimates are rejected', () => {
  const c = loadCalendar();
  assert.equal(c.parseMaxWorkingDays('6 working days'), 6);
  assert.equal(c.parseMaxWorkingDays('6-8 working days'), 8);
  assert.equal(c.parseMaxWorkingDays('12–15 working days'), 15);
  assert.equal(c.parseMaxWorkingDays('Within 8 days'), 8);
  assert.equal(c.parseMaxWorkingDays('about a week'), null);
  assert.equal(c.parseMaxWorkingDays(''), null);
});

test('Monday working-day Tamil Nadu 6-day schedule advances the continuous queue from Sunday', () => {
  const c = loadCalendar();
  const placedAt = new Date('2026-11-16T11:00:00+05:30');
  assert.equal(c.istYmd(placedAt), '2026-11-16');
  assert.equal(c.weekdayUtcYmd('2026-11-16'), 1);
  const schedule = c.computeConfirmationSchedule({
    placedAt,
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '6 working days',
    holidays: [],
  });
  assert.equal(schedule.ok, true);
  assert.equal(schedule.holidayAdjustmentApplied, false);
  assert.equal(schedule.calendarVersion, 'continuous-queue-v1');
  assert.equal(schedule.expectedReadyDateIst, '2026-11-21');
  assert.equal(schedule.estimatedDeliveryDateIst, '2026-11-24');
  assert.equal(c.isNonWorkingYmd(schedule.expectedReadyDateIst, []), false);
  assert.equal(c.isNonWorkingYmd(schedule.estimatedDeliveryDateIst, []), false);
});

test('Saturday remains a working day and Sunday is skipped', () => {
  const c = loadCalendar();
  assert.equal(c.isSundayYmd('2026-11-21'), false);
  assert.equal(c.isSundayYmd('2026-11-22'), true);
  assert.equal(c.addWorkingDaysFromOrderDate('2026-11-20', 1, []), '2026-11-21');
  assert.equal(c.addWorkingDaysFromOrderDate('2026-11-21', 1, []), '2026-11-23');
});

test('Sunday and configured holiday orders receive exactly one extra working day', () => {
  const c = loadCalendar();
  const sunday = c.computeConfirmationSchedule({
    placedAt: new Date('2026-11-15T18:00:00+05:30'),
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '6 working days',
    holidays: [],
  });
  assert.equal(sunday.orderDateIst, '2026-11-15');
  assert.equal(sunday.holidayAdjustmentApplied, true);
  assert.equal(sunday.tamilNaduWorkingDays, 7);
  assert.equal(sunday.expectedReadyDateIst, '2026-11-20');
  assert.equal(sunday.estimatedDeliveryDateIst, '2026-11-23');

  const holiday = c.computeConfirmationSchedule({
    placedAt: new Date('2026-11-17T10:00:00+05:30'),
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '6 working days',
    holidays: ['2026-11-17'],
  });
  assert.equal(holiday.holidayAdjustmentApplied, true);
  assert.equal(holiday.deliveryWorkingDays, 7);
});

test('holiday on Sunday is not double-counted and consecutive holidays are skipped', () => {
  const c = loadCalendar();
  const holidays = ['2026-11-22', '2026-11-23', '2026-11-24'];
  assert.equal(c.isNonWorkingYmd('2026-11-22', holidays), true);
  const date = c.addWorkingDaysFromOrderDate('2026-11-21', 1, holidays);
  assert.equal(date, '2026-11-25');
});

test('month, year and leap-year boundaries stay on IST calendar dates', () => {
  const c = loadCalendar();
  assert.equal(c.addCalendarDaysYmd('2026-11-30', 1), '2026-12-01');
  assert.equal(c.addCalendarDaysYmd('2026-12-31', 1), '2027-01-01');
  assert.equal(c.addCalendarDaysYmd('2024-02-28', 1), '2024-02-29');
  assert.equal(c.istYmd(new Date('2026-11-16T00:30:00+05:30')), '2026-11-16');
  assert.equal(c.istYmd(new Date('2026-11-15T23:30:00+05:30')), '2026-11-15');
});

test('Tamil Nadu 6-8 and other-state 12-15 share dispatch and use max days, including holiday +1', () => {
  const c = loadCalendar();
  const placedAt = new Date('2026-11-16T09:00:00+05:30');
  const holidays = [];
  const tn = c.computeConfirmationSchedule({
    placedAt,
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6-8 working days',
    destinationEstimate: '6-8 working days',
    holidays,
  });
  const mh = c.computeConfirmationSchedule({
    placedAt,
    destinationState: 'Maharashtra',
    tamilNaduEstimate: '6-8 working days',
    destinationEstimate: '12-15 working days',
    holidays,
  });
  assert.equal(tn.expectedReadyDateIst, mh.expectedReadyDateIst);
  assert.equal(tn.estimatedDeliveryDateIst, '2026-11-26');
  assert.equal(mh.estimatedDeliveryDateIst, '2026-12-04');
  assert.equal(tn.expectedReadyDateIst, '2026-11-24');
  assert.equal(tn.expectedReadyDateIst, c.subtractWorkingDaysFromDate(tn.tamilNaduDeliveryDateIst, 2, holidays));

  const holidayTn = c.computeConfirmationSchedule({
    placedAt: new Date('2026-11-15T12:00:00+05:30'),
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '6 working days',
    holidays,
  });
  const holidayOther = c.computeConfirmationSchedule({
    placedAt: new Date('2026-11-15T12:00:00+05:30'),
    destinationState: 'Kerala',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '12-15 working days',
    holidays,
  });
  assert.equal(holidayTn.expectedReadyDateIst, holidayOther.expectedReadyDateIst);
  assert.equal(holidayTn.deliveryWorkingDays, 7);
  assert.equal(holidayOther.deliveryWorkingDays, 16);
});

test('dispatch is two eligible working days before the Tamil Nadu delivery date', () => {
  const c = loadCalendar();
  const holidays = ['2026-11-19'];
  const schedule = c.computeConfirmationSchedule({
    placedAt: new Date('2026-11-16T09:00:00+05:30'),
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '6 working days',
    holidays,
  });
  assert.equal(schedule.estimatedDeliveryDateIst, c.addWorkingDaysFromOrderDate(schedule.expectedReadyDateIst, 2, holidays));
});

test('short Tamil Nadu configuration does not invent a same-day dispatch', () => {
  const c = loadCalendar();
  const schedule = c.computeConfirmationSchedule({
    placedAt: new Date('2026-11-16T09:00:00+05:30'),
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '2 working days',
    destinationEstimate: '2 working days',
    holidays: [],
  });
  assert.equal(schedule.ok, false);
  assert.equal(schedule.reason, 'tn_dispatch_offset_invalid');
});

test('confirmation email uses live order data, escapes HTML, and omits sample placeholders', () => {
  const email = loadEmail();
  const built = email.buildOrderConfirmationEmail({
    orderNumber: 'GG0450',
    shippingAddress: { fullName: 'A <script>name', email: 'buyer@example.com' },
    items: [
      { title: 'Frame & Gift', price: 1399, quantity: 1, variant: '12*10 inch' },
      { title: 'Mug', price: 499, quantity: 2 },
    ],
    confirmationSchedule: {
      expectedReadyDateIst: '2026-11-20',
      estimatedDeliveryDateIst: '2026-11-23',
    },
  });
  assert.equal(built.ok, true);
  assert.equal(built.subject, 'GroveryGiftz | Order Confirmed — #GG0450');
  assert.match(built.html, /GG0450/);
  assert.match(built.html, /Frame &amp; Gift/);
  assert.doesNotMatch(built.html, /<script>/);
  assert.match(built.html, /November 20, 2026/);
  assert.match(built.html, /November 23, 2026/);
  assert.match(built.text, /Mug × 2/);
  assert.doesNotMatch(built.html, /Solai Raja/);
  assert.doesNotMatch(built.subject, /GG0228/);
});

function loadSchedule() {
  const calendar = strip('src/lib/businessCalendar.js');
  const central = strip('src/lib/centralDeliveryEstimates.js');
  const schedule = strip('src/lib/orderConfirmationSchedule.js');
  const context = { console, Intl, Date, Number, String, Array, Math };
  vm.createContext(context);
  vm.runInContext(`${calendar}\n${central}\n${schedule}\nthis.api = { persistOrderConfirmationSchedule, buildOrderConfirmationSchedule, confirmationRecipientEmail, computeConfirmationSchedule };`, context);
  return context.api;
}

test('Asia/Kolkata midnight is the order-date boundary, not UTC', () => {
  const c = loadCalendar();
  assert.equal(c.istYmd(new Date('2026-11-15T18:29:59.000Z')), '2026-11-15');
  assert.equal(c.istYmd(new Date('2026-11-15T18:30:00.000Z')), '2026-11-16');
});

test('Sundays and named holiday objects are skipped while counting, including month and year edges', () => {
  const c = loadCalendar();
  const holidays = [{ date: '2026-12-25', name: 'Christmas' }, '2027-01-01'];
  assert.equal(c.isNonWorkingYmd('2026-12-25', holidays), true);
  assert.equal(c.isNonWorkingYmd('2026-12-27', holidays), true);
  assert.equal(c.addWorkingDaysFromOrderDate('2026-12-24', 2, holidays), '2026-12-28');
  assert.equal(c.addWorkingDaysFromOrderDate('2026-12-31', 1, holidays), '2027-01-02');
  const leap = c.addWorkingDaysFromOrderDate('2024-02-28', 1, []);
  assert.equal(leap, '2024-02-29');
});

test('holiday +1 is applied once even when consecutive holidays follow the order date', () => {
  const c = loadCalendar();
  const holidays = ['2026-11-17', '2026-11-18'];
  const schedule = c.computeConfirmationSchedule({
    placedAt: new Date('2026-11-17T11:00:00+05:30'),
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '6 working days',
    holidays,
  });
  assert.equal(schedule.holidayAdjustmentApplied, true);
  assert.equal(schedule.deliveryWorkingDays, 7);
  assert.equal(schedule.tamilNaduWorkingDays, 7);
  assert.equal(c.isSundayYmd(schedule.expectedReadyDateIst), false);
  assert.equal(c.isNonWorkingYmd(schedule.expectedReadyDateIst, holidays), false);
  assert.equal(c.isNonWorkingYmd(schedule.estimatedDeliveryDateIst, holidays), false);
});

test('confirmed snapshots stay frozen after Admin estimate and holiday changes', async () => {
  const api = loadSchedule();
  const order = {
    paidAt: new Date('2026-11-16T11:00:00+05:30'),
    shippingAddress: { state: 'Maharashtra', email: 'buyer@example.com' },
  };
  const firstSettings = {
    tamilNaduDeliveryEstimate: '6 working days',
    otherStateDeliveryEstimate: '12-15 working days',
    deliveryHolidays: [],
  };
  const first = await api.persistOrderConfirmationSchedule(order, firstSettings);
  assert.equal(first.ok, true);
  assert.equal(first.persisted, true);
  const ready = order.confirmationSchedule.expectedReadyDateIst;
  const delivery = order.confirmationSchedule.estimatedDeliveryDateIst;
  const later = await api.persistOrderConfirmationSchedule(order, {
    tamilNaduDeliveryEstimate: '6-8 working days',
    otherStateDeliveryEstimate: '20 working days',
    deliveryHolidays: ['2026-11-19'],
  });
  assert.equal(later.persisted, false);
  assert.equal(order.confirmationSchedule.expectedReadyDateIst, ready);
  assert.equal(order.confirmationSchedule.estimatedDeliveryDateIst, delivery);
});

test('historical paid orders without a snapshot are not backfilled with guessed dates', async () => {
  const api = loadSchedule();
  const order = {
    paidAt: new Date('2026-01-10T11:00:00+05:30'),
    shippingAddress: { state: 'Tamil Nadu', email: 'old@example.com' },
    deliveryEstimate: 'Within 8 days - expected by Mon, 19 Jan, 2026 (Sundays and government/public holidays skipped)',
  };
  const result = await api.persistOrderConfirmationSchedule(order, {
    tamilNaduDeliveryEstimate: '6 working days',
    otherStateDeliveryEstimate: '12-15 working days',
    deliveryHolidays: [],
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'historical_order_without_snapshot');
  assert.equal(order.confirmationSchedule, undefined);
});

test('same Indian order date shares dispatch across states', () => {
  const c = loadCalendar();
  const placedAt = new Date('2026-11-16T22:45:00+05:30');
  const states = ['Tamil Nadu', 'Kerala', 'Maharashtra', 'Delhi'];
  const ready = states.map((destinationState) => c.computeConfirmationSchedule({
    placedAt,
    destinationState,
    tamilNaduEstimate: '6 working days',
    destinationEstimate: destinationState === 'Tamil Nadu' ? '6 working days' : '12-15 working days',
    holidays: [],
  }).expectedReadyDateIst);
  assert.deepEqual(new Set(ready).size, 1);
  assert.equal(ready[0], '2026-11-21');
});

test('email layout stays table-based, escaped, and 600px wide for long names and many products', () => {
  const email = loadEmail();
  const built = email.buildOrderConfirmationEmail({
    orderNumber: 'GG0999',
    shippingAddress: {
      fullName: 'A Very Long Customer Name That Should Wrap Safely <img>',
      email: 'very.long.customer.address.for.wrapping@example.com',
    },
    items: [
      { title: 'Photo Cloud Combo with an Extremely Long Personalized Title', price: 1399, quantity: 1, variant: '12*10 inch / Cherry wood' },
      { title: 'Second Gift', price: 250, quantity: 3 },
      { title: 'Third Gift', price: 99, quantity: 1 },
    ],
    confirmationSchedule: {
      expectedReadyDateIst: '2026-11-20',
      estimatedDeliveryDateIst: '2026-11-23',
    },
  });
  assert.equal(built.ok, true);
  assert.match(built.html, /max-width:600px/);
  assert.match(built.html, /role="presentation"/);
  assert.match(built.html, /Photo Cloud Combo with an Extremely Long Personalized Title/);
  assert.match(built.html, /&lt;img&gt;/);
  assert.doesNotMatch(built.html, /Safely <img>/);
  assert.match(built.html, /Qty 3/);
  assert.doesNotMatch(built.html, /undefined|NaN|null/);
  assert.equal(email.buildOrderConfirmationEmail({ orderNumber: 'GG1', shippingAddress: { email: 'a@b.com' }, items: [{ title: 'X', price: 1, quantity: 1 }] }).ok, false);
});

function loadWebsiteDates() {
  const calendar = strip('src/lib/businessCalendar.js');
  const delivery = strip('src/lib/deliveryDate.js');
  const estimate = strip('src/lib/orderDeliveryEstimate.js');
  const context = { console, Intl, Date, Number, String, Array, Math };
  vm.createContext(context);
  vm.runInContext(`${calendar}\n${delivery}\n${estimate}\nthis.api = { buildDeliveryEstimateText, getConfirmedScheduleDates, getOrderDeliveryEstimate, computeConfirmationSchedule, formatLongIstDate };`, context);
  return context.api;
}

test('live website delivery dates match the confirmation email calendar engine', () => {
  const api = loadWebsiteDates();
  const holidays = ['2026-08-26'];
  const placedAt = new Date('2026-08-23T12:00:00+05:30');
  const schedule = api.computeConfirmationSchedule({
    placedAt,
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '8 working days',
    destinationEstimate: '8 working days',
    holidays,
  });
  assert.equal(schedule.ok, true);
  assert.equal(schedule.estimatedDeliveryDateIst, '2026-09-03');
  const live = api.buildDeliveryEstimateText('8 working days', { startDate: placedAt, holidays });
  assert.match(live, /September 3, 2026/);
  const emailReady = api.formatLongIstDate(schedule.expectedReadyDateIst);
  const emailDelivery = api.formatLongIstDate(schedule.estimatedDeliveryDateIst);
  const dates = api.getConfirmedScheduleDates({ confirmationSchedule: schedule });
  assert.equal(dates.expectedReadyDate, emailReady);
  assert.equal(dates.estimatedDeliveryDate, emailDelivery);
  const monday = new Date('2026-11-16T11:00:00+05:30');
  const tn = api.computeConfirmationSchedule({
    placedAt: monday,
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '6 working days',
    holidays: [],
  });
  const other = api.computeConfirmationSchedule({
    placedAt: monday,
    destinationState: 'Maharashtra',
    tamilNaduEstimate: '6 working days',
    destinationEstimate: '12-15 working days',
    holidays: [],
  });
  assert.equal(tn.expectedReadyDateIst, other.expectedReadyDateIst);
  assert.match(api.buildDeliveryEstimateText('6 working days', { startDate: monday, holidays: [] }), /November 24, 2026/);
  assert.match(api.buildDeliveryEstimateText('12-15 working days', { startDate: monday, holidays: [] }), /December 4, 2026/);
});

test('approved continuous Tamil Nadu queue matches Nov 15–27 fixture with feasible shared dispatch', () => {
  const c = loadCalendar();
  assert.equal(c.CONTINUOUS_QUEUE_EPOCH_IST, '2026-11-15');
  const holidays = ['2026-11-25', '2026-11-26'];
  const expected = {
    '2026-11-15': '2026-11-24',
    '2026-11-16': '2026-11-27',
    '2026-11-17': '2026-11-28',
    '2026-11-18': '2026-11-30',
    '2026-11-19': '2026-12-01',
    '2026-11-20': '2026-12-02',
    '2026-11-21': '2026-12-03',
    '2026-11-22': '2026-12-04',
    '2026-11-23': '2026-12-05',
    '2026-11-24': '2026-12-07',
    '2026-11-25': '2026-12-08',
    '2026-11-26': '2026-12-09',
    '2026-11-27': '2026-12-10',
  };
  let previous = '';
  for (const [orderDate, delivery] of Object.entries(expected)) {
    const schedule = c.computeConfirmationSchedule({
      placedAt: new Date(`${orderDate}T12:00:00+05:30`),
      destinationState: 'Tamil Nadu',
      tamilNaduEstimate: '7 working days',
      destinationEstimate: '7 working days',
      holidays,
    });
    assert.equal(schedule.ok, true, orderDate);
    assert.equal(schedule.estimatedDeliveryDateIst, delivery, orderDate);
    assert.equal(schedule.tamilNaduDeliveryDateIst, delivery, orderDate);
    assert.equal(
      schedule.expectedReadyDateIst,
      c.subtractWorkingDaysFromDate(delivery, 2, holidays),
      `${orderDate} dispatch`,
    );
    assert.ok(schedule.expectedReadyDateIst > orderDate, `${orderDate} dispatch after order`);
    assert.equal(c.isNonWorkingYmd(schedule.expectedReadyDateIst, holidays), false);
    assert.equal(c.isNonWorkingYmd(schedule.estimatedDeliveryDateIst, holidays), false);
    if (previous) {
      assert.equal(
        schedule.estimatedDeliveryDateIst,
        c.addWorkingDaysFromOrderDate(previous, 1, holidays),
        `${orderDate} continuous next slot`,
      );
    }
    previous = schedule.estimatedDeliveryDateIst;

    const kerala = c.computeConfirmationSchedule({
      placedAt: new Date(`${orderDate}T12:00:00+05:30`),
      destinationState: 'Kerala',
      tamilNaduEstimate: '7 working days',
      destinationEstimate: '12-15 working days',
      holidays,
    });
    assert.equal(kerala.ok, true, `${orderDate} Kerala`);
    assert.equal(kerala.expectedReadyDateIst, schedule.expectedReadyDateIst, `${orderDate} shared dispatch`);
    assert.ok(kerala.estimatedDeliveryDateIst >= kerala.expectedReadyDateIst, `${orderDate} Kerala after dispatch`);
  }

  // Empty intervening dates still consume queue slots.
  assert.equal(c.continuousDeliveryYmd('2026-11-18', 7, holidays), '2026-11-30');
  assert.equal(c.continuousDeliveryYmd('2026-11-18', 7, holidays), expected['2026-11-18']);
});

test('ten same-day orders share one continuous delivery and dispatch date', () => {
  const c = loadCalendar();
  const placedAts = Array.from({ length: 10 }, (_, index) => new Date(`2026-11-18T0${index}:15:00+05:30`));
  const schedules = placedAts.map((placedAt) => c.computeConfirmationSchedule({
    placedAt,
    destinationState: 'Tamil Nadu',
    tamilNaduEstimate: '7 working days',
    destinationEstimate: '7 working days',
    holidays: ['2026-11-25', '2026-11-26'],
  }));
  assert.ok(schedules.every((schedule) => schedule.ok));
  assert.equal(new Set(schedules.map((schedule) => schedule.estimatedDeliveryDateIst)).size, 1);
  assert.equal(new Set(schedules.map((schedule) => schedule.expectedReadyDateIst)).size, 1);
  assert.equal(schedules[0].estimatedDeliveryDateIst, '2026-11-30');
});

test('checkout and browser bundles do not contain SMTP secrets', () => {
  const checkout = fs.readFileSync(path.join(__dirname, '../src/components/checkout/CheckoutFlow.js'), 'utf8');
  assert.match(checkout, /Expected Ready Date/);
  assert.match(checkout, /Estimated Delivery Date/);
  assert.match(checkout, /expectedReadyDate/);
  assert.match(checkout, /estimatedDeliveryDate/);
  assert.match(checkout, /Email Confirmation/);
  assert.match(checkout, /We'll send your order confirmation to:/);
  assert.match(checkout, /We couldn't send your confirmation email yet/);
  assert.match(checkout, /Your order confirmation has been sent to:/);
  assert.match(checkout, /overflow-wrap:anywhere/);
  assert.match(checkout, /<wbr \/>/);
  assert.match(checkout, /Kindly take screenshot for your reference/);
  assert.doesNotMatch(checkout, /screen shot/);
  assert.doesNotMatch(checkout, /SMTP_PASSWORD|SMTP_HOST|MAIL_FROM|nodemailer|IMAP_PASSWORD|IMAP_HOST/);
  const emailLib = fs.readFileSync(path.join(__dirname, '../src/lib/email.js'), 'utf8');
  assert.match(emailLib, /SMTP_PASSWORD/);
  assert.match(emailLib, /MAIL_FROM/);
  assert.match(emailLib, /rejectUnauthorized: true/);
  assert.doesNotMatch(emailLib, /console\.(log|info|debug).*pass/i);
  const outbox = fs.readFileSync(path.join(__dirname, '../src/lib/orderConfirmationOutbox.js'), 'utf8');
  assert.match(outbox, /uniqueKey/);
  assert.match(outbox, /order-confirmation:\$\{String\(orderDoc\._id\)\}/);
  assert.match(outbox, /ambiguous_processing_timeout/);
  assert.match(outbox, /attempts: MAX_ATTEMPTS/);
  const finalize = fs.readFileSync(path.join(__dirname, '../src/lib/cashfreeOrderFinalization.js'), 'utf8');
  assert.match(finalize, /attachOrderConfirmation/);
  assert.match(finalize, /enqueueOrderConfirmationEmail/);
  assert.match(finalize, /paymentStatus !== 'paid'/);
  const confirmationApi = fs.readFileSync(path.join(__dirname, '../src/app/api/orders/confirmation-email/route.js'), 'utf8');
  assert.match(confirmationApi, /session\?\.user\?\.type !== 'customer'/);
  assert.match(confirmationApi, /customer: session\.user\.id/);
  assert.doesNotMatch(confirmationApi, /SMTP_/);
});

function loadImap() {
  const source = strip('src/lib/imapSentArchive.js');
  const context = { console, process, Buffer, Set, String, Array, Number };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.api = { discoverSentMailboxPath, getImapConfig, safeImapError, normalizeMessageId };`, context);
  return context.api;
}

test('IMAP Sent folder discovery uses special-use then verified names', () => {
  const imap = loadImap();
  assert.equal(imap.discoverSentMailboxPath([
    { path: 'INBOX' },
    { path: 'Drafts', specialUse: '\\Drafts' },
    { path: 'Sent Items', specialUse: '\\Sent' },
    { path: 'Sent' },
  ]), 'Sent Items');
  assert.equal(imap.discoverSentMailboxPath([
    { path: 'INBOX' },
    { path: 'Sent Messages', specialUseFlags: new Set(['\\Sent']) },
  ]), 'Sent Messages');
  assert.equal(imap.discoverSentMailboxPath([
    { path: 'INBOX' },
    { path: 'Sent' },
  ]), 'Sent');
  assert.equal(imap.discoverSentMailboxPath([{ path: 'INBOX' }, { path: 'Junk' }]), '');
  assert.equal(imap.normalizeMessageId('<abc@mail>'), 'abc@mail');
});

test('compiled RFC message keeps recipient, subject, html and text parts', async () => {
  const nodemailer = require('nodemailer');
  const compiler = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  const info = await compiler.sendMail({
    from: 'GroveryGiftz <orders@example.com>',
    to: 'buyer@example.com',
    subject: 'GroveryGiftz | Order Confirmed — #GG0450',
    text: 'Expected Ready Date: November 20, 2026',
    html: '<p>Expected Ready Date: November 20, 2026</p>',
  });
  const raw = String(info.message);
  assert.match(raw, /buyer@example.com/);
  assert.match(raw, /GG0450/);
  assert.match(raw, /text\/plain/);
  assert.match(raw, /text\/html/);
  assert.match(raw, /Message-ID:/i);
});

test('archive failures do not resend customer email and skip duplicate Sent copies', () => {
  const outbox = fs.readFileSync(path.join(__dirname, '../src/lib/orderConfirmationOutbox.js'), 'utf8');
  const archiveFn = outbox.slice(outbox.indexOf('async function archiveSentCopy'));
  assert.match(outbox, /archiveRfc822ToSent/);
  assert.match(outbox, /processPendingArchives/);
  assert.doesNotMatch(archiveFn.slice(0, 2500), /sendTransactionalEmail/);
  assert.doesNotMatch(archiveFn.slice(0, 2500), /job\.status\s*=/);
  const imap = fs.readFileSync(path.join(__dirname, '../src/lib/imapSentArchive.js'), 'utf8');
  assert.match(imap, /alreadyPresent/);
  assert.match(imap, /IMAP_PASSWORD/);
  assert.match(imap, /rejectUnauthorized: true/);
  assert.doesNotMatch(imap, /console\.(log|info|debug)/);
  const admin = fs.readFileSync(path.join(__dirname, '../src/app/account/manage/orders/page.js'), 'utf8');
  assert.match(admin, /Confirmation email/);
  assert.match(admin, /Accepted by mail server/);
  assert.match(admin, /Saved in Sent Items/);
  assert.match(admin, /does not guarantee the customer received/);
  assert.doesNotMatch(admin, /IMAP_PASSWORD|SMTP_PASSWORD|rawRfc822/);
  const view = outbox.slice(outbox.indexOf('export function adminConfirmationEmailView'));
  assert.doesNotMatch(view.slice(0, 900), /rawRfc822/);
});
