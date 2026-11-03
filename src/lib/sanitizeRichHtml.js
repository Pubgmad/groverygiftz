const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a',
  'h3', 'h4', 'blockquote', 'span', 'div',
]);

const ALLOWED_ATTRS = {
  a: new Set(['href', 'title', 'target', 'rel']),
  span: new Set(['class']),
  div: new Set(['class']),
  p: new Set(['class']),
};

function isSafeHref(value) {
  const href = String(value || '').trim();
  if (!href) return false;
  if (href.startsWith('#') || href.startsWith('/')) return true;
  return /^(https?:|mailto:)/i.test(href);
}

/**
 * Lightweight allowlist sanitizer for admin-authored FAQ/description HTML.
 * Strips scripts, event handlers, and disallowed tags without adding a dependency.
 */
export function sanitizeRichHtml(input = '') {
  const raw = String(input || '');
  if (!raw.trim()) return '';

  // Fast path for plain text
  if (!/[<>]/.test(raw)) {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
  }

  return raw
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
    .replace(/on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName, attrs) => {
      const tag = String(tagName || '').toLowerCase();
      const closing = /^<\s*\//.test(match);
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (closing) return `</${tag}>`;

      const allowed = ALLOWED_ATTRS[tag];
      if (!allowed) return `<${tag}>`;

      const kept = [];
      String(attrs || '').replace(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, name, _q, dq, sq, bare) => {
        const attr = String(name || '').toLowerCase();
        if (!allowed.has(attr)) return '';
        let value = dq ?? sq ?? bare ?? '';
        if (attr === 'href') {
          if (!isSafeHref(value)) return '';
          kept.push(`href="${String(value).replace(/"/g, '')}"`);
          kept.push('rel="noopener noreferrer"');
          if (/^https?:/i.test(value)) kept.push('target="_blank"');
          return '';
        }
        if (attr === 'target') {
          if (String(value).toLowerCase() === '_blank') kept.push('target="_blank"');
          return '';
        }
        if (attr === 'class') {
          const safeClass = String(value).replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
          if (safeClass) kept.push(`class="${safeClass}"`);
          return '';
        }
        if (attr === 'title' || attr === 'rel') {
          kept.push(`${attr}="${String(value).replace(/"/g, '')}"`);
        }
        return '';
      });

      return kept.length ? `<${tag} ${kept.join(' ')}>` : `<${tag}>`;
    });
}

export function hasRichTextContent(value) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return text.length > 0;
}
