/**
 * Pro Marketing — صندوق العملاء (Google Sheet)
 * يستقبل بيانات العملاء والأسئلة من المساعد، وطلبات المشاريع (استوديو الإبداع مع الملف المرجعي في Google Drive، وطلبات المواقع)،
 * ويرسل لك تنبيهاً على الإيميل (وتيليجرام اختيارياً) مع كل عميل جديد.
 *
 * الإعداد (مرة واحدة):
 * 1) افتح Google Sheet جديد  ←  Extensions (الإضافات)  ←  Apps Script
 * 2) امسح الكود الموجود والصق هذا الملف كاملاً، وعدّل الإعدادات تحت
 * 3) Deploy (نشر) ← New deployment ← Type: Web app
 *      Execute as: Me    |    Who has access: Anyone
 *    وافق على الصلاحيات، ثم انسخ رابط Web app (ينتهي بـ /exec)
 * 4) ضع الرابط في الموقع:  CONFIG.leadsEndpoint = 'الرابط'
 */

// ===== الإعدادات =====
const OWNER_EMAIL = '';          // إيميلك لتصلك رسالة مع كل عميل جديد (اتركه فارغاً لإيقاف الإيميل)
const TELEGRAM_BOT_TOKEN = '';   // اختياري: توكن بوت تيليجرام من @BotFather
const TELEGRAM_CHAT_ID = '';     // اختياري: رقم المحادثة اللي يوصلها التنبيه
const NOTIFY_QUESTIONS = false;  // true = تنبيه أيضاً مع كل سؤال لم يجد له المساعد إجابة

