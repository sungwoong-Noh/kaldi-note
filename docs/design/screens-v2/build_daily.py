from _gen import write

BODY = '''
<div style="width: 390px; min-height: 1080px; background: var(--paper); display: flex; flex-direction: column;">

  <header style="display: flex; align-items: center; gap: 12px; padding: 20px 24px 12px 24px;">
    <a href="#" style="display: inline-flex; width: 44px; height: 44px; margin-left: -12px; align-items: center; justify-content: center;" aria-label="뒤로">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5M11 18l-6-6 6-6"></path>
      </svg>
    </a>
    <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);">2026-09-17</span>
  </header>

  <section style="padding: 0 24px; display: flex; flex-direction: column; gap: 6px;">
    <h1 style="margin: 0; font-size: 27px; font-weight: 600; line-height: 1.1; letter-spacing: -0.03em;">오늘의 레시피</h1>
    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: var(--ink-2);">하루에 하나씩, 모두에게 같은 레시피를 보여줍니다.</p>
  </section>

  <section style="padding: 20px 24px 0 24px;">
    <div style="background: oklch(0.22 0.015 60); border-radius: 12px; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: oklch(0.72 0.05 55);">CURATED</span>
          <span style="font-size: 20px; font-weight: 600; letter-spacing: -0.02em; color: oklch(0.96 0.005 85); line-height: 1.3;">Tetsu Kasuya 4:6 Method</span>
        </div>
      </div>

      <div style="display: flex; align-items: baseline; gap: 10px;">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 36px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: oklch(0.97 0.004 85);">1:15.0</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: oklch(0.65 0.015 70);">비율</span>
      </div>

      <div style="height: 1px; background: oklch(0.34 0.015 60);"></div>

      <p style="margin: 0; font-size: 14px; line-height: 1.65; font-style: italic; color: oklch(0.82 0.01 78);">앞 40%가 단맛과 산미를, 뒤 60%가 농도를 정합니다.</p>
    </div>
  </section>

  <section style="padding: 18px 24px 0 24px; display: flex; flex-direction: column; gap: 10px;">
    <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">이 레시피에 맞는 원두</span>
    <div style="display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px;">
      <span style="width: 11px; height: 11px; border-radius: 999px; background: oklch(0.72 0.05 60); flex-shrink: 0;"></span>
      <div style="display: flex; flex-direction: column; gap: 2px; flex: 1;">
        <span style="font-size: 15px; font-weight: 600;">라이트 로스트</span>
        <span style="font-size: 13px; line-height: 1.6; color: var(--ink-3);">내 원두와 맞는지는 직접 확인하세요 — 시스템이 고르지 않습니다.</span>
      </div>
    </div>
  </section>

  <section style="padding: 20px 24px 0 24px; display: flex; flex-direction: column; gap: 0;">
    <div style="display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 8px;">
      <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">푸어 스텝</span>
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-3);">합계 300g</span>
    </div>
    <sc-for list="{{ steps }}" as="step" hint-placeholder-count="5">
      <div style="display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--divider);">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-3); width: 38px; flex-shrink: 0;">{{ step.at }}</span>
        <div style="display: flex; flex-direction: column; gap: 3px; flex: 1;">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="font-size: 13px; font-weight: 600;">{{ step.kind }}</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13.5px;">{{ step.water }}</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-3);">{{ step.dur }}</span>
          </div>
          <span style="font-size: 12px; line-height: 1.5; color: var(--ink-3);">{{ step.note }}</span>
        </div>
      </div>
    </sc-for>
  </section>

  <section style="padding: 22px 24px 28px 24px; display: flex; flex-direction: column; gap: 10px;">
    <a href="#" style="display: flex; min-height: 48px; align-items: center; justify-content: center; border-radius: 7px; background: var(--accent); color: var(--on-ink); font-size: 15px; font-weight: 600;">이 레시피로 내리기</a>
    <a href="#" style="display: flex; min-height: 44px; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 7px; font-size: 15px; color: var(--ink);">내 레시피로 가져오기</a>
  </section>

  <nav style="margin-top: auto; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--divider-strong); background: var(--paper);">
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; color: var(--ink-3);">홈</a>
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; color: var(--ink-3);">레시피</a>
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; color: var(--ink-3);">기록</a>
    <a href="#" style="padding: 14px 0; text-align: center; font-size: 13px; color: var(--ink-3);">더보기</a>
  </nav>

</div>
'''

VALS = '''{
      steps: [
        { at: '0:00', kind: '푸어', water: '50g', dur: '10초', note: '블룸. 가루를 다 적신다' },
        { at: '0:45', kind: '푸어', water: '70g', dur: '10초', note: '여기까지 앞 40% — 단맛과 산미' },
        { at: '1:30', kind: '푸어', water: '60g', dur: '10초', note: '뒤 60% 시작 — 농도' },
        { at: '2:10', kind: '푸어', water: '60g', dur: '10초', note: '' },
        { at: '2:50', kind: '푸어', water: '60g', dur: '10초', note: '3:30에 배출이 끝난다' },
      ],
    }'''

write("DailyRecipe.dc.html", BODY, vals=VALS)
