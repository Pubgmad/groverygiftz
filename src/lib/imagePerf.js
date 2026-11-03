/**
 * Dev-only image pipeline timing. Enable with localStorage.setItem('GG_PERF','1')
 * or NEXT_PUBLIC_GG_PERF=1. Never logs image bytes or credentials.
 */

const ENABLED = () => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GG_PERF === '1') return true;
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('GG_PERF') === '1';
  } catch {
    return false;
  }
};

const marks = new Map();

export function imagePerfMark(name) {
  if (!ENABLED()) return;
  try {
    const key = `gg:${name}`;
    performance.mark(key);
    marks.set(name, performance.now());
  } catch {}
}

export function imagePerfMeasure(name, startName) {
  if (!ENABLED()) return 0;
  try {
    const end = performance.now();
    const start = marks.get(startName);
    const ms = typeof start === 'number' ? Math.round(end - start) : 0;
    const measureName = `gg:${name}`;
    try {
      performance.measure(measureName, `gg:${startName}`);
    } catch {}
    // eslint-disable-next-line no-console
    console.info(`[GG_PERF] ${name}: ${ms}ms`);
    return ms;
  } catch {
    return 0;
  }
}

export async function imagePerfTime(label, fn) {
  imagePerfMark(`${label}:start`);
  try {
    return await fn();
  } finally {
    imagePerfMeasure(label, `${label}:start`);
  }
}
