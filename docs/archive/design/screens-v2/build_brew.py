from _gen import write

BODY = '''
<div style="width: 390px; min-height: 1400px; background: var(--paper); display: flex; flex-direction: column;">

  <header style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 24px 0 24px;">
    <a href="#" style="font-size: 15px; color: var(--ink-3);">취소</a>
    <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);">NEW BREW</span>
    <a href="#" style="font-size: 15px; font-weight: 600; color: var(--accent);">저장</a>
  </header>

  <section style="padding: 18px 24px 0 24px;">
    <div style="background: oklch(0.22 0.015 60); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: oklch(0.72 0.05 55);">이 레시피로 내렸다</span>
      <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em; color: oklch(0.96 0.005 85); line-height: 1.3;">James Hoffmann Ultimate V60</span>
      <div style="height: 1px; background: oklch(0.34 0.015 60);"></div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px 18px;">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: oklch(0.82 0.01 78);">30.0g → 500.0g</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: oklch(0.82 0.01 78);">1:16.7</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: oklch(0.82 0.01 78);">100°C</span>
      </div>
    </div>
  </section>

  <section style="padding: 22px 24px 0 24px; display: flex; flex-direction: column; gap: 12px;">
    <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">원두</span>
    <label style="display: flex; flex-direction: column; gap: 6px;">
      <span style="font-size: 13px; color: var(--ink-3);">재고에서 고르기</span>
      <select style="width: 100%; min-height: 44px; border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; font-size: 14.5px; font-family: inherit; color: var(--ink); background: var(--paper); appearance: none;">
        <option>프릳츠 · 올드독 · 2026-09-10 로스팅</option>
      </select>
    </label>
    <div style="display: flex; align-items: center; gap: 10px; background: var(--surface); border-radius: 8px; padding: 12px 14px;">
      <span style="width: 11px; height: 11px; border-radius: 999px; background: oklch(0.62 0.06 55); flex-shrink: 0;"></span>
      <span style="font-size: 13px; color: var(--ink-2);">미디엄 · 볶은 지 <strong style="font-family: 'IBM Plex Mono', monospace; font-weight: 500;">7일</strong></span>
    </div>
  </section>

  <section style="padding: 22px 24px 0 24px; display: flex; flex-direction: column; gap: 12px;">
    <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">실측값</span>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
      <sc-for list="{{ measures }}" as="m" hint-placeholder-count="6">
        <label style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 13px; color: var(--ink-3);">{{ m.label }}</span>
          <span style="position: relative; display: flex; align-items: center;">
            <input type="text" value="{{ m.value }}" style="width: 100%; min-height: 44px; border: 1px solid var(--border); border-radius: 7px; padding: 8px 40px 8px 12px; font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: var(--ink); background: var(--paper);" />
            <span style="position: absolute; right: 12px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-3); pointer-events: none;">{{ m.unit }}</span>
          </span>
        </label>
      </sc-for>
    </div>
  </section>

  <section style="padding: 22px 24px 0 24px; display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: baseline; justify-content: space-between;">
      <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">평가</span>
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-3);">선택 사항</span>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <span style="font-size: 13px; color: var(--ink-3);">별점</span>
      <div style="display: flex; gap: 4px;">
        <sc-for list="{{ stars }}" as="s" hint-placeholder-count="5">
          <span style="display: inline-flex; width: 44px; height: 44px; align-items: center; justify-content: center;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="{{ s.fill }}" stroke="{{ s.stroke }}" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9z"></path>
            </svg>
          </span>
        </sc-for>
      </div>
    </div>

    <sc-for list="{{ tastes }}" as="t" hint-placeholder-count="5">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 13px; color: var(--ink-3); width: 40px; flex-shrink: 0;">{{ t.label }}</span>
        <span style="flex: 1; height: 6px; border-radius: 3px; background: var(--sunken); display: flex; align-items: stretch;">
          <span style="width: {{ t.pct }}; border-radius: 3px; background: var(--accent);"></span>
        </span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; width: 16px; text-align: right; flex-shrink: 0;">{{ t.score }}</span>
      </div>
    </sc-for>
  </section>

  <section style="padding: 22px 24px 0 24px; display: flex; flex-direction: column; gap: 6px;">
    <label style="display: flex; flex-direction: column; gap: 6px;">
      <span style="font-size: 13px; color: var(--ink-3);">메모</span>
      <textarea rows="3" placeholder="다음에 바꿀 것을 적어둡니다" style="width: 100%; min-height: 76px; border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; font-size: 14.5px; font-family: inherit; line-height: 1.6; color: var(--ink); background: var(--paper); resize: vertical;"></textarea>
    </label>
  </section>

  <section style="padding: 22px 24px 28px 24px;">
    <button type="button" style="display: flex; width: 100%; min-height: 48px; align-items: center; justify-content: center; border: none; border-radius: 7px; background: var(--accent); color: var(--on-ink); font-size: 15px; font-weight: 600; font-family: inherit;">기록하기</button>
  </section>

</div>
'''

VALS = '''{
      measures: [
        { label: '원두량', value: '30.0', unit: 'g' },
        { label: '물량', value: '498', unit: 'g' },
        { label: '물 온도', value: '96', unit: '°C' },
        { label: '추출 시간', value: '3:42', unit: '' },
        { label: '음료 중량', value: '445', unit: 'g' },
        { label: 'TDS', value: '', unit: '%' },
      ],
      stars: [
        { fill: 'var(--accent)', stroke: 'var(--accent)' },
        { fill: 'var(--accent)', stroke: 'var(--accent)' },
        { fill: 'var(--accent)', stroke: 'var(--accent)' },
        { fill: 'var(--accent)', stroke: 'var(--accent)' },
        { fill: 'none', stroke: 'oklch(0.80 0.01 75)' },
      ],
      tastes: [
        { label: '산미', pct: '80%', score: '4' },
        { label: '단맛', pct: '60%', score: '3' },
        { label: '바디', pct: '60%', score: '3' },
        { label: '쓴맛', pct: '40%', score: '2' },
        { label: '여운', pct: '80%', score: '4' },
      ],
    }'''

write("BrewNew.dc.html", BODY, vals=VALS)
