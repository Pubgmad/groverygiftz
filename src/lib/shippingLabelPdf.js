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
const MUTED = rgb(0.4, 0.4, 0.4);
const INK = rgb(0.1, 0.1, 0.1);
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

function drawPinIcon(page, cx, cy, size, accent = ACCENT) {
  const r = size * 0.38;
  page.drawCircle({ x: cx, y: cy + size * 0.12, size: r, color: accent });
  page.drawCircle({ x: cx, y: cy + size * 0.12, size: r * 0.35, color: rgb(1, 1, 1) });
  // Simple teardrop tip
  page.drawRectangle({
    x: cx - size * 0.12,
    y: cy - size * 0.35,
    width: size * 0.24,
    height: size * 0.35,
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
    width: 280,
    color: { dark: '#111111', light: '#FFFFFF' },
  });
}

async function barcodePngBytes(text) {
  const value = winAnsiSafe(text).slice(0, 32) || 'ORDER';
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: value,
    scale: 3,
    height: 12,
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
  if (perPage >= 4) {
    return {
      pad: 8,
      logoH: 24,
      logoMaxW: 78,
      titleSize: 9,
      orderIdSize: 7.5,
      sectionSize: 7,
      bodySize: 7.5,
      nameSize: 9.5,
      smallSize: 6.2,
      qrSize: 52,
      qtyCol: 26,
      headerBand: 34,
      barcodeH: 22,
      footerWave: 8,
      thanksH: 11,
      lh: 9.5,
      nameLh: 11,
      metaW: 0.34,
    };
  }
  if (perPage === 2) {
    return {
      pad: 12,
      logoH: 30,
      logoMaxW: 100,
      titleSize: 12,
      orderIdSize: 9,
      sectionSize: 8,
      bodySize: 9,
      nameSize: 12,
      smallSize: 7.2,
      qrSize: 70,
      qtyCol: 34,
      headerBand: 40,
      barcodeH: 28,
      footerWave: 10,
      thanksH: 14,
      lh: 11.5,
      nameLh: 14,
      metaW: 0.32,
    };
  }
  return {
    pad: 16,
    logoH: 36,
    logoMaxW: 124,
    titleSize: 14,
    orderIdSize: 10,
    sectionSize: 9,
    bodySize: 10.5,
    nameSize: 15,
    smallSize: 8,
    qrSize: 86,
    qtyCol: 40,
    headerBand: 46,
    barcodeH: 34,
    footerWave: 12,
    thanksH: 16,
    lh: 13,
    nameLh: 17,
    metaW: 0.3,
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
  const bottomReserve = pad + s.footerWave + s.thanksH + s.barcodeH + 10;
  const contentFloor = rect.y + bottomReserve;
  let y = rect.y + rect.height - pad;

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: BORDER,
    borderWidth: 1.15,
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
      y: y - Math.round(logoH * 0.6),
      size: s.titleSize,
      font: bold,
      color: BRAND,
    });
  }

  const title = 'Shipping Label';
  const titleW = bold.widthOfTextAtSize(title, s.titleSize);
  page.drawText(title, {
    x: innerRight - titleW,
    y: y - 11,
    size: s.titleSize,
    font: bold,
    color: BRAND,
  });

  const pillText = fitText(bold, `Order ID: ${order.orderNumber || ''}`, s.orderIdSize, maxW * 0.48);
  const pillPadX = 6;
  const pillPadY = 3;
  const pillW = bold.widthOfTextAtSize(pillText, s.orderIdSize) + pillPadX * 2;
  const pillH = s.orderIdSize + pillPadY * 2;
  const pillX = innerRight - pillW;
  const pillY = y - 11 - s.orderIdSize - 4 - pillPadY;
  drawRoundedRect(page, { x: pillX, y: pillY, width: pillW, height: pillH, color: PILL_BG });
  page.drawText(pillText, {
    x: pillX + pillPadX,
    y: pillY + pillPadY,
    size: s.orderIdSize,
    font: bold,
    color: INK,
  });

  y = Math.min(y - s.headerBand, pillY - 6);
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 5;

  // —— FROM + QR ——
  const qrSize = Math.min(s.qrSize, maxW * 0.32);
  const fromWidth = Math.max(58, maxW - qrSize - 10);
  const qrX = innerRight - qrSize;
  const fromTop = y;

  page.drawText('FROM', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 3;
  const fromName = drawWrapped(page, bold, brandName, {
    x: innerX, y, size: s.bodySize, maxWidth: fromWidth, lineHeight: s.lh, maxLines: 2,
  });
  y = fromName.bottom;
  if (company.returnAddress) {
    const addr = drawWrapped(page, font, company.returnAddress, {
      x: innerX, y, size: s.smallSize, maxWidth: fromWidth, color: MUTED,
      lineHeight: s.smallSize + 2, maxLines: perPage >= 4 ? 3 : 4,
    });
    y = addr.bottom;
  }
  if (company.phone) {
    page.drawText(fitText(font, `Ph: ${company.phone}`, s.smallSize, fromWidth), {
      x: innerX, y, size: s.smallSize, font, color: MUTED,
    });
    y -= s.smallSize + 2;
  }

  const qrY = fromTop - qrSize + s.sectionSize;
  if (qrImage) {
    const drawY = Math.max(contentFloor + 2, qrY);
    page.drawImage(qrImage, { x: qrX, y: drawY, width: qrSize, height: qrSize });
    const caption = 'Scan to Track Order';
    const capW = font.widthOfTextAtSize(caption, s.smallSize);
    const capY = drawY - (s.smallSize + 2);
    if (capY > contentFloor) {
      page.drawText(caption, {
        x: qrX + Math.max(0, (qrSize - capW) / 2),
        y: capY,
        size: s.smallSize,
        font,
        color: MUTED,
      });
    }
    y = Math.min(y, capY - 4);
  }
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 5;

  // —— SHIP TO (left) + order meta (right) — no weight/payment ——
  const metaW = Math.max(70, maxW * s.metaW);
  const shipW = Math.max(70, maxW - metaW - 8);
  const shipTop = y;

  page.drawText('SHIP TO', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 2;

  const pinSize = Math.min(14, s.nameSize + 2);
  drawPinIcon(page, innerX + pinSize * 0.55, y - pinSize * 0.15, pinSize, ACCENT);
  const name = drawWrapped(page, bold, order.recipientName || '', {
    x: innerX + pinSize + 4,
    y,
    size: s.nameSize,
    maxWidth: shipW - pinSize - 4,
    lineHeight: s.nameLh,
    maxLines: 2,
  });
  y = name.bottom;

  for (const line of addressLines(order)) {
    if (y < contentFloor + s.lh * 8) break;
    const drawn = drawWrapped(page, font, line, {
      x: innerX, y, size: s.bodySize, maxWidth: shipW, lineHeight: s.lh, maxLines: 2,
    });
    y = drawn.bottom;
  }
  if (order.phone && y >= contentFloor + s.lh * 7) {
    page.drawText(fitText(bold, `Mobile: ${order.phone}`, s.bodySize, shipW), {
      x: innerX, y, size: s.bodySize, font: bold, color: INK,
    });
    y -= s.lh + 1;
  }

  // Meta column (date / est. delivery only)
  let metaY = shipTop;
  const metaX = innerRight - metaW;
  page.drawText('ORDER DATE', { x: metaX, y: metaY, size: s.smallSize, font: bold, color: MUTED });
  metaY -= s.smallSize + 2;
  const dateDrawn = drawWrapped(page, font, order.orderDateIst || '-', {
    x: metaX, y: metaY, size: s.smallSize, maxWidth: metaW, lineHeight: s.smallSize + 2, maxLines: 2, color: INK,
  });
  metaY = dateDrawn.bottom - 4;
  if (order.deliveryType) {
    page.drawText('EST. DELIVERY', { x: metaX, y: metaY, size: s.smallSize, font: bold, color: MUTED });
    metaY -= s.smallSize + 2;
    const del = drawWrapped(page, font, order.deliveryType, {
      x: metaX, y: metaY, size: s.smallSize, maxWidth: metaW, lineHeight: s.smallSize + 2, maxLines: 3, color: INK,
    });
    metaY = del.bottom;
  }

  y = Math.min(y, metaY) - 4;
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 4;

  // —— Order Items | Qty (never price) ——
  page.drawText('ORDER ITEMS', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 2;
  const qtyCol = s.qtyCol;
  const productColW = Math.max(40, maxW - qtyCol - 4);
  page.drawText('Item', { x: innerX, y, size: s.smallSize, font: bold, color: MUTED });
  page.drawText('Qty', { x: innerRight - qtyCol, y, size: s.smallSize, font: bold, color: MUTED });
  y -= 2;
  drawHairline(page, innerX, innerRight, y);
  y -= s.bodySize + 1;

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
      page.drawText(line, { x: innerX, y: cursor, size: s.bodySize, font, color: INK });
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
    y = cursor - 1;
    drawnCount += 1;
  }
  if (remaining.length && y >= contentFloor + 2) {
    const units = remaining.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    page.drawText(
      fitText(font, `+ ${remaining.length} more / ${units} unit(s) — try 2-label or single layout`, s.smallSize, maxW),
      { x: innerX, y: Math.max(contentFloor + 2, y), size: s.smallSize, font, color: MUTED },
    );
  } else if (!drawnCount) {
    page.drawText('No items listed', { x: innerX, y, size: s.bodySize, font, color: MUTED });
  }

  // —— Barcode + thank-you + brand wave (no amount paid) ——
  const barcodeBandTop = rect.y + pad + s.footerWave + s.thanksH + s.barcodeH + 4;
  drawHairline(page, innerX, innerRight, barcodeBandTop + 2);

  if (barcodeImage) {
    const maxBarcodeW = Math.min(maxW * 0.72, barcodeImage.width);
    const barcodeH = s.barcodeH;
    const barcodeW = Math.min(maxBarcodeW, (barcodeImage.width / barcodeImage.height) * barcodeH);
    page.drawImage(barcodeImage, {
      x: innerX,
      y: rect.y + pad + s.footerWave + s.thanksH + 2,
      width: barcodeW,
      height: barcodeH,
    });
    const codeLabel = fitText(font, order.orderNumber || '', s.smallSize, barcodeW);
    page.drawText(codeLabel, {
      x: innerX + Math.max(0, (barcodeW - font.widthOfTextAtSize(codeLabel, s.smallSize)) / 2),
      y: rect.y + pad + s.footerWave + s.thanksH - s.smallSize,
      size: s.smallSize,
      font,
      color: MUTED,
    });
  }

  const thanks = 'Thank you for shopping with GroveryGiftz!';
  const thanksSize = s.smallSize;
  const thanksW = font.widthOfTextAtSize(thanks, thanksSize);
  page.drawText(thanks, {
    x: innerX + Math.max(0, (maxW - thanksW) / 2),
    y: rect.y + pad + s.footerWave + 2,
    size: thanksSize,
    font: bold,
    color: BRAND,
  });
  drawBrandWave(page, rect, pad, Math.max(4, s.footerWave - 1));
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
