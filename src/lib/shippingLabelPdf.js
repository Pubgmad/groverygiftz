import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

/** A4 in PDF points (1 pt = 1/72 in). 210mm × 297mm. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

const PAGE_MARGIN = 18;
const GUTTER = 10;
const BORDER = rgb(0.15, 0.15, 0.15);
const MUTED = rgb(0.35, 0.35, 0.35);
const INK = rgb(0.08, 0.08, 0.08);

function winAnsiSafe(text = '') {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapLines(font, text, size, maxWidth) {
  const words = winAnsiSafe(text).split(' ').filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
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
    if (type.includes('png') || url.toLowerCase().includes('.png')) {
      return pdf.embedPng(bytes);
    }
    if (type.includes('jpeg') || type.includes('jpg') || /\.jpe?g(\?|$)/i.test(url)) {
      return pdf.embedJpg(bytes);
    }
    // Try PNG then JPG for unknown types
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
    width: 256,
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

function drawWrapped(page, font, text, { x, y, size, maxWidth, color = INK, lineHeight }) {
  const lh = Number(lineHeight) || (Number(size) + 2);
  const startY = Number(y);
  const lines = Number.isFinite(startY) ? wrapLines(font, text, size, maxWidth) : [];
  let cursor = Number.isFinite(startY) ? startY : 0;
  lines.forEach((line) => {
    if (!Number.isFinite(cursor) || !Number.isFinite(x)) return;
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= lh;
  });
  return { lines: lines.length, bottom: Number.isFinite(cursor) ? cursor : startY };
}

function drawLabel(page, {
  rect,
  order,
  company,
  font,
  bold,
  logo,
  qrImage,
  dense,
}) {
  if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
    throw new Error(`Invalid label rect: ${JSON.stringify(rect)}`);
  }
  const pad = dense ? 8 : 12;
  const innerX = rect.x + pad;
  const innerRight = rect.x + rect.width - pad;
  const maxW = rect.width - pad * 2;
  let y = rect.y + rect.height - pad;

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: BORDER,
    borderWidth: 1,
  });

  const logoH = dense ? 22 : 28;
  const logoW = logo ? Math.min(dense ? 72 : 90, (logo.width / logo.height) * logoH) : 0;
  if (logo) {
    page.drawImage(logo, {
      x: innerX,
      y: y - logoH,
      width: logoW,
      height: logoH,
    });
  }

  const brandX = logo ? innerX + logoW + 8 : innerX;
  const brandMax = Math.max(40, maxW - (logo ? logoW + 8 : 0) - (dense ? 56 : 72));
  {
    const brand = winAnsiSafe(company.tradeName || company.siteName || 'GroveryGiftz');
    let brandLine = brand;
    const brandSize = dense ? 9 : 11;
    while (brandLine.length > 1 && bold.widthOfTextAtSize(brandLine, brandSize) > brandMax) {
      brandLine = brandLine.slice(0, -1);
    }
    page.drawText(brandLine, {
      x: brandX,
      y: y - 12,
      size: brandSize,
      font: bold,
      color: INK,
    });
  }

  y -= logoH + 6;

  if (company.returnAddress) {
    const ret = drawWrapped(page, font, `Return: ${company.returnAddress}`, {
      x: innerX,
      y: y - (dense ? 7 : 8),
      size: dense ? 6.5 : 7.5,
      maxWidth: maxW,
      color: MUTED,
      lineHeight: dense ? 8 : 9,
    });
    y = ret.bottom - 2;
  } else {
    y -= 2;
  }

  if (!Number.isFinite(y)) y = rect.y + rect.height - pad - (dense ? 40 : 48);
  {
    const lineY = Number(y);
    page.drawLine({
      start: { x: Number(innerX), y: lineY },
      end: { x: Number(innerRight), y: lineY },
      thickness: 0.6,
      color: rgb(0.75, 0.75, 0.75),
    });
  }
  y -= dense ? 12 : 14;

  page.drawText('SHIP TO', {
    x: innerX,
    y,
    size: dense ? 7 : 8,
    font: bold,
    color: MUTED,
  });
  y -= dense ? 11 : 13;

  const nameSize = dense ? 10 : 12;
  const name = drawWrapped(page, bold, order.recipientName, {
    x: innerX,
    y,
    size: nameSize,
    maxWidth: maxW - (dense ? 58 : 70),
    lineHeight: nameSize + 2,
  });
  y = name.bottom - 2;

  const addrBits = [order.line1, order.line2, `${order.city}, ${order.state} - ${order.pincode}`]
    .filter(Boolean)
    .join(', ');
  const addr = drawWrapped(page, font, addrBits, {
    x: innerX,
    y,
    size: dense ? 8 : 9,
    maxWidth: maxW - (dense ? 58 : 70),
    lineHeight: dense ? 10 : 11,
  });
  y = addr.bottom - 2;

  if (!Number.isFinite(y)) y = rect.y + rect.height * 0.55;
  page.drawText(winAnsiSafe(`Mobile: ${order.phone}`), {
    x: innerX,
    y,
    size: dense ? 8 : 9,
    font: bold,
    color: INK,
  });
  y -= dense ? 12 : 14;

  if (!Number.isFinite(y)) y = rect.y + rect.height * 0.5;
  {
    const lineY = Number(y);
    page.drawLine({
      start: { x: Number(innerX), y: lineY },
      end: { x: Number(innerRight), y: lineY },
      thickness: 0.6,
      color: rgb(0.75, 0.75, 0.75),
    });
  }
  y -= dense ? 11 : 13;

  page.drawText(winAnsiSafe(`Order: ${order.orderNumber}`), {
    x: innerX,
    y,
    size: dense ? 8 : 9,
    font: bold,
    color: INK,
  });
  y -= dense ? 10 : 12;
  page.drawText(winAnsiSafe(`Date: ${order.orderDateIst}`), {
    x: innerX,
    y,
    size: dense ? 7 : 8,
    font,
    color: MUTED,
  });
  y -= dense ? 12 : 14;

  page.drawText('CONTENTS (no prices)', {
    x: innerX,
    y,
    size: dense ? 7 : 8,
    font: bold,
    color: MUTED,
  });
  y -= dense ? 10 : 12;

  const qrSize = dense ? 52 : 64;
  const qrX = innerRight - qrSize;
  const qrY = rect.y + pad;
  if (qrImage) {
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    page.drawText('Scan to track', {
      x: qrX,
      y: qrY - 9,
      size: 6,
      font,
      color: MUTED,
    });
  }

  const itemMaxW = Math.max(40, maxW - qrSize - 8);
  const minY = qrY + qrSize + 4;
  const itemSize = dense ? 7.5 : 8.5;
  const itemLh = dense ? 9.5 : 11;
  let remaining = [...(order.items || [])];
  let drawn = 0;
  while (remaining.length && y - itemLh > minY) {
    const item = remaining.shift();
    const line = `${item.quantity} x ${item.title}${item.variant ? ` (${item.variant})` : ''}`;
    const wrapped = wrapLines(font, line, itemSize, itemMaxW);
    for (const part of wrapped) {
      if (y - itemLh <= minY) {
        remaining.unshift({ ...item, title: `… ${part}`, quantity: '', variant: '' });
        break;
      }
      page.drawText(part, { x: innerX, y, size: itemSize, font, color: INK });
      y -= itemLh;
      drawn += 1;
    }
  }
  if (remaining.length) {
    const more = remaining.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    if (y > rect.y + pad + 8) {
      page.drawText(winAnsiSafe(`+ ${remaining.length} more line(s) / ${more} unit(s) — see packing slip`), {
        x: innerX,
        y: Math.max(rect.y + pad + 2, y),
        size: 6.5,
        font,
        color: MUTED,
      });
    }
  } else if (!drawn) {
    page.drawText('No items listed', { x: innerX, y, size: itemSize, font, color: MUTED });
  }
}

/**
 * Build an A4 multi-page shipping-label PDF.
 * Never receives or renders prices / payment fields.
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
  const resolvedLayout = {
    cols: Math.max(1, Number(layout?.cols) || Number(layout?.perPage === 4 ? 2 : 1) || 1),
    rows: Math.max(1, Number(layout?.rows) || Number(layout?.perPage) || 1),
    perPage: Math.max(1, Number(layout?.perPage) || 1),
  };
  if (resolvedLayout.perPage === 4) {
    resolvedLayout.cols = 2;
    resolvedLayout.rows = 2;
  } else if (resolvedLayout.perPage === 2) {
    resolvedLayout.cols = 1;
    resolvedLayout.rows = 2;
  } else {
    resolvedLayout.cols = 1;
    resolvedLayout.rows = 1;
    resolvedLayout.perPage = 1;
  }
  const rects = labelRects(resolvedLayout);
  const perPage = Math.max(1, rects.length);
  const dense = perPage >= 4;

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
        dense,
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
