/**
 * ระบบบริหารจัดการและรายงานผล งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569
 * กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง (สพป.มหาสารคาม เขต 3)
 *
 * รองรับครบวงจร (เฟส 1 + เฟส 2 แนวทาง cm3art.com):
 * - ลงทะเบียนนักเรียน/ครูผู้ฝึกซ้อม และแก้ไขรายชื่อด้วยเบอร์โทรผู้ประสานงาน (หรือ 4 ตัวท้าย)
 * - ตารางวันเวลาและสถานที่จัดการแข่งขัน (Schedule & Venue)
 * - ทำเนียบคณะกรรมการตัดสิน (Judges)
 * - บันทึกคะแนน คำนวณเหรียญรางวัล และจัดลำดับที่อัตโนมัติ (Scores, Medals & Rankings)
 * - ระบบออกเกียรติบัตรออนไลน์ (Online Certificates)
 */

const SPREADSHEET_ID = '1AQup-qqjD8U7GpyE2r2pO9G7vBKMGSfaEs_rl-kMdnQ';
// Default admin PIN is verified via SHA-256 hash so no plaintext PIN is exposed in source
const DEFAULT_ADMIN_PIN_HASH = 'cf66a6b6499f8f04366edb73ea50dac507b0fc013ba6b5fd7e3a8856226bbcd0';

function sha256Hex_(input) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(input || ''),
    Utilities.Charset.UTF_8
  );
  return digest
    .map(function (b) {
      const val = (b < 0 ? b + 256 : b).toString(16);
      return val.length === 1 ? '0' + val : val;
    })
    .join('');
}

function getSpreadsheet_() {
  let ss = null;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (ss) {
    try {
      if (ss.getSpreadsheetTimeZone() !== 'Asia/Bangkok') {
        ss.setSpreadsheetTimeZone('Asia/Bangkok');
      }
    } catch (e) {}
  }
  return ss;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isRegistrationOpen_() {
  const props = PropertiesService.getScriptProperties();
  const val = props.getProperty('REGISTRATION_OPEN');
  return val === null ? true : val === 'true';
}

function getStoredOperationTimeline_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('OPERATION_TIMELINE_JSON');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch (e) {
    return null;
  }
}

function verifyAdminPin_(pin) {
  if (!pin) return false;
  const cleanPin = String(pin).trim();
  const props = PropertiesService.getScriptProperties();
  const storedPin = props.getProperty('ADMIN_PIN');
  if (storedPin) {
    return cleanPin === String(storedPin).trim();
  }
  return sha256Hex_(cleanPin) === DEFAULT_ADMIN_PIN_HASH;
}

function verifyPhoneMatch_(savedPhone, verifyInput) {
  const cleanSaved = String(savedPhone || '').replace(/\D/g, '');
  const cleanInput = String(verifyInput || '').replace(/\D/g, '');
  if (!cleanSaved || !cleanInput || cleanInput.length < 4) return false;
  return cleanSaved === cleanInput || cleanSaved.slice(-4) === cleanInput.slice(-4);
}

function verifyFullPhoneMatch_(savedPhone, verifyInput) {
  const cleanSaved = String(savedPhone || '').replace(/\D/g, '');
  const cleanInput = String(verifyInput || '').replace(/\D/g, '');
  if (!cleanSaved || cleanSaved.length < 9 || !cleanInput) return false;
  return cleanSaved === cleanInput;
}

function maskPhone_(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length < 7) return d ? '***' : '-';
  return d.slice(0, 3) + '-xxx-' + d.slice(-4);
}

