#!/usr/bin/env python3
"""
Generate the Arts & Crafts Competition (74th / 2569) Judge Allocation & Schedule Workbook.

Fetches live registration data from the talent69 Google Apps Script endpoint (or reads a local
JSON snapshot) and optionally merges an edited/uploaded teacher roster (.xlsx or .csv) with
explicit subject majors. Falls back to core-major-first inference when a teacher's major is
not explicitly provided.

Outputs a 7-sheet Excel workbook ready for cluster-level committee review:
  1_สรุปภาพรวมและกติกา
  2_คลังครูและวิชาเอก
  3_ตารางแข่งขัน_24-25พย
  4_ผังกรรมการ_โหมดB_แนะนำ
  5_ผังกรรมการ_โหมดA_สพฐ
  6_รายการบายและภาระงานครู
  7_แบบฟอร์มคะแนน_เฉลี่ย100
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

DEFAULT_GAS_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbxMnn_WoMLx83wa--6WcYMgBEmR1sqoxyKST1RxLaxFEHaEWjjuBQB1j47vd4U83eCqoQ/exec"
)
DEFAULT_OUTPUT_XLSX = "ผังจัดสรรกรรมการและตารางแข่งขัน_ศิลปหัตถกรรม74.xlsx"

# --- Subject major mapping (core majors weighted highest) ---
# Keys use normalized numeric prefixes (e.g. "9", "11.1") matching area_prefix()
CORE_MAJORS = [
    ("9", "ปฐมวัย", 100),
    ("11.1", "ภาษาไทย", 100),
    ("11.2", "คณิตศาสตร์", 100),
    ("11.3", "วิทยาศาสตร์", 100),
    ("11.4", "ภาษาอังกฤษ", 100),
    ("12.1", "สังคมศึกษา", 100),
    ("4", "สุขศึกษาและพลศึกษา", 100),
    ("2", "คอมพิวเตอร์", 100),
]

SECONDARY_MAJORS = [
    ("7", "ดนตรี", 30),
    ("6", "นาฏศิลป์", 30),
    ("5", "ทัศนศิลป์/ศิลปะ", 30),
    ("3", "การงานอาชีพ", 30),
]

GENERAL_MAJORS = [
    ("10", "การศึกษาพิเศษ/เรียนรวม", 10),
    ("12.2", "กิจกรรมพัฒนาผู้เรียน", 10),
    ("13", "ดนตรีพื้นเมืองอีสาน", 10),
    ("1", "ภาพยนตร์สั้น/สื่อ", 10),
    ("8", "หนังสือเล่มเล็ก", 10),
]

ALL_MAJOR_CHOICES = [
    "ปฐมวัย",
    "ภาษาไทย",
    "คณิตศาสตร์",
    "วิทยาศาสตร์",
    "ภาษาอังกฤษ",
    "สังคมศึกษา",
    "สุขศึกษาและพลศึกษา",
    "คอมพิวเตอร์",
    "ทัศนศิลป์/ศิลปะ",
    "ดนตรี",
    "นาฏศิลป์",
    "การงานอาชีพ",
    "การศึกษาพิเศษ/เรียนรวม",
    "กิจกรรมพัฒนาผู้เรียน",
    "ดนตรีพื้นเมืองอีสาน",
    "ภาพยนตร์สั้น/สื่อ",
    "หนังสือเล่มเล็ก",
    "ทั่วไป/ไม่ระบุเอก",
]

# Compatible majors for each learning area prefix (primary match, then secondary acceptable majors)
AREA_COMPATIBILITY: dict[str, tuple[list[str], list[str]]] = {
    "1": (["ภาพยนตร์สั้น/สื่อ", "คอมพิวเตอร์"], ["ภาษาไทย", "ทัศนศิลป์/ศิลปะ"]),
    "2": (["คอมพิวเตอร์"], ["คณิตศาสตร์", "วิทยาศาสตร์", "ทัศนศิลป์/ศิลปะ"]),
    "3": (["การงานอาชีพ"], ["วิทยาศาสตร์", "ทัศนศิลป์/ศิลปะ", "ปฐมวัย"]),
    "4": (["สุขศึกษาและพลศึกษา"], ["นาฏศิลป์", "ดนตรี"]),
    "5": (["ทัศนศิลป์/ศิลปะ"], ["ปฐมวัย", "การงานอาชีพ", "คอมพิวเตอร์"]),
    "6": (["นาฏศิลป์"], ["ดนตรี", "สุขศึกษาและพลศึกษา"]),
    "7": (["ดนตรี", "ดนตรีพื้นเมืองอีสาน"], ["นาฏศิลป์", "ภาษาไทย"]),
    "8": (["หนังสือเล่มเล็ก", "ภาษาไทย"], ["ทัศนศิลป์/ศิลปะ", "สังคมศึกษา"]),
    "9": (["ปฐมวัย"], ["ทัศนศิลป์/ศิลปะ", "ภาษาไทย"]),
    "10": (["การศึกษาพิเศษ/เรียนรวม"], ["ทัศนศิลป์/ศิลปะ", "การงานอาชีพ", "ปฐมวัย", "ภาษาไทย"]),
    "11.1": (["ภาษาไทย"], ["สังคมศึกษา", "ปฐมวัย"]),
    "11.2": (["คณิตศาสตร์"], ["วิทยาศาสตร์", "คอมพิวเตอร์"]),
    "11.3": (["วิทยาศาสตร์"], ["คณิตศาสตร์", "คอมพิวเตอร์"]),
    "11.4": (["ภาษาอังกฤษ"], ["ภาษาไทย"]),
    "12.1": (["สังคมศึกษา"], ["ภาษาไทย", "กิจกรรมพัฒนาผู้เรียน"]),
    "12.2": (["กิจกรรมพัฒนาผู้เรียน"], ["สุขศึกษาและพลศึกษา", "สังคมศึกษา"]),
    "13": (["ดนตรีพื้นเมืองอีสาน", "ดนตรี"], ["นาฏศิลป์"]),
}

# Competition mode classification: work-submission vs live-performance, and approximate duration
LIVE_KEYWORDS = (
    "ขับร้อง",
    "เดี่ยว",
    "วง",
    "มารยาทไทย",
    "สวดมนต์",
    "พูดภาษาอังกฤษ",
    "เล่านิทาน",
    "ออกกำลังกาย",
    "แอโรบิก",
    "คีตะมวยไทย",
    "คีตศิลป์",
    "ผูกเงื่อน",
    "เข็มทิศ",
    "ค่ายพักแรม",
    "สภานักเรียน",
    "ต่อคำศัพท์",
    "ต่อสมการ",
    "เอแม็ท",
    "ทำอาหาร",
    "รำและระบำ",
    "นาฏศิลป์",
    "รำวง",
    "เต้นหางเครื่อง",
    "โครงงาน",
)


@dataclass
class Teacher:
    teacher_id: str
    school_name: str
    prefix: str
    full_name: str
    inferred_major: str
    confidence: str
    inference_reason: str
    explicit_major: str = ""
    source: str = "ครูผู้ฝึกสอน (จากระบบ)"
    coached_comp_ids: set[str] = field(default_factory=set)
    coached_labels: list[str] = field(default_factory=list)

    @property
    def effective_major(self) -> str:
        return self.explicit_major.strip() or self.inferred_major

    @property
    def display_name(self) -> str:
        p = self.prefix.strip()
        if p and not self.full_name.startswith(p):
            return f"{p}{self.full_name}" if p.endswith(".") else f"{p} {self.full_name}"
        return self.full_name


@dataclass
class CompetitionPlan:
    comp_id: str
    learning_area: str
    comp_name: str
    level: str
    team_type: str
    schools_registered: list[str]
    status_type: str  # "ACTIVE", "BYE", "EMPTY"
    format_type: str  # "ส่งชิ้นงาน" or "แสดงสด"
    duration_text: str
    day_label: str = ""
    compete_time: str = ""
    judge_slot: str = ""  # e.g., "D1-AM1", "D1-AM2", "D1-PM1", "D1-PM2", "D2-..."
    judge_time_text: str = ""


def norm_space(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def area_prefix(learning_area: str) -> str:
    m = re.match(r"^(\d+(?:\.\d+)?)", learning_area.strip())
    return m.group(1) if m else ""


def classify_area_tier(learning_area: str) -> tuple[int, str, int]:
    pref = area_prefix(learning_area)
    for key, major, weight in CORE_MAJORS:
        if pref == key:
            return 1, major, weight
    for key, major, weight in SECONDARY_MAJORS:
        if pref == key:
            return 2, major, weight
    for key, major, weight in GENERAL_MAJORS:
        if pref == key:
            return 3, major, weight
    return 3, "ทั่วไป/ไม่ระบุเอก", 5


def infer_teacher_major(coached_areas: list[str]) -> tuple[str, str, str]:
    """Infer teacher's true major giving highest priority to Tier-1 core subjects."""
    if not coached_areas:
        return "ทั่วไป/ไม่ระบุเอก", "ไม่มีข้อมูล", "ครูว่าง (ไม่ได้คุมทีม)"

    scores: Counter[str] = Counter()
    tier_hits: dict[int, Counter[str]] = {1: Counter(), 2: Counter(), 3: Counter()}
    for area in coached_areas:
        tier, major, weight = classify_area_tier(area)
        scores[major] += weight
        tier_hits[tier][major] += 1

    if tier_hits[1]:
        best_major, count = tier_hits[1].most_common(1)[0]
        if len(tier_hits[1]) == 1:
            conf = "สูง (เอกหลัก)"
        else:
            conf = "ปานกลาง (คุมหลายเอกหลัก)"
        other = [m for m in (list(tier_hits[2]) + list(tier_hits[3]))]
        reason = f"คุมวิชาหลัก {best_major} ({count} รายการ)"
        if other:
            reason += f" + เสริม {', '.join(other[:2])}"
        return best_major, conf, reason

    if tier_hits[2]:
        best_major, count = tier_hits[2].most_common(1)[0]
        conf = "ปานกลาง (เอกเฉพาะทางรอง)" if len(tier_hits[2]) == 1 else "ต่ำ (คุมหลายสาย)"
        return best_major, conf, f"คุมเฉพาะสาย {best_major} ({count} รายการ)"

    best_major, count = tier_hits[3].most_common(1)[0]
    return best_major, "ต่ำ (รอตรวจสอบเอกจริง)", f"คุมเฉพาะกิจกรรมเสริม {best_major} ({count} รายการ)"


