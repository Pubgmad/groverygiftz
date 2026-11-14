import NotificationJob from '@/models/NotificationJob';
import Order from '@/models/Order';
import { getSmtpConfig, compileTransactionalEmail, sendTransactionalEmail } from '@/lib/email';
import { buildOrderConfirmationEmail, ORDER_CONFIRMATION_TEMPLATE_VERSION } from '@/lib/orderConfirmationEmail';
import { confirmationRecipientEmail } from '@/lib/orderConfirmationSchedule';
import { archiveRfc822ToSent, getImapConfig } from '@/lib/imapSentArchive';

const MAX_ATTEMPTS = 6;
const MAX_ARCHIVE_ATTEMPTS = 6;
const STALE_PROCESSING_MS = 15 * 60 * 1000;

const retryDelayMs = (attempts) => Math.min(30 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempts - 1)));

export function publicConfirmationEmailStatus(job) {
  const status = String(job?.status || '');
  if (status === 'sent' && job?.smtpAcceptedAt) return 'sent';
  if (status === 'failed' || status === 'skipped') return 'failed';
  return 'queued';
}

export async function enqueueOrderConfirmationEmail(orderDoc) {
  if (!orderDoc?._id) return null;
  const uniqueKey = `order-confirmation:${String(orderDoc._id)}`;
  const to = confirmationRecipientEmail(orderDoc);
  const payload = {
    uniqueKey,
    type: 'order-confirmation',
    order: orderDoc._id,
    orderNumber: String(orderDoc.orderNumber || ''),
    to,
    templateVersion: ORDER_CONFIRMATION_TEMPLATE_VERSION,
  };
  let job;
  try {
    job = await NotificationJob.findOneAndUpdate(
      { uniqueKey },
      {
        $setOnInsert: {
          ...payload,
          status: to ? 'pending' : 'skipped',
          lastError: to ? '' : 'missing_recipient',
          attempts: 0,
          nextRetryAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code === 11000) job = await NotificationJob.findOne({ uniqueKey });
    else throw error;
  }
  if (job?.status === 'sent') return job;
  const canRecoverSkipped = job?.status === 'skipped'
    && /missing_recipient|incomplete_confirmation_data/.test(String(job.lastError || ''))
    && to
    && orderDoc?.confirmationSchedule?.expectedReadyDateIst
    && orderDoc?.confirmationSchedule?.estimatedDeliveryDateIst;
  if (canRecoverSkipped) {
    job.status = 'pending';
    job.to = to;
    job.lastError = '';
    job.nextRetryAt = new Date();
    await job.save();
  }
  return job;
}

async function releaseStaleProcessingJobs() {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  await NotificationJob.updateMany(
    { status: 'processing', claimedAt: { $lt: staleBefore } },
    {
      $set: {
        status: 'failed',
        lastError: 'ambiguous_processing_timeout',
        attempts: MAX_ATTEMPTS,
        nextRetryAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    }
  );
}

async function claimNextJob(jobId) {
  const now = new Date();
  const filter = {
    type: 'order-confirmation',
    status: { $in: ['pending', 'failed'] },
    attempts: { $lt: MAX_ATTEMPTS },
    nextRetryAt: { $lte: now },
    to: { $ne: '' },
  };
  if (jobId) filter._id = jobId;
  return NotificationJob.findOneAndUpdate(
    filter,
    { $set: { status: 'processing', claimedAt: now }, $inc: { attempts: 1 } },
    { new: true }
  ).select('+rawRfc822');
}

export async function processOrderConfirmationJobs({ jobId, orderDoc, limit = 10 } = {}) {
  await releaseStaleProcessingJobs();
  let processed = 0;
  const smtpConfigured = Boolean(getSmtpConfig());
  if (!smtpConfigured) {
    const archived = await processPendingArchives({ jobId, limit });
    return { processed: 0, archived: archived.processed, reason: 'smtp_not_configured' };
  }

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextJob(jobId);
    if (!job) break;
    try {
      const order = orderDoc && String(orderDoc._id) === String(job.order)
        ? orderDoc
        : await Order.findById(job.order);
      const message = buildOrderConfirmationEmail(order || {});
      if (!message.ok) {
        job.status = 'skipped';
        job.lastError = message.reason || 'incomplete_confirmation_data';
        await job.save();
        processed += 1;
        continue;
      }
      const smtp = getSmtpConfig();
      const compiled = await compileTransactionalEmail({
        from: smtp.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      const result = await sendTransactionalEmail({
        to: message.to,
        raw: compiled.raw,
        envelope: compiled.envelope,
      });
      job.status = 'sent';
      job.smtpAcceptedAt = result.acceptedAt || new Date();
      job.messageId = result.messageId || compiled.messageId;
      job.rawRfc822 = Buffer.isBuffer(compiled.raw) ? compiled.raw.toString('utf8') : String(compiled.raw || '');
      job.lastError = '';
      job.to = message.to;
      job.archiveStatus = getImapConfig() ? 'pending' : 'skipped';
      job.archiveLastError = getImapConfig() ? '' : 'imap_not_configured';
      job.archiveNextRetryAt = new Date();
      await job.save();
      if (job.archiveStatus === 'pending') {
        await archiveSentCopy(job);
      }
      processed += 1;
    } catch (error) {
      const code = String(error?.code || '');
      const retryable = !/auth|credentials|invalid login/i.test(String(error?.message || '')) && code !== 'EAUTH';
      job.status = 'failed';
      job.nextRetryAt = retryable ? new Date(Date.now() + retryDelayMs(job.attempts)) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      job.lastError = retryable ? 'smtp_transient_failure' : 'smtp_send_failed';
      await job.save();
      processed += 1;
    }
    if (jobId) break;
  }
  const archived = await processPendingArchives({ jobId, limit });
  return { processed, archived: archived.processed };
}

async function archiveSentCopy(job) {
  if (!job || job.archiveStatus === 'archived') return job;
  if (!job.rawRfc822) {
    job.archiveStatus = 'skipped';
    job.archiveLastError = 'missing_original_message';
    await job.save();
    return job;
  }
  const result = await archiveRfc822ToSent({
    raw: job.rawRfc822,
    messageId: job.messageId,
    date: job.smtpAcceptedAt,
  });
  if (result.ok) {
    job.archiveStatus = 'archived';
    job.archivedAt = new Date();
    job.archiveFolder = result.folder || job.archiveFolder || '';
    job.archiveLastError = '';
    job.rawRfc822 = '';
    await job.save();
    return job;
  }
  const retryable = result.reason !== 'imap_auth_failed' && result.reason !== 'imap_not_configured' && result.reason !== 'missing_original_message';
  job.archiveStatus = 'failed';
  job.archiveLastError = result.reason || 'imap_archive_failed';
  job.archiveNextRetryAt = retryable
    ? new Date(Date.now() + retryDelayMs(job.archiveAttempts || 1))
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  if (!retryable) job.archiveAttempts = MAX_ARCHIVE_ATTEMPTS;
  await job.save();
  return job;
}

async function releaseStaleArchiveJobs() {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  await NotificationJob.updateMany(
    { archiveStatus: 'processing', archiveClaimedAt: { $lt: staleBefore } },
    {
      $set: {
        archiveStatus: 'failed',
        archiveLastError: 'ambiguous_archive_timeout',
        archiveAttempts: MAX_ARCHIVE_ATTEMPTS,
        archiveNextRetryAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    }
  );
}

async function claimNextArchiveJob(jobId) {
  const now = new Date();
  const filter = {
    type: 'order-confirmation',
    status: 'sent',
    archiveStatus: { $in: ['pending', 'failed'] },
    archiveAttempts: { $lt: MAX_ARCHIVE_ATTEMPTS },
    archiveNextRetryAt: { $lte: now },
    rawRfc822: { $ne: '' },
  };
  if (jobId) filter._id = jobId;
  return NotificationJob.findOneAndUpdate(
    filter,
    { $set: { archiveStatus: 'processing', archiveClaimedAt: now }, $inc: { archiveAttempts: 1 } },
    { new: true }
  ).select('+rawRfc822');
}

async function processPendingArchives({ jobId, limit = 10 } = {}) {
  await releaseStaleArchiveJobs();
  if (!getImapConfig()) return { processed: 0, reason: 'imap_not_configured' };
  await NotificationJob.updateMany(
    {
      type: 'order-confirmation',
      status: 'sent',
      archiveStatus: 'skipped',
      archiveLastError: 'imap_not_configured',
      rawRfc822: { $ne: '' },
    },
    { $set: { archiveStatus: 'pending', archiveLastError: '', archiveAttempts: 0, archiveNextRetryAt: new Date() } }
  );
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextArchiveJob(jobId);
    if (!job) break;
    try {
      await archiveSentCopy(job);
    } catch {
      job.archiveStatus = 'failed';
      job.archiveLastError = 'imap_archive_failed';
      job.archiveNextRetryAt = new Date(Date.now() + retryDelayMs(job.archiveAttempts || 1));
      await job.save();
    }
    processed += 1;
    if (jobId) break;
  }
  return { processed };
}

export async function confirmationEmailStateForOrder(orderId) {
  if (!orderId) return { status: 'queued', to: '' };
  const job = await NotificationJob.findOne({ uniqueKey: `order-confirmation:${String(orderId)}` }).lean();
  if (!job) return { status: 'queued', to: '' };
  return { status: publicConfirmationEmailStatus(job), to: job.to || '' };
}

export function adminConfirmationEmailView(job) {
  if (!job) return null;
  return {
    to: job.to || '',
    orderNumber: job.orderNumber || '',
    submissionStatus: publicConfirmationEmailStatus(job),
    smtpAcceptedAt: job.smtpAcceptedAt || null,
    archiveStatus: job.archiveStatus || '',
    archivedAt: job.archivedAt || null,
    archiveFolder: job.archiveFolder || '',
    lastError: job.archiveLastError || job.lastError || '',
  };
}

export async function attachAdminConfirmationEmails(orders) {
  const list = Array.isArray(orders) ? orders : orders ? [orders] : [];
  if (!list.length) return orders;
  const ids = list.map((order) => order?._id).filter(Boolean);
  if (!ids.length) return orders;
  const jobs = await NotificationJob.find({ type: 'order-confirmation', order: { $in: ids } })
    .select('to order orderNumber status smtpAcceptedAt archiveStatus archivedAt archiveFolder lastError archiveLastError')
    .lean();
  const byOrder = new Map(jobs.map((job) => [String(job.order), adminConfirmationEmailView(job)]));
  list.forEach((order) => {
    order.confirmationEmail = byOrder.get(String(order._id)) || null;
  });
  return orders;
}

export function ensureNotificationWorker() {
  if (global.__ggNotificationWorkerStarted) return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.NEXT_RUNTIME === 'edge') return;
  global.__ggNotificationWorkerStarted = true;
  const tick = () => {
    processOrderConfirmationJobs({ limit: 15 }).catch(() => {});
  };
  const interval = setInterval(tick, 60 * 1000);
  const startup = setTimeout(tick, 4000);
  if (typeof interval.unref === 'function') interval.unref();
  if (typeof startup.unref === 'function') startup.unref();
}
