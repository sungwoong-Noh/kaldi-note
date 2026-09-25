from _gen import write

CATALOG_BODY = '''
<div style="width: 390px; min-height: 1240px; background: var(--paper); display: flex; flex-direction: column;">

  <header style="padding: 20px 24px 0 24px; display: flex; flex-direction: column; gap: 6px;">
    <h1 style="margin: 0; font-size: 27px; font-weight: 600; line-height: 1.1; letter-spacing: -0.03em;">장비</h1>
    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: var(--ink-2);">이 앱이 분쇄도 환산에 쓰는 그라인더와, 레시피에 붙는 드리퍼·필터입니다.</p>
  </header>

  <div style="padding: 18px 24px 0 24px;">
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; background: var(--sunken); border-radius: 8px; padding: 3px;">
      <button type="button" style="min-height: 38px; border: 1px solid oklch(0.87 0.008 75); border-radius: 6px; background: var(--paper); font-size: 13px; font-weight: 500; color: var(--ink); font-family: inherit;">그라인더 12</button>
      <button type="button" style="min-height: 38px; border: none; border-radius: 6px; background: transparent; font-size: 13px; color: var(--ink-3); font-family: inherit;">드리퍼 10</button>
      <button type="button" style="min-height: 38px; border: none; border-radius: 6px; background: transparent; font-size: 13px; color: var(--ink-3); font-family: inherit;">필터 8</button>
    </div>
  </div>

  <section style="padding: 16px 24px 0 24px; display: flex; flex-direction: column; gap: 10px;">
    <sc-for list="{{ grinders }}" as="g" hint-placeholder-count="6">
      <a href="#" style="display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border); border-radius: 12px; padding: 16px 17px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
          <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);">{{ g.brand }}</span>
            <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em; color: var(--ink);">{{ g.name }}</span>
          </div>
          <span style="flex-shrink: 0; border-radius: 3px; padding: 5px 9px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; background: var(--sunken); color: oklch(0.35 0.015 60);">{{ g.burr }}</span>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 4px 14px;">
          <span style="display: flex; align-items: baseline; gap: 5px;">
            <span style="font-size: 13px; color: var(--ink-3);">조절</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px;">{{ g.adj }}</span>
          </span>
          <span style="display: flex; align-items: baseline; gap: 5px;">
            <span style="font-size: 13px; color: var(--ink-3);">범위</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px;">{{ g.range }}</span>
          </span>
          <span style="display: flex; align-items: baseline; gap: 5px;">
            <span style="font-size: 13px; color: var(--ink-3);">클릭당</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: {{ g.micronColor }};">{{ g.micron }}</span>
          </span>
        </div>
      </a>
    </sc-for>

    <div style="display: flex; gap: 9px; border: 1px dashed var(--border); border-radius: 12px; padding: 14px 16px; margin-top: 2px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 1px;" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path>
      </svg>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: var(--ink-3);">「클릭당 —」은 환산에 쓸 마이크론 값이 아직 없다는 뜻입니다. 추측값을 넣지 않습니다.</p>
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
      grinders: [
        { brand: 'Comandante', name: 'C40 MK4', burr: 'CONICAL', adj: 'CLICK', range: '0–50', micron: '30.0µm', micronColor: 'var(--ink)' },
        { brand: '1Zpresso', name: 'K-Plus', burr: 'CONICAL', adj: 'NUMBERED', range: '0–90', micron: '22.0µm', micronColor: 'var(--ink)' },
        { brand: '1Zpresso', name: 'JX-Pro', burr: 'CONICAL', adj: 'NUMBERED', range: '0–100', micron: '—', micronColor: 'var(--ink-3)' },
        { brand: 'Fellow', name: 'Ode Gen 2', burr: 'FLAT', adj: 'NUMBERED', range: '1–11', micron: '—', micronColor: 'var(--ink-3)' },
        { brand: 'Timemore', name: 'Chestnut C3', burr: 'CONICAL', adj: 'CLICK', range: '0–36', micron: '—', micronColor: 'var(--ink-3)' },
        { brand: 'Wilfa', name: 'Uniform', burr: 'FLAT', adj: 'STEPLESS', range: '무단', micron: '—', micronColor: 'var(--ink-3)' },
      ],
    }'''

write("GearCatalog.dc.html", CATALOG_BODY, vals=VALS)