def is_live_competition(comp_name: str, learning_area: str) -> bool:
    if any(k in comp_name for k in LIVE_KEYWORDS):
        return True
    if learning_area.startswith(("4.", "6.", "7.", "13.")):
        return True
    return False


def estimate_duration_text(comp_name: str, format_type: str, num_schools: int) -> str:
    if format_type == "ส่งชิ้นงาน":
        if "คัดลายมือ" in comp_name or "เรียงร้อย" in comp_name:
            return "แข่ง 90 นาที (ตรวจชิ้นงาน ~45 นาที)"
        if "คิดเลขเร็ว" in comp_name:
            return "แข่ง ~45 นาที (ตรวจกระดาษคำตอบ ~30 นาที)"
        return "แข่ง 3 ชม. (ตรวจชิ้นงาน ~45–60 นาที)"

    # Live performance estimates
    if "ขับร้อง" in comp_name or "เดี่ยว" in comp_name:
        mins = max(20, num_schools * 6)
        return f"แสดงสด ~{mins} นาที ({num_schools} รร. × ~5–6 นาที)"
    if "มารยาทไทย" in comp_name:
        mins = max(20, num_schools * 6)
        return f"แสดงสด ~{mins} นาที ({num_schools} รร. × ~5 นาที)"
    if "เล่านิทาน" in comp_name or "พูดภาษาอังกฤษ" in comp_name:
        mins = max(30, num_schools * 8)
        return f"แสดงสด ~{mins} นาที ({num_schools} รร. × ~6–8 นาที)"
    if "สวดมนต์" in comp_name:
        mins = max(30, num_schools * 10)
        return f"แสดงสด ~{mins} นาที ({num_schools} รร. × ~10 นาที)"
    if "ต่อคำศัพท์" in comp_name or "เอแม็ท" in comp_name:
        return f"แข่งแบบพบกัน/เก็บคะแนน ~90–120 นาที ({num_schools} รร.)"
    if "ทำอาหาร" in comp_name:
        return "ปฏิบัติจริง 2–3 ชม."
    return f"แสดงสด/ฐานปฏิบัติ ~45–60 นาที ({num_schools} รร.)"


def classify_bye_or_active(comp: dict[str, Any], num_schools: int) -> str:
    if num_schools == 0:
        return "EMPTY"
    lv = comp.get("level", "")
    is_sec_only = ("ม." in lv) and ("ป." not in lv)
    if is_sec_only:
        return "ACTIVE" if num_schools >= 3 else "BYE"
    return "ACTIVE" if num_schools >= 2 else "BYE"


def assign_two_day_schedule(active_plans: list[CompetitionPlan]) -> None:
    """
    Assign Day 1 (24 พ.ย. 2569) and Day 2 (25 พ.ย. 2569) schedules.
    Rules:
      - Each item & same level finishes within 1 day (no cross-day).
      - Levels separated by day where practical:
          Day 1 (24 พ.ย.): ปฐมวัย + ป.1–ป.3 + ลูกทุ่ง (ป.1–6) + แอโรบิก (ป.1–6) + เรียนรวม (ป.1–6)
          Day 2 (25 พ.ย.): ป.4–ป.6 + ม.1–ม.3 + ลูกกรุง (ป.1–6) + เดี่ยวพิณ (ป.1–6) + เอแม็ท (ป.1–6) + สวดมนต์แปล (ป.1–ม.3)
      - Work-submission items: students compete 09:00–12:00 (or 13:00–16:00), judges evaluate in later non-overlapping sub-slots on the same day.
      - Live-performance items in the same subject area get staggered sub-slots so the same specialists can judge multiple items without overlap.
    """
    # Explicit sub-slot schedule map by comp_id for the 37 active items, plus general fallback rule
    day1_schedule = {
        # ปฐมวัย (3) — แข่งเช้า 09:00-12:00, กรรมการปฐมวัยทยอยตรวจ/สัมภาษณ์ช่วงบ่าย
        "EC09-01": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM1", "13:00–14:30 น."),
        "EC09-02": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM2", "14:30–16:00 น."),
        "EC09-03": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM1", "13:00–14:30 น."),
        # คอมพิวเตอร์ ป.1-3
        "SP02-01": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM1", "13:00–14:30 น."),
        # ทัศนศิลป์ ป.1-3 (3)
        "SP05-01": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM1", "13:00–14:30 น."),
        "SP05-04": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM2", "14:30–16:00 น."),
        "SP05-11": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM1", "13:00–14:30 น."),
        # ภาษาไทย ป.1-3 (2) — คัดลายมือแข่งเช้า 1 ตรวจเช้า 2, เรียงร้อยแข่งเช้า 2 ตรวจบ่าย 1
        "AC11-TH01": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–10:30 น.", "D1-AM2", "10:30–12:00 น."),
        "AC11-TH06": ("วันอังคารที่ 24 พ.ย. 2569", "10:30–12:00 น.", "D1-PM1", "13:00–14:30 น."),
        # คณิตศาสตร์ ป.1-3
        "AC11-MA01": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–10:00 น.", "D1-AM2", "10:30–12:00 น."),
        # มารยาทไทย ป.1-3 & ผูกเงื่อน ป.1-3
        "MO12-SO04": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–10:30 น.", "D1-AM1", "09:00–10:30 น."),
        "MO12-AC01": ("วันอังคารที่ 24 พ.ย. 2569", "10:30–12:00 น.", "D1-AM2", "10:30–12:00 น."),
        # ดนตรีลูกทุ่ง (2) + แอโรบิก (1)
        "SP07-09": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–10:30 น.", "D1-AM1", "09:00–10:30 น."),
        "SP07-11": ("วันอังคารที่ 24 พ.ย. 2569", "10:30–12:00 น.", "D1-AM2", "10:30–12:00 น."),
        "SP04-01": ("วันอังคารที่ 24 พ.ย. 2569", "13:00–14:30 น.", "D1-PM1", "13:00–14:30 น."),
        # เรียนรวม (3) — แข่งเช้า ตรวจบ่าย
        "SE10-04": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM1", "13:00–14:30 น."),
        "SE10-06": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM2", "14:30–16:00 น."),
        "SE10-12": ("วันอังคารที่ 24 พ.ย. 2569", "09:00–12:00 น.", "D1-PM2", "14:30–16:00 น."),
    }

    day2_schedule = {
        # คอมพิวเตอร์ ป.4-6
        "SP02-02": ("วันพุธที่ 25 พ.ย. 2569", "09:00–12:00 น.", "D2-PM1", "13:00–14:30 น."),
        # การงานอาชีพ ป.4-6 (ทำอาหาร)
        "SP03-13": ("วันพุธที่ 25 พ.ย. 2569", "09:00–12:00 น.", "D2-AM1", "09:00–12:00 น."),
        # ทัศนศิลป์ ป.4-6 (4) — แข่งเช้า ตรวจบ่าย 1-2
        "SP05-02": ("วันพุธที่ 25 พ.ย. 2569", "09:00–12:00 น.", "D2-PM1", "13:00–14:30 น."),
        "SP05-05": ("วันพุธที่ 25 พ.ย. 2569", "09:00–12:00 น.", "D2-PM2", "14:30–16:00 น."),
        "SP05-08": ("วันพุธที่ 25 พ.ย. 2569", "09:00–12:00 น.", "D2-PM1", "13:00–14:30 น."),
        "SP05-12": ("วันพุธที่ 25 พ.ย. 2569", "09:00–12:00 น.", "D2-PM2", "14:30–16:00 น."),
        # ดนตรีลูกกรุง (2) + เดี่ยวพิณ (1) — แสดงสดสลับช่วงเวลาไม่ให้ชนกัน
        "SP07-13": ("วันพุธที่ 25 พ.ย. 2569", "09:00–10:30 น.", "D2-AM1", "09:00–10:30 น."),
        "SP07-15": ("วันพุธที่ 25 พ.ย. 2569", "10:30–12:00 น.", "D2-AM2", "10:30–12:00 น."),
        "LO13-03": ("วันพุธที่ 25 พ.ย. 2569", "13:00–14:30 น.", "D2-PM1", "13:00–14:30 น."),
        # ภาษาไทย ป.4-6 (3)
        "AC11-TH02": ("วันพุธที่ 25 พ.ย. 2569", "09:00–10:30 น.", "D2-AM2", "10:30–12:00 น."),
        "AC11-TH07": ("วันพุธที่ 25 พ.ย. 2569", "10:30–12:00 น.", "D2-PM1", "13:00–14:30 น."),
        "AC11-TH04": ("วันพุธที่ 25 พ.ย. 2569", "13:00–14:30 น.", "D2-PM1", "13:00–14:30 น."),
        # คณิตศาสตร์ ป.4-6 / ม.1-3 / เอแม็ท (3)
        "AC11-MA02": ("วันพุธที่ 25 พ.ย. 2569", "09:00–10:00 น.", "D2-AM2", "10:30–12:00 น."),
        "AC11-MA03": ("วันพุธที่ 25 พ.ย. 2569", "10:30–11:30 น.", "D2-PM1", "13:00–14:30 น."),
        "AC11-MA04": ("วันพุธที่ 25 พ.ย. 2569", "13:00–14:30 น.", "D2-PM1", "13:00–14:30 น."),
        # ภาษาอังกฤษ ป.4-6 (2) — สลับเช้า 1 / เช้า 2
        "AC11-EN01": ("วันพุธที่ 25 พ.ย. 2569", "09:00–10:30 น.", "D2-AM1", "09:00–10:30 น."),
        "AC11-EN03": ("วันพุธที่ 25 พ.ย. 2569", "10:30–12:00 น.", "D2-AM2", "10:30–12:00 น."),
        # สังคมศึกษาฯ (2) — สลับเช้า / บ่าย
        "MO12-SO05": ("วันพุธที่ 25 พ.ย. 2569", "09:00–10:30 น.", "D2-AM1", "09:00–10:30 น."),
        "MO12-SO07": ("วันพุธที่ 25 พ.ย. 2569", "13:00–14:30 น.", "D2-PM1", "13:00–14:30 น."),
    }

    for p in active_plans:
        if p.comp_id in day1_schedule:
            p.day_label, p.compete_time, p.judge_slot, p.judge_time_text = day1_schedule[p.comp_id]
        elif p.comp_id in day2_schedule:
            p.day_label, p.compete_time, p.judge_slot, p.judge_time_text = day2_schedule[p.comp_id]
        else:
            # General fallback for any future newly-active item
            if "ป.1–ป.3" in p.level or "ปฐมวัย" in p.level:
                p.day_label = "วันอังคารที่ 24 พ.ย. 2569"
                p.compete_time = "09:00–12:00 น."
                p.judge_slot = "D1-PM2"
                p.judge_time_text = "14:30–16:00 น."
            else:
                p.day_label = "วันพุธที่ 25 พ.ย. 2569"
                p.compete_time = "09:00–12:00 น."
                p.judge_slot = "D2-PM2"
                p.judge_time_text = "14:30–16:00 น."


