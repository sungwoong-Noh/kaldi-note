from _gen import write

BODY = '''
<div style="width: 1440px; min-height: 900px; background: var(--paper); display: flex; flex-direction: column;">

  <header style="display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 0 48px; height: 68px; border-bottom: 1px solid var(--divider-strong);">
    <div style="display: flex; align-items: center; gap: 32px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-flex; width: 22px; height: 22px; border: 2px solid var(--ink); border-radius: 999px; align-items: center; justify-content: center;">
          <span style="width: 7px; height: 7px; background: var(--accent-soft); border-radius: 999px;"></span>
        </span>
        <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.03em;">kaldi<span style="color: var(--accent-soft);">·</span>note</span>
      </div>
      <nav style="display: flex; align-items: center; gap: 24px;">
        <a href="#" style="font-size: 15px; color: var(--ink-3);">홈</a>
        <a href="#" style="font-size: 15px; color: var(--ink); font-weight: 600;">레시피</a>
        <a href="#" style="font-size: 15px; color: var(--ink-3);">기록</a>
      </nav>
    </div>
    <a href="#" style="display: inline-flex; min-height: 40px; align-items: center; padding: 0 18px; border-radius: 7px; background: var(--accent); color: var(--on-ink); font-size: 15px; font-weight: 600;">로그인</a>
  </header>

  <div style="display: flex; flex: 1; align-items: stretch;">

    <main style="flex: 1; padding: 44px 48px; border-right: 1px solid var(--divider); display: flex; flex-direction: column; gap: 32px;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="border-radius: 3px; padding: 5px 9px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; background: var(--accent-wash); color: oklch(0.4 0.06 45);">CURATED</span>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="width: 10px; height: 10px; border-radius: 999px; background: oklch(0.72 0.05 60);"></span>
            <span style="font-size: 13px; color: var(--ink-3);">라이트 로스트</span>
          </span>
        </div>
        <h1 style="margin: 0; font-size: 36px; font-weight: 600; line-height: 1.15; letter-spacing: -0.025em; max-width: 640px; text-wrap: pretty;">James Hoffmann Ultimate V60</h1>
        <p style="margin: 0; font-size: 15px; line-height: 1.7; color: var(--ink-2);">James Hoffmann · Hario V60 02 · V60 표백 필터 02</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0; max-width: 720px;">
        <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em; padding-bottom: 8px;">푸어 스텝</span>
        <sc-for list="{{ steps }}" as="s" hint-placeholder-count="6">
          <div style="display: flex; gap: 20px; padding: 14px 0; border-top: 1px solid var(--divider);">
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-3); width: 44px; flex-shrink: 0;">{{ s.at }}</span>
            <span style="font-size: 14px; font-weight: 600; width: 48px; flex-shrink: 0;">{{ s.kind }}</span>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
              <div style="display: flex; align-items: baseline; gap: 14px;">
                <span style="font-family: 'IBM Plex Mono', monospace; font-size: 15px;">{{ s.water }}</span>
                <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-3);">누적 {{ s.total }}</span>
              </div>
              <span style="font-size: 13.5px; line-height: 1.6; color: var(--ink-3);">{{ s.note }}</span>
            </div>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-3); flex-shrink: 0;">{{ s.dur }}</span>
          </div>
        </sc-for>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; max-width: 720px;">
        <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">분쇄도</span>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px;">
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);">COMANDANTE C40 MK4</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 500;">22클릭</span>
          </div>
          <a href="#" style="display: inline-flex; min-height: 40px; align-items: center; padding: 0 16px; border: 1px solid var(--border); border-radius: 7px; font-size: 14px; color: var(--ink);">내 그라인더로 환산</a>
        </div>
      </div>
    </main>

    <aside style="width: 420px; flex-shrink: 0; background: var(--surface); padding: 44px 36px; display: flex; flex-direction: column; gap: 24px;">
      <div style="background: oklch(0.22 0.015 60); border-radius: 14px; padding: 26px 24px; display: flex; flex-direction: column; gap: 16px;">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: oklch(0.72 0.05 55);">RATIO</span>
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 44px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: oklch(0.97 0.004 85);">1:16.7</span>
        <div style="height: 1px; background: oklch(0.34 0.015 60);"></div>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: oklch(0.65 0.015 70);">원두</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: oklch(0.96 0.005 85);">30.0 g</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: oklch(0.65 0.015 70);">물</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: oklch(0.96 0.005 85);">500.0 g</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: oklch(0.65 0.015 70);">온도</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: oklch(0.96 0.005 85);">100 °C</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: oklch(0.65 0.015 70);">총 시간</span>
            <span style="font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: oklch(0.96 0.005 85);">3:30</span>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <a href="#" style="display: flex; min-height: 48px; align-items: center; justify-content: center; border-radius: 7px; background: var(--accent); color: var(--on-ink); font-size: 15px; font-weight: 600;">이 레시피로 내리기</a>
        <a href="#" style="display: flex; min-height: 44px; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 7px; background: var(--paper); font-size: 15px; color: var(--ink);">내 레시피로 가져오기</a>
      </div>

      <div style="height: 1px; background: var(--border);"></div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3);">출처</span>
        <a href="#" style="font-size: 14px; line-height: 1.6;">youtube.com — The Ultimate V60 Technique</a>
      </div>
    </aside>

  </div>

</div>
'''

VALS = '''{
      steps: [
        { at: '0:00', kind: '블룸', water: '60g', total: '60g', dur: '15초', note: '중심에서 바깥으로 나선을 그려 가루를 다 적신 뒤, 스월로 덩어리를 푼다' },
        { at: '0:15', kind: '대기', water: '—', total: '60g', dur: '30초', note: '45초까지 뜸을 들인다' },
        { at: '0:45', kind: '푸어', water: '240g', total: '300g', dur: '30초', note: '1분 15초에 누적 300g. 전체 물의 60%를 여기서 넣는다' },
        { at: '1:15', kind: '푸어', water: '200g', total: '500g', dur: '30초', note: '1분 45초에 누적 500g. 천천히 이어 붓는다' },
        { at: '1:50', kind: '스월', water: '—', total: '500g', dur: '5초', note: '가볍게 돌려 커피 베드를 평탄하게 만든다' },
        { at: '1:55', kind: '배출', water: '—', total: '500g', dur: '95초', note: '3분 30초에 배출이 끝난다' },
      ],
    }'''

write("RecipeWeb.dc.html", BODY, vals=VALS)
