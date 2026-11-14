function truthyEnv(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes';
}

export function getImapConfig() {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT || 993);
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  const secureEnv = process.env.IMAP_SECURE;
  if (!host || !user || !pass) return null;
  return {
    host,
    port,
    secure: secureEnv == null || String(secureEnv).trim() === '' ? port === 993 : truthyEnv(secureEnv),
    auth: { user, pass },
  };
}

export function normalizeMessageId(value) {
  return String(value || '').trim().replace(/^<|>$/g, '');
}

const SENT_NAME_CANDIDATES = ['sent items', 'sent', 'sent messages', 'inbox.sent', 'inbox/sent'];

function mailboxFlags(box) {
  const flags = box?.specialUseFlags || box?.flags || [];
  if (flags instanceof Set) return [...flags].map((flag) => String(flag));
  if (Array.isArray(flags)) return flags.map((flag) => String(flag));
  return [];
}

function mailboxLooksSent(box) {
  const use = String(box?.specialUse || '');
  if (use === '\\Sent' || use.toLowerCase() === 'sent') return true;
  return mailboxFlags(box).some((flag) => flag.replace(/^\\/, '').toLowerCase() === 'sent');
}

export function discoverSentMailboxPath(mailboxes = []) {
  const boxes = (Array.isArray(mailboxes) ? mailboxes : []).filter((box) => box && box.path);
  const special = boxes.find(mailboxLooksSent);
  if (special?.path) return special.path;
  for (const candidate of SENT_NAME_CANDIDATES) {
    const found = boxes.find((box) => {
      const path = String(box.path || '').toLowerCase();
      const last = path.split(/[./]/).pop();
      return path === candidate || last === candidate;
    });
    if (found?.path) return found.path;
  }
  return '';
}

export function safeImapError(error) {
  const code = String(error?.code || '');
  const text = String(error?.message || error || '');
  if (/auth|login|credentials|authenticationfailed|invalid user/i.test(`${code} ${text}`)) return 'imap_auth_failed';
  if (/ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|network|timed out/i.test(`${code} ${text}`)) return 'imap_network_failure';
  if (/sent folder|no sent/i.test(text)) return 'imap_sent_folder_not_found';
  return 'imap_archive_failed';
}

async function withImapClient(run) {
  const config = getImapConfig();
  if (!config) return { ok: false, reason: 'imap_not_configured' };
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.auth.user, pass: config.auth.pass },
    logger: false,
    tls: { rejectUnauthorized: true },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 25000,
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

async function messageExists(client, folder, messageId) {
  const id = normalizeMessageId(messageId);
  if (!id) return false;
  const lock = await client.getMailboxLock(folder);
  try {
    const variants = [`<${id}>`, id];
    for (const value of variants) {
      const found = await client.search({ header: ['Message-ID', value] }, { uid: true });
      if (Array.isArray(found) && found.length) return true;
    }
    return false;
  } finally {
    lock.release();
  }
}

export async function archiveRfc822ToSent({ raw, messageId, date } = {}) {
  if (!raw) return { ok: false, reason: 'missing_original_message' };
  const config = getImapConfig();
  if (!config) return { ok: false, reason: 'imap_not_configured' };

  try {
    return await withImapClient(async (client) => {
      const mailboxes = await client.list();
      const folder = discoverSentMailboxPath(mailboxes);
      if (!folder) return { ok: false, reason: 'imap_sent_folder_not_found' };
      if (await messageExists(client, folder, messageId)) {
        return { ok: true, folder, alreadyPresent: true };
      }
      const source = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
      await client.append(folder, source, ['\\Seen'], date instanceof Date ? date : new Date());
      return { ok: true, folder, alreadyPresent: false };
    });
  } catch (error) {
    return { ok: false, reason: safeImapError(error) };
  }
}