/**
 * ดึงข้อมูลทั้งหมด (Schools, Competitions, Registrations, Judges, DeletionLogs, Config) ส่งกลับให้หน้าเว็บ
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet_();
    const schools = readSchools_(ss);
    const competitions = readCompetitions_(ss);
    const registrations = readRegistrations_(ss);
    const judges = readJudges_(ss);
    const deletionLogs = readDeletionLogs_(ss);

    return jsonResponse_({
      ok: true,
      updatedAt: new Date().toISOString(),
      config: {
        registrationOpen: isRegistrationOpen_(),
        operationTimeline: getStoredOperationTimeline_(),
        featureVisibility: getStoredFeatureVisibility_(),
        certConfig: getStoredCertConfig_()
      },
      schools: schools,
      competitions: competitions,
      registrations: registrations,
      judges: judges,
      deletionLogs: deletionLogs
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

    if (action === 'delete_registration') {
      return handleDeleteRegistration_(ss, body, isAdmin);
    }

    // คำสั่งต่อไปนี้อนุญาตเฉพาะแอดมินเท่านั้น
    if (!isAdmin) {
      return jsonResponse_({
        ok: false,
        code: 'UNAUTHORIZED_ADMIN',
        error: 'คำสั่งนี้ต้องใช้สิทธิ์แอดมินเท่านั้น กรุณาเข้าสู่ระบบแอดมินก่อนดำเนินการ'
      });
    }

    if (action === 'clear_sample_data') {
      return handleClearSampleData_(ss);
    } else if (action === 'fix_timestamps') {
      return handleFixTimestamps_(ss);
    } else if (action === 'save_scores' || action === 'save_scores_batch') {
      return handleSaveScores_(ss, body);
    } else if (action === 'update_schedule' || action === 'update_competition_schedule') {
      return handleUpdateSchedule_(ss, body);
    } else if (action === 'update_schedule_batch') {
      return handleUpdateScheduleBatch_(ss, body);
    } else if (action === 'add_judge') {
      return handleAddJudge_(ss, body.judge);
    } else if (action === 'delete_judge') {
      return handleDeleteJudge_(ss, body.judge_id);
    } else if (action === 'add_competition') {
      return handleAddCompetition_(ss, body.competition);
    } else if (action === 'add_school') {
      return handleAddSchool_(ss, body.school);
    } else if (action === 'set_registration_status' || action === 'set_registration_open') {
      const isOpen = body.registrationOpen !== undefined ? Boolean(body.registrationOpen) : (body.isOpen !== undefined ? Boolean(body.isOpen) : true);
      PropertiesService.getScriptProperties().setProperty(
        'REGISTRATION_OPEN',
        isOpen ? 'true' : 'false'
      );
      return jsonResponse_({ ok: true, registrationOpen: isOpen });
    } else if (action === 'change_admin_pin') {
      const newPin = String(body.new_pin || '').trim();
      if (newPin.length < 4) {
        return jsonResponse_({ ok: false, error: 'รหัสแอดมินต้องมีอย่างน้อย 4 ตัวอักษร' });
      }
      PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', newPin);
      return jsonResponse_({ ok: true });
    } else if (action === 'save_timeline_config') {
      return handleSaveTimelineConfig_(body);
    } else if (action === 'save_feature_visibility') {
      return handleSaveFeatureVisibility_(body);
    } else if (action === 'save_cert_config') {
      return handleSaveCertConfig_(body);
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

  let existingRowIndex = -1;
  let existingRow = null;
  for (let i = 1; i < data.length; i++) {
    const rowSchool = String(data[i][2] || '').trim();
    const rowCompId = String(data[i][3] || '').trim();
    if (rowSchool === schoolName && rowCompId === compId) {
      existingRowIndex = i + 1;
      existingRow = data[i];
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
    const existingPhone = String(existingRow[12] || '');
    const existingStatus = String(existingRow[13] || '');
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

  const regId = (existingRow ? String(existingRow[0] || '') : '') || body.reg_id || ('REG-74-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'MMddHHmmss'));
  const timestamp = body.timestamp || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const payloadJson = JSON.stringify({ students: students, teachers: teachers });

  const scoreVal = body.score !== undefined ? body.score : (existingRow ? existingRow[14] : '');
  const medalVal = body.medal !== undefined ? body.medal : (existingRow ? existingRow[15] : '');
  const rankVal = body.rank !== undefined ? body.rank : (existingRow ? existingRow[16] : '');
  const awardVal = body.award_title !== undefined ? body.award_title : (existingRow ? existingRow[17] : '');
  const certVal = body.cert_code || (existingRow ? existingRow[18] : '') || ('WYK74-2569-' + regId.replace(/\D/g, '').slice(-4).padStart(4, '0'));

  const rowValues = [
    regId,
    "'" + timestamp,
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
    scoreVal,
    medalVal,
    rankVal,
    awardVal,
    certVal,
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

function handleSaveScores_(ss, body) {
  const compId = String(body.comp_id || '').trim();
  const entries = Array.isArray(body.scores) ? body.scores : (Array.isArray(body.entries) ? body.entries : []);
  let resultStatus = String(body.result_status || 'ประกาศผลแล้ว');
  const hasAnyEvaluatedEntry = entries.some(function(item) {
    if (!item) return false;
    const hasScore = item.score !== '' && item.score !== null && item.score !== undefined;
    const hasMedal = String(item.medal || '').trim() !== '';
    const hasAward = String(item.award_title || '').trim() !== '';
    return hasScore || hasMedal || hasAward;
  });
  if (entries.length > 0 && !hasAnyEvaluatedEntry) {
    resultStatus = 'รอประกาศผล';
  }

  const regSheet = ss.getSheetByName('Registrations');
  const regData = regSheet.getDataRange().getValues();
  const entryMap = {};
  entries.forEach(function(item) {
    if (item && item.reg_id) entryMap[String(item.reg_id)] = item;
  });

  let updatedCount = 0;
  for (let i = 1; i < regData.length; i++) {
    const rId = String(regData[i][0] || '');
    if (entryMap[rId]) {
      const item = entryMap[rId];
      const rowNum = i + 1;
      const certCode = item.cert_code || String(regData[i][18] || '') || ('WYK74-2569-' + String(rowNum - 1).padStart(4, '0'));
      regSheet.getRange(rowNum, 15, 1, 5).setValues([[
        item.score !== '' && item.score !== null && item.score !== undefined ? Number(item.score) : '',
        String(item.medal || ''),
        item.rank !== '' && item.rank !== null && item.rank !== undefined ? Number(item.rank) : '',
        String(item.award_title || ''),
        certCode
      ]]);
      updatedCount++;
    }
  }

  if (compId) {
    const compSheet = ss.getSheetByName('Competitions');
    const compData = compSheet.getDataRange().getValues();
    for (let j = 1; j < compData.length; j++) {
      if (String(compData[j][0] || '').trim() === compId) {
        compSheet.getRange(j + 1, 16).setValue(resultStatus);
        break;
      }
    }
  }

  return jsonResponse_({ ok: true, updatedCount: updatedCount, result_status: resultStatus });
}

function handleUpdateSchedule_(ss, body) {
  const compId = String(body.comp_id || '').trim();
  if (!compId) return jsonResponse_({ ok: false, error: 'กรุณาระบุรหัสรายการแข่งขัน' });

  const compSheet = ss.getSheetByName('Competitions');
  const compData = compSheet.getDataRange().getValues();
  for (let i = 1; i < compData.length; i++) {
    if (String(compData[i][0] || '').trim() === compId) {
      const rowNum = i + 1;
      compSheet.getRange(rowNum, 12, 1, 5).setValues([[
        String(body.comp_date || compData[i][11] || '30 พฤศจิกายน 2569'),
        String(body.comp_time || compData[i][12] || '09.00 - 12.00 น.'),
        String(body.venue_building || compData[i][13] || 'สนามแข่งขันกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง'),
        String(body.venue_room || compData[i][14] || 'อาคารเรียนรวม ห้อง 101'),
        String(body.result_status || compData[i][15] || 'รอประกาศผล')
      ]]);
      return jsonResponse_({ ok: true, comp_id: compId });
    }
  }
  return jsonResponse_({ ok: false, error: 'ไม่พบรหัสรายการแข่งขันที่ระบุ' });
}

function handleUpdateScheduleBatch_(ss, body) {
  const schedules = Array.isArray(body.schedules) ? body.schedules : [];
  if (schedules.length === 0) {
    return jsonResponse_({ ok: true, updatedCount: 0 });
  }

  const compSheet = ss.getSheetByName('Competitions');
  if (!compSheet) {
    return jsonResponse_({ ok: false, error: 'ไม่พบแผ่นงาน Competitions' });
  }

  const compData = compSheet.getDataRange().getValues();
  const rowIndexMap = {};
  for (let i = 1; i < compData.length; i++) {
    const cid = String(compData[i][0] || '').trim();
    if (cid) rowIndexMap[cid] = i;
  }

  let updatedCount = 0;
  schedules.forEach(function (item) {
    if (!item || !item.comp_id) return;
    const cid = String(item.comp_id).trim();
    const idx = rowIndexMap[cid];
    if (idx === undefined) return;
    const rowNum = idx + 1;
    const existingRow = compData[idx];
    compSheet.getRange(rowNum, 12, 1, 4).setValues([[
      String(item.comp_date || existingRow[11] || '24–25 พฤศจิกายน 2569'),
      String(item.comp_time || existingRow[12] || '09.00 - 12.00 น.'),
      String(item.venue_building || existingRow[13] || 'โรงเรียนบ้านวังยาววิทยายน'),
      String(item.venue_room || existingRow[14] || 'อาคารเรียนรวม ห้อง 101')
    ]]);
    updatedCount++;
  });

  return jsonResponse_({ ok: true, updatedCount: updatedCount });
}

function handleAddJudge_(ss, judge) {
  if (!judge || !judge.comp_id || !judge.full_name) {
    return jsonResponse_({ ok: false, error: 'กรุณาระบุรายการแข่งขันและชื่อ-นามสกุลกรรมการ' });
  }
  let sheet = ss.getSheetByName('Judges');
  if (!sheet) {
    sheet = ss.insertSheet('Judges');
    sheet.appendRow([
      'รหัสกรรมการ (judge_id)', 'รหัสรายการ (comp_id)', 'หมวดกิจกรรม (learning_area)',
      'ชื่อรายการแข่งขัน (comp_name)', 'ระดับช่วงชั้น (level)', 'คำนำหน้า (prefix)',
      'ชื่อ-นามสกุล (full_name)', 'โรงเรียนต้นสังกัด (school_name)', 'ตำแหน่งกรรมการ (role)', 'เลขที่เกียรติบัตร (cert_code)'
    ]);
  }
  const judgeId = judge.judge_id || ('JDG-74-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'MMddHHmmss'));
  const certCode = judge.cert_code || ('WYK74-JDG-' + String(sheet.getLastRow()).padStart(4, '0'));
  sheet.appendRow([
    judgeId,
    String(judge.comp_id || ''),
    String(judge.learning_area || ''),
    String(judge.comp_name || ''),
    String(judge.level || ''),
    String(judge.prefix || ''),
    String(judge.full_name || ''),
    String(judge.school_name || ''),
    String(judge.role || 'กรรมการ'),
    certCode
  ]);
  return jsonResponse_({ ok: true, judge_id: judgeId, cert_code: certCode });
}

function handleDeleteJudge_(ss, judgeId) {
  const sheet = ss.getSheetByName('Judges');
  if (!sheet) return jsonResponse_({ ok: false, error: 'ไม่พบแผ่นงาน Judges' });
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0] || '') === String(judgeId || '')) {
      sheet.deleteRow(i + 1);
      return jsonResponse_({ ok: true, deleted_judge_id: judgeId });
    }
  }
  return jsonResponse_({ ok: false, error: 'ไม่พบรหัสกรรมการที่ต้องการลบ' });
}

function appendDeletionLog_(ss, rowData, meta) {
  if (!ss || !rowData) return null;
  let sheet = ss.getSheetByName('Deletion_Logs');
  if (!sheet) {
    sheet = ss.insertSheet('Deletion_Logs');
    sheet.appendRow([
      'รหัสบันทึก (log_id)',
      'วันเวลาที่ลบ (deleted_at)',
      'ผู้ลบ (deleted_by)',
      'รหัสใบสมัครเดิม (reg_id)',
      'โรงเรียน (school_name)',
      'รหัสรายการ (comp_id)',
      'ชื่อรายการแข่งขัน (comp_name)',
      'ระดับชั้น (level)',
      'รายชื่อนักเรียนเดิม (students_text)',
      'รายชื่อครูเดิม (teachers_text)',
      'เบอร์อ้างอิง (phone_masked)',
      'เหตุผล (reason)'
    ]);
  }
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const logId = 'DEL-74-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'MMddHHmmss');
  const phoneMasked = maskPhone_(rowData[12]);
  const deletedBy = (meta && meta.deletedBy) || 'แอดมิน';
  const reason = String((meta && meta.reason) || '-').trim() || '-';
  const entry = {
    log_id: logId,
    deleted_at: nowStr,
    deleted_by: deletedBy,
    reg_id: String(rowData[0] || ''),
    school_name: String(rowData[2] || ''),
    comp_id: String(rowData[3] || ''),
    comp_name: String(rowData[5] || ''),
    level: String(rowData[6] || ''),
    students_text: String(rowData[9] || ''),
    teachers_text: String(rowData[11] || ''),
    phone_masked: phoneMasked,
    reason: reason
  };
  sheet.appendRow([
    entry.log_id,
    "'" + entry.deleted_at,
    entry.deleted_by,
    entry.reg_id,
    entry.school_name,
    entry.comp_id,
    entry.comp_name,
    entry.level,
    entry.students_text,
    entry.teachers_text,
    entry.phone_masked,
    entry.reason
  ]);
  return entry;
}

function readDeletionLogs_(ss) {
  const sheet = ss.getSheetByName('Deletion_Logs');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const list = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    if (!rows[i][0]) continue;
    list.push({
      log_id: String(rows[i][0] || ''),
      deleted_at: String(rows[i][1] || '').replace(/^'/, ''),
      deleted_by: String(rows[i][2] || ''),
      reg_id: String(rows[i][3] || ''),
      school_name: String(rows[i][4] || ''),
      comp_id: String(rows[i][5] || ''),
      comp_name: String(rows[i][6] || ''),
      level: String(rows[i][7] || ''),
      students_text: String(rows[i][8] || ''),
      teachers_text: String(rows[i][9] || ''),
      phone_masked: String(rows[i][10] || '-'),
      reason: String(rows[i][11] || '-')
    });
  }
  return list;
}

function handleDeleteRegistration_(ss, body, isAdmin) {
  const regId = typeof body === 'string' ? body : (body && body.reg_id);
  const regSheet = ss.getSheetByName('Registrations');
  if (!regSheet) {
    return jsonResponse_({ ok: false, error: 'ไม่พบแผ่นงาน Registrations' });
  }
  const data = regSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0] || '') === String(regId || '')) {
      const rowData = data[i];
      const existingPhone = String(rowData[12] || '');
      const existingStatus = String(rowData[13] || '');
      const existingScore = rowData[14];
      const isSampleRow = existingStatus.indexOf('ตัวอย่าง') !== -1;

      if (!isAdmin) {
        if (!isRegistrationOpen_()) {
          return jsonResponse_({
            ok: false,
            error: 'ขณะนี้ระบบปิดรับสมัครแล้ว ไม่สามารถลบข้อมูลเองได้ กรุณาติดต่อแอดมินกลุ่มโรงเรียน'
          });
        }
        if (existingScore !== '' && existingScore !== null && existingScore !== undefined) {
          return jsonResponse_({
            ok: false,
            error: 'รายการนี้มีการบันทึกคะแนนแล้ว ไม่สามารถลบเองได้'
          });
        }
        if (!isSampleRow) {
          const verifyToken = (body && (body.verify_token || body.coordinator_phone)) || '';
          if (!verifyFullPhoneMatch_(existingPhone, verifyToken)) {
            return jsonResponse_({
              ok: false,
              code: 'DELETE_VERIFY_FAILED',
              error: 'เบอร์โทรศัพท์ผู้ประสานงานไม่ตรงกับที่ใช้ลงทะเบียนไว้ (กรุณากรอกเบอร์เต็มทุกหลัก)'
            });
          }
        }
      }

      const logEntry = appendDeletionLog_(ss, rowData, {
        deletedBy: isAdmin ? 'แอดมิน' : 'ผู้สมัคร (ยืนยันเบอร์โทร)',
        reason: (body && body.reason) || (isAdmin ? 'ลบโดยแอดมิน' : '-')
      });
      regSheet.deleteRow(i + 1);
      return jsonResponse_({ ok: true, deleted_reg_id: regId, log: logEntry });
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
  const judgeSheet = ss.getSheetByName('Judges');
  if (judgeSheet) {
    const jData = judgeSheet.getDataRange().getValues();
    for (let j = jData.length - 1; j >= 1; j--) {
      if (String(jData[j][6] || '').indexOf('ตัวอย่าง') !== -1) {
        judgeSheet.deleteRow(j + 1);
      }
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
    '=COUNTIF(Registrations!$D$2:$D$1000, A' + nextRow + ')',
    String(comp.comp_date || '30 พฤศจิกายน 2569'),
    String(comp.comp_time || '09.00 - 12.00 น.'),
    String(comp.venue_building || 'สนามแข่งขันกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง'),
    String(comp.venue_room || 'อาคารเรียนรวม ห้อง 101'),
    String(comp.result_status || 'รอประกาศผล')
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
    '=SUMIF(Registrations!$C$2:$C$1000, B' + nextRow + ', Registrations!$K$2:$K$1000)',
    '=COUNTIFS(Registrations!$C$2:$C$1000, B' + nextRow + ', Registrations!$P$2:$P$1000, "เหรียญทอง")',
    '=COUNTIFS(Registrations!$C$2:$C$1000, B' + nextRow + ', Registrations!$P$2:$P$1000, "เหรียญเงิน")',
    '=COUNTIFS(Registrations!$C$2:$C$1000, B' + nextRow + ', Registrations!$P$2:$P$1000, "เหรียญทองแดง")',
    '=COUNTIFS(Registrations!$C$2:$C$1000, B' + nextRow + ', Registrations!$Q$2:$Q$1000, 1)'
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
    const schoolId = String(rows[i][0] || '');
    const schoolName = String(rows[i][1] || '');
    let subdistrict = String(rows[i][2] || '');
    if ((schoolId === 'SCH-13' || schoolName === 'โรงเรียนหินแห่เสริมศิลป์') && subdistrict !== 'ต.วังยาว') {
      subdistrict = 'ต.วังยาว';
      try {
        sheet.getRange(i + 1, 3).setValue('ต.วังยาว');
      } catch (e) {}
    }
    result.push({
      school_id: schoolId,
      school_name: schoolName,
      subdistrict: subdistrict,
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
      status: String(rows[i][9] || 'เปิดรับสมัคร'),
      comp_date: String(rows[i][11] || '30 พฤศจิกายน 2569'),
      comp_time: String(rows[i][12] || '09.00 - 12.00 น.'),
      venue_building: String(rows[i][13] || 'สนามแข่งขันกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง'),
      venue_room: String(rows[i][14] || 'อาคารเรียนรวม ห้อง 101'),
      result_status: String(rows[i][15] || 'รอประกาศผล')
    });
  }
  return result;
}

function parsePersonList_(rawText, hasGrade) {
  if (!rawText) return [];
  const lines = String(rawText).split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
  const prefixes = ['นางสาว', 'ด.ช.', 'ด.ญ.', 'เด็กชาย', 'เด็กหญิง', 'นาย', 'นาง', 'ครู', 'ว่าที่ ร.ต.'];
  return lines.map(function(line) {
    let cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
    let grade = '';
    if (hasGrade) {
      const m = cleaned.match(/\(([^()]+)\)\s*$/);
      if (m) {
        grade = m[1].trim();
        cleaned = cleaned.slice(0, m.index).trim();
      }
    }
    let foundPrefix = '';
    for (let i = 0; i < prefixes.length; i++) {
      if (cleaned.indexOf(prefixes[i]) === 0) {
        foundPrefix = prefixes[i];
        cleaned = cleaned.slice(prefixes[i].length).trim();
        break;
      }
    }
    return hasGrade
      ? { prefix: foundPrefix, name: cleaned, grade: grade }
      : { prefix: foundPrefix, name: cleaned };
  });
}

function readRegistrations_(ss) {
  const sheet = ss.getSheetByName('Registrations');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] || !rows[i][2]) continue;
    let parsed = null;
    try {
      const rawCol = rows[i][19] || '';
      if (rawCol && String(rawCol).trim().indexOf('{') === 0) {
        parsed = JSON.parse(String(rawCol));
      }
    } catch (e) {}

    const students = (parsed && Array.isArray(parsed.students) && parsed.students.length)
      ? parsed.students
      : parsePersonList_(rows[i][9], true);
    const teachers = (parsed && Array.isArray(parsed.teachers) && parsed.teachers.length)
      ? parsed.teachers
      : parsePersonList_(rows[i][11], false);

    let tsVal = rows[i][1];
    let tsFormatted = '';
    if (tsVal instanceof Date) {
      try {
        const ssTz = ss.getSpreadsheetTimeZone();
        if (ssTz === 'Asia/Bangkok') {
          tsFormatted = Utilities.formatDate(tsVal, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
        } else {
          tsFormatted = Utilities.formatDate(tsVal, 'UTC', 'yyyy-MM-dd HH:mm:ss');
        }
      } catch (errTz) {
        tsFormatted = Utilities.formatDate(tsVal, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
      }
    } else {
      tsFormatted = String(tsVal || '').trim();
      if (/GMT\+07/i.test(tsFormatted)) {
        try {
          const cleanTs = tsFormatted.replace(/\s*\([^)]*\)/g, '');
          const d = new Date(cleanTs);
          if (!isNaN(d.getTime())) {
            tsFormatted = Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd HH:mm:ss');
          }
        } catch (e) {}
      }
    }

    result.push({
      reg_id: String(rows[i][0] || ''),
      timestamp: tsFormatted,
      school_name: String(rows[i][2] || ''),
      comp_id: String(rows[i][3] || ''),
      learning_area: String(rows[i][4] || ''),
      comp_name: String(rows[i][5] || ''),
      level: String(rows[i][6] || ''),
      team_type: String(rows[i][7] || ''),
      students: students,
      teachers: teachers,
      coordinator_phone: String(rows[i][12] || ''),
      status: String(rows[i][13] || 'ลงทะเบียนแล้ว'),
      score: rows[i][14] !== '' && rows[i][14] !== null && rows[i][14] !== undefined ? Number(rows[i][14]) : null,
      medal: String(rows[i][15] || ''),
      rank: rows[i][16] !== '' && rows[i][16] !== null && rows[i][16] !== undefined ? Number(rows[i][16]) : null,
      award_title: String(rows[i][17] || ''),
      cert_code: String(rows[i][18] || '')
    });
  }
  return result;
}

function readJudges_(ss) {
  const sheet = ss.getSheetByName('Judges');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] || !rows[i][6]) continue;
    result.push({
      judge_id: String(rows[i][0] || ''),
      comp_id: String(rows[i][1] || ''),
      learning_area: String(rows[i][2] || ''),
      comp_name: String(rows[i][3] || ''),
      level: String(rows[i][4] || ''),
      prefix: String(rows[i][5] || ''),
      full_name: String(rows[i][6] || ''),
      school_name: String(rows[i][7] || ''),
      role: String(rows[i][8] || 'กรรมการ'),
      cert_code: String(rows[i][9] || '')
    });
  }
  return result;
}

/**
 * ฟังก์ชันปรับปรุงเวลาใน Google Sheets คอลัมน์ B (Timestamp) ให้เป็นเวลาจริงของกรุงเทพฯ (UTC+7)
 * กฎเหล็ก: แตะต้องเฉพาะคอลัมน์ B เท่านั้น ห้ามแตะต้องหรือแก้ไขข้อมูลอื่นใดทั้งสิ้น
 */