def load_live_data(gas_url: str, json_path: str | None = None) -> dict[str, Any]:
    if json_path:
        return json.loads(Path(json_path).read_text(encoding="utf-8"))
    req = urllib.request.Request(gas_url, headers={"User-Agent": "talent69-judge-planner/1.0"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_explicit_majors(path_str: str | None) -> tuple[dict[tuple[str, str], str], list[dict[str, str]]]:
    """
    Load optional uploaded teacher roster (.xlsx or .csv).
    Supports re-reading Sheet '2_คลังครูและวิชาเอก' from a previously generated workbook or a custom CSV.
    Returns (explicit_major_by_(school, name), extra_teachers_list).
    """
    explicit: dict[tuple[str, str], str] = {}
    extras: list[dict[str, str]] = []
    if not path_str:
        return explicit, extras

    p = Path(path_str)
    if not p.exists():
        raise FileNotFoundError(f"ไม่พบไฟล์รายชื่อครู: {p}")

    rows: list[dict[str, str]] = []
    if p.suffix.lower() in (".xlsx", ".xlsm"):
        wb = openpyxl.load_workbook(p, data_only=True)
        ws = wb["2_คลังครูและวิชาเอก"] if "2_คลังครูและวิชาเอก" in wb.sheetnames else wb.active
        all_rows = list(ws.iter_rows(values_only=True))
        # Find header row containing 'โรงเรียน' and 'ชื่อ'
        hdr_idx = None
        for idx, r in enumerate(all_rows[:10]):
            joined = " ".join(str(x or "") for x in r)
            if "โรงเรียน" in joined and ("ชื่อ" in joined or "นามสกุล" in joined):
                hdr_idx = idx
                break
        if hdr_idx is not None:
            headers = [norm_space(h) for h in all_rows[hdr_idx]]
            for r in all_rows[hdr_idx + 1 :]:
                if not any(r):
                    continue
                rec = {headers[i]: norm_space(r[i] if i < len(r) else "") for i in range(len(headers))}
                rows.append(rec)
    else:
        with p.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for r in reader:
                rows.append({norm_space(k): norm_space(v) for k, v in r.items() if k})

    for rec in rows:
        school = rec.get("โรงเรียน", "") or rec.get("school_name", "")
        name = rec.get("ชื่อ-นามสกุล", "") or rec.get("full_name", "")
        prefix = rec.get("คำนำหน้า", "") or rec.get("prefix", "")
        major = (
            rec.get("วิชาเอก (แก้ไข/กรอกเพิ่มได้)", "")
            or rec.get("วิชาเอก", "")
            or rec.get("major", "")
        )
        if not school or not name:
            continue
        if major:
            explicit[(school, name)] = major
        extras.append({"school": school, "prefix": prefix, "name": name, "major": major})

    return explicit, extras


def build_teachers(
    regs: list[dict[str, Any]],
    explicit_majors: dict[tuple[str, str], str],
    extra_teachers: list[dict[str, str]],
) -> list[Teacher]:
    raw_map: dict[tuple[str, str], dict[str, Any]] = {}

    for r in regs:
        school = norm_space(r.get("school_name", ""))
        cid = norm_space(r.get("comp_id", ""))
        area = norm_space(r.get("learning_area", ""))
        cname = norm_space(r.get("comp_name", ""))
        lv = norm_space(r.get("level", ""))
        ts = r.get("teachers") or []
        if isinstance(ts, str):
            try:
                ts = json.loads(ts)
            except Exception:
                ts = [{"prefix": "", "name": ts}]
        for item in ts:
            if isinstance(item, dict):
                prefix = norm_space(item.get("prefix", ""))
                name = norm_space(item.get("name", ""))
            else:
                prefix = ""
                name = norm_space(item)
            if not name:
                continue
            key = (school, name)
            if key not in raw_map:
                raw_map[key] = {
                    "prefix": prefix,
                    "areas": [],
                    "comp_ids": set(),
                    "labels": [],
                }
            if prefix and not raw_map[key]["prefix"]:
                raw_map[key]["prefix"] = prefix
            raw_map[key]["areas"].append(area)
            raw_map[key]["comp_ids"].add(cid)
            label = f"{cid} {cname} ({lv})"
            if label not in raw_map[key]["labels"]:
                raw_map[key]["labels"].append(label)

    teachers: list[Teacher] = []
    idx = 1
    for (school, name), info in sorted(raw_map.items(), key=lambda x: (x[0][0], x[0][1])):
        inferred, conf, reason = infer_teacher_major(info["areas"])
        exp = explicit_majors.get((school, name), "")
        teachers.append(
            Teacher(
                teacher_id=f"TCH-{idx:03d}",
                school_name=school,
                prefix=info["prefix"],
                full_name=name,
                inferred_major=inferred,
                confidence=conf,
                inference_reason=reason,
                explicit_major=exp,
                source="ครูผู้ฝึกสอน (จากระบบ)",
                coached_comp_ids=info["comp_ids"],
                coached_labels=info["labels"],
            )
        )
        idx += 1

    # Add extra teachers (non-coaching / spare teachers) from uploaded sheet
    existing_keys = {(t.school_name, t.full_name) for t in teachers}
    for ex in extra_teachers:
        key = (ex["school"], ex["name"])
        if key in existing_keys:
            continue
        existing_keys.add(key)
        teachers.append(
            Teacher(
                teacher_id=f"TCH-{idx:03d}",
                school_name=ex["school"],
                prefix=ex["prefix"],
                full_name=ex["name"],
                inferred_major=ex["major"] or "ทั่วไป/ไม่ระบุเอก",
                confidence="กำหนดเอง (ครูเพิ่ม)",
                inference_reason="เพิ่มจากรายชื่อครูที่ไม่ได้คุมทีม",
                explicit_major=ex["major"],
                source="ครูว่าง/เพิ่มเอง",
            )
        )
        idx += 1

    return teachers


def major_match_level(teacher: Teacher, learning_area: str) -> int:
    """
    Returns match quality rank:
      0 = Primary exact major match for this learning area
      1 = Secondary compatible major
      2 = Non-specialist (fallback only, cannot be Chair if a specialist exists)
    """
    pref = area_prefix(learning_area)
    primary, secondary = AREA_COMPATIBILITY.get(pref, ([], []))
    m = teacher.effective_major
    if m in primary:
        return 0
    if m in secondary:
        return 1
    return 2


def allocate_judges_for_mode(
    active_plans: list[CompetitionPlan],
    teachers: list[Teacher],
    mode: str,
) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, str]]]]:
    """
    Allocate judges for all active competitions under Mode A (strict OBEC) or Mode B (cluster compromise).
    Returns:
      - assignments[comp_id] = {
            "judges": [(role, Teacher, note), ...],
            "status": str,
            "warnings": [str, ...],
        }
      - teacher_workload[teacher_id] = [slot_record, ...]
    """
    assignments: dict[str, dict[str, Any]] = {}
    teacher_slots: dict[str, set[str]] = defaultdict(set)
    teacher_day_count: dict[tuple[str, str], int] = Counter()
    teacher_total_count: Counter[str] = Counter()
    teacher_workload: dict[str, list[dict[str, str]]] = defaultdict(list)

    # Track when a teacher's own coached item is competing live at a given slot
    comp_by_id = {p.comp_id: p for p in active_plans}
    teacher_live_coach_slots: dict[str, set[str]] = defaultdict(set)
    for t in teachers:
        for cid in t.coached_comp_ids:
            cp = comp_by_id.get(cid)
            if cp and cp.format_type == "แสดงสด":
                teacher_live_coach_slots[t.teacher_id].add(cp.judge_slot)

    # Sort competitions: hardest/scarce areas and larger school counts first, live items before work-submission
    def sort_key(p: CompetitionPlan) -> tuple[int, int, str]:
        live_prio = 0 if p.format_type == "แสดงสด" else 1
        return (live_prio, -len(p.schools_registered), p.comp_id)

    for p in sorted(active_plans, key=sort_key):
        day_key = "D1" if p.judge_slot.startswith("D1") else "D2"
        competing_schools = set(p.schools_registered)

        def is_available(t: Teacher) -> bool:
            if p.judge_slot in teacher_slots[t.teacher_id]:
                return False
            # Workload cap: max 3 active judging assignments per day (or max 1 per half-day slot already enforced)
            if teacher_day_count[(t.teacher_id, day_key)] >= 3:
                return False
            # In Mode A: strictly forbid any teacher whose school registered in this item
            if mode == "A" and t.school_name in competing_schools:
                return False
            return True

        def score_candidate(t: Teacher, prefer_non_competing: bool = True) -> tuple:
            m_rank = major_match_level(t, p.learning_area)
            from_competing = 1 if t.school_name in competing_schools else 0
            coached_this = 1 if p.comp_id in t.coached_comp_ids else 0
            coach_clash = 1 if p.judge_slot in teacher_live_coach_slots[t.teacher_id] else 0
            day_load = teacher_day_count[(t.teacher_id, day_key)]
            total_load = teacher_total_count[t.teacher_id]
            if prefer_non_competing:
                # Prefer: exact major -> non-competing school -> no coaching clash -> lower workload
                return (m_rank, from_competing, coached_this, coach_clash, day_load, total_load, t.teacher_id)
            return (m_rank, coach_clash, coached_this, from_competing, day_load, total_load, t.teacher_id)

        selected: list[Teacher] = []
        used_schools: set[str] = set()

        def pick_next(pool: list[Teacher], require_distinct_school: bool = True, max_match_rank: int = 2) -> Teacher | None:
            filtered = [
                t
                for t in pool
                if t not in selected
                and is_available(t)
                and major_match_level(t, p.learning_area) <= max_match_rank
                and (not require_distinct_school or t.school_name not in used_schools)
            ]
            if not filtered:
                return None
            filtered.sort(key=lambda t: score_candidate(t, prefer_non_competing=True))
            return filtered[0]

        # Step 1: Pick up to 3 core judges — first try specialist (rank 0-1) from distinct schools
        for target_rank in (0, 1, 2):
            while len(selected) < 3:
                cand = pick_next(teachers, require_distinct_school=True, max_match_rank=target_rank)
                if not cand:
                    break
                selected.append(cand)
                used_schools.add(cand.school_name)

        # If still < 3 (e.g., Mode A with 11 competing schools leaves only 2 schools, or distinct schools exhausted in Mode B)
        if len(selected) < 3 and mode == "B":
            for target_rank in (0, 1, 2):
                while len(selected) < 3:
                    cand = pick_next(teachers, require_distinct_school=False, max_match_rank=target_rank)
                    if not cand:
                        break
                    selected.append(cand)
                    used_schools.add(cand.school_name)

        # Step 2: Extra judges (>3 up to 5) ONLY IF exact-major specialist (rank == 0) is still available & lightly loaded
        if len(selected) == 3:
            for _ in range(2):
                extra = [
                    t
                    for t in teachers
                    if t not in selected
                    and is_available(t)
                    and major_match_level(t, p.learning_area) == 0
                    and t.school_name not in used_schools
                    and teacher_day_count[(t.teacher_id, day_key)] == 0
                ]
                if not extra:
                    break
                extra.sort(key=lambda t: score_candidate(t, prefer_non_competing=True))
                cand = extra[0]
                selected.append(cand)
                used_schools.add(cand.school_name)

        # Step 3: Assign roles — Chair MUST be best major match (and prefer non-competing school if tied)
        selected_sorted = sorted(
            selected,
            key=lambda t: (
                major_match_level(t, p.learning_area),
                1 if t.school_name in competing_schools else 0,
                teacher_total_count[t.teacher_id],
            ),
        )

        judges_with_roles: list[tuple[str, Teacher, str]] = []
        warnings: list[str] = []

        for i, t in enumerate(selected_sorted):
            if i == 0:
                role = "ประธานกรรมการ"
            elif i == 1:
                role = "กรรมการและเลขานุการ"
            else:
                role = "กรรมการ"

            m_rank = major_match_level(t, p.learning_area)
            notes = []
            if m_rank == 0:
                notes.append("ตรงเอก")
            elif m_rank == 1:
                notes.append("เอกใกล้เคียง")
            else:
                notes.append("ต่างเอก (ช่วย)")
            if t.school_name in competing_schools:
                notes.append("รร.ตัวเองแข่ง (งดให้คะแนน รร.ตน/ตกลงเป็นกลาง)")
            if p.judge_slot in teacher_live_coach_slots[t.teacher_id]:
                notes.append("⚠ ช่วงเดียวกับคุมทีม")

            judges_with_roles.append((role, t, " · ".join(notes)))

            # Record workload
            teacher_slots[t.teacher_id].add(p.judge_slot)
            teacher_day_count[(t.teacher_id, day_key)] += 1
            teacher_total_count[t.teacher_id] += 1
            teacher_workload[t.teacher_id].append(
                {
                    "comp_id": p.comp_id,
                    "comp_name": f"{p.comp_name} ({p.level})",
                    "day": p.day_label,
                    "slot": p.judge_slot,
                    "time": p.judge_time_text,
                    "role": role,
                    "format": p.format_type,
                }
            )

        # Evaluate coverage & conflict warnings
        if len(selected_sorted) < 3:
            warnings.append(f"ขาดกรรมการ {3 - len(selected_sorted)} คน (เหลือ รร.ที่ไม่แข่งไม่พอ)")
        if selected_sorted and major_match_level(selected_sorted[0], p.learning_area) == 2:
            warnings.append("ประธานยังไม่ตรงเอก (ขาดครูเอกสาขานี้)")

        # Check every competing school has at least 2 independent judges in Mode B
        if mode == "B" and selected_sorted:
            min_scorable = min(
                sum(1 for _, jt, _ in judges_with_roles if jt.school_name != sch)
                for sch in competing_schools
            )
            if min_scorable < 2:
                warnings.append(f"มี รร. ที่เหลือผู้ให้คะแนน < 2 คน (min={min_scorable})")

        if not warnings:
            status = f"พร้อม ({len(selected_sorted)} คน)"
        else:
            status = f"ตรวจเพิ่ม: {' | '.join(warnings)}"

        assignments[p.comp_id] = {
            "judges": judges_with_roles,
            "status": status,
            "warnings": warnings,
        }

    return assignments, teacher_workload


