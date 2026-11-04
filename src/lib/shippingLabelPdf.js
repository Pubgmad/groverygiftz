import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

/** A4 in PDF points (1 pt = 1/72 in). 210mm × 297mm. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

/** ~8mm page margin, ~4.2mm gutter — print-safe for cutters. */
const PAGE_MARGIN = 22.5;
const GUTTER = 12;
const RULE = rgb(0.78, 0.78, 0.78);
const BORDER = rgb(0.18, 0.18, 0.18);
const MUTED = rgb(0.38, 0.38, 0.38);
const INK = rgb(0.1, 0.1, 0.1);
const BRAND = rgb(0.141, 0.337, 0.847); // GroveryGiftz primary blue #2456D8

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
  while (line.length > 1 && font.widthOfTextAtSize(line, size) > maxWidth) {
    line = line.slice(0, -1);
  }
  return line;
}

function drawWrapped(page, font, text, {
  x, y, size, maxWidth, color = INK, lineHeight, maxLines = 20,
}) {
  const lh = Number(lineHeight) || (Number(size) + 2);
  const startY = Number(y);
  if (!Number.isFinite(startY)) return { lines: 0, bottom: startY, overflow: false };
  const all = wrapLines(font, text, size, maxWidth);
  const lines = all.slice(0, Math.max(1, maxLines));
  let cursor = startY;
  lines.forEach((line) => {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= lh;
  });
  return {
    lines: lines.length,
    bottom: cursor,
    overflow: all.length > lines.length,
  };
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
      pad: 9,
      logoH: 22,
      logoMaxW: 70,
      titleSize: 9,
      orderIdSize: 8,
      sectionSize: 7,
      bodySize: 8,
      nameSize: 10,
      smallSize: 6.5,
      qrSize: 54,
      qtyCol: 28,
      headerBand: 30,
      footerH: 14,
      lh: 10,
      nameLh: 12,
    };
  }
  if (perPage === 2) {
    return {
      pad: 12,
      logoH: 28,
      logoMaxW: 96,
      titleSize: 12,
      orderIdSize: 10,
      sectionSize: 8,
      bodySize: 9.5,
      nameSize: 13,
      smallSize: 7.5,
      qrSize: 72,
      qtyCol: 36,
      headerBand: 36,
      footerH: 18,
      lh: 12,
      nameLh: 15,
    };
  }
  return {
    pad: 16,
    logoH: 34,
    logoMaxW: 120,
    titleSize: 14,
    orderIdSize: 11,
    sectionSize: 9,
    bodySize: 11,
    nameSize: 16,
    smallSize: 8.5,
    qrSize: 88,
    qtyCol: 42,
    headerBand: 42,
    footerH: 22,
    lh: 14,
    nameLh: 18,
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
  if (order.district && (!order.city || order.district.toLowerCase() !== order.city.toLowerCase())) {
    lines.push(`District: ${order.district}`);
  }
  return lines;
}

