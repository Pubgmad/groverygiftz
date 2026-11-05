/**
 * Parse pasted WhatsApp customer details into structured shipping fields.
 * Never invent missing data; uncertain fields stay empty for staff correction.
 */

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const STATE_ALIASES = {
  tn: 'Tamil Nadu',
  'tamilnadu': 'Tamil Nadu',
  'tamil nadu': 'Tamil Nadu',
  ka: 'Karnataka',
  kl: 'Kerala',
  ap: 'Andhra Pradesh',
  ts: 'Telangana',
  mh: 'Maharashtra',
  dl: 'Delhi',
  'new delhi': 'Delhi',
};

function digitsOnly(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhone(raw = '') {
  let d = digitsOnly(raw);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length !== 10) return '';
  if (!/^[6-9]/.test(d)) return '';
  return d;
}

function looksLikeName(line = '') {
  const text = String(line || '').trim();
  if (!text || text.length < 2 || text.length > 80) return false;
  if (/\d{6,}/.test(text)) return false;
  if (/[@:]/.test(text)) return false;
  if (/^(name|customer|address|phone|whatsapp|wa|mobile|pincode|pin|city|state|landmark|district)\b/i.test(text)) return false;
  const letters = (text.match(/[A-Za-z\u0B80-\u0BFF]/g) || []).length;
  return letters >= 2;
}

function stripLabel(line = '') {
  return String(line || '')
    .replace(/^(name|customer\s*name|customer|phone|mobile|whatsapp|wa|whatsapp\s*number|address|addr|line\s*1|line\s*2|landmark|district|city|state|pincode|pin\s*code|pin)\s*[:\-–]\s*/i, '')
    .trim();
}

const AMBIGUOUS_STATE_FRAGMENTS = new Set([
  'pradesh', 'islands', 'nagar', 'and', 'the', 'india', 'state',
]);

function matchState(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase().replace(/\./g, '').trim();
  if (STATE_ALIASES[lower]) return STATE_ALIASES[lower];
  const found = INDIAN_STATES.find((s) => s.toLowerCase() === lower);
  if (found) return found;
  // Never steal street/locality lines into state (e.g. "Assam Colony Road")
  if (/\b(street|st\.?|road|rd\.?|nagar|colony|layout|avenue|cross|block|floor|apartment|apt\.?|flat|door|gate|house|no\.?)\b/i.test(raw)) {
    return '';
  }
  // Whole-word / near-exact only — never match short substrings like "and" → Andaman
  if (lower.length < 4 || AMBIGUOUS_STATE_FRAGMENTS.has(lower)) return '';

  // Line contains full state name only when leftover is empty / "India"
  const byFullName = INDIAN_STATES.find((s) => {
    const sLower = s.toLowerCase();
    if (!lower.includes(sLower) || sLower.length < 4) return false;
    const leftover = lower.replace(sLower, '').replace(/[,.\-\s]/g, '').trim();
    return leftover === '' || leftover === 'india';
  });
  if (byFullName) return byFullName;

  // Partial unique match (e.g. "tamil" → Tamil Nadu); refuse if multiple states match
  const wordBoundary = new RegExp(`(?:^|[^a-z])${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z])`);
  const partials = INDIAN_STATES.filter((s) => {
    const sLower = s.toLowerCase();
    return lower.length >= 5 && sLower.includes(lower) && wordBoundary.test(sLower);
  });
  return partials.length === 1 ? partials[0] : '';
}

/**
 * @param {string} pasted
 * @returns {{
 *  fields: object,
 *  confidence: object,
 *  warnings: string[],
 *  unmatchedLines: string[],
 * }}
 */