def assign_bye_order_names(
    bye_plans: list[CompetitionPlan],
    teachers: list[Teacher],
) -> dict[str, list[Teacher]]:
    """
    Assign nominal judge names for official command documents on Bye items.
    Does NOT consume active judging workload (since no live judging occurs on competition day,
    or work-submission items are scored later by active specialists).
    """
    result: dict[str, list[Teacher]] = {}
    bye_count: Counter[str] = Counter()

    for p in bye_plans:
        competing = set(p.schools_registered)
        # Prefer specialists not in competing school first, then any specialist, then general
        candidates = sorted(
            teachers,
            key=lambda t: (
                major_match_level(t, p.learning_area),
                1 if t.school_name in competing else 0,
                bye_count[t.teacher_id],
                t.teacher_id,
            ),
        )
        chosen = []
        used_schools = set()
        for t in candidates:
            if t.school_name in used_schools and len(candidates) >= 3:
                continue
            chosen.append(t)
            used_schools.add(t.school_name)
            bye_count[t.teacher_id] += 1
            if len(chosen) == 3:
                break
        result[p.comp_id] = chosen
    return result


# --- Excel Styling Helpers ---
FONT_NAME = "TH Sarabun New"
ALT_FONT = "Sarabun"

FILL_HEADER = PatternFill("solid", fgColor="1E293B")
FILL_SUBHEADER = PatternFill("solid", fgColor="334155")
FILL_SECTION = PatternFill("solid", fgColor="E2E8F0")
FILL_ZEBRA = PatternFill("solid", fgColor="F8FAFC")
FILL_WHITE = PatternFill("solid", fgColor="FFFFFF")
FILL_OK = PatternFill("solid", fgColor="DCFCE7")
FILL_WARN = PatternFill("solid", fgColor="FEF3C7")
FILL_BAD = PatternFill("solid", fgColor="FEE2E2")
FILL_INFO = PatternFill("solid", fgColor="DBEAFE")
FILL_DAY1 = PatternFill("solid", fgColor="EFF6FF")
FILL_DAY2 = PatternFill("solid", fgColor="F0FDF4")