function handleFixTimestamps_(ss) {
  try {
    ss.setSpreadsheetTimeZone('Asia/Bangkok');
  } catch (e) {}

  const regSheet = ss.getSheetByName('Registrations');
  if (!regSheet) {
    return jsonResponse_({ ok: false, error: 'ไม่พบแผ่นงาน Registrations' });
  }

  const numRows = regSheet.getLastRow();
  if (numRows <= 1) {
    return jsonResponse_({ ok: true, updatedCount: 0, message: 'ไม่มีข้อมูลลงทะเบียน' });
  }

  // อ่านเฉพาะคอลัมน์ B (Timestamp) เท่านั้น ปลอดภัย 100% ต่อข้อมูลในคอลัมน์อื่น
  const tsRange = regSheet.getRange(2, 2, numRows - 1, 1);
  const rawValues = tsRange.getValues();
  let updatedCount = 0;

  for (let i = 0; i < rawValues.length; i++) {
    const val = rawValues[i][0];
    if (!val) continue;

    let cleanTime = '';
    if (val instanceof Date) {
      // เซลล์ที่ถูกเก็บใน UTC sheet ค่า UTC คือเวลาจริงของกรุงเทพฯ
      cleanTime = Utilities.formatDate(val, 'UTC', 'yyyy-MM-dd HH:mm:ss');
    } else {
      const str = String(val).trim();
      if (/GMT\+07/i.test(str)) {
        try {
          const cleanStr = str.replace(/\s*\([^)]*\)/g, '');
          const d = new Date(cleanStr);
          if (!isNaN(d.getTime())) {
            cleanTime = Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd HH:mm:ss');
          }
        } catch (e) {}
      } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
        cleanTime = str;
      }
    }

    if (cleanTime) {
      rawValues[i][0] = "'" + cleanTime;
      updatedCount++;
    }
  }

  tsRange.setValues(rawValues);

  return jsonResponse_({
    ok: true,
    updatedCount: updatedCount,
    message: 'ปรับปรุงเวลาใน Google Sheets เป็นเวลาจริงของกรุงเทพฯ สำเร็จ ' + updatedCount + ' รายการ'
  });
}