export function parseWhatsAppCustomerDetails(pasted = '') {
  const original = String(pasted || '');
  const lines = original
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(stripLabel)
    .filter(Boolean);

  const fields = {
    customerName: '',
    phone: '',
    whatsappNumber: '',
    line1: '',
    line2: '',
    landmark: '',
    district: '',
    city: '',
    state: '',
    pincode: '',
  };
  const confidence = {};
  const warnings = [];
  const unmatchedLines = [];
  const used = new Set();

  // Phones first (so "9876543210 600001" keeps the phone)
  const phones = [];
  for (let i = 0; i < lines.length; i += 1) {
    const candidates = String(lines[i]).match(/(?:\+?91[\s-]*)?[6-9]\d{9}|\b0?[6-9]\d{9}\b/g) || [];
    candidates.forEach((raw) => {
      const phone = normalizePhone(raw);
      if (phone && !phones.includes(phone)) phones.push(phone);
    });
    if (candidates.length) {
      // Strip phones from line; keep remainder for address/pincode parsing
      let remainder = String(lines[i]);
      candidates.forEach((raw) => {
        remainder = remainder.replace(raw, ' ');
      });
      remainder = remainder.replace(/\s+/g, ' ').trim();
      if (remainder) lines[i] = remainder;
      else used.add(i);
    }
  }

  // Pincode — extract pin; keep leftover street text on the same line
  for (let i = 0; i < lines.length; i += 1) {
    if (used.has(i)) continue;
    const m = lines[i].match(/\b([1-9][0-9]{5})\b/);
    if (m) {
      fields.pincode = m[1];
      confidence.pincode = 'high';
      const remainder = lines[i].replace(m[1], ' ').replace(/[,\s]+/g, ' ').trim();
      if (remainder) lines[i] = remainder;
      else used.add(i);
      break;
    }
  }
  if (phones[0]) {
    fields.phone = phones[0];
    confidence.phone = 'high';
  }
  if (phones[1]) {
    fields.whatsappNumber = phones[1];
    confidence.whatsappNumber = 'medium';
  } else if (phones[0]) {
    fields.whatsappNumber = phones[0];
    confidence.whatsappNumber = 'low';
  }

  function looksLikeStreetAddress(line = '') {
    const text = String(line || '').trim();
    if (!text) return false;
    if (/^\d+[\/\-]?\d*/.test(text)) return true;
    if (/\b(street|st\.?|road|rd\.?|nagar|colony|layout|avenue|cross|block|floor|apartment|apt\.?|flat|door|gate|house|no\.?)\b/i.test(text)) {
      return true;
    }
    return false;
  }

  // State — skip street-like lines so locality names are not consumed as state
  for (let i = 0; i < lines.length; i += 1) {
    if (used.has(i)) continue;
    if (looksLikeStreetAddress(lines[i])) continue;
    const state = matchState(lines[i]);
    if (state && lines[i].length < 40) {
      fields.state = state;
      confidence.state = 'high';
      used.add(i);
      break;
    }
  }
  if (!fields.state) {
    for (let i = 0; i < lines.length; i += 1) {
      if (used.has(i)) continue;
      if (looksLikeStreetAddress(lines[i])) continue;
      const state = matchState(lines[i]);
      if (state) {
        fields.state = state;
        confidence.state = 'medium';
        break;
      }
    }
  }

  // Landmark
  for (let i = 0; i < lines.length; i += 1) {
    if (used.has(i)) continue;
    if (/landmark|near\b|opp\.?|opposite|behind/i.test(lines[i])) {
      fields.landmark = lines[i].replace(/^(landmark|near)\s*[:\-]?\s*/i, '').trim();
      confidence.landmark = 'medium';
      used.add(i);
      break;
    }
  }

  // Name: first unused name-like line (never steal street addresses)
  for (let i = 0; i < lines.length; i += 1) {
    if (used.has(i)) continue;
    if (looksLikeStreetAddress(lines[i])) continue;
    if (looksLikeName(lines[i])) {
      fields.customerName = lines[i].replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').trim();
      confidence.customerName = i === 0 ? 'high' : 'medium';
      used.add(i);
      break;
    }
  }

  // Remaining lines → address / city / district
  const addressLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (used.has(i)) continue;
    const line = lines[i];
    // "City, State" only — never treat "12, Anna Nagar Main Road" as city/district
    const cityState = line.match(/^([^,]+),\s*([^,]+)$/);
    if (cityState && !fields.city && !looksLikeStreetAddress(line)) {
      const left = cityState[1].trim();
      const right = cityState[2].trim();
      const rightState = matchState(right);
      if (rightState && looksLikeName(left) && left.length < 40) {
        fields.city = left;
        fields.state = fields.state || rightState;
        confidence.city = 'medium';
        used.add(i);
        continue;
      }
    }
    if (/district/i.test(line) && !fields.district) {
      fields.district = line.replace(/district/ig, '').replace(/[:\-]/g, ' ').trim();
      confidence.district = 'medium';
      used.add(i);
      continue;
    }
    if (/^city\b/i.test(line) && !fields.city) {
      fields.city = line.replace(/^city\b/i, '').replace(/[:\-]/g, ' ').trim();
      confidence.city = 'medium';
      used.add(i);
      continue;
    }
    addressLines.push(line);
    used.add(i);
  }

  // Prefer street-like lines for address; city-like leftover becomes city
  const streetish = [];
  const placeish = [];
  addressLines.forEach((line) => {
    if (looksLikeStreetAddress(line)) streetish.push(line);
    else placeish.push(line);
  });

  if (streetish[0]) {
    fields.line1 = streetish[0];
    confidence.line1 = 'medium';
  } else if (addressLines[0]) {
    fields.line1 = addressLines[0];
    confidence.line1 = 'low';
  }
  if (streetish[1]) {
    fields.line2 = streetish[1];
    confidence.line2 = 'medium';
  }

  if (!fields.city) {
    const cityCandidate = placeish.find((line) => (
      looksLikeName(line)
      && line.length < 40
      && !matchState(line)
      && !looksLikeStreetAddress(line)
    ));
    if (cityCandidate) {
      fields.city = cityCandidate;
      confidence.city = 'medium';
    }
  }
  // Do not invent city from street line2 — leave empty for staff correction

  placeish.forEach((line) => {
    if (line !== fields.city && line !== fields.line1 && line !== fields.line2) {
      unmatchedLines.push(line);
    }
  });
  if (streetish.length > 2) unmatchedLines.push(...streetish.slice(2));

  if (!fields.customerName) warnings.push('Could not detect customer name — enter manually.');
  if (!fields.phone) warnings.push('Could not detect a valid 10-digit phone — enter manually.');
  if (!fields.pincode) warnings.push('Could not detect pincode — enter manually.');
  if (!fields.line1) warnings.push('Could not detect address line 1 — enter manually.');
  if (!fields.city) warnings.push('Could not detect city — enter manually.');
  if (!fields.state) warnings.push('Could not detect state — enter manually.');

  return { fields, confidence, warnings, unmatchedLines, original };
}

export function validateParsedCustomer(fields = {}) {
  const errors = [];
  if (!String(fields.customerName || '').trim()) errors.push('Customer name is required');
  const phone = normalizePhone(fields.phone);
  if (!phone) errors.push('Valid 10-digit phone number is required');
  const pin = String(fields.pincode || '').replace(/\D/g, '');
  if (pin.length !== 6) errors.push('Valid 6-digit pincode is required');
  if (!String(fields.line1 || '').trim()) errors.push('Address line 1 is required');
  if (!String(fields.city || '').trim()) errors.push('City is required');
  if (!String(fields.state || '').trim()) errors.push('State is required');
  return { ok: errors.length === 0, errors, phone, pincode: pin };
}
