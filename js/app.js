(function () {
  'use strict';

  const STORAGE_KEY = 'talent69_wangyao_state_v2';
  const GAS_URL_KEY = 'talent69_wangyao_gas_url_v1';

  const DEFAULT_DATA = window.TALENT69_DEFAULT_DATA || {
    eventInfo: {},
    schools: [],
    competitions: [],
    sampleRegistrations: []
  };

  let state = {
    schools: [],
    competitions: [],
    registrations: [],
    activeTab: 'dashboard',
    compStatusFilter: 'ALL',
    lastAddedRegId: null,
    gasWebAppUrl: ''
  };

  // Safe HTML Escaping to prevent XSS
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function formatNowTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds())
    );
  }

  function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const bgClass =
      type === 'error'
        ? 'bg-rose-600 text-white border-rose-700'
        : type === 'warning'
        ? 'bg-amber-500 text-white border-amber-600'
        : 'bg-emerald-600 text-white border-emerald-700';

    const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';

    const toast = document.createElement('div');
    toast.className =
      'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-heading font-medium transition duration-300 ' +
      bgClass;
    toast.innerHTML = '<span>' + icon + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3600);
  }

  // Load state from localStorage or initialize from mock-data.js
  function loadState() {
    state.gasWebAppUrl = localStorage.getItem(GAS_URL_KEY) || '';
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        state.schools = Array.isArray(parsed.schools) && parsed.schools.length
          ? parsed.schools
          : cloneDeep(DEFAULT_DATA.schools);
        state.competitions = Array.isArray(parsed.competitions) && parsed.competitions.length
          ? parsed.competitions
          : cloneDeep(DEFAULT_DATA.competitions);
        state.registrations = Array.isArray(parsed.registrations)
          ? parsed.registrations
          : cloneDeep(DEFAULT_DATA.sampleRegistrations);
        return;
      } catch (e) {
        // Fallback to default data
      }
    }
    state.schools = cloneDeep(DEFAULT_DATA.schools);
    state.competitions = cloneDeep(DEFAULT_DATA.competitions);
    state.registrations = cloneDeep(DEFAULT_DATA.sampleRegistrations);
    saveState();
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schools: state.schools,
        competitions: state.competitions,
        registrations: state.registrations
      })
    );
  }

  function updateSyncBadge() {
    const textEl = document.getElementById('syncModeText');
    const urlInput = document.getElementById('gasWebAppUrlInput');
    if (urlInput) urlInput.value = state.gasWebAppUrl;
    if (!textEl) return;
    if (state.gasWebAppUrl) {
      textEl.textContent = 'เชื่อมต่อ Google Sheets ออนไลน์แล้ว';
    } else {
      textEl.textContent = 'โหมดบันทึกในเครื่อง + ตาราง Google Sheets';
    }
  }

  // Optional sync with Google Apps Script Web App API
  async function syncFromGoogleSheets(showNotification) {
    if (!state.gasWebAppUrl) {
      renderAll();
      if (showNotification) {
        showToast('รีเฟรชข้อมูลล่าสุดเรียบร้อยแล้ว', 'success');
      }
      return;
    }

    try {
      const res = await fetch(state.gasWebAppUrl, { method: 'GET' });
      const data = await res.json();
      if (data && data.ok) {
        if (Array.isArray(data.schools) && data.schools.length) state.schools = data.schools;
        if (Array.isArray(data.competitions) && data.competitions.length) state.competitions = data.competitions;
        if (Array.isArray(data.registrations)) state.registrations = data.registrations;
        saveState();
        populateStaticSelects();
        renderAll();
        if (showNotification) {
          showToast('ซิงก์ข้อมูลจาก Google Sheets สำเร็จ', 'success');
        }
      } else {
        throw new Error((data && data.error) || 'ไม่สามารถดึงข้อมูลจาก Apps Script ได้');
      }
    } catch (err) {
      if (showNotification) {
        showToast('ไม่สามารถดึงข้อมูลจาก Apps Script: ' + err.message, 'warning');
      }
    }
  }

  async function postToGoogleSheets(payload) {
    if (!state.gasWebAppUrl) return { ok: true, localOnly: true };
    try {
      const res = await fetch(state.gasWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Navigation Tabs
  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-tab-btn').forEach(function (btn) {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      if (panel.id === 'tab-' + tabName) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Helper: Get distinct learning areas and levels
  function getLearningAreas() {
    const set = new Set();
    state.competitions.forEach(function (c) {
      if (c.learning_area) set.add(c.learning_area);
    });
    return Array.from(set);
  }

  function getLevels() {
    const order = [
      'ปฐมวัย',
      'ป.1–ป.3',
      'ป.4–ป.6',
      'ป.1–ป.6',
      'ป.1–ม.3',
      'ป.1–ม.3 (ขยายโอกาส)',
      'ม.1–ม.3'
    ];
    const set = new Set();
    state.competitions.forEach(function (c) {
      if (c.level) set.add(c.level);
    });
    return Array.from(set).sort(function (a, b) {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'th');
    });
  }

  function getGradeOptionsForLevel(level) {
    if (!level) return ['อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3'];
    if (level.indexOf('ปฐมวัย') !== -1 || level.indexOf('อนุบาล') !== -1) {
      return ['อ.1', 'อ.2', 'อ.3'];
    }
    if (level === 'ป.1–ป.3') return ['ป.1', 'ป.2', 'ป.3'];
    if (level === 'ป.4–ป.6') return ['ป.4', 'ป.5', 'ป.6'];
    if (level === 'ป.1–ป.6') return ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'];
    if (level.indexOf('ป.1–ม.3') !== -1) return ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3'];
    if (level === 'ม.1–ม.3') return ['ม.1', 'ม.2', 'ม.3'];
    return ['อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3'];
  }

  function populateStaticSelects() {
    const regSchoolSelect = document.getElementById('regSchoolSelect');
    const schoolViewSelect = document.getElementById('schoolViewSelect');
    const prevRegSchool = regSchoolSelect ? regSchoolSelect.value : '';
    const prevViewSchool = schoolViewSelect ? schoolViewSelect.value : '';

    if (regSchoolSelect) {
      let html = '<option value="">-- กรุณาเลือกโรงเรียนในกลุ่มวังยาวเขวาไร่ดอนกลาง --</option>';
      state.schools.forEach(function (s) {
        html +=
          '<option value="' +
          escapeHtml(s.school_name) +
          '">' +
          escapeHtml(s.school_name) +
          ' (' +
          escapeHtml(s.subdistrict || '') +
          ')</option>';
      });
      regSchoolSelect.innerHTML = html;
      if (prevRegSchool) regSchoolSelect.value = prevRegSchool;
    }

    if (schoolViewSelect) {
      let html = '';
      state.schools.forEach(function (s) {
        html +=
          '<option value="' +
          escapeHtml(s.school_name) +
          '">' +
          escapeHtml(s.school_name) +
          ' (' +
          escapeHtml(s.subdistrict || '') +
          ')</option>';
      });
      schoolViewSelect.innerHTML = html;
      if (prevViewSchool && state.schools.some((s) => s.school_name === prevViewSchool)) {
        schoolViewSelect.value = prevViewSchool;
      } else if (state.schools.length > 0) {
        schoolViewSelect.value = state.schools[0].school_name;
      }
    }

    const areas = getLearningAreas();
    const levels = getLevels();

    ['regAreaFilter', 'compViewAreaFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const prev = el.value || 'ALL';
      let html = '<option value="ALL">-- ทุกกลุ่มสาระการเรียนรู้ (' + areas.length + ' กลุ่มสาระ) --</option>';
      areas.forEach(function (a) {
        html += '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + '</option>';
      });
      el.innerHTML = html;
      if (prev === 'ALL' || areas.indexOf(prev) !== -1) el.value = prev;
    });

    ['regLevelFilter', 'compViewLevelFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const prev = el.value || 'ALL';
      let html = '<option value="ALL">-- ทุกระดับช่วงชั้น --</option>';
      levels.forEach(function (l) {
        html += '<option value="' + escapeHtml(l) + '">' + escapeHtml(l) + '</option>';
      });
      el.innerHTML = html;
      if (prev === 'ALL' || levels.indexOf(prev) !== -1) el.value = prev;
    });

    const dataList = document.getElementById('learningAreaList');
    if (dataList) {
      dataList.innerHTML = areas
        .map(function (a) {
          return '<option value="' + escapeHtml(a) + '"></option>';
        })
        .join('');
    }

    populateRegCompetitionOptions();
  }

  function populateRegCompetitionOptions() {
    const select = document.getElementById('regCompSelect');
    const areaFilter = (document.getElementById('regAreaFilter') || {}).value || 'ALL';
    const levelFilter = (document.getElementById('regLevelFilter') || {}).value || 'ALL';
    const selectedSchool = (document.getElementById('regSchoolSelect') || {}).value || '';
    if (!select) return;

    const prevCompId = select.value;

    const filtered = state.competitions.filter(function (c) {
      if (areaFilter !== 'ALL' && c.learning_area !== areaFilter) return false;
      if (levelFilter !== 'ALL' && c.level !== levelFilter) return false;
      return true;
    });

    let html = '<option value="">-- เลือกรายการแข่งขัน (' + filtered.length + ' รายการ) --</option>';
    filtered.forEach(function (c) {
      const alreadyReg =
        selectedSchool &&
        state.registrations.some(function (r) {
          return r.school_name === selectedSchool && r.comp_id === c.comp_id;
        });

      const stuCountText =
        c.min_students === c.max_students
          ? c.max_students + ' คน'
          : c.min_students + '–' + c.max_students + ' คน';

      const statusSuffix = alreadyReg ? ' ✅ [โรงเรียนนี้ส่งแล้ว]' : '';

      html +=
        '<option value="' +
        escapeHtml(c.comp_id) +
        '">[' +
        escapeHtml(c.comp_id) +
        '] ' +
        escapeHtml(c.comp_name) +
        ' • ' +
        escapeHtml(c.level) +
        ' (' +
        escapeHtml(c.team_type) +
        ' ' +
        escapeHtml(stuCountText) +
        ')' +
        statusSuffix +
        '</option>';
    });

    select.innerHTML = html;
    if (prevCompId && filtered.some((c) => c.comp_id === prevCompId)) {
      select.value = prevCompId;
    }
  }

  // Build Student & Teacher dynamic input rows in Registration Form
  function createStudentRowElement(index, level, initialData, canRemove) {
    const grades = getGradeOptionsForLevel(level);
    const prefixVal = (initialData && initialData.prefix) || 'ด.ช.';
    const nameVal = (initialData && initialData.name) || '';
    const gradeVal = (initialData && initialData.grade) || grades[0] || '';

    const row = document.createElement('div');
    row.className = 'student-input-row grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200';

    let prefixOptions = '';
    ['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว'].forEach(function (p) {
      prefixOptions +=
        '<option value="' +
        escapeHtml(p) +
        '"' +
        (p === prefixVal ? ' selected' : '') +
        '>' +
        escapeHtml(p) +
        '</option>';
    });

    let gradeOptions = '';
    grades.forEach(function (g) {
      gradeOptions +=
        '<option value="' +
        escapeHtml(g) +
        '"' +
        (g === gradeVal ? ' selected' : '') +
        '>ชั้น ' +
        escapeHtml(g) +
        '</option>';
    });

    row.innerHTML =
      '<div class="col-span-12 sm:col-span-1 text-xs font-heading font-bold text-blue-700 text-center stu-index-badge">คนที่ ' +
      (index + 1) +
      '</div>' +
      '<div class="col-span-4 sm:col-span-2">' +
      '<select class="stu-prefix w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-slate-50">' +
      prefixOptions +
      '</select>' +
      '</div>' +
      '<div class="col-span-8 sm:col-span-6">' +
      '<input type="text" required placeholder="ชื่อ - นามสกุล นักเรียน" value="' +
      escapeHtml(nameVal) +
      '" class="stu-name w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none" />' +
      '</div>' +
      '<div class="col-span-9 sm:col-span-2">' +
      '<select class="stu-grade w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-slate-50">' +
      gradeOptions +
      '</select>' +
      '</div>' +
      '<div class="col-span-3 sm:col-span-1 text-right">' +
      (canRemove
        ? '<button type="button" class="btn-remove-stu px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-heading">ลบ</button>'
        : '<span class="text-xs text-slate-300">-</span>') +
      '</div>';

    const removeBtn = row.querySelector('.btn-remove-stu');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        row.remove();
        refreshStudentRowNumbers();
      });
    }
    return row;
  }

  function refreshStudentRowNumbers() {
    const container = document.getElementById('studentsInputContainer');
    const compId = (document.getElementById('regCompSelect') || {}).value;
    const comp = state.competitions.find((c) => c.comp_id === compId);
    const maxStu = comp ? Number(comp.max_students || 1) : 1;
    const minStu = comp ? Number(comp.min_students || 1) : 1;

    const rows = container.querySelectorAll('.student-input-row');
    rows.forEach(function (r, idx) {
      const badge = r.querySelector('.stu-index-badge');
      if (badge) badge.textContent = 'คนที่ ' + (idx + 1);
    });

    const addBtn = document.getElementById('btnAddStudentRow');
    if (addBtn) {
      if (comp && rows.length < maxStu && maxStu > minStu) {
        addBtn.classList.remove('hidden');
      } else {
        addBtn.classList.add('hidden');
      }
    }
  }

  function createTeacherRowElement(index, initialData, canRemove) {
    const prefixVal = (initialData && initialData.prefix) || 'นางสาว';
    const nameVal = (initialData && initialData.name) || '';

    const row = document.createElement('div');
    row.className = 'teacher-input-row grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200';

    let prefixOptions = '';
    ['นาย', 'นาง', 'นางสาว', 'ว่าที่ ร.ต.', 'ดร.'].forEach(function (p) {
      prefixOptions +=
        '<option value="' +
        escapeHtml(p) +
        '"' +
        (p === prefixVal ? ' selected' : '') +
        '>' +
        escapeHtml(p) +
        '</option>';
    });

    row.innerHTML =
      '<div class="col-span-12 sm:col-span-1 text-xs font-heading font-bold text-indigo-700 text-center tch-index-badge">ครู ' +
      (index + 1) +
      '</div>' +
      '<div class="col-span-4 sm:col-span-3">' +
      '<select class="tch-prefix w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-slate-50">' +
      prefixOptions +
      '</select>' +
      '</div>' +
      '<div class="col-span-8 sm:col-span-7">' +
      '<input type="text" required placeholder="ชื่อ - นามสกุล ครูผู้ฝึกซ้อม" value="' +
      escapeHtml(nameVal) +
      '" class="tch-name w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none" />' +
      '</div>' +
      '<div class="col-span-12 sm:col-span-1 text-right">' +
      (canRemove
        ? '<button type="button" class="btn-remove-tch px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-heading">ลบ</button>'
        : '<span class="text-xs text-slate-300">-</span>') +
      '</div>';

    const removeBtn = row.querySelector('.btn-remove-tch');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        row.remove();
        refreshTeacherRowNumbers();
      });
    }
    return row;
  }

  function refreshTeacherRowNumbers() {
    const container = document.getElementById('teachersInputContainer');
    const rows = container.querySelectorAll('.teacher-input-row');
    rows.forEach(function (r, idx) {
      const badge = r.querySelector('.tch-index-badge');
      if (badge) badge.textContent = 'ครู ' + (idx + 1);
    });
  }

  // Handle Competition Change in Registration Form
  function onRegistrationSelectionChange(existingToLoad) {
    const schoolName = (document.getElementById('regSchoolSelect') || {}).value || '';
    const compId = (document.getElementById('regCompSelect') || {}).value || '';
    const comp = state.competitions.find((c) => c.comp_id === compId);

    const metaBox = document.getElementById('selectedCompMeta');
    const stuRuleLabel = document.getElementById('studentRuleLabel');
    const tchRuleLabel = document.getElementById('teacherRuleLabel');
    const stuContainer = document.getElementById('studentsInputContainer');
    const tchContainer = document.getElementById('teachersInputContainer');
    const dupBox = document.getElementById('duplicateWarningBox');
    const dupSummary = document.getElementById('duplicateExistingSummary');
    const editRegIdInput = document.getElementById('formEditRegId');
    const submitBtn = document.getElementById('btnSubmitRegistration');

    // Update live right-hand preview for selected school
    renderLiveSchoolPreview(schoolName);

    if (!comp) {
      if (metaBox) metaBox.classList.add('hidden');
      if (dupBox) dupBox.classList.add('hidden');
      if (stuRuleLabel) stuRuleLabel.textContent = '(กรุณาเลือกรายการแข่งขันก่อน)';
      if (tchRuleLabel) tchRuleLabel.textContent = '(ระบุได้ 1 หรือหลายคนตามเกณฑ์)';
      if (stuContainer) {
        stuContainer.innerHTML =
          '<div class="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl">กรุณาเลือกรายการแข่งขันในขั้นตอนที่ 2 เพื่อแสดงช่องกรอกรายชื่อนักเรียนตามประเภทเดี่ยว/ทีม</div>';
      }
      if (tchContainer && tchContainer.children.length === 0) {
        tchContainer.innerHTML = '';
        tchContainer.appendChild(createTeacherRowElement(0, null, false));
      }
      return;
    }

    // Show competition meta
    if (metaBox) {
      metaBox.classList.remove('hidden');
      const stuRange =
        comp.min_students === comp.max_students
          ? comp.max_students + ' คน'
          : comp.min_students + '–' + comp.max_students + ' คน';
      const tchRange =
        comp.min_teachers === comp.max_teachers
          ? comp.max_teachers + ' คน'
          : comp.min_teachers + '–' + comp.max_teachers + ' คน';

      document.getElementById('metaCompTitle').textContent =
        '[' + comp.comp_id + '] ' + comp.comp_name + ' (ระดับ ' + comp.level + ')';
      document.getElementById('metaCompDetails').textContent =
        'กลุ่มสาระฯ: ' +
        comp.learning_area +
        ' • นักเรียน: ' +
        stuRange +
        ' • ครูผู้ฝึกซ้อม: ' +
        tchRange;
      document.getElementById('metaCompBadge').textContent =
        'ประเภท' + comp.team_type + ' (' + stuRange + ')';
    }

    // Check if this school already registered for this competition
    const existingReg = state.registrations.find(function (r) {
      return r.school_name === schoolName && r.comp_id === compId;
    });

    if (existingReg && !existingToLoad) {
      if (dupBox) {
        dupBox.classList.remove('hidden');
        const stuNames = (existingReg.students || [])
          .map((s, i) => i + 1 + '. ' + s.prefix + s.name + ' (' + s.grade + ')')
          .join('  ');
        const tchNames = (existingReg.teachers || [])
          .map((t, i) => i + 1 + '. ' + t.prefix + t.name)
          .join('  ');
        dupSummary.textContent =
          'นักเรียนที่ส่งแล้ว: ' + stuNames + '\nครูผู้ฝึกซ้อม: ' + tchNames;
      }
    } else {
      if (dupBox) dupBox.classList.add('hidden');
    }

    const stuCountLabel =
      comp.min_students === comp.max_students
        ? 'ประเภท' + comp.team_type + ': กำหนดนักเรียน ' + comp.max_students + ' คน'
        : 'ประเภท' + comp.team_type + ': นักเรียน ' + comp.min_students + ' ถึง ' + comp.max_students + ' คน';
    if (stuRuleLabel) stuRuleLabel.textContent = '(' + stuCountLabel + ')';

    const tchCountLabel =
      comp.min_teachers === comp.max_teachers
        ? 'ครูผู้ฝึกซ้อม ' + comp.max_teachers + ' คน หรือเพิ่มได้'
        : 'ครูผู้ฝึกซ้อม ' + comp.min_teachers + '–' + comp.max_teachers + ' คน';
    if (tchRuleLabel) tchRuleLabel.textContent = '(' + tchCountLabel + ')';

    // Populate student rows
    stuContainer.innerHTML = '';
    if (existingToLoad && Array.isArray(existingToLoad.students)) {
      editRegIdInput.value = existingToLoad.reg_id;
      if (submitBtn) {
        submitBtn.innerHTML = '<span>💾 บันทึกการแก้ไขรายชื่อเดิม</span>';
      }
      existingToLoad.students.forEach(function (st, idx) {
        stuContainer.appendChild(
          createStudentRowElement(idx, comp.level, st, idx >= comp.min_students)
        );
      });
    } else {
      editRegIdInput.value = '';
      if (submitBtn) {
        submitBtn.innerHTML = '<span>💾 ยืนยันการลงทะเบียน</span>';
      }
      const initialCount = Number(comp.min_students || 1);
      for (let i = 0; i < initialCount; i++) {
        stuContainer.appendChild(createStudentRowElement(i, comp.level, null, false));
      }
    }
    refreshStudentRowNumbers();

    // Populate teacher rows
    tchContainer.innerHTML = '';
    if (existingToLoad && Array.isArray(existingToLoad.teachers) && existingToLoad.teachers.length) {
      existingToLoad.teachers.forEach(function (tc, idx) {
        tchContainer.appendChild(createTeacherRowElement(idx, tc, idx >= 1));
      });
    } else {
      const initialTchCount = Number(comp.min_teachers || 1);
      for (let j = 0; j < initialTchCount; j++) {
        tchContainer.appendChild(createTeacherRowElement(j, null, j >= 1));
      }
    }
    refreshTeacherRowNumbers();
  }

  function renderLiveSchoolPreview(schoolName) {
    const subtitle = document.getElementById('livePreviewSchoolSubtitle');
    const badge = document.getElementById('livePreviewCountBadge');
    const listEl = document.getElementById('liveSchoolRegistrationsList');
    if (!listEl) return;

    if (!schoolName) {
      if (subtitle) subtitle.textContent = 'เลือกโรงเรียนด้านซ้ายเพื่อดูรายการที่ส่งแล้วทันที';
      if (badge) badge.textContent = '0 รายการ';
      listEl.innerHTML =
        '<div class="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl">เมื่อเลือกโรงเรียนด้านซ้าย รายการที่โรงเรียนนั้นลงทะเบียนไว้จะแสดงที่นี่ทันที</div>';
      return;
    }

    const schoolRegs = state.registrations.filter((r) => r.school_name === schoolName);
    if (subtitle) subtitle.textContent = schoolName;
    if (badge) badge.textContent = schoolRegs.length + ' รายการ';

    if (schoolRegs.length === 0) {
      listEl.innerHTML =
        '<div class="text-xs text-slate-500 py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">' +
        escapeHtml(schoolName) +
        ' ยังไม่ได้ลงทะเบียนรายการแข่งขันใด</div>';
      return;
    }

    listEl.innerHTML = schoolRegs
      .slice()
      .reverse()
      .map(function (reg) {
        const isHighlighted = reg.reg_id === state.lastAddedRegId ? 'row-new-highlight border-blue-400' : 'border-slate-200';
        const stuHtml = (reg.students || [])
          .map((s, i) => i + 1 + '. ' + escapeHtml(s.prefix + s.name) + ' (' + escapeHtml(s.grade) + ')')
          .join('<br/>');
        const tchHtml = (reg.teachers || [])
          .map((t, i) => i + 1 + '. ' + escapeHtml(t.prefix + t.name))
          .join('<br/>');

        return (
          '<div class="p-3.5 rounded-xl bg-slate-50 border ' +
          isHighlighted +
          ' text-xs space-y-1.5">' +
          '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
          '<span class="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-heading font-semibold text-[11px] mr-1">' +
          escapeHtml(reg.learning_area) +
          '</span>' +
          '<span class="inline-block px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-heading text-[11px]">' +
          escapeHtml(reg.level) +
          '</span>' +
          '<div class="font-heading font-bold text-slate-900 text-sm mt-1">[' +
          escapeHtml(reg.comp_id) +
          '] ' +
          escapeHtml(reg.comp_name) +
          '</div>' +
          '</div>' +
          '<button type="button" data-edit-reg="' +
          escapeHtml(reg.reg_id) +
          '" class="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-blue-50 text-blue-700 font-heading font-medium shrink-0">✏️ แก้ไข</button>' +
          '</div>' +
          '<div class="text-slate-700 pt-1 border-t border-slate-200/70"><strong>นักเรียน (' +
          (reg.students || []).length +
          ' คน):</strong><br/>' +
          stuHtml +
          '</div>' +
          '<div class="text-slate-600"><strong>ครูผู้ฝึกซ้อม (' +
          (reg.teachers || []).length +
          ' คน):</strong><br/>' +
          tchHtml +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    listEl.querySelectorAll('[data-edit-reg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const regId = btn.getAttribute('data-edit-reg');
        loadRegistrationIntoForm(regId);
      });
    });
  }

  function loadRegistrationIntoForm(regId) {
    const reg = state.registrations.find((r) => r.reg_id === regId);
    if (!reg) return;

    switchTab('register');
    const schoolSelect = document.getElementById('regSchoolSelect');
    const areaFilter = document.getElementById('regAreaFilter');
    const levelFilter = document.getElementById('regLevelFilter');
    const compSelect = document.getElementById('regCompSelect');
    const phoneInput = document.getElementById('regCoordinatorPhone');

    if (schoolSelect) schoolSelect.value = reg.school_name;
    if (areaFilter) areaFilter.value = 'ALL';
    if (levelFilter) levelFilter.value = 'ALL';
    populateRegCompetitionOptions();
    if (compSelect) compSelect.value = reg.comp_id;
    if (phoneInput) phoneInput.value = reg.coordinator_phone || '';

    onRegistrationSelectionChange(reg);
    showToast('ดึงข้อมูลเดิมของ ' + reg.school_name + ' มาแก้ไขแล้ว', 'warning');
  }

  // Handle Form Submission
  async function handleRegistrationSubmit(e) {
    e.preventDefault();
    const schoolName = (document.getElementById('regSchoolSelect') || {}).value.trim();
    const compId = (document.getElementById('regCompSelect') || {}).value.trim();
    const coordinatorPhone = (document.getElementById('regCoordinatorPhone') || {}).value.trim();
    const editRegId = (document.getElementById('formEditRegId') || {}).value.trim();

    if (!schoolName) {
      showToast('กรุณาเลือกโรงเรียนที่ส่งเข้าแข่งขัน', 'error');
      return;
    }
    if (!compId) {
      showToast('กรุณาเลือกรายการแข่งขัน', 'error');
      return;
    }

    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) {
      showToast('ไม่พบข้อมูลรายการแข่งขันที่เลือก', 'error');
      return;
    }

    // Read students
    const stuRows = document.querySelectorAll('#studentsInputContainer .student-input-row');
    const students = [];
    for (let i = 0; i < stuRows.length; i++) {
      const prefix = stuRows[i].querySelector('.stu-prefix').value;
      const name = stuRows[i].querySelector('.stu-name').value.trim();
      const grade = stuRows[i].querySelector('.stu-grade').value;
      if (!name) {
        showToast('กรุณากรอกชื่อ-นามสกุลนักเรียนคนที่ ' + (i + 1) + ' ให้ครบถ้วน', 'error');
        stuRows[i].querySelector('.stu-name').focus();
        return;
      }
      students.push({ prefix: prefix, name: name, grade: grade });
    }

    // Read teachers
    const tchRows = document.querySelectorAll('#teachersInputContainer .teacher-input-row');
    const teachers = [];
    for (let j = 0; j < tchRows.length; j++) {
      const prefix = tchRows[j].querySelector('.tch-prefix').value;
      const name = tchRows[j].querySelector('.tch-name').value.trim();
      if (!name) {
        showToast('กรุณากรอกชื่อ-นามสกุลครูผู้ฝึกซ้อมคนที่ ' + (j + 1) + ' ให้ครบถ้วน', 'error');
        tchRows[j].querySelector('.tch-name').focus();
        return;
      }
      teachers.push({ prefix: prefix, name: name });
    }

    // Check 1 school = 1 team per competition rule
    const existingIndex = state.registrations.findIndex(function (r) {
      return r.school_name === schoolName && r.comp_id === compId;
    });

    if (existingIndex !== -1 && !editRegId) {
      const confirmOverwrite = window.confirm(
        'กติกากำหนดให้ 1 โรงเรียน ส่งได้ 1 ทีมต่อรายการแข่งขัน\n\n' +
          schoolName +
          ' ได้ลงทะเบียนรายการ "' +
          comp.comp_name +
          ' (' +
          comp.level +
          ')" ไปแล้ว\n\nคุณต้องการบันทึกทับรายชื่อเดิมของโรงเรียนในรายการนี้หรือไม่?'
      );
      if (!confirmOverwrite) return;
    }

    const regId =
      existingIndex !== -1
        ? state.registrations[existingIndex].reg_id
        : 'REG-74-' + String(Date.now()).slice(-6);

    const newRecord = {
      reg_id: regId,
      timestamp: formatNowTimestamp(),
      school_name: schoolName,
      comp_id: comp.comp_id,
      learning_area: comp.learning_area,
      comp_name: comp.comp_name,
      level: comp.level,
      team_type: comp.team_type,
      students: students,
      teachers: teachers,
      coordinator_phone: coordinatorPhone,
      status: 'ลงทะเบียนแล้ว'
    };

    if (existingIndex !== -1) {
      state.registrations[existingIndex] = newRecord;
    } else {
      state.registrations.push(newRecord);
    }

    state.lastAddedRegId = regId;
    saveState();

    // Sync to Google Sheets if Web App URL is set
    await postToGoogleSheets({
      action: 'register',
      allowOverwrite: true,
      reg_id: newRecord.reg_id,
      school_name: newRecord.school_name,
      comp_id: newRecord.comp_id,
      learning_area: newRecord.learning_area,
      comp_name: newRecord.comp_name,
      level: newRecord.level,
      team_type: newRecord.team_type,
      students: newRecord.students,
      teachers: newRecord.teachers,
      coordinator_phone: newRecord.coordinator_phone,
      status: newRecord.status
    });

    populateRegCompetitionOptions();
    document.getElementById('regCompSelect').value = '';
    document.getElementById('formEditRegId').value = '';
    onRegistrationSelectionChange();
    renderAll();

    showToast(
      (existingIndex !== -1 ? 'อัปเดตรายชื่อสำเร็จ: ' : 'ลงทะเบียนสำเร็จ: ') +
        schoolName +
        ' • ' +
        comp.comp_name,
      'success'
    );
  }

  async function deleteRegistrationById(regId) {
    const target = state.registrations.find((r) => r.reg_id === regId);
    if (!target) return;
    const ok = window.confirm(
      'ต้องการลบข้อมูลการลงทะเบียนของ "' +
        target.school_name +
        '" ในรายการ "' +
        target.comp_name +
        ' (' +
        target.level +
        ')" ใช่หรือไม่?'
    );
    if (!ok) return;

    state.registrations = state.registrations.filter((r) => r.reg_id !== regId);
    saveState();
    await postToGoogleSheets({ action: 'delete_registration', reg_id: regId });
    populateRegCompetitionOptions();
    renderAll();
    showToast('ลบรายการลงทะเบียนเรียบร้อยแล้ว', 'warning');
  }

  async function clearSampleData() {
    const sampleCount = state.registrations.filter(
      (r) => String(r.status || '').indexOf('ตัวอย่าง') !== -1
    ).length;
    if (sampleCount === 0) {
      showToast('ไม่มีข้อมูลตัวอย่างค้างอยู่ในระบบแล้ว', 'warning');
      return;
    }
    const ok = window.confirm(
      'ต้องการล้างข้อมูลตัวอย่างจำลองทั้ง ' +
        sampleCount +
        ' รายการ ออกจากระบบ (ข้อมูลที่ครูลงทะเบียนจริงจะไม่ถูกลบ) ใช่หรือไม่?'
    );
    if (!ok) return;

    state.registrations = state.registrations.filter(
      (r) => String(r.status || '').indexOf('ตัวอย่าง') === -1
    );
    saveState();
    await postToGoogleSheets({ action: 'clear_sample_data' });
    populateRegCompetitionOptions();
    renderAll();
    showToast('ล้างข้อมูลตัวอย่างเรียบร้อยแล้ว พร้อมรับสมัครจริง!', 'success');
  }

  // ==========================================
  // RENDER TAB 1: OVERALL DASHBOARD
  // ==========================================
  function renderDashboardTab() {
    const totalComp = state.competitions.length;
    const compRegMap = {};
    state.competitions.forEach((c) => {
      compRegMap[c.comp_id] = 0;
    });

    let totalStudents = 0;
    let totalTeachers = 0;
    const activeSchoolSet = new Set();

    state.registrations.forEach(function (r) {
      if (compRegMap[r.comp_id] !== undefined) {
        compRegMap[r.comp_id]++;
      } else {
        compRegMap[r.comp_id] = 1;
      }
      activeSchoolSet.add(r.school_name);
      totalStudents += Array.isArray(r.students) ? r.students.length : 0;
      totalTeachers += Array.isArray(r.teachers) ? r.teachers.length : 0;
    });

    let regCompCount = 0;
    state.competitions.forEach(function (c) {
      if ((compRegMap[c.comp_id] || 0) > 0) regCompCount++;
    });
    const emptyCompCount = Math.max(0, totalComp - regCompCount);
    const regPct = totalComp > 0 ? Math.round((regCompCount / totalComp) * 100) : 0;

    // Sample banner visibility
    const sampleCount = state.registrations.filter(
      (r) => String(r.status || '').indexOf('ตัวอย่าง') !== -1
    ).length;
    const sampleBanner = document.getElementById('sampleDataBanner');
    const sampleCountText = document.getElementById('sampleCountText');
    if (sampleBanner) {
      if (sampleCount > 0) {
        sampleBanner.classList.remove('hidden');
        if (sampleCountText) sampleCountText.textContent = String(sampleCount);
      } else {
        sampleBanner.classList.add('hidden');
      }
    }

    // Set KPI numbers
    document.getElementById('kpiTotalComp').textContent = String(totalComp);
    document.getElementById('kpiRegComp').textContent = String(regCompCount);
    document.getElementById('kpiRegCompPct').textContent = regPct + '%';
    document.getElementById('kpiEmptyComp').textContent = String(emptyCompCount);
    document.getElementById('kpiActiveSchools').textContent = String(activeSchoolSet.size);
    document.getElementById('kpiTotalSchools').textContent = String(state.schools.length);
    document.getElementById('kpiTotalTeams').textContent = String(state.registrations.length);
    document.getElementById('kpiTotalStudents').textContent = String(totalStudents);
    document.getElementById('kpiTotalTeachers').textContent = String(totalTeachers);

    // 1. Render By Learning Area Table
    const areas = getLearningAreas();
    const areaBody = document.getElementById('dashboardAreaTableBody');
    if (areaBody) {
      areaBody.innerHTML = areas
        .map(function (area) {
          const areaComps = state.competitions.filter((c) => c.learning_area === area);
          const areaRegComps = areaComps.filter((c) => (compRegMap[c.comp_id] || 0) > 0);
          const areaEmptyComps = areaComps.length - areaRegComps.length;
          const areaTeams = state.registrations.filter((r) => r.learning_area === area).length;

          return (
            '<tr class="hover:bg-slate-50 transition">' +
            '<td class="py-2.5 px-3 font-heading font-medium text-slate-900">' +
            escapeHtml(area) +
            '</td>' +
            '<td class="py-2.5 px-2 text-center font-heading text-slate-700">' +
            areaComps.length +
            '</td>' +
            '<td class="py-2.5 px-2 text-center">' +
            '<span class="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-heading font-bold text-xs">' +
            areaRegComps.length +
            '</span>' +
            '</td>' +
            '<td class="py-2.5 px-2 text-center">' +
            (areaEmptyComps > 0
              ? '<button type="button" data-jump-area="' +
                escapeHtml(area) +
                '" data-jump-status="EMPTY" class="px-2 py-0.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 font-heading font-bold text-xs transition">' +
                areaEmptyComps +
                ' รายการว่าง</button>'
              : '<span class="text-xs text-slate-400">ครบแล้ว</span>') +
            '</td>' +
            '<td class="py-2.5 px-2 text-center font-heading font-semibold text-blue-700">' +
            areaTeams +
            ' ทีม</td>' +
            '<td class="py-2.5 px-2 text-right">' +
            '<button type="button" data-jump-area="' +
            escapeHtml(area) +
            '" data-jump-status="ALL" class="text-xs font-heading text-blue-600 hover:text-blue-800 underline">ดูรายการ →</button>' +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      areaBody.querySelectorAll('[data-jump-area]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const area = btn.getAttribute('data-jump-area');
          const status = btn.getAttribute('data-jump-status') || 'ALL';
          document.getElementById('compViewAreaFilter').value = area;
          document.getElementById('compViewLevelFilter').value = 'ALL';
          state.compStatusFilter = status;
          switchTab('competition');
        });
      });
    }

    // 2. Render By Level Grid
    const levelGrid = document.getElementById('dashboardLevelGrid');
    if (levelGrid) {
      const levels = getLevels();
      levelGrid.innerHTML = levels
        .map(function (lvl) {
          const lvlComps = state.competitions.filter((c) => c.level === lvl);
          const lvlReg = lvlComps.filter((c) => (compRegMap[c.comp_id] || 0) > 0).length;
          const lvlTeams = state.registrations.filter((r) => r.level === lvl).length;

          return (
            '<div data-jump-level="' +
            escapeHtml(lvl) +
            '" class="cursor-pointer p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition">' +
            '<div class="font-heading font-bold text-xs text-slate-800">' +
            escapeHtml(lvl) +
            '</div>' +
            '<div class="text-lg font-bold font-heading text-blue-800 mt-1">' +
            lvlTeams +
            ' <span class="text-xs font-normal text-slate-500">ทีม</span></div>' +
            '<div class="text-[11px] text-slate-500 mt-0.5">มีผู้สมัคร ' +
            lvlReg +
            '/' +
            lvlComps.length +
            ' รายการ</div>' +
            '</div>'
          );
        })
        .join('');

      levelGrid.querySelectorAll('[data-jump-level]').forEach(function (card) {
        card.addEventListener('click', function () {
          const lvl = card.getAttribute('data-jump-level');
          document.getElementById('compViewAreaFilter').value = 'ALL';
          document.getElementById('compViewLevelFilter').value = lvl;
          state.compStatusFilter = 'ALL';
          switchTab('competition');
        });
      });
    }

    // 3. Render 13 Schools Table
    const schoolBody = document.getElementById('dashboardSchoolTableBody');
    if (schoolBody) {
      const schoolStats = state.schools.map(function (s) {
        const regs = state.registrations.filter((r) => r.school_name === s.school_name);
        let stuCount = 0;
        let tchCount = 0;
        regs.forEach(function (r) {
          stuCount += (r.students || []).length;
          tchCount += (r.teachers || []).length;
        });
        return {
          school_name: s.school_name,
          subdistrict: s.subdistrict,
          itemCount: regs.length,
          stuCount: stuCount,
          tchCount: tchCount
        };
      });

      schoolStats.sort(function (a, b) {
        if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
        return a.school_name.localeCompare(b.school_name, 'th');
      });

      schoolBody.innerHTML = schoolStats
        .map(function (st) {
          const badgeClass =
            st.itemCount > 0
              ? 'bg-emerald-100 text-emerald-800 font-bold'
              : 'bg-slate-100 text-slate-400';

          return (
            '<tr class="hover:bg-slate-50 transition">' +
            '<td class="py-2 px-2.5">' +
            '<button type="button" data-open-school="' +
            escapeHtml(st.school_name) +
            '" class="text-left font-heading font-medium text-slate-800 hover:text-blue-700 hover:underline">' +
            escapeHtml(st.school_name) +
            '</button>' +
            '<div class="text-[11px] text-slate-400">' +
            escapeHtml(st.subdistrict || '') +
            '</div>' +
            '</td>' +
            '<td class="py-2 px-2 text-center">' +
            '<span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-heading ' +
            badgeClass +
            '">' +
            st.itemCount +
            ' รายการ</span>' +
            '</td>' +
            '<td class="py-2 px-2 text-center text-xs font-heading text-slate-700">' +
            st.stuCount +
            '</td>' +
            '<td class="py-2 px-2 text-center text-xs font-heading text-slate-700">' +
            st.tchCount +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      schoolBody.querySelectorAll('[data-open-school]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const schoolName = btn.getAttribute('data-open-school');
          const select = document.getElementById('schoolViewSelect');
          if (select) select.value = schoolName;
          switchTab('school');
        });
      });
    }

    // 4. Render Recent Registrations Live Table
    const recentBody = document.getElementById('recentRegistrationsBody');
    if (recentBody) {
      if (state.registrations.length === 0) {
        recentBody.innerHTML =
          '<tr><td colspan="7" class="py-8 text-center text-slate-400 text-sm">ยังไม่มีข้อมูลการลงทะเบียนในขณะนี้ กดปุ่ม "2. ลงทะเบียนเข้าแข่งขัน" ด้านบนเพื่อเพิ่มรายชื่อ</td></tr>';
      } else {
        const recentList = state.registrations.slice().reverse();
        recentBody.innerHTML = recentList
          .map(function (r) {
            const stuHtml = (r.students || [])
              .map(
                (s, i) =>
                  '<div>' +
                  (i + 1) +
                  '. ' +
                  escapeHtml(s.prefix + s.name) +
                  ' <span class="text-slate-400">(' +
                  escapeHtml(s.grade) +
                  ')</span></div>'
              )
              .join('');
            const tchHtml = (r.teachers || [])
              .map((t, i) => '<div>' + (i + 1) + '. ' + escapeHtml(t.prefix + t.name) + '</div>')
              .join('');

            const isSample = String(r.status || '').indexOf('ตัวอย่าง') !== -1;
            const statusPill = isSample
              ? '<span class="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-heading ml-1">ตัวอย่าง</span>'
              : '';

            return (
              '<tr class="hover:bg-slate-50 transition ' +
              (r.reg_id === state.lastAddedRegId ? 'row-new-highlight' : '') +
              '">' +
              '<td class="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">' +
              escapeHtml(r.timestamp) +
              '</td>' +
              '<td class="py-2.5 px-3 font-heading font-medium text-slate-900">' +
              escapeHtml(r.school_name) +
              statusPill +
              '</td>' +
              '<td class="py-2.5 px-3">' +
              '<span class="text-xs font-heading text-blue-700 font-semibold">[' +
              escapeHtml(r.comp_id) +
              '] ' +
              escapeHtml(r.learning_area) +
              '</span>' +
              '<div class="font-medium text-slate-800">' +
              escapeHtml(r.comp_name) +
              '</div>' +
              '</td>' +
              '<td class="py-2.5 px-2 text-center">' +
              '<span class="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-heading whitespace-nowrap">' +
              escapeHtml(r.level) +
              '</span>' +
              '</td>' +
              '<td class="py-2.5 px-3 text-xs text-slate-700">' +
              stuHtml +
              '</td>' +
              '<td class="py-2.5 px-3 text-xs text-slate-600">' +
              tchHtml +
              '</td>' +
              '<td class="py-2.5 px-2 text-right whitespace-nowrap space-x-1">' +
              '<button type="button" data-dash-edit="' +
              escapeHtml(r.reg_id) +
              '" class="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-heading">แก้ไข</button>' +
              '<button type="button" data-dash-del="' +
              escapeHtml(r.reg_id) +
              '" class="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-heading">ลบ</button>' +
              '</td>' +
              '</tr>'
            );
          })
          .join('');

        recentBody.querySelectorAll('[data-dash-edit]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadRegistrationIntoForm(btn.getAttribute('data-dash-edit'));
          });
        });
        recentBody.querySelectorAll('[data-dash-del]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            deleteRegistrationById(btn.getAttribute('data-dash-del'));
          });
        });
      }
    }
  }

  // ==========================================
  // RENDER TAB 3: SCHOOL VIEW (รายโรงเรียน)
  // ==========================================
  function renderSchoolViewTab() {
    const select = document.getElementById('schoolViewSelect');
    const schoolName = select ? select.value : '';
    const schoolObj = state.schools.find((s) => s.school_name === schoolName) || {};
    const regs = state.registrations.filter((r) => r.school_name === schoolName);

    document.getElementById('schoolViewHeaderName').textContent =
      schoolName || 'กรุณาเลือกโรงเรียน';
    document.getElementById('schoolViewHeaderMeta').textContent =
      (schoolObj.subdistrict ? schoolObj.subdistrict + ' • ' : '') +
      (schoolObj.school_type ? 'ระดับที่เปิดสอน: ' + schoolObj.school_type + ' • ' : '') +
      'สังกัดกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง (สพป.มหาสารคาม เขต 3)';

    let singleCount = 0;
    let teamCount = 0;
    let stuCount = 0;
    let tchCount = 0;

    regs.forEach(function (r) {
      if (r.team_type === 'เดี่ยว') singleCount++;
      else teamCount++;
      stuCount += (r.students || []).length;
      tchCount += (r.teachers || []).length;
    });

    document.getElementById('schKpiItems').textContent = String(regs.length);
    document.getElementById('schKpiSingle').textContent = String(singleCount);
    document.getElementById('schKpiTeam').textContent = String(teamCount);
    document.getElementById('schKpiStudents').textContent = String(stuCount);
    document.getElementById('schKpiTeachers').textContent = String(tchCount);

    const tbody = document.getElementById('schoolViewTableBody');
    if (!tbody) return;

    if (regs.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="py-10 text-center text-slate-400 text-sm">' +
        escapeHtml(schoolName) +
        ' ยังไม่มีรายการที่ลงทะเบียน — คลิกปุ่ม "✍️ ลงทะเบียนเพิ่มให้โรงเรียนนี้" ด้านบนเพื่อเริ่มส่งรายชื่อ</td></tr>';
      return;
    }

    tbody.innerHTML = regs
      .map(function (r, idx) {
        const stuHtml = (r.students || [])
          .map(
            (s, i) =>
              '<div>' +
              (i + 1) +
              '. ' +
              escapeHtml(s.prefix + s.name) +
              ' <span class="text-slate-400">(' +
              escapeHtml(s.grade) +
              ')</span></div>'
          )
          .join('');
        const tchHtml = (r.teachers || [])
          .map((t, i) => '<div>' + (i + 1) + '. ' + escapeHtml(t.prefix + t.name) + '</div>')
          .join('');

        return (
          '<tr class="hover:bg-slate-50">' +
          '<td class="py-3 px-3 font-heading text-slate-500">' +
          (idx + 1) +
          '</td>' +
          '<td class="py-3 px-3">' +
          '<span class="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-heading font-semibold text-xs">' +
          escapeHtml(r.comp_id) +
          '</span>' +
          '<div class="text-xs text-slate-600 mt-0.5">' +
          escapeHtml(r.learning_area) +
          '</div>' +
          '</td>' +
          '<td class="py-3 px-3 font-heading font-medium text-slate-900">' +
          escapeHtml(r.comp_name) +
          '</td>' +
          '<td class="py-3 px-2 text-center">' +
          '<span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-heading whitespace-nowrap">' +
          escapeHtml(r.level) +
          '</span>' +
          '</td>' +
          '<td class="py-3 px-2 text-center text-xs font-heading">' +
          escapeHtml(r.team_type) +
          ' (' +
          (r.students || []).length +
          ' คน)</td>' +
          '<td class="py-3 px-3 text-xs text-slate-800 space-y-0.5">' +
          stuHtml +
          '</td>' +
          '<td class="py-3 px-3 text-xs text-slate-700 space-y-0.5">' +
          tchHtml +
          '</td>' +
          '<td class="py-3 px-2 text-right whitespace-nowrap no-print space-x-1">' +
          '<button type="button" data-sch-edit="' +
          escapeHtml(r.reg_id) +
          '" class="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-heading">แก้ไข</button>' +
          '<button type="button" data-sch-del="' +
          escapeHtml(r.reg_id) +
          '" class="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-heading">ลบ</button>' +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    tbody.querySelectorAll('[data-sch-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        loadRegistrationIntoForm(btn.getAttribute('data-sch-edit'));
      });
    });
    tbody.querySelectorAll('[data-sch-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteRegistrationById(btn.getAttribute('data-sch-del'));
      });
    });
  }

  // ==========================================
  // RENDER TAB 4: COMPETITION VIEW (รายรายการ & รายการว่าง)
  // ==========================================
  function renderCompetitionViewTab() {
    const areaFilter = (document.getElementById('compViewAreaFilter') || {}).value || 'ALL';
    const levelFilter = (document.getElementById('compViewLevelFilter') || {}).value || 'ALL';
    const keyword = ((document.getElementById('compViewSearch') || {}).value || '')
      .trim()
      .toLowerCase();

    // Group registrations by comp_id
    const regByComp = {};
    state.registrations.forEach(function (r) {
      if (!regByComp[r.comp_id]) regByComp[r.comp_id] = [];
      regByComp[r.comp_id].push(r);
    });

    // Update counts on status pills (filtered by area + level + keyword)
    const baseFiltered = state.competitions.filter(function (c) {
      if (areaFilter !== 'ALL' && c.learning_area !== areaFilter) return false;
      if (levelFilter !== 'ALL' && c.level !== levelFilter) return false;
      if (keyword) {
        const hay = (c.comp_id + ' ' + c.comp_name + ' ' + c.learning_area + ' ' + c.level).toLowerCase();
        if (hay.indexOf(keyword) === -1) return false;
      }
      return true;
    });

    const regCount = baseFiltered.filter((c) => (regByComp[c.comp_id] || []).length > 0).length;
    const emptyCount = baseFiltered.length - regCount;

    document.getElementById('pillCountAll').textContent = String(baseFiltered.length);
    document.getElementById('pillCountReg').textContent = String(regCount);
    document.getElementById('pillCountEmpty').textContent = String(emptyCount);

    // Highlight active status pill
    document.querySelectorAll('.comp-status-pill').forEach(function (pill) {
      const st = pill.getAttribute('data-comp-status');
      if (st === state.compStatusFilter) {
        pill.className =
          'comp-status-pill px-3.5 py-1.5 rounded-xl font-heading text-xs font-semibold bg-blue-700 text-white shadow-sm transition';
      } else {
        pill.className =
          'comp-status-pill px-3.5 py-1.5 rounded-xl font-heading text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    });

    const finalList = baseFiltered.filter(function (c) {
      const count = (regByComp[c.comp_id] || []).length;
      if (state.compStatusFilter === 'REGISTERED') return count > 0;
      if (state.compStatusFilter === 'EMPTY') return count === 0;
      return true;
    });

    const container = document.getElementById('competitionListContainer');
    if (!container) return;

    if (finalList.length === 0) {
      container.innerHTML =
        '<div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">ไม่พบรายการแข่งขันตามเงื่อนไขที่เลือก</div>';
      return;
    }

    container.innerHTML = finalList
      .map(function (c) {
        const regs = regByComp[c.comp_id] || [];
        const hasRegs = regs.length > 0;
        const badgeHtml = hasRegs
          ? '<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-heading font-bold text-xs">✅ สมัครแล้ว ' +
            regs.length +
            ' โรงเรียน</span>'
          : '<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-700 font-heading font-bold text-xs">⚠️ ยังไม่มีผู้สมัคร (0 โรงเรียน)</span>';

        const stuRule =
          c.min_students === c.max_students
            ? c.max_students + ' คน'
            : c.min_students + '–' + c.max_students + ' คน';

        let schoolsTableHtml = '';
        if (hasRegs) {
          schoolsTableHtml =
            '<div class="mt-3 pt-3 border-t border-slate-100 overflow-x-auto">' +
            '<table class="w-full text-xs text-left">' +
            '<thead class="bg-slate-50 text-slate-600 font-heading border-y border-slate-200">' +
            '<tr>' +
            '<th class="py-2 px-3">ลำดับ</th>' +
            '<th class="py-2 px-3">โรงเรียนที่ส่งเข้าแข่งขัน</th>' +
            '<th class="py-2 px-3">รายชื่อนักเรียนผู้เข้าแข่งขัน</th>' +
            '<th class="py-2 px-3">ครูผู้ฝึกซ้อม</th>' +
            '<th class="py-2 px-2 text-right">แก้ไข</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody class="divide-y divide-slate-100">' +
            regs
              .map(function (r, idx) {
                const stuText = (r.students || [])
                  .map((s, i) => i + 1 + '. ' + escapeHtml(s.prefix + s.name) + ' (' + escapeHtml(s.grade) + ')')
                  .join('<br/>');
                const tchText = (r.teachers || [])
                  .map((t, i) => i + 1 + '. ' + escapeHtml(t.prefix + t.name))
                  .join('<br/>');
                return (
                  '<tr>' +
                  '<td class="py-2 px-3 font-heading text-slate-500">' +
                  (idx + 1) +
                  '</td>' +
                  '<td class="py-2 px-3 font-heading font-semibold text-slate-900">' +
                  escapeHtml(r.school_name) +
                  '</td>' +
                  '<td class="py-2 px-3 text-slate-700">' +
                  stuText +
                  '</td>' +
                  '<td class="py-2 px-3 text-slate-600">' +
                  tchText +
                  '</td>' +
                  '<td class="py-2 px-2 text-right">' +
                  '<button type="button" data-comp-edit-reg="' +
                  escapeHtml(r.reg_id) +
                  '" class="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-heading">✏️ แก้ไข</button>' +
                  '</td>' +
                  '</tr>'
                );
              })
              .join('') +
            '</tbody></table></div>';
        }

        return (
          '<div class="bg-white rounded-2xl border ' +
          (hasRegs ? 'border-emerald-200/90' : 'border-slate-200') +
          ' shadow-sm p-4 sm:p-5 transition">' +
          '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
          '<div class="space-y-1">' +
          '<div class="flex flex-wrap items-center gap-2">' +
          '<span class="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 font-heading font-bold text-xs">' +
          escapeHtml(c.comp_id) +
          '</span>' +
          '<span class="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-heading text-xs">' +
          escapeHtml(c.learning_area) +
          '</span>' +
          '<span class="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-heading font-semibold text-xs">ระดับ ' +
          escapeHtml(c.level) +
          '</span>' +
          '<span class="text-xs text-slate-500">• ประเภท' +
          escapeHtml(c.team_type) +
          ' (นักเรียน ' +
          escapeHtml(stuRule) +
          ')</span>' +
          '</div>' +
          '<h3 class="text-base font-bold font-heading text-slate-900">' +
          escapeHtml(c.comp_name) +
          '</h3>' +
          '</div>' +
          '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
          badgeHtml +
          '<button type="button" data-quick-register="' +
          escapeHtml(c.comp_id) +
          '" class="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-heading text-xs font-medium shadow-sm transition">' +
          '✍️ สมัครรายการนี้' +
          '</button>' +
          '</div>' +
          '</div>' +
          schoolsTableHtml +
          '</div>'
        );
      })
      .join('');

    container.querySelectorAll('[data-quick-register]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const compId = btn.getAttribute('data-quick-register');
        switchTab('register');
        document.getElementById('regAreaFilter').value = 'ALL';
        document.getElementById('regLevelFilter').value = 'ALL';
        populateRegCompetitionOptions();
        document.getElementById('regCompSelect').value = compId;
        onRegistrationSelectionChange();
      });
    });

    container.querySelectorAll('[data-comp-edit-reg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        loadRegistrationIntoForm(btn.getAttribute('data-comp-edit-reg'));
      });
    });
  }

  // CSV Export Helper (UTF-8 with BOM for Thai Excel compatibility)
  function downloadCsvFile(filename, rows) {
    const csvContent =
      '\uFEFF' +
      rows
        .map(function (row) {
          return row
            .map(function (cell) {
              const s = String(cell === null || cell === undefined ? '' : cell).replace(/"/g, '""');
              return '"' + s + '"';
            })
            .join(',');
        })
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportRegistrationsCsv(filterSchoolName) {
    const list = filterSchoolName
      ? state.registrations.filter((r) => r.school_name === filterSchoolName)
      : state.registrations;

    const rows = [
      [
        'รหัสใบสมัคร',
        'วันเวลาที่บันทึก',
        'โรงเรียน',
        'รหัสรายการ',
        'กลุ่มสาระการเรียนรู้',
        'ชื่อรายการแข่งขัน',
        'ระดับช่วงชั้น',
        'ประเภท',
        'จำนวนนักเรียน',
        'รายชื่อนักเรียนผู้เข้าแข่งขัน',
        'จำนวนครูผู้ฝึกซ้อม',
        'รายชื่อครูผู้ฝึกซ้อม',
        'เบอร์ติดต่อผู้ประสานงาน',
        'สถานะ'
      ]
    ];

    list.forEach(function (r) {
      const stuStr = (r.students || [])
        .map((s, i) => i + 1 + '. ' + s.prefix + s.name + ' (' + s.grade + ')')
        .join(' | ');
      const tchStr = (r.teachers || [])
        .map((t, i) => i + 1 + '. ' + t.prefix + t.name)
        .join(' | ');
      rows.push([
        r.reg_id,
        r.timestamp,
        r.school_name,
        r.comp_id,
        r.learning_area,
        r.comp_name,
        r.level,
        r.team_type,
        (r.students || []).length,
        stuStr,
        (r.teachers || []).length,
        tchStr,
        r.coordinator_phone || '',
        r.status || 'ลงทะเบียนแล้ว'
      ]);
    });

    const suffix = filterSchoolName ? '_' + filterSchoolName : '_ทั้งหมด';
    downloadCsvFile('ศิลปหัตถกรรมครั้งที่74_วังยาวเขวาไร่ดอนกลาง' + suffix + '.csv', rows);
    showToast('ดาวน์โหลดไฟล์ CSV สำหรับเปิดใน Excel / Google Sheets เรียบร้อยแล้ว', 'success');
  }

  function renderAll() {
    updateSyncBadge();
    renderDashboardTab();
    renderSchoolViewTab();
    renderCompetitionViewTab();
  }

  // Initialize Event Listeners
  function initEvents() {
    // Tab switching
    document.querySelectorAll('.nav-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    // KPI Cards click shortcuts
    document.querySelectorAll('[data-goto-comp]').forEach(function (card) {
      card.addEventListener('click', function () {
        const status = card.getAttribute('data-goto-comp') || 'ALL';
        document.getElementById('compViewAreaFilter').value = 'ALL';
        document.getElementById('compViewLevelFilter').value = 'ALL';
        state.compStatusFilter = status;
        switchTab('competition');
      });
    });

    const kpiSchools = document.getElementById('kpiCardSchools');
    if (kpiSchools) {
      kpiSchools.addEventListener('click', function () {
        switchTab('school');
      });
    }

    // Hero buttons
    const btnGoReg = document.getElementById('btnGoRegisterHero');
    if (btnGoReg) {
      btnGoReg.addEventListener('click', function () {
        switchTab('register');
      });
    }

    const btnClearSamples = document.getElementById('btnClearSamplesQuick');
    if (btnClearSamples) {
      btnClearSamples.addEventListener('click', clearSampleData);
    }

    const btnSyncNow = document.getElementById('btnSyncNow');
    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', function () {
        syncFromGoogleSheets(true);
      });
    }

    // Registration Form Filters & Selects
    ['regAreaFilter', 'regLevelFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          populateRegCompetitionOptions();
          onRegistrationSelectionChange();
        });
      }
    });

    const regSchoolSelect = document.getElementById('regSchoolSelect');
    if (regSchoolSelect) {
      regSchoolSelect.addEventListener('change', function () {
        populateRegCompetitionOptions();
        onRegistrationSelectionChange();
      });
    }

    const regCompSelect = document.getElementById('regCompSelect');
    if (regCompSelect) {
      regCompSelect.addEventListener('change', function () {
        onRegistrationSelectionChange();
      });
    }

    const btnLoadExisting = document.getElementById('btnLoadExistingToEdit');
    if (btnLoadExisting) {
      btnLoadExisting.addEventListener('click', function () {
        const schoolName = document.getElementById('regSchoolSelect').value;
        const compId = document.getElementById('regCompSelect').value;
        const existing = state.registrations.find(
          (r) => r.school_name === schoolName && r.comp_id === compId
        );
        if (existing) {
          onRegistrationSelectionChange(existing);
          showToast('ดึงรายชื่อเดิมขึ้นมาแก้ไขแล้ว', 'warning');
        }
      });
    }

    const btnAddStudent = document.getElementById('btnAddStudentRow');
    if (btnAddStudent) {
      btnAddStudent.addEventListener('click', function () {
        const compId = document.getElementById('regCompSelect').value;
        const comp = state.competitions.find((c) => c.comp_id === compId);
        const container = document.getElementById('studentsInputContainer');
        const currentCount = container.querySelectorAll('.student-input-row').length;
        const maxStu = comp ? Number(comp.max_students || 1) : 10;
        if (currentCount < maxStu) {
          container.appendChild(
            createStudentRowElement(currentCount, comp ? comp.level : '', null, true)
          );
          refreshStudentRowNumbers();
        }
      });
    }

    const btnAddTeacher = document.getElementById('btnAddTeacherRow');
    if (btnAddTeacher) {
      btnAddTeacher.addEventListener('click', function () {
        const container = document.getElementById('teachersInputContainer');
        const currentCount = container.querySelectorAll('.teacher-input-row').length;
        container.appendChild(createTeacherRowElement(currentCount, null, true));
        refreshTeacherRowNumbers();
      });
    }

    const btnResetForm = document.getElementById('btnResetForm');
    if (btnResetForm) {
      btnResetForm.addEventListener('click', function () {
        document.getElementById('regCompSelect').value = '';
        document.getElementById('formEditRegId').value = '';
        onRegistrationSelectionChange();
      });
    }

    const regForm = document.getElementById('registrationForm');
    if (regForm) {
      regForm.addEventListener('submit', handleRegistrationSubmit);
    }

    // Tab 3: School View events
    const schoolViewSelect = document.getElementById('schoolViewSelect');
    if (schoolViewSelect) {
      schoolViewSelect.addEventListener('change', renderSchoolViewTab);
    }

    const btnRegisterForThisSchool = document.getElementById('btnRegisterForThisSchool');
    if (btnRegisterForThisSchool) {
      btnRegisterForThisSchool.addEventListener('click', function () {
        const schoolName = document.getElementById('schoolViewSelect').value;
        switchTab('register');
        if (schoolName) {
          document.getElementById('regSchoolSelect').value = schoolName;
          populateRegCompetitionOptions();
          onRegistrationSelectionChange();
        }
      });
    }

    const btnExportSchoolCsv = document.getElementById('btnExportSchoolCsv');
    if (btnExportSchoolCsv) {
      btnExportSchoolCsv.addEventListener('click', function () {
        const schoolName = document.getElementById('schoolViewSelect').value;
        exportRegistrationsCsv(schoolName);
      });
    }

    const btnExportAllCsv = document.getElementById('btnExportAllCsv');
    if (btnExportAllCsv) {
      btnExportAllCsv.addEventListener('click', function () {
        exportRegistrationsCsv(null);
      });
    }

    // Tab 4: Competition View Filters
    document.querySelectorAll('.comp-status-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        state.compStatusFilter = pill.getAttribute('data-comp-status') || 'ALL';
        renderCompetitionViewTab();
      });
    });

    ['compViewAreaFilter', 'compViewLevelFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', renderCompetitionViewTab);
    });

    const compSearch = document.getElementById('compViewSearch');
    if (compSearch) {
      compSearch.addEventListener('input', renderCompetitionViewTab);
    }

    // Tab 5: Settings & Admin
    const btnSaveGasUrl = document.getElementById('btnSaveGasUrl');
    if (btnSaveGasUrl) {
      btnSaveGasUrl.addEventListener('click', function () {
        const val = (document.getElementById('gasWebAppUrlInput').value || '').trim();
        state.gasWebAppUrl = val;
        localStorage.setItem(GAS_URL_KEY, val);
        updateSyncBadge();
        if (val) {
          syncFromGoogleSheets(true);
        } else {
          showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว', 'success');
        }
      });
    }

    const btnResetToDefault = document.getElementById('btnResetToDefaultData');
    if (btnResetToDefault) {
      btnResetToDefault.addEventListener('click', function () {
        const ok = window.confirm('ต้องการรีเซ็ตข้อมูลในเบราว์เซอร์กลับเป็นค่าเริ่มต้นของระบบใช่หรือไม่?');
        if (!ok) return;
        localStorage.removeItem(STORAGE_KEY);
        loadState();
        populateStaticSelects();
        onRegistrationSelectionChange();
        renderAll();
        showToast('รีเซ็ตข้อมูลกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว', 'success');
      });
    }

    const addCompForm = document.getElementById('addCompForm');
    if (addCompForm) {
      addCompForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const compId = document.getElementById('newCompId').value.trim();
        const area = document.getElementById('newCompArea').value.trim();
        const name = document.getElementById('newCompName').value.trim();
        const level = document.getElementById('newCompLevel').value;
        const type = document.getElementById('newCompType').value;
        const maxStu = Math.max(1, Number(document.getElementById('newCompMaxStu').value || 1));
        const maxTch = Math.max(1, Number(document.getElementById('newCompMaxTch').value || 1));

        if (!compId || !area || !name) return;
        if (state.competitions.some((c) => c.comp_id === compId)) {
          showToast('รหัสรายการ ' + compId + ' มีอยู่ในระบบแล้ว', 'error');
          return;
        }

        const newComp = {
          comp_id: compId,
          learning_area: area,
          comp_name: name,
          level: level,
          team_type: type,
          min_students: type === 'เดี่ยว' ? 1 : maxStu,
          max_students: type === 'เดี่ยว' ? 1 : maxStu,
          min_teachers: 1,
          max_teachers: maxTch,
          status: 'เปิดรับสมัคร'
        };

        state.competitions.push(newComp);
        saveState();
        await postToGoogleSheets({ action: 'add_competition', competition: newComp });
        populateStaticSelects();
        renderAll();
        addCompForm.reset();
        showToast('เพิ่มรายการแข่งขัน [' + compId + '] ' + name + ' เรียบร้อยแล้ว', 'success');
      });
    }

    const addSchoolForm = document.getElementById('addSchoolForm');
    if (addSchoolForm) {
      addSchoolForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const name = document.getElementById('newSchoolName').value.trim();
        const sub = document.getElementById('newSchoolSubdistrict').value.trim();
        if (!name) return;
        if (state.schools.some((s) => s.school_name === name)) {
          showToast('มีชื่อโรงเรียนนี้อยู่ในระบบแล้ว', 'error');
          return;
        }
        const newSch = {
          school_id: 'SCH-' + String(state.schools.length + 1).padStart(2, '0'),
          school_name: name,
          subdistrict: sub || 'อ.โกสุมพิสัย',
          school_type: 'ประถมศึกษา',
          network_group: 'กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง'
        };
        state.schools.push(newSch);
        saveState();
        await postToGoogleSheets({ action: 'add_school', school: newSch });
        populateStaticSelects();
        renderAll();
        addSchoolForm.reset();
        showToast('เพิ่ม ' + name + ' เรียบร้อยแล้ว', 'success');
      });
    }
  }

  // Boot Application
  document.addEventListener('DOMContentLoaded', function () {
    loadState();
    populateStaticSelects();
    initEvents();
    onRegistrationSelectionChange();
    renderAll();
  });
})();
