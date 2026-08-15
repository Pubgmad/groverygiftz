import nodemailer from 'nodemailer';

function smtpConfig() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || user;

  if (!host || !user || !pass || !from) return null;

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  const config = smtpConfig();
  if (!config) throw new Error('SMTP email is not configured');

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transporter.sendMail({
    from: config.from,
    to,
    subject: 'Reset your GroveryGiftz password',
    text: [
      'We received a request to reset your GroveryGiftz password.',
      '',
      `Reset your password here: ${resetLink}`,
      '',
      'This link expires in 1 hour.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <div style="margin-bottom:18px">
          <img src="https://groverygiftz.in/media/uploads/1786613102578-9xp158-Grovery.png" alt="GroveryGiftz" style="display:block;width:86px;height:auto" />
        </div>
        <h2 style="margin:0 0 12px;color:#2456D8">Reset your GroveryGiftz password</h2>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;background:#2456D8;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">
            Reset Password
          </a>
        </p>
        <p>This link expires in 1 hour.</p>
        <p style="color:#6b7280;font-size:13px">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}
