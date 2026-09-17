from _gen import write

BODY = '''
<div style="width: 390px; min-height: 1160px; background: var(--paper); display: flex; flex-direction: column;">

  <header style="display: flex; align-items: center; padding: 14px 24px 0 24px;">
    <a href="#" style="display: inline-flex; width: 44px; height: 44px; margin-left: -12px; align-items: center; justify-content: center;" aria-label="뒤로">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5M11 18l-6-6 6-6"></path>
      </svg>
    </a>
  </header>

  <div style="padding: 4px 24px 0 24px;">
    <div style="display: flex; gap: 9px; background: var(--surface); border-left: 2px solid var(--accent); border-radius: 0 8px 8px 0; padding: 12px 14px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.65; color: var(--ink-2);">이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
    </div>
  </div>

  <section style="padding: 18px 24px 0 24px; display: flex; flex-direction: column; gap: 4px;">
    <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);">COMANDANTE</span>
    <h1 style="margin: 0; font-size: 27px; font-weight: 600; line-height: 1.1; letter-spacing: -0.03em;">C40 MK4</h1>
  </section>

  <section style="padding: 18px 24px 0 24px;">
    <div style="background: oklch(0.22 0.015 60); border-radius: 12px; padding: 22px 20px; display: flex; flex-direction: column; gap: 14px;">
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: oklch(0.72 0.05 55);">클릭당 입자 크기</span>
      <div style="display: flex; align-items: baseline; gap: 8px;">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 36px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: oklch(0.97 0.004 85);">30.0</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: oklch(0.65 0.015 70);">µm</span>
      </div>
      <div style="height: 1px; background: oklch(0.34 0.015 60);"></div>
      <p style="margin: 0; font-size: 13.5px; line-height: 1.65; color: oklch(0.82 0.01 78);">이 값이 있어야 다른 그라인더로 환산됩니다.</p>
    </div>
  </section>

  <section style="padding: 20px 24px 0 24px; display: flex; flex-direction: column;">
    <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em; padding-bottom: 6px;">사양</span>
    <sc-for list="{{ specs }}" as="row" hint-placeholder-count="4">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--divider);">
        <span style="font-size: 13px; color: var(--ink-3);">{{ row.label }}</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px;">{{ row.value }}</span>
      </div>
    </sc-for>
  </section>

  <section style="padding: 22px 24px 0 24px; display: flex; flex-direction: column; gap: 10px;">
    <a href="#" style="display: flex; min-height: 48px; align-items: center; justify-content: center; gap: 8px; border-radius: 7px; background: var(--accent); color: var(--on-ink); font-size: 15px; font-weight: 600;">
      쿠팡에서 보기
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"></path>
      </svg>
    </a>
    <p style="margin: 0; font-size: 12px; line-height: 1.6; color: var(--ink-3); text-align: center;">가격과 재고는 쿠팡에서 확인하세요</p>
  </section>

  <div style="height: 1px; background: var(--divider-strong); margin: 24px 24px 0 24px;"></div>

  <section style="padding: 20px 24px 28px 24px; display: flex; flex-direction: column; gap: 12px;">
    <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">이 그라인더로 환산해 보기</h2>
    <div style="border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);">K-PLUS</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 500;">30</span>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6"></path>
      </svg>
      <div style="display: flex; flex-direction: column; gap: 3px; align-items: flex-end;">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);">C40 MK4</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 500; color: var(--accent);">22클릭</span>
      </div>
    </div>
    <div style="display: flex; gap: 9px; background: var(--surface); border-left: 2px solid var(--accent); border-radius: 0 8px 8px 0; padding: 12px 14px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.65; color: var(--ink-2);">버 형상과 입도 분포가 달라 정확한 등가 변환은 불가능합니다. 이 값은 추정치입니다.</p>
    </div>
  </section>

  <nav style="margin-top: auto; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--divider-strong); background: var(--paper);">
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; color: var(--ink-3);">홈</a>
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; color: var(--ink-3);">레시피</a>
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; color: var(--ink-3);">기록</a>
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; font-weight: 600; color: var(--accent);">더보기</a>
  </nav>

</div>
'''

VALS = '''{
      specs: [
        { label: '버 형상', value: 'CONICAL' },
        { label: '조절 방식', value: 'CLICK' },
        { label: '설정 범위', value: '0 – 50' },
        { label: '영점 보정', value: '0클릭' },
      ],
    }'''

write("GearDetail.dc.html", BODY, vals=VALS)
