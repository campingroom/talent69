/**
 * ระบบลงทะเบียนและแดชบอร์ด งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569
 * กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง (สพป.มหาสารคาม เขต 3)
 *
 * รองรับระบบตรวจสอบสิทธิ์แอดมิน (Admin PIN) และการยืนยันตัวตนด้วยเบอร์โทรผู้ประสานงานเมื่อแก้ไขรายชื่อ
 */

const SPREADSHEET_ID = '1AQup-qqjD8U7GpyE2r2pO9G7vBKMGSfaEs_rl-kMdnQ';
const DEFAULT_ADMIN_PIN = '7469';

function getSpreadsheet_() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAdminPin_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('ADMIN_PIN') || DEFAULT_ADMIN_PIN;
}

function isRegistrationOpen_() {
  const props = PropertiesService.getScriptProperties();
  const val = props.getProperty('REGISTRATION_OPEN');
  return val === null ? true : val === 'true';
}

function verifyAdminPin_(pin) {
  if (!pin) return false;
  return String(pin).trim() === String(getAdminPin_()).trim();
}

function verifyPhoneMatch_(savedPhone, verifyInput) {
  const cleanSaved = String(savedPhone || '').replace(/\D/g, '');
  const cleanInput = String(verifyInput || '').replace(/\D/g, '');
  if (!cleanSaved || !cleanInput || cleanInput.length < 4) return false;
  return cleanSaved === cleanInput || cleanSaved.slice(-4) === cleanInput.slice(-4);
}