// ===== لا تعدّل تحت هذا السطر =====
const LEADS_SHEET = 'العملاء';
const QUESTIONS_SHEET = 'الأسئلة';
const LEADS_HEAD = ['التاريخ', 'الاسم', 'الجوال', 'النشاط / الشركة', 'المدينة', 'الخدمة المطلوبة', 'اللغة', 'الصفحة', 'رابط واتساب', 'الحالة', 'ملاحظات', 'المعرّف'];
const Q_HEAD = ['التاريخ', 'الاسم', 'الجوال', 'السؤال', 'أجاب المساعد؟', 'الموضوع', 'المعرّف'];
const PROJECTS_SHEET = 'طلبات المشاريع';
const P_HEAD = ['التاريخ', 'نوع الطلب', 'الاسم', 'الجوال', 'الخدمة', 'وصف المشروع', 'الملف المرجعي', 'رابط واتساب', 'اللغة', 'الحالة', 'ملاحظات', 'المعرّف'];
const FILES_FOLDER = 'Pro Marketing — ملفات العملاء';
const FILE_MAX = 3 * 1024 * 1024;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (d.type === 'lead') {
      if (!clean_(d.name) || !digits_(d.phone)) return json_({ ok: false, error: 'missing_fields' });
      if (isDuplicate_(ss, d.id)) return json_({ ok: true, duplicate: true });
      const wa = 'https://wa.me/' + digits_(d.phone);
      sheet_(ss, LEADS_SHEET, LEADS_HEAD).appendRow([new Date(), clean_(d.name), clean_(d.phone), clean_(d.business), clean_(d.city), clean_(d.service),
        d.lang === 'en' ? 'English' : 'عربي', clean_(d.page), wa, 'جديد', '', clean_(d.id)]);
      notify_('🟡 عميل جديد من الموقع',
        ['الاسم: ' + clean_(d.name), 'الجوال: ' + clean_(d.phone), 'النشاط: ' + (clean_(d.business) || '-'), 'المدينة: ' + (clean_(d.city) || '-'),
         'الخدمة: ' + (clean_(d.service) || '-'), 'واتساب: ' + wa]);
    } else if (d.type === 'question') {
      if (!clean_(d.question)) return json_({ ok: false, error: 'missing_fields' });
      sheet_(ss, QUESTIONS_SHEET, Q_HEAD).appendRow([new Date(), clean_(d.name), clean_(d.phone), clean_(d.question), d.answered ? 'نعم' : 'لا — يحتاج رد', clean_(d.topic), clean_(d.id)]);
      if (NOTIFY_QUESTIONS && !d.answered) notify_('❓ سؤال يحتاج رد', ['من: ' + clean_(d.name) + ' — ' + clean_(d.phone), 'السؤال: ' + clean_(d.question)]);
    } else if (d.type === 'project') {
      if (!clean_(d.name) || !digits_(d.phone) || !clean_(d.service)) return json_({ ok: false, error: 'missing_fields' });
      let fileCell = '';
      if (d.attachment && d.attachment.data) {
        const bytes = Utilities.base64Decode(String(d.attachment.data));
        if (bytes.length > FILE_MAX) return json_({ ok: false, error: 'file_too_large' });
        const name = String(d.attachment.name || 'reference').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
        const file = folder_().createFile(Utilities.newBlob(bytes, String(d.attachment.type || 'application/octet-stream'), new Date().toISOString().slice(0, 10) + ' — ' + clean_(d.name) + ' — ' + name));
        fileCell = file.getUrl();
      }
      const wa = 'https://wa.me/' + digits_(d.phone);
      const kind = d.requestType === 'web' ? 'موقع إلكتروني' : 'استوديو الإبداع';
      sheet_(ss, PROJECTS_SHEET, P_HEAD).appendRow([new Date(), kind, clean_(d.name), clean_(d.phone), clean_(d.service), clean_(d.description), fileCell, wa, d.lang === 'en' ? 'English' : 'عربي', 'جديد', '', clean_(d.id)]);
      notify_(d.requestType === 'web' ? '🌐 طلب موقع إلكتروني جديد' : '🎬 طلب جديد لاستوديو الإبداع', ['الاسم: ' + clean_(d.name), 'الجوال: ' + clean_(d.phone), 'الخدمة: ' + clean_(d.service),
        'الوصف: ' + (clean_(d.description) || '-'), 'الملف: ' + (fileCell || 'لا يوجد'), 'واتساب: ' + wa]);
    } else {
      return json_({ ok: false, error: 'bad_type' });
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return json_({ ok: true, service: 'Pro Marketing leads' }); }

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
// يمنع تنفيذ أي نص يبدأ بـ = + - @ كمعادلة داخل الشيت
function clean_(v) { const s = String(v == null ? '' : v).slice(0, 1000).trim(); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function digits_(v) { return String(v || '').replace(/\D/g, ''); }
function sheet_(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#111111').setFontColor('#FFD400');
    sh.setRightToLeft(true);
  }
  return sh;
}
function folder_() {
  const it = DriveApp.getFoldersByName(FILES_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FILES_FOLDER);
}
function isDuplicate_(ss, id) {
  const sh = ss.getSheetByName(LEADS_SHEET);
  if (!id || !sh || sh.getLastRow() < 2) return false;
  const col = LEADS_HEAD.length;
  return sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues().some(r => r[0] === id);
}
function notify_(title, lines) {
  const body = lines.join('\n');
  if (OWNER_EMAIL) {
    try { MailApp.sendEmail(OWNER_EMAIL, title, body + '\n\nكل العملاء: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()); } catch (e) { console.error(e); }
  }
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: title + '\n\n' + body })
      });
    } catch (e) { console.error(e); }
  }
}

// شغّل هذه الدالة مرة من المحرر (Run) لتتأكد أن الشيت والإيميل شغالين
function testSetup() {
  const r = doPost({ postData: { contents: JSON.stringify({ type: 'lead', id: 'test-' + Date.now(), name: 'عميل تجريبي', phone: '+966500000000', business: 'تجربة', city: 'الرياض', service: 'تجربة الإعداد', lang: 'ar', page: '#test' }) } });
  console.log(r.getContent());
}
