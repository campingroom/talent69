"""Generate crisp Thai-shaped Open Graph preview card (1200x630) via Chromium."""

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT_PNG = ROOT / "og-image.png"

OG_HTML = """<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    font-family: 'Kanit', 'Sukhumvit Set', 'Thonburi', sans-serif;
    background: #0F172A;
    color: #FFFFFF;
  }
  .canvas {
    position: relative;
    width: 1200px;
    height: 630px;
    padding: 46px 54px;
    background:
      radial-gradient(circle at 88% 22%, rgba(245, 158, 11, 0.16), transparent 46%),
      radial-gradient(circle at 12% 88%, rgba(56, 189, 248, 0.12), transparent 42%),
      linear-gradient(135deg, #0B1324 0%, #111C34 55%, #0F172A 100%);
    display: grid;
    grid-template-columns: 1fr 310px;
    gap: 36px;
    align-items: center;
  }
  .frame-border {
    position: absolute;
    inset: 16px;
    border-radius: 26px;
    border: 1.5px solid rgba(148, 163, 184, 0.24);
    pointer-events: none;
  }
  .left-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    padding: 6px 0;
    z-index: 2;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 400;
    color: #CBD5E1;
    letter-spacing: 0.2px;
  }
  .eyebrow-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #F59E0B;
    display: inline-block;
  }
  .title-wrap {
    margin-top: 8px;
  }
  h1 {
    font-size: 56px;
    font-weight: 700;
    line-height: 1.16;
    color: #F8FAFC;
    letter-spacing: -0.3px;
  }
  .subtitle-year {
    margin-top: 6px;
    font-size: 42px;
    font-weight: 700;
    line-height: 1.15;
    color: #FBBF24;
  }
  .pills-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 13px;
    margin-top: 12px;
  }
  .group-pill {
    display: inline-flex;
    align-items: center;
    padding: 10px 24px;
    border-radius: 14px;
    background: #FEF3C7;
    color: #78350F;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.25;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  }
  .schedule-pill {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 11px 24px;
    border-radius: 14px;
    background: linear-gradient(90deg, #BE123C 0%, #E11D48 100%);
    color: #FFFFFF;
    font-size: 25px;
    font-weight: 600;
    line-height: 1.25;
    box-shadow: 0 8px 20px rgba(190, 18, 60, 0.35);
  }
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 8px;
  }
  .meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 10px;
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.25);
    color: #E2E8F0;
    font-size: 19px;
    font-weight: 500;
  }
  .footer-url {
    font-size: 19px;
    font-weight: 500;
    color: #38BDF8;
    margin-top: 6px;
  }
  .right-col {
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .emblem-card {
    width: 296px;
    height: 360px;
    border-radius: 32px;
    background: linear-gradient(180deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.96) 100%);
    border: 1.5px solid rgba(251, 191, 36, 0.32);
    box-shadow: 0 22px 44px rgba(0, 0, 0, 0.42);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 24px;
    text-align: center;
  }
  .trophy-circle {
    width: 172px;
    height: 172px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0.06) 70%);
    border: 1.5px solid rgba(251, 191, 36, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .emblem-edition {
    font-size: 28px;
    font-weight: 700;
    color: #FBBF24;
    line-height: 1.2;
  }
  .emblem-sub {
    font-size: 18px;
    font-weight: 400;
    color: #CBD5E1;
    line-height: 1.3;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="frame-border"></div>
    <div class="left-col">
      <div class="eyebrow">
        <span class="eyebrow-dot"></span>
        <span>สพป.มหาสารคาม เขต 3 • สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน</span>
      </div>

      <div class="title-wrap">
        <h1>งานศิลปหัตถกรรมนักเรียน</h1>
        <div class="subtitle-year">ครั้งที่ 74 • ปีการศึกษา 2569</div>
      </div>

      <div class="pills-stack">
        <div class="group-pill">กลุ่มโรงเรียนวังยาวเขวาไร่ดอนกลาง</div>
        <div class="schedule-pill">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>กำหนดการแข่งขัน 24–25 พฤศจิกายน 2569</span>
        </div>
      </div>

      <div class="meta-row">
        <div class="meta-chip">13 โรงเรียนในกลุ่ม</div>
        <div class="meta-chip">13 หมวดกิจกรรม • 149 รายการ</div>
        <div class="meta-chip">ณ โรงเรียนบ้านวังยาววิทยายน</div>
      </div>

      <div class="footer-url">https://talents69.vercel.app/</div>
    </div>

    <div class="right-col">
      <div class="emblem-card">
        <div class="trophy-circle">
          <svg width="102" height="102" viewBox="0 0 24 24" fill="none">
            <path d="M6 4H18V10C18 13.3137 15.3137 16 12 16C8.68629 16 6 13.3137 6 10V4Z" fill="#F59E0B" stroke="#FCD34D" stroke-width="1.4"/>
            <path d="M6 6H3.5C2.94772 6 2.5 6.44772 2.5 7V8.5C2.5 10.433 4.067 12 6 12" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M18 6H20.5C21.0523 6 21.5 6.44772 21.5 7V8.5C21.5 10.433 19.933 12 18 12" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M12 16V19.5" stroke="#FBBF24" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M8 20.5H16" stroke="#FCD34D" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M12 7.2L12.95 9.15L15.1 9.46L13.55 10.97L13.92 13.11L12 12.1L10.08 13.11L10.45 10.97L8.9 9.46L11.05 9.15L12 7.2Z" fill="#FFFFFF"/>
          </svg>
        </div>
        <div>
          <div class="emblem-edition">ครั้งที่ 74</div>
          <div class="emblem-sub">ปีการศึกษา 2569<br/>อ.โกสุมพิสัย จ.มหาสารคาม</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        page.set_content(OG_HTML, wait_until="load")
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUT_PNG), type="png")
        browser.close()
    print(f"Generated {OUT_PNG} ({OUT_PNG.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