/**
 * ดึงข้อมูลทั้งหมด (Schools, Competitions, Registrations, Config) ส่งกลับให้หน้าเว็บ
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet_();
    const schools = readSchools_(ss);
    const competitions = readCompetitions_(ss);
    const registrations = readRegistrations_(ss);

    return jsonResponse_({
      ok: true,
      updatedAt: new Date().toISOString(),
      config: {
        registrationOpen: isRegistrationOpen_()
      },
      schools: schools,
      competitions: competitions,
      registrations: registrations
    });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

/**
 * รับคำสั่งบันทึกข้อมูลจากหน้าเว็บ พร้อมตรวจสอบสิทธิ์แอดมิน/ผู้ประสานงาน
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(rawBody);
    const action = body.action || 'register';
    const ss = getSpreadsheet_();
    const isAdmin = verifyAdminPin_(body.admin_pin);

    if (action === 'verify_admin') {
      return jsonResponse_({ ok: isAdmin, error: isAdmin ? null : 'รหัสแอดมินไม่ถูกต้อง' });
    }

    if (action === 'register') {
      return handleRegister_(ss, body, isAdmin);
    }

    // คำสั่งต่อไปนี้อนุญาตเฉพาะแอดมินเท่านั้น
    if (!isAdmin) {
      return jsonResponse_({
        ok: false,
        code: 'UNAUTHORIZED_ADMIN',
        error: 'คำสั่งนี้ต้องใช้สิทธิ์แอดมินเท่านั้น กรุณาเข้าสู่ระบบแอดมินก่อนดำเนินการ'
      });
    }

    if (action === 'delete_registration') {
      return handleDeleteRegistration_(ss, body.reg_id);
    } else if (action === 'clear_sample_data') {
      return handleClearSampleData_(ss);
    } else if (action === 'add_competition') {
      return handleAddCompetition_(ss, body.competition);
    } else if (action === 'add_school') {
      return handleAddSchool_(ss, body.school);
    } else if (action === 'set_registration_status') {
      PropertiesService.getScriptProperties().setProperty(
        'REGISTRATION_OPEN',
        body.registrationOpen ? 'true' : 'false'
      );
      return jsonResponse_({ ok: true, registrationOpen: Boolean(body.registrationOpen) });
    } else if (action === 'change_admin_pin') {
      const newPin = String(body.new_pin || '').trim();
      if (newPin.length < 4) {
        return jsonResponse_({ ok: false, error: 'รหัสแอดมินต้องมีอย่างน้อย 4 ตัวอักษร' });
      }
      PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', newPin);
      return jsonResponse_({ ok: true });
    }

    return jsonResponse_({ ok: false, error: 'ไม่รู้จักคำสั่ง: ' + action });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  } finally {
    lock.releaseLock();
  }
}

function handleRegister_(ss, body, isAdmin) {
  if (!isRegistrationOpen_() && !isAdmin) {
    return jsonResponse_({
      ok: false,
      error: 'ขณะนี้ระบบปิดรับสมัครแล้ว หากต้องการแก้ไขข้อมูลกรุณาติดต่อแอดมินกลุ่มโรงเรียน'
    });
  }

  const regSheet = ss.getSheetByName('Registrations');
  const data = regSheet.getDataRange().getValues();
  const schoolName = String(body.school_name || '').trim();
  const compId = String(body.comp_id || '').trim();
  const allowOverwrite = Boolean(body.allowOverwrite);

  if (!schoolName || !compId) {
    return jsonResponse_({ ok: false, error: 'กรุณาระบุโรงเรียนและรายการแข่งขันให้ครบถ้วน' });
  }

  // ตรวจกฎเหล็ก: 1 โรงเรียน ส่งได้แค่ 1 ทีม ต่อ 1 รายการแข่งขัน
  let existingRowIndex = -1;
  let existingRegId = '';
  let existingPhone = '';
  let existingStatus = '';
  for (let i = 1; i < data.length; i++) {
    const rowSchool = String(data[i][2] || '').trim();
    const rowCompId = String(data[i][3] || '').trim();
    if (rowSchool === schoolName && rowCompId === compId) {
      existingRowIndex = i + 1;
      existingRegId = String(data[i][0] || '');
      existingPhone = String(data[i][12] || '');
      existingStatus = String(data[i][13] || '');
      break;
    }
  }

  if (existingRowIndex !== -1) {
    if (!allowOverwrite) {
      return jsonResponse_({
        ok: false,
        code: 'DUPLICATE_ENTRY',
        error: 'โรงเรียนนี้ได้ลงทะเบียนรายการนี้ไปแล้ว (กติกา: 1 โรงเรียน ส่งได้ 1 ทีมต่อรายการ)'
      });
    }
    // ตรวจสอบสิทธิ์การแก้ไขรายชื่อเดิม: ต้องเป็นแอดมิน หรือเป็นข้อมูลตัวอย่าง หรือยืนยันเบอร์โทรผู้ประสานงานตรงกัน
    const isSampleRow = existingStatus.indexOf('ตัวอย่าง') !== -1;
    const phoneVerified = verifyPhoneMatch_(existingPhone, body.edit_verify_token || body.coordinator_phone);
    if (!isAdmin && !isSampleRow && !phoneVerified) {
      return jsonResponse_({
        ok: false,
        code: 'EDIT_VERIFY_FAILED',
        error: 'เบอร์โทรศัพท์ผู้ประสานงานไม่ตรงกับที่ใช้ลงทะเบียนไว้ ไม่สามารถแก้ไขทับได้'
      });
    }
  }

  const students = Array.isArray(body.students) ? body.students : [];
  const teachers = Array.isArray(body.teachers) ? body.teachers : [];
  const stuLines = students.map(function(s, idx) {
    return (idx + 1) + '. ' + (s.prefix || '') + (s.name || '') + (s.grade ? ' (' + s.grade + ')' : '');
  }).join('\n');
  const tchLines = teachers.map(function(t, idx) {
    return (idx + 1) + '. ' + (t.prefix || '') + (t.name || '');
  }).join('\n');

  const regId = existingRegId || body.reg_id || ('REG-74-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'MMddHHmmss'));
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const payloadJson = JSON.stringify({ students: students, teachers: teachers });

  const rowValues = [
    regId,
    timestamp,
    schoolName,
    compId,
    String(body.learning_area || ''),
    String(body.comp_name || ''),
    String(body.level || ''),
    String(body.team_type || ''),
    students.length,
    stuLines,
    teachers.length,
    tchLines,
    String(body.coordinator_phone || ''),
    String(body.status || 'ลงทะเบียนแล้ว'),
    payloadJson
  ];

  if (existingRowIndex !== -1) {
    regSheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    regSheet.appendRow(rowValues);
  }

  return jsonResponse_({
    ok: true,
    reg_id: regId,
    updated: existingRowIndex !== -1
  });
}

function handleDeleteRegistration_(ss, regId) {
  const regSheet = ss.getSheetByName('Registrations');
  const data = regSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0] || '') === String(regId || '')) {
      regSheet.deleteRow(i + 1);
      return jsonResponse_({ ok: true, deleted_reg_id: regId });
    }
  }
  return jsonResponse_({ ok: false, error: 'ไม่พบรหัสใบสมัครที่ต้องการลบ' });
}

function handleClearSampleData_(ss) {
  const regSheet = ss.getSheetByName('Registrations');
  const data = regSheet.getDataRange().getValues();
  let removed = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][13] || '').indexOf('ตัวอย่าง') !== -1) {
      regSheet.deleteRow(i + 1);
      removed++;
    }
  }
  return jsonResponse_({ ok: true, removedCount: removed });
}

function handleAddCompetition_(ss, comp) {
  if (!comp || !comp.comp_id || !comp.comp_name) {
    return jsonResponse_({ ok: false, error: 'ข้อมูลรายการแข่งขันไม่ครบถ้วน' });
  }
  const sheet = ss.getSheetByName('Competitions');
  const nextRow = sheet.getLastRow() + 1;
  sheet.appendRow([
    String(comp.comp_id).trim(),
    String(comp.learning_area || '').trim(),
    String(comp.comp_name).trim(),
    String(comp.level || '').trim(),
    String(comp.team_type || 'เดี่ยว').trim(),
    Number(comp.min_students || 1),
    Number(comp.max_students || 1),
    Number(comp.min_teachers || 1),
    Number(comp.max_teachers || 1),
    String(comp.status || 'เปิดรับสมัคร'),
    '=COUNTIF(Registrations!$D$2:$D$1000, A' + nextRow + ')'
  ]);
  return jsonResponse_({ ok: true });
}

function handleAddSchool_(ss, school) {
  if (!school || !school.school_name) {
    return jsonResponse_({ ok: false, error: 'กรุณาระบุชื่อโรงเรียน' });
  }
  const sheet = ss.getSheetByName('Schools');
  const nextRow = sheet.getLastRow() + 1;
  const schoolId = school.school_id || ('SCH-' + String(nextRow - 1).padStart(2, '0'));
  sheet.appendRow([
    schoolId,
    String(school.school_name).trim(),
    String(school.subdistrict || '').trim(),
    String(school.school_type || 'ประถมศึกษา').trim(),
    String(school.network_group || 'กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง'),
    '=COUNTIF(Registrations!$C$2:$C$1000, B' + nextRow + ')',
    '=SUMIF(Registrations!$C$2:$C$1000, B' + nextRow + ', Registrations!$I$2:$I$1000)',
    '=SUMIF(Registrations!$C$2:$C$1000, B' + nextRow + ', Registrations!$K$2:$K$1000)'
  ]);
  return jsonResponse_({ ok: true, school_id: schoolId });
}

function readSchools_(ss) {
  const sheet = ss.getSheetByName('Schools');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][1]) continue;
    result.push({
      school_id: String(rows[i][0] || ''),
      school_name: String(rows[i][1] || ''),
      subdistrict: String(rows[i][2] || ''),
      school_type: String(rows[i][3] || ''),
      network_group: String(rows[i][4] || '')
    });
  }
  return result;
}

function readCompetitions_(ss) {
  const sheet = ss.getSheetByName('Competitions');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] || !rows[i][2]) continue;
    result.push({
      comp_id: String(rows[i][0] || ''),
      learning_area: String(rows[i][1] || ''),
      comp_name: String(rows[i][2] || ''),
      level: String(rows[i][3] || ''),
      team_type: String(rows[i][4] || 'เดี่ยว'),
      min_students: Number(rows[i][5] || 1),
      max_students: Number(rows[i][6] || 1),
      min_teachers: Number(rows[i][7] || 1),
      max_teachers: Number(rows[i][8] || 1),
      status: String(rows[i][9] || 'เปิดรับสมัคร')
    });
  }
  return result;
}

function readRegistrations_(ss) {
  const sheet = ss.getSheetByName('Registrations');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] || !rows[i][2]) continue;
    let parsed = { students: [], teachers: [] };
    try {
      if (rows[i][14]) parsed = JSON.parse(String(rows[i][14]));
    } catch (e) {}
    result.push({
      reg_id: String(rows[i][0] || ''),
      timestamp: String(rows[i][1] || ''),
      school_name: String(rows[i][2] || ''),
      comp_id: String(rows[i][3] || ''),
      learning_area: String(rows[i][4] || ''),
      comp_name: String(rows[i][5] || ''),
      level: String(rows[i][6] || ''),
      team_type: String(rows[i][7] || ''),
      students: parsed.students || [],
      teachers: parsed.teachers || [],
      coordinator_phone: String(rows[i][12] || ''),
      status: String(rows[i][13] || 'ลงทะเบียนแล้ว')
    });
  }
  return result;
}
