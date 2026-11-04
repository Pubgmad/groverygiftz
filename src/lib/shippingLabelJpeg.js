'use client';

/**
 * Convert a shipping-label PDF blob URL into JPEG downloads in the browser.
 * Uses pdf.js + canvas so preview and JPEG match the same PDF bytes.
 */

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function loadPdfJs() {
  // Prefer the browser build; fall back if a bundler resolves the package root oddly.
  let mod;
  try {
    mod = await import('pdfjs-dist/build/pdf');
  } catch {
    mod = await import('pdfjs-dist');
  }
  const pdfjs = mod?.getDocument ? mod : (mod?.default || mod);
  if (pdfjs?.GlobalWorkerOptions) {
    const version = pdfjs.version || '3.11.174';
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
  }
  if (!pdfjs?.getDocument) throw new Error('PDF engine unavailable for JPEG export');
  return pdfjs;
}

export function jpegFilenameFromPdf(pdfName = 'GroveryGiftz-Shipping-Labels.pdf', pageIndex = null) {
  const base = String(pdfName || 'GroveryGiftz-Shipping-Labels.pdf').replace(/\.pdf$/i, '');
  if (pageIndex == null) return `${base}.jpg`;
  return `${base}-page-${pageIndex}.jpg`;
}

export async function downloadShippingLabelJpegs(pdfUrl, pdfName = 'GroveryGiftz-Shipping-Labels.pdf', {
  // ~300 DPI relative to PDF user space (72 pt/in): scale 4 ≈ 288 dpi
  scale = 4,
  quality = 0.95,
} = {}) {
  if (!pdfUrl || typeof document === 'undefined') {
    throw new Error('PDF preview is not ready');
  }
  const pdfjs = await loadPdfJs();
  const bytes = await fetch(pdfUrl).then((res) => {
    if (!res.ok) throw new Error('Unable to read generated PDF');
    return res.arrayBuffer();
  });
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pageCount = doc.numPages;
  const files = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable for JPEG export');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('JPEG encode failed'))),
        'image/jpeg',
        quality,
      );
    });
    const filename = pageCount === 1
      ? jpegFilenameFromPdf(pdfName)
      : jpegFilenameFromPdf(pdfName, pageNum);
    triggerDownload(blob, filename);
    files.push(filename);
    // Brief gap so browsers don't collapse multiple downloads.
    if (pageNum < pageCount) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  return { pageCount, files };
}
