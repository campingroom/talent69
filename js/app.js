(function () {
  'use strict';

  const STORAGE_KEY = 'talent69_wangyao_state_v4';
  const GAS_URL_KEY = 'talent69_wangyao_gas_url_v1';
  const ADMIN_PIN_KEY = 'talent69_wangyao_admin_pin_v1';
  const ADMIN_SESSION_KEY = 'talent69_wangyao_admin_session_v1';
  const REG_OPEN_KEY = 'talent69_wangyao_reg_open_v1';
  const DEFAULT_ADMIN_PIN = '7469';
  const ENABLE_PHASE_2 = false;
  // กำหนดการสำคัญสำหรับระบบนับถอยหลังและ Auto-Lock
  const REGISTRATION_CLOSE_DATE = '2026-11-19T23:59:59+07:00';
  const COMPETITION_START_DATE = '2026-11-24T08:30:00+07:00';
  const DEFAULT_GAS_WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbxMnn_WoMLx83wa--6WcYMgBEmR1sqoxyKST1RxLaxFEHaEWjjuBQB1j47vd4U83eCqoQ/exec';

  const DEFAULT_CONFIG = {
    regCloseDate: '2026-11-19T23:59',
    districtRepCriteria: 'rank_1', // 'rank_1', 'rank_1_2', 'rank_1_3', 'gold_only'
    certPrefix: 'WYK74-2569-',
    certSignerName: 'นายกิจภูมิ บุญอบ',
    certSignerPos: 'ประธานกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง',
    certSignerOrg: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3',
    certIssueDate: '25 พฤศจิกายน พุทธศักราช 2569',
    certSignatureUrl: '',
    certBgMode: 'standard', // 'standard' or 'canva'
    certBgImageUrl: '',
    featureVisibility: {
      judges: 'auto',
      results: 'auto',
      certificates: 'auto'
    }
  };

  const FEATURE_MILESTONES = {
    judges: {
      key: 'judges',
      name: 'คณะกรรมการตัดสิน',
      openDateStr: '2026-11-23T00:00:00+07:00',
      dateLabel: '23 พฤศจิกายน 2569 (วันประชุมคณะกรรมการตัดสิน)'
    },
    results: {
      key: 'results',
      name: 'ผลการแข่งขันและเหรียญรางวัล',
      openDateStr: '2026-11-24T00:00:00+07:00',
      dateLabel: '24 พฤศจิกายน 2569 (วันแข่งขันระดับกลุ่มโรงเรียน)'
    },
    certificates: {
      key: 'certificates',
      name: 'เกียรติบัตรออนไลน์',
      openDateStr: '2026-11-25T00:00:00+07:00',
      dateLabel: '25 พฤศจิกายน 2569 (วันสรุปผลการแข่งขัน)'
    }
  };

  function getFeatureVisibilitySetting(featureKey) {
    const cfg = state.config || DEFAULT_CONFIG;
    if (cfg.featureVisibility && cfg.featureVisibility[featureKey]) {
      return cfg.featureVisibility[featureKey];
    }
    return 'auto';
  }

  function isFeatureOpenToPublic(featureKey) {
    const setting = getFeatureVisibilitySetting(featureKey);
    if (setting === 'open') return true;
    if (setting === 'hidden') return false;
    const meta = FEATURE_MILESTONES[featureKey];
    if (!meta) return false;
    return Date.now() >= new Date(meta.openDateStr).getTime();
  }

  function canUserAccessFeature(featureKey) {
    if (state.isAdmin) return true;
    return isFeatureOpenToPublic(featureKey);
  }

  function getDistrictRepCriteriaLabel(criteria) {
    switch (criteria) {
      case 'rank_1_2':
        return 'อันดับ 1 และ อันดับ 2 (ชนะเลิศ และ รองชนะเลิศอันดับ 1)';
      case 'rank_1_3':
        return 'อันดับ 1 ถึง อันดับ 3 (ชนะเลิศ และ รองชนะเลิศอันดับ 1–2)';
      case 'gold_only':
        return 'เฉพาะทีมที่ได้เหรียญทอง อันดับ 1';
      case 'rank_1':
      default:
        return 'เฉพาะทีมชนะเลิศ (อันดับ 1)';
    }
  }

  function isDistrictRepresentative(r) {
    if (!r) return false;
    const rank = Number(r.rank);
    const award = r.award_title || '';
    const medal = r.medal || '';
    const criteria = (state.config && state.config.districtRepCriteria) || 'rank_1';

    if (criteria === 'rank_1_2') {
      return (rank >= 1 && rank <= 2) || award.includes('ชนะเลิศ');
    }
    if (criteria === 'rank_1_3') {
      return (rank >= 1 && rank <= 3) || award.includes('ชนะเลิศ');
    }
    if (criteria === 'gold_only') {
      return (rank === 1 || award === 'ชนะเลิศ') && medal.includes('ทอง');
    }
    return rank === 1 || award === 'ชนะเลิศ';
  }

  const DEFAULT_DATA = window.TALENT69_DEFAULT_DATA || {
    eventInfo: {},
    schools: [],
    competitions: [],
    sampleRegistrations: [],
    sampleJudges: [],
    operationTimeline: []
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
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.65"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>',
    calendar:
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.65"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
    award:
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.65"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>',
    table:
      '<svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.65"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>'
  };

  let state = {
    schools: [],
    competitions: [],
    registrations: [],
    judges: [],
    activeTab: 'dashboard',
    compStatusFilter: 'ALL',
    resultSubview: 'by-comp',
    lastAddedRegId: null,
    gasWebAppUrl: '',
    isAdmin: false,
    adminPin: DEFAULT_ADMIN_PIN,
    registrationOpen: true,
    config: Object.assign({}, DEFAULT_CONFIG)
  };

  function getEffectiveRegistrationCloseDate() {
    const raw = (state.config && state.config.regCloseDate) || '2026-11-19T23:59';
    if (raw.length === 16) {
      return new Date(raw + ':59+07:00');
    }
    return new Date(raw);
  }

  function calculateMedalFromScore(scoreVal) {
    if (scoreVal === '' || scoreVal === null || scoreVal === undefined) return '';
    const num = Number(scoreVal);
    if (isNaN(num) || num < 0) return '';
    if (num >= 80) return 'เหรียญทอง';
    if (num >= 70) return 'เหรียญเงิน';
    if (num >= 60) return 'เหรียญทองแดง';
    return 'เข้าร่วม';
  }

  function getAwardTitleFromRank(rankVal, scoreOrMedal) {
    if (scoreOrMedal === '' || scoreOrMedal === null || scoreOrMedal === undefined) {
      return '';
    }
    const r = Number(rankVal);
    if (r === 1) return 'ชนะเลิศ';
    if (r === 2) return 'รองชนะเลิศอันดับ 1';
    if (r === 3) return 'รองชนะเลิศอันดับ 2';
    return 'เข้าร่วมการแข่งขัน';
  }

  function renderMedalBadgeHtml(medal) {
    if (!medal) return '<span class="text-xs text-slate-400">รอผล</span>';
    if (medal.indexOf('ทองแดง') !== -1) {
      return '<span class="inline-block px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-800 font-heading font-semibold text-xs">' + escapeHtml(medal) + '</span>';
    }
    if (medal.indexOf('ทอง') !== -1) {
      return '<span class="inline-block px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-heading font-semibold text-xs">' + escapeHtml(medal) + '</span>';
    }
    if (medal.indexOf('เงิน') !== -1) {
      return '<span class="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 font-heading font-semibold text-xs">' + escapeHtml(medal) + '</span>';
    }
    return '<span class="inline-block px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600 font-heading text-xs">' + escapeHtml(medal) + '</span>';
  }

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

  // Prefix Normalization Helpers
  // แปลงคำนำหน้าชื่อเป็นคำเต็มทางการ สำหรับงานพิมพ์ เกียรติบัตร บัตรประจำตัว และหน้าจอขนาดปกติ
  function toFullPrefix(prefix) {
    if (!prefix) return '';
    const p = String(prefix).trim();
    if (/^(ด\.ช\.|ด\.ช|ดช\.|ดช|เด็กชาย)$/.test(p)) return 'เด็กชาย';
    if (/^(ด\.ญ\.|ด\.ญ|ดญ\.|ดญ|เด็กหญิง)$/.test(p)) return 'เด็กหญิง';
    if (/^(น\.ส\.|น\.ส|นส\.|นส|นางสาว)$/.test(p)) return 'นางสาว';
    if (/^(นาย)$/.test(p)) return 'นาย';
    if (/^(นาง)$/.test(p)) return 'นาง';
    return p;
  }

  // แปลงคำนำหน้าชื่อเป็นตัวย่อ สำหรับหน้าจอมือถือ/จอแคบ เพื่อไม่ให้คอลัมน์ตารางโดนบีบ
  function toShortPrefix(prefix) {
    if (!prefix) return '';
    const p = String(prefix).trim();
    if (/^(เด็กชาย|ด\.ช\.|ด\.ช|ดช\.|ดช)$/.test(p)) return 'ด.ช.';
    if (/^(เด็กหญิง|ด\.ญ\.|ด\.ญ|ดญ\.|ดญ)$/.test(p)) return 'ด.ญ.';
    if (/^(นางสาว|น\.ส\.|น\.ส|นส\.|นส)$/.test(p)) return 'น.ส.';
    if (/^(นาย)$/.test(p)) return 'นาย';
    if (/^(นาง)$/.test(p)) return 'นาง';
    return p;
  }

  // แยกคำนำหน้าออกจากชื่อ กรณีชื่อมีการใส่คำนำหน้าติดมาด้วย
  function parsePrefixAndName(rawPrefix, rawName) {
    let p = (rawPrefix || '').trim();
    let n = (rawName || '').trim();
    const prefixRegex = /^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|ด\.ช\.|ด\.ช|ด\.ญ\.|ด\.ญ|น\.ส\.|น\.ส)\s*/;
    if (!p && n) {
      const m = n.match(prefixRegex);
      if (m) {
        p = m[1];
        n = n.substring(m[0].length).trim();
      }
    } else if (p && n) {
      // ถ้า p มีอยู่แล้ว แต่ใน n ยังพิมพ์คำนำหน้าซ้ำมาด้วย
      const m = n.match(prefixRegex);
      if (m) {
        n = n.substring(m[0].length).trim();
      } else if (n.indexOf(p) === 0) {
        n = n.substring(p.length).trim();
      }
    }
    return { prefix: p, name: n };
  }

  // คืนค่าชื่อเต็มทางการสำหรับงานพิมพ์ (เกียรติบัตร, บัตรประจำตัว, เอกสารราชการ)
  function formatFullNameForPrint(rawPrefix, rawName) {
    const parsed = parsePrefixAndName(rawPrefix, rawName);
    const fullP = toFullPrefix(parsed.prefix);
    if (!fullP) return parsed.name;
    return fullP + parsed.name;
  }

  // คืนค่า HTML แสดงชื่อแบบ Responsive: จอมือถือ/จอแคบ (< 640px) แสดงตัวย่อ, จอคอม/แท็บเล็ต (>= 640px) แสดงคำเต็ม
  function formatResponsiveNameHtml(rawPrefix, rawName, grade) {
    const parsed = parsePrefixAndName(rawPrefix, rawName);
    const fullP = toFullPrefix(parsed.prefix);
    const shortP = toShortPrefix(parsed.prefix);
    const cleanN = escapeHtml(parsed.name);
    const gradeHtml = grade ? ' <span class="text-slate-400 font-normal">(' + escapeHtml(grade) + ')</span>' : '';

    if (!fullP && !shortP) {
      return cleanN + gradeHtml;
    }

    if (fullP === shortP) {
      return escapeHtml(fullP) + cleanN + gradeHtml;
    }

    return (
      '<span class="inline sm:hidden">' +
      escapeHtml(shortP) +
      cleanN +
      '</span>' +
      '<span class="hidden sm:inline">' +
      escapeHtml(fullP) +
      cleanN +
      '</span>' +
      gradeHtml
    );
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
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      const map = {};
      parts.forEach((p) => {
        map[p.type] = p.value;
      });
      return (
        map.year +
        '-' +
        map.month +
        '-' +
        map.day +
        ' ' +
        map.hour +
        ':' +
        map.minute +
        ':' +
        map.second
      );
    } catch (e) {
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
  }

  function formatDisplayTimestamp(ts) {
    const str = String(ts || '').trim();
    if (!str) return '-';

    // 1. If it's a GAS-generated Date string with GMT+0700 (e.g. "Thu Nov 12 2026 22:34:10 GMT+0700 (เวลาอินโดจีน)")
    // Google Sheets parsed the Bangkok local time string as UTC, so the Date object's UTC fields contain the TRUE Bangkok time!
    if (/GMT\+07/i.test(str)) {
      const cleanStr = str.replace(/\s*\([^)]*\)/g, '');
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        return (
          d.getUTCFullYear() +
          '-' +
          pad(d.getUTCMonth() + 1) +
          '-' +
          pad(d.getUTCDate()) +
          ' ' +
          pad(d.getUTCHours()) +
          ':' +
          pad(d.getUTCMinutes()) +
          ':' +
          pad(d.getUTCSeconds())
        );
      }
    }

    // 2. If already in standard YYYY-MM-DD HH:mm:ss (or YYYY-MM-DDTHH:mm:ss)
    if (/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}(:\d{2})?/.test(str)) {
      return str.replace('T', ' ').slice(0, 19);
    }

    // 3. Fallback for other parseable date strings, format to Asia/Bangkok
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      try {
        const formatter = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(parsed);
        const map = {};
        parts.forEach((p) => {
          map[p.type] = p.value;
        });
        return (
          map.year +
          '-' +
          map.month +
          '-' +
          map.day +
          ' ' +
          map.hour +
          ':' +
          map.minute +
          ':' +
          map.second
        );
      } catch (e) {
        const pad = (n) => String(n).padStart(2, '0');
        return (
          parsed.getFullYear() +
          '-' +
          pad(parsed.getMonth() + 1) +
          '-' +
          pad(parsed.getDate()) +
          ' ' +
          pad(parsed.getHours()) +
          ':' +
          pad(parsed.getMinutes()) +
          ':' +
          pad(parsed.getSeconds())
        );
      }
    }
    return str;
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

  function normalizeSchoolsList(schools) {
    if (!Array.isArray(schools)) return [];
    return schools.map(function (s) {
      if (!s) return s;
      const copy = Object.assign({}, s);
      if (copy.school_id === 'SCH-13' || copy.school_name === 'โรงเรียนหินแห่เสริมศิลป์') {
        copy.subdistrict = 'ต.วังยาว';
      }
      return copy;
    });
  }

  // Load state from localStorage or initialize from mock-data.js
  function loadState() {
    state.gasWebAppUrl = localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_WEB_APP_URL;
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
          ? parsed.registrations.map(function (r) {
              return Object.assign({}, r, {
                timestamp: formatDisplayTimestamp(r.timestamp)
              });
            })
          : cloneDeep(DEFAULT_DATA.sampleRegistrations);
        state.judges = Array.isArray(parsed.judges)
          ? parsed.judges
          : cloneDeep(DEFAULT_DATA.sampleJudges || []);
        state.config = Object.assign({}, DEFAULT_CONFIG, parsed.config || {});
        if (!state.config.featureVisibility) {
          state.config.featureVisibility = Object.assign({}, DEFAULT_CONFIG.featureVisibility);
        } else {
          state.config.featureVisibility = Object.assign({}, DEFAULT_CONFIG.featureVisibility, state.config.featureVisibility);
        }
        // Auto-migrate school SCH-13 subdistrict and default signer name if outdated
        state.schools = normalizeSchoolsList(state.schools);
        if (!state.config.certSignerName || state.config.certSignerName === 'นายวิทยา มโนการณ์') {
          state.config.certSignerName = 'นายกิจภูมิ บุญอบ';
        }
        return;
      } catch (e) {
        // Fallback to default data
      }
    }
    state.schools = cloneDeep(DEFAULT_DATA.schools);
    state.competitions = cloneDeep(DEFAULT_DATA.competitions);
    state.registrations = cloneDeep(DEFAULT_DATA.sampleRegistrations);
    state.judges = cloneDeep(DEFAULT_DATA.sampleJudges || []);
    state.config = Object.assign({}, DEFAULT_CONFIG);
    saveState();
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schools: state.schools,
        competitions: state.competitions,
        registrations: state.registrations,
        judges: state.judges,
        config: state.config
      })
    );
  }

  function isRegistrationEffectivelyOpen() {
    if (!state.registrationOpen) return false;
    const closeTime = getEffectiveRegistrationCloseDate().getTime();
    if (!state.isAdmin && !isNaN(closeTime) && Date.now() > closeTime) {
      return false;
    }
    return true;
  }

  function updateAdminAndStatusUI() {
    // 1. Registration Open/Closed Pill & Form Banner
    const badge = document.getElementById('regOpenStatusBadge');
    const dot = document.getElementById('regOpenStatusDot');
    const text = document.getElementById('regOpenStatusText');
    const closedBanner = document.getElementById('registrationClosedBanner');
    const toggleBtn = document.getElementById('btnToggleRegistrationOpen');

    const effectivelyOpen = isRegistrationEffectivelyOpen();
    const closeDateObj = getEffectiveRegistrationCloseDate();
    const closeTime = closeDateObj.getTime();
    const isAutoLocked =
      state.registrationOpen &&
      !state.isAdmin &&
      !isNaN(closeTime) &&
      Date.now() > closeTime;

    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const closeDateStr = closeDateObj.getDate() + ' ' + thaiMonths[closeDateObj.getMonth()] + ' ' + (closeDateObj.getFullYear() + 543) + ' เวลา ' + String(closeDateObj.getHours()).padStart(2, '0') + '.' + String(closeDateObj.getMinutes()).padStart(2, '0') + ' น.';

    if (badge && dot && text) {
      if (effectivelyOpen) {
        badge.className =
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EDF3EC] border border-[#D7E6D5] text-[#448361] text-xs font-heading font-medium';
        dot.className = 'w-2 h-2 rounded-full bg-[#448361]';
        text.textContent = 'เปิดรับสมัคร';
      } else {
        badge.className =
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDEBEC] border border-[#F5D0D2] text-[#D44C47] text-xs font-heading font-medium';
        dot.className = 'w-2 h-2 rounded-full bg-[#D44C47]';
        text.textContent = isAutoLocked
          ? 'ปิดรับสมัครตามกำหนดการ (' + closeDateObj.getDate() + ' ' + thaiMonths[closeDateObj.getMonth()] + ')'
          : 'ปิดรับสมัครแล้ว';
      }
    }

    if (closedBanner) {
      if (effectivelyOpen) {
        closedBanner.classList.add('hidden');
      } else {
        closedBanner.classList.remove('hidden');
        const closedText = closedBanner.querySelector('p');
        if (closedText && isAutoLocked) {
          closedText.textContent =
            'ขณะนี้ระบบปิดรับสมัครส่งรายชื่อตามกำหนดการแล้ว (สิ้นสุด ' + closeDateStr + ') อยู่ระหว่างสรุปรายชื่อผู้เข้าร่วมการแข่งขัน';
        }
      }
    }

    if (toggleBtn) {
      toggleBtn.textContent = state.registrationOpen
        ? 'ปิดรับสมัครชั่วคราว'
        : 'เปิดรับสมัครอีกครั้ง';
    }

    // Auto-Lock Schedule Card in Admin Settings
    const cfgScheduleBadge = document.getElementById('cfgScheduleBadge');
    const cfgScheduleStatusText = document.getElementById('cfgScheduleStatusText');
    const cfgDateTimeInput = document.getElementById('cfgRegCloseDateTimeInput');
    const btnToggleSchedule = document.getElementById('btnToggleRegistrationOpenSchedule');

    if (cfgDateTimeInput && document.activeElement !== cfgDateTimeInput) {
      cfgDateTimeInput.value = (state.config && state.config.regCloseDate) || '2026-11-19T23:59';
    }

    if (cfgScheduleBadge && cfgScheduleStatusText) {
      if (effectivelyOpen) {
        cfgScheduleBadge.className = 'px-2.5 py-1 rounded-md text-xs font-heading font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';
        cfgScheduleBadge.textContent = 'เปิดรับสมัคร';
        cfgScheduleStatusText.textContent = 'สถานะ: กำลังเปิดรับสมัคร (สิ้นสุด ' + closeDateStr + ')';
      } else {
        cfgScheduleBadge.className = 'px-2.5 py-1 rounded-md text-xs font-heading font-medium bg-rose-50 text-rose-700 border border-rose-200';
        cfgScheduleBadge.textContent = 'ปิดรับสมัครแล้ว';
        cfgScheduleStatusText.textContent = isAutoLocked
          ? 'สถานะ: ปิดรับสมัครตามกำหนดการแล้ว (' + closeDateStr + ')'
          : 'สถานะ: ปิดรับสมัครชั่วคราวโดยแอดมิน';
      }
    }

    if (btnToggleSchedule) {
      btnToggleSchedule.textContent = state.registrationOpen ? 'ปิดรับสมัครทันที' : 'เปิดรับสมัครอีกครั้ง';
    }

    updateCertConfigUI();

    // 2. Admin-only Controls Visibility
    const headerSheetLink = document.getElementById('headerSheetLink');
    const navTabSettings = document.getElementById('navTabSettings');
    const btnClearSamplesQuick = document.getElementById('btnClearSamplesQuick');
    const btnClearSamplesAdmin = document.getElementById('btnClearSamplesAdmin');
    const btnAdminToggle = document.getElementById('btnAdminToggle');
    const adminBtnText = document.getElementById('adminBtnText');
    const adminAddJudgeCard = document.getElementById('adminAddJudgeCard');

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

    // Dynamic Sample Button State (Smart Toggle: ล้างข้อมูลตัวอย่าง ⇄ สร้างข้อมูลตัวอย่างทดสอบ)
    const sampleCount = state.registrations.filter(
      (r) => String(r.status || '').indexOf('ตัวอย่าง') !== -1
    ).length;
    const hasSamples = sampleCount > 0;
    const sampleBtnLabel = hasSamples
      ? 'ล้างข้อมูลตัวอย่าง (' + sampleCount + ')'
      : 'สร้างข้อมูลตัวอย่างทดสอบ';
    const sampleBtnIcon = hasSamples ? ICONS.trash : ICONS.plus;
    const sampleBtnBaseCls =
      'items-center gap-1.5 px-3.5 py-2 rounded-lg font-heading text-xs font-medium transition ';
    const sampleBtnColorCls = hasSamples
      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
      : 'bg-[#EDF3EC] hover:bg-[#E2EDE0] text-[#448361] border border-[#D7E6D5]';

    if (btnClearSamplesQuick) {
      if (state.isAdmin) {
        btnClearSamplesQuick.className = 'inline-flex ' + sampleBtnBaseCls + sampleBtnColorCls;
        btnClearSamplesQuick.innerHTML = sampleBtnIcon + '<span>' + escapeHtml(sampleBtnLabel) + '</span>';
      } else {
        btnClearSamplesQuick.className = 'hidden ' + sampleBtnBaseCls + sampleBtnColorCls;
      }
    }

    if (btnClearSamplesAdmin) {
      btnClearSamplesAdmin.className = 'inline-flex ' + sampleBtnBaseCls + sampleBtnColorCls;
      btnClearSamplesAdmin.innerHTML = sampleBtnIcon + '<span>' + escapeHtml(sampleBtnLabel) + '</span>';
    }

    if (adminAddJudgeCard) {
      if (state.isAdmin) {
        adminAddJudgeCard.classList.remove('hidden');
      } else {
        adminAddJudgeCard.classList.add('hidden');
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
    updateFeatureVisibilityUI();
  }

  function updateCertConfigUI() {
    const cfg = state.config || DEFAULT_CONFIG;
    const prefixInput = document.getElementById('cfgCertPrefixInput');
    const issueDateInput = document.getElementById('cfgCertIssueDateInput');
    const signerNameInput = document.getElementById('cfgCertSignerNameInput');
    const signerPosInput = document.getElementById('cfgCertSignerPosInput');
    const signerOrgInput = document.getElementById('cfgCertSignerOrgInput');

    if (prefixInput && document.activeElement !== prefixInput) prefixInput.value = cfg.certPrefix || 'WYK74-2569-';
    if (issueDateInput && document.activeElement !== issueDateInput) issueDateInput.value = cfg.certIssueDate || '25 พฤศจิกายน พุทธศักราช 2569';
    if (signerNameInput && document.activeElement !== signerNameInput) signerNameInput.value = cfg.certSignerName || 'นายกิจภูมิ บุญอบ';
    if (signerPosInput && document.activeElement !== signerPosInput) signerPosInput.value = cfg.certSignerPos || 'ประธานกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง';
    if (signerOrgInput && document.activeElement !== signerOrgInput) signerOrgInput.value = cfg.certSignerOrg || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3';

    // Signature Preview
    const sigPreview = document.getElementById('cfgCertSigPreview');
    const btnClearSig = document.getElementById('btnClearCertSig');
    if (sigPreview) {
      if (cfg.certSignatureUrl) {
        sigPreview.innerHTML = '<img src="' + escapeHtml(cfg.certSignatureUrl) + '" class="max-h-10 max-w-full object-contain" alt="Signature" />';
        if (btnClearSig) btnClearSig.classList.remove('hidden');
      } else {
        sigPreview.innerHTML = '<span class="text-[10px] text-slate-400">ไม่มีลายเซ็น</span>';
        if (btnClearSig) btnClearSig.classList.add('hidden');
      }
    }

    // Canva Background Mode & Preview
    const rStandard = document.getElementById('certBgModeStandard');
    const rCanva = document.getElementById('certBgModeCanva');
    const bgUploadRow = document.getElementById('certBgUploadRow');
    const bgPreview = document.getElementById('cfgCertBgPreview');
    const btnClearBg = document.getElementById('btnClearCertBg');

    const isCanvaMode = cfg.certBgMode === 'canva';
    if (rStandard) rStandard.checked = !isCanvaMode;
    if (rCanva) rCanva.checked = isCanvaMode;

    if (bgUploadRow) {
      if (isCanvaMode) {
        bgUploadRow.classList.remove('hidden');
        bgUploadRow.classList.add('flex');
      } else {
        bgUploadRow.classList.add('hidden');
        bgUploadRow.classList.remove('flex');
      }
    }

    if (bgPreview) {
      if (cfg.certBgImageUrl) {
        bgPreview.innerHTML = '<img src="' + escapeHtml(cfg.certBgImageUrl) + '" class="max-h-14 max-w-full object-cover" alt="Canva BG" />';
        if (btnClearBg) btnClearBg.classList.remove('hidden');
      } else {
        bgPreview.innerHTML = '<span class="text-[10px] text-slate-400">ไม่มีรูปภาพ</span>';
        if (btnClearBg) btnClearBg.classList.add('hidden');
      }
    }

    // District Representatives Criteria in Admin
    const repCriteriaSelect = document.getElementById('cfgDistrictRepCriteriaSelect');
    if (repCriteriaSelect && document.activeElement !== repCriteriaSelect) {
      repCriteriaSelect.value = cfg.districtRepCriteria || 'rank_1';
    }
  }

  function updateFeatureVisibilityUI() {
    const keys = ['judges', 'results', 'certificates'];
    const idMap = {
      judges: {
        tabId: 'tab-judges',
        btnId: 'navTabJudges',
        badgeId: 'navBadgeJudges',
        bannerId: 'featureBannerJudges',
        lockedId: 'lockedNoticeJudges',
        badgeVisId: 'badgeVisibilityJudges'
      },
      results: {
        tabId: 'tab-results',
        btnId: 'navTabResults',
        badgeId: 'navBadgeResults',
        bannerId: 'featureBannerResults',
        lockedId: 'lockedNoticeResults',
        badgeVisId: 'badgeVisibilityResults'
      },
      certificates: {
        tabId: 'tab-certificates',
        btnId: 'navTabCerts',
        badgeId: 'navBadgeCerts',
        bannerId: 'featureBannerCerts',
        lockedId: 'lockedNoticeCerts',
        badgeVisId: 'badgeVisibilityCerts'
      }
    };

    let visibleBtnCount = 0;

    keys.forEach(function (key) {
      const isPublic = isFeatureOpenToPublic(key);
      const canAccess = canUserAccessFeature(key);
      const ids = idMap[key];
      const btn = document.getElementById(ids.btnId);
      const badge = document.getElementById(ids.badgeId);
      const banner = document.getElementById(ids.bannerId);
      const lockedEl = document.getElementById(ids.lockedId);
      const meta = FEATURE_MILESTONES[key];
      const setting = getFeatureVisibilitySetting(key);

      // 1. Sidebar Button Visibility
      if (btn) {
        if (canAccess) {
          btn.classList.remove('hidden');
          visibleBtnCount++;
          if (badge) {
            if (state.isAdmin && !isPublic) {
              badge.classList.remove('hidden');
              badge.textContent = 'แอดมิน';
            } else {
              badge.classList.add('hidden');
            }
          }
        } else {
          btn.classList.add('hidden');
          if (badge) badge.classList.add('hidden');
        }
      }

      // 2. Banner inside tab (when viewing as admin)
      if (banner) {
        if (state.isAdmin) {
          banner.classList.remove('hidden');
          if (isPublic) {
            banner.innerHTML =
              '<div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-emerald-900 mb-4 shadow-2xs">' +
                '<div class="flex items-center gap-2">' +
                  '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>' +
                  '<span class="font-heading font-semibold">สถานะการแสดงผล: เปิดให้คนทั่วไปเข้าชมแล้ว</span>' +
                  '<span class="text-emerald-700 text-[11px]">(' + (setting === 'open' ? 'แอดมินสั่งเปิดทันที' : 'ตามกำหนดการ') + ')</span>' +
                '</div>' +
                '<button type="button" data-banner-feature="' + key + '" data-action="auto" class="px-3 py-1 rounded-md bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-heading text-[11px] font-medium transition cursor-pointer shrink-0">' +
                  'ล็อกกลับตามกำหนดการเดิม' +
                '</button>' +
              '</div>';
          } else {
            banner.innerHTML =
              '<div class="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900 mb-4 shadow-2xs">' +
                '<div class="flex items-center gap-2">' +
                  '<span class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>' +
                  '<span class="font-heading font-semibold">สถานะการแสดงผล: มองเห็นเฉพาะแอดมิน</span>' +
                  '<span class="text-amber-700 text-[11px]">(คนทั่วไปจะเห็นอัตโนมัติ ' + meta.dateLabel + ')</span>' +
                '</div>' +
                '<button type="button" data-banner-feature="' + key + '" data-action="open" class="px-3.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-heading text-[11px] font-semibold transition shadow-2xs cursor-pointer shrink-0">' +
                  'เปิดให้คนทั่วไปดูทันที' +
                '</button>' +
              '</div>';
          }
          const bBtn = banner.querySelector('[data-banner-feature]');
          if (bBtn) {
            bBtn.addEventListener('click', function () {
              setFeatureVisibility(key, bBtn.getAttribute('data-action'));
            });
          }
        } else {
          banner.classList.add('hidden');
          banner.innerHTML = '';
        }
      }

      // 3. Tab children locking (for non-admin when feature is not yet public)
      const tabEl = document.getElementById(ids.tabId);
      if (tabEl) {
        Array.from(tabEl.children).forEach(function (child) {
          if (child.id === ids.bannerId || child.id === ids.lockedId) return;
          if (canAccess) {
            child.classList.remove('hidden-by-lock');
          } else {
            child.classList.add('hidden-by-lock');
          }
        });
      }

      // 4. Locked Notice inside Tab (when viewed by non-admin before unlock)
      if (lockedEl) {
        if (!state.isAdmin && !isPublic) {
          lockedEl.classList.remove('hidden');
          renderLockedNotice(key, lockedEl);
        } else {
          lockedEl.classList.add('hidden');
          lockedEl.innerHTML = '';
        }
      }

      // 5. Badges & Toggle Buttons in Settings
      const badgeVis = document.getElementById(ids.badgeVisId);
      if (badgeVis) {
        if (setting === 'open') {
          badgeVis.className = 'px-2 py-0.5 rounded text-[10px] font-heading font-semibold bg-emerald-100 text-emerald-800';
          badgeVis.textContent = 'เปิดทันที (สาธารณะ)';
        } else if (setting === 'hidden') {
          badgeVis.className = 'px-2 py-0.5 rounded text-[10px] font-heading font-semibold bg-rose-100 text-rose-800';
          badgeVis.textContent = 'ซ่อนเฉพาะแอดมิน';
        } else {
          if (isPublic) {
            badgeVis.className = 'px-2 py-0.5 rounded text-[10px] font-heading font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
            badgeVis.textContent = 'เปิดตามกำหนดการแล้ว';
          } else {
            badgeVis.className = 'px-2 py-0.5 rounded text-[10px] font-heading font-semibold bg-slate-200 text-slate-700';
            badgeVis.textContent = 'ตามกำหนดการ (รอเปิด)';
          }
        }
      }

      document.querySelectorAll('[data-feature-toggle="' + key + '"]').forEach(function (b) {
        const action = b.getAttribute('data-action');
        if (action === setting) {
          b.className = 'px-3 py-1.5 rounded-lg font-heading text-xs font-semibold bg-slate-900 text-white border border-slate-900 transition cursor-pointer';
        } else {
          b.className = 'px-3 py-1.5 rounded-lg font-heading text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer';
        }
      });
    });

    // 6. Sidebar Group Header (Hide if no buttons visible)
    const sbGroup = document.getElementById('sidebarGroupPhase2');
    if (sbGroup) {
      if (visibleBtnCount > 0) {
        sbGroup.classList.remove('hidden');
      } else {
        sbGroup.classList.add('hidden');
      }
    }

    // 7. Dashboard Announcement Card
    const dashRow = document.getElementById('phase2DashboardHighlightRow');
    if (dashRow) {
      const showDash = isFeatureOpenToPublic('results') || state.isAdmin;
      if (showDash) {
        dashRow.classList.remove('hidden');
      } else {
        dashRow.classList.add('hidden');
      }
    }
  }

  function renderLockedNotice(featureKey, containerEl) {
    if (!containerEl) return;
    const meta = FEATURE_MILESTONES[featureKey];
    containerEl.className = 'bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto my-8 space-y-4 shadow-sm';
    containerEl.innerHTML =
      '<div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">' +
        '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />' +
        '</svg>' +
      '</div>' +
      '<div class="space-y-1.5">' +
        '<h3 class="text-base font-bold font-heading text-slate-900">ยังไม่ถึงกำหนดเปิดให้บริการ</h3>' +
        '<p class="text-xs text-slate-600">ระบบ' + escapeHtml(meta.name) + ' มีกำหนดเปิดให้เข้าชมในวันที่</p>' +
        '<div class="font-heading font-semibold text-amber-800 bg-amber-50 border border-amber-200 py-1.5 px-3 rounded-lg inline-block text-xs">' +
          escapeHtml(meta.dateLabel) +
        '</div>' +
      '</div>' +
      '<div class="pt-1 text-xs text-slate-500">' +
        'หากท่านเป็นคณะกรรมการหรือผู้ดูแลระบบ กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูล' +
      '</div>' +
      '<div>' +
        '<button type="button" class="btn-goto-admin px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-medium transition cursor-pointer">' +
          'เข้าสู่ระบบแอดมิน' +
        '</button>' +
      '</div>';

    const btn = containerEl.querySelector('.btn-goto-admin');
    if (btn) {
      btn.addEventListener('click', openAdminModal);
    }
  }

  function setFeatureVisibility(featureKey, action) {
    if (!state.config) state.config = Object.assign({}, DEFAULT_CONFIG);
    if (!state.config.featureVisibility) {
      state.config.featureVisibility = Object.assign({}, DEFAULT_CONFIG.featureVisibility);
    }
    state.config.featureVisibility[featureKey] = action;
    saveState();
    updateFeatureVisibilityUI();
    const meta = FEATURE_MILESTONES[featureKey];
    const label = action === 'open' ? 'เปิดให้คนทั่วไปดูทันทีแล้ว' : action === 'hidden' ? 'ซ่อนเฉพาะแอดมินแล้ว' : 'ตั้งค่าตามกำหนดการแข่งขันแล้ว';
    showToast(`${meta.name}: ${label}`, 'success');
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
        if (Array.isArray(data.schools) && data.schools.length) {
          state.schools = normalizeSchoolsList(data.schools);
        }
        if (Array.isArray(data.competitions) && data.competitions.length) {
          state.competitions = data.competitions;
        }
        if (Array.isArray(data.registrations)) {
          state.registrations = data.registrations.map(function (r) {
            return Object.assign({}, r, {
              timestamp: formatDisplayTimestamp(r.timestamp)
            });
          });
        }
        if (Array.isArray(data.judges)) state.judges = data.judges;
        const regOpenFlag =
          data.config && typeof data.config.registrationOpen === 'boolean'
            ? data.config.registrationOpen
            : typeof data.registrationOpen === 'boolean'
            ? data.registrationOpen
            : null;
        if (regOpenFlag !== null) {
          state.registrationOpen = regOpenFlag;
          localStorage.setItem(REG_OPEN_KEY, String(regOpenFlag));
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

  // Navigation Tabs & Sidebar Handlers (Notion Style)
  const TAB_TITLES = {
    dashboard: 'แดชบอร์ดภาพรวม',
    register: 'ลงทะเบียนเข้าแข่งขัน',
    school: 'ข้อมูลรายโรงเรียน',
    competition: 'ดูรายการแข่งขัน (149)',
    judges: 'กรรมการตัดสิน',
    results: 'ผลการแข่งขัน / เหรียญ',
    certificates: 'เกียรติบัตรออนไลน์',
    settings: 'จัดการระบบ (แอดมิน)'
  };

  function openMobileSidebar() {
    const sb = document.getElementById('notionSidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (sb) sb.classList.remove('-translate-x-full');
    if (bd) bd.classList.remove('hidden');
  }

  function closeMobileSidebar() {
    const sb = document.getElementById('notionSidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (sb) sb.classList.add('-translate-x-full');
    if (bd) bd.classList.add('hidden');
  }

  function toggleDesktopSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    const isCol = document.body.classList.contains('sidebar-collapsed');
    try {
      localStorage.setItem('talent69_sidebar_collapsed', isCol ? 'true' : 'false');
    } catch (e) {}
  }

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

    const titleEl = document.getElementById('topbarActiveTabTitle');
    if (titleEl && TAB_TITLES[tabName]) {
      titleEl.textContent = TAB_TITLES[tabName];
    }

    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }

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

    ['judgeSchoolFilter', 'certSchoolFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const prev = el.value || 'ALL';
      let html = '<option value="ALL">-- ทุกโรงเรียน --</option>';
      state.schools.forEach(function (s) {
        html += '<option value="' + escapeHtml(s.school_name) + '">' + escapeHtml(s.school_name) + '</option>';
      });
      el.innerHTML = html;
      if (prev === 'ALL' || state.schools.some((s) => s.school_name === prev)) el.value = prev;
    });

    const judgeFormSchool = document.getElementById('judgeFormSchool');
    if (judgeFormSchool) {
      const prevJS = judgeFormSchool.value || '';
      judgeFormSchool.innerHTML = state.schools
        .map(function (s) {
          return '<option value="' + escapeHtml(s.school_name) + '">' + escapeHtml(s.school_name) + '</option>';
        })
        .join('');
      if (prevJS) judgeFormSchool.value = prevJS;
    }

    const judgeFormCompSelect = document.getElementById('judgeFormCompSelect');
    if (judgeFormCompSelect) {
      const prevJC = judgeFormCompSelect.value || '';
      judgeFormCompSelect.innerHTML = state.competitions
        .map(function (c) {
          return (
            '<option value="' +
            escapeHtml(c.comp_id) +
            '">[' +
            escapeHtml(c.comp_id) +
            '] ' +
            escapeHtml(c.comp_name) +
            ' (' +
            escapeHtml(c.level) +
            ')</option>'
          );
        })
        .join('');
      if (prevJC) judgeFormCompSelect.value = prevJC;
    }

    const areas = getLearningAreas();
    const levels = getLevels();

    ['regAreaFilter', 'compViewAreaFilter', 'judgeAreaFilter', 'resAreaFilter'].forEach(function (id) {
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
    const prefixVal = toFullPrefix((initialData && initialData.prefix) || 'เด็กชาย');
    const nameVal = (initialData && initialData.name) || '';
    const gradeVal = (initialData && initialData.grade) || grades[0] || '';

    const row = document.createElement('div');
    row.className =
      'student-input-row grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200';

    let prefixOptions = '';
    ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'].forEach(function (p) {
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
    const prefixVal = toFullPrefix((initialData && initialData.prefix) || 'นางสาว');
    const nameVal = (initialData && initialData.name) || '';

    const row = document.createElement('div');
    row.className =
      'teacher-input-row grid grid-cols-12 gap-2 items-start bg-white p-2.5 rounded-lg border border-slate-200';

    const standardPrefixes = ['นาย', 'นาง', 'นางสาว', 'ดร.', 'ว่าที่ ร.ต.', 'ว่าที่ ร.ต.หญิง', 'สิบเอก'];
    const isCustomPrefix = Boolean(prefixVal && standardPrefixes.indexOf(prefixVal) === -1);
    const selectedPrefix = isCustomPrefix ? 'OTHER' : prefixVal;
    const customPrefixVal = isCustomPrefix ? prefixVal : '';

    let prefixOptions = '';
    standardPrefixes.forEach(function (p) {
      prefixOptions +=
        '<option value="' +
        escapeHtml(p) +
        '"' +
        (p === selectedPrefix ? ' selected' : '') +
        '>' +
        escapeHtml(p) +
        '</option>';
    });
    prefixOptions +=
      '<option value="OTHER"' +
      (selectedPrefix === 'OTHER' ? ' selected' : '') +
      '>อื่นๆ (ระบุ)</option>';

    row.innerHTML =
      '<div class="col-span-12 sm:col-span-1 sm:pt-2 text-xs font-heading font-semibold text-slate-600 text-center tch-index-badge">ครู ' +
      (index + 1) +
      '</div>' +
      '<div class="col-span-4 sm:col-span-3">' +
      '<select class="tch-prefix w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-[#F7F7F5]">' +
      prefixOptions +
      '</select>' +
      '<input type="text" placeholder="ระบุคำนำหน้า (เช่น ว่าที่ ร.ท., จ.ส.อ.)" value="' +
      escapeHtml(customPrefixVal) +
      '" class="tch-prefix-custom mt-1.5 w-full rounded-md border border-amber-400 bg-amber-50/40 px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 ' +
      (selectedPrefix === 'OTHER' ? '' : 'hidden') +
      '" />' +
      '</div>' +
      '<div class="col-span-8 sm:col-span-7">' +
      '<input type="text" required placeholder="ชื่อ - นามสกุล ครูผู้ฝึกซ้อม" value="' +
      escapeHtml(nameVal) +
      '" class="tch-name w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />' +
      '</div>' +
      '<div class="col-span-12 sm:col-span-1 sm:pt-1 text-right">' +
      (canRemove
        ? '<button type="button" class="btn-remove-tch px-2 py-1 rounded-md bg-[#FDEBEC] hover:bg-rose-100 text-[#D44C47] text-xs font-heading">ลบ</button>'
        : '<span class="text-xs text-slate-300">-</span>') +
      '</div>';

    const prefixSelect = row.querySelector('.tch-prefix');
    const customInput = row.querySelector('.tch-prefix-custom');
    if (customInput) {
      customInput.required = selectedPrefix === 'OTHER';
    }
    if (prefixSelect && customInput) {
      prefixSelect.addEventListener('change', function () {
        if (prefixSelect.value === 'OTHER') {
          customInput.classList.remove('hidden');
          customInput.required = true;
          customInput.focus();
        } else {
          customInput.classList.add('hidden');
          customInput.required = false;
        }
      });
    }

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
          .map((s, i) => i + 1 + '. ' + formatFullNameForPrint(s.prefix, s.name) + ' (' + s.grade + ')')
          .join('  ');
        const tchNames = (existingReg.teachers || [])
          .map((t, i) => i + 1 + '. ' + formatFullNameForPrint(t.prefix, t.name))
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
          .map((s, i) => (i + 1) + '. ' + formatResponsiveNameHtml(s.prefix, s.name, s.grade))
          .join('<br/>');
        const tchHtml = (reg.teachers || [])
          .map((t, i) => (i + 1) + '. ' + formatResponsiveNameHtml(t.prefix, t.name))
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

    if (!isRegistrationEffectivelyOpen()) {
      showToast(
        'ขณะนี้ระบบปิดรับสมัครส่งรายชื่อแล้ว (สิ้นสุดวันที่ 19 พ.ย. 2569 เวลา 23.59 น.) กรุณาติดต่อผู้ดูแลระบบ',
        'error'
      );
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
      const rawPrefix = tchRows[j].querySelector('.tch-prefix').value;
      const customPrefixInput = tchRows[j].querySelector('.tch-prefix-custom');
      const prefix =
        rawPrefix === 'OTHER'
          ? (customPrefixInput ? customPrefixInput.value.trim() : '')
          : rawPrefix;
      const name = tchRows[j].querySelector('.tch-name').value.trim();
      if (rawPrefix === 'OTHER' && !prefix) {
        showToast('กรุณาระบุคำนำหน้าครูผู้ฝึกซ้อมคนที่ ' + (j + 1), 'error');
        if (customPrefixInput) customPrefixInput.focus();
        return;
      }
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
      timestamp: newRecord.timestamp,
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

  async function handleSampleDataToggle() {
    if (!state.isAdmin) {
      showToast('เฉพาะแอดมินเท่านั้นที่สามารถจัดการข้อมูลตัวอย่างได้', 'error');
      return;
    }
    const sampleCount = state.registrations.filter(
      (r) => String(r.status || '').indexOf('ตัวอย่าง') !== -1
    ).length;

    if (sampleCount > 0) {
      // 1. ล้างข้อมูลตัวอย่าง (ลบเฉพาะแถวที่มีคำว่า "ตัวอย่าง" ข้อมูลครูลงทะเบียนจริงไม่หาย)
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
    } else {
      // 2. สร้างข้อมูลตัวอย่างขึ้นมาใหม่สำหรับทดสอบระบบ
      const ok = window.confirm(
        'ต้องการสร้างข้อมูลตัวอย่างจำลองสำหรับทดสอบระบบ ใช่หรือไม่?\n(ข้อมูลตัวอย่างจะถูกระบุสถานะเป็น "ข้อมูลตัวอย่าง" ชัดเจน และสามารถกดล้างออกได้ตลอดเวลา)'
      );
      if (!ok) return;

      const samples = cloneDeep(DEFAULT_DATA.sampleRegistrations || []);
      if (samples.length === 0) {
        showToast('ไม่พบชุดข้อมูลตัวอย่างตั้งต้น', 'error');
        return;
      }
      const existingIds = new Set(state.registrations.map((r) => r.reg_id));
      const toAdd = samples.map(function (s, idx) {
        let newId = s.reg_id;
        if (existingIds.has(newId)) {
          newId = 'REG-74-SAMPLE-' + (idx + 1);
        }
        return Object.assign({}, s, {
          reg_id: newId,
          status: 'ข้อมูลตัวอย่าง'
        });
      });

      state.registrations = state.registrations.concat(toAdd);
      saveState();
      populateRegCompetitionOptions();
      renderAll();
      showToast('สร้างข้อมูลตัวอย่าง ' + toAdd.length + ' รายการเรียบร้อยแล้ว', 'success');
    }
  }
  const clearSampleData = handleSampleDataToggle;

  // ==========================================
  // RENDER TAB 1: OVERALL DASHBOARD
  // ==========================================
  // ---------- Graphic Dashboard Helpers ----------
  function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function majorAreaKey(area) {
    const m = String(area || '').match(/^(\d+)/);
    return m ? m[1] : String(area || '');
  }

  function cleanAreaText(area) {
    return String(area || '')
      .replace(/^[\d.]+\s*/, '')
      .replace(/\(Soft Power\)/gi, '')
      .replace(/^กิจกรรม/, '')
      .trim();
  }

  function shortAreaLabel(area) {
    const num = (String(area || '').match(/^([\d.]+)/) || [])[1];
    return (num ? num + ' ' : '') + cleanAreaText(area);
  }

  function getMajorAreaGroups() {
    const groups = [];
    const seen = {};
    getLearningAreas().forEach(function (area) {
      const key = majorAreaKey(area);
      if (seen[key]) return;
      seen[key] = true;
      const label = cleanAreaText(area).replace(/\s*\(.*\)\s*$/, '').trim() || key;
      groups.push({ key: key, label: label });
    });
    groups.sort(function (a, b) {
      return (parseInt(a.key, 10) || 0) - (parseInt(b.key, 10) || 0);
    });
    return groups;
  }

  function shortSchoolName(name) {
    return String(name || '')
      .replace(/^โรงเรียน/, '')
      .replace(/^บ้าน/, '')
      .trim();
  }

  function renderDashboardCountdown(emptyCompCount) {
    const card = document.getElementById('dashCountdownCard');
    if (!card) return;
    const now = Date.now();
    const closeDateObj = getEffectiveRegistrationCloseDate();
    const closeTime = closeDateObj.getTime();
    const compTime = new Date(COMPETITION_START_DATE).getTime();

    const titleEl = document.getElementById('dashCountdownTitle');
    const badgeEl = document.getElementById('dashCountdownPhaseBadge');
    const subLabelEl = document.getElementById('dashCountdownSubLabel');
    const dateTextEl = document.getElementById('dashCountdownDateText');
    const noteEl = document.getElementById('dashCountdownNote');

    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thaiFullMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    if (now <= closeTime) {
      // Phase 1: Countdown to Registration Deadline
      const diffMs = Math.max(0, closeTime - now);
      const days = Math.floor(diffMs / 86400000);
      const hours = Math.floor((diffMs % 86400000) / 3600000);
      setTextById('dashCountdownDays', String(days));
      setTextById('dashCountdownHours', String(hours));
      if (titleEl) titleEl.textContent = 'นับถอยหลังปิดรับสมัครส่งรายชื่อ';
      if (badgeEl) {
        badgeEl.textContent = 'วันสุดท้าย ' + closeDateObj.getDate() + ' ' + thaiMonths[closeDateObj.getMonth()];
        badgeEl.className =
          'text-[10px] font-heading font-semibold px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700';
      }
      if (subLabelEl) subLabelEl.textContent = 'วันสุดท้ายของการส่งรายชื่อ';
      if (dateTextEl) {
        dateTextEl.textContent =
          closeDateObj.getDate() +
          ' ' +
          thaiFullMonths[closeDateObj.getMonth()] +
          ' ' +
          (closeDateObj.getFullYear() + 543) +
          ' (' +
          String(closeDateObj.getHours()).padStart(2, '0') +
          ':' +
          String(closeDateObj.getMinutes()).padStart(2, '0') +
          ' น.)';
      }
      if (noteEl) {
        noteEl.textContent =
          emptyCompCount > 0
            ? 'ยังเหลือ ' +
              emptyCompCount +
              ' รายการที่ยังไม่มีผู้สมัคร (สรุปรายชื่อ 20 พ.ย. • แข่งขัน 24–25 พ.ย.)'
            : 'ทุกรายการมีผู้สมัครครบแล้ว (สรุปรายชื่อ 20 พ.ย. • แข่งขัน 24–25 พ.ย.)';
      }
    } else if (now <= compTime) {
      // Phase 2: Countdown to Competition Days (24 Nov)
      const diffMs = Math.max(0, compTime - now);
      const days = Math.floor(diffMs / 86400000);
      const hours = Math.floor((diffMs % 86400000) / 3600000);
      setTextById('dashCountdownDays', String(days));
      setTextById('dashCountdownHours', String(hours));
      if (titleEl) titleEl.textContent = 'นับถอยหลังสู่วันแข่งขันระดับกลุ่ม';
      if (badgeEl) {
        badgeEl.textContent = 'วันแข่ง 24–25 พ.ย.';
        badgeEl.className =
          'text-[10px] font-heading font-semibold px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800';
      }
      if (subLabelEl) subLabelEl.textContent = 'วันแข่งขันระดับกลุ่ม';
      if (dateTextEl) dateTextEl.textContent = '24–25 พฤศจิกายน 2569';
      if (noteEl) {
        noteEl.textContent =
          'ปิดรับสมัครแล้ว อยู่ระหว่างเตรียมการแข่งขัน (ประชุมกรรมการ 23 พ.ย. เวลา 13.30 น.)';
      }
    } else {
      // Phase 3: During/After Competition
      setTextById('dashCountdownDays', '0');
      setTextById('dashCountdownHours', '0');
      if (titleEl) titleEl.textContent = 'การแข่งขันระดับกลุ่มโรงเรียน';
      if (badgeEl) {
        badgeEl.textContent = 'กำลังแข่งขัน';
        badgeEl.className =
          'text-[10px] font-heading font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800';
      }
      if (subLabelEl) subLabelEl.textContent = 'กำหนดแข่งขัน';
      if (dateTextEl) dateTextEl.textContent = '24–25 พฤศจิกายน 2569';
      if (noteEl) {
        noteEl.textContent = 'เข้าสู่ช่วงการแข่งขันระดับกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง';
      }
    }
  }

  let dashTooltipBound = false;
  function bindDashboardChartTooltip() {
    if (dashTooltipBound) return;
    const tip = document.getElementById('dashChartTip');
    const host = document.getElementById('tab-dashboard');
    if (!tip || !host) return;
    dashTooltipBound = true;
    host.addEventListener('mousemove', function (e) {
      const target = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!target) {
        tip.classList.remove('show');
        return;
      }
      tip.textContent = target.getAttribute('data-tip') || '';
      tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 220) + 'px';
      tip.style.top = e.clientY + 14 + 'px';
      tip.classList.add('show');
    });
    host.addEventListener('mouseleave', function () {
      tip.classList.remove('show');
    });
  }

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
    const sampleBannerTitle = document.getElementById('sampleBannerTitle');
    const sampleBannerSubtitle = document.getElementById('sampleBannerSubtitle');
    if (sampleBanner) {
      if (sampleCount > 0) {
        sampleBanner.classList.remove('hidden');
        if (sampleCountText) sampleCountText.textContent = String(sampleCount);
        if (sampleBannerTitle) {
          sampleBannerTitle.innerHTML =
            'ขณะนี้มีข้อมูลตัวอย่างจำลอง (<span id="sampleCountText">' +
            sampleCount +
            '</span> รายการ) เพื่อแสดงตัวอย่างแดชบอร์ด';
        }
        if (sampleBannerSubtitle) {
          sampleBannerSubtitle.textContent =
            'ครูแต่ละโรงเรียนสามารถกดลงทะเบียนส่งรายชื่อได้ทันที (แอดมินสามารถกดล้างข้อมูลตัวอย่างออกได้ในโหมดแอดมิน)';
        }
      } else if (state.isAdmin) {
        sampleBanner.classList.remove('hidden');
        if (sampleBannerTitle) {
          sampleBannerTitle.textContent = 'ระบบพร้อมรับสมัครจริง (ไม่มีข้อมูลตัวอย่างค้างในระบบ)';
        }
        if (sampleBannerSubtitle) {
          sampleBannerSubtitle.textContent =
            'แอดมินสามารถคลิกปุ่มด้านขวาเพื่อสร้างข้อมูลตัวอย่างจำลองสำหรับใช้ทดสอบฟังก์ชันต่าง ๆ ได้ตลอดเวลา';
        }
      } else {
        sampleBanner.classList.add('hidden');
      }
    }

    // Set KPI numbers
    const totalJudges = state.judges.length;
    const grandTotalPeople = ENABLE_PHASE_2
      ? totalStudents + totalTeachers + totalJudges
      : totalStudents + totalTeachers;
    document.getElementById('kpiTotalComp').textContent = String(totalComp);
    document.getElementById('kpiRegComp').textContent = String(regCompCount);
    document.getElementById('kpiRegCompPct').textContent = regPct + '%';
    document.getElementById('kpiEmptyComp').textContent = String(emptyCompCount);
    document.getElementById('kpiActiveSchools').textContent = String(activeSchoolSet.size);
    document.getElementById('kpiTotalSchools').textContent = String(state.schools.length);
    document.getElementById('kpiTotalTeams').textContent = String(state.registrations.length);
    document.getElementById('kpiTotalStudents').textContent = String(totalStudents);
    document.getElementById('kpiTotalTeachers').textContent = String(totalTeachers);
    const elKpiJudges = document.getElementById('kpiTotalJudges');
    if (elKpiJudges) elKpiJudges.textContent = String(totalJudges);
    const elKpiGrand = document.getElementById('kpiGrandTotalPeople');
    if (elKpiGrand) elKpiGrand.textContent = String(grandTotalPeople);

    // 5-Step Visual Timeline Stepper Card on Dashboard (Roadmap)
    const stepperEl = document.getElementById('dashboardTimelineStepper');
    if (stepperEl) {
      const items = DEFAULT_DATA.operationTimeline || [];
      stepperEl.innerHTML = items
        .map(function (it) {
          const isActive = String(it.status || '').indexOf('กำลัง') !== -1;
          const cardCls = isActive
            ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
            : 'bg-[#F7F7F5] border-slate-200/90';
          const stepBadgeCls = isActive
            ? 'bg-amber-600 text-white'
            : 'bg-[#37352F] text-white';
          const statusBadgeCls = isActive
            ? 'bg-[#EDF3EC] text-[#448361] border-[#D7E6D5]'
            : 'bg-[#F1F1EF] text-[#787774] border-slate-200';
          return (
            '<div class="flex flex-col justify-between p-3.5 rounded-xl border text-xs transition ' +
            cardCls +
            '">' +
            '<div>' +
            '<div class="flex items-center justify-between gap-2 mb-2">' +
            '<span class="w-5 h-5 rounded-md font-heading font-bold flex items-center justify-center shrink-0 text-[11px] ' +
            stepBadgeCls +
            '">' +
            escapeHtml(it.step) +
            '</span>' +
            '<span class="px-2 py-0.5 rounded border text-[10px] font-heading font-medium ' +
            statusBadgeCls +
            '">' +
            escapeHtml(it.status) +
            '</span>' +
            '</div>' +
            '<div class="font-heading font-semibold text-slate-900 leading-snug mb-1.5">' +
            escapeHtml(it.title) +
            '</div>' +
            '</div>' +
            '<div class="text-[11px] font-heading font-medium text-amber-900/90 pt-2 border-t border-slate-200/70 mt-1">' +
            escapeHtml(it.period) +
            '</div>' +
            '</div>'
          );
        })
        .join('');
    }

    // Score Announcement Progress & Medal Tally Card
    let announcedActiveCount = 0;
    let announcedTotalCount = 0;
    state.competitions.forEach(function (c) {
      const hasScores = state.registrations.some(function (r) {
        return r.comp_id === c.comp_id && r.score !== null && r.score !== undefined && r.score !== '';
      });
      const isPublished = c.result_status === 'ประกาศผลแล้ว' || hasScores;
      if (isPublished) {
        announcedTotalCount++;
        if ((compRegMap[c.comp_id] || 0) > 0) announcedActiveCount++;
      }
    });
    const scorePct = regCompCount > 0 ? Math.round((announcedActiveCount / regCompCount) * 100) : 0;
    const ringPath = document.getElementById('dashScoreRingPath');
    if (ringPath) ringPath.setAttribute('stroke-dasharray', scorePct + ', 100');
    const scorePctEl = document.getElementById('dashScorePctText');
    if (scorePctEl) scorePctEl.textContent = scorePct + '%';
    const annCountEl = document.getElementById('dashAnnouncedCount');
    if (annCountEl) annCountEl.textContent = String(announcedActiveCount);
    const actCountEl = document.getElementById('dashActiveCompCount');
    if (actCountEl) actCountEl.textContent = String(regCompCount);
    const allRatioEl = document.getElementById('dashAnnouncedAllRatio');
    if (allRatioEl) allRatioEl.textContent = announcedTotalCount + '/' + totalComp;

    let goldTotal = 0;
    let silverTotal = 0;
    let bronzeTotal = 0;
    state.registrations.forEach(function (r) {
      const m = r.medal || calculateMedalFromScore(r.score);
      if (m.indexOf('ทองแดง') !== -1) bronzeTotal++;
      else if (m.indexOf('ทอง') !== -1) goldTotal++;
      else if (m.indexOf('เงิน') !== -1) silverTotal++;
    });
    const elGold = document.getElementById('dashGoldCount');
    if (elGold) elGold.textContent = String(goldTotal);
    const elSilver = document.getElementById('dashSilverCount');
    if (elSilver) elSilver.textContent = String(silverTotal);
    const elBronze = document.getElementById('dashBronzeCount');
    if (elBronze) elBronze.textContent = String(bronzeTotal);

    // 1. Coverage Ring (outer = competitions, inner = schools)
    const totalSchools = state.schools.length;
    const activeSchoolCount = state.schools.filter(function (s) {
      return activeSchoolSet.has(s.school_name);
    }).length;
    const ringComp = document.getElementById('dashRingComp');
    const ringSchool = document.getElementById('dashRingSchool');
    const RING_OUTER = 314.16;
    const RING_INNER = 226.19;
    if (ringComp) {
      const outerLen = totalComp > 0 ? (RING_OUTER * regCompCount) / totalComp : 0;
      ringComp.setAttribute('stroke-dasharray', outerLen.toFixed(2) + ' ' + RING_OUTER);
    }
    if (ringSchool) {
      const innerLen = totalSchools > 0 ? (RING_INNER * activeSchoolCount) / totalSchools : 0;
      ringSchool.setAttribute('stroke-dasharray', innerLen.toFixed(2) + ' ' + RING_INNER);
    }
    setTextById('dashRingPct', regPct + '%');
    setTextById('dashRingCompText', String(regCompCount));
    setTextById('dashRingCompTotal', String(totalComp));
    setTextById('dashRingSchoolText', String(activeSchoolCount));
    setTextById('dashRingSchoolTotal', String(totalSchools));
    setTextById('dashRingEmptyText', String(emptyCompCount));

    // 2. Countdown Card (hidden until REGISTRATION_DEADLINE is set)
    renderDashboardCountdown(emptyCompCount);

    // 3. Category Progress Bars (sorted by most empty first)
    const areas = getLearningAreas();
    const areaBars = document.getElementById('dashboardAreaBars');
    if (areaBars) {
      const areaStats = areas.map(function (area) {
        const areaComps = state.competitions.filter((c) => c.learning_area === area);
        const regCount = areaComps.filter((c) => (compRegMap[c.comp_id] || 0) > 0).length;
        return { area: area, total: areaComps.length, reg: regCount, empty: areaComps.length - regCount };
      });
      const maxTotal = areaStats.reduce((m, a) => Math.max(m, a.total), 1);
      areaStats.sort(function (a, b) {
        const ma = String(a.area || '').match(/^([\d.]+)/);
        const mb = String(b.area || '').match(/^([\d.]+)/);
        const numA = ma ? ma[1].split('.').map(Number) : [999];
        const numB = mb ? mb[1].split('.').map(Number) : [999];
        if (numA[0] !== numB[0]) return numA[0] - numB[0];
        return (numA[1] || 0) - (numB[1] || 0);
      });

      areaBars.innerHTML = areaStats
        .map(function (st) {
          const widthPct = ((st.total / maxTotal) * 100).toFixed(1);
          const regPctArea = st.total > 0 ? ((st.reg / st.total) * 100).toFixed(1) : '0';
          const label = shortAreaLabel(st.area);
          return (
            '<div class="flex items-center gap-3">' +
            '<button type="button" data-jump-area="' +
            escapeHtml(st.area) +
            '" data-jump-status="ALL" title="' +
            escapeHtml(st.area) +
            '" class="dash-bar-row flex-1 min-w-0 flex items-center gap-2 sm:gap-3 text-left group">' +
            '<span class="w-24 sm:w-44 shrink-0 text-[11px] sm:text-sm text-left text-[#37352F] truncate group-hover:font-semibold">' +
            escapeHtml(label) +
            '</span>' +
            '<span class="flex-1 min-w-0">' +
            '<span class="dash-bar flex h-5 rounded-md overflow-hidden" style="width:' +
            widthPct +
            '%">' +
            '<span class="h-full bg-[#0F7B6C]" style="width:' +
            regPctArea +
            '%"></span>' +
            '<span class="h-full bg-[#F4C7C3]" style="width:' +
            (100 - parseFloat(regPctArea)).toFixed(1) +
            '%"></span>' +
            '</span>' +
            '</span>' +
            '</button>' +
            '<span class="w-[4.5rem] sm:w-24 shrink-0 text-[11px] sm:text-xs text-[#787774] font-heading">' +
            '<b class="text-[#37352F]">' +
            st.reg +
            '</b>/' +
            st.total +
            ' ' +
            (st.empty > 0
              ? '<button type="button" data-jump-area="' +
                escapeHtml(st.area) +
                '" data-jump-status="EMPTY" class="text-[#D44C47] hover:underline font-semibold">ว่าง ' +
                st.empty +
                '</button>'
              : '<span class="text-[#448361] font-semibold">ครบ</span>') +
            '</span>' +
            '</div>'
          );
        })
        .join('');

      areaBars.querySelectorAll('[data-jump-area]').forEach(function (btn) {
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

    // 4. Render By Level Grid
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

    // 5. School x Category Heatmap & 6. Participation Leaderboard
    const groups = getMajorAreaGroups();
    const schoolStats = state.schools.map(function (s) {
      const regs = state.registrations.filter((r) => r.school_name === s.school_name);
      let stuCount = 0;
      let tchCount = 0;
      regs.forEach(function (r) {
        stuCount += (r.students || []).length;
        tchCount += (r.teachers || []).length;
      });
      const perGroup = groups.map(function (g) {
        return regs.filter((r) => majorAreaKey(r.learning_area) === g.key).length;
      });
      return {
        school_name: s.school_name,
        short: shortSchoolName(s.school_name),
        itemCount: regs.length,
        stuCount: stuCount,
        tchCount: tchCount,
        perGroup: perGroup
      };
    });

    const heatEl = document.getElementById('dashboardHeatmap');
    if (heatEl) {
      const heatColor = function (v) {
        if (v <= 0) return '#F1F1EF';
        if (v === 1) return '#CDE8E2';
        if (v === 2) return '#7FC4B4';
        if (v <= 4) return '#2E9A86';
        return '#0B5E52';
      };
      let html =
        '<div class="grid gap-1 items-center" style="grid-template-columns:128px repeat(' +
        groups.length +
        ',minmax(0,1fr)) 52px">' +
        '<div></div>' +
        groups
          .map(function (g) {
            return (
              '<div class="text-[10px] leading-tight text-[#787774] text-center h-10 flex items-end justify-center" title="' +
              escapeHtml(g.label) +
              '">' +
              escapeHtml(g.label) +
              '</div>'
            );
          })
          .join('') +
        '<div class="text-[10px] text-[#787774] text-center self-end">รวม</div>';

      schoolStats.forEach(function (st) {
        const none = st.itemCount === 0;
        html +=
          '<button type="button" data-open-school="' +
          escapeHtml(st.school_name) +
          '" class="text-xs text-left truncate hover:underline ' +
          (none ? 'text-[#D44C47] font-semibold' : 'text-[#37352F]') +
          '" title="' +
          escapeHtml(st.school_name) +
          '">' +
          escapeHtml(st.short) +
          '</button>';
        html += st.perGroup
          .map(function (v, j) {
            return (
              '<button type="button" class="dash-heat-cell" data-open-school="' +
              escapeHtml(st.school_name) +
              '" data-tip="' +
              escapeHtml(st.school_name + '\n' + groups[j].label + ': ' + v + ' รายการ') +
              '" aria-label="' +
              escapeHtml(st.school_name + ' ' + groups[j].label + ' ' + v + ' รายการ') +
              '" style="background:' +
              heatColor(v) +
              '"></button>'
            );
          })
          .join('');
        html +=
          '<div class="text-xs text-center font-heading font-semibold ' +
          (none ? 'text-[#D44C47]' : 'text-[#37352F]') +
          '">' +
          (none ? 'ยังไม่ส่ง' : st.itemCount) +
          '</div>';
      });
      html += '</div>';
      heatEl.innerHTML = html;
    }

    const boardEl = document.getElementById('dashboardSchoolBoard');
    if (boardEl) {
      const ranked = schoolStats.slice().sort(function (a, b) {
        if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
        if (b.stuCount !== a.stuCount) return b.stuCount - a.stuCount;
        return a.school_name.localeCompare(b.school_name, 'th');
      });
      const maxItems = ranked.length && ranked[0].itemCount > 0 ? ranked[0].itemCount : 1;
      const medalCls = [
        'bg-amber-400 text-white',
        'bg-slate-300 text-slate-800',
        'bg-orange-300 text-white'
      ];
      boardEl.innerHTML = ranked
        .map(function (st, k) {
          const none = st.itemCount === 0;
          const badge = !none && k < 3 ? medalCls[k] : 'bg-[#F1F1EF] text-[#787774]';
          return (
            '<button type="button" data-open-school="' +
            escapeHtml(st.school_name) +
            '" title="' +
            escapeHtml(st.school_name) +
            '" class="w-full flex items-center gap-2 text-sm p-1.5 rounded-lg hover:bg-[#F7F7F5] transition text-left">' +
            '<span class="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-heading font-bold ' +
            badge +
            '">' +
            (k + 1) +
            '</span>' +
            '<span class="w-28 shrink-0 truncate font-heading ' +
            (none ? 'text-[#D44C47]' : 'text-[#37352F]') +
            '">' +
            escapeHtml(st.short) +
            '</span>' +
            '<span class="flex-1 h-2 rounded-full bg-[#F1F1EF] overflow-hidden">' +
            '<span class="dash-bar block h-2 rounded-full bg-[#2F6FDB]" style="width:' +
            ((st.itemCount / maxItems) * 100).toFixed(1) +
            '%"></span>' +
            '</span>' +
            '<span class="w-20 shrink-0 text-right text-xs text-[#787774] font-heading">' +
            (none
              ? '<span class="text-[#D44C47]">ยังไม่ส่ง</span>'
              : '<b class="text-[#37352F]">' + st.itemCount + '</b> · ' + st.stuCount + ' คน') +
            '</span>' +
            '</button>'
          );
        })
        .join('');
    }

    document
      .querySelectorAll('#dashboardHeatmap [data-open-school], #dashboardSchoolBoard [data-open-school]')
      .forEach(function (btn) {
        btn.addEventListener('click', function () {
          const schoolName = btn.getAttribute('data-open-school');
          const select = document.getElementById('schoolViewSelect');
          if (select) select.value = schoolName;
          switchTab('school');
        });
      });

    bindDashboardChartTooltip();

    // 7. Render Recent Registrations Live Table
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
                  formatResponsiveNameHtml(s.prefix, s.name, s.grade) +
                  '</div>'
              )
              .join('');
            const tchHtml = (r.teachers || [])
              .map(
                (t, i) =>
                  '<div>' +
                  (i + 1) +
                  '. ' +
                  formatResponsiveNameHtml(t.prefix, t.name) +
                  '</div>'
              )
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
              escapeHtml(formatDisplayTimestamp(r.timestamp)) +
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
    let goldCount = 0;
    let silverCount = 0;
    let bronzeCount = 0;
    let winCount = 0;

    regs.forEach(function (r) {
      if (r.team_type === 'เดี่ยว') singleCount++;
      else teamCount++;
      stuCount += (r.students || []).length;
      tchCount += (r.teachers || []).length;
      const m = r.medal || calculateMedalFromScore(r.score);
      if (m.indexOf('ทองแดง') !== -1) bronzeCount++;
      else if (m.indexOf('ทอง') !== -1) goldCount++;
      else if (m.indexOf('เงิน') !== -1) silverCount++;
      if (Number(r.rank) === 1) winCount++;
    });

    document.getElementById('schKpiItems').textContent = String(regs.length);
    document.getElementById('schKpiSingle').textContent = String(singleCount);
    document.getElementById('schKpiTeam').textContent = String(teamCount);
    document.getElementById('schKpiStudents').textContent = String(stuCount);
    document.getElementById('schKpiTeachers').textContent = String(tchCount);

    const medalSummaryEl = document.getElementById('schoolViewMedalSummary');
    if (medalSummaryEl) {
      medalSummaryEl.innerHTML =
        '<span class="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800">ทอง <strong>' +
        goldCount +
        '</strong></span>' +
        '<span class="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-slate-700">เงิน <strong>' +
        silverCount +
        '</strong></span>' +
        '<span class="px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-800">ทองแดง <strong>' +
        bronzeCount +
        '</strong></span>' +
        '<span class="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">ชนะเลิศ (ตัวแทนกลุ่ม) <strong>' +
        winCount +
        '</strong></span>';
    }

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
        const compObj = state.competitions.find((c) => c.comp_id === r.comp_id) || {};
        const roomInfo =
          (compObj.comp_date || '24–25 พ.ย. 69') +
          ' • ' +
          (compObj.comp_time || '09.00 น.') +
          ' • ' +
          (compObj.venue_room || 'อาคารเรียนรวม');

        const stuHtml = (r.students || [])
          .map(
            (s, i) =>
              '<div>' +
              (i + 1) +
              '. ' +
              formatResponsiveNameHtml(s.prefix, s.name, s.grade) +
              '</div>'
          )
          .join('');
        const tchHtml = (r.teachers || [])
          .map(
            (t, i) =>
              '<div>' +
              (i + 1) +
              '. ' +
              formatResponsiveNameHtml(t.prefix, t.name) +
              '</div>'
          )
          .join('');

        const medal = r.medal || calculateMedalFromScore(r.score);
        const award = r.award_title || getAwardTitleFromRank(r.rank, r.score);
        const hasScore = r.score !== null && r.score !== undefined && r.score !== '';
        const statusBadgeHtml = r.is_sample
          ? '<span class="px-2.5 py-0.5 rounded-full bg-[#FBF3DB] text-[#CB912F] text-xs font-heading">ข้อมูลตัวอย่าง</span>'
          : '<span class="px-2.5 py-0.5 rounded-full bg-[#EDF3EC] text-[#448361] text-xs font-heading">ลงทะเบียนแล้ว</span>';
        const resultCellHtml = ENABLE_PHASE_2
          ? hasScore
            ? '<div class="font-heading font-bold text-[#37352F]">' +
              Number(r.score).toFixed(2) +
              ' คะแนน</div>' +
              '<div class="mt-0.5">' +
              renderMedalBadgeHtml(medal) +
              '</div>' +
              (award ? '<div class="text-[11px] font-heading font-semibold text-emerald-700 mt-0.5">' + escapeHtml(award) + '</div>' : '')
            : '<span class="text-xs text-[#787774]">รอประกาศผล</span>'
          : statusBadgeHtml;

        const deleteBtnHtml = state.isAdmin
          ? '<button type="button" data-sch-del="' +
            escapeHtml(r.reg_id) +
            '" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FDEBEC] hover:bg-rose-100 text-[#D44C47] text-xs font-heading">' +
            ICONS.trash +
            '<span>ลบ</span></button>'
          : '';

        const roomSubHtml = ENABLE_PHASE_2
          ? '<div class="text-[11px] text-[#787774] mt-0.5">' + escapeHtml(roomInfo) + '</div>'
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
          '<td class="py-3 px-3">' +
          '<div class="font-heading font-medium text-[#37352F]">' +
          escapeHtml(r.comp_name) +
          ' <span class="text-xs font-normal text-[#787774]">(' +
          escapeHtml(r.team_type) +
          ')</span></div>' +
          roomSubHtml +
          '</td>' +
          '<td class="py-3 px-2 text-center">' +
          '<span class="px-2.5 py-0.5 rounded-md bg-[#F1F1EF] text-[#37352F] text-xs font-heading whitespace-nowrap">' +
          escapeHtml(r.level) +
          '</span>' +
          '</td>' +
          '<td class="py-3 px-3 text-xs text-[#37352F] space-y-0.5">' +
          stuHtml +
          '</td>' +
          '<td class="py-3 px-3 text-xs text-[#787774] space-y-0.5">' +
          tchHtml +
          '</td>' +
          '<td class="py-3 px-2 text-center">' +
          resultCellHtml +
          '</td>' +
          '<td class="py-3 px-2 text-right whitespace-nowrap no-print space-x-1">' +
          '<button type="button" data-sch-cards="' +
          escapeHtml(r.reg_id) +
          '" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#EFF6FF] hover:bg-blue-100 text-[#1E40AF] text-xs font-heading" title="พิมพ์บัตรประจำตัวทีมนี้">' +
          ICONS.fileText +
          '<span>บัตร</span></button>' +
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

    tbody.querySelectorAll('[data-sch-cards]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        printRegistrationIdCards(btn.getAttribute('data-sch-cards'));
      });
    });
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
  // RENDER TAB 4: COMPETITION VIEW (รายรายการ & ตารางสถานที่)
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
        const hay = (
          c.comp_id +
          ' ' +
          c.comp_name +
          ' ' +
          c.learning_area +
          ' ' +
          c.level +
          ' ' +
          (c.venue_room || '')
        ).toLowerCase();
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

        const scheduleInfo =
          (c.comp_date || '24–25 พฤศจิกายน 2569') +
          ' • ' +
          (c.comp_time || '09.00 - 12.00 น.') +
          ' • ' +
          (c.venue_room || 'อาคารเรียนรวม ห้อง 101');

        let schoolsTableHtml = '';
        if (hasRegs) {
          const scoreHeaderHtml = ENABLE_PHASE_2 ? '<th class="py-2 px-2 text-center">ผลคะแนน</th>' : '';
          schoolsTableHtml =
            '<div class="mt-3 pt-3 border-t border-slate-100 overflow-x-auto">' +
            '<table class="w-full text-xs text-left">' +
            '<thead class="bg-[#F7F7F5] text-[#787774] font-heading border-y border-slate-200">' +
            '<tr>' +
            '<th class="py-2 px-3">ลำดับ</th>' +
            '<th class="py-2 px-3">โรงเรียนที่ส่งเข้าแข่งขัน</th>' +
            '<th class="py-2 px-3">รายชื่อนักเรียนผู้เข้าแข่งขัน</th>' +
            '<th class="py-2 px-3">ครูผู้ฝึกซ้อม</th>' +
            scoreHeaderHtml +
            '<th class="py-2 px-2 text-right">จัดการ</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody class="divide-y divide-slate-100">' +
            regs
              .map(function (r, idx) {
                const stuText = (r.students || [])
                  .map((s, i) => (i + 1) + '. ' + formatResponsiveNameHtml(s.prefix, s.name, s.grade))
                  .join('<br/>');
                const tchText = (r.teachers || [])
                  .map((t, i) => (i + 1) + '. ' + formatResponsiveNameHtml(t.prefix, t.name))
                  .join('<br/>');
                const medal = r.medal || calculateMedalFromScore(r.score);
                const scoreHtml =
                  r.score !== null && r.score !== undefined && r.score !== ''
                    ? '<div class="font-heading font-bold text-[#37352F]">' +
                      Number(r.score).toFixed(2) +
                      '</div>' +
                      renderMedalBadgeHtml(medal)
                    : '<span class="text-slate-400">รอผล</span>';
                const scoreTdHtml = ENABLE_PHASE_2
                  ? '<td class="py-2 px-2 text-center">' + scoreHtml + '</td>'
                  : '';
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
                  scoreTdHtml +
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

        const exportCompExcelBtnHtml = hasRegs
          ? '<button type="button" data-export-comp-excel="' +
            escapeHtml(c.comp_id) +
            '" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F1F1EF] hover:bg-[#E9E9E7] text-[#37352F] font-heading text-xs font-medium transition">' +
            ICONS.table +
            '<span>ดาวน์โหลด Excel</span></button>'
          : '';

        const printCheckinBtnHtml = hasRegs
          ? '<button type="button" data-print-checkin="' +
            escapeHtml(c.comp_id) +
            '" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F1F1EF] hover:bg-[#E9E9E7] text-[#37352F] font-heading text-xs font-medium transition">' +
            ICONS.print +
            '<span>ใบลงชื่อหน้าห้อง</span></button>'
          : '';

        const adminBtnsHtml =
          ENABLE_PHASE_2 && state.isAdmin
            ? '<button type="button" data-open-schedule="' +
              escapeHtml(c.comp_id) +
              '" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-heading text-xs font-medium transition">' +
              ICONS.calendar +
              '<span>ตั้งค่าห้องสอบ</span></button>' +
              (hasRegs
                ? '<button type="button" data-open-score="' +
                  escapeHtml(c.comp_id) +
                  '" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-heading text-xs font-medium transition">' +
                  ICONS.award +
                  '<span>บันทึกคะแนน</span></button>'
                : '')
            : '';

        const scheduleInfoLineHtml = ENABLE_PHASE_2
          ? '<div class="inline-flex items-center gap-1.5 text-xs text-[#787774]">' +
            ICONS.calendar +
            '<span>' +
            escapeHtml(scheduleInfo) +
            '</span></div>'
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
          scheduleInfoLineHtml +
          '</div>' +
          '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
          badgeHtml +
          exportCompExcelBtnHtml +
          printCheckinBtnHtml +
          adminBtnsHtml +
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

    container.querySelectorAll('[data-export-comp-excel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        exportCompetitionExcel(btn.getAttribute('data-export-comp-excel'));
      });
    });

    container.querySelectorAll('[data-open-schedule]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openScheduleEditModal(btn.getAttribute('data-open-schedule'));
      });
    });

    container.querySelectorAll('[data-open-score]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openScoreEntryModal(btn.getAttribute('data-open-score'));
      });
    });
  }

  // Print Competition Check-in Sheet (แบบลงทะเบียนนักเรียนผู้เข้าแข่งขัน - A4 แนวนอน TH Sarabun New 16pt)
  function printCompetitionCheckinSheet(compId) {
    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) return;
    const regs = state.registrations.filter((r) => r.comp_id === compId);

    const rowsHtml = regs
      .map(function (r, idx) {
        const sch = state.schools.find((s) => s.school_name === r.school_name);
        const subdistrict = sch ? sch.subdistrict : '';
        const students = r.students || [];
        const teachers = r.teachers || [];

        const stuHtml = students
          .map(function (s, i) {
            return (
              '<div class="row-subitem">' +
              (i + 1) +
              '. ' +
              escapeHtml(formatFullNameForPrint(s.prefix, s.name)) +
              ' (' +
              escapeHtml(s.grade) +
              ')</div>'
            );
          })
          .join('');

        const sigHtml = students
          .map(function () {
            return '<div class="row-subitem sig-cell">ลงชื่อ ....................................................</div>';
          })
          .join('');

        const tchHtml = teachers
          .map(function (t, i) {
            return '<div class="row-subitem">' + (i + 1) + '. ' + escapeHtml(formatFullNameForPrint(t.prefix, t.name)) + '</div>';
          })
          .join('');

        return (
          '<tr>' +
          '<td class="text-center">' +
          (idx + 1) +
          '</td>' +
          '<td class="font-bold">' +
          escapeHtml(r.school_name) +
          '</td>' +
          '<td>' +
          (stuHtml || '-') +
          '</td>' +
          '<td>' +
          (sigHtml || '<div class="row-subitem sig-cell">ลงชื่อ ....................................................</div>') +
          '</td>' +
          '<td>' +
          (tchHtml || '-') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    // If fewer than 2 registrations, add extra blank rows for committee note/addition if needed
    let blankRowsHtml = '';
    const currentCount = regs.length;
    if (currentCount < 3) {
      for (let b = currentCount + 1; b <= 3; b++) {
        blankRowsHtml +=
          '<tr class="blank-row">' +
          '<td class="text-center">' +
          b +
          '</td>' +
          '<td></td>' +
          '<td><div class="row-subitem">1. ....................................................</div></td>' +
          '<td><div class="row-subitem sig-cell">ลงชื่อ ....................................................</div></td>' +
          '<td><div class="row-subitem">1. ....................................................</div></td>' +
          '</tr>';
      }
    }

    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) {
      window.print();
      return;
    }

    const htmlDoc =
      '<!DOCTYPE html>' +
      '<html lang="th">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>แบบลงทะเบียนผู้เข้าแข่งขัน - ' +
      escapeHtml(comp.comp_id) +
      '</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">' +
      '<style>' +
      '@page {' +
      '  size: A4 landscape;' +
      '  margin: 10mm 15mm 10mm 15mm;' +
      '}' +
      '* { box-sizing: border-box; }' +
      'body {' +
      '  font-family: "TH Sarabun New", "TH Sarabun PSK", "Sarabun", sans-serif;' +
      '  font-size: 16pt;' +
      '  line-height: 1.35;' +
      '  color: #000;' +
      '  background: #fff;' +
      '  margin: 0;' +
      '  padding: 0;' +
      '  -webkit-print-color-adjust: exact;' +
      '  print-color-adjust: exact;' +
      '}' +
      '.header-title {' +
      '  text-align: center;' +
      '  margin-bottom: 10px;' +
      '}' +
      '.title-1 { font-size: 19pt; font-weight: bold; line-height: 1.25; }' +
      '.title-2 { font-size: 17pt; font-weight: bold; line-height: 1.25; }' +
      '.title-3 { font-size: 18pt; font-weight: bold; margin-top: 2px; text-decoration: underline; }' +
      '.meta-row {' +
      '  display: flex;' +
      '  justify-content: space-between;' +
      '  font-size: 16pt;' +
      '  margin-bottom: 2px;' +
      '}' +
      'table.official-table {' +
      '  width: 100%;' +
      '  border-collapse: collapse;' +
      '  margin-top: 8px;' +
      '  font-size: 16pt;' +
      '}' +
      'table.official-table th {' +
      '  border: 1px solid #000;' +
      '  padding: 6px 6px;' +
      '  background-color: #f2f2f2;' +
      '  font-weight: bold;' +
      '  text-align: center;' +
      '}' +
      'table.official-table td {' +
      '  border: 1px solid #000;' +
      '  padding: 6px 6px;' +
      '  vertical-align: top;' +
      '}' +
      '.text-center { text-align: center; }' +
      '.font-bold { font-weight: bold; }' +
      '.row-subitem {' +
      '  min-height: 28px;' +
      '  line-height: 28px;' +
      '}' +
      '.sig-cell {' +
      '  color: #444;' +
      '  text-align: center;' +
      '  white-space: nowrap;' +
      '}' +
      '.judges-section {' +
      '  margin-top: 20px;' +
      '  page-break-inside: avoid;' +
      '}' +
      '.judges-title {' +
      '  font-size: 16pt;' +
      '  font-weight: bold;' +
      '  margin-bottom: 6px;' +
      '}' +
      'table.judges-table {' +
      '  width: 100%;' +
      '  border: none;' +
      '  font-size: 16pt;' +
      '  border-collapse: collapse;' +
      '}' +
      'table.judges-table td {' +
      '  border: none;' +
      '  text-align: center;' +
      '  width: 33.33%;' +
      '  padding: 4px;' +
      '  vertical-align: top;' +
      '  line-height: 1.6;' +
      '}' +
      '.footer-note {' +
      '  font-size: 13pt;' +
      '  color: #555;' +
      '  margin-top: 8px;' +
      '}' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<div class="header-title">' +
      '<div class="title-1">งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569</div>' +
      '<div class="title-2">ระดับกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง สำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3</div>' +
      '<div class="title-3">แบบลงทะเบียนนักเรียนผู้เข้าแข่งขัน</div>' +
      '</div>' +
      '<div class="meta-row">' +
      '<div><strong>กิจกรรม:</strong> ' +
      escapeHtml(comp.comp_name) +
      '</div>' +
      '<div><strong>ระดับ:</strong> ' +
      escapeHtml(comp.level) +
      ' &nbsp;&nbsp; <strong>ประเภท:</strong> ' +
      escapeHtml(comp.team_type) +
      '</div>' +
      '</div>' +
      '<div class="meta-row">' +
      '<div><strong>รหัสรายการ:</strong> ' +
      escapeHtml(comp.comp_id) +
      ' &nbsp;&nbsp; <strong>หมวดกิจกรรม:</strong> ' +
      escapeHtml(comp.learning_area) +
      '</div>' +
      '<div><strong>สถานที่แข่งขัน:</strong> ณ โรงเรียนบ้านวังยาววิทยายน</div>' +
      '</div>' +
      '<table class="official-table">' +
      '<thead>' +
      '<tr>' +
      '<th style="width: 45px;">ลำดับ</th>' +
      '<th style="width: 230px;">โรงเรียน</th>' +
      '<th>ผู้เข้าแข่งขัน (นักเรียน)</th>' +
      '<th style="width: 260px;">ลงชื่อตัวบรรจง</th>' +
      '<th style="width: 220px;">ครูผู้ฝึกซ้อม</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      rowsHtml +
      blankRowsHtml +
      '</tbody>' +
      '</table>' +
      '<div class="judges-section">' +
      '<div class="judges-title">กรรมการตัดสิน</div>' +
      '<table class="judges-table">' +
      '<tr>' +
      '<td>ลงชื่อ ............................................................<br/>( ............................................................ )<br/>เบอร์โทร ....................................................</td>' +
      '<td>ลงชื่อ ............................................................<br/>( ............................................................ )<br/>เบอร์โทร ....................................................</td>' +
      '<td>ลงชื่อ ............................................................<br/>( ............................................................ )<br/>เบอร์โทร ....................................................</td>' +
      '</tr>' +
      '</table>' +
      '<div class="footer-note">นัดหมายประชุมคณะกรรมการตัดสิน: วันจันทร์ที่ 23 พฤศจิกายน 2569 เวลา 13.30 น. ณ โรงเรียนบ้านวังยาววิทยายน • กำหนดการแข่งขัน 24–25 พ.ย. 2569 • หมายเหตุ ศูนย์พัฒนาวิชาการปรับใช้ได้ตามความเหมาะสม</div>' +
      '</div>' +
      '<script>window.onload=function(){window.print();};<\/script>' +
      '</body>' +
      '</html>';

    w.document.write(htmlDoc);
    w.document.close();
  }

  // Print Competition Table of Contents (สารบัญรายการแข่งขัน - A4 แนวนอน TH Sarabun New 16pt)
  function printCompetitionTableOfContents() {
    const competitions = state.competitions || [];
    if (competitions.length === 0) {
      showToast('ไม่พบข้อมูลรายการแข่งขัน', 'error');
      return;
    }

    const regCountMap = {};
    state.registrations.forEach(function (r) {
      regCountMap[r.comp_id] = (regCountMap[r.comp_id] || 0) + 1;
    });

    const rowsHtml = competitions
      .map(function (c, idx) {
        const count = regCountMap[c.comp_id] || 0;
        const countBadge =
          count > 0 ? '<strong>' + count + ' ทีม</strong>' : '<span style="color:#777">ยังไม่มี</span>';
        return (
          '<tr>' +
          '<td class="text-center">' +
          (idx + 1) +
          '</td>' +
          '<td class="text-center font-bold">' +
          escapeHtml(c.comp_id) +
          '</td>' +
          '<td>' +
          escapeHtml(c.learning_area) +
          '</td>' +
          '<td class="font-bold">' +
          escapeHtml(c.comp_name) +
          '</td>' +
          '<td class="text-center">' +
          escapeHtml(c.level) +
          '</td>' +
          '<td class="text-center">' +
          escapeHtml(c.team_type) +
          '</td>' +
          '<td class="text-center">' +
          countBadge +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    const registeredCompsCount = competitions.filter((c) => (regCountMap[c.comp_id] || 0) > 0).length;

    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) {
      window.print();
      return;
    }

    const htmlDoc =
      '<!DOCTYPE html>' +
      '<html lang="th">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>สารบัญรายการแข่งขัน - งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">' +
      '<style>' +
      '@page {' +
      '  size: A4 landscape;' +
      '  margin: 10mm 15mm 10mm 15mm;' +
      '}' +
      '* { box-sizing: border-box; }' +
      'body {' +
      '  font-family: "TH Sarabun New", "TH Sarabun PSK", "Sarabun", sans-serif;' +
      '  font-size: 16pt;' +
      '  line-height: 1.35;' +
      '  color: #000;' +
      '  background: #fff;' +
      '  margin: 0;' +
      '  padding: 0;' +
      '  -webkit-print-color-adjust: exact;' +
      '  print-color-adjust: exact;' +
      '}' +
      '.header-title {' +
      '  text-align: center;' +
      '  margin-bottom: 8px;' +
      '}' +
      '.title-1 { font-size: 19pt; font-weight: bold; line-height: 1.25; }' +
      '.title-2 { font-size: 17pt; font-weight: bold; line-height: 1.25; }' +
      '.title-3 { font-size: 18pt; font-weight: bold; margin-top: 2px; text-decoration: underline; }' +
      '.summary-row {' +
      '  display: flex;' +
      '  justify-content: space-between;' +
      '  font-size: 15pt;' +
      '  margin-bottom: 6px;' +
      '  padding-bottom: 4px;' +
      '  border-bottom: 1px solid #ccc;' +
      '}' +
      'table.official-table {' +
      '  width: 100%;' +
      '  border-collapse: collapse;' +
      '  margin-top: 6px;' +
      '  font-size: 15pt;' +
      '}' +
      'table.official-table th {' +
      '  border: 1px solid #000;' +
      '  padding: 5px 6px;' +
      '  background-color: #f2f2f2;' +
      '  font-weight: bold;' +
      '  text-align: center;' +
      '}' +
      'table.official-table td {' +
      '  border: 1px solid #000;' +
      '  padding: 4px 6px;' +
      '  vertical-align: top;' +
      '}' +
      '.text-center { text-align: center; }' +
      '.font-bold { font-weight: bold; }' +
      'tr { page-break-inside: avoid; }' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<div class="header-title">' +
      '<div class="title-1">งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569</div>' +
      '<div class="title-2">ระดับกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง สำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3</div>' +
      '<div class="title-3">สารบัญรายการแข่งขันทั้งหมด (สำหรับเข้าเล่มแฟ้มกองอำนวยการ)</div>' +
      '</div>' +
      '<div class="summary-row">' +
      '<div>รวมทั้งสิ้น <strong>' +
      competitions.length +
      ' รายการ</strong> (13 หมวดกิจกรรม)</div>' +
      '<div>มีโรงเรียนสมัครแล้ว <strong>' +
      registeredCompsCount +
      ' รายการ</strong> • ทีมสมัครรวม <strong>' +
      state.registrations.length +
      ' ทีม</strong></div>' +
      '<div>สถานที่แข่งขัน: <strong>ณ โรงเรียนบ้านวังยาววิทยายน</strong></div>' +
      '</div>' +
      '<table class="official-table">' +
      '<thead>' +
      '<tr>' +
      '<th style="width: 45px;">ที่</th>' +
      '<th style="width: 85px;">รหัส</th>' +
      '<th style="width: 220px;">หมวดกิจกรรม / กลุ่มสาระฯ</th>' +
      '<th>ชื่อรายการแข่งขัน</th>' +
      '<th style="width: 85px;">ระดับ</th>' +
      '<th style="width: 85px;">ประเภท</th>' +
      '<th style="width: 95px;">ทีมที่สมัคร</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      rowsHtml +
      '</tbody>' +
      '</table>' +
      '<script>window.onload=function(){window.print();};<\/script>' +
      '</body>' +
      '</html>';

    w.document.write(htmlDoc);
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
        .map((s, i) => (i + 1) + '. ' + formatFullNameForPrint(s.prefix, s.name) + ' (' + s.grade + ')')
        .join(' | ');
      const tchStr = (r.teachers || [])
        .map((t, i) => (i + 1) + '. ' + formatFullNameForPrint(t.prefix, t.name))
        .join(' | ');
      rows.push([
        r.reg_id,
        formatDisplayTimestamp(r.timestamp),
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

  // Load ExcelJS on demand (pinned version + SRI) so normal page loads stay light
  let exceljsLoadPromise = null;
  function loadExcelJs() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (exceljsLoadPromise) return exceljsLoadPromise;
    exceljsLoadPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.integrity = 'sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';
      s.crossOrigin = 'anonymous';
      s.onload = function () {
        resolve(window.ExcelJS);
      };
      s.onerror = function () {
        exceljsLoadPromise = null;
        reject(new Error('โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ'));
      };
      document.head.appendChild(s);
    });
    return exceljsLoadPromise;
  }

  // Export one school's registrations as .xlsx (layout follows the group's official sample file)
  async function exportSchoolExcel(schoolName) {
    if (!schoolName) {
      showToast('กรุณาเลือกโรงเรียนก่อนดาวน์โหลด Excel', 'warning');
      return;
    }
    const order = {};
    state.competitions.forEach(function (c, i) {
      order[c.comp_id] = i;
    });
    const list = state.registrations
      .filter((r) => r.school_name === schoolName)
      .sort((a, b) => (order[a.comp_id] || 0) - (order[b.comp_id] || 0));
    if (list.length === 0) {
      showToast('โรงเรียนนี้ยังไม่มีรายการลงทะเบียน', 'warning');
      return;
    }

    let ExcelJS;
    try {
      ExcelJS = await loadExcelJs();
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('รายชื่อ');
    ws.columns = [
      { width: 6 },
      { width: 50 },
      { width: 10 },
      { width: 12 },
      { width: 30 },
      { width: 30 },
      { width: 26 }
    ];
    const titles = [
      'รายการกิจกรรมการแข่งขันงานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ระดับกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง ปีการศึกษา 2569',
      '',
      'ณ โรงเรียนบ้านวังยาววิทยายน'
    ];
    titles.forEach(function (t, i) {
      ws.mergeCells(i + 1, 1, i + 1, 7);
      const cell = ws.getCell(i + 1, 1);
      cell.value = t;
      cell.font = { bold: true, size: 15 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const thin = { style: 'thin' };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const header = ws.getRow(4);
    ['ที่', 'สาระ/กิจกรรม', 'ระดับ', 'ประเภท', 'ชื่อ - สกุล นักเรียน', 'ชื่อ - สกุล ครูผู้ควบคุมดูแล', 'โรงเรียน'].forEach(
      function (h, i) {
        const c = header.getCell(i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = border;
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1EF' } };
      }
    );

    let rowNo = 5;
    list.forEach(function (r, idx) {
      const students = r.students || [];
      const teachers = r.teachers || [];
      const lines = Math.max(students.length, teachers.length, 1);
      const typeText = r.team_type === 'ทีม' ? 'ทีม ' + students.length + ' คน' : r.team_type || '';
      for (let i = 0; i < lines; i++) {
        const row = ws.getRow(rowNo++);
        const s = students[i];
        const t = teachers[i];
        const vals =
          i === 0
            ? [idx + 1, r.comp_name, r.level, typeText, s ? formatFullNameForPrint(s.prefix, s.name) : '', t ? formatFullNameForPrint(t.prefix, t.name) : '', r.school_name]
            : [null, null, null, null, s ? formatFullNameForPrint(s.prefix, s.name) : '', t ? formatFullNameForPrint(t.prefix, t.name) : null, null];
        vals.forEach(function (v, ci) {
          const c = row.getCell(ci + 1);
          c.value = v;
          c.border = border;
          c.alignment = { vertical: 'top', wrapText: true, horizontal: ci === 0 || ci === 2 ? 'center' : 'left' };
        });
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ศิลปหัตถกรรมครั้งที่74_' + schoolName + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว', 'success');
  }

  // Export one competition's registrations as .xlsx (specific competition)
  async function exportCompetitionExcel(compId) {
    if (!compId) return;
    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) {
      showToast('ไม่พบข้อมูลรายการแข่งขัน', 'error');
      return;
    }
    const regs = state.registrations.filter((r) => r.comp_id === compId);
    if (regs.length === 0) {
      showToast('ยังไม่มีโรงเรียนลงทะเบียนในรายการนี้', 'warning');
      return;
    }

    let ExcelJS;
    try {
      ExcelJS = await loadExcelJs();
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }

    const wb = new ExcelJS.Workbook();
    const sheetTitle = (comp.comp_id || 'รายการ').substring(0, 31);
    const ws = wb.addWorksheet(sheetTitle);
    ws.columns = [
      { width: 6 },   // ลำดับ
      { width: 34 },  // โรงเรียน
      { width: 14 },  // ตำบล
      { width: 32 },  // รายชื่อนักเรียนผู้เข้าแข่งขัน
      { width: 12 },  // ระดับชั้น
      { width: 32 }   // รายชื่อครูผู้ฝึกซ้อม
    ];

    const titles = [
      'รายการกิจกรรมการแข่งขันงานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ระดับกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง ปีการศึกษา 2569',
      'รายการแข่งขัน: [' + comp.comp_id + '] ' + comp.comp_name + ' (ระดับ ' + comp.level + ' • ประเภท' + comp.team_type + ')',
      'ณ โรงเรียนบ้านวังยาววิทยายน'
    ];
    titles.forEach(function (t, i) {
      ws.mergeCells(i + 1, 1, i + 1, 6);
      const cell = ws.getCell(i + 1, 1);
      cell.value = t;
      cell.font = { bold: true, size: i === 0 ? 14 : 12 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const thin = { style: 'thin' };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const header = ws.getRow(4);
    ['ที่', 'โรงเรียน', 'ตำบล', 'ชื่อ - สกุล นักเรียนผู้เข้าแข่งขัน', 'ระดับชั้น', 'ชื่อ - สกุล ครูผู้ฝึกซ้อม'].forEach(
      function (h, i) {
        const c = header.getCell(i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = border;
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1EF' } };
      }
    );

    let rowNo = 5;
    regs.forEach(function (r, idx) {
      const sch = state.schools.find((s) => s.school_name === r.school_name);
      const subdistrict = sch ? sch.subdistrict : '';
      const students = r.students || [];
      const teachers = r.teachers || [];
      const lines = Math.max(students.length, teachers.length, 1);

      for (let i = 0; i < lines; i++) {
        const row = ws.getRow(rowNo++);
        const s = students[i];
        const t = teachers[i];
        const vals =
          i === 0
            ? [
                idx + 1,
                r.school_name,
                subdistrict,
                s ? formatFullNameForPrint(s.prefix, s.name) : '',
                s ? s.grade : '',
                t ? formatFullNameForPrint(t.prefix, t.name) : ''
              ]
            : [
                null,
                null,
                null,
                s ? formatFullNameForPrint(s.prefix, s.name) : '',
                s ? s.grade : '',
                t ? formatFullNameForPrint(t.prefix, t.name) : null
              ];

        vals.forEach(function (v, ci) {
          const c = row.getCell(ci + 1);
          c.value = v;
          c.border = border;
          c.alignment = {
            vertical: 'top',
            wrapText: true,
            horizontal: ci === 0 || ci === 2 || ci === 4 ? 'center' : 'left'
          };
        });
      }
    });

    const safeCompName = comp.comp_name.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = 'ศิลปหัตถกรรมครั้งที่74_' + comp.comp_id + '_' + safeCompName + '.xlsx';

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์ Excel รายการแข่งขันเรียบร้อยแล้ว', 'success');
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
        'เลขที่เกียรติบัตร',
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
        'คะแนน',
        'ระดับเหรียญรางวัล',
        'รางวัล/ลำดับที่',
        'รหัสใบสมัคร'
      ]
    ];

    let seq = 1;
    state.registrations.forEach(function (r) {
      const scoreVal = r.score !== '' && r.score !== undefined && r.score !== null ? r.score : '';
      const medalVal = r.medal || (scoreVal !== '' ? calculateMedalFromScore(scoreVal) : 'เข้าร่วม');
      const awardVal = r.award_title || medalVal;
      const baseCert = r.cert_code || ('CERT-74-' + r.comp_id);

      (r.students || []).forEach(function (s, idx) {
        rows.push([
          seq++,
          baseCert + '-S' + (idx + 1),
          'นักเรียนผู้เข้าแข่งขัน',
          toFullPrefix(s.prefix) || '',
          s.name || '',
          formatFullNameForPrint(s.prefix, s.name),
          s.grade || '',
          r.school_name,
          r.comp_id,
          r.learning_area,
          r.comp_name,
          r.level,
          r.team_type,
          scoreVal,
          medalVal,
          awardVal,
          r.reg_id
        ]);
      });

      (r.teachers || []).forEach(function (t, idx) {
        rows.push([
          seq++,
          baseCert + '-T' + (idx + 1),
          'ครูผู้ฝึกซ้อม',
          toFullPrefix(t.prefix) || '',
          t.name || '',
          formatFullNameForPrint(t.prefix, t.name),
          'ครูผู้ฝึกซ้อม',
          r.school_name,
          r.comp_id,
          r.learning_area,
          r.comp_name,
          r.level,
          r.team_type,
          scoreVal,
          medalVal,
          awardVal,
          r.reg_id
        ]);
      });
    });

    (state.judges || []).forEach(function (j) {
      const jName = j.judge_name || j.full_name || '';
      const jCert = j.cert_code || ('WYK74-' + j.judge_id);
      rows.push([
        seq++,
        jCert,
        'คณะกรรมการตัดสิน',
        toFullPrefix(j.prefix) || '',
        jName,
        formatFullNameForPrint(j.prefix, jName),
        j.role || 'กรรมการตัดสิน',
        j.school_name || '',
        j.comp_id || '',
        j.learning_area || '',
        j.comp_name || '',
        j.level || '',
        'กรรมการตัดสิน',
        '',
        'คณะกรรมการตัดสิน',
        j.role || 'กรรมการตัดสิน',
        j.judge_id
      ]);
    });

    downloadCsvFile('สำหรับทำเกียรติบัตร_1คน1แถว_ศิลปหัตถกรรม74_วังยาวเขวาไร่ดอนกลาง.csv', rows);
    showToast('ดาวน์โหลดไฟล์ CSV สำหรับทำเกียรติบัตร (1 คน 1 แถว) เรียบร้อยแล้ว', 'success');
  }

  // ==========================================
  // PHASE 2: TAB 5 — JUDGES DIRECTORY (ทำเนียบกรรมการตัดสิน)
  // ==========================================
  function renderJudgesTab() {
    const adminAddCard = document.getElementById('adminAddJudgeCard');
    if (adminAddCard) {
      adminAddCard.classList.toggle('hidden', !state.isAdmin);
    }

    const totalBadge = document.getElementById('judgeTotalCountBadge');
    if (totalBadge) totalBadge.textContent = (state.judges || []).length;

    const areaVal = (document.getElementById('judgeAreaFilter') || {}).value || 'ALL';
    const schoolVal = (document.getElementById('judgeSchoolFilter') || {}).value || 'ALL';
    const searchVal = ((document.getElementById('judgeSearchInput') || {}).value || '').trim().toLowerCase();

    const filtered = (state.judges || []).filter(function (j) {
      const jName = j.judge_name || j.full_name || '';
      if (areaVal !== 'ALL' && j.learning_area !== areaVal) return false;
      if (schoolVal !== 'ALL' && j.school_name !== schoolVal) return false;
      if (searchVal) {
        const hay = (
          jName +
          ' ' +
          (j.comp_id || '') +
          ' ' +
          (j.comp_name || '') +
          ' ' +
          (j.school_name || '') +
          ' ' +
          (j.role || '')
        ).toLowerCase();
        if (!hay.includes(searchVal)) return false;
      }
      return true;
    });

    const tbody = document.getElementById('judgesTableBody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400">
            ไม่พบรายชื่อคณะกรรมการตัดสินตามเงื่อนไขที่เลือก
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map(function (j, idx) {
        const jName = j.judge_name || j.full_name || '';
        const fullName = (j.prefix || '') + jName;
        const roleBadgeClass =
          j.role === 'ประธานกรรมการ'
            ? 'bg-amber-50 text-amber-800 border border-amber-200'
            : j.role === 'กรรมการและเลขานุการ'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-slate-100 text-slate-700 border border-slate-200';

        const deleteBtn = state.isAdmin
          ? `<button type="button" data-del-judge="${escapeHtml(j.judge_id)}" class="px-2 py-1 rounded text-xs font-heading text-rose-600 hover:bg-rose-50">ลบ</button>`
          : '';

        return `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-3 px-3 text-xs font-heading text-slate-500">${idx + 1}</td>
            <td class="py-3 px-3">
              <div class="text-xs font-heading text-slate-500">${escapeHtml(j.comp_id)} • ${escapeHtml(j.learning_area)}</div>
              <div class="font-medium text-slate-900">${escapeHtml(j.comp_name)}</div>
            </td>
            <td class="py-3 px-2 text-center">
              <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-heading">${escapeHtml(j.level)}</span>
            </td>
            <td class="py-3 px-3 font-heading font-semibold text-slate-900">${escapeHtml(fullName)}</td>
            <td class="py-3 px-3 text-xs text-slate-700">${escapeHtml(j.school_name)}</td>
            <td class="py-3 px-2 text-center">
              <span class="px-2.5 py-0.5 rounded-md text-xs font-heading font-medium ${roleBadgeClass}">${escapeHtml(j.role || 'กรรมการ')}</span>
            </td>
            <td class="py-3 px-2 text-right whitespace-nowrap space-x-1">
              <button type="button" data-print-judge-id="${escapeHtml(j.judge_id)}" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-heading text-xs font-medium">
                บัตรกรรมการ
              </button>
              <button type="button" data-print-judge-cert="${escapeHtml(j.judge_id)}" class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-medium">
                เกียรติบัตร
              </button>
              ${deleteBtn}
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('[data-print-judge-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const jId = btn.getAttribute('data-print-judge-id');
        const judge = (state.judges || []).find((x) => x.judge_id === jId);
        if (judge) printJudgeIdCard(judge);
      });
    });

    tbody.querySelectorAll('[data-print-judge-cert]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const jId = btn.getAttribute('data-print-judge-cert');
        const judge = (state.judges || []).find((x) => x.judge_id === jId);
        if (judge) {
          const jName = judge.judge_name || judge.full_name || '';
          printCertificatesWindow([
            {
              cert_code: judge.cert_code || ('WYK74-' + judge.judge_id),
              role_type: 'JUDGE',
              role_label: 'คณะกรรมการตัดสิน',
              recipient_name: formatFullNameForPrint(judge.prefix, jName),
              school_name: judge.school_name || '',
              comp_id: judge.comp_id || '',
              comp_name: judge.comp_name || '',
              learning_area: judge.learning_area || '',
              level: judge.level || '',
              medal: 'คณะกรรมการตัดสิน',
              award_title: 'ปฏิบัติหน้าที่ ' + (judge.role || 'กรรมการตัดสิน')
            }
          ]);
        }
      });
    });

    tbody.querySelectorAll('[data-del-judge]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!state.isAdmin) return;
        const jId = btn.getAttribute('data-del-judge');
        const judge = (state.judges || []).find((x) => x.judge_id === jId);
        if (!judge) return;
        const jName = judge.judge_name || judge.full_name || '';
        const ok = window.confirm('ยืนยันการลบรายชื่อกรรมการ "' + (judge.prefix || '') + jName + '" ใช่หรือไม่?');
        if (!ok) return;
        state.judges = state.judges.filter((x) => x.judge_id !== jId);
        saveState();
        await postToGoogleSheets({
          action: 'delete_judge',
          judge_id: jId,
          admin_pin: state.adminPin
        });
        renderAll();
        showToast('ลบรายชื่อกรรมการเรียบร้อยแล้ว', 'warning');
      });
    });
  }

  // ==========================================
  // PHASE 2: TAB 6 — RESULTS & MEDAL SUMMARY (3 SUBVIEWS)
  // ==========================================
  function renderResultsTab() {
    // Subview buttons state
    document.querySelectorAll('.result-subview-btn').forEach(function (btn) {
      const sv = btn.getAttribute('data-result-subview');
      if (sv === state.resultSubview) {
        btn.className =
          'result-subview-btn px-3.5 py-2 rounded-lg font-heading text-xs font-semibold bg-slate-900 text-white transition';
      } else {
        btn.className =
          'result-subview-btn px-3.5 py-2 rounded-lg font-heading text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    });

    const viewComp = document.getElementById('resultSubviewByComp');
    const viewRank = document.getElementById('resultSubviewByRank');
    const viewMedal = document.getElementById('resultSubviewByMedal');
    if (viewComp) viewComp.classList.toggle('hidden', state.resultSubview !== 'by-comp');
    if (viewRank) viewRank.classList.toggle('hidden', state.resultSubview !== 'by-rank');
    if (viewMedal) viewMedal.classList.toggle('hidden', state.resultSubview !== 'by-medal');

    // Update district representative criteria badge text
    const criteriaTextEl = document.getElementById('resDistrictCriteriaText');
    if (criteriaTextEl) {
      const criteria = (state.config && state.config.districtRepCriteria) || 'rank_1';
      criteriaTextEl.textContent = getDistrictRepCriteriaLabel(criteria);
    }

    // Group registrations by comp_id
    const regsByComp = {};
    state.registrations.forEach(function (r) {
      if (!regsByComp[r.comp_id]) regsByComp[r.comp_id] = [];
      regsByComp[r.comp_id].push(r);
    });

    // 1. Render Subview: By Competition
    const resArea = (document.getElementById('resAreaFilter') || {}).value || 'ALL';
    const resStatus = (document.getElementById('resStatusFilter') || {}).value || 'ACTIVE';
    const resSearch = ((document.getElementById('resSearchInput') || {}).value || '').trim().toLowerCase();

    const filteredComps = state.competitions.filter(function (c) {
      const regs = regsByComp[c.comp_id] || [];
      const hasScores = regs.some((r) => r.score !== '' && r.score !== undefined && r.score !== null);
      const isAnnounced = c.result_status === 'ประกาศผลแล้ว' || hasScores;

      if (resArea !== 'ALL' && c.learning_area !== resArea) return false;
      if (resStatus === 'ACTIVE' && regs.length === 0) return false;
      if (resStatus === 'ANNOUNCED' && !isAnnounced) return false;
      if (resStatus === 'PENDING' && (regs.length === 0 || isAnnounced)) return false;

      if (resSearch) {
        const regSchools = regs.map((r) => r.school_name).join(' ');
        const hay = (c.comp_id + ' ' + c.comp_name + ' ' + c.learning_area + ' ' + regSchools).toLowerCase();
        if (!hay.includes(resSearch)) return false;
      }
      return true;
    });

    const listContainer = document.getElementById('resultsCompetitionList');
    if (listContainer) {
      if (filteredComps.length === 0) {
        listContainer.innerHTML = `
          <div class="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
            ไม่พบรายการแข่งขันตามตัวกรองที่เลือก
          </div>
        `;
      } else {
        listContainer.innerHTML = filteredComps
          .map(function (c) {
            const regs = (regsByComp[c.comp_id] || []).slice().sort(function (a, b) {
              const sa = a.score !== '' && a.score !== undefined && a.score !== null ? Number(a.score) : -1;
              const sb = b.score !== '' && b.score !== undefined && b.score !== null ? Number(b.score) : -1;
              return sb - sa;
            });
            const hasScores = regs.some((r) => r.score !== '' && r.score !== undefined && r.score !== null);
            const isAnnounced = c.result_status === 'ประกาศผลแล้ว' || hasScores;

            const statusBadge = isAnnounced
              ? `<span class="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-heading text-xs font-semibold">ประกาศผลแล้ว</span>`
              : regs.length > 0
              ? `<span class="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-heading text-xs font-medium">รอบันทึกผล (${regs.length} ทีม)</span>`
              : `<span class="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-heading text-xs">ไม่มีทีมสมัคร</span>`;

            const adminBtn = state.isAdmin
              ? `<button type="button" data-open-score="${escapeHtml(c.comp_id)}" class="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-heading text-xs font-semibold transition">บันทึก/แก้ไขคะแนน</button>`
              : '';

            const printResultBtn =
              regs.length > 0
                ? `<button type="button" data-print-result="${escapeHtml(c.comp_id)}" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-heading text-xs font-medium transition">พิมพ์ใบประกาศผล</button>`
                : '';

            const rowsHtml =
              regs.length === 0
                ? `<tr><td colspan="6" class="py-4 text-center text-xs text-slate-400">ยังไม่มีโรงเรียนส่งเข้าแข่งขันในรายการนี้</td></tr>`
                : regs
                    .map(function (r) {
                      const hasSc = r.score !== '' && r.score !== undefined && r.score !== null;
                      const scoreDisplay = hasSc ? Number(r.score).toFixed(2) : '-';
                      const medal = r.medal || (hasSc ? calculateMedalFromScore(r.score) : '');
                      const rankDisplay = r.rank ? 'อันดับ ' + r.rank : '-';
                      const awardDisplay = r.award_title || (hasSc ? getAwardTitleFromRank(r.rank, medal) : 'รอประกาศผล');
                      const isRep = Number(r.rank) === 1 && hasSc && Number(r.score) >= 80;
                      const repBadge = isRep
                        ? `<span class="ml-1.5 inline-block px-2 py-0.5 rounded bg-slate-900 text-white font-heading text-[10px] font-semibold">ตัวแทนกลุ่มฯ</span>`
                        : '';
                      const stuNames = (r.students || []).map((s, idx) => idx + 1 + '. ' + formatResponsiveNameHtml(s.prefix, s.name)).join('<br>');

                      return `
                        <tr class="hover:bg-slate-50">
                          <td class="py-2.5 px-3 font-heading font-semibold text-slate-900 text-center w-24">${escapeHtml(rankDisplay)}</td>
                          <td class="py-2.5 px-3 font-heading font-semibold text-slate-900">
                            ${escapeHtml(r.school_name)}
                            ${repBadge}
                          </td>
                          <td class="py-2.5 px-3 text-xs text-slate-700">${stuNames}</td>
                          <td class="py-2.5 px-3 text-center font-heading font-bold text-slate-900">${escapeHtml(scoreDisplay)}</td>
                          <td class="py-2.5 px-3 text-center">${renderMedalBadgeHtml(medal)}</td>
                          <td class="py-2.5 px-3 text-xs font-heading text-slate-700">${escapeHtml(awardDisplay)}</td>
                        </tr>
                      `;
                    })
                    .join('');

            return `
              <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div class="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                      <span class="px-2 py-0.5 rounded bg-slate-900 text-white font-heading text-xs font-semibold">${escapeHtml(c.comp_id)}</span>
                      <span class="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-heading text-xs">${escapeHtml(c.learning_area)}</span>
                      <span class="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-heading text-xs">${escapeHtml(c.level)}</span>
                      ${statusBadge}
                    </div>
                    <h3 class="text-sm sm:text-base font-bold font-heading text-slate-900">${escapeHtml(c.comp_name)}</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      วันเวลา: ${escapeHtml(c.comp_date || '24–25 พฤศจิกายน 2569')} (${escapeHtml(c.comp_time || '09.00 - 12.00 น.')}) • สถานที่: ${escapeHtml(c.venue_room || 'อาคารเรียนหลัก')}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    ${adminBtn}
                    ${printResultBtn}
                  </div>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm text-left">
                    <thead class="text-xs font-heading text-slate-500 bg-white border-b border-slate-100">
                      <tr>
                        <th class="py-2 px-3 text-center w-24">อันดับ</th>
                        <th class="py-2 px-3">โรงเรียน</th>
                        <th class="py-2 px-3">นักเรียนผู้เข้าแข่งขัน</th>
                        <th class="py-2 px-3 text-center">คะแนน</th>
                        <th class="py-2 px-3 text-center">ระดับเหรียญ</th>
                        <th class="py-2 px-3">รางวัลที่ได้</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${rowsHtml}</tbody>
                  </table>
                </div>
              </div>
            `;
          })
          .join('');

        listContainer.querySelectorAll('[data-open-score]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            openScoreEntryModal(btn.getAttribute('data-open-score'));
          });
        });

        listContainer.querySelectorAll('[data-print-result]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            printCompetitionResultSheet(btn.getAttribute('data-print-result'));
          });
        });
      }
    }

    // 2. Render Subview: By School Rank (ชนะเลิศ / รองชนะเลิศ) & 3. By School Medal
    const schoolStats = state.schools.map(function (s) {
      const regs = state.registrations.filter((r) => r.school_name === s.school_name);
      let rank1 = 0;
      let rank2 = 0;
      let rank3 = 0;
      let rankOther = 0;
      let gold = 0;
      let silver = 0;
      let bronze = 0;
      let part = 0;

      regs.forEach(function (r) {
        const rk = Number(r.rank || 0);
        if (rk === 1) rank1++;
        else if (rk === 2) rank2++;
        else if (rk === 3) rank3++;
        else if (rk > 3) rankOther++;

        const m = r.medal || (r.score !== '' && r.score !== undefined ? calculateMedalFromScore(r.score) : '');
        if (m === 'เหรียญทอง') gold++;
        else if (m === 'เหรียญเงิน') silver++;
        else if (m === 'เหรียญทองแดง') bronze++;
        else if (m) part++;
      });

      return {
        school_name: s.school_name,
        total_regs: regs.length,
        rank1: rank1,
        rank2: rank2,
        rank3: rank3,
        rankOther: rankOther,
        gold: gold,
        silver: silver,
        bronze: bronze,
        part: part,
        total_medals: gold + silver + bronze + part
      };
    });

    // Sort for Rank table
    const rankSorted = schoolStats.slice().sort(function (a, b) {
      if (b.rank1 !== a.rank1) return b.rank1 - a.rank1;
      if (b.rank2 !== a.rank2) return b.rank2 - a.rank2;
      if (b.rank3 !== a.rank3) return b.rank3 - a.rank3;
      return b.total_regs - a.total_regs;
    });

    const rankBody = document.getElementById('resultsSchoolRankBody');
    if (rankBody) {
      rankBody.innerHTML = rankSorted
        .map(function (st, idx) {
          return `
            <tr class="hover:bg-slate-50">
              <td class="py-2.5 px-3 text-center font-heading font-semibold text-slate-600">${idx + 1}</td>
              <td class="py-2.5 px-3 font-heading font-semibold text-slate-900">${escapeHtml(st.school_name)}</td>
              <td class="py-2.5 px-3 text-center font-heading font-bold text-amber-800 bg-amber-50/40">${st.rank1}</td>
              <td class="py-2.5 px-3 text-center font-heading font-semibold text-slate-700">${st.rank2}</td>
              <td class="py-2.5 px-3 text-center font-heading font-semibold text-slate-700">${st.rank3}</td>
              <td class="py-2.5 px-3 text-center font-heading text-slate-500">${st.rankOther}</td>
              <td class="py-2.5 px-3 text-center font-heading font-bold text-slate-900">${st.total_regs}</td>
            </tr>
          `;
        })
        .join('');
    }

    // Sort for Medal table
    const medalSorted = schoolStats.slice().sort(function (a, b) {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.total_regs - a.total_regs;
    });

    let totalGold = 0;
    let totalSilver = 0;
    let totalBronze = 0;
    let totalPart = 0;
    schoolStats.forEach(function (st) {
      totalGold += st.gold;
      totalSilver += st.silver;
      totalBronze += st.bronze;
      totalPart += st.part;
    });

    const elGoldTot = document.getElementById('medalSummaryGoldTotal');
    const elSilvTot = document.getElementById('medalSummarySilverTotal');
    const elBronTot = document.getElementById('medalSummaryBronzeTotal');
    const elPartTot = document.getElementById('medalSummaryPartTotal');
    if (elGoldTot) elGoldTot.textContent = totalGold;
    if (elSilvTot) elSilvTot.textContent = totalSilver;
    if (elBronTot) elBronTot.textContent = totalBronze;
    if (elPartTot) elPartTot.textContent = totalPart;

    const medalBody = document.getElementById('resultsSchoolMedalBody');
    if (medalBody) {
      medalBody.innerHTML = medalSorted
        .map(function (st, idx) {
          return `
            <tr class="hover:bg-slate-50">
              <td class="py-2.5 px-3 text-center font-heading font-semibold text-slate-600">${idx + 1}</td>
              <td class="py-2.5 px-3 font-heading font-semibold text-slate-900">${escapeHtml(st.school_name)}</td>
              <td class="py-2.5 px-3 text-center font-heading font-bold text-amber-800">${st.gold}</td>
              <td class="py-2.5 px-3 text-center font-heading font-semibold text-slate-700">${st.silver}</td>
              <td class="py-2.5 px-3 text-center font-heading font-semibold text-orange-800">${st.bronze}</td>
              <td class="py-2.5 px-3 text-center font-heading text-slate-600">${st.part}</td>
              <td class="py-2.5 px-3 text-center font-heading font-bold text-slate-900">${st.total_medals}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // ==========================================
  // PHASE 2: SCORE ENTRY & SCHEDULE MODALS (ADMIN)
  // ==========================================
  function openScoreEntryModal(compId) {
    if (!state.isAdmin) {
      showToast('เฉพาะแอดมินเท่านั้นที่สามารถบันทึกคะแนนได้', 'error');
      return;
    }
    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) return;

    const regs = state.registrations.filter((r) => r.comp_id === compId);
    if (regs.length === 0) {
      showToast('ยังไม่มีโรงเรียนสมัครในรายการนี้', 'warning');
      return;
    }

    document.getElementById('scoreModalCompId').value = compId;
    document.getElementById('scoreModalCompTitle').textContent =
      '[' + comp.comp_id + '] ' + comp.comp_name + ' (' + comp.level + ')';

    const tbody = document.getElementById('scoreModalTableBody');
    tbody.innerHTML = regs
      .map(function (r) {
        const stuText = (r.students || []).map((s, i) => i + 1 + '. ' + formatResponsiveNameHtml(s.prefix, s.name)).join('<br>');
        const scVal = r.score !== '' && r.score !== undefined && r.score !== null ? r.score : '';
        const medal = scVal !== '' ? calculateMedalFromScore(scVal) : '';
        return `
          <tr data-score-reg-id="${escapeHtml(r.reg_id)}">
            <td class="py-2.5 px-3 font-heading font-semibold text-slate-900">${escapeHtml(r.school_name)}</td>
            <td class="py-2.5 px-3 text-xs text-slate-600">${stuText}</td>
            <td class="py-2.5 px-3 text-center">
              <input type="number" step="0.01" min="0" max="100" value="${escapeHtml(scVal)}" placeholder="0 - 100" class="score-input-field w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-center font-heading font-bold focus:border-slate-900 focus:outline-none" />
            </td>
            <td class="py-2.5 px-3 text-center score-preview-medal">${renderMedalBadgeHtml(medal)}</td>
            <td class="py-2.5 px-3 text-center text-xs font-heading text-slate-700 score-preview-rank">${escapeHtml(r.award_title || '-')}</td>
          </tr>
        `;
      })
      .join('');

    function recalculateLivePreview() {
      const rowEls = Array.from(tbody.querySelectorAll('tr[data-score-reg-id]'));
      const scored = rowEls
        .map(function (tr) {
          const valStr = tr.querySelector('.score-input-field').value.trim();
          const num = valStr !== '' ? Number(valStr) : null;
          return { tr: tr, score: num };
        })
        .filter((x) => x.score !== null && !Number.isNaN(x.score))
        .sort((a, b) => b.score - a.score);

      let currentRank = 1;
      for (let i = 0; i < scored.length; i++) {
        if (i > 0 && scored[i].score < scored[i - 1].score) {
          currentRank = i + 1;
        }
        scored[i].rank = currentRank;
      }

      rowEls.forEach(function (tr) {
        const valStr = tr.querySelector('.score-input-field').value.trim();
        const medalCell = tr.querySelector('.score-preview-medal');
        const rankCell = tr.querySelector('.score-preview-rank');
        if (valStr === '' || Number.isNaN(Number(valStr))) {
          medalCell.innerHTML = renderMedalBadgeHtml('');
          rankCell.textContent = '-';
        } else {
          const sc = Number(valStr);
          const medal = calculateMedalFromScore(sc);
          const found = scored.find((x) => x.tr === tr);
          const rk = found ? found.rank : '';
          medalCell.innerHTML = renderMedalBadgeHtml(medal);
          rankCell.textContent = getAwardTitleFromRank(rk, medal);
        }
      });
    }

    tbody.querySelectorAll('.score-input-field').forEach(function (inp) {
      inp.addEventListener('input', recalculateLivePreview);
    });
    recalculateLivePreview();

    const modal = document.getElementById('scoreEntryModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeScoreEntryModal() {
    const modal = document.getElementById('scoreEntryModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async function handleScoreEntrySubmit(e) {
    e.preventDefault();
    if (!state.isAdmin) return;

    const compId = document.getElementById('scoreModalCompId').value;
    const publishNow = document.getElementById('scoreModalPublishCheck').checked;
    const tbody = document.getElementById('scoreModalTableBody');
    const rowEls = Array.from(tbody.querySelectorAll('tr[data-score-reg-id]'));

    const entries = rowEls.map(function (tr) {
      const regId = tr.getAttribute('data-score-reg-id');
      const valStr = tr.querySelector('.score-input-field').value.trim();
      const num = valStr !== '' && !Number.isNaN(Number(valStr)) ? Number(valStr) : '';
      return { reg_id: regId, score: num };
    });

    // Rank calculation
    const valid = entries.filter((x) => x.score !== '').sort((a, b) => b.score - a.score);
    let currentRank = 1;
    for (let i = 0; i < valid.length; i++) {
      if (i > 0 && valid[i].score < valid[i - 1].score) {
        currentRank = i + 1;
      }
      valid[i].rank = currentRank;
    }

    const batchPayload = [];
    entries.forEach(function (item) {
      const reg = state.registrations.find((r) => r.reg_id === item.reg_id);
      if (!reg) return;
      if (item.score === '') {
        reg.score = '';
        reg.medal = '';
        reg.rank = '';
        reg.award_title = '';
      } else {
        const sc = Math.min(100, Math.max(0, Number(item.score)));
        const medal = calculateMedalFromScore(sc);
        const found = valid.find((v) => v.reg_id === item.reg_id);
        const rk = found ? found.rank : '';
        const award = getAwardTitleFromRank(rk, medal);
        const cert = reg.cert_code || ('CERT-74-' + compId + '-' + String(rk || 1).padStart(2, '0'));
        reg.score = sc;
        reg.medal = medal;
        reg.rank = rk;
        reg.award_title = award;
        reg.cert_code = cert;
      }
      batchPayload.push({
        reg_id: reg.reg_id,
        score: reg.score,
        medal: reg.medal,
        rank: reg.rank,
        award_title: reg.award_title,
        cert_code: reg.cert_code
      });
    });

    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (comp) {
      comp.result_status = publishNow ? 'ประกาศผลแล้ว' : 'รอประกาศผล';
    }

    saveState();
    closeScoreEntryModal();
    renderAll();

    await postToGoogleSheets({
      action: 'save_scores_batch',
      comp_id: compId,
      result_status: publishNow ? 'ประกาศผลแล้ว' : 'รอประกาศผล',
      scores: batchPayload,
      admin_pin: state.adminPin
    });

    showToast('บันทึกคะแนนและคำนวณเหรียญรางวัลเรียบร้อยแล้ว', 'success');
  }

  function openScheduleEditModal(compId) {
    if (!state.isAdmin) return;
    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) return;

    document.getElementById('scheduleModalCompId').value = comp.comp_id;
    document.getElementById('scheduleModalCompDesc').textContent =
      '[' + comp.comp_id + '] ' + comp.comp_name + ' (' + comp.level + ')';
    document.getElementById('scheduleDateInput').value = comp.comp_date || '24–25 พฤศจิกายน 2569';
    document.getElementById('scheduleTimeInput').value = comp.comp_time || '09.00 - 12.00 น.';
    document.getElementById('scheduleBuildingInput').value =
      comp.venue_building || 'สนามแข่งขันกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง';
    document.getElementById('scheduleRoomInput').value = comp.venue_room || 'อาคารเรียนหลัก';

    const modal = document.getElementById('scheduleEditModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeScheduleEditModal() {
    const modal = document.getElementById('scheduleEditModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async function handleScheduleEditSubmit(e) {
    e.preventDefault();
    if (!state.isAdmin) return;
    const compId = document.getElementById('scheduleModalCompId').value;
    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) return;

    comp.comp_date = document.getElementById('scheduleDateInput').value.trim();
    comp.comp_time = document.getElementById('scheduleTimeInput').value.trim();
    comp.venue_building = document.getElementById('scheduleBuildingInput').value.trim();
    comp.venue_room = document.getElementById('scheduleRoomInput').value.trim();

    saveState();
    closeScheduleEditModal();
    renderAll();

    await postToGoogleSheets({
      action: 'update_competition_schedule',
      comp_id: comp.comp_id,
      comp_date: comp.comp_date,
      comp_time: comp.comp_time,
      venue_building: comp.venue_building,
      venue_room: comp.venue_room,
      result_status: comp.result_status || 'รอประกาศผล',
      admin_pin: state.adminPin
    });

    showToast('อัปเดตวันเวลาและสถานที่แข่งขันเรียบร้อยแล้ว', 'success');
  }

  // ==========================================
  // PHASE 2: TAB 7 — ONLINE CERTIFICATES (เกียรติบัตรออนไลน์)
  // ==========================================
  function buildAllCertificateEntries() {
    const entries = [];
    const prefix = (state.config && state.config.certPrefix) ? state.config.certPrefix : 'WYK74-2569-';
    state.registrations.forEach(function (r) {
      const hasScore = r.score !== '' && r.score !== undefined && r.score !== null;
      const medal = r.medal || (hasScore ? calculateMedalFromScore(r.score) : 'เข้าร่วมการแข่งขัน');
      const award = r.award_title || (hasScore ? getAwardTitleFromRank(r.rank, medal) : 'เข้าร่วมการแข่งขัน');
      const baseCert = r.cert_code || (prefix + r.comp_id);

      (r.students || []).forEach(function (s, idx) {
        entries.push({
          cert_code: baseCert + '-S' + (idx + 1),
          role_type: 'STUDENT',
          role_label: 'นักเรียนผู้เข้าแข่งขัน',
          recipient_name: formatFullNameForPrint(s.prefix, s.name),
          grade_or_pos: 'นักเรียนชั้น ' + (s.grade || '-'),
          school_name: r.school_name,
          comp_id: r.comp_id,
          comp_name: r.comp_name,
          learning_area: r.learning_area,
          level: r.level,
          score: r.score,
          medal: medal,
          award_title: award
        });
      });

      (r.teachers || []).forEach(function (t, idx) {
        entries.push({
          cert_code: baseCert + '-T' + (idx + 1),
          role_type: 'TEACHER',
          role_label: 'ครูผู้ฝึกซ้อม',
          recipient_name: formatFullNameForPrint(t.prefix, t.name),
          grade_or_pos: 'ครูผู้ฝึกซ้อมนักเรียน',
          school_name: r.school_name,
          comp_id: r.comp_id,
          comp_name: r.comp_name,
          learning_area: r.learning_area,
          level: r.level,
          score: r.score,
          medal: medal,
          award_title: 'ครูผู้ฝึกซ้อมนักเรียน รางวัล' + award
        });
      });
    });

    (state.judges || []).forEach(function (j, idx) {
      const jName = j.judge_name || j.full_name || '';
      entries.push({
        cert_code: j.cert_code || (prefix + (j.judge_id || ('J' + (idx + 1)))),
        role_type: 'JUDGE',
        role_label: 'คณะกรรมการตัดสิน',
        recipient_name: formatFullNameForPrint(j.prefix, jName),
        grade_or_pos: j.role || 'กรรมการตัดสิน',
        school_name: j.school_name || '',
        comp_id: j.comp_id || '',
        comp_name: j.comp_name || '',
        learning_area: j.learning_area || '',
        level: j.level || '',
        score: '',
        medal: 'คณะกรรมการตัดสิน',
        award_title: 'ปฏิบัติหน้าที่ ' + (j.role || 'กรรมการตัดสิน')
      });
    });

    return entries;
  }

  function getFilteredCertificateEntries() {
    const roleFilter = (document.getElementById('certRoleFilter') || {}).value || 'ALL';
    const schoolFilter = (document.getElementById('certSchoolFilter') || {}).value || 'ALL';
    const searchVal = ((document.getElementById('certSearchInput') || {}).value || '').trim().toLowerCase();

    return buildAllCertificateEntries().filter(function (item) {
      if (roleFilter !== 'ALL' && item.role_type !== roleFilter) return false;
      if (schoolFilter !== 'ALL' && item.school_name !== schoolFilter) return false;
      if (searchVal) {
        const hay = (
          item.cert_code +
          ' ' +
          item.recipient_name +
          ' ' +
          item.school_name +
          ' ' +
          item.comp_id +
          ' ' +
          item.comp_name +
          ' ' +
          item.award_title
        ).toLowerCase();
        if (!hay.includes(searchVal)) return false;
      }
      return true;
    });
  }

  function renderCertificatesTab() {
    const tbody = document.getElementById('certificatesTableBody');
    if (!tbody) return;

    const filtered = getFilteredCertificateEntries();
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400">
            ไม่พบรายการเกียรติบัตรตามเงื่อนไขที่ค้นหา
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map(function (item, idx) {
        const typeBadge =
          item.role_type === 'STUDENT'
            ? '<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-heading text-xs">นักเรียน</span>'
            : item.role_type === 'TEACHER'
            ? '<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-heading text-xs">ครูผู้ฝึกซ้อม</span>'
            : '<span class="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-heading text-xs">กรรมการตัดสิน</span>';

        return `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-2.5 px-3 font-mono text-xs text-slate-600">${escapeHtml(item.cert_code)}</td>
            <td class="py-2.5 px-2 text-center">${typeBadge}</td>
            <td class="py-2.5 px-3 font-heading font-semibold text-slate-900">${escapeHtml(formatFullNameForPrint('', item.recipient_name))}</td>
            <td class="py-2.5 px-3 text-xs text-slate-700">${escapeHtml(item.school_name)}</td>
            <td class="py-2.5 px-3 text-xs text-slate-700">
              <span class="font-heading font-medium text-slate-900">[${escapeHtml(item.comp_id)}]</span> ${escapeHtml(item.comp_name)} (${escapeHtml(item.level)})
            </td>
            <td class="py-2.5 px-2 text-center">${renderMedalBadgeHtml(item.medal)}</td>
            <td class="py-2.5 px-2 text-right">
              <button type="button" data-print-cert-idx="${idx}" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-medium transition">
                พิมพ์เกียรติบัตร
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('[data-print-cert-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.getAttribute('data-print-cert-idx'));
        if (filtered[i]) {
          printCertificatesWindow([filtered[i]]);
        }
      });
    });
  }

  // Utility: Convert Arabic digits to Thai numerals (เลขไทย)
  function toThaiNumerals(str) {
    if (str === null || str === undefined) return '';
    const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return String(str).replace(/[0-9]/g, function (d) {
      return thaiDigits[Number(d)];
    });
  }

  // Print Official Landscape Certificates (Thai Luxury Khit / Mudmee Background + Official MOE & OBEC Logos)
  function printCertificatesWindow(entries) {
    if (!entries || entries.length === 0) {
      showToast('ไม่มีรายการเกียรติบัตรที่เลือกพิมพ์', 'warning');
      return;
    }

    const cfg = state.config || DEFAULT_CONFIG;
    const baseDir = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const defaultCertBgUrl = baseDir + 'assets/cert-bg-thai.jpg';
    const logoMoeUrl = baseDir + 'assets/logo-moe.svg';
    const logoObecUrl = baseDir + 'assets/logo-obec.svg';
    const certWatermarkUrl = baseDir + 'assets/watermark-hybrid-frameless.svg';

    const certBgUrl =
      cfg.certBgMode === 'canva' && cfg.certBgImageUrl ? cfg.certBgImageUrl : defaultCertBgUrl;
    const signerOrg = cfg.certSignerOrg || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3';
    const signerName = cfg.certSignerName || 'นายกิจภูมิ บุญอบ';
    const signerPos = cfg.certSignerPos || 'ประธานกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง';
    const rawIssueDate = cfg.certIssueDate || '25 พฤศจิกายน พุทธศักราช 2569';
    let thaiIssueDate = toThaiNumerals(rawIssueDate);
    if (!thaiIssueDate.includes('เดือน')) {
      thaiIssueDate = thaiIssueDate.replace(/^([^\s]+)\s+([^\s]+)\s+/, '$1 เดือน $2 ');
    }

    const pagesHtml = entries
      .map(function (c) {
        const verifyUrl = encodeURIComponent('https://campingroom.github.io/talent69/#cert=' + c.cert_code);
        const sigHtml = cfg.certSignatureUrl
          ? `<div class="sign-img-wrap"><img src="${cfg.certSignatureUrl}" alt="ลายมือชื่อ" class="cert-signature-img" /></div>`
          : `<div class="sign-line">........................................................</div>`;
        const signerNameHtml = signerName
          ? `<div class="sign-name">(${escapeHtml(signerName)})</div>`
          : '';

        const isJudge = c.role_type === 'JUDGE' || c.role_type === 'REFEREE';
        let awardDisplay = '';
        if (isJudge) {
          awardDisplay = 'ได้ปฏิบัติหน้าที่คณะกรรมการตัดสินการแข่งขัน';
        } else {
          const medal = c.medal ? escapeHtml(c.medal) : 'เข้าร่วมการแข่งขัน';
          const title = escapeHtml(c.award_title || 'รางวัลเข้าร่วม');
          awardDisplay = title.includes(medal) ? title : `ได้รับรางวัลระดับ${medal} ${title}`;
        }

        let schoolDisplay = '';
        if (isJudge) {
          schoolDisplay = c.grade_or_pos
            ? escapeHtml(c.grade_or_pos)
            : (c.school_name ? `โรงเรียน${escapeHtml(c.school_name.replace(/^โรงเรียน/, ''))}` : 'คณะกรรมการตัดสิน');
        } else {
          schoolDisplay = c.school_name
            ? `โรงเรียน${escapeHtml(c.school_name.replace(/^โรงเรียน/, ''))}`
            : '';
        }

        const cleanCompName = (c.comp_name || '').replace(/^[A-Z0-9-]+\s*[:\-]\s*/, '').trim();
        const cleanLevel = (c.level || '').trim();
        const activityText = cleanLevel
          ? `กิจกรรม ${escapeHtml(cleanCompName)} ระดับชั้น ${escapeHtml(cleanLevel)}`
          : `กิจกรรม ${escapeHtml(cleanCompName)}`;

        return `
          <div class="cert-page">
            <div class="cert-watermark-layer">
              <img src="${certWatermarkUrl}" alt="" class="cert-watermark-img" />
            </div>
            <div class="cert-inner">
              <!-- Top Row: Certificate Code -->
              <div class="cert-top-row">
                <div class="cert-top-code-pill">เลขที่ ${escapeHtml(toThaiNumerals(c.cert_code))}</div>
              </div>

              <!-- Central Official Emblem: OBEC (ตรา สพฐ.) -->
              <div class="cert-logos-row">
                <img src="${logoObecUrl}" alt="ตราสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน" class="cert-logo-img cert-logo-obec" />
              </div>

              <!-- Header Organization -->
              <div class="cert-header-block">
                <div class="cert-header-org">กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง</div>
                <div class="cert-header-suborg">${escapeHtml(toThaiNumerals(signerOrg))}</div>
                <div class="cert-subtitle">ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</div>
              </div>

              <!-- Recipient Section -->
              <div class="cert-recipient-block">
                <div class="cert-recipient-name">${escapeHtml(formatFullNameForPrint('', c.recipient_name))}</div>
                <div class="cert-recipient-school">${schoolDisplay}</div>
              </div>

              <!-- Award & Activity Section -->
              <div class="cert-award-block">
                <div class="cert-award">${awardDisplay}</div>
                <div class="cert-activity">${activityText}</div>
              </div>

              <!-- Event & Ceremony Details -->
              <div class="cert-event-block">
                <div class="cert-event-title">งานศิลปหัตถกรรมนักเรียน ระดับกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง ครั้งที่ ๗๔ ประจำปีการศึกษา ๒๕๖๙</div>
                <div class="cert-event-dates">ระหว่างวันที่ ๒๔ - ๒๕ พฤศจิกายน พ.ศ. ๒๕๖๙</div>
                <div class="cert-blessing">ขอให้มีความวิริยะ อุตสาหะ และความสามารถของท่านเป็นที่ประจักษ์ต่อไป</div>
                <div class="cert-issue-date">ให้ไว้ ณ วันที่ ${escapeHtml(thaiIssueDate)}</div>
              </div>

              <!-- Footer: QR Verification & Authorized Signer -->
              <div class="cert-footer">
                <div class="cert-qr">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${verifyUrl}" alt="QR Verify" class="cert-qr-img" width="64" height="64" />
                  <div class="cert-qr-label">สแกนตรวจสอบเกียรติบัตร</div>
                  <div class="cert-qr-code">${escapeHtml(c.cert_code)}</div>
                </div>
                <div class="cert-sign">
                  ${sigHtml}
                  ${signerNameHtml}
                  <div class="sign-pos">${escapeHtml(signerPos)}</div>
                  <div class="sign-org">${escapeHtml(signerOrg)}</div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <base href="${baseDir}" />
  <title>เกียรติบัตรออนไลน์ - งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74</title>
  <link href="https://fonts.googleapis.com/css2?family=Niramit:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Prompt:wght@500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Niramit', 'Sarabun', sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print-bar {
      padding: 12px 24px;
      background: #0f172a;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Prompt', sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    }
    .no-print-bar button {
      background: #f59e0b;
      color: #0f172a;
      border: none;
      padding: 8px 22px;
      border-radius: 8px;
      font-family: 'Prompt', sans-serif;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .no-print-bar button:hover {
      background: #d97706;
      color: #ffffff;
    }
    .cert-page {
      width: 297mm;
      height: 210mm;
      margin: 15px auto;
      background: #ffffff url('${certBgUrl}') no-repeat center center / 100% 100%;
      page-break-after: always;
      display: flex;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .cert-page:last-child {
      page-break-after: auto;
    }
    .cert-watermark-layer {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -47%);
      width: 138mm;
      height: 120mm;
      opacity: 0.088;
      filter: saturate(1.3) contrast(1.06);
      pointer-events: none;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .cert-watermark-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .cert-inner {
      width: 100%;
      height: 100%;
      padding: 13mm 22mm 18mm 22mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      position: relative;
      z-index: 2;
    }
    .cert-top-row {
      display: flex;
      justify-content: flex-end;
      width: 100%;
      height: 22px;
    }
    .cert-top-code-pill {
      font-family: 'Niramit', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #d4af3799;
      border-radius: 9999px;
      padding: 2px 14px;
      letter-spacing: 0.3px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .cert-logos-row {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: -5.5mm;
      margin-bottom: 0.5mm;
    }
    .cert-logo-img {
      height: 31mm;
      width: auto;
      max-width: 35mm;
      object-fit: contain;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.12));
    }
    .cert-header-block {
      margin-top: -1mm;
      margin-bottom: 1mm;
    }
    .cert-header-org {
      font-family: 'Niramit', sans-serif;
      font-size: 21px;
      font-weight: 700;
      color: #1e1b4b;
      line-height: 1.25;
      letter-spacing: -0.2px;
    }
    .cert-header-suborg {
      font-family: 'Niramit', sans-serif;
      font-size: 17.5px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.25;
      margin-top: 0.5mm;
      letter-spacing: -0.1px;
    }
    .cert-subtitle {
      font-family: 'Niramit', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: #334155;
      margin-top: 1.5mm;
    }
    .cert-recipient-block {
      margin: 2mm 0 1.5mm 0;
      text-align: center;
    }
    .cert-recipient-name {
      font-family: 'Niramit', sans-serif;
      font-size: 34px;
      font-weight: 700;
      color: #090d16;
      line-height: 1.25;
      letter-spacing: -0.2px;
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
    }
    .cert-recipient-school {
      font-family: 'Niramit', sans-serif;
      font-size: 17.5px;
      font-weight: 600;
      color: #334155;
      margin-top: 2.5mm;
      letter-spacing: 0.1px;
    }
    .cert-award-block {
      margin: 1.5mm 0 1mm 0;
    }
    .cert-award {
      font-family: 'Niramit', sans-serif;
      font-size: 21px;
      font-weight: 700;
      color: #92400e;
      line-height: 1.3;
    }
    .cert-activity {
      font-family: 'Niramit', sans-serif;
      font-size: 16.5px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0.5mm;
      line-height: 1.35;
    }
    .cert-event-block {
      margin: 1.5mm 0 1mm 0;
    }
    .cert-event-title {
      font-family: 'Niramit', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.35;
    }
    .cert-event-dates {
      font-family: 'Niramit', sans-serif;
      font-size: 14.5px;
      font-weight: 500;
      color: #334155;
      line-height: 1.35;
    }
    .cert-blessing {
      font-family: 'Niramit', sans-serif;
      font-size: 14px;
      font-weight: 400;
      color: #475569;
      margin-top: 1mm;
    }
    .cert-issue-date {
      font-family: 'Niramit', sans-serif;
      font-size: 14.5px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 1mm;
    }
    .cert-footer {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      padding: 0 4mm 1mm 4mm;
      margin-top: 1mm;
      margin-bottom: 2mm;
      width: 100%;
    }
    .cert-qr {
      position: absolute;
      left: 4mm;
      bottom: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      text-align: center;
    }
    .cert-qr-img {
      width: 64px;
      height: 64px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 1.5px;
      background: #ffffff;
    }
    .cert-qr-label {
      font-family: 'Niramit', sans-serif;
      font-size: 9.5px;
      font-weight: 600;
      color: #475569;
    }
    .cert-qr-code {
      font-family: monospace;
      font-size: 8px;
      color: #64748b;
    }
    .cert-sign {
      text-align: center;
      min-width: 280px;
      font-family: 'Niramit', sans-serif;
      line-height: 1.4;
      margin: 0 auto;
    }
    .sign-img-wrap {
      height: 48px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 2px;
    }
    .cert-signature-img {
      max-height: 48px;
      max-width: 170px;
      object-fit: contain;
    }
    .sign-line {
      color: #64748b;
      letter-spacing: 1.5px;
      margin-bottom: 3px;
    }
    .sign-name {
      font-family: 'Niramit', sans-serif;
      font-size: 15.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .sign-pos {
      font-family: 'Niramit', sans-serif;
      font-size: 13.5px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 1px;
    }
    .sign-org {
      font-family: 'Niramit', sans-serif;
      font-size: 12.5px;
      color: #475569;
      margin-top: 1px;
    }
    @media print {
      body {
        background: #ffffff;
        margin: 0;
        padding: 0;
      }
      .no-print-bar {
        display: none !important;
      }
      .cert-page {
        margin: 0 !important;
        width: 297mm !important;
        height: 210mm !important;
        box-shadow: none !important;
        page-break-after: always;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background: #ffffff url('${certBgUrl}') no-repeat center center / 100% 100% !important;
      }
      .cert-page:last-child {
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>ตัวอย่างก่อนพิมพ์เกียรติบัตรออนไลน์ (${entries.length} ใบ) — มาตรฐานกระดาษแนวนอน A4 Landscape (297 x 210 มม.)</div>
    <button onclick="window.print()">สั่งพิมพ์ / บันทึกเป็น PDF</button>
  </div>
  ${pagesHtml}
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      showToast('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป โปรดอนุญาต Pop-up เพื่อเปิดหน้าพิมพ์เกียรติบัตร', 'warning');
    }
  }

  // Export District Representatives as .xlsx
  async function exportDistrictRepresentativesExcel() {
    const criteria = (state.config && state.config.districtRepCriteria) || 'rank_1';
    const criteriaLabel = getDistrictRepCriteriaLabel(criteria);
    const list = state.registrations.filter(isDistrictRepresentative);
    if (list.length === 0) {
      showToast('ยังไม่มีผลการแข่งขันที่ผ่านเกณฑ์ตัวแทนไปแข่งขันระดับเขต (' + criteriaLabel + ')', 'warning');
      return;
    }

    const order = {};
    state.competitions.forEach(function (c, i) {
      order[c.comp_id] = i;
    });
    list.sort((a, b) => (order[a.comp_id] || 0) - (order[b.comp_id] || 0));

    let ExcelJS;
    try {
      ExcelJS = await loadExcelJs();
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ตัวแทนระดับเขต');
    ws.columns = [
      { width: 6 },
      { width: 12 },
      { width: 44 },
      { width: 20 },
      { width: 12 },
      { width: 10 },
      { width: 26 },
      { width: 10 },
      { width: 14 },
      { width: 14 },
      { width: 32 },
      { width: 32 }
    ];

    const titles = [
      'บัญชีรายชื่อตัวแทนกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง เข้าร่วมการแข่งขันงานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569',
      'ระดับสำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3 (เกณฑ์คัดเลือก: ' + criteriaLabel + ')',
      ''
    ];
    titles.forEach(function (t, i) {
      ws.mergeCells(i + 1, 1, i + 1, 12);
      const cell = ws.getCell(i + 1, 1);
      cell.value = t;
      cell.font = { bold: true, size: i === 0 ? 15 : 13 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const thin = { style: 'thin' };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const headerRow = ws.getRow(4);
    const headers = [
      'ที่',
      'รหัส',
      'กิจกรรมการแข่งขัน',
      'กลุ่มสาระ',
      'ระดับชั้น',
      'ประเภท',
      'โรงเรียนตัวแทน',
      'คะแนน',
      'เหรียญ',
      'รางวัล',
      'รายชื่อนักเรียนผู้เข้าแข่งขัน',
      'รายชื่อครูผู้ฝึกซ้อม'
    ];
    headers.forEach(function (h, i) {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, size: 11 };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = border;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1EF' } };
    });

    let rowNo = 5;
    list.forEach(function (r, idx) {
      const students = r.students || [];
      const teachers = r.teachers || [];
      const stuLines =
        students
          .map((s, i) => `${i + 1}. ${formatFullNameForPrint(s.prefix, s.name)} (${s.grade || '-'})`)
          .join('\n') || '-';
      const teaLines =
        teachers
          .map(
            (t, i) =>
              `${i + 1}. ${formatFullNameForPrint(t.prefix, t.name)}${t.phone ? ' (โทร ' + t.phone + ')' : ''}`
          )
          .join('\n') || '-';
      const hasSc = r.score !== '' && r.score !== undefined && r.score !== null;
      const scoreText = hasSc ? Number(r.score).toFixed(2) : '-';
      const medalText = r.medal || (hasSc ? calculateMedalFromScore(r.score) : '-');
      const awardText = r.award_title || 'ชนะเลิศ';

      const row = ws.getRow(rowNo);
      row.getCell(1).value = idx + 1;
      row.getCell(2).value = r.comp_id;
      row.getCell(3).value = r.comp_name;
      row.getCell(4).value = r.learning_area || '';
      row.getCell(5).value = r.level || '';
      row.getCell(6).value = r.team_type || '';
      row.getCell(7).value = r.school_name;
      row.getCell(8).value = scoreText;
      row.getCell(9).value = medalText;
      row.getCell(10).value = awardText;
      row.getCell(11).value = stuLines;
      row.getCell(12).value = teaLines;

      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.border = border;
        cell.alignment = {
          vertical: 'top',
          wrapText: true,
          horizontal: [1, 2, 5, 6, 8, 9, 10].includes(c) ? 'center' : 'left'
        };
      }
      rowNo++;
    });

    const sumRow = ws.getRow(rowNo);
    ws.mergeCells(rowNo, 1, rowNo, 12);
    const sumCell = sumRow.getCell(1);
    sumCell.value = `รวมรายการที่เป็นตัวแทนไปแข่งขันระดับเขตพื้นที่การศึกษา ทั้งหมด ${list.length} รายการ`;
    sumCell.font = { bold: true };
    sumCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sumCell.border = border;
    sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ตัวแทนกลุ่มวังยาวเขวาไร่ดอนกลาง_ศิลปหัตถกรรมครั้งที่74_ระดับเขต.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์สรุปตัวแทนระดับเขตเรียบร้อยแล้ว', 'success');
  }

  // Print Official District Representatives Report (A4 Landscape)
  function printDistrictRepresentativesReport() {
    const criteria = (state.config && state.config.districtRepCriteria) || 'rank_1';
    const criteriaLabel = getDistrictRepCriteriaLabel(criteria);
    const list = state.registrations.filter(isDistrictRepresentative);
    if (list.length === 0) {
      showToast('ยังไม่มีผลการแข่งขันที่ผ่านเกณฑ์ตัวแทนไปแข่งขันระดับเขต (' + criteriaLabel + ')', 'warning');
      return;
    }

    const order = {};
    state.competitions.forEach(function (c, i) {
      order[c.comp_id] = i;
    });
    list.sort((a, b) => (order[a.comp_id] || 0) - (order[b.comp_id] || 0));

    const cfg = state.config || DEFAULT_CONFIG;
    const signerName = cfg.certSignerName || 'นายกิจภูมิ บุญอบ';
    const signerPos = cfg.certSignerPos || 'ประธานกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง';

    const rowsHtml = list
      .map(function (r, idx) {
        const students = r.students || [];
        const teachers = r.teachers || [];
        const stuText =
          students
            .map((s, i) => `${i + 1}. ${escapeHtml(formatFullNameForPrint(s.prefix, s.name))} (${escapeHtml(s.grade || '-')})`)
            .join('<br/>') || '-';
        const teaText =
          teachers
            .map(
              (t, i) =>
                `${i + 1}. ${escapeHtml(formatFullNameForPrint(t.prefix, t.name))}${t.phone ? ' (' + escapeHtml(t.phone) + ')' : ''}`
            )
            .join('<br/>') || '-';
        const hasSc = r.score !== '' && r.score !== undefined && r.score !== null;
        const scoreText = hasSc ? Number(r.score).toFixed(2) : '-';
        const medalText = r.medal || (hasSc ? calculateMedalFromScore(r.score) : '-');
        const repAward = r.award_title || (Number(r.rank) === 1 ? 'ชนะเลิศ' : (r.rank ? 'อันดับ ' + r.rank : 'ตัวแทน'));

        return `
          <tr>
            <td style="text-align:center; vertical-align:top;">${idx + 1}</td>
            <td style="text-align:center; vertical-align:top; font-family:'Prompt',sans-serif; font-weight:600;">${escapeHtml(r.comp_id)}</td>
            <td style="vertical-align:top;">
              <strong>${escapeHtml(r.comp_name)}</strong><br/>
              <span style="font-size:12px; color:#475569;">${escapeHtml(r.learning_area || '')} • ชั้น${escapeHtml(r.level || '')} • ${escapeHtml(r.team_type || '')}</span>
            </td>
            <td style="vertical-align:top; font-weight:600;">${escapeHtml(r.school_name)}</td>
            <td style="vertical-align:top; font-size:13px; line-height:1.4;">${stuText}</td>
            <td style="vertical-align:top; font-size:13px; line-height:1.4;">${teaText}</td>
            <td style="text-align:center; vertical-align:top; font-weight:600;">${scoreText}</td>
            <td style="text-align:center; vertical-align:top;">
              <span style="font-weight:600; color:#b45309;">${escapeHtml(medalText)}</span><br/>
              <span style="font-size:11px; color:#15803d; font-weight:700;">${escapeHtml(repAward)} (ตัวแทน)</span>
            </td>
          </tr>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>บัญชีรายชื่อตัวแทนกลุ่มโรงเรียน - งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ระดับเขต</title>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Sarabun', sans-serif; color: #0f172a; margin: 0; background: #f8fafc; font-size: 14px; }
    .no-print { padding: 12px 20px; background: #0f172a; color: #fff; display: flex; justify-content: space-between; align-items: center; font-family: 'Prompt', sans-serif; }
    .no-print button { background: #38bdf8; color: #0f172a; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .report-wrap { width: 277mm; margin: 15px auto; background: #fff; padding: 15mm 12mm; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .report-title { text-align: center; margin-bottom: 12px; }
    .report-title h1 { font-family: 'Prompt', sans-serif; font-size: 18px; font-weight: 700; margin: 0 0 4px 0; }
    .report-title h2 { font-family: 'Prompt', sans-serif; font-size: 15px; font-weight: 600; color: #334155; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
    th { background: #f1f5f9; font-family: 'Prompt', sans-serif; font-weight: 700; font-size: 13px; text-align: center; }
    .sign-section { margin-top: 30px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
    .sign-box { text-align: center; width: 340px; font-size: 14px; line-height: 1.6; }
    @media print {
      body { background: #fff; font-size: 13px; }
      .no-print { display: none !important; }
      .report-wrap { width: 100%; margin: 0; padding: 0; box-shadow: none; }
      th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>บัญชีรายชื่อตัวแทนกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง (${list.length} รายการ) — ส่งเข้าแข่งขันระดับเขตพื้นที่การศึกษา</div>
    <button onclick="window.print()">สั่งพิมพ์รายงาน (A4 แนวนอน)</button>
  </div>
  <div class="report-wrap">
    <div class="report-title">
      <h1>บัญชีรายชื่อตัวแทนนักเรียนและครูผู้ฝึกสอน กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง</h1>
      <h2>เข้าร่วมการแข่งขันงานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569 ระดับสำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3</h2>
      <div style="font-size:12px; color:#64748b; margin-top:4px;">แข่งขันระหว่างวันที่ 23–24 ธันวาคม 2569 • เอกสารแนบส่ง สพป.มหาสารคาม เขต 3 • เกณฑ์คัดเลือก: ${escapeHtml(criteriaLabel)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:35px;">ที่</th>
          <th style="width:75px;">รหัส</th>
          <th>กิจกรรมการแข่งขัน</th>
          <th style="width:170px;">โรงเรียนตัวแทน</th>
          <th style="width:200px;">รายชื่อนักเรียนผู้เข้าแข่งขัน</th>
          <th style="width:190px;">รายชื่อครูผู้ฝึกซ้อม</th>
          <th style="width:65px;">คะแนน</th>
          <th style="width:110px;">เหรียญ / ผล</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div style="margin-top:10px; font-size:13px; font-weight:600; color:#334155;">
      รวมตัวแทนทั้งสิ้น ${list.length} รายการ
    </div>
    <div class="sign-section">
      <div class="sign-box">
        <div>ขอรับรองว่าเป็นรายชื่อตัวแทนกลุ่มโรงเรียนถูกต้องจริง</div>
        <div style="height:50px;"></div>
        <div>(ลงชื่อ)....................................................................</div>
        <div>(${signerName ? escapeHtml(signerName) : '....................................................................'})</div>
        <div style="font-weight:600;">${escapeHtml(signerPos)}</div>
        <div>วันที่ ............ เดือน ................................. พ.ศ. 2569</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      showToast('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาต Pop-up เพื่อเปิดหน้าพิมพ์บัตรประจำตัว', 'warning');
    }
  }

  // Print Official Substitution Request Form (A4 Portrait)
  function printSubstitutionForm(optRegId) {
    let reg = null;
    if (optRegId) {
      reg = state.registrations.find((r) => r.reg_id === optRegId);
    } else {
      const schoolSelect = document.getElementById('schoolViewSelect');
      const schoolVal = schoolSelect ? schoolSelect.value : '';
      if (schoolVal) {
        const schoolRegs = state.registrations.filter((r) => r.school_name === schoolVal);
        if (schoolRegs.length === 1) {
          reg = schoolRegs[0];
        }
      }
    }

    const schoolName = reg
      ? reg.school_name
      : '................................................................................';
    const compText = reg
      ? `[${reg.comp_id}] ${reg.comp_name} (${reg.level})`
      : '....................................................................................................................................';
    const originalStudents = reg && reg.students ? reg.students : [];
    const originalTeachers = reg && reg.teachers ? reg.teachers : [];

    const stuRows = [0, 1, 2, 3]
      .map(function (idx) {
        const orig = originalStudents[idx];
        const origText = orig ? `${orig.prefix || ''}${orig.name} (${orig.grade || '-'})` : '';
        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>${escapeHtml(origText)}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      })
      .join('');

    const teaRows = [0, 1]
      .map(function (idx) {
        const orig = originalTeachers[idx];
        const origText = orig
          ? `${orig.prefix || ''}${orig.name}${orig.phone ? ' (' + orig.phone + ')' : ''}`
          : '';
        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>${escapeHtml(origText)}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>แบบคำร้องขอเปลี่ยนแปลงตัวผู้เข้าแข่งขันและครูผู้ฝึกสอน - งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74</title>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 12mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Sarabun', sans-serif; color: #000; margin: 0; background: #f8fafc; font-size: 15px; line-height: 1.5; }
    .no-print { padding: 12px 20px; background: #0f172a; color: #fff; display: flex; justify-content: space-between; align-items: center; font-family: 'Prompt', sans-serif; }
    .no-print button { background: #38bdf8; color: #0f172a; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .form-wrap { width: 190mm; margin: 15px auto; background: #fff; padding: 12mm 15mm; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .form-title { text-align: center; margin-bottom: 16px; }
    .form-title h1 { font-family: 'Prompt', sans-serif; font-size: 19px; font-weight: 700; margin: 0 0 4px 0; }
    .form-title h2 { font-size: 15px; font-weight: 600; margin: 0; }
    .form-meta { text-align: right; margin: 12px 0 16px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px 0; font-size: 14px; }
    th, td { border: 1px solid #333; padding: 5px 8px; }
    th { background: #f1f5f9; font-weight: 700; text-align: center; }
    .rule-note { font-size: 12.5px; color: #475569; margin: 4px 0 12px 0; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 18px; page-break-inside: avoid; }
    .sign-box { text-align: center; font-size: 14px; line-height: 1.6; }
    .approval-box { margin-top: 16px; border: 1.5px solid #000; padding: 10px 14px; border-radius: 4px; page-break-inside: avoid; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .form-wrap { width: 100%; margin: 0; padding: 0; box-shadow: none; }
      th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>แบบคำร้องขอเปลี่ยนแปลงตัวผู้เข้าแข่งขันและครูผู้ฝึกสอน (A4 แนวตั้ง ตามระเบียบ สพฐ.)</div>
    <button onclick="window.print()">สั่งพิมพ์แบบคำร้อง (A4 แนวตั้ง)</button>
  </div>
  <div class="form-wrap">
    <div class="form-title">
      <h1>แบบคำร้องขอเปลี่ยนแปลงตัวผู้เข้าแข่งขันและครูผู้ฝึกสอน</h1>
      <h2>การแข่งขันงานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569 ระดับกลุ่มโรงเรียน</h2>
      <div>กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง อำเภอโกสุมพิสัย จังหวัดมหาสารคาม</div>
    </div>

    <div class="form-meta">
      เขียนที่ โรงเรียน${escapeHtml(schoolName)}<br/>
      วันที่ .......... เดือน ................................. พ.ศ. 2569
    </div>

    <div style="margin-bottom: 10px;">
      <strong>เรื่อง</strong> ขออนุมัติเปลี่ยนตัวผู้เข้าแข่งขัน / ครูผู้ฝึกสอน<br/>
      <strong>เรียน</strong> ประธานกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง
    </div>

    <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
      ด้วย โรงเรียน<strong>${escapeHtml(schoolName)}</strong> ได้ส่งนักเรียนเข้าร่วมการแข่งขันงานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ในกิจกรรม <strong>${compText}</strong> มีความจำเป็นต้องขออนุมัติเปลี่ยนแปลงตัว เนื่องจาก (ระบุเหตุผลความจำเป็น เช่น ป่วย/ติดภารกิจสำคัญ) ....................................................................................................................................................................................................................
    </div>

    <div style="font-weight:700; margin-top:10px;">1. รายการขอเปลี่ยนตัวนักเรียนผู้เข้าแข่งขัน:</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;">ที่</th>
          <th style="width:190px;">รายชื่อเดิมที่ลงทะเบียนไว้</th>
          <th style="width:190px;">รายชื่อผู้ขอเปลี่ยนตัวแทน (พร้อมระบุชั้น)</th>
          <th style="width:80px;">เลขประจำตัว/รหัส</th>
          <th>เหตุผลความจำเป็น</th>
        </tr>
      </thead>
      <tbody>
        ${stuRows}
      </tbody>
    </table>

    <div style="font-weight:700;">2. รายการขอเปลี่ยนตัวครูผู้ฝึกสอน:</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;">ที่</th>
          <th style="width:190px;">รายชื่อครูเดิม</th>
          <th style="width:190px;">รายชื่อครูผู้สอนท่านใหม่</th>
          <th style="width:100px;">เบอร์โทรศัพท์</th>
          <th>เหตุผลความจำเป็น</th>
        </tr>
      </thead>
      <tbody>
        ${teaRows}
      </tbody>
    </table>

    <div class="rule-note">
      * หมายเหตุ: ตามเกณฑ์การแข่งขัน การเปลี่ยนตัวผู้เข้าแข่งขันสามารถเปลี่ยนตัวได้ไม่เกินร้อยละตามที่เกณฑ์แต่ละกิจกรรมกำหนด และต้องยื่นแบบคำร้องนี้ต่อประธานกลุ่มโรงเรียนหรือคณะกรรมการจัดการแข่งขันก่อนเริ่มการแข่งขัน
    </div>

    <div class="sign-grid">
      <div class="sign-box">
        <div>(ลงชื่อ).................................................... ครูผู้รับผิดชอบ</div>
        <div>(....................................................)</div>
        <div>ตำแหน่ง ....................................................</div>
      </div>
      <div class="sign-box">
        <div>(ลงชื่อ).................................................... ผู้บริหารสถานศึกษา</div>
        <div>(....................................................)</div>
        <div>ผู้อำนวยการโรงเรียน${escapeHtml(schoolName)}</div>
      </div>
    </div>

    <div class="approval-box">
      <div style="font-weight:700; font-family:'Prompt',sans-serif; margin-bottom:6px;">ผลการพิจารณาของคณะกรรมการกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง:</div>
      <div style="display:flex; gap:30px; margin-bottom:8px;">
        <label><input type="checkbox" style="vertical-align:middle; margin-right:4px;" /> อนุมัติให้เปลี่ยนตัวตามคำร้อง</label>
        <label><input type="checkbox" style="vertical-align:middle; margin-right:4px;" /> ไม่อนุมัติ เนื่องจาก ................................................................</label>
      </div>
      <div style="text-align:center; margin-top:16px;">
        <div>(ลงชื่อ).................................................................... ประธานกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง</div>
        <div>วันที่ .......... / .................... / 2569</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      showToast('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาต Pop-up เพื่อเปิดหน้าพิมพ์บัตรประจำตัว', 'warning');
    }
  }

  // Print ID Cards for a single registered team
  function printRegistrationIdCards(regId) {
    const r = state.registrations.find((item) => item.reg_id === regId);
    if (!r) {
      showToast('ไม่พบข้อมูลการลงทะเบียนนี้', 'error');
      return;
    }

    const comp = state.competitions.find((c) => c.comp_id === r.comp_id) || {};
    const cleanCompName = (r.comp_name || comp.comp_name || '').trim();
    const cleanLevel = (r.level || comp.level || '').trim();
    const eventTitle = cleanLevel ? `${cleanCompName} (${cleanLevel})` : cleanCompName;
    const cards = [];

    (r.students || []).forEach(function (s, idx) {
      cards.push({
        badge_type: 'บัตรประจำตัวนักเรียนผู้เข้าแข่งขัน',
        badge_gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
        theme_badge_bg: '#eff6ff',
        theme_badge_text: '#1e40af',
        theme_color: '#1e40af',
        border_accent: '#2563eb',
        person_name: formatFullNameForPrint(s.prefix, s.name),
        sub_role: s.grade ? 'นักเรียนชั้น' + s.grade : 'นักเรียนผู้เข้าแข่งขัน',
        school_name: r.school_name,
        comp_name: eventTitle,
        comp_date: '24–25 พฤศจิกายน 2569',
        comp_time: '09.00 - 12.00 น.',
        venue_room: comp.room ? comp.room + ' (กลุ่ม รร.วังยาวเขวาไร่ดอนกลาง)' : 'กลุ่ม รร.วังยาวเขวาไร่ดอนกลาง',
        ref_code: r.reg_id ? `${r.reg_id}-S${idx + 1}` : `REG-S${idx + 1}`
      });
    });

    (r.teachers || []).forEach(function (t, idx) {
      cards.push({
        badge_type: 'บัตรประจำตัวครูผู้ฝึกสอน',
        badge_gradient: 'linear-gradient(135deg, #c2410c 0%, #7c2d12 100%)',
        theme_badge_bg: '#fff7ed',
        theme_badge_text: '#c2410c',
        theme_color: '#c2410c',
        border_accent: '#ea580c',
        person_name: formatFullNameForPrint(t.prefix, t.name),
        sub_role: t.position || 'ครูผู้ฝึกสอนนักเรียน',
        school_name: r.school_name,
        comp_name: eventTitle,
        comp_date: '24–25 พฤศจิกายน 2569',
        comp_time: '09.00 - 12.00 น.',
        venue_room: comp.room ? comp.room + ' (กลุ่ม รร.วังยาวเขวาไร่ดอนกลาง)' : 'กลุ่ม รร.วังยาวเขวาไร่ดอนกลาง',
        ref_code: r.reg_id ? `${r.reg_id}-T${idx + 1}` : `REG-T${idx + 1}`
      });
    });

    if (cards.length === 0) {
      showToast('ไม่พบรายชื่อนักเรียนหรือครูในรายการนี้', 'warning');
      return;
    }

    openIdCardsPrintWindow(`บัตรประจำตัวผู้เข้าแข่งขัน - ${cleanCompName} (${r.school_name})`, cards);
  }

  // Print Competitor & Coach ID Badges for Selected School (Foldable A5 Landscape / 1/4 A4)
  function printSchoolIdCards(schoolName) {
    const targetSchool = schoolName || (state.schools[0] ? state.schools[0].school_name : 'กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง');
    const regs = state.registrations.filter((r) => r.school_name === targetSchool);
    if (regs.length === 0) {
      showToast('ยังไม่มีรายชื่อจริงของ ' + targetSchool + ' — ระบบเปิดตัวอย่างบัตรสำหรับทดสอบพิมพ์', 'info');
      const sampleCards = [
        {
          badge_type: 'บัตรประจำตัวนักเรียนผู้เข้าแข่งขัน',
          badge_gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
          theme_badge_bg: '#eff6ff',
          theme_badge_text: '#1e40af',
          theme_color: '#1e40af',
          border_accent: '#2563eb',
          person_name: 'เด็กชายพชรวัฒน์ ทับทองดี',
          sub_role: 'นักเรียนชั้นประถมศึกษาปีที่ 4',
          school_name: targetSchool,
          comp_name: 'การแข่งขันต่อสมการคณิตศาสตร์ (เอแม็ท) (ป.1–ป.6)',
          comp_date: '24–25 พฤศจิกายน 2569',
          comp_time: '09.00 - 12.00 น.',
          venue_room: 'อาคารเรียนหลัก ห้อง 101',
          ref_code: 'REG-74-SAMPLE-S1'
        },
        {
          badge_type: 'บัตรประจำตัวครูผู้ฝึกสอน',
          badge_gradient: 'linear-gradient(135deg, #c2410c 0%, #7c2d12 100%)',
          theme_badge_bg: '#fff7ed',
          theme_badge_text: '#c2410c',
          theme_color: '#c2410c',
          border_accent: '#ea580c',
          person_name: 'นางสาวพิมพ์ใจ มีสุข',
          sub_role: 'ครูผู้ฝึกสอนนักเรียน',
          school_name: targetSchool,
          comp_name: 'การแข่งขันต่อสมการคณิตศาสตร์ (เอแม็ท) (ป.1–ป.6)',
          comp_date: '24–25 พฤศจิกายน 2569',
          comp_time: '09.00 - 12.00 น.',
          venue_room: 'อาคารเรียนหลัก ห้อง 101',
          ref_code: 'REG-74-SAMPLE-T1'
        }
      ];
      openIdCardsPrintWindow('ตัวอย่างบัตรประจำตัวผู้เข้าแข่งขันและครูผู้ฝึกสอน - ' + targetSchool, sampleCards);
      return;
    }

    const cards = [];
    regs.forEach(function (r) {
      const comp = state.competitions.find((c) => c.comp_id === r.comp_id) || {};
      const cleanCompName = (r.comp_name || comp.comp_name || '').trim();
      const cleanLevel = (r.level || comp.level || '').trim();
      const eventTitle = cleanLevel ? `${cleanCompName} (${cleanLevel})` : cleanCompName;

      (r.students || []).forEach(function (s, idx) {
        cards.push({
          badge_type: 'บัตรประจำตัวนักเรียนผู้เข้าแข่งขัน',
          badge_gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
          theme_badge_bg: '#eff6ff',
          theme_badge_text: '#1e40af',
          theme_color: '#1e40af',
          border_accent: '#2563eb',
          person_name: formatFullNameForPrint(s.prefix, s.name),
          sub_role: 'นักเรียนชั้น ' + (s.grade || '-'),
          school_name: r.school_name,
          comp_name: eventTitle,
          comp_date: comp.comp_date || '24–25 พฤศจิกายน 2569',
          comp_time: comp.comp_time || '09.00 - 12.00 น.',
          venue_room: comp.venue_room || 'อาคารเรียนหลัก',
          ref_code: r.reg_id + '-S' + (idx + 1)
        });
      });
      (r.teachers || []).forEach(function (t, idx) {
        cards.push({
          badge_type: 'บัตรประจำตัวครูผู้ฝึกสอน',
          badge_gradient: 'linear-gradient(135deg, #c2410c 0%, #7c2d12 100%)',
          theme_badge_bg: '#fff7ed',
          theme_badge_text: '#c2410c',
          theme_color: '#c2410c',
          border_accent: '#ea580c',
          person_name: formatFullNameForPrint(t.prefix, t.name),
          sub_role: 'ครูผู้ฝึกสอนนักเรียน',
          school_name: r.school_name,
          comp_name: eventTitle,
          comp_date: comp.comp_date || '24–25 พฤศจิกายน 2569',
          comp_time: comp.comp_time || '09.00 - 12.00 น.',
          venue_room: comp.venue_room || 'อาคารเรียนหลัก',
          ref_code: r.reg_id + '-T' + (idx + 1)
        });
      });
    });

    openIdCardsPrintWindow('บัตรประจำตัวผู้เข้าแข่งขันและครูผู้ฝึกสอน - ' + schoolName, cards);
  }

  function printJudgeIdCard(judge) {
    const comp = state.competitions.find((c) => c.comp_id === judge.comp_id) || {};
    const jName = judge.judge_name || judge.full_name || '';
    const cleanCompName = (judge.comp_name || comp.comp_name || '').trim();
    const cleanLevel = (judge.level || comp.level || '').trim();
    const eventTitle = cleanLevel ? `${cleanCompName} (${cleanLevel})` : cleanCompName;

    openIdCardsPrintWindow('บัตรประจำตัวคณะกรรมการตัดสิน', [
      {
        badge_type: 'บัตรประจำตัวคณะกรรมการตัดสิน',
        badge_gradient: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
        theme_badge_bg: '#f0fdf4',
        theme_badge_text: '#0f766e',
        theme_color: '#0f766e',
        border_accent: '#0d9488',
        person_name: formatFullNameForPrint(judge.prefix, jName),
        sub_role: judge.role || 'กรรมการตัดสิน',
        school_name: judge.school_name || 'กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง',
        comp_name: eventTitle,
        comp_date: comp.comp_date || '24–25 พฤศจิกายน 2569',
        comp_time: (comp.comp_time || '09.00 - 12.00 น.') + ' (ประชุม 23 พ.ย. 13.30 น.)',
        venue_room: comp.venue_room || 'อาคารเรียนหลัก',
        ref_code: judge.judge_id || ('JDG-' + (judge.comp_id || 'WYK'))
      }
    ]);
  }

  function openIdCardsPrintWindow(title, cards) {
    const baseDir = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const cardBgUrl = baseDir + 'assets/card-bg-thai.jpg';

    function renderCard(c) {
      if (!c) return '';
      return `
        <div class="foldable-card">
          <!-- LEFT PANEL: Back Cover When Folded (A6 Portrait = 1/4 A4) -->
          <div class="card-panel card-panel-left">
            <div class="panel-inner">
              <div class="left-top-header">
                <div class="left-badge-tag" style="background:${c.theme_badge_bg}; color:${c.theme_badge_text}; border: 1px solid ${c.border_accent}33;">
                  ${escapeHtml(c.badge_type)}
                </div>
                <div class="left-title-event">งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74</div>
                <div class="left-title-sub">กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง</div>
              </div>

              <!-- Rules Box -->
              <div class="rules-box">
                <div class="rules-head">แนวปฏิบัติในการเข้าร่วมแข่งขัน</div>
                <ol class="rules-list">
                  <li>รายงานตัวที่ห้องแข่งขันก่อนเวลาอย่างน้อย 15 นาที</li>
                  <li>แต่งกายชุดนักเรียนหรือชุดแข่งขันที่ถูกต้องตามระเบียบ</li>
                  <li>พกบัตรประจำตัวนี้ติดตัวไว้ตลอดระยะเวลาการแข่งขัน</li>
                  <li>ปฏิบัติตามคำแนะนำของคณะกรรมการตัดสินอย่างเคร่งครัด</li>
                </ol>
              </div>

              <!-- QR & Verification Box (Centered at bottom) -->
              <div class="qr-verify-box-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://campingroom.github.io/talent69/" class="qr-img" alt="QR" onerror="this.style.opacity='0'" />
                <div class="qr-text">
                  <div class="qr-title">ตรวจสอบข้อมูลการแข่งขัน</div>
                  <div class="qr-url">campingroom.github.io/talent69</div>
                  <div class="qr-sub">สแกนเพื่อตรวจสอบเกณฑ์และผลการแข่งขัน</div>
                </div>
              </div>

              <div class="left-footer">
                กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง • สพป.มหาสารคาม เขต 3
              </div>
            </div>

            <!-- Center Fold Indicator -->
            <div class="fold-guide-label">
              <span>[-- รอยพับครึ่ง --]</span>
            </div>
          </div>

          <!-- RIGHT PANEL: Front Cover When Folded (A6 Portrait = 1/4 A4) -->
          <div class="card-panel card-panel-right">
            <div class="panel-inner">
              <!-- Right Top Header with Modern Thai Wave Ornament -->
              <div class="right-header" style="background:${c.badge_gradient};">
                <div class="header-wave-strip" aria-hidden="true">
                  <svg viewBox="0 0 300 20" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0 L300 0 L300 10 C240 16 180 6 140 12 C100 18 40 6 0 12 Z" fill="rgba(245, 158, 11, 0.22)" />
                    <path d="M0 0 L300 0 L300 6 C250 12 190 4 150 10 C110 16 50 4 0 8 Z" fill="rgba(255, 255, 255, 0.15)" />
                  </svg>
                </div>
                <div class="right-header-event">งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569</div>
                <div class="right-header-title">${escapeHtml(c.badge_type)}</div>
                <div class="right-header-sub">กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง</div>
                <div class="header-gold-line"></div>
              </div>

              <!-- Main Profile Body (Centered Layout with Large Photo Frame as requested) -->
              <div class="right-body-center">
                <!-- Center Photo Frame (กรอบตรงกลางขนาดใหญ่ตามภาพวาด) -->
                <div class="photo-center-wrapper">
                  <div class="photo-box-center" style="border-color:${c.border_accent};">
                    <div class="photo-box-content">
                      <svg class="photo-cam-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      <span class="photo-box-label">ติดรูปถ่าย</span>
                      <span class="photo-box-hint">ขนาด 1.5 – 2 นิ้ว<br/>(40 × 48 มม.)</span>
                    </div>
                  </div>
                </div>

                <!-- Center Name & School (ชื่อนักเรียนให้จัด mid) -->
                <div class="profile-center">
                  <div class="person-name">${escapeHtml(formatFullNameForPrint('', c.person_name))}</div>
                  <div class="person-sub">${escapeHtml(c.sub_role)}</div>
                  <div class="person-school" style="color:${c.theme_color};">${escapeHtml(c.school_name)}</div>
                </div>

                <!-- Center Competition Box -->
                <div class="comp-box-center" style="border-top-color:${c.border_accent};">
                  <div class="comp-title">${escapeHtml(c.comp_name)}</div>
                  <div class="comp-schedule">
                    <div><span>วันเวลา:</span> ${escapeHtml(c.comp_date)} (${escapeHtml(c.comp_time)})</div>
                    <div><span>สถานที่:</span> ${escapeHtml(c.venue_room)}</div>
                  </div>
                </div>

                <!-- Signature & Ref Code Row -->
                <div class="card-bottom-row">
                  <span class="ref-code">รหัส: ${escapeHtml(c.ref_code)}</span>
                  <div class="sign-holder">
                    (ลงชื่อ).................................................... ผู้ถือบัตร
                  </div>
                </div>
              </div>

              <!-- Right Footer -->
              <div class="right-footer">
                <span>สำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Chunk cards into pairs (2 cards per A4 page)
    const sheetsHtml = [];
    for (let i = 0; i < cards.length; i += 2) {
      const card1 = cards[i];
      const card2 = cards[i + 1] || null;
      sheetsHtml.push(`
        <div class="a4-sheet">
          ${renderCard(card1)}
          ${card2 ? `
            <div class="cut-line">
              <span>[-- รอยตัดแยกแผ่น (A5 แนวนอน 2 ใบต่อกระดาษ A4 1 แผ่น — พับครึ่งตามแนวตั้งเป็นขนาด 1 ใน 4) --]</span>
            </div>
            ${renderCard(card2)}
          ` : `
            <div class="cut-line">
              <span>[-- รอยตัดแยกแผ่น --]</span>
            </div>
            <div class="card-empty-placeholder"></div>
          `}
        </div>
      `);
    }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <base href="${baseDir}" />
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Niramit:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Prompt:wght@500;600;700&family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 6mm 7mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Niramit', 'Sarabun', sans-serif; margin: 0; padding: 0; background: #f8fafc; color: #0f172a; }
    .no-print { padding: 12px 20px; background: #0f172a; color: #fff; display: flex; justify-content: space-between; align-items: center; font-family: 'Niramit', 'Prompt', sans-serif; }
    .no-print button { background: #38bdf8; color: #0f172a; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-family: 'Niramit', 'Prompt', sans-serif; }
    .a4-sheet { width: 196mm; height: 284mm; margin: 10px auto; background: transparent; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
    .a4-sheet:last-child { page-break-after: auto; }
    .foldable-card {
      width: 196mm;
      height: 136mm;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      background: #fdfbf7 url('${cardBgUrl}') no-repeat center center / 100% 100%;
      display: flex;
      overflow: hidden;
      position: relative;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card-panel {
      width: 50%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      background: rgba(253, 251, 247, 0.35);
      overflow: hidden;
    }
    .card-panel-left { border-right: 1.5px dashed rgba(148, 163, 184, 0.85); background: rgba(253, 251, 247, 0.45); }
    .card-panel-right { border-left: none; }
    .fold-guide-label { position: absolute; top: 50%; right: -24px; transform: translateY(-50%) rotate(90deg); font-size: 8px; font-family: 'Niramit', sans-serif; color: #94a3b8; letter-spacing: 1px; background: rgba(255, 255, 255, 0.9); padding: 1px 4px; border-radius: 3px; pointer-events: none; z-index: 10; }
    .panel-inner { padding: 6mm 7.5mm; display: flex; flex-direction: column; justify-content: space-between; height: 100%; position: relative; z-index: 2; }
    .left-top-header { text-align: center; border-bottom: 1px solid rgba(226, 232, 240, 0.9); padding-bottom: 3px; }
    .left-badge-tag { display: inline-block; font-family: 'Niramit', sans-serif; font-size: 10.5px; font-weight: 700; padding: 1.5px 9px; border-radius: 9999px; margin-bottom: 2px; }
    .left-title-event { font-family: 'Niramit', sans-serif; font-size: 11.5px; font-weight: 700; color: #1e293b; }
    .left-title-sub { font-size: 9.5px; font-family: 'Niramit', sans-serif; color: #64748b; font-weight: 500; }
    .rules-box { background: rgba(255, 255, 255, 0.92); border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; margin: 3px 0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .rules-head { font-family: 'Niramit', sans-serif; font-size: 10px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .rules-list { margin: 0; padding-left: 14px; font-size: 9px; font-family: 'Niramit', sans-serif; color: #334155; line-height: 1.35; }
    .rules-list li { margin-bottom: 1px; }
    .qr-verify-box-center { display: flex; align-items: center; gap: 7px; background: rgba(255, 255, 255, 0.92); border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 7px; margin-bottom: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .qr-img { width: 38px; height: 38px; border-radius: 4px; background: #fff; border: 1px solid #cbd5e1; flex-shrink: 0; }
    .qr-text { font-size: 8.5px; font-family: 'Niramit', sans-serif; line-height: 1.25; }
    .qr-title { font-family: 'Niramit', sans-serif; font-weight: 700; color: #0f172a; }
    .qr-url { color: #2563eb; font-family: monospace; }
    .qr-sub { color: #64748b; font-family: 'Niramit', sans-serif; }
    .left-footer, .right-footer { font-size: 8.5px; text-align: center; color: #64748b; font-family: 'Niramit', sans-serif; border-top: 1px solid rgba(226, 232, 240, 0.8); padding-top: 2.5px; font-weight: 500; }
    .right-header { color: #ffffff; padding: 4.5px 8px 3.5px 8px; border-radius: 6px; text-align: center; font-family: 'Niramit', sans-serif; position: relative; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
    .header-wave-strip { position: absolute; top: 0; left: 0; right: 0; height: 10px; pointer-events: none; }
    .header-gold-line { height: 1.5px; background: linear-gradient(90deg, transparent 0%, #f59e0b 20%, #fef08a 50%, #f59e0b 80%, transparent 100%); margin-top: 2.5px; }
    .right-header-event { font-size: 8px; font-family: 'Niramit', sans-serif; opacity: 0.92; letter-spacing: 0.2px; font-weight: 500; }
    .right-header-title { font-size: 12px; font-family: 'Niramit', sans-serif; font-weight: 700; line-height: 1.2; margin: 1px 0; letter-spacing: -0.2px; }
    .right-header-sub { font-size: 8px; font-family: 'Niramit', sans-serif; opacity: 0.88; font-weight: 500; }
    .right-body-center { display: flex; flex-direction: column; justify-content: space-between; flex: 1; padding: 2px 2px 0 2px; text-align: center; }
    .photo-center-wrapper { display: flex; justify-content: center; margin: 2mm auto 1.5mm auto; }
    .photo-box-center {
      width: 40mm;
      height: 48mm;
      border: 2px dashed #94a3b8;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.94);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    .photo-box-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2.5px;
      font-size: 9px;
      color: #475569;
      line-height: 1.3;
      font-family: 'Niramit', sans-serif;
      text-align: center;
    }
    .photo-cam-icon { width: 18px; height: 18px; color: #94a3b8; }
    .photo-box-label { font-weight: 700; color: #1e293b; font-size: 10px; font-family: 'Niramit', sans-serif; }
    .photo-box-hint { font-size: 8.5px; color: #64748b; font-family: 'Niramit', sans-serif; }
    .profile-center { margin: 1.5mm 0 1.5mm 0; text-align: center; }
    .person-name { font-family: 'Niramit', sans-serif; font-size: 14.5px; font-weight: 700; color: #0f172a; line-height: 1.25; }
    .person-sub { font-size: 10px; font-weight: 600; color: #475569; margin-top: 1px; font-family: 'Niramit', sans-serif; }
    .person-school { font-size: 11px; font-weight: 700; margin-top: 1px; font-family: 'Niramit', sans-serif; }
    .comp-box-center { background: rgba(255, 255, 255, 0.94); border: 1px solid #e2e8f0; border-top: 2.5px solid #3b82f6; border-radius: 6px; padding: 3px 7px; margin: 1.5mm 0; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .comp-title { font-family: 'Niramit', sans-serif; font-size: 10.5px; font-weight: 700; color: #0f172a; line-height: 1.25; }
    .comp-schedule { font-size: 8.5px; color: #334155; margin-top: 1.5px; line-height: 1.3; font-family: 'Niramit', sans-serif; }
    .card-bottom-row { display: flex; align-items: center; justify-content: space-between; margin-top: 1.5mm; padding: 0 2px; }
    .ref-code { font-size: 8px; font-family: monospace; color: #64748b; background: rgba(255, 255, 255, 0.9); padding: 1px 4px; border-radius: 3px; border: 1px solid #e2e8f0; }
    .sign-holder { font-size: 9px; color: #334155; font-family: 'Niramit', sans-serif; }
    .cut-line { height: 5mm; display: flex; align-items: center; justify-content: center; border-top: 1px dashed #94a3b8; border-bottom: 1px dashed #94a3b8; font-size: 9px; color: #64748b; font-family: 'Niramit', sans-serif; margin: 1.5mm 0; }
    .card-empty-placeholder { width: 196mm; height: 136mm; border: 1px dashed #e2e8f0; border-radius: 8px; }
    @media print {
      body { background: #ffffff; }
      .no-print { display: none !important; }
      .a4-sheet { margin: 0; box-shadow: none; height: 284mm; }
      .foldable-card {
        box-shadow: none;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background: #fdfbf7 url('${cardBgUrl}') no-repeat center center / 100% 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>${escapeHtml(title)} (รวม ${cards.length} บัตร — พิมพ์ 2 บัตรต่อแผ่น A4 แนวนอน A5 พับครึ่ง)</div>
    <button onclick="window.print()">สั่งพิมพ์บัตรประจำตัว</button>
  </div>
  ${sheetsHtml.join('')}
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      showToast('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาต Pop-up เพื่อเปิดหน้าพิมพ์บัตรประจำตัว', 'warning');
    }
  }

  function printCompetitionResultSheet(compId) {
    const comp = state.competitions.find((c) => c.comp_id === compId);
    if (!comp) return;
    const regs = state.registrations
      .filter((r) => r.comp_id === compId)
      .slice()
      .sort(function (a, b) {
        const sa = a.score !== '' && a.score !== undefined ? Number(a.score) : -1;
        const sb = b.score !== '' && b.score !== undefined ? Number(b.score) : -1;
        return sb - sa;
      });

    const rowsHtml = regs
      .map(function (r) {
        const hasSc = r.score !== '' && r.score !== undefined && r.score !== null;
        const scText = hasSc ? Number(r.score).toFixed(2) : '-';
        const medal = r.medal || (hasSc ? calculateMedalFromScore(r.score) : '-');
        const award = r.award_title || (hasSc ? getAwardTitleFromRank(r.rank, medal) : '-');
        const stuList = (r.students || []).map((s, i) => (i + 1) + '. ' + escapeHtml(formatFullNameForPrint(s.prefix, s.name))).join('<br/>');
        const tchList = (r.teachers || []).map((t, i) => (i + 1) + '. ' + escapeHtml(formatFullNameForPrint(t.prefix, t.name))).join('<br/>');
        return `
          <tr>
            <td style="text-align:center;font-weight:700;">${escapeHtml(r.rank ? 'อันดับ ' + r.rank : '-')}</td>
            <td><strong>${escapeHtml(r.school_name)}</strong></td>
            <td>${stuList}</td>
            <td>${tchList}</td>
            <td style="text-align:center;font-weight:700;">${escapeHtml(scText)}</td>
            <td style="text-align:center;">${escapeHtml(medal)}</td>
            <td>${escapeHtml(award)}</td>
          </tr>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>ประกาศผลการแข่งขัน ${escapeHtml(comp.comp_id)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Sarabun', sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
    h2 { font-size: 15px; margin: 0 0 14px; text-align: center; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { border: 1px solid #1f2937; padding: 7px 8px; vertical-align: top; }
    th { background: #f3f4f6; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:14px;text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px;font-weight:700;cursor:pointer;">สั่งพิมพ์ใบประกาศผล</button>
  </div>
  <h1>ประกาศผลการแข่งขันงานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 ปีการศึกษา 2569</h1>
  <h2>กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง (สพป.มหาสารคาม เขต 3)<br/>
  รายการ: [${escapeHtml(comp.comp_id)}] ${escapeHtml(comp.comp_name)} • ระดับชั้น ${escapeHtml(comp.level)}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:70px;">อันดับ</th>
        <th style="width:170px;">โรงเรียน</th>
        <th>นักเรียนผู้เข้าแข่งขัน</th>
        <th>ครูผู้ฝึกซ้อม</th>
        <th style="width:80px;">คะแนน</th>
        <th style="width:100px;">ระดับเหรียญ</th>
        <th style="width:150px;">รางวัล</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      showToast('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาต Pop-up เพื่อเปิดหน้าพิมพ์บัตรประจำตัว', 'warning');
    }
  }

  async function copyCodeGsToClipboard() {
    try {
      const res = await fetch('google-apps-script/Code.gs', { cache: 'no-store' });
      if (!res.ok) throw new Error('Cannot fetch Code.gs');
      const codeText = await res.text();
      await navigator.clipboard.writeText(codeText);
      showToast('คัดลอกโค้ด Code.gs ทั้งหมด (' + codeText.split('\n').length + ' บรรทัด) เรียบร้อยแล้ว! นำไปกด Cmd+A แล้ว Cmd+V ใน Apps Script ได้เลย', 'success');
    } catch (err) {
      showToast('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาเปิดไฟล์ google-apps-script/Code.gs', 'error');
    }
  }

  function renderAll() {
    updateAdminAndStatusUI();
    renderDashboardTab();
    renderSchoolViewTab();
    renderCompetitionViewTab();
    renderJudgesTab();
    renderResultsTab();
    renderCertificatesTab();
  }

  // Initialize Event Listeners
  function initEvents() {
    // Sidebar Toggle & Collapse Handlers (Notion Style)
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', function () {
        if (window.innerWidth < 768) {
          openMobileSidebar();
        } else {
          toggleDesktopSidebar();
        }
      });
    }

    const btnCloseSidebar = document.getElementById('btnCloseSidebar');
    if (btnCloseSidebar) {
      btnCloseSidebar.addEventListener('click', function () {
        if (window.innerWidth < 768) {
          closeMobileSidebar();
        } else {
          toggleDesktopSidebar();
        }
      });
    }

    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    }

    // Restore desktop collapsed state
    try {
      if (localStorage.getItem('talent69_sidebar_collapsed') === 'true' && window.innerWidth >= 768) {
        document.body.classList.add('sidebar-collapsed');
      }
    } catch (e) {}

    // Tab switching
    document.querySelectorAll('.nav-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    // Hero Section Quick Tab Navigation
    document.querySelectorAll('[data-hero-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tab = btn.getAttribute('data-hero-tab');
        if (tab) switchTab(tab);
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
          // Server answered "wrong PIN": do not fall back to the local default PIN
          if (remoteCheck && remoteCheck.error === 'รหัสแอดมินไม่ถูกต้อง') {
            showToast('รหัสแอดมินไม่ถูกต้อง', 'error');
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

    // Coverage ring shortcuts
    [
      ['btnRingGoComp', 'REGISTERED'],
      ['btnRingGoEmpty', 'EMPTY']
    ].forEach(function (pair) {
      const btn = document.getElementById(pair[0]);
      if (!btn) return;
      btn.addEventListener('click', function () {
        document.getElementById('compViewAreaFilter').value = 'ALL';
        document.getElementById('compViewLevelFilter').value = 'ALL';
        state.compStatusFilter = pair[1];
        switchTab('competition');
      });
    });
    const btnRingGoSchool = document.getElementById('btnRingGoSchool');
    if (btnRingGoSchool) {
      btnRingGoSchool.addEventListener('click', function () {
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

    const btnFixSheetTimestamps = document.getElementById('btnFixSheetTimestamps');
    if (btnFixSheetTimestamps) {
      btnFixSheetTimestamps.addEventListener('click', async function () {
        if (!state.isAdmin) {
          showToast('กรุณาเข้าสู่ระบบแอดมินก่อนดำเนินการ', 'warning');
          return;
        }
        const confirmFix = confirm(
          'ต้องการปรับปรุงเวลาใน Google Sheets (คอลัมน์ B) ให้เป็นเวลาจริงของกรุงเทพฯ (UTC+7) หรือไม่?\n\n* ระบบจะปรับเฉพาะคอลัมน์เวลาให้ถูกต้องตรงกับความเป็นจริง โดยไม่แตะต้องหรือแก้ไขรายชื่อนักเรียน ครู โรงเรียน หรือรายการแข่งขันใด ๆ ทั้งสิ้น 100%'
        );
        if (!confirmFix) return;

        btnFixSheetTimestamps.disabled = true;
        const originalText = btnFixSheetTimestamps.innerHTML;
        btnFixSheetTimestamps.textContent = 'กำลังปรับปรุงเวลาใน Google Sheets...';

        try {
          const res = await postToGoogleSheets({
            action: 'fix_timestamps',
            admin_pin: state.adminPin
          });

          if (res && res.ok) {
            showToast(res.message || 'ปรับปรุงเวลาใน Google Sheets เรียบร้อยแล้ว', 'success');
            await syncFromGoogleSheets(false);
          } else {
            showToast(
              'ไม่สามารถปรับปรุงเวลาใน Google Sheets: ' +
                ((res && res.error) || 'ข้อผิดพลาดไม่ทราบสาเหตุ'),
              'warning'
            );
          }
        } catch (err) {
          showToast('เกิดข้อผิดพลาด: ' + err.message, 'warning');
        } finally {
          btnFixSheetTimestamps.disabled = false;
          btnFixSheetTimestamps.innerHTML = originalText;
        }
      });
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

    const btnExportSchoolExcel = document.getElementById('btnExportSchoolExcel');
    if (btnExportSchoolExcel) {
      btnExportSchoolExcel.addEventListener('click', function () {
        exportSchoolExcel(document.getElementById('schoolViewSelect').value);
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

    const btnPrintCompTOC = document.getElementById('btnPrintCompTOC');
    if (btnPrintCompTOC) {
      btnPrintCompTOC.addEventListener('click', printCompetitionTableOfContents);
    }

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
        const result = await postToGoogleSheets({
          action: 'change_admin_pin',
          admin_pin: oldPin,
          new_pin: newPin
        });
        if (!result || !result.ok) {
          showToast('เปลี่ยนรหัสไม่สำเร็จ: ' + ((result && result.error) || 'ไม่ทราบสาเหตุ'), 'error');
          return;
        }
        state.adminPin = newPin;
        if (result.localOnly) {
          localStorage.setItem(ADMIN_PIN_KEY, newPin);
        } else {
          // Server holds the real PIN; do not keep it in the browser
          localStorage.removeItem(ADMIN_PIN_KEY);
        }
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

    // Phase 2 Dashboard Highlight Buttons
    const btnDashGoResults = document.getElementById('btnDashGoResults');
    if (btnDashGoResults) {
      btnDashGoResults.addEventListener('click', function () {
        switchTab('results');
      });
    }

    const btnDashOpenResults = document.getElementById('btnDashOpenResults');
    if (btnDashOpenResults) {
      btnDashOpenResults.addEventListener('click', function () {
        switchTab('results');
      });
    }

    const btnDashOpenCerts = document.getElementById('btnDashOpenCerts');
    if (btnDashOpenCerts) {
      btnDashOpenCerts.addEventListener('click', function () {
        switchTab('certificates');
      });
    }

    const btnCopySiteUrl = document.getElementById('btnCopySiteUrl');
    if (btnCopySiteUrl) {
      btnCopySiteUrl.addEventListener('click', async function () {
        const shareUrl = 'https://campingroom.github.io/talent69/';
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast('คัดลอกลิงก์หน้าเว็บเรียบร้อยแล้ว', 'success');
        } catch (err) {
          showToast('ลิงก์หน้าเว็บ: ' + shareUrl, 'success');
        }
      });
    }

    // Phase 2 School ID Cards Print Button
    const btnPrintSchoolIdCards = document.getElementById('btnPrintSchoolIdCards');
    if (btnPrintSchoolIdCards) {
      btnPrintSchoolIdCards.addEventListener('click', function () {
        const schoolName = document.getElementById('schoolViewSelect').value;
        printSchoolIdCards(schoolName);
      });
    }

    // Phase 2 Judges Tab Events
    ['judgeAreaFilter', 'judgeSchoolFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', renderJudgesTab);
    });

    const judgeSearchInput = document.getElementById('judgeSearchInput');
    if (judgeSearchInput) {
      judgeSearchInput.addEventListener('input', renderJudgesTab);
    }

    const judgeFormPrefix = document.getElementById('judgeFormPrefix');
    const judgeFormPrefixCustom = document.getElementById('judgeFormPrefixCustom');
    if (judgeFormPrefix && judgeFormPrefixCustom) {
      judgeFormPrefix.addEventListener('change', function () {
        if (judgeFormPrefix.value === 'OTHER') {
          judgeFormPrefixCustom.classList.remove('hidden');
          judgeFormPrefixCustom.required = true;
          judgeFormPrefixCustom.focus();
        } else {
          judgeFormPrefixCustom.classList.add('hidden');
          judgeFormPrefixCustom.required = false;
        }
      });
    }

    const addJudgeForm = document.getElementById('addJudgeForm');
    if (addJudgeForm) {
      addJudgeForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!state.isAdmin) return;
        const compId = document.getElementById('judgeFormCompSelect').value;
        const rawPrefix = document.getElementById('judgeFormPrefix').value;
        const customPrefixEl = document.getElementById('judgeFormPrefixCustom');
        const prefix =
          rawPrefix === 'OTHER'
            ? (customPrefixEl ? customPrefixEl.value.trim() : '')
            : rawPrefix;
        const name = document.getElementById('judgeFormName').value.trim();
        const schoolName = document.getElementById('judgeFormSchool').value;
        const role = document.getElementById('judgeFormRole').value;
        if (rawPrefix === 'OTHER' && !prefix) {
          showToast('กรุณาระบุคำนำหน้ากรรมการตัดสิน', 'error');
          if (customPrefixEl) customPrefixEl.focus();
          return;
        }
        if (!compId || !name || !schoolName) return;

        const comp = state.competitions.find((c) => c.comp_id === compId) || {};
        const newJudge = {
          judge_id: 'JDG-74-' + String((state.judges || []).length + 1).padStart(3, '0'),
          comp_id: compId,
          comp_name: comp.comp_name || '',
          learning_area: comp.learning_area || '',
          level: comp.level || '',
          prefix: prefix,
          judge_name: name,
          school_name: schoolName,
          role: role,
          phone: ''
        };
        state.judges.push(newJudge);
        saveState();
        await postToGoogleSheets({
          action: 'add_judge',
          judge: newJudge,
          admin_pin: state.adminPin
        });
        renderAll();
        document.getElementById('judgeFormName').value = '';
        if (customPrefixEl) {
          customPrefixEl.value = '';
          customPrefixEl.classList.add('hidden');
          customPrefixEl.required = false;
        }
        document.getElementById('judgeFormPrefix').value = 'นาย';
        showToast('เพิ่มรายชื่อกรรมการตัดสินเรียบร้อยแล้ว', 'success');
      });
    }

    // Phase 2 Results Subviews & Filters
    document.querySelectorAll('.result-subview-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.resultSubview = btn.getAttribute('data-result-subview') || 'by-comp';
        renderResultsTab();
      });
    });

    ['resAreaFilter', 'resStatusFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', renderResultsTab);
    });

    const resSearchInput = document.getElementById('resSearchInput');
    if (resSearchInput) {
      resSearchInput.addEventListener('input', renderResultsTab);
    }

    // Phase 2 Certificates Tab Events
    ['certRoleFilter', 'certSchoolFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', renderCertificatesTab);
    });

    const certSearchInput = document.getElementById('certSearchInput');
    if (certSearchInput) {
      certSearchInput.addEventListener('input', renderCertificatesTab);
    }

    const btnPrintFilteredCerts = document.getElementById('btnPrintFilteredCerts');
    if (btnPrintFilteredCerts) {
      btnPrintFilteredCerts.addEventListener('click', function () {
        const list = getFilteredCertificateEntries().slice(0, 20);
        printCertificatesWindow(list);
      });
    }

    // Phase 2 Modals (Score Entry & Schedule Edit)
    const btnCloseScoreModal = document.getElementById('btnCloseScoreModal');
    const btnCancelScoreModal = document.getElementById('btnCancelScoreModal');
    if (btnCloseScoreModal) btnCloseScoreModal.addEventListener('click', closeScoreEntryModal);
    if (btnCancelScoreModal) btnCancelScoreModal.addEventListener('click', closeScoreEntryModal);

    const scoreEntryForm = document.getElementById('scoreEntryForm');
    if (scoreEntryForm) {
      scoreEntryForm.addEventListener('submit', handleScoreEntrySubmit);
    }

    const btnCloseScheduleModal = document.getElementById('btnCloseScheduleModal');
    const btnCancelScheduleModal = document.getElementById('btnCancelScheduleModal');
    if (btnCloseScheduleModal) btnCloseScheduleModal.addEventListener('click', closeScheduleEditModal);
    if (btnCancelScheduleModal) btnCancelScheduleModal.addEventListener('click', closeScheduleEditModal);

    const scheduleEditForm = document.getElementById('scheduleEditForm');
    if (scheduleEditForm) {
      scheduleEditForm.addEventListener('submit', handleScheduleEditSubmit);
    }

    // Phase 2 1-Click Copy Code.gs Button
    const btnCopyCodeGs = document.getElementById('btnCopyCodeGs');
    if (btnCopyCodeGs) {
      btnCopyCodeGs.addEventListener('click', copyCodeGsToClipboard);
    }

    // Phase 2: Auto-Lock Registration Schedule Events
    const btnSaveRegCloseDate = document.getElementById('btnSaveRegCloseDate');
    if (btnSaveRegCloseDate) {
      btnSaveRegCloseDate.addEventListener('click', function () {
        if (!state.isAdmin) return;
        const val = (document.getElementById('cfgRegCloseDateTimeInput').value || '').trim();
        if (!val) {
          showToast('กรุณาระบุวันและเวลาปิดรับสมัคร', 'warning');
          return;
        }
        state.config.regCloseDate = val;
        saveState();
        renderAll();
        showToast('บันทึกกำหนดเวลาปิดรับสมัครอัตโนมัติเรียบร้อยแล้ว', 'success');
      });
    }

    const btnToggleRegistrationOpenSchedule = document.getElementById(
      'btnToggleRegistrationOpenSchedule'
    );
    if (btnToggleRegistrationOpenSchedule) {
      btnToggleRegistrationOpenSchedule.addEventListener('click', async function () {
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
            : 'สั่งปิดรับสมัครทันทีเรียบร้อยแล้ว',
          state.registrationOpen ? 'success' : 'warning'
        );
      });
    }

    // Phase 2: District Representatives Summary Reports (Excel & Print)
    const btnExportDistrictRepsExcel = document.getElementById('btnExportDistrictRepsExcel');
    if (btnExportDistrictRepsExcel) {
      btnExportDistrictRepsExcel.addEventListener('click', exportDistrictRepresentativesExcel);
    }
    const btnAdminExportDistrictRepsExcel = document.getElementById(
      'btnAdminExportDistrictRepsExcel'
    );
    if (btnAdminExportDistrictRepsExcel) {
      btnAdminExportDistrictRepsExcel.addEventListener('click', exportDistrictRepresentativesExcel);
    }

    const btnPrintDistrictRepsReport = document.getElementById('btnPrintDistrictRepsReport');
    if (btnPrintDistrictRepsReport) {
      btnPrintDistrictRepsReport.addEventListener('click', printDistrictRepresentativesReport);
    }
    const btnAdminPrintDistrictRepsReport = document.getElementById(
      'btnAdminPrintDistrictRepsReport'
    );
    if (btnAdminPrintDistrictRepsReport) {
      btnAdminPrintDistrictRepsReport.addEventListener('click', printDistrictRepresentativesReport);
    }

    const repCriteriaSelect = document.getElementById('cfgDistrictRepCriteriaSelect');
    const btnSaveDistrictRepCriteria = document.getElementById('btnSaveDistrictRepCriteria');
    if (btnSaveDistrictRepCriteria && repCriteriaSelect) {
      btnSaveDistrictRepCriteria.addEventListener('click', function () {
        if (!state.isAdmin) return;
        state.config.districtRepCriteria = repCriteriaSelect.value || 'rank_1';
        saveState();
        renderAll();
        showToast('บันทึกเกณฑ์ตัวแทนระดับเขตฯ เรียบร้อยแล้ว: ' + getDistrictRepCriteriaLabel(state.config.districtRepCriteria), 'success');
      });
      repCriteriaSelect.addEventListener('change', function () {
        if (!state.isAdmin) return;
        state.config.districtRepCriteria = repCriteriaSelect.value || 'rank_1';
        saveState();
        renderAll();
        showToast('ปรับเกณฑ์ตัวแทนระดับเขตฯ เป็น: ' + getDistrictRepCriteriaLabel(state.config.districtRepCriteria), 'info');
      });
    }

    // Feature Visibility Toggle Handlers (Admin)
    const btnUnlockAllFeaturesNow = document.getElementById('btnUnlockAllFeaturesNow');
    if (btnUnlockAllFeaturesNow) {
      btnUnlockAllFeaturesNow.addEventListener('click', function () {
        if (!state.isAdmin) return;
        if (!state.config) state.config = Object.assign({}, DEFAULT_CONFIG);
        if (!state.config.featureVisibility) state.config.featureVisibility = {};
        state.config.featureVisibility.judges = 'open';
        state.config.featureVisibility.results = 'open';
        state.config.featureVisibility.certificates = 'open';
        saveState();
        updateFeatureVisibilityUI();
        showToast('เปิดทุกฟีเจอร์จัดการแข่งขันต่อสาธารณะทันทีเรียบร้อยแล้ว', 'success');
      });
    }

    const btnResetFeaturesToAuto = document.getElementById('btnResetFeaturesToAuto');
    if (btnResetFeaturesToAuto) {
      btnResetFeaturesToAuto.addEventListener('click', function () {
        if (!state.isAdmin) return;
        if (!state.config) state.config = Object.assign({}, DEFAULT_CONFIG);
        if (!state.config.featureVisibility) state.config.featureVisibility = {};
        state.config.featureVisibility.judges = 'auto';
        state.config.featureVisibility.results = 'auto';
        state.config.featureVisibility.certificates = 'auto';
        saveState();
        updateFeatureVisibilityUI();
        showToast('รีเซ็ตทุกฟีเจอร์เป็นตามกำหนดการแข่งขันเรียบร้อยแล้ว', 'info');
      });
    }

    document.querySelectorAll('[data-feature-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!state.isAdmin) return;
        const key = btn.getAttribute('data-feature-toggle');
        const action = btn.getAttribute('data-action');
        setFeatureVisibility(key, action);
      });
    });

    // Phase 2: Official Substitution Request Form (Print)
    const btnPrintSubstitutionFormSchool = document.getElementById(
      'btnPrintSubstitutionFormSchool'
    );
    if (btnPrintSubstitutionFormSchool) {
      btnPrintSubstitutionFormSchool.addEventListener('click', function () {
        printSubstitutionForm();
      });
    }
    const btnPrintSubstitutionFormComp = document.getElementById('btnPrintSubstitutionFormComp');
    if (btnPrintSubstitutionFormComp) {
      btnPrintSubstitutionFormComp.addEventListener('click', function () {
        printSubstitutionForm();
      });
    }
    const btnPrintSubstitutionFormAdmin = document.getElementById(
      'btnPrintSubstitutionFormAdmin'
    );
    if (btnPrintSubstitutionFormAdmin) {
      btnPrintSubstitutionFormAdmin.addEventListener('click', function () {
        printSubstitutionForm();
      });
    }

    // Phase 2: Certificate & Canva Template Customizer Events
    const certConfigForm = document.getElementById('certConfigForm');
    if (certConfigForm) {
      certConfigForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!state.isAdmin) return;
        state.config.certPrefix =
          (document.getElementById('cfgCertPrefixInput').value || '').trim() || 'WYK74-2569-';
        state.config.certIssueDate =
          (document.getElementById('cfgCertIssueDateInput').value || '').trim() ||
          '25 พฤศจิกายน พุทธศักราช 2569';
        state.config.certSignerName = (
          document.getElementById('cfgCertSignerNameInput').value || ''
        ).trim();
        state.config.certSignerPos =
          (document.getElementById('cfgCertSignerPosInput').value || '').trim() ||
          'ประธานกลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง';
        state.config.certSignerOrg =
          (document.getElementById('cfgCertSignerOrgInput').value || '').trim() ||
          'สำนักงานเขตพื้นที่การศึกษาประถมศึกษามหาสารคาม เขต 3';
        saveState();
        renderAll();
        showToast('บันทึกการตั้งค่าเกียรติบัตรเรียบร้อยแล้ว', 'success');
      });
    }

    const cfgCertSigFileInput = document.getElementById('cfgCertSigFileInput');
    if (cfgCertSigFileInput) {
      cfgCertSigFileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          showToast('ไฟล์รูปภาพมีขนาดใหญ่เกิน 2 MB', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = function (ev) {
          state.config.certSignatureUrl = ev.target.result;
          saveState();
          updateCertConfigUI();
          showToast('อัปโหลดลายมือชื่อดิจิทัลเรียบร้อยแล้ว', 'success');
        };
        reader.readAsDataURL(file);
      });
    }

    const btnClearCertSig = document.getElementById('btnClearCertSig');
    if (btnClearCertSig) {
      btnClearCertSig.addEventListener('click', function () {
        state.config.certSignatureUrl = '';
        const fileInput = document.getElementById('cfgCertSigFileInput');
        if (fileInput) fileInput.value = '';
        saveState();
        updateCertConfigUI();
        showToast('ลบลายมือชื่อดิจิทัลแล้ว', 'info');
      });
    }

    const certBgModeStandard = document.getElementById('certBgModeStandard');
    const certBgModeCanva = document.getElementById('certBgModeCanva');
    if (certBgModeStandard) {
      certBgModeStandard.addEventListener('change', function () {
        if (certBgModeStandard.checked) {
          state.config.certBgMode = 'standard';
          saveState();
          updateCertConfigUI();
        }
      });
    }
    if (certBgModeCanva) {
      certBgModeCanva.addEventListener('change', function () {
        if (certBgModeCanva.checked) {
          state.config.certBgMode = 'canva';
          saveState();
          updateCertConfigUI();
        }
      });
    }

    const cfgCertBgFileInput = document.getElementById('cfgCertBgFileInput');
    if (cfgCertBgFileInput) {
      cfgCertBgFileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showToast('ไฟล์รูปภาพพื้นหลังมีขนาดใหญ่เกิน 5 MB', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = function (ev) {
          state.config.certBgImageUrl = ev.target.result;
          state.config.certBgMode = 'canva';
          saveState();
          updateCertConfigUI();
          showToast('อัปโหลดพื้นหลังเกียรติบัตร (Canva) เรียบร้อยแล้ว', 'success');
        };
        reader.readAsDataURL(file);
      });
    }

    const btnClearCertBg = document.getElementById('btnClearCertBg');
    if (btnClearCertBg) {
      btnClearCertBg.addEventListener('click', function () {
        state.config.certBgImageUrl = '';
        state.config.certBgMode = 'standard';
        const fileInput = document.getElementById('cfgCertBgFileInput');
        if (fileInput) fileInput.value = '';
        saveState();
        updateCertConfigUI();
        showToast('ลบรูปภาพพื้นหลังเกียรติบัตรแล้ว', 'info');
      });
    }

    const btnPreviewCertSample = document.getElementById('btnPreviewCertSample');
    if (btnPreviewCertSample) {
      btnPreviewCertSample.addEventListener('click', function () {
        const sampleEntry = {
          cert_code: (state.config.certPrefix || 'WYK74-2569-') + 'SAMPLE-001',
          role_type: 'STUDENT',
          role_label: 'นักเรียนผู้เข้าแข่งขัน',
          recipient_name: 'เด็กชายตัวอย่าง มีปัญญา',
          grade_or_pos: 'นักเรียนชั้นประถมศึกษาปีที่ 6',
          school_name: 'โรงเรียนบ้านวังยาววิทยายน',
          comp_id: 'SOC-001',
          comp_name: 'การประกวดเพลงกล่อมเด็ก',
          learning_area: 'กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม',
          level: 'ป.1-ป.6',
          score: '94.50',
          medal: 'เหรียญทอง',
          award_title: 'รางวัลชนะเลิศ'
        };
        printCertificatesWindow([sampleEntry]);
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
    if (state.gasWebAppUrl) {
      syncFromGoogleSheets(false);
    }
  });
})();