function drawLabel(page, {
  rect,
  order,
  company,
  font,
  bold,
  logo,
  qrImage,
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
  const footerTop = rect.y + pad + s.footerH;
  let y = rect.y + rect.height - pad;

  // Outer border
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: BORDER,
    borderWidth: 1.1,
  });

  // —— Section A: Header (logo/brand left | SHIPPING LABEL + Order ID right) ——
  const headerBottom = y - s.headerBand;
  const logoH = s.logoH;
  const logoW = logo ? Math.min(s.logoMaxW, (logo.width / logo.height) * logoH) : 0;
  const brandName = company.tradeName || company.siteName || 'GroveryGiftz';
  const leftMax = Math.max(48, maxW * 0.48);

  if (logo) {
    page.drawImage(logo, {
      x: innerX,
      y: y - logoH - 2,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawText(fitText(bold, brandName, s.titleSize, leftMax), {
      x: innerX,
      y: y - Math.round(logoH * 0.55),
      size: s.titleSize,
      font: bold,
      color: BRAND,
    });
  }

  const title = 'SHIPPING LABEL';
  const titleSize = s.titleSize;
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: innerRight - titleW,
    y: y - 11,
    size: titleSize,
    font: bold,
    color: BRAND,
  });
  const orderLine = fitText(bold, `Order ID: ${order.orderNumber || ''}`, s.orderIdSize, leftMax);
  const orderW = bold.widthOfTextAtSize(orderLine, s.orderIdSize);
  page.drawText(orderLine, {
    x: innerRight - orderW,
    y: y - 11 - s.orderIdSize - 4,
    size: s.orderIdSize,
    font: bold,
    color: INK,
  });

  y = headerBottom;
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 6;

  // —— Section B: FROM (left) + QR (right) ——
  const qrSize = Math.min(s.qrSize, maxW * 0.34);
  const qrGap = 8;
  const fromWidth = Math.max(60, maxW - qrSize - qrGap);
  const qrX = innerRight - qrSize;
  const fromTop = y;

  page.drawText('FROM', {
    x: innerX,
    y,
    size: s.sectionSize,
    font: bold,
    color: MUTED,
  });
  y -= s.sectionSize + 4;

  const companyName = company.tradeName || company.siteName || 'GroveryGiftz';
  const fromName = drawWrapped(page, bold, companyName, {
    x: innerX,
    y,
    size: s.bodySize,
    maxWidth: fromWidth,
    lineHeight: s.lh,
    maxLines: 2,
  });
  y = fromName.bottom - 1;

  if (company.returnAddress) {
    const addr = drawWrapped(page, font, company.returnAddress, {
      x: innerX,
      y,
      size: s.smallSize,
      maxWidth: fromWidth,
      color: MUTED,
      lineHeight: s.smallSize + 2,
      maxLines: perPage >= 4 ? 3 : 4,
    });
    y = addr.bottom - 1;
  }
  if (company.phone) {
    page.drawText(fitText(font, `Ph: ${company.phone}`, s.smallSize, fromWidth), {
      x: innerX,
      y,
      size: s.smallSize,
      font,
      color: MUTED,
    });
    y -= s.smallSize + 3;
  }

  // QR column aligned to top of FROM block
  const qrTop = fromTop;
  const qrY = qrTop - qrSize + s.sectionSize;
  if (qrImage) {
    page.drawImage(qrImage, { x: qrX, y: Math.max(footerTop + 2, qrY), width: qrSize, height: qrSize });
    const caption = 'Scan to Track Order';
    const capSize = s.smallSize;
    const capW = bold.widthOfTextAtSize(caption, capSize);
    const capY = Math.max(footerTop + 2, qrY) - (capSize + 2);
    if (capY > rect.y + pad) {
      page.drawText(caption, {
        x: qrX + Math.max(0, (qrSize - capW) / 2),
        y: capY,
        size: capSize,
        font,
        color: MUTED,
      });
    }
  }

  // Continue below the taller of FROM text or QR+caption
  const qrBottom = qrImage
    ? Math.max(footerTop + 2, qrY) - (s.smallSize + 6)
    : y;
  y = Math.min(y, qrBottom) - 4;
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 6;

  // —— Section C: SHIP TO ——
  page.drawText('SHIP TO', {
    x: innerX,
    y,
    size: s.sectionSize,
    font: bold,
    color: MUTED,
  });
  y -= s.sectionSize + 4;

  const name = drawWrapped(page, bold, order.recipientName || '', {
    x: innerX,
    y,
    size: s.nameSize,
    maxWidth: maxW,
    lineHeight: s.nameLh,
    maxLines: 2,
  });
  y = name.bottom - 1;

  for (const line of addressLines(order)) {
    if (y < footerTop + s.lh * 6) break;
    const drawn = drawWrapped(page, font, line, {
      x: innerX,
      y,
      size: s.bodySize,
      maxWidth: maxW,
      lineHeight: s.lh,
      maxLines: 2,
    });
    y = drawn.bottom;
  }

  if (order.phone && y >= footerTop + s.lh * 5) {
    page.drawText(fitText(bold, `Mobile: ${order.phone}`, s.bodySize, maxW), {
      x: innerX,
      y,
      size: s.bodySize,
      font: bold,
      color: INK,
    });
    y -= s.lh + 2;
  }

  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 5;

  // —— Section D: Order information (no payment / weight) ——
  page.drawText(fitText(bold, `Order ID: ${order.orderNumber || ''}`, s.bodySize, maxW * 0.55), {
    x: innerX,
    y,
    size: s.bodySize,
    font: bold,
    color: INK,
  });
  const dateLabel = fitText(font, order.orderDateIst || '', s.smallSize, maxW * 0.42);
  page.drawText(dateLabel, {
    x: innerRight - font.widthOfTextAtSize(dateLabel, s.smallSize),
    y,
    size: s.smallSize,
    font,
    color: MUTED,
  });
  y -= s.lh + 2;
  if (order.deliveryType) {
    page.drawText(fitText(font, `Est. delivery: ${order.deliveryType}`, s.smallSize, maxW), {
      x: innerX,
      y,
      size: s.smallSize,
      font,
      color: MUTED,
    });
    y -= s.lh;
  }
  drawHairline(page, innerX, innerRight, y);
  y -= s.sectionSize + 5;

  // —— Section E: Products table (Product | Qty) — no prices ——
  page.drawText('ORDERED PRODUCTS', {
    x: innerX,
    y,
    size: s.sectionSize,
    font: bold,
    color: MUTED,
  });
  y -= s.sectionSize + 3;

  const qtyCol = s.qtyCol;
  const productColW = Math.max(40, maxW - qtyCol - 4);
  page.drawText('Product', { x: innerX, y, size: s.smallSize, font: bold, color: MUTED });
  page.drawText('Qty', {
    x: innerRight - qtyCol,
    y,
    size: s.smallSize,
    font: bold,
    color: MUTED,
  });
  y -= 3;
  drawHairline(page, innerX, innerRight, y);
  y -= s.bodySize + 2;

  const items = Array.isArray(order.items) ? order.items : [];
  let remaining = [...items];
  let drawnCount = 0;
  const minContentY = footerTop + 2;

  while (remaining.length && y - s.lh >= minContentY) {
    const item = remaining[0];
    const title = `${item.title || 'Product'}${item.variant ? ` (${item.variant})` : ''}`;
    const titleLines = wrapLines(font, title, s.bodySize, productColW);
    const needed = titleLines.length * s.lh;
    if (y - needed < minContentY) break;
    remaining.shift();

    let cursor = y;
    titleLines.forEach((line, idx) => {
      page.drawText(line, { x: innerX, y: cursor, size: s.bodySize, font, color: INK });
      if (idx === 0) {
        const qty = String(item.quantity || 1);
        page.drawText(qty, {
          x: innerRight - qtyCol + 4,
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

  if (remaining.length) {
    const units = remaining.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    if (y >= minContentY) {
      page.drawText(
        fitText(font, `+ ${remaining.length} more item line(s) / ${units} unit(s) — use 2-label or single layout`, s.smallSize, maxW),
        { x: innerX, y: Math.max(minContentY, y), size: s.smallSize, font, color: MUTED },
      );
    }
  } else if (!drawnCount) {
    page.drawText('No items listed', { x: innerX, y, size: s.bodySize, font, color: MUTED });
  }

  // —— Section F: Footer ——
  drawHairline(page, innerX, innerRight, footerTop + s.footerH - 2);
  const thanks = 'Thank you for choosing GroveryGiftz!';
  const thanksSize = s.smallSize;
  const thanksW = font.widthOfTextAtSize(thanks, thanksSize);
  page.drawText(thanks, {
    x: innerX + Math.max(0, (maxW - thanksW) / 2),
    y: rect.y + pad + 3,
    size: thanksSize,
    font,
    color: BRAND,
  });
}

/**
 * Build an A4 multi-page shipping-label PDF.
 * Never receives or renders prices / payment / weight fields.
 */
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
  for (const order of orders) {
    if (!order.trackUrl) {
      qrImages.push(null);
      continue;
    }
    try {
      const bytes = await qrPngBytes(order.trackUrl);
      qrImages.push(await pdf.embedPng(bytes));
    } catch {
      qrImages.push(null);
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
        perPage,
      });
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
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