THIN_BORDER = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1"),
)


def style_cell(
    cell,
    *,
    bold: bool = False,
    size: int = 11,
    color: str = "0F172A",
    fill: PatternFill | None = None,
    align_h: str = "left",
    align_v: str = "center",
    wrap: bool = True,
    border: bool = True,
    num_format: str | None = None,
) -> None:
    cell.font = Font(name=ALT_FONT, size=size, bold=bold, color=color)
    if fill is not None:
        cell.fill = fill
    cell.alignment = Alignment(horizontal=align_h, vertical=align_v, wrap_text=wrap)
    if border:
        cell.border = THIN_BORDER
    if num_format:
        cell.number_format = num_format


def style_banner(ws, max_col: int, title: str, subtitle: str) -> None:
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=max_col)
    c1 = ws.cell(1, 1, title)
    style_cell(c1, bold=True, size=14, color="FFFFFF", fill=FILL_HEADER, align_h="left", border=False)
    ws.row_dimensions[1].height = 30

    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=max_col)
    c2 = ws.cell(2, 1, subtitle)
    style_cell(c2, bold=False, size=10, color="E2E8F0", fill=FILL_SUBHEADER, align_h="left", border=False)
    ws.row_dimensions[2].height = 22


def set_col_widths(ws, widths: list[int]) -> None:
    for idx, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = w


def configure_print(ws, landscape: bool = True) -> None:
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE if landscape else ws.ORIENTATION_PORTRAIT
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0


def format_judge_text(item: tuple[str, Teacher, str] | None) -> str:
    if not item:
        return "-"
    role, t, note = item
    return f"{t.display_name}\n({t.school_name} | เอก: {t.effective_major})\n[{role}: {note}]"


