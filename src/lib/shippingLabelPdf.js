import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import bwipImport from 'bwip-js';

const bwipjs = bwipImport?.toBuffer ? bwipImport : (bwipImport?.default || bwipImport);

/** A4 in PDF points (1 pt = 1/72 in). 210mm × 297mm. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

const PAGE_MARGIN = 22.5;
const GUTTER = 12;
const RULE = rgb(0.82, 0.82, 0.82);
const BORDER = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.28, 0.28, 0.28);
const INK = rgb(0.05, 0.05, 0.05);
const BRAND = rgb(0.141, 0.337, 0.847); // #2456D8
const ACCENT = rgb(0.957, 0.475, 0.125); // #F47920
const PILL_BG = rgb(0.93, 0.93, 0.94);
const WAVE_BLUE = rgb(0.141, 0.337, 0.847);
const WAVE_ORANGE = rgb(0.957, 0.475, 0.125);

function winAnsiSafe(text = '') {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapLines(font, text, size, maxWidth) {
  const safeMax = Math.max(12, Number(maxWidth) || 12);
  const words = winAnsiSafe(text).split(' ').filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= safeMax) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function fitText(font, text, size, maxWidth) {
  let line = winAnsiSafe(text);
  if (!line) return '';
  while (line.length > 1 && font.widthOfTextAtSize(line, size) > maxWidth) line = line.slice(0, -1);
  return line;
}

function drawWrapped(page, font, text, {
  x, y, size, maxWidth, color = INK, lineHeight, maxLines = 20,
}) {
  const lh = Number(lineHeight) || (Number(size) + 2);
  const startY = Number(y);
  if (!Number.isFinite(startY)) return { lines: 0, bottom: startY };
  const lines = wrapLines(font, text, size, maxWidth).slice(0, Math.max(1, maxLines));
  let cursor = startY;
  lines.forEach((line) => {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= lh;
  });
  return { lines: lines.length, bottom: cursor };
}

function drawHairline(page, x1, x2, y) {
  if (!Number.isFinite(y)) return;
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.7,
    color: RULE,
  });
}

function drawRoundedRect(page, {
  x, y, width, height, color = PILL_BG, radius = 4,
}) {
  // pdf-lib has no native rounded rect — approximate with filled rect (print-safe).
  page.drawRectangle({ x, y, width, height, color, borderWidth: 0 });
  void radius;
}

/** Compact pin drawn inside a reserved column — never overlaps adjacent text. */
function drawPinIcon(page, cx, cy, size, accent = ACCENT) {
  const r = Math.max(2.2, size * 0.28);
  page.drawCircle({ x: cx, y: cy + r * 0.2, size: r, color: accent });
  page.drawCircle({ x: cx, y: cy + r * 0.2, size: r * 0.36, color: rgb(1, 1, 1) });
  // Narrow tip kept fully under the circle (within ±r horizontally).
  page.drawRectangle({
    x: cx - r * 0.22,
    y: cy - r * 0.85,
    width: r * 0.44,
    height: r * 0.75,
    color: accent,
  });
}

async function embedLogo(pdf, logoUrl, origin) {
  if (!logoUrl) return null;
  try {
    let url = String(logoUrl);
    if (url.startsWith('/')) {
      const base = String(origin || process.env.NEXTAUTH_URL || 'https://groverygiftz.in').replace(/\/$/, '');
      url = `${base}${url}`;
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (type.includes('png') || url.toLowerCase().includes('.png')) return pdf.embedPng(bytes);
    if (type.includes('jpeg') || type.includes('jpg') || /\.jpe?g(\?|$)/i.test(url)) return pdf.embedJpg(bytes);
    try {
      return await pdf.embedPng(bytes);
    } catch {
      return await pdf.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

async function qrPngBytes(url) {
  return QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: { dark: '#111111', light: '#FFFFFF' },
  });
}

async function barcodePngBytes(text) {
  const value = winAnsiSafe(text).slice(0, 32) || 'ORDER';
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: value,
    scale: 4,
    height: 14,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
}

function labelRects(layout = {}) {
  const usableW = A4_WIDTH - PAGE_MARGIN * 2;
  const usableH = A4_HEIGHT - PAGE_MARGIN * 2;
  const cols = Math.max(1, Number(layout.cols) || 1);
  const rows = Math.max(1, Number(layout.rows) || 1);
  const cellW = (usableW - GUTTER * (cols - 1)) / cols;
  const cellH = (usableH - GUTTER * (rows - 1)) / rows;
  const rects = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = PAGE_MARGIN + c * (cellW + GUTTER);
      const yTopOffset = PAGE_MARGIN + r * (cellH + GUTTER);
      const y = A4_HEIGHT - yTopOffset - cellH;
      rects.push({ x, y, width: cellW, height: cellH });
    }
  }
  return rects;
}