/**
 * บันทึกกำหนดการดำเนินงาน (Timeline Roadmap) ของแอดมินไว้ใน ScriptProperties (ไม่แตะข้อมูลในชีต)
 */
function handleSaveTimelineConfig_(body) {
  const props = PropertiesService.getScriptProperties();
  if (body.reset === true || body.timeline === null) {
    props.deleteProperty('OPERATION_TIMELINE_JSON');
    return jsonResponse_({ ok: true, operationTimeline: null });
  }
  const items = Array.isArray(body.timeline) ? body.timeline : [];
  if (!items.length) {
    return jsonResponse_({ ok: false, error: 'กรุณาระบุขั้นตอนกำหนดการอย่างน้อย 1 ขั้นตอน' });
  }
  const cleanList = items.map(function(it, idx) {
    return {
      step: String(idx + 1),
      title: String((it && it.title) || '').trim(),
      period: String((it && it.period) || '').trim(),
      startDate: String((it && it.startDate) || '').trim(),
      endDate: String((it && it.endDate) || '').trim(),
      useRegCloseTime: Boolean(it && it.useRegCloseTime)
    };
  }).filter(function(it) {
    return Boolean(it.title);
  });
  if (!cleanList.length) {
    return jsonResponse_({ ok: false, error: 'กรุณาระบุชื่อขั้นตอนอย่างน้อย 1 รายการ' });
  }
  props.setProperty('OPERATION_TIMELINE_JSON', JSON.stringify(cleanList));
  return jsonResponse_({ ok: true, operationTimeline: cleanList });
}

