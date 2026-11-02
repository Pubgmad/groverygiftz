const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value == null || value === '') return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  text = text.replace(/\u0000/g, '');
  if (FORMULA_PREFIX.test(text) || text.startsWith('\t') || text.startsWith('\r')) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values = []) {
  return values.map(csvCell).join(',');
}

export function csvDocument(headers, rows) {
  const lines = [csvRow(headers), ...rows.map((row) => csvRow(row))];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function formatInrAmount(value) {
  if (value == null || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return amount.toFixed(2);
}

export function csvResponseHeaders(filename) {
  const safeName = String(filename || 'export.csv').replace(/["\r\n]/g, '');
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${safeName}"`,
    'Cache-Control': 'no-store',
  };
}

export async function streamCsvResponse(filename, writeRows) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const write = (chunk) => controller.enqueue(encoder.encode(chunk));
        write('\uFEFF');
        await writeRows(write);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: csvResponseHeaders(filename),
  });
}
