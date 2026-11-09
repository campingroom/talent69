(function () {
  'use strict';

  const STORAGE_KEY = 'talent69_wangyao_state_v2';
  const GAS_URL_KEY = 'talent69_wangyao_gas_url_v1';
  const ADMIN_PIN_KEY = 'talent69_wangyao_admin_pin_v1';
  const ADMIN_SESSION_KEY = 'talent69_wangyao_admin_session_v1';
  const REG_OPEN_KEY = 'talent69_wangyao_reg_open_v1';
  const DEFAULT_ADMIN_PIN = '7469';

  const DEFAULT_DATA = window.TALENT69_DEFAULT_DATA || {
    eventInfo: {},
    schools: [],
    competitions: [],
    sampleRegistrations: []
  };

  // Minimalist Notion-style SVG Line Icons (Zero Emojis)
  const ICONS = {
    check:
      '<svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    checkSm:
      '<svg class="w-3.5 h-3.5 shrink-0 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    warning:
      '<svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warningSm:
      '<svg class="w-3.5 h-3.5 shrink-0 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    error:
      '<svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    edit:
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.65"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>',
    trash:
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.65"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
    plus:
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>',
    print:
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.65"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
  };

  let state = {
    schools: [],
    competitions: [],
    registrations: [],
    activeTab: 'dashboard',
    compStatusFilter: 'ALL',
    lastAddedRegId: null,
    gasWebAppUrl: '',
    isAdmin: false,
    adminPin: DEFAULT_ADMIN_PIN,
    registrationOpen: true
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

  function normalizePhoneDigits(phone) {
    return String(phone || '').replace(/\D+/g, '');
  }

  function verifyPhoneMatchClient(storedPhone, inputToken) {
    if (!inputToken) return false;
    const tokenClean = String(inputToken).trim();
    if (tokenClean === state.adminPin) return true;
    const storedDigits = normalizePhoneDigits(storedPhone);
    const inputDigits = normalizePhoneDigits(tokenClean);
    if (!storedDigits) return true;
    if (inputDigits.length < 4) return false;
    return storedDigits === inputDigits || storedDigits.slice(-4) === inputDigits.slice(-4);
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

    const styleClass =
      type === 'error'
        ? 'bg-[#37352F] text-white border-[#D44C47]'
        : type === 'warning'
        ? 'bg-[#37352F] text-white border-[#CB912F]'
        : 'bg-[#37352F] text-white border-[#448361]';

    const iconSvg =
      type === 'error' ? ICONS.error : type === 'warning' ? ICONS.warning : ICONS.check;

    // Keep at most 1 previous toast so toasts never clutter mobile screens
    while (container.children.length >= 1) {
      container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className =
      'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-heading font-medium transition duration-300 ' +
      styleClass;
    toast.innerHTML = iconSvg + '<span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 2800);
  }

  // Load state from localStorage or initialize from mock-data.js
  function loadState() {
    state.gasWebAppUrl = localStorage.getItem(GAS_URL_KEY) || '';
    state.adminPin = localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN;
    state.isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    const regOpenStored = localStorage.getItem(REG_OPEN_KEY);
    state.registrationOpen = regOpenStored === null ? true : regOpenStored !== 'false';

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        state.schools =
          Array.isArray(parsed.schools) && parsed.schools.length
            ? parsed.schools
            : cloneDeep(DEFAULT_DATA.schools);
        state.competitions =
          Array.isArray(parsed.competitions) && parsed.competitions.length
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

  function updateAdminAndStatusUI() {
    // 1. Registration Open/Closed Pill & Form Banner
    const badge = document.getElementById('regOpenStatusBadge');
    const dot = document.getElementById('regOpenStatusDot');
    const text = document.getElementById('regOpenStatusText');
    const closedBanner = document.getElementById('registrationClosedBanner');
    const toggleBtn = document.getElementById('btnToggleRegistrationOpen');

    if (badge && dot && text) {
      if (state.registrationOpen) {
        badge.className =
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EDF3EC] border border-[#D7E6D5] text-[#448361] text-xs font-heading font-medium';
        dot.className = 'w-2 h-2 rounded-full bg-[#448361]';
        text.textContent = 'เปิดรับสมัคร';
      } else {
        badge.className =
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDEBEC] border border-[#F5D0D2] text-[#D44C47] text-xs font-heading font-medium';
        dot.className = 'w-2 h-2 rounded-full bg-[#D44C47]';
        text.textContent = 'ปิดรับสมัครแล้ว';
      }
    }

    if (closedBanner) {
      if (state.registrationOpen) {
        closedBanner.classList.add('hidden');
      } else {
        closedBanner.classList.remove('hidden');
      }
    }

    if (toggleBtn) {
      toggleBtn.textContent = state.registrationOpen
        ? 'ปิดรับสมัครชั่วคราว'
        : 'เปิดรับสมัครอีกครั้ง';
    }

    // 2. Admin-only Controls Visibility
    const headerSheetLink = document.getElementById('headerSheetLink');
    const navTabSettings = document.getElementById('navTabSettings');
    const btnClearSamplesQuick = document.getElementById('btnClearSamplesQuick');
    const btnAdminToggle = document.getElementById('btnAdminToggle');
    const adminBtnText = document.getElementById('adminBtnText');

    if (headerSheetLink) {
      if (state.isAdmin) {
        headerSheetLink.classList.remove('hidden');
        headerSheetLink.classList.add('inline-flex');
      } else {
        headerSheetLink.classList.add('hidden');
        headerSheetLink.classList.remove('inline-flex');
      }
    }

    if (navTabSettings) {
      if (state.isAdmin) {
        navTabSettings.classList.remove('hidden');
        navTabSettings.classList.add('flex');
      } else {
        navTabSettings.classList.add('hidden');
        navTabSettings.classList.remove('flex');
      }
    }

    if (btnClearSamplesQuick) {
      if (state.isAdmin) {
        btnClearSamplesQuick.classList.remove('hidden');
        btnClearSamplesQuick.classList.add('inline-flex');
      } else {
        btnClearSamplesQuick.classList.add('hidden');
        btnClearSamplesQuick.classList.remove('inline-flex');
      }
    }

    if (btnAdminToggle && adminBtnText) {
      if (state.isAdmin) {
        btnAdminToggle.className =
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 font-heading text-xs font-medium transition';
        adminBtnText.textContent = 'โหมดแอดมิน (ออกจากระบบ)';
      } else {
        btnAdminToggle.className =
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-heading text-xs font-medium transition';
        adminBtnText.textContent = 'สำหรับแอดมิน';
      }
    }

    const urlInput = document.getElementById('gasWebAppUrlInput');
    if (urlInput) urlInput.value = state.gasWebAppUrl;
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
        if (Array.isArray(data.competitions) && data.competitions.length) {
          state.competitions = data.competitions;
        }
        if (Array.isArray(data.registrations)) state.registrations = data.registrations;
        if (typeof data.registrationOpen === 'boolean') {
          state.registrationOpen = data.registrationOpen;
          localStorage.setItem(REG_OPEN_KEY, String(data.registrationOpen));
        }
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
    if (tabName === 'settings' && !state.isAdmin) {
      openAdminModal();
      return;
    }
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
      let html = '<option value="">-- เลือกโรงเรียนในกลุ่มวังยาวเขวาไร่ดอนกลาง --</option>';
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
      let html = '<option value="ALL">-- ทุกหมวดกิจกรรม (' + areas.length + ' หมวดย่อย) --</option>';
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

      const statusSuffix = alreadyReg ? ' • [โรงเรียนนี้ส่งแล้ว]' : '';

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
    row.className =
      'student-input-row grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200';

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
      '<div class="col-span-12 sm:col-span-1 text-xs font-heading font-semibold text-slate-600 text-center stu-index-badge">คนที่ ' +
      (index + 1) +
      '</div>' +
      '<div class="col-span-4 sm:col-span-2">' +
      '<select class="stu-prefix w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-[#F7F7F5]">' +
      prefixOptions +
      '</select>' +
      '</div>' +
      '<div class="col-span-8 sm:col-span-6">' +
      '<input type="text" required placeholder="ชื่อ - นามสกุล นักเรียน" value="' +
      escapeHtml(nameVal) +
      '" class="stu-name w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />' +
      '</div>' +
      '<div class="col-span-9 sm:col-span-2">' +
      '<select class="stu-grade w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-[#F7F7F5]">' +
      gradeOptions +
      '</select>' +
      '</div>' +
      '<div class="col-span-3 sm:col-span-1 text-right">' +
      (canRemove
        ? '<button type="button" class="btn-remove-stu px-2 py-1 rounded-md bg-[#FDEBEC] hover:bg-rose-100 text-[#D44C47] text-xs font-heading">ลบ</button>'
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
    row.className =
      'teacher-input-row grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200';

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
      '<div class="col-span-12 sm:col-span-1 text-xs font-heading font-semibold text-slate-600 text-center tch-index-badge">ครู ' +
      (index + 1) +
      '</div>' +
      '<div class="col-span-4 sm:col-span-3">' +
      '<select class="tch-prefix w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-[#F7F7F5]">' +
      prefixOptions +
      '</select>' +
      '</div>' +
      '<div class="col-span-8 sm:col-span-7">' +
      '<input type="text" required placeholder="ชื่อ - นามสกุล ครูผู้ฝึกซ้อม" value="' +
      escapeHtml(nameVal) +
      '" class="tch-name w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />' +
      '</div>' +
      '<div class="col-span-12 sm:col-span-1 text-right">' +
      (canRemove
        ? '<button type="button" class="btn-remove-tch px-2 py-1 rounded-md bg-[#FDEBEC] hover:bg-rose-100 text-[#D44C47] text-xs font-heading">ลบ</button>'
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

    renderLiveSchoolPreview(schoolName);

    if (!comp) {
      if (metaBox) metaBox.classList.add('hidden');
      if (dupBox) dupBox.classList.add('hidden');
      if (stuRuleLabel) stuRuleLabel.textContent = '(เลือกรายการแข่งขันก่อน)';
      if (tchRuleLabel) tchRuleLabel.textContent = '(ระบุได้ 1 หรือหลายคน)';
      if (stuContainer) {
        stuContainer.innerHTML =
          '<div class="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg bg-white">กรุณาเลือกรายการแข่งขันในขั้นตอนที่ 2 เพื่อแสดงช่องกรอกรายชื่อนักเรียนตามประเภทเดี่ยว/ทีม</div>';
      }
      if (tchContainer && tchContainer.children.length === 0) {
        tchContainer.innerHTML = '';
        tchContainer.appendChild(createTeacherRowElement(0, null, false));
      }
      if (submitBtn) submitBtn.textContent = 'ยืนยันการลงทะเบียน';
      return;
    }

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
        'หมวด: ' +
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

    stuContainer.innerHTML = '';
    if (existingToLoad && Array.isArray(existingToLoad.students)) {
      editRegIdInput.value = existingToLoad.reg_id;
      if (submitBtn) {
        submitBtn.textContent = 'บันทึกการแก้ไขรายชื่อเดิม';
      }
      existingToLoad.students.forEach(function (st, idx) {
        stuContainer.appendChild(
          createStudentRowElement(idx, comp.level, st, idx >= comp.min_students)
        );
      });
    } else {
      editRegIdInput.value = '';
      if (submitBtn) {
        submitBtn.textContent = 'ยืนยันการลงทะเบียน';
      }
      const initialCount = Number(comp.min_students || 1);
      for (let i = 0; i < initialCount; i++) {
        stuContainer.appendChild(createStudentRowElement(i, comp.level, null, false));
      }
    }
    refreshStudentRowNumbers();

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
        '<div class="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-lg">เมื่อเลือกโรงเรียนด้านซ้าย รายการที่โรงเรียนนั้นลงทะเบียนไว้จะแสดงที่นี่ทันที</div>';
      return;
    }

    const schoolRegs = state.registrations.filter((r) => r.school_name === schoolName);
    if (subtitle) subtitle.textContent = schoolName;
    if (badge) badge.textContent = schoolRegs.length + ' รายการ';

    if (schoolRegs.length === 0) {
      listEl.innerHTML =
        '<div class="text-xs text-slate-500 py-8 text-center bg-[#F7F7F5] border border-dashed border-slate-200 rounded-lg">' +
        escapeHtml(schoolName) +
        ' ยังไม่ได้ลงทะเบียนรายการแข่งขันใด</div>';
      return;
    }

    listEl.innerHTML = schoolRegs
      .slice()
      .reverse()
      .map(function (reg) {
        const isHighlighted =
          reg.reg_id === state.lastAddedRegId
            ? 'row-new-highlight border-slate-400'
            : 'border-slate-200';
        const stuHtml = (reg.students || [])
          .map((s, i) => i + 1 + '. ' + escapeHtml(s.prefix + s.name) + ' (' + escapeHtml(s.grade) + ')')
          .join('<br/>');
        const tchHtml = (reg.teachers || [])
          .map((t, i) => i + 1 + '. ' + escapeHtml(t.prefix + t.name))
          .join('<br/>');

        return (
          '<div class="p-3.5 rounded-lg bg-[#F7F7F5] border ' +
          isHighlighted +
          ' text-xs space-y-1.5">' +
          '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
          '<span class="inline-block px-2 py-0.5 rounded bg-[#E7F3F8] text-[#337EA9] font-heading font-medium text-[11px] mr-1">' +
          escapeHtml(reg.learning_area) +
          '</span>' +
          '<span class="inline-block px-2 py-0.5 rounded bg-[#F1F1EF] text-[#37352F] font-heading text-[11px]">' +
          escapeHtml(reg.level) +
          '</span>' +
          '<div class="font-heading font-bold text-[#37352F] text-sm mt-1">[' +
          escapeHtml(reg.comp_id) +
          '] ' +
          escapeHtml(reg.comp_name) +
          '</div>' +
          '</div>' +
          '<button type="button" data-edit-reg="' +
          escapeHtml(reg.reg_id) +
          '" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:bg-[#F1F1EF] text-[#37352F] font-heading font-medium shrink-0">' +
          ICONS.edit +
          '<span>แก้ไข</span></button>' +
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
        requestEditRegistration(btn.getAttribute('data-edit-reg'));
      });
    });
  }

  // Request edit: verify Coordinator Phone (or Admin Mode) before loading into form
  function requestEditRegistration(regId) {
    const reg = state.registrations.find((r) => r.reg_id === regId);
    if (!reg) return;

    const isSample = String(reg.status || '').indexOf('ตัวอย่าง') !== -1;
    const hasPhone = Boolean(normalizePhoneDigits(reg.coordinator_phone));

    if (state.isAdmin || isSample || !hasPhone) {
      loadRegistrationIntoForm(regId, state.isAdmin ? state.adminPin : '');
      return;
    }

    const modal = document.getElementById('editVerifyModal');
    const desc = document.getElementById('editVerifyTargetDesc');
    const regIdInput = document.getElementById('editVerifyRegId');
    const tokenInput = document.getElementById('editVerifyTokenInput');

    if (desc) {
      desc.textContent = reg.school_name + ' • [' + reg.comp_id + '] ' + reg.comp_name;
    }
    if (regIdInput) regIdInput.value = reg.reg_id;
    if (tokenInput) tokenInput.value = '';
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (tokenInput) setTimeout(() => tokenInput.focus(), 50);
    }
  }

  function closeEditVerifyModal() {
    const modal = document.getElementById('editVerifyModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function openAdminModal() {
    const modal = document.getElementById('adminLoginModal');
    const pinInput = document.getElementById('adminPinInput');
    if (pinInput) pinInput.value = '';
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (pinInput) setTimeout(() => pinInput.focus(), 50);
    }
  }

  function closeAdminModal() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function loadRegistrationIntoForm(regId, verifyToken) {
    const reg = state.registrations.find((r) => r.reg_id === regId);
    if (!reg) return;

    switchTab('register');
    const schoolSelect = document.getElementById('regSchoolSelect');
    const areaFilter = document.getElementById('regAreaFilter');
    const levelFilter = document.getElementById('regLevelFilter');
    const compSelect = document.getElementById('regCompSelect');
    const phoneInput = document.getElementById('regCoordinatorPhone');
    const tokenHidden = document.getElementById('formEditVerifyToken');

    if (schoolSelect) schoolSelect.value = reg.school_name;
    if (areaFilter) areaFilter.value = 'ALL';
    if (levelFilter) levelFilter.value = 'ALL';
    populateRegCompetitionOptions();
    if (compSelect) compSelect.value = reg.comp_id;
    if (phoneInput) phoneInput.value = reg.coordinator_phone || '';
    if (tokenHidden) tokenHidden.value = verifyToken || reg.coordinator_phone || '';

    onRegistrationSelectionChange(reg);
    showToast('ดึงข้อมูลเดิมของ ' + reg.school_name + ' มาแก้ไขแล้ว', 'warning');
  }

  // Handle Form Submission
  async function handleRegistrationSubmit(e) {
    e.preventDefault();

    if (!state.registrationOpen && !state.isAdmin) {
      showToast('ขณะนี้ระบบปิดรับสมัครแล้ว กรุณาติดต่อผู้ดูแลระบบระดับกลุ่มโรงเรียน', 'error');
      return;
    }

    const schoolName = (document.getElementById('regSchoolSelect') || {}).value.trim();
    const compId = (document.getElementById('regCompSelect') || {}).value.trim();
    const coordinatorPhone = (document.getElementById('regCoordinatorPhone') || {}).value.trim();
    const editRegId = (document.getElementById('formEditRegId') || {}).value.trim();
    const editVerifyToken = (document.getElementById('formEditVerifyToken') || {}).value.trim();

    if (!schoolName) {
      showToast('กรุณาเลือกโรงเรียนที่ส่งเข้าแข่งขัน', 'error');
      return;
    }
    if (!compId) {
      showToast('กรุณาเลือกรายการแข่งขัน', 'error');
      return;
    }
    if (!coordinatorPhone || normalizePhoneDigits(coordinatorPhone).length < 4) {
      showToast('กรุณากรอกเบอร์โทรศัพท์ผู้ประสานงาน (อย่างน้อย 4 หลัก) เพื่อใช้ยืนยันเมื่อต้องการแก้ไข', 'error');
      document.getElementById('regCoordinatorPhone').focus();
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
      const existingReg = state.registrations[existingIndex];
      const isSample = String(existingReg.status || '').indexOf('ตัวอย่าง') !== -1;

      if (!state.isAdmin && !isSample) {
        // Verify coordinator phone matches existing record
        if (!verifyPhoneMatchClient(existingReg.coordinator_phone, coordinatorPhone)) {
          showToast(
            'โรงเรียนนี้ส่งรายการนี้แล้ว การบันทึกทับต้องใช้เบอร์โทรผู้ประสานงานเดิมที่เคยลงทะเบียนไว้ (หรือกดปุ่มแก้ไขรายชื่อเดิม)',
            'error'
          );
          return;
        }
      }

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
      verify_token: state.isAdmin ? state.adminPin : editVerifyToken || coordinatorPhone,
      admin_pin: state.isAdmin ? state.adminPin : '',
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
    document.getElementById('formEditVerifyToken').value = '';
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
    if (!state.isAdmin) {
      showToast('เฉพาะแอดมินเท่านั้นที่สามารถลบรายการลงทะเบียนได้', 'error');
      return;
    }
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
    await postToGoogleSheets({
      action: 'delete_registration',
      reg_id: regId,
      admin_pin: state.adminPin
    });
    populateRegCompetitionOptions();
    renderAll();
    showToast('ลบรายการลงทะเบียนเรียบร้อยแล้ว', 'warning');
  }

  async function clearSampleData() {
    if (!state.isAdmin) {
      showToast('เฉพาะแอดมินเท่านั้นที่สามารถล้างข้อมูลตัวอย่างได้', 'error');
      return;
    }
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
    await postToGoogleSheets({ action: 'clear_sample_data', admin_pin: state.adminPin });
    populateRegCompetitionOptions();
    renderAll();
    showToast('ล้างข้อมูลตัวอย่างเรียบร้อยแล้ว พร้อมรับสมัครจริง', 'success');
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
            '<tr class="hover:bg-[#F7F7F5] transition">' +
            '<td class="py-2.5 px-3 font-heading font-medium text-[#37352F]">' +
            escapeHtml(area) +
            '</td>' +
            '<td class="py-2.5 px-2 text-center font-heading text-slate-600">' +
            areaComps.length +
            '</td>' +
            '<td class="py-2.5 px-2 text-center">' +
            '<span class="inline-block px-2 py-0.5 rounded-md bg-[#EDF3EC] text-[#448361] font-heading font-semibold text-xs">' +
            areaRegComps.length +
            '</span>' +
            '</td>' +
            '<td class="py-2.5 px-2 text-center">' +
            (areaEmptyComps > 0
              ? '<button type="button" data-jump-area="' +
                escapeHtml(area) +
                '" data-jump-status="EMPTY" class="px-2 py-0.5 rounded-md bg-[#FDEBEC] hover:bg-rose-100 text-[#D44C47] font-heading font-semibold text-xs transition">' +
                areaEmptyComps +
                ' รายการว่าง</button>'
              : '<span class="text-xs text-slate-400">ครบแล้ว</span>') +
            '</td>' +
            '<td class="py-2.5 px-2 text-center font-heading font-semibold text-[#37352F]">' +
            areaTeams +
            ' ทีม</td>' +
            '<td class="py-2.5 px-2 text-right">' +
            '<button type="button" data-jump-area="' +
            escapeHtml(area) +
            '" data-jump-status="ALL" class="text-xs font-heading text-[#787774] hover:text-[#37352F] underline">ดูรายการ</button>' +
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
            '" class="cursor-pointer p-3 rounded-lg bg-[#F7F7F5] hover:bg-[#F1F1EF] border border-slate-200 transition">' +
            '<div class="font-heading font-semibold text-xs text-[#37352F]">' +
            escapeHtml(lvl) +
            '</div>' +
            '<div class="text-lg font-bold font-heading text-[#37352F] mt-1">' +
            lvlTeams +
            ' <span class="text-xs font-normal text-[#787774]">ทีม</span></div>' +
            '<div class="text-[11px] text-[#787774] mt-0.5">มีผู้สมัคร ' +
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
              ? 'bg-[#EDF3EC] text-[#448361] font-semibold'
              : 'bg-[#F1F1EF] text-[#787774]';

          return (
            '<tr class="hover:bg-[#F7F7F5] transition">' +
            '<td class="py-2 px-2.5">' +
            '<button type="button" data-open-school="' +
            escapeHtml(st.school_name) +
            '" class="text-left font-heading font-medium text-[#37352F] hover:underline">' +
            escapeHtml(st.school_name) +
            '</button>' +
            '<div class="text-[11px] text-[#787774]">' +
            escapeHtml(st.subdistrict || '') +
            '</div>' +
            '</td>' +
            '<td class="py-2 px-2 text-center">' +
            '<span class="inline-block px-2.5 py-0.5 rounded-md text-xs font-heading ' +
            badgeClass +
            '">' +
            st.itemCount +
            ' รายการ</span>' +
            '</td>' +
            '<td class="py-2 px-2 text-center text-xs font-heading text-[#37352F]">' +
            st.stuCount +
            '</td>' +
            '<td class="py-2 px-2 text-center text-xs font-heading text-[#37352F]">' +
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
          '<tr><td colspan="7" class="py-8 text-center text-[#787774] text-sm">ยังไม่มีข้อมูลการลงทะเบียนในขณะนี้ กดแท็บ "ลงทะเบียนเข้าแข่งขัน" ด้านบนเพื่อเพิ่มรายชื่อ</td></tr>';
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
                  ' <span class="text-[#787774]">(' +
                  escapeHtml(s.grade) +
                  ')</span></div>'
              )
              .join('');
            const tchHtml = (r.teachers || [])
              .map((t, i) => '<div>' + (i + 1) + '. ' + escapeHtml(t.prefix + t.name) + '</div>')
              .join('');

            const isSample = String(r.status || '').indexOf('ตัวอย่าง') !== -1;
            const statusPill = isSample
              ? '<span class="inline-block px-2 py-0.5 rounded bg-[#FBF3DB] text-[#CB912F] text-[10px] font-heading ml-1">ตัวอย่าง</span>'
              : '';

            const deleteBtnHtml = state.isAdmin
              ? '<button type="button" data-dash-del="' +
                escapeHtml(r.reg_id) +
                '" class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#FDEBEC] hover:bg-rose-100 text-[#D44C47] text-xs font-heading">' +
                ICONS.trash +
                '<span>ลบ</span></button>'
              : '';

            return (
              '<tr class="hover:bg-[#F7F7F5] transition ' +
              (r.reg_id === state.lastAddedRegId ? 'row-new-highlight' : '') +
              '">' +
              '<td class="py-2.5 px-3 text-xs text-[#787774] whitespace-nowrap">' +
              escapeHtml(r.timestamp) +
              '</td>' +
              '<td class="py-2.5 px-3 font-heading font-medium text-[#37352F]">' +
              escapeHtml(r.school_name) +
              statusPill +
              '</td>' +
              '<td class="py-2.5 px-3">' +
              '<span class="text-xs font-heading text-[#337EA9] font-semibold">[' +
              escapeHtml(r.comp_id) +
              '] ' +
              escapeHtml(r.learning_area) +
              '</span>' +
              '<div class="font-medium text-[#37352F]">' +
              escapeHtml(r.comp_name) +
              '</div>' +
              '</td>' +
              '<td class="py-2.5 px-2 text-center">' +
              '<span class="inline-block px-2 py-0.5 rounded-md bg-[#F1F1EF] text-[#37352F] text-xs font-heading whitespace-nowrap">' +
              escapeHtml(r.level) +
              '</span>' +
              '</td>' +
              '<td class="py-2.5 px-3 text-xs text-[#37352F]">' +
              stuHtml +
              '</td>' +
              '<td class="py-2.5 px-3 text-xs text-[#787774]">' +
              tchHtml +
              '</td>' +
              '<td class="py-2.5 px-2 text-right whitespace-nowrap space-x-1">' +
              '<button type="button" data-dash-edit="' +
              escapeHtml(r.reg_id) +
              '" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F1F1EF] hover:bg-[#E9E9E7] text-[#37352F] text-xs font-heading">' +
              ICONS.edit +
              '<span>แก้ไข</span></button>' +
              deleteBtnHtml +
              '</td>' +
              '</tr>'
            );
          })
          .join('');

        recentBody.querySelectorAll('[data-dash-edit]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            requestEditRegistration(btn.getAttribute('data-dash-edit'));
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
        '<tr><td colspan="8" class="py-10 text-center text-[#787774] text-sm">' +
        escapeHtml(schoolName) +
        ' ยังไม่มีรายการที่ลงทะเบียน — คลิกปุ่ม "ลงทะเบียนเพิ่มให้โรงเรียนนี้" ด้านบนเพื่อเริ่มส่งรายชื่อ</td></tr>';
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
              ' <span class="text-[#787774]">(' +
              escapeHtml(s.grade) +
              ')</span></div>'
          )
          .join('');
        const tchHtml = (r.teachers || [])
          .map((t, i) => '<div>' + (i + 1) + '. ' + escapeHtml(t.prefix + t.name) + '</div>')
          .join('');

        const deleteBtnHtml = state.isAdmin
          ? '<button type="button" data-sch-del="' +
            escapeHtml(r.reg_id) +
            '" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FDEBEC] hover:bg-rose-100 text-[#D44C47] text-xs font-heading">' +
            ICONS.trash +
            '<span>ลบ</span></button>'
          : '';

        return (
          '<tr class="hover:bg-[#F7F7F5]">' +
          '<td class="py-3 px-3 font-heading text-[#787774]">' +
          (idx + 1) +
          '</td>' +
          '<td class="py-3 px-3">' +
          '<span class="inline-block px-2 py-0.5 rounded bg-[#E7F3F8] text-[#337EA9] font-heading font-semibold text-xs">' +
          escapeHtml(r.comp_id) +
          '</span>' +
          '<div class="text-xs text-[#787774] mt-0.5">' +
          escapeHtml(r.learning_area) +
          '</div>' +
          '</td>' +
          '<td class="py-3 px-3 font-heading font-medium text-[#37352F]">' +
          escapeHtml(r.comp_name) +
          '</td>' +
          '<td class="py-3 px-2 text-center">' +
          '<span class="px-2.5 py-0.5 rounded-md bg-[#F1F1EF] text-[#37352F] text-xs font-heading whitespace-nowrap">' +
          escapeHtml(r.level) +
          '</span>' +
          '</td>' +
          '<td class="py-3 px-2 text-center text-xs font-heading">' +
          escapeHtml(r.team_type) +
          ' (' +
          (r.students || []).length +
          ' คน)</td>' +
          '<td class="py-3 px-3 text-xs text-[#37352F] space-y-0.5">' +
          stuHtml +
          '</td>' +
          '<td class="py-3 px-3 text-xs text-[#787774] space-y-0.5">' +
          tchHtml +
          '</td>' +
          '<td class="py-3 px-2 text-right whitespace-nowrap no-print space-x-1">' +
          '<button type="button" data-sch-edit="' +
          escapeHtml(r.reg_id) +
          '" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F1F1EF] hover:bg-[#E9E9E7] text-[#37352F] text-xs font-heading">' +
          ICONS.edit +
          '<span>แก้ไข</span></button>' +
          deleteBtnHtml +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    tbody.querySelectorAll('[data-sch-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        requestEditRegistration(btn.getAttribute('data-sch-edit'));
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

    const regByComp = {};
    state.registrations.forEach(function (r) {
      if (!regByComp[r.comp_id]) regByComp[r.comp_id] = [];
      regByComp[r.comp_id].push(r);
    });

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

    document.querySelectorAll('.comp-status-pill').forEach(function (pill) {
      const st = pill.getAttribute('data-comp-status');
      if (st === state.compStatusFilter) {
        pill.className =
          'comp-status-pill px-3.5 py-1.5 rounded-lg font-heading text-xs font-medium bg-[#37352F] text-white transition';
      } else {
        pill.className =
          'comp-status-pill px-3.5 py-1.5 rounded-lg font-heading text-xs font-medium bg-[#F1F1EF] text-[#37352F] hover:bg-[#E9E9E7] transition';
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
        '<div class="bg-white rounded-xl border border-slate-200 p-10 text-center text-[#787774] text-sm">ไม่พบรายการแข่งขันตามเงื่อนไขที่เลือก</div>';
      return;
    }

    container.innerHTML = finalList
      .map(function (c) {
        const regs = regByComp[c.comp_id] || [];
        const hasRegs = regs.length > 0;
        const badgeHtml = hasRegs
          ? '<span class="inline-flex items-center px-2.5 py-1 rounded-md bg-[#EDF3EC] text-[#448361] font-heading font-semibold text-xs">' +
            ICONS.checkSm +
            'สมัครแล้ว ' +
            regs.length +
            ' โรงเรียน</span>'
          : '<span class="inline-flex items-center px-2.5 py-1 rounded-md bg-[#FDEBEC] text-[#D44C47] font-heading font-medium text-xs">' +
            ICONS.warningSm +
            'ยังไม่มีผู้สมัคร</span>';

        const stuRule =
          c.min_students === c.max_students
            ? c.max_students + ' คน'
            : c.min_students + '–' + c.max_students + ' คน';

        let schoolsTableHtml = '';
        if (hasRegs) {
          schoolsTableHtml =
            '<div class="mt-3 pt-3 border-t border-slate-100 overflow-x-auto">' +
            '<table class="w-full text-xs text-left">' +
            '<thead class="bg-[#F7F7F5] text-[#787774] font-heading border-y border-slate-200">' +
            '<tr>' +
            '<th class="py-2 px-3">ลำดับ</th>' +
            '<th class="py-2 px-3">โรงเรียนที่ส่งเข้าแข่งขัน</th>' +
            '<th class="py-2 px-3">รายชื่อนักเรียนผู้เข้าแข่งขัน</th>' +
            '<th class="py-2 px-3">ครูผู้ฝึกซ้อม</th>' +
            '<th class="py-2 px-2 text-right">จัดการ</th>' +
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
                  '<td class="py-2 px-3 font-heading text-[#787774]">' +
                  (idx + 1) +
                  '</td>' +
                  '<td class="py-2 px-3 font-heading font-semibold text-[#37352F]">' +
                  escapeHtml(r.school_name) +
                  '</td>' +
                  '<td class="py-2 px-3 text-[#37352F]">' +
                  stuText +
                  '</td>' +
                  '<td class="py-2 px-3 text-[#787774]">' +
                  tchText +
                  '</td>' +
                  '<td class="py-2 px-2 text-right">' +
                  '<button type="button" data-comp-edit-reg="' +
                  escapeHtml(r.reg_id) +
                  '" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F1F1EF] hover:bg-[#E9E9E7] text-[#37352F] font-heading">' +
                  ICONS.edit +
                  '<span>แก้ไข</span></button>' +
                  '</td>' +
                  '</tr>'
                );
              })
              .join('') +
            '</tbody></table></div>';
        }

        const printCheckinBtnHtml = hasRegs
          ? '<button type="button" data-print-checkin="' +
            escapeHtml(c.comp_id) +
            '" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F1F1EF] hover:bg-[#E9E9E7] text-[#37352F] font-heading text-xs font-medium transition">' +
            ICONS.print +
            '<span>ใบลงชื่อหน้าห้อง</span></button>'
          : '';

        return (
          '<div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 transition">' +
          '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
          '<div class="space-y-1">' +
          '<div class="flex flex-wrap items-center gap-1.5">' +
          '<span class="px-2 py-0.5 rounded bg-[#E7F3F8] text-[#337EA9] font-heading font-semibold text-xs">' +
          escapeHtml(c.comp_id) +
          '</span>' +
          '<span class="px-2 py-0.5 rounded bg-[#F1F1EF] text-[#37352F] font-heading text-xs">' +
          escapeHtml(c.learning_area) +
          '</span>' +
          '<span class="px-2 py-0.5 rounded bg-[#F1F1EF] text-[#37352F] font-heading font-medium text-xs">ระดับ ' +
          escapeHtml(c.level) +
          '</span>' +
          '<span class="text-xs text-[#787774]">• ประเภท' +
          escapeHtml(c.team_type) +
          ' (นักเรียน ' +
          escapeHtml(stuRule) +
          ')</span>' +
          '</div>' +
          '<h3 class="text-base font-bold font-heading text-[#37352F]">' +
          escapeHtml(c.comp_name) +
          '</h3>' +
          '</div>' +
          '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
          badgeHtml +
          printCheckinBtnHtml +
          '<button type="button" data-quick-register="' +
          escapeHtml(c.comp_id) +
          '" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#37352F] hover:bg-slate-800 text-white font-heading text-xs font-medium transition">' +
          ICONS.plus +
          '<span>สมัครรายการนี้</span>' +
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
        requestEditRegistration(btn.getAttribute('data-comp-edit-reg'));
      });
    });

    container.querySelectorAll('[data-print-checkin]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        printCompetitionCheckinSheet(btn.getAttribute('data-print-checkin'));
      });
    });
  }

  // Print Competition Check-in Sheet (ใบลงทะเบียนหน้าห้องแข่งขัน)
  function printCompetitionCheckinSheet(compId) {
    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) return;
    const regs = state.registrations.filter((r) => r.comp_id === compId);

    const rowsHtml = regs
      .map(function (r, idx) {
        const stuList = (r.students || [])
          .map((s, i) => i + 1 + '. ' + escapeHtml(s.prefix + s.name) + ' (' + escapeHtml(s.grade) + ')')
          .join('<br/>');
        const tchList = (r.teachers || [])
          .map((t, i) => i + 1 + '. ' + escapeHtml(t.prefix + t.name))
          .join('<br/>');
        return (
          '<tr>' +
          '<td style="border:1px solid #333;padding:8px;text-align:center;">' +
          (idx + 1) +
          '</td>' +
          '<td style="border:1px solid #333;padding:8px;font-weight:600;">' +
          escapeHtml(r.school_name) +
          '</td>' +
          '<td style="border:1px solid #333;padding:8px;">' +
          stuList +
          '</td>' +
          '<td style="border:1px solid #333;padding:8px;">' +
          tchList +
          '</td>' +
          '<td style="border:1px solid #333;padding:8px;"></td>' +
          '<td style="border:1px solid #333;padding:8px;"></td>' +
          '</tr>'
        );
      })
      .join('');

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      window.print();
      return;
    }
    w.document.write(
      '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ใบลงชื่อหน้าห้องแข่งขัน - ' +
        escapeHtml(comp.comp_id) +
        '</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">' +
        '<style>body{font-family:"Sarabun",sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}th{border:1px solid #333;padding:8px;background:#f3f3f1}</style></head><body>' +
        '<h2 style="margin:0 0 4px 0;">ใบลงทะเบียนผู้เข้าแข่งขัน งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569</h2>' +
        '<div style="font-size:15px;margin-bottom:4px;"><strong>กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง (สพป.มหาสารคาม เขต 3)</strong></div>' +
        '<div style="font-size:15px;margin-bottom:12px;">รหัสรายการ: <strong>' +
        escapeHtml(comp.comp_id) +
        '</strong> • รายการ: <strong>' +
        escapeHtml(comp.comp_name) +
        '</strong> • ระดับ: <strong>' +
        escapeHtml(comp.level) +
        '</strong> (' +
        escapeHtml(comp.learning_area) +
        ')</div>' +
        '<table><thead><tr><th style="width:45px">ลำดับ</th><th style="width:180px">โรงเรียน</th><th>รายชื่อนักเรียนผู้เข้าแข่งขัน</th><th>ครูผู้ฝึกซ้อม</th><th style="width:130px">ลายมือชื่อรายงานตัว</th><th style="width:90px">หมายเหตุ</th></tr></thead><tbody>' +
        rowsHtml +
        '</tbody></table>' +
        '<script>window.onload=function(){window.print();}</script></body></html>'
    );
    w.document.close();
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
        'หมวดกิจกรรม/กลุ่มสาระฯ',
        'ชื่อรายการแข่งขัน',
        'ระดับช่วงชั้น',
        'ประเภท',
        'จำนวนนักเรียน',
        'รายชื่อนักเรียนผู้เข้าแข่งขัน',
        'จำนวนครูผู้ฝึกซ้อม',
        'รายชื่อครูผู้ฝึกซ้อม',
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
        r.status || 'ลงทะเบียนแล้ว'
      ]);
    });

    const suffix = filterSchoolName ? '_' + filterSchoolName : '_ทั้งหมด';
    downloadCsvFile('ศิลปหัตถกรรมครั้งที่74_วังยาวเขวาไร่ดอนกลาง' + suffix + '.csv', rows);
    showToast('ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว', 'success');
  }

  // Admin Tool: Export 1-Person-Per-Row CSV for Canva / Word Certificate Mail Merge
  function exportCertificateMailMergeCsv() {
    if (!state.isAdmin) {
      showToast('เฉพาะแอดมินเท่านั้นที่สามารถส่งออกไฟล์ทำเกียรติบัตรได้', 'error');
      return;
    }

    const rows = [
      [
        'ลำดับ',
        'ประเภทผู้รับเกียรติบัตร',
        'คำนำหน้า',
        'ชื่อ-นามสกุล',
        'ชื่อเต็มสำหรับพิมพ์เกียรติบัตร',
        'ชั้นเรียน/ตำแหน่ง',
        'โรงเรียน',
        'รหัสรายการ',
        'หมวดกิจกรรม',
        'ชื่อรายการแข่งขัน',
        'ระดับช่วงชั้น',
        'ประเภทการแข่งขัน',
        'รหัสใบสมัคร'
      ]
    ];

    let seq = 1;
    state.registrations.forEach(function (r) {
      (r.students || []).forEach(function (s) {
        rows.push([
          seq++,
          'นักเรียนผู้เข้าแข่งขัน',
          s.prefix || '',
          s.name || '',
          (s.prefix || '') + (s.name || ''),
          s.grade || '',
          r.school_name,
          r.comp_id,
          r.learning_area,
          r.comp_name,
          r.level,
          r.team_type,
          r.reg_id
        ]);
      });

      (r.teachers || []).forEach(function (t) {
        rows.push([
          seq++,
          'ครูผู้ฝึกซ้อม',
          t.prefix || '',
          t.name || '',
          (t.prefix || '') + (t.name || ''),
          'ครูผู้ฝึกซ้อม',
          r.school_name,
          r.comp_id,
          r.learning_area,
          r.comp_name,
          r.level,
          r.team_type,
          r.reg_id
        ]);
      });
    });

    downloadCsvFile('สำหรับทำเกียรติบัตร_1คน1แถว_ศิลปหัตถกรรม74_วังยาวเขวาไร่ดอนกลาง.csv', rows);
    showToast('ดาวน์โหลดไฟล์ CSV สำหรับทำเกียรติบัตร (1 คน 1 แถว) เรียบร้อยแล้ว', 'success');
  }

  function renderAll() {
    updateAdminAndStatusUI();
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

    // Admin Login / Logout Toggle
    const btnAdminToggle = document.getElementById('btnAdminToggle');
    if (btnAdminToggle) {
      btnAdminToggle.addEventListener('click', function () {
        if (state.isAdmin) {
          state.isAdmin = false;
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          if (state.activeTab === 'settings') {
            switchTab('dashboard');
          } else {
            renderAll();
          }
          showToast('ออกจากโหมดแอดมินเรียบร้อยแล้ว', 'warning');
        } else {
          openAdminModal();
        }
      });
    }

    const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
    const btnCancelAdminModal = document.getElementById('btnCancelAdminModal');
    if (btnCloseAdminModal) btnCloseAdminModal.addEventListener('click', closeAdminModal);
    if (btnCancelAdminModal) btnCancelAdminModal.addEventListener('click', closeAdminModal);

    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const pin = (document.getElementById('adminPinInput').value || '').trim();
        if (!pin) return;

        // Verify with Google Sheets if connected, otherwise verify against state.adminPin
        if (state.gasWebAppUrl) {
          const remoteCheck = await postToGoogleSheets({
            action: 'verify_admin',
            admin_pin: pin
          });
          if (remoteCheck && remoteCheck.ok) {
            state.isAdmin = true;
            state.adminPin = pin;
            sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
            closeAdminModal();
            renderAll();
            showToast('เข้าสู่โหมดแอดมินสำเร็จ', 'success');
            return;
          }
        }

        if (pin === state.adminPin) {
          state.isAdmin = true;
          sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
          closeAdminModal();
          renderAll();
          showToast('เข้าสู่โหมดแอดมินสำเร็จ', 'success');
        } else {
          showToast('รหัสแอดมินไม่ถูกต้อง', 'error');
        }
      });
    }

    // Teacher Self-Service Edit Verification Modal
    const btnCloseEditVerify = document.getElementById('btnCloseEditVerifyModal');
    const btnCancelEditVerify = document.getElementById('btnCancelEditVerifyModal');
    if (btnCloseEditVerify) btnCloseEditVerify.addEventListener('click', closeEditVerifyModal);
    if (btnCancelEditVerify) btnCancelEditVerify.addEventListener('click', closeEditVerifyModal);

    const editVerifyForm = document.getElementById('editVerifyForm');
    if (editVerifyForm) {
      editVerifyForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const regId = (document.getElementById('editVerifyRegId').value || '').trim();
        const token = (document.getElementById('editVerifyTokenInput').value || '').trim();
        const reg = state.registrations.find((r) => r.reg_id === regId);
        if (!reg) {
          closeEditVerifyModal();
          return;
        }

        if (verifyPhoneMatchClient(reg.coordinator_phone, token)) {
          closeEditVerifyModal();
          loadRegistrationIntoForm(regId, token);
        } else {
          showToast('เบอร์โทรศัพท์ผู้ประสานงาน (หรือรหัสแอดมิน) ไม่ตรงกับข้อมูลที่ลงทะเบียนไว้', 'error');
        }
      });
    }

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

    const btnClearSamplesAdmin = document.getElementById('btnClearSamplesAdmin');
    if (btnClearSamplesAdmin) {
      btnClearSamplesAdmin.addEventListener('click', clearSampleData);
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
          requestEditRegistration(existing.reg_id);
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
        document.getElementById('formEditVerifyToken').value = '';
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

    // Tab 5: Admin Tools & Settings
    const btnToggleRegOpen = document.getElementById('btnToggleRegistrationOpen');
    if (btnToggleRegOpen) {
      btnToggleRegOpen.addEventListener('click', async function () {
        if (!state.isAdmin) return;
        state.registrationOpen = !state.registrationOpen;
        localStorage.setItem(REG_OPEN_KEY, String(state.registrationOpen));
        await postToGoogleSheets({
          action: 'set_registration_open',
          registration_open: state.registrationOpen,
          admin_pin: state.adminPin
        });
        renderAll();
        showToast(
          state.registrationOpen
            ? 'เปิดระบบรับสมัครเรียบร้อยแล้ว'
            : 'ปิดระบบรับสมัครชั่วคราวแล้ว',
          state.registrationOpen ? 'success' : 'warning'
        );
      });
    }

    const btnExportCertCsv = document.getElementById('btnExportCertCsv');
    if (btnExportCertCsv) {
      btnExportCertCsv.addEventListener('click', exportCertificateMailMergeCsv);
    }

    const changeAdminPinForm = document.getElementById('changeAdminPinForm');
    if (changeAdminPinForm) {
      changeAdminPinForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!state.isAdmin) return;
        const newPin = (document.getElementById('newAdminPinInput').value || '').trim();
        if (newPin.length < 4) {
          showToast('รหัสแอดมินต้องมีอย่างน้อย 4 ตัวอักษร', 'error');
          return;
        }
        const oldPin = state.adminPin;
        state.adminPin = newPin;
        localStorage.setItem(ADMIN_PIN_KEY, newPin);
        await postToGoogleSheets({
          action: 'set_admin_pin',
          admin_pin: oldPin,
          new_pin: newPin
        });
        changeAdminPinForm.reset();
        showToast('เปลี่ยนรหัสแอดมินใหม่เรียบร้อยแล้ว', 'success');
      });
    }

    const btnSaveGasUrl = document.getElementById('btnSaveGasUrl');
    if (btnSaveGasUrl) {
      btnSaveGasUrl.addEventListener('click', function () {
        const val = (document.getElementById('gasWebAppUrlInput').value || '').trim();
        state.gasWebAppUrl = val;
        localStorage.setItem(GAS_URL_KEY, val);
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
        const ok = window.confirm(
          'ต้องการรีเซ็ตข้อมูลในเบราว์เซอร์กลับเป็นค่าเริ่มต้นของระบบใช่หรือไม่?'
        );
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
        if (!state.isAdmin) return;
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
        await postToGoogleSheets({
          action: 'add_competition',
          competition: newComp,
          admin_pin: state.adminPin
        });
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
        if (!state.isAdmin) return;
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
        await postToGoogleSheets({
          action: 'add_school',
          school: newSch,
          admin_pin: state.adminPin
        });
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