/**
 * อ่านค่าตั้งค่าการแสดงผลแท็บ/ฟีเจอร์ (เก็บเฉพาะใน ScriptProperties ไม่แตะชีตข้อมูล)
 */
function getStoredFeatureVisibility_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('FEATURE_VISIBILITY_JSON');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

/**
 * บันทึกสถานะการแสดงผลแท็บ/ฟีเจอร์ของแอดมินไว้ใน ScriptProperties (ไม่แตะข้อมูลในชีต)
 */
function handleSaveFeatureVisibility_(body) {
  const allowedKeys = [
    'schedule',
    'venue',
    'judges',
    'judge_certs',
    'results',
    'certificates',
    'id_cards',
    'substitution_form'
  ];
  const allowedVals = ['open', 'auto', 'hidden', 'disabled'];
  const incoming =
    body && body.featureVisibility && typeof body.featureVisibility === 'object'
      ? body.featureVisibility
      : {};
  const existing = getStoredFeatureVisibility_() || {};
  const cleanMap = Object.assign({}, existing);
  allowedKeys.forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(incoming, k)) {
      const val = String(incoming[k] || '').trim();
      if (allowedVals.indexOf(val) !== -1) {
        cleanMap[k] = val;
      }
    }
  });
  PropertiesService.getScriptProperties().setProperty(
    'FEATURE_VISIBILITY_JSON',
    JSON.stringify(cleanMap)
  );
  return jsonResponse_({ ok: true, featureVisibility: cleanMap });
}

