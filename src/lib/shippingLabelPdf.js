import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** A4 in PDF points (1 pt = 1/72 in). 210mm × 297mm. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

const PAGE_MARGIN = 16;
const GUTTER = 10;
const RULE = rgb(0.82, 0.82, 0.82);
const BORDER = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.22, 0.22, 0.22);
const INK = rgb(0.05, 0.05, 0.05);
const BRAND = rgb(0.141, 0.337, 0.847); // #2456D8
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
  x, y, width, height, color = PILL_BG,
}) {
  page.drawRectangle({ x, y, width, height, color, borderWidth: 0 });
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
  // Larger type + tighter padding so each layout fills its cell without QR/barcode dead zones.
  if (perPage >= 4) {
    return {
      pad: 10,
      logoH: 28,
      logoMaxW: 92,
      titleSize: 11,
      orderIdSize: 9,
      sectionSize: 9,
      bodySize: 10,
      nameSize: 13,
      smallSize: 8.5,
      qtyCol: 30,
      headerBand: 40,
      footerWave: 7,
      thanksH: 12,
      lh: 13,
      nameLh: 15,
      metaW: 0.3,
      afterItemsGap: 12,
    };
  }
  if (perPage === 2) {
    return {
      pad: 14,
      logoH: 38,
      logoMaxW: 120,
      titleSize: 15,
      orderIdSize: 12,
      sectionSize: 11,
      bodySize: 13,
      nameSize: 18,
      smallSize: 10,
      qtyCol: 40,
      headerBand: 48,
      footerWave: 9,
      thanksH: 14,
      lh: 16,
      nameLh: 21,
      metaW: 0.28,
      afterItemsGap: 14,
    };
  }
  return {
    pad: 20,
    logoH: 54,
    logoMaxW: 180,
    titleSize: 22,
    orderIdSize: 14,
    sectionSize: 14,
    bodySize: 16,
    nameSize: 26,
    smallSize: 12,
    qtyCol: 56,
    headerBand: 62,
    footerWave: 14,
    thanksH: 18,
    lh: 21,
    nameLh: 30,
    metaW: 0.26,
    afterItemsGap: 18,
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
  bold,
  logo,
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
  const waveFloor = rect.y + pad * 0.35 + s.footerWave + 6;
  const contentFloor = waveFloor + s.thanksH + s.afterItemsGap;
  let y = rect.y + rect.height - pad;

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: BORDER,
    borderWidth: 1.25,
  });

  // —— Header: logo left | Shipping Label + Order ID right (never clipped) ——
  const logoH = s.logoH;
  const logoW = logo ? Math.min(s.logoMaxW, (logo.width / logo.height) * logoH) : 0;
  const brandName = company.tradeName || company.siteName || 'GroveryGiftz';
  const headerGap = 10;
  const leftHeaderW = logo ? logoW : Math.min(maxW * 0.42, bold.widthOfTextAtSize(brandName, s.titleSize) + 4);
  const rightMaxW = Math.max(80, maxW - leftHeaderW - headerGap);

  if (logo) {
    page.drawImage(logo, {
      x: innerX,
      y: y - logoH,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawText(fitText(bold, brandName, s.titleSize, leftHeaderW), {
      x: innerX,
      y: y - Math.round(logoH * 0.62),
      size: s.titleSize,
      font: bold,
      color: BRAND,
    });
  }

  const title = 'Shipping Label';
  let titleSize = s.titleSize;
  while (titleSize > 8 && bold.widthOfTextAtSize(title, titleSize) > rightMaxW) titleSize -= 0.5;
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: innerRight - titleW,
    y: y - 12,
    size: titleSize,
    font: bold,
    color: BRAND,
  });

  const pillPadX = 7;
  const pillPadY = 4;
  let orderIdSize = s.orderIdSize;
  const fullOrderId = `Order ID: ${order.orderNumber || ''}`;
  while (orderIdSize > 7 && bold.widthOfTextAtSize(fullOrderId, orderIdSize) + pillPadX * 2 > rightMaxW) {
    orderIdSize -= 0.5;
  }
  const pillText = fitText(bold, fullOrderId, orderIdSize, rightMaxW - pillPadX * 2);
  const pillW = Math.min(rightMaxW, bold.widthOfTextAtSize(pillText, orderIdSize) + pillPadX * 2);
  const pillH = orderIdSize + pillPadY * 2;
  const pillX = innerRight - pillW;
  const pillY = y - 12 - titleSize - 6 - pillPadY;
  drawRoundedRect(page, { x: pillX, y: pillY, width: pillW, height: pillH, color: PILL_BG });
  page.drawText(pillText, {
    x: pillX + pillPadX,
    y: pillY + pillPadY,
    size: orderIdSize,
    font: bold,
    color: INK,
  });

  y = Math.min(y - s.headerBand, pillY - 8);
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 6;

  // —— FROM (full width — no QR) ——
  page.drawText('FROM', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 4;
  const fromName = drawWrapped(page, bold, brandName, {
    x: innerX, y, size: s.bodySize + 0.5, maxWidth: maxW, lineHeight: s.lh, maxLines: 2,
  });
  y = fromName.bottom;
  if (company.returnAddress) {
    const addr = drawWrapped(page, bold, company.returnAddress, {
      x: innerX, y, size: s.bodySize - 1, maxWidth: maxW, color: INK,
      lineHeight: s.lh, maxLines: perPage >= 4 ? 3 : 4,
    });
    y = addr.bottom;
  }
  if (company.phone) {
    page.drawText(fitText(bold, `Ph: ${company.phone}`, s.bodySize, maxW), {
      x: innerX, y, size: s.bodySize, font: bold, color: INK,
    });
    y -= s.lh;
  }
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 6;

  // —— SHIP TO (left) + ORDER DATE (right) ——
  const metaW = Math.max(78, maxW * s.metaW);
  const shipW = Math.max(90, maxW - metaW - 10);
  const shipTop = y;

  page.drawText('SHIP TO', { x: innerX, y, size: s.sectionSize, font: bold, color: MUTED });
  y -= s.sectionSize + 4;

  const name = drawWrapped(page, bold, order.recipientName || '', {
    x: innerX,
    y,
    size: s.nameSize,
    maxWidth: shipW,
    lineHeight: s.nameLh,
    maxLines: 2,
  });
  y = name.bottom;

  for (const line of addressLines(order)) {
    if (y < contentFloor + s.lh * 4) break;
    const drawn = drawWrapped(page, bold, line, {
      x: innerX, y, size: s.bodySize, maxWidth: shipW, lineHeight: s.lh, maxLines: 2,
    });
    y = drawn.bottom;
  }
  if (order.phone && y >= contentFloor + s.lh * 3) {
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

  // —— Order Items | Qty ——
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
    const itemTitle = `${item.title || 'Product'}${item.variant ? ` (${item.variant})` : ''}`;
    const titleLines = wrapLines(bold, itemTitle, s.bodySize, productColW);
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
      fitText(bold, `+ ${remaining.length} more / ${units} unit(s) — try 2-label or single layout`, s.smallSize, maxW),
      { x: innerX, y: Math.max(contentFloor + 2, y), size: s.smallSize, font: bold, color: MUTED },
    );
    y -= s.lh;
  } else if (!drawnCount) {
    page.drawText('No items listed', { x: innerX, y, size: s.bodySize, font: bold, color: MUTED });
    y -= s.lh;
  }

  // —— Thanks (no barcode) ——
  y -= s.afterItemsGap;
  if (y - s.thanksH < waveFloor + 2) y = waveFloor + s.thanksH + 4;
  drawHairline(page, innerX, innerRight, y);
  y -= 8;

  const thanks = 'Thank you for shopping with GroveryGiftz!';
  let thanksSize = Math.max(s.smallSize, s.bodySize - 1);
  while (thanksSize > 8 && bold.widthOfTextAtSize(thanks, thanksSize) > maxW) thanksSize -= 0.5;
  const thanksW = bold.widthOfTextAtSize(thanks, thanksSize);
  page.drawText(thanks, {
    x: innerX + Math.max(0, (maxW - thanksW) / 2),
    y: Math.max(waveFloor + 2, y - thanksSize),
    size: thanksSize,
    font: bold,
    color: BRAND,
  });

  drawBrandWave(page, rect, pad, Math.max(5, s.footerWave));
}

export async function buildShippingLabelsPdf({
  orders = [],
  company = {},
  layout,
  origin = '',
} = {}) {
  const pdf = await PDFDocument.create();
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
        bold,
        logo,
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
