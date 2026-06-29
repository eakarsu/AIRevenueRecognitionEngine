const axios = require('axios');
const nodemailer = require('nodemailer');

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function webhookConfigured() {
  return Boolean(process.env.NOTIFICATION_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL);
}

async function sendEmail(payload) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.NOTIFICATION_EMAIL_TO || payload.owner_email || process.env.SMTP_USER,
    subject: `[RevRec] ${payload.priority || 'Medium'}: ${payload.title}`,
    text: `${payload.title}\n\n${payload.summary || ''}\n\nOwner: ${payload.owner || 'Unassigned'}\nSource: ${payload.source_system || 'RevRec'}`,
  });
  return { channel: 'email', status: 'sent', message_id: info.messageId };
}

async function sendWebhook(payload) {
  const webhook = process.env.NOTIFICATION_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  const response = await axios.post(webhook, payload, { timeout: 8000 });
  return { channel: 'webhook', status: 'sent', response_status: response.status };
}

async function deliverNotification(payload) {
  const attempts = [];
  if (webhookConfigured()) {
    try { attempts.push(await sendWebhook(payload)); } catch (err) { attempts.push({ channel: 'webhook', status: 'failed', error: err.message }); }
  }
  if (smtpConfigured()) {
    try { attempts.push(await sendEmail(payload)); } catch (err) { attempts.push({ channel: 'email', status: 'failed', error: err.message }); }
  }
  if (!attempts.length) {
    return {
      mode: 'simulated',
      status: 'queued',
      required_env: ['NOTIFICATION_WEBHOOK_URL or SLACK_WEBHOOK_URL', 'or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD'],
      sent_at: new Date().toISOString(),
      payload,
    };
  }
  return {
    mode: 'live',
    status: attempts.some((attempt) => attempt.status === 'sent') ? 'sent' : 'failed',
    attempts,
    sent_at: new Date().toISOString(),
  };
}

module.exports = {
  deliverNotification,
  smtpConfigured,
  webhookConfigured,
};
