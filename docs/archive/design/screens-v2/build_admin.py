from _gen import write

BODY = '''
<div style="width: 390px; min-height: 1320px; background: var(--paper); display: flex; flex-direction: column;">

  <header style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 24px 0 24px;">
    <a href="#" style="font-size: 15px; color: var(--ink-3);">취소</a>
    <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);">RECIPE IMPORT</span>
    <a href="#" style="font-size: 15px; font-weight: 600; color: var(--accent);">등록</a>
  </header>

  <section style="padding: 20px 24px 0 24px; display: flex; flex-direction: column; gap: 8px;">
    <label style="display: flex; flex-direction: column; gap: 6px;">
      <span style="font-size: 13px; color: var(--ink-3);">원문 URL</span>
      <input type="text" value="https://youtu.be/AI4ynXzkSQo" style="width: 100%; min-height: 44px; border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; font-size: 14.5px; font-family: inherit; color: var(--ink); background: var(--paper);" />
    </label>
    <button type="button" style="display: flex; min-height: 44px; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 7px; background: var(--paper); font-size: 15px; font-family: inherit; color: var(--ink);">본문 불러와 파싱</button>
  </section>

  <div style="padding: 16px 24px 0 24px;">
    <div style="display: flex; gap: 9px; background: var(--surface); border-left: 2px solid var(--accent); border-radius: 0 8px 8px 0; padding: 12px 14px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.65; color: var(--ink-2);">파싱 결과는 <strong style="font-weight: 600;">수치만</strong> 가져옵니다. 설명 문장은 저작권이 있어 직접 써야 합니다.</p>
    </div>
  </div>

  <section style="padding: 20px 24px 0 24px; display: flex; flex-direction: column; gap: 4px;">
    <div style="display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 6px;">
      <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">검수</span>
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: var(--ink-3);">파싱 7 · 확인 필요 2</span>
    </div>

    <sc-for list="{{ fields }}" as="f" hint-placeholder-count="5">
      <div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-top: 1px solid var(--divider);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <span style="font-size: 13px; color: var(--ink-3);">{{ f.label }}</span>
          <span style="flex-shrink: 0; border-radius: 3px; padding: 4px 8px; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.06em; background: {{ f.tagBg }}; color: {{ f.tagFg }};">{{ f.tag }}</span>
        </div>
        <input type="text" value="{{ f.value }}" style="width: 100%; min-height: 44px; border: 1px solid {{ f.border }}; border-radius: 7px; padding: 8px 12px; font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: var(--ink); background: var(--paper);" />
        <span style="font-size: 12px; line-height: 1.55; color: var(--ink-3);">원문: {{ f.source }}</span>
      </div>
    </sc-for>
  </section>

  <section style="padding: 18px 24px 0 24px; display: flex; flex-direction: column; gap: 6px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 2px;">
      <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">푸어 스텝</span>
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-3);">합계 500 / 500 g</span>
    </div>
    <sc-for list="{{ steps }}" as="s" hint-placeholder-count="3">
      <div style="display: flex; align-items: center; gap: 8px; padding: 9px 0; border-top: 1px solid var(--divider);">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-3); width: 16px; flex-shrink: 0;">{{ s.n }}</span>
        <span style="flex-shrink: 0; border-radius: 3px; padding: 5px 9px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; background: var(--sunken); color: oklch(0.35 0.015 60);">{{ s.kind }}</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 14px; flex: 1;">{{ s.water }}</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-3);">{{ s.dur }}</span>
      </div>
    </sc-for>
  </section>

  <section style="padding: 20px 24px 0 24px; display: flex; flex-direction: column; gap: 6px;">
    <label style="display: flex; flex-direction: column; gap: 6px;">
      <span style="font-size: 13px; color: var(--ink-3);">설명 — 직접 씁니다</span>
      <textarea rows="3" placeholder="파싱하지 않습니다. 원문을 복사하지 마세요." style="width: 100%; min-height: 76px; border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; font-size: 14.5px; font-family: inherit; line-height: 1.6; color: var(--ink); background: var(--paper); resize: vertical;"></textarea>
    </label>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-top: 4px;">
      <label style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 13px; color: var(--ink-3);">출처 이름</span>
        <input type="text" value="James Hoffmann" style="width: 100%; min-height: 44px; border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; font-size: 14.5px; font-family: inherit; color: var(--ink); background: var(--paper);" />
      </label>
      <label style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 13px; color: var(--ink-3);">적합 배전도</span>
        <select style="width: 100%; min-height: 44px; border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; font-size: 14.5px; font-family: inherit; color: var(--ink); background: var(--paper); appearance: none;">
          <option>라이트</option>
        </select>
      </label>
    </div>
  </section>

  <section style="padding: 22px 24px 28px 24px;">
    <button type="button" style="display: flex; width: 100%; min-height: 48px; align-items: center; justify-content: center; border: none; border-radius: 7px; background: var(--accent); color: var(--on-ink); font-size: 15px; font-weight: 600; font-family: inherit;">CURATED로 등록</button>
  </section>

</div>
'''

VALS = '''{
      fields: [
        { label: '제목', value: 'James Hoffmann Ultimate V60', tag: 'PARSED', tagBg: 'var(--sunken)', tagFg: 'oklch(0.35 0.015 60)', border: 'var(--border)', source: '"The Ultimate V60 Technique"' },
        { label: '원두량', value: '30.0', tag: 'PARSED', tagBg: 'var(--sunken)', tagFg: 'oklch(0.35 0.015 60)', border: 'var(--border)', source: '"30 grams of coffee"' },
        { label: '물량', value: '500.0', tag: 'PARSED', tagBg: 'var(--sunken)', tagFg: 'oklch(0.35 0.015 60)', border: 'var(--border)', source: '"500 grams of water"' },
        { label: '물 온도', value: '100', tag: '확인 필요', tagBg: 'oklch(0.95 0.05 28)', tagFg: 'var(--danger)', border: 'var(--danger)', source: '"boiling" — 섭씨로 옮긴 값입니다' },
        { label: '총 시간', value: '210', tag: '확인 필요', tagBg: 'oklch(0.95 0.05 28)', tagFg: 'var(--danger)', border: 'var(--danger)', source: '"three and a half minutes"' },
      ],
      steps: [
        { n: '1', kind: '블룸', water: '60g', dur: '15초' },
        { n: '2', kind: '푸어', water: '240g', dur: '30초' },
        { n: '3', kind: '푸어', water: '200g', dur: '30초' },
      ],
    }'''

write("AdminImport.dc.html", BODY, vals=VALS)