function scaleFor(perPage) {
  // Layout-specific type scales — single/2-up must fill the cell; 4-up stays dense but readable.
  if (perPage >= 4) {
    return {
      pad: 9,
      logoH: 26,
      logoMaxW: 86,
      titleSize: 10,
      orderIdSize: 8,
      sectionSize: 8,
      bodySize: 8.5,
      nameSize: 11,
      smallSize: 7,
      qrSize: 56,
      qtyCol: 28,
      headerBand: 36,
      barcodeH: 24,
      footerWave: 6,
      thanksH: 12,
      lh: 11,
      nameLh: 13,
      metaW: 0.32,
      afterItemsGap: 10,
      pinCol: 16,
    };
  }
  if (perPage === 2) {
    return {
      pad: 14,
      logoH: 34,
      logoMaxW: 112,
      titleSize: 14,
      orderIdSize: 11,
      sectionSize: 10,
      bodySize: 11,
      nameSize: 15,
      smallSize: 9,
      qrSize: 78,
      qtyCol: 38,
      headerBand: 44,
      barcodeH: 30,
      footerWave: 8,
      thanksH: 14,
      lh: 14,
      nameLh: 18,
      metaW: 0.3,
      afterItemsGap: 12,
      pinCol: 18,
    };
  }
  return {
    pad: 22,
    logoH: 50,
    logoMaxW: 168,
    titleSize: 20,
    orderIdSize: 13,
    sectionSize: 13,
    bodySize: 14,
    nameSize: 22,
    smallSize: 11,
    qrSize: 112,
    qtyCol: 52,
    headerBand: 58,
    barcodeH: 40,
    footerWave: 14,
    thanksH: 18,
    lh: 19,
    nameLh: 26,
    metaW: 0.28,
    afterItemsGap: 22,
    pinCol: 28,
  };
}

function addressLines(order) {
  const lines = [];
  if (order.line1) lines.push(order.line1);
  if (order.line2) lines.push(order.line2);
  if (order.landmark) lines.push(`Landmark: ${order.landmark}`);
  const cityState = [order.city, order.state].filter(Boolean).join(', ');
  const cityLine = [cityState, order.pincode ? `- ${order.pincode}` : ''].filter(Boolean).join(' ').trim();
  if (cityLine) lines.push(cityLine);
  return lines;
}

function drawBrandWave(page, rect, pad, waveH) {
  const y = rect.y + pad * 0.35;
  const w = rect.width - pad * 2;
  const x = rect.x + pad;
  page.drawRectangle({ x, y, width: w * 0.62, height: waveH, color: WAVE_BLUE, borderWidth: 0 });
  page.drawRectangle({
    x: x + w * 0.58,
    y,
    width: w * 0.42,
    height: waveH,
    color: WAVE_ORANGE,
    borderWidth: 0,
  });
}

