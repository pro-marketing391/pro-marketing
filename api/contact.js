// Vercel Serverless Function — POST /api/contact
// Delivers website leads by email (Resend) and/or to a webhook (CRM, Google Sheets, Zapier, Make…).
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY       – API key from https://resend.com (enables email delivery)
//   CONTACT_TO_EMAIL     – inbox that receives leads, e.g. leads@yourdomain.com (comma-separate several)
//   CONTACT_FROM_EMAIL   – verified sender, e.g. "Pro Website <noreply@yourdomain.com>"
//   CONTACT_WEBHOOK_URL  – optional; receives the lead as JSON (POST)
//   ALLOWED_ORIGIN       – optional; e.g. https://yourdomain.com (rejects other origins)
//
// The function returns { ok: true } ONLY when at least one delivery channel succeeded.
// requestType "studio" (Creative Studio project form): name + phone + service required, optional
// attachment { name, type, data(base64) } up to 3 MB, delivered as an email attachment.

const MAX = { name: 120, company: 160, email: 160, phone: 20, industry: 80, country: 60, budget: 80, method: 40, requestType: 20, description: 3000, service: 80, activity: 120, websiteType: 60 };
const FILE_MAX = 3 * 1024 * 1024;
const FILE_TYPES = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf|video\/(mp4|quicktime)|application\/(msword|zip|x-zip-compressed|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation))|application\/octet-stream)$/;
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const escHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// naive per-instance rate limit (best effort; use a KV store for strict limits)
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter(t => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }

  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && req.headers.origin && req.headers.origin !== allowed) return res.status(403).json({ ok: false, error: 'forbidden_origin' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'too_many_requests' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return res.status(400).json({ ok: false, error: 'invalid_json' }); } }
  if (!b || typeof b !== 'object') return res.status(400).json({ ok: false, error: 'invalid_body' });

  // honeypot: bots fill the hidden "website" field — pretend success without sending
  if (b.website) return res.status(200).json({ ok: true });

  const lead = {};
  for (const k of Object.keys(MAX)) lead[k] = clean(b[k], MAX[k]);
  lead.services = (Array.isArray(b.services) ? b.services : []).map(s => clean(s, 80)).filter(Boolean).slice(0, 10);
  lead.features = (Array.isArray(b.features) ? b.features : []).map(s => clean(s, 60)).filter(Boolean).slice(0, 15);
  lead.lang = b.lang === 'en' ? 'en' : 'ar';
  lead.page = clean(b.page, 80);
  lead.receivedAt = new Date().toISOString();

  const studio = lead.requestType === 'studio', web = lead.requestType === 'web';
  const errors = [];
  if (studio || web) { // short project forms (Creative Studio / Web Development): name + phone + type
    if (!lead.name) errors.push('name');
    if (web && !lead.activity) errors.push('activity');
    if (web && !lead.websiteType) errors.push('websiteType');
    if (web && !lead.service) lead.service = 'Website — ' + lead.websiteType;
    if (!lead.service && lead.services.length) lead.service = lead.services[0];
    if (lead.service && !lead.services.length) lead.services = [lead.service];
    if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.push('email');
  } else {
    ['name', 'company', 'industry', 'country', 'budget'].forEach(k => { if (!lead[k]) errors.push(k); });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.push('email');
  }
  let file = null;
  if (b.attachment && typeof b.attachment === 'object' && b.attachment.data) {
    const name = clean(b.attachment.name, 120).replace(/[\\/:*?"<>|]/g, '_') || 'reference';
    const type = clean(b.attachment.type, 120) || 'application/octet-stream';
    const data = String(b.attachment.data);
    const bytes = /^[A-Za-z0-9+/=\s]+$/.test(data) ? Buffer.from(data, 'base64').length : -1;
    if (bytes <= 0 || bytes > FILE_MAX || !FILE_TYPES.test(type)) errors.push('attachment');
    else file = { name, type, data: data.replace(/\s/g, ''), bytes };
  }
  lead.attachment = file ? `${file.name} (${(file.bytes / 1048576).toFixed(2)} MB)` : '';
  if (!/^\+\d{8,15}$/.test(lead.phone) || (lead.phone.startsWith('+966') && !/^\+9665\d{8}$/.test(lead.phone))) errors.push('phone');
  if (!lead.services.length) errors.push('services');
  if (errors.length) return res.status(422).json({ ok: false, error: 'validation', fields: errors });

  const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL, CONTACT_WEBHOOK_URL } = process.env;
  const emailOn = RESEND_API_KEY && CONTACT_TO_EMAIL && CONTACT_FROM_EMAIL;
  if (!emailOn && !CONTACT_WEBHOOK_URL) {
    console.error('[contact] No delivery channel configured. Set RESEND_API_KEY + CONTACT_TO_EMAIL + CONTACT_FROM_EMAIL and/or CONTACT_WEBHOOK_URL.');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  const rows = web ? [
    ['Name', lead.name], ['Phone', lead.phone], ['Email', lead.email || '—'], ['Business activity', lead.activity], ['Website type', lead.websiteType],
    ['Required features', lead.features.join(', ') || '—'], ['Request type', 'Web development project'], ['Language', lead.lang], ['Page', lead.page], ['Description', lead.description || '—']
  ] : studio ? [
    ['Name', lead.name], ['Phone', lead.phone], ['Email', lead.email || '—'], ['Service', lead.service || lead.services.join(', ')],
    ['Request type', 'Creative Studio project'], ['Reference file', lead.attachment || '—'], ['Language', lead.lang], ['Page', lead.page],
    ['Description', lead.description || '—']
  ] : [
    ['Name', lead.name], ['Company', lead.company], ['Phone', lead.phone], ['Email', lead.email],
    ['Industry', lead.industry], ['Country', lead.country], ['Services', lead.services.join(', ')],
    ['Budget (SAR)', lead.budget], ['Request type', lead.requestType || 'contact'], ['Preferred contact', lead.method], ['Language', lead.lang], ['Page', lead.page],
    ['Description', lead.description || '—']
  ];
  const tasks = [];

  if (emailOn) {
    const html = `<h2 style="font-family:Arial">New website lead</h2><table cellpadding="8" style="border-collapse:collapse;font-family:Arial;font-size:14px">${rows.map(([k, v]) => `<tr><td style="border:1px solid #ddd;font-weight:bold;background:#f6f6f6">${k}</td><td style="border:1px solid #ddd;white-space:pre-wrap">${escHtml(v)}</td></tr>`).join('')}</table>`;
    tasks.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ from: CONTACT_FROM_EMAIL, to: CONTACT_TO_EMAIL.split(',').map(s => s.trim()),
        subject: web ? `New website request: ${lead.name} — ${lead.websiteType}` : studio ? `New studio request: ${lead.name} — ${lead.service || lead.services.join(', ')}` : `New ${lead.requestType || 'lead'}: ${lead.company} — ${lead.services.join(', ')}`,
        html, text: rows.map(r => r.join(': ')).join('\n') }, lead.email ? { reply_to: lead.email } : {}, file ? { attachments: [{ filename: file.name, content: file.data }] } : {}))
    }).then(async r => { if (!r.ok) throw new Error('resend ' + r.status + ' ' + (await r.text()).slice(0, 200)); return 'email'; }));
  }
  if (CONTACT_WEBHOOK_URL) {
    tasks.push(fetch(CONTACT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) })
      .then(r => { if (!r.ok) throw new Error('webhook ' + r.status); return 'webhook'; }));
  }

  const results = await Promise.allSettled(tasks);
  const delivered = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  results.filter(r => r.status === 'rejected').forEach(r => console.error('[contact] delivery failed:', r.reason && r.reason.message));
  if (!delivered.length) return res.status(502).json({ ok: false, error: 'delivery_failed' });
  return res.status(200).json({ ok: true, delivered });
};
