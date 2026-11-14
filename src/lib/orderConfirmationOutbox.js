import NotificationJob from '@/models/NotificationJob';
import Order from '@/models/Order';
import { getSmtpConfig, sendTransactionalEmail } from '@/lib/email';
import { buildOrderConfirmationEmail, ORDER_CONFIRMATION_TEMPLATE_VERSION } from '@/lib/orderConfirmationEmail';
import { confirmationRecipientEmail } from '@/lib/orderConfirmationSchedule';

const MAX_ATTEMPTS = 6;
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
  );
}

export async function processOrderConfirmationJobs({ jobId, orderDoc, limit = 10 } = {}) {
  await releaseStaleProcessingJobs();
  if (!getSmtpConfig()) return { processed: 0, reason: 'smtp_not_configured' };

  let processed = 0;
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
      const result = await sendTransactionalEmail({
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      job.status = 'sent';
      job.smtpAcceptedAt = result.acceptedAt || new Date();
      job.lastError = '';
      job.to = message.to;
      await job.save();
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
  return { processed };
}

export async function confirmationEmailStateForOrder(orderId) {
  if (!orderId) return { status: 'queued', to: '' };
  const job = await NotificationJob.findOne({ uniqueKey: `order-confirmation:${String(orderId)}` }).lean();
  if (!job) return { status: 'queued', to: '' };
  return { status: publicConfirmationEmailStatus(job), to: job.to || '' };
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