def write_workbook(
    output_path: Path,
    schools: list[dict[str, Any]],
    all_plans: list[CompetitionPlan],
    active_plans: list[CompetitionPlan],
    bye_plans: list[CompetitionPlan],
    empty_plans: list[CompetitionPlan],
    teachers: list[Teacher],
    assign_b: dict[str, dict[str, Any]],
    workload_b: dict[str, list[dict[str, str]]],
    assign_a: dict[str, dict[str, Any]],
    bye_names: dict[str, list[Teacher]],
) -> None:
    wb = openpyxl.Workbook()
    # Remove default sheet later or rename it
    ws1 = wb.active
    ws1.title = "1_สรุปภาพรวมและกติกา"
    ws2 = wb.create_sheet("2_คลังครูและวิชาเอก")
    ws3 = wb.create_sheet("3_ตารางแข่งขัน_24-25พย")
    ws4 = wb.create_sheet("4_ผังกรรมการ_โหมดB_แนะนำ")
    ws5 = wb.create_sheet("5_ผังกรรมการ_โหมดA_สพฐ")
    ws6 = wb.create_sheet("6_รายการบายและภาระงานครู")
    ws7 = wb.create_sheet("7_แบบฟอร์มคะแนน_เฉลี่ย100")

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    # =========================================================================
    # SHEET 1: Executive Summary & Rules
    # =========================================================================
    style_banner(
        ws1,
        6,
        "ผังจัดสรรคณะกรรมการตัดสินและตารางแข่งขัน — งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 (ปีการศึกษา 2569)",
        f"กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง สพป.มหาสารคาม เขต 3 | สร้างจากยอดสมัครจริง ณ {now_str}",
    )

    ws1.cell(4, 1, "1. สรุปตัวเลขรายการแข่งขัน (จากทั้งหมด 149 รายการ)").font = Font(name=ALT_FONT, size=12, bold=True)
    summary_headers = ["หมวดสถานะ", "จำนวนรายการ", "รายละเอียด / แนวทางดำเนินการ"]
    for ci, h in enumerate(summary_headers, 1):
        style_cell(ws1.cell(5, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")

    summary_rows = [
        ("ต้องตัดสินจริง (Active)", len(active_plans), "ประถม ≥ 2 รร. หรือ มัธยม ≥ 3 รร. — ต้องจัดกรรมการ 3–5 คน และลงตารางเวลา 24–25 พ.ย."),
        ("เข้ารอบโดยไม่ต้องแข่ง (บาย)", len(bye_plans), "ประถม 1 รร. (18 รายการ) / มัธยม ≤ 2 รร. (19 รายการ) — ใส่ชื่อในคำสั่ง แต่วันจริงไปช่วยรายการอื่น"),
        ("ไม่มีผู้สมัคร (Empty)", len(empty_plans), "ยอดสมัครเป็น 0 — ไม่ต้องแต่งตั้งคณะกรรมการ"),
        ("รวมทั้งหมด", len(all_plans), f"ครูผู้ฝึกสอนในระบบ {len(teachers)} คน จาก 13 โรงเรียน"),
    ]
    for idx, (lbl, val, desc) in enumerate(summary_rows, start=6):
        fill = FILL_OK if idx == 6 else (FILL_INFO if idx == 7 else (FILL_ZEBRA if idx == 8 else FILL_SECTION))
        style_cell(ws1.cell(idx, 1, lbl), bold=(idx == 9), fill=fill)
        style_cell(ws1.cell(idx, 2, val), bold=True, fill=fill, align_h="center")
        ws1.merge_cells(start_row=idx, start_column=3, end_row=idx, end_column=6)
        style_cell(ws1.cell(idx, 3, desc), bold=(idx == 9), fill=fill)
        ws1.row_dimensions[idx].height = 22

    # Comparison Mode A vs Mode B
    ws1.cell(11, 1, "2. เปรียบเทียบโหมด A (ตามเกณฑ์ สพฐ.) กับ โหมด B (ผ่อนปรนกลุ่มตกลงกันเอง)").font = Font(name=ALT_FONT, size=12, bold=True)
    cmp_headers = ["ประเด็นเปรียบเทียบ", "โหมด A (เคร่งครัด สพฐ.)", "โหมด B (ผ่อนปรน — แนะนำสำหรับประชุม)"]
    ws1.merge_cells("A12:B12")
    ws1.merge_cells("C12:D12")
    ws1.merge_cells("E12:F12")
    style_cell(ws1.cell(12, 1, cmp_headers[0]), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
    style_cell(ws1.cell(12, 3, cmp_headers[1]), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
    style_cell(ws1.cell(12, 5, cmp_headers[2]), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")

    a_ok = sum(1 for v in assign_a.values() if not v["warnings"])
    a_short = sum(1 for v in assign_a.values() if len(v["judges"]) < 3)
    b_ok = sum(1 for v in assign_b.values() if not v["warnings"])
    b_gt3 = sum(1 for v in assign_b.values() if len(v["judges"]) > 3)

    cmp_rows = [
        ("ครูผู้ฝึกสอนตัดสินรายการที่ รร.ตัวเองแข่ง", "ห้ามเด็ดขาด", "เป็นกรรมการได้ แต่งดให้คะแนน รร.ตัวเอง (หรือตกลงเป็นกลางร่วมกัน)"),
        ("จำนวนรายการที่จัดกรรมการได้ครบ 3+ คน (ไม่มีคำเตือน)", f"{a_ok} / {len(active_plans)} รายการ", f"{b_ok} / {len(active_plans)} รายการ"),
        ("รายการที่ขาดกรรมการ (< 3 คน)", f"{a_short} รายการ (เช่น วาดภาพ/คัดลายมือ 11 รร.)", f"{sum(1 for v in assign_b.values() if len(v['judges']) < 3)} รายการ"),
        ("รายการที่มีกรรมการ > 3 คน (เฉพาะตรงเอก)", f"{sum(1 for v in assign_a.values() if len(v['judges']) > 3)} รายการ", f"{b_gt3} รายการ"),
        ("สูตรคำนวณคะแนน", "เฉลี่ยเต็ม 100 จากกรรมการทั้งหมด", "เฉลี่ยเต็ม 100 อัตโนมัติเฉพาะกรรมการที่ลงคะแนนจริง"),
    ]
    for offset, (p_lbl, p_a, p_b) in enumerate(cmp_rows, start=13):
        ws1.merge_cells(start_row=offset, start_column=1, end_row=offset, end_column=2)
        ws1.merge_cells(start_row=offset, start_column=3, end_row=offset, end_column=4)
        ws1.merge_cells(start_row=offset, start_column=5, end_row=offset, end_column=6)
        fill = FILL_ZEBRA if offset % 2 == 1 else FILL_WHITE
        style_cell(ws1.cell(offset, 1, p_lbl), bold=True, fill=fill)
        style_cell(ws1.cell(offset, 3, p_a), fill=FILL_WARN if offset == 15 and a_short > 0 else fill)
        style_cell(ws1.cell(offset, 5, p_b), fill=FILL_OK if offset == 14 else fill)
        ws1.row_dimensions[offset].height = 24

    # School summary table
    ws1.cell(19, 1, "3. สรุปจำนวนครูผู้ฝึกสอนแยกตาม 13 โรงเรียน (เรียงตามจำนวน)").font = Font(name=ALT_FONT, size=12, bold=True)
    sch_hdrs = ["ลำดับ", "โรงเรียน", "ตำบล", "ประเภทโรงเรียน", "จำนวนครูในคลัง", "ครูเอกหลัก (ขั้น 1)"]
    for ci, h in enumerate(sch_hdrs, 1):
        style_cell(ws1.cell(20, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
    t_by_school = defaultdict(list)
    for t in teachers:
        t_by_school[t.school_name].append(t)
    for idx, s in enumerate(schools, start=1):
        r = 20 + idx
        sname = s["school_name"]
        tlist = t_by_school[sname]
        t1_cnt = sum(1 for t in tlist if "เอกหลัก" in t.confidence)
        fill = FILL_ZEBRA if idx % 2 == 1 else FILL_WHITE
        style_cell(ws1.cell(r, 1, idx), fill=fill, align_h="center")
        style_cell(ws1.cell(r, 2, sname), fill=fill)
        style_cell(ws1.cell(r, 3, s.get("subdistrict", "")), fill=fill, align_h="center")
        style_cell(ws1.cell(r, 4, s.get("school_type", "")), fill=fill, align_h="center")
        style_cell(ws1.cell(r, 5, len(tlist)), bold=True, fill=fill, align_h="center")
        style_cell(ws1.cell(r, 6, t1_cnt), fill=fill, align_h="center")
        ws1.row_dimensions[r].height = 20

    guide_row = 20 + len(schools) + 2
    ws1.merge_cells(start_row=guide_row, start_column=1, end_row=guide_row, end_column=6)
    style_cell(
        ws1.cell(
            guide_row,
            1,
            "วิธีอัปโหลด/เพิ่มรายชื่อครูและวิชาเอกจริง: เปิดแท็บ '2_คลังครูและวิชาเอก' → แก้คอลัมน์ 'วิชาเอก (แก้ไข/กรอกเพิ่มได้)' หรือเติมครูว่างที่แถวท้ายตาราง → ส่งไฟล์นี้ให้ AI/สคริปต์รันจัดผังใหม่ได้ทันที",
        ),
        bold=True,
        fill=FILL_INFO,
    )
    ws1.row_dimensions[guide_row].height = 28
    set_col_widths(ws1, [10, 34, 16, 24, 18, 28])
    configure_print(ws1, landscape=True)

    # =========================================================================
    # SHEET 2: Teacher Roster & Inferred / Editable Majors (Uploadable)
    # =========================================================================
    style_banner(
        ws2,
        11,
        "คลังรายชื่อครูและวิชาเอก (อัปโหลด/แก้ไขเพิ่มเติมได้)",
        "คอลัมน์ E มีตัวเลือก Dropdown ให้แก้เอกจริงได้ และด้านล่างมีแถวว่าง 30 แถวสำหรับเติม 'ครูที่ไม่ได้คุมทีม' เพื่อลดภาระครูผู้ฝึกสอน",
    )
    t_headers = [
        "รหัสครู",
        "โรงเรียน",
        "คำนำหน้า",
        "ชื่อ-นามสกุล",
        "วิชาเอก (แก้ไข/กรอกเพิ่มได้)",
        "วิชาเอกที่ระบบเดาให้",
        "ความมั่นใจการเดา",
        "เหตุผลการเดา (เน้นเอกหลักก่อน)",
        "จำนวนรายการที่คุม",
        "รายการที่คุมทีม",
        "แหล่งที่มา",
    ]
    for ci, h in enumerate(t_headers, 1):
        style_cell(ws2.cell(4, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
    ws2.row_dimensions[4].height = 26

    for idx, t in enumerate(teachers, start=1):
        r = 4 + idx
        fill = FILL_ZEBRA if idx % 2 == 1 else FILL_WHITE
        conf_fill = FILL_OK if "สูง" in t.confidence else (FILL_WARN if "ปานกลาง" in t.confidence else FILL_BAD)
        style_cell(ws2.cell(r, 1, t.teacher_id), fill=fill, align_h="center")
        style_cell(ws2.cell(r, 2, t.school_name), fill=fill)
        style_cell(ws2.cell(r, 3, t.prefix), fill=fill, align_h="center")
        style_cell(ws2.cell(r, 4, t.full_name), bold=True, fill=fill)
        style_cell(ws2.cell(r, 5, t.explicit_major or t.inferred_major), bold=True, fill=FILL_INFO)
        style_cell(ws2.cell(r, 6, t.inferred_major), fill=fill)
        style_cell(ws2.cell(r, 7, t.confidence), fill=conf_fill, align_h="center")
        style_cell(ws2.cell(r, 8, t.inference_reason), fill=fill)
        style_cell(ws2.cell(r, 9, len(t.coached_comp_ids)), fill=fill, align_h="center")
        style_cell(ws2.cell(r, 10, " | ".join(t.coached_labels) if t.coached_labels else "-"), fill=fill)
        style_cell(ws2.cell(r, 11, t.source), fill=fill, align_h="center")
        ws2.row_dimensions[r].height = 24 if len(t.coached_labels) <= 2 else 36

    # Add 30 blank rows for extra non-coaching teachers
    start_extra = 4 + len(teachers) + 1
    end_extra = start_extra + 29
    for i, r in enumerate(range(start_extra, end_extra + 1), start=len(teachers) + 1):
        style_cell(ws2.cell(r, 1, f"TCH-{i:03d}"), fill=FILL_WHITE, align_h="center")
        for c in range(2, 11):
            style_cell(ws2.cell(r, c, ""), fill=FILL_WHITE)
        style_cell(ws2.cell(r, 11, "ครูว่าง/เพิ่มเอง"), fill=FILL_WHITE, align_h="center")
        ws2.row_dimensions[r].height = 22

    # Data validations for School and Major columns
    school_list_formula = '"' + ",".join(s["school_name"] for s in schools) + '"'
    major_list_formula = '"' + ",".join(ALL_MAJOR_CHOICES) + '"'
    dv_school = DataValidation(type="list", formula1=school_list_formula, allow_blank=True)
    dv_major = DataValidation(type="list", formula1=major_list_formula, allow_blank=True)
    ws2.add_data_validation(dv_school)
    ws2.add_data_validation(dv_major)
    dv_school.add(f"B{start_extra}:B{end_extra}")
    dv_major.add(f"E5:E{end_extra}")

    set_col_widths(ws2, [10, 30, 12, 24, 22, 22, 20, 30, 14, 42, 18])
    ws2.freeze_panes = "A5"
    configure_print(ws2, landscape=True)

    # =========================================================================
    # SHEET 3: 2-Day Schedule (24-25 พ.ย. 2569)
    # =========================================================================
    style_banner(
        ws3,
        10,
        "ตารางกำหนดการแข่งขัน 2 วัน (24–25 พฤศจิกายน 2569) — จบในวันเดียว แยกตามระดับชั้น",
        "วันที่ 1 (24 พ.ย.): ปฐมวัย + ป.1–3 + ลูกทุ่ง + แอโรบิก + เรียนรวม | วันที่ 2 (25 พ.ย.): ป.4–6 + ม.1–3 + ลูกกรุง + พิณ + เอแม็ท + สวดมนต์แปล",
    )
    s_headers = [
        "วันแข่งขัน",
        "ช่วงเวลากรรมการ",
        "เวลาเด็กแข่งขัน",
        "ลักษณะกิจกรรม",
        "รหัสรายการ",
        "หมวดกิจกรรม",
        "ชื่อรายการแข่งขัน",
        "ระดับชั้น",
        "เวลาตามเกณฑ์ (ประมาณ)",
        "รร. ที่สมัคร (จำนวน / รายชื่อ)",
    ]
    for ci, h in enumerate(s_headers, 1):
        style_cell(ws3.cell(4, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
    ws3.row_dimensions[4].height = 26

    sorted_sched = sorted(active_plans, key=lambda p: (p.judge_slot, p.learning_area, p.comp_id))
    for idx, p in enumerate(sorted_sched, start=1):
        r = 4 + idx
        fill = FILL_DAY1 if p.judge_slot.startswith("D1") else FILL_DAY2
        fmt_fill = FILL_INFO if p.format_type == "ส่งชิ้นงาน" else FILL_WARN
        style_cell(ws3.cell(r, 1, p.day_label), bold=True, fill=fill, align_h="center")
        style_cell(ws3.cell(r, 2, f"{p.judge_time_text}\n({p.judge_slot})"), bold=True, fill=fill, align_h="center")
        style_cell(ws3.cell(r, 3, p.compete_time), fill=fill, align_h="center")
        style_cell(ws3.cell(r, 4, p.format_type), bold=True, fill=fmt_fill, align_h="center")
        style_cell(ws3.cell(r, 5, p.comp_id), bold=True, fill=fill, align_h="center")
        style_cell(ws3.cell(r, 6, p.learning_area), fill=fill)
        style_cell(ws3.cell(r, 7, p.comp_name), bold=True, fill=fill)
        style_cell(ws3.cell(r, 8, p.level), fill=fill, align_h="center")
        style_cell(ws3.cell(r, 9, p.duration_text), fill=fill)
        schools_txt = f"{len(p.schools_registered)} รร.: " + ", ".join(p.schools_registered)
        style_cell(ws3.cell(r, 10, schools_txt), fill=fill)
        ws3.row_dimensions[r].height = 38 if len(p.schools_registered) > 5 else 28

    set_col_widths(ws3, [22, 16, 15, 13, 12, 28, 34, 12, 26, 48])
    ws3.freeze_panes = "A5"
    configure_print(ws3, landscape=True)

    # =========================================================================
    # SHEET 4 & 5: Judge Allocations (Mode B Recommended & Mode A Strict)
    # =========================================================================
    def fill_judge_sheet(ws, title: str, subtitle: str, assign_map: dict[str, dict[str, Any]]) -> None:
        style_banner(ws, 13, title, subtitle)
        j_headers = [
            "รหัสรายการ",
            "หมวดกิจกรรม",
            "ชื่อรายการแข่งขัน",
            "ระดับ",
            "วัน-เวลา (Slot)",
            "ลักษณะ",
            "จำนวน รร.",
            "ประธานกรรมการ (คนที่ 1)",
            "กรรมการและเลขานุการ (คนที่ 2)",
            "กรรมการ (คนที่ 3)",
            "กรรมการเพิ่ม (เฉพาะตรงเอก คนที่ 4)",
            "กรรมการเพิ่ม (เฉพาะตรงเอก คนที่ 5)",
            "สถานะ / ข้อสังเกต",
        ]
        for ci, h in enumerate(j_headers, 1):
            style_cell(ws.cell(4, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
        ws.row_dimensions[4].height = 28

        for idx, p in enumerate(sorted_sched, start=1):
            r = 4 + idx
            info = assign_map[p.comp_id]
            jlist = info["judges"]
            fill = FILL_ZEBRA if idx % 2 == 1 else FILL_WHITE
            st_fill = FILL_OK if not info["warnings"] else (FILL_BAD if len(jlist) < 3 else FILL_WARN)

            style_cell(ws.cell(r, 1, p.comp_id), bold=True, fill=fill, align_h="center")
            style_cell(ws.cell(r, 2, p.learning_area), fill=fill)
            style_cell(ws.cell(r, 3, p.comp_name), bold=True, fill=fill)
            style_cell(ws.cell(r, 4, p.level), fill=fill, align_h="center")
            style_cell(ws.cell(r, 5, f"{p.day_label}\n{p.judge_time_text}"), fill=fill, align_h="center")
            style_cell(ws.cell(r, 6, p.format_type), fill=fill, align_h="center")
            style_cell(ws.cell(r, 7, len(p.schools_registered)), bold=True, fill=fill, align_h="center")

            for j_col_idx in range(5):
                item = jlist[j_col_idx] if j_col_idx < len(jlist) else None
                c = ws.cell(r, 8 + j_col_idx, format_judge_text(item))
                cell_fill = fill
                if item and "รร.ตัวเองแข่ง" in item[2]:
                    cell_fill = FILL_WARN
                elif item and j_col_idx >= 3:
                    cell_fill = FILL_INFO
                style_cell(c, fill=cell_fill)

            style_cell(ws.cell(r, 13, info["status"]), bold=True, fill=st_fill)
            ws.row_dimensions[r].height = 54

        set_col_widths(ws, [11, 24, 28, 10, 20, 12, 10, 30, 30, 30, 28, 28, 28])
        ws.freeze_panes = "A5"
        configure_print(ws, landscape=True)

    fill_judge_sheet(
        ws4,
        "ผังจัดสรรกรรมการ — โหมด B (ผ่อนปรน กลุ่มตกลงกันเอง: แนะนำใช้ประชุม)",
        "อนุญาตให้ครูผู้ฝึกสอนช่วยเป็นกรรมการได้ โดยงดให้คะแนน รร.ตัวเอง (หรือตกลงเป็นกลาง) | เติมคนที่ 4–5 เฉพาะครูตรงเอกที่ยังว่าง",
        assign_b,
    )
    fill_judge_sheet(
        ws5,
        "ผังจัดสรรกรรมการ — โหมด A (ตามเกณฑ์ สพฐ. เคร่งครัด)",
        "ห้ามครูจากโรงเรียนที่ส่งแข่งเป็นกรรมการในรายการนั้น — ใช้แสดงจุดที่ขาดแคลนกรรมการเพื่อขอมติในที่ประชุม",
        assign_a,
    )

    # =========================================================================
    # SHEET 6: Bye List (Official Order Names) + Per-Teacher Workload (Mode B)
    # =========================================================================
    style_banner(
        ws6,
        9,
        "รายการบาย (37 รายการ) และตารางเช็กภาระงานกรรมการรายบุคคล (โหมด B)",
        "ส่วนที่ 1: รายการบายใส่ชื่อในคำสั่งได้โดยไม่นับเป็นภาระงานวันแข่ง | ส่วนที่ 2: ตรวจเวลาชนและจำนวนรายการต่อวันของครูแต่ละคน",
    )

    ws6.cell(4, 1, "ส่วนที่ 1: รายการที่เข้ารอบโดยไม่ต้องแข่ง (บาย 37 รายการ) — แนะนำรายชื่อสำหรับออกคำสั่ง").font = Font(
        name=ALT_FONT, size=12, bold=True
    )
    b_headers = [
        "รหัสรายการ",
        "หมวดกิจกรรม",
        "ชื่อรายการแข่งขัน",
        "ระดับ",
        "ลักษณะ",
        "แนวทางปฏิบัติจริง",
        "รร. ที่ได้สิทธิ์บาย",
        "ชื่อกรรมการในคำสั่ง (1-2-3)",
        "หมายเหตุ",
    ]
    for ci, h in enumerate(b_headers, 1):
        style_cell(ws6.cell(5, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")

    row_cursor = 6
    for idx, p in enumerate(bye_plans, start=1):
        fill = FILL_ZEBRA if idx % 2 == 1 else FILL_WHITE
        action_txt = (
            "ให้เด็กทำชิ้นงาน + ตรวจให้คะแนนทีหลัง"
            if p.format_type == "ส่งชิ้นงาน"
            else "ตัวแทนกลุ่ม (ไม่มีคู่แข่ง) — ไม่ต้องตัดสิน"
        )
        action_fill = FILL_INFO if p.format_type == "ส่งชิ้นงาน" else FILL_OK
        names = " / ".join(f"{t.display_name} ({t.school_name})" for t in bye_names.get(p.comp_id, []))
        style_cell(ws6.cell(row_cursor, 1, p.comp_id), bold=True, fill=fill, align_h="center")
        style_cell(ws6.cell(row_cursor, 2, p.learning_area), fill=fill)
        style_cell(ws6.cell(row_cursor, 3, p.comp_name), bold=True, fill=fill)
        style_cell(ws6.cell(row_cursor, 4, p.level), fill=fill, align_h="center")
        style_cell(ws6.cell(row_cursor, 5, p.format_type), fill=fill, align_h="center")
        style_cell(ws6.cell(row_cursor, 6, action_txt), bold=True, fill=action_fill)
        style_cell(ws6.cell(row_cursor, 7, ", ".join(p.schools_registered)), fill=fill)
        style_cell(ws6.cell(row_cursor, 8, names), fill=fill)
        style_cell(ws6.cell(row_cursor, 9, "ไม่นับเป็นภาระงานวันแข่ง"), fill=fill, align_h="center")
        ws6.row_dimensions[row_cursor].height = 34
        row_cursor += 1

    row_cursor += 2
    ws6.cell(row_cursor, 1, "ส่วนที่ 2: เช็กภาระงานกรรมการตัดสินจริงรายบุคคล (โหมด B — ตรวจเวลาชนและจำนวนรายการต่อวัน)").font = Font(
        name=ALT_FONT, size=12, bold=True
    )
    row_cursor += 1
    w_headers = [
        "รหัสครู",
        "โรงเรียน",
        "ชื่อ-นามสกุล",
        "วิชาเอกที่ใช้จัด",
        "งานวันที่ 1 (24 พ.ย.)",
        "งานวันที่ 2 (25 พ.ย.)",
        "รวมรายการตัดสินจริง",
        "สถานะเวลาชน",
        "รายละเอียดรายการที่ได้รับมอบหมาย",
    ]
    for ci, h in enumerate(w_headers, 1):
        style_cell(ws6.cell(row_cursor, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
    row_cursor += 1

    for idx, t in enumerate(teachers, start=1):
        wlist = workload_b.get(t.teacher_id, [])
        d1_cnt = sum(1 for w in wlist if w["slot"].startswith("D1"))
        d2_cnt = sum(1 for w in wlist if w["slot"].startswith("D2"))
        slots = [w["slot"] for w in wlist]
        has_clash = len(slots) != len(set(slots))
        fill = FILL_ZEBRA if idx % 2 == 1 else FILL_WHITE
        detail = " | ".join(f"[{w['slot']}] {w['comp_id']} {w['comp_name']} ({w['role']})" for w in wlist) or "ว่าง (สำรอง/คุมเด็ก)"
        style_cell(ws6.cell(row_cursor, 1, t.teacher_id), fill=fill, align_h="center")
        style_cell(ws6.cell(row_cursor, 2, t.school_name), fill=fill)
        style_cell(ws6.cell(row_cursor, 3, t.display_name), bold=True, fill=fill)
        style_cell(ws6.cell(row_cursor, 4, t.effective_major), fill=fill, align_h="center")
        style_cell(ws6.cell(row_cursor, 5, d1_cnt), fill=fill, align_h="center")
        style_cell(ws6.cell(row_cursor, 6, d2_cnt), fill=fill, align_h="center")
        style_cell(ws6.cell(row_cursor, 7, len(wlist)), bold=True, fill=FILL_INFO if wlist else fill, align_h="center")
        style_cell(
            ws6.cell(row_cursor, 8, "เวลาชน!" if has_clash else "ไม่ชน"),
            bold=True,
            fill=FILL_BAD if has_clash else FILL_OK,
            align_h="center",
        )
        style_cell(ws6.cell(row_cursor, 9, detail), fill=fill)
        ws6.row_dimensions[row_cursor].height = 28 if len(wlist) <= 2 else 42
        row_cursor += 1

    set_col_widths(ws6, [11, 28, 28, 18, 15, 24, 24, 36, 48])
    configure_print(ws6, landscape=True)

    # =========================================================================
    # SHEET 7: Flexible N-Judge Score Sheet Template (Auto-Average to 100)
    # =========================================================================
    style_banner(
        ws7,
        11,
        "แบบฟอร์มบันทึกคะแนนโหมด B — รองรับกรรมการ 1–5+ คน และเฉลี่ยเต็ม 100 อัตโนมัติ",
        "วิธีใช้: กรอกคะแนนเต็ม 100 ของกรรมการแต่ละท่าน · ถ้ากรรมการท่านใดงดให้คะแนนโรงเรียนตัวเอง ให้ใส่ '-' หรือเว้นว่าง สูตรจะเฉลี่ยเฉพาะคนที่ลงคะแนนจริงให้อัตโนมัติ",
    )
    sc_headers = [
        "ลำดับ",
        "รหัสรายการ",
        "รายการแข่งขัน",
        "โรงเรียนผู้เข้าแข่งขัน",
        "กรรมการคนที่ 1",
        "กรรมการคนที่ 2",
        "กรรมการคนที่ 3",
        "กรรมการคนที่ 4",
        "กรรมการคนที่ 5",
        "จำนวนผู้ลงคะแนนจริง",
        "คะแนนเฉลี่ย (เต็ม 100)",
        "ระดับเหรียญ (อัตโนมัติ)",
    ]
    # Expand banner merge to 12 cols
    ws7.unmerge_cells("A1:K1")
    ws7.unmerge_cells("A2:K2")
    ws7.merge_cells("A1:L1")
    ws7.merge_cells("A2:L2")
    for ci, h in enumerate(sc_headers, 1):
        style_cell(ws7.cell(4, ci, h), bold=True, color="FFFFFF", fill=FILL_SUBHEADER, align_h="center")
    ws7.row_dimensions[4].height = 28

    # Seed sample rows from the first active item so users see live formula in action
    sample_item = sorted_sched[0]
    for idx, sch in enumerate(sample_item.schools_registered, start=1):
        r = 4 + idx
        fill = FILL_ZEBRA if idx % 2 == 1 else FILL_WHITE
        style_cell(ws7.cell(r, 1, idx), fill=fill, align_h="center")
        style_cell(ws7.cell(r, 2, sample_item.comp_id), fill=fill, align_h="center")
        style_cell(ws7.cell(r, 3, f"{sample_item.comp_name} ({sample_item.level})"), fill=fill)
        style_cell(ws7.cell(r, 4, sch), bold=True, fill=fill)
        # Put example scores: simulate 1 abstention '-' on row 1, normal 3 scores on row 2, 4 scores on row 3
        ex_scores = [
            "-" if idx == 1 else 86,
            88 if idx <= 3 else "",
            90 if idx <= 3 else "",
            89 if idx == 3 else "",
            "",
        ]
        for j, val in enumerate(ex_scores, start=5):
            style_cell(ws7.cell(r, j, val), fill=FILL_WARN if val == "-" else fill, align_h="center")
        style_cell(ws7.cell(r, 10, f"=COUNT(E{r}:I{r})"), fill=fill, align_h="center")
        style_cell(
            ws7.cell(r, 11, f'=IF(COUNT(E{r}:I{r})=0,"",AVERAGE(E{r}:I{r}))'),
            bold=True,
            fill=FILL_INFO,
            align_h="center",
            num_format="0.00",
        )
        style_cell(
            ws7.cell(
                r,
                12,
                f'=IF(K{r}="","",IF(K{r}>=80,"เหรียญทอง",IF(K{r}>=70,"เหรียญเงิน",IF(K{r}>=60,"เหรียญทองแดง","เข้าร่วม"))))',
            ),
            bold=True,
            fill=FILL_OK,
            align_h="center",
        )
        ws7.row_dimensions[r].height = 24

    # Extra blank formula rows
    for r in range(4 + len(sample_item.schools_registered) + 1, 25):
        style_cell(ws7.cell(r, 1, r - 4), fill=FILL_WHITE, align_h="center")
        for c in range(2, 10):
            style_cell(ws7.cell(r, c, ""), fill=FILL_WHITE, align_h="center" if c >= 5 else "left")
        style_cell(ws7.cell(r, 10, f"=COUNT(E{r}:I{r})"), fill=FILL_WHITE, align_h="center")
        style_cell(
            ws7.cell(r, 11, f'=IF(COUNT(E{r}:I{r})=0,"",AVERAGE(E{r}:I{r}))'),
            bold=True,
            fill=FILL_INFO,
            align_h="center",
            num_format="0.00",
        )
        style_cell(
            ws7.cell(
                r,
                12,
                f'=IF(K{r}="","",IF(K{r}>=80,"เหรียญทอง",IF(K{r}>=70,"เหรียญเงิน",IF(K{r}>=60,"เหรียญทองแดง","เข้าร่วม"))))',
            ),
            bold=True,
            fill=FILL_WHITE,
            align_h="center",
        )
        ws7.row_dimensions[r].height = 22

    set_col_widths(ws7, [8, 12, 34, 30, 14, 14, 14, 14, 14, 18, 20, 18])
    configure_print(ws7, landscape=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate talent69 judge allocation & schedule Excel workbook.")
    parser.add_argument("--gas-url", default=DEFAULT_GAS_URL, help="Google Apps Script Web App GET URL")
    parser.add_argument("--input-json", default=None, help="Optional local JSON snapshot path instead of live fetch")
    parser.add_argument("--teachers", default=None, help="Optional .xlsx/.csv file with explicit teacher majors/extras")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_XLSX, help="Output .xlsx path")
    args = parser.parse_args()

    data = load_live_data(args.gas_url, args.input_json)
    schools = data.get("schools", [])
    comps = data.get("competitions", [])
    regs = data.get("registrations", [])

    explicit_majors, extra_teachers = load_explicit_majors(args.teachers)
    teachers = build_teachers(regs, explicit_majors, extra_teachers)

    comp_schools: dict[str, list[str]] = defaultdict(list)
    for r in regs:
        cid = norm_space(r.get("comp_id", ""))
        sch = norm_space(r.get("school_name", ""))
        if sch and sch not in comp_schools[cid]:
            comp_schools[cid].append(sch)

    all_plans: list[CompetitionPlan] = []
    for c in comps:
        cid = norm_space(c.get("comp_id", ""))
        area = norm_space(c.get("learning_area", ""))
        cname = norm_space(c.get("comp_name", ""))
        lv = norm_space(c.get("level", ""))
        schools_reg = sorted(comp_schools.get(cid, []))
        status = classify_bye_or_active(c, len(schools_reg))
        fmt = "แสดงสด" if is_live_competition(cname, area) else "ส่งชิ้นงาน"
        dur = estimate_duration_text(cname, fmt, len(schools_reg))
        all_plans.append(
            CompetitionPlan(
                comp_id=cid,
                learning_area=area,
                comp_name=cname,
                level=lv,
                team_type=norm_space(c.get("team_type", "")),
                schools_registered=schools_reg,
                status_type=status,
                format_type=fmt,
                duration_text=dur,
            )
        )

    active_plans = [p for p in all_plans if p.status_type == "ACTIVE"]
    bye_plans = [p for p in all_plans if p.status_type == "BYE"]
    empty_plans = [p for p in all_plans if p.status_type == "EMPTY"]

    assign_two_day_schedule(active_plans)
    assign_b, workload_b = allocate_judges_for_mode(active_plans, teachers, mode="B")
    assign_a, _ = allocate_judges_for_mode(active_plans, teachers, mode="A")
    bye_names = assign_bye_order_names(bye_plans, teachers)

    out_path = Path(args.output)
    write_workbook(
        out_path,
        schools,
        all_plans,
        active_plans,
        bye_plans,
        empty_plans,
        teachers,
        assign_b,
        workload_b,
        assign_a,
        bye_names,
    )

    # Print clean aggregate summary (no PII)
    a_ok = sum(1 for v in assign_a.values() if not v["warnings"])
    a_short = sum(1 for v in assign_a.values() if len(v["judges"]) < 3)
    b_ok = sum(1 for v in assign_b.values() if not v["warnings"])
    b_short = sum(1 for v in assign_b.values() if len(v["judges"]) < 3)
    b_gt3 = sum(1 for v in assign_b.values() if len(v["judges"]) > 3)
    b_warn_items = [(cid, v["status"]) for cid, v in assign_b.items() if v["warnings"]]
    clashes = sum(
        1
        for wlist in workload_b.values()
        if len([w["slot"] for w in wlist]) != len(set(w["slot"] for w in wlist))
    )
    print(f"Generated: {out_path.resolve()}")
    print(f"Teachers: {len(teachers)} | Active: {len(active_plans)} | Bye: {len(bye_plans)} | Empty: {len(empty_plans)}")
    print(f"Mode A -> ready: {a_ok}/{len(active_plans)}, <3 judges: {a_short}")
    print(f"Mode B -> ready: {b_ok}/{len(active_plans)}, <3 judges: {b_short}, >3 specialist judges: {b_gt3}, time clashes: {clashes}")
    if b_warn_items:
        print("Mode B warnings:")
        for cid, st in b_warn_items:
            print(f"  {cid}: {st}")


if __name__ == "__main__":
    main()