function drawLabel(page, {
  rect,
  order,
  company,
  font,
  bold,
  logo,
  qrImage,
  barcodeImage,
  perPage,
}) {
  if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
    throw new Error(`Invalid label rect: ${JSON.stringify(rect)}`);
  }

  const s = scaleFor(perPage);
  const pad = s.pad;
  const innerX = rect.x + pad;
  const innerRight = rect.x + rect.width - pad;
  const maxW = rect.width - pad * 2;
  // Only reserve the brand-wave strip at the bottom — barcode/thanks follow content.
  const waveFloor = rect.y + pad * 0.35 + s.footerWave + 6;
  const contentFloor = waveFloor + s.barcodeH + s.thanksH + s.afterItemsGap;
  let y = rect.y + rect.height - pad;

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: BORDER,
    borderWidth: 1.25,
  });

  // —— Header: logo left | Shipping Label + Order ID pill right ——
  const logoH = s.logoH;
  const logoW = logo ? Math.min(s.logoMaxW, (logo.width / logo.height) * logoH) : 0;
  const brandName = company.tradeName || company.siteName || 'GroveryGiftz';

  if (logo) {
    page.drawImage(logo, {
      x: innerX,
      y: y - logoH,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawText(fitText(bold, brandName, s.titleSize, maxW * 0.45), {
      x: innerX,
      y: y - Math.round(logoH * 0.62),
      size: s.titleSize,
      font: bold,
      color: BRAND,
    });
  }

  const title = 'Shipping Label';
  const titleW = bold.widthOfTextAtSize(title, s.titleSize);
  page.drawText(title, {
    x: innerRight - titleW,
    y: y - 12,
    size: s.titleSize,
    font: bold,
    color: BRAND,
  });

  const pillText = fitText(bold, `Order ID: ${order.orderNumber || ''}`, s.orderIdSize, maxW * 0.5);
  const pillPadX = 7;
  const pillPadY = 4;
  const pillW = bold.widthOfTextAtSize(pillText, s.orderIdSize) + pillPadX * 2;
  const pillH = s.orderIdSize + pillPadY * 2;
  const pillX = innerRight - pillW;
  const pillY = y - 12 - s.orderIdSize - 5 - pillPadY;
  drawRoundedRect(page, { x: pillX, y: pillY, width: pillW, height: pillH, color: PILL_BG });
  page.drawText(pillText, {
    x: pillX + pillPadX,
    y: pillY + pillPadY,
    size: s.orderIdSize,
    font: bold,
    color: INK,
  });

  y = Math.min(y - s.headerBand, pillY - 8);
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 6;

  // —— FROM + QR ——
  const qrSize = Math.min(s.qrSize, maxW * 0.3);
  const fromWidth = Math.max(70, maxW - qrSize - 12);
  const qrX = innerRight - qrSize;
  const fromTop = y;

  page.drawText('FROM', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 4;
  const fromName = drawWrapped(page, bold, brandName, {
    x: innerX, y, size: s.bodySize + 0.5, maxWidth: fromWidth, lineHeight: s.lh, maxLines: 2,
  });
  y = fromName.bottom;
  if (company.returnAddress) {
    const addr = drawWrapped(page, font, company.returnAddress, {
      x: innerX, y, size: s.smallSize, maxWidth: fromWidth, color: INK,
      lineHeight: s.smallSize + 2.5, maxLines: perPage >= 4 ? 3 : 4,
    });
    y = addr.bottom;
  }
  if (company.phone) {
    page.drawText(fitText(bold, `Ph: ${company.phone}`, s.bodySize, fromWidth), {
      x: innerX, y, size: s.bodySize, font: bold, color: INK,
    });
    y -= s.lh;
  }

  const qrY = fromTop - qrSize + s.sectionSize;
  if (qrImage) {
    const drawY = Math.max(waveFloor + 2, qrY);
    page.drawImage(qrImage, { x: qrX, y: drawY, width: qrSize, height: qrSize });
    const caption = 'Scan to Track Order';
    const capW = bold.widthOfTextAtSize(caption, s.smallSize);
    const capY = drawY - (s.smallSize + 3);
    if (capY > waveFloor) {
      page.drawText(caption, {
        x: qrX + Math.max(0, (qrSize - capW) / 2),
        y: capY,
        size: s.smallSize,
        font: bold,
        color: MUTED,
      });
    }
    y = Math.min(y, capY - 6);
  }
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 6;

  // —— SHIP TO (left) + ORDER DATE (right) — no estimated delivery ——
  const metaW = Math.max(78, maxW * s.metaW);
  const shipW = Math.max(80, maxW - metaW - 10);
  const shipTop = y;

  page.drawText('SHIP TO', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 4;

  // Reserved pin column — icon stays left of text with a hard clearance gap.
  const pinCol = Math.max(18, Number(s.pinCol) || 18);
  const pinSize = Math.min(pinCol * 0.55, s.nameSize * 0.55);
  const pinCx = innerX + pinCol / 2;
  const pinCy = y + s.nameSize * 0.22;
  drawPinIcon(page, pinCx, pinCy, pinSize, ACCENT);
  const nameX = innerX + pinCol + 8;
  const name = drawWrapped(page, bold, order.recipientName || '', {
    x: nameX,
    y,
    size: s.nameSize,
    maxWidth: Math.max(40, shipW - (nameX - innerX)),
    lineHeight: s.nameLh,
    maxLines: 2,
  });
  y = name.bottom;

  for (const line of addressLines(order)) {
    if (y < contentFloor + s.lh * 5) break;
    const drawn = drawWrapped(page, font, line, {
      x: innerX, y, size: s.bodySize, maxWidth: shipW, lineHeight: s.lh, maxLines: 2,
    });
    y = drawn.bottom;
  }
  if (order.phone && y >= contentFloor + s.lh * 4) {
    page.drawText(fitText(bold, `Mobile: ${order.phone}`, s.bodySize + 0.5, shipW), {
      x: innerX, y, size: s.bodySize + 0.5, font: bold, color: INK,
    });
    y -= s.lh + 2;
  }

  let metaY = shipTop;
  const metaX = innerRight - metaW;
  page.drawText('ORDER DATE', { x: metaX, y: metaY, size: s.sectionSize - 1, font: bold, color: MUTED });
  metaY -= s.sectionSize + 2;
  const dateDrawn = drawWrapped(page, bold, order.orderDateIst || '-', {
    x: metaX, y: metaY, size: s.bodySize, maxWidth: metaW, lineHeight: s.lh, maxLines: 3, color: INK,
  });
  metaY = dateDrawn.bottom;

  y = Math.min(y, metaY) - 6;
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 5;

  // —— Order Items | Qty (never price) ——
  page.drawText('ORDER ITEMS', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 3;
  const qtyCol = s.qtyCol;
  const productColW = Math.max(48, maxW - qtyCol - 6);
  page.drawText('Item', { x: innerX, y, size: s.smallSize, font: bold, color: MUTED });
  page.drawText('Qty', { x: innerRight - qtyCol, y, size: s.smallSize, font: bold, color: MUTED });
  y -= 3;
  drawHairline(page, innerX, innerRight, y);
  y -= s.bodySize + 2;

  const items = Array.isArray(order.items) ? [...order.items] : [];
  let remaining = items;
  let drawnCount = 0;
  while (remaining.length && y - s.lh >= contentFloor + 2) {
    const item = remaining[0];
    const title = `${item.title || 'Product'}${item.variant ? ` (${item.variant})` : ''}`;
    const titleLines = wrapLines(font, title, s.bodySize, productColW);
    if (y - titleLines.length * s.lh < contentFloor + 2) break;
    remaining.shift();
    let cursor = y;
    titleLines.forEach((line, idx) => {
      page.drawText(line, { x: innerX, y: cursor, size: s.bodySize, font: bold, color: INK });
      if (idx === 0) {
        page.drawText(String(item.quantity || 1), {
          x: innerRight - qtyCol + 2,
          y: cursor,
          size: s.bodySize,
          font: bold,
          color: INK,
        });
      }
      cursor -= s.lh;
    });
    y = cursor - 2;
    drawnCount += 1;
  }
  if (remaining.length && y >= contentFloor + 2) {
    const units = remaining.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    page.drawText(
      fitText(font, `+ ${remaining.length} more / ${units} unit(s) — try 2-label or single layout`, s.smallSize, maxW),
      { x: innerX, y: Math.max(contentFloor + 2, y), size: s.smallSize, font, color: MUTED },
    );
    y -= s.lh;
  } else if (!drawnCount) {
    page.drawText('No items listed', { x: innerX, y, size: s.bodySize, font, color: MUTED });
    y -= s.lh;
  }

  // —— Barcode + thanks flow after content (closes the empty middle gap) ——
  y -= s.afterItemsGap;
  if (y - s.barcodeH - s.thanksH < waveFloor + 2) {
    y = waveFloor + s.barcodeH + s.thanksH + 4;
  }
  drawHairline(page, innerX, innerRight, y);
  y -= 6;

  if (barcodeImage) {
    const barcodeH = s.barcodeH;
    const barcodeW = Math.min(maxW * 0.7, (barcodeImage.width / barcodeImage.height) * barcodeH);
    const barcodeY = y - barcodeH;
    page.drawImage(barcodeImage, {
      x: innerX,
      y: barcodeY,
      width: barcodeW,
      height: barcodeH,
    });
    const codeLabel = fitText(bold, order.orderNumber || '', s.smallSize, barcodeW);
    page.drawText(codeLabel, {
      x: innerX + Math.max(0, (barcodeW - bold.widthOfTextAtSize(codeLabel, s.smallSize)) / 2),
      y: barcodeY - s.smallSize - 1,
      size: s.smallSize,
      font: bold,
      color: MUTED,
    });
    y = barcodeY - s.smallSize - 6;
  }

  const thanks = 'Thank you for shopping with GroveryGiftz!';
  const thanksSize = Math.max(s.smallSize, s.bodySize - 1);
  const thanksW = bold.widthOfTextAtSize(thanks, thanksSize);
  page.drawText(thanks, {
    x: innerX + Math.max(0, (maxW - thanksW) / 2),
    y: Math.max(waveFloor + 2, y - thanksSize),
    size: thanksSize,
    font: bold,
    color: BRAND,
  });

  // Brand wave stays pinned to the label bottom edge only.
  drawBrandWave(page, rect, pad, Math.max(5, s.footerWave));
}

export async function buildShippingLabelsPdf({
  orders = [],
  company = {},
  layout,
  origin = '',
} = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(pdf, company.logoUrl, origin);

  const perPageRaw = Math.max(1, Number(layout?.perPage) || 1);
  const resolvedLayout = { cols: 1, rows: 1, perPage: 1 };
  if (perPageRaw >= 4) {
    resolvedLayout.cols = 2;
    resolvedLayout.rows = 2;
    resolvedLayout.perPage = 4;
  } else if (perPageRaw === 2) {
    resolvedLayout.cols = 1;
    resolvedLayout.rows = 2;
    resolvedLayout.perPage = 2;
  }

  const rects = labelRects(resolvedLayout);
  const perPage = Math.max(1, rects.length);

  const qrImages = [];
  const barcodeImages = [];
  for (const order of orders) {
    if (order.trackUrl) {
      try {
        qrImages.push(await pdf.embedPng(await qrPngBytes(order.trackUrl)));
      } catch {
        qrImages.push(null);
      }
    } else qrImages.push(null);

    try {
      barcodeImages.push(await pdf.embedPng(await barcodePngBytes(order.orderNumber || order.id || 'ORDER')));
    } catch {
      barcodeImages.push(null);
    }
  }

  const pageCount = orders.length ? Math.ceil(orders.length / perPage) : 0;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage();
    page.setSize(A4_WIDTH, A4_HEIGHT);
    for (let slot = 0; slot < perPage; slot += 1) {
      const orderIndex = pageIndex * perPage + slot;
      if (orderIndex >= orders.length) break;
      drawLabel(page, {
        rect: rects[slot],
        order: orders[orderIndex],
        company,
        font,
        bold,
        logo,
        qrImage: qrImages[orderIndex],
        barcodeImage: barcodeImages[orderIndex],
        perPage,
      });
    }
  }

  return Buffer.from(await pdf.save());
}

export function shippingLabelFilename(date = new Date()) {
  const ist = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return `GroveryGiftz-Shipping-Labels-${ist}.pdf`;
}