/**
 * อ่านค่าตั้งค่ารูปแบบเลขและข้อมูลเกียรติบัตร (เก็บเฉพาะใน ScriptProperties)
 */
function getStoredCertConfig_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('CERT_CONFIG_JSON');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

/**
 * บันทึกค่าตั้งค่ารูปแบบเลขและข้อความเกียรติบัตรไว้ใน ScriptProperties (ไม่แตะข้อมูลในชีต)
 */
function handleSaveCertConfig_(body) {
  const incoming =
    body && body.certConfig && typeof body.certConfig === 'object' ? body.certConfig : {};
  const existing = getStoredCertConfig_() || {};
  const cleanRoleCode = function (rawVal, fallback) {
    const cleaned = String(rawVal === undefined || rawVal === null ? '' : rawVal)
      .replace(/[\s#?/&]+/g, '')
      .trim()
      .slice(0, 12);
    return cleaned || fallback;
  };
  const modeRaw = String(incoming.certNumberMode || existing.certNumberMode || 'team_fixed').trim();
  const numModeRaw = String(incoming.certNumeralMode || existing.certNumeralMode || 'both').trim();

  const cleanCfg = {
    certPrefix: String(incoming.certPrefix !== undefined ? incoming.certPrefix : (existing.certPrefix || 'WYK74-2569-'))
      .trim()
      .slice(0, 40) || 'WYK74-2569-',
    certNumberMode: modeRaw === 'sequential' ? 'sequential' : 'team_fixed',
    certRoleCodeStudent: cleanRoleCode(
      incoming.certRoleCodeStudent !== undefined ? incoming.certRoleCodeStudent : existing.certRoleCodeStudent,
      'น'
    ),
    certRoleCodeTeacher: cleanRoleCode(
      incoming.certRoleCodeTeacher !== undefined ? incoming.certRoleCodeTeacher : existing.certRoleCodeTeacher,
      'ค'
    ),
    certRoleCodeJudge: cleanRoleCode(
      incoming.certRoleCodeJudge !== undefined ? incoming.certRoleCodeJudge : existing.certRoleCodeJudge,
      'ก'
    ),
    certFormatLocked: Boolean(
      incoming.certFormatLocked !== undefined ? incoming.certFormatLocked : existing.certFormatLocked
    ),
    certIssueDate: String(
      incoming.certIssueDate !== undefined ? incoming.certIssueDate : (existing.certIssueDate || '')
    )
      .trim()
      .slice(0, 160),
    certSignerName: String(
      incoming.certSignerName !== undefined ? incoming.certSignerName : (existing.certSignerName || '')
    )
      .trim()
      .slice(0, 160),
    certSignerPos: String(
      incoming.certSignerPos !== undefined ? incoming.certSignerPos : (existing.certSignerPos || '')
    )
      .trim()
      .slice(0, 160),
    certSignerOrg: String(
      incoming.certSignerOrg !== undefined ? incoming.certSignerOrg : (existing.certSignerOrg || '')
    )
      .trim()
      .slice(0, 160),
    certNumeralMode: ['thai', 'arabic', 'both'].indexOf(numModeRaw) !== -1 ? numModeRaw : 'both'
  };
  PropertiesService.getScriptProperties().setProperty(
    'CERT_CONFIG_JSON',
    JSON.stringify(cleanCfg)
  );
  return jsonResponse_({ ok: true, certConfig: cleanCfg });
}
