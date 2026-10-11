import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BottomCta,
  BottomSheet,
  LedgerField,
  LedgerRow,
  NumberCell,
  PageHeader,
  PillFilter,
  RecipeCardKit,
  RoastLabel,
  Segmented,
  SectionLabel,
  SheetLabel,
  StatTile,
  Tag,
  TasteDots,
  TempChip,
} from "@/components/kit";
import { Avatar } from "@/components/ui";

/**
 * 부품 키트 — 목업과 나란히 놓고 보려는 페이지(docs/decisions/0010).
 *
 * <p>데이터를 부르지 않는 정적 페이지라 프로덕션에도 둔다 — `pnpm compare`가 프로덕션 빌드에 붙는다.
 * 어디서도 링크하지 않고 검색엔진에는 숨긴다.
 */
export const metadata: Metadata = {
  title: "부품 키트 · kaldi note",
  robots: { index: false, follow: false },
};

function Part({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[16px] rounded-[4px] border border-border bg-paper px-[24px] py-[22px]">
      <h2 className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">
        {name}
      </h2>
      {children}
    </section>
  );
}

const SCOPES = [
  { value: "drawer", label: "내 서랍" },
  { value: "public", label: "둘러보기" },
] as const;

const ORIGINS = [
  { value: "all", label: "전체", count: 7 },
  { value: "mine", label: "내가 만든", count: 4 },
  { value: "forked", label: "담아온", count: 3 },
] as const;

export default function KitPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-[32px] px-[16px] pt-[56px] pb-[120px] min-[1100px]:px-[32px]">
      <header className="flex flex-col gap-[12px] border-b border-border pb-[36px]">
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3 uppercase">
          dev · kit
        </span>
        <h1 className="text-[40px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">
          부품 키트
        </h1>
        <p className="max-w-[64ch] text-[16.5px] leading-[1.7] text-ink-2">
          목업 CSS 값 그대로 옮긴 공용 부품입니다. 색만 가장 가까운 토큰을
          씁니다.
        </p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[16px]">
        <Part name="Page header">
          <PageHeader
            eyebrow="My drawer · 7"
            title="내 서랍"
            aside={
              <span className="text-[13.5px] font-semibold text-ink-2">
                <Avatar nickname="현" size={36} userId={0} />
              </span>
            }
          />
        </Part>

        <Part name="Segmented · track">
          <Segmented label="범위" options={SCOPES} value="drawer" />
        </Part>

        <Part name="Pill filter · count">
          <PillFilter label="출처" options={ORIGINS} value="all" />
        </Part>

        <Part name="Ledger row">
          <div>
            <LedgerRow
              roastLevel="MEDIUM"
              title="내 아침 워시드"
              value="16 g"
              meta="09.19 토 · 92°C · 2:45"
              accent="20.4 % · ★ 4"
            />
            <LedgerRow
              roastLevel="LIGHT"
              title="케냐 94도 3푸어"
              value="16 g"
              meta="09.18 금 · 94°C · 2:30"
              accent="— · ★ 3"
            />
          </div>
        </Part>

        <Part name="Stat tile">
          <div className="flex gap-[10px]">
            <StatTile label="이번 달" value="9잔" />
            <StatTile label="평균 별점" value="★ 3.7" />
          </div>
        </Part>

        <Part name="HOT chip · roast dot · tag">
          <div className="flex flex-wrap items-center gap-[9px]">
            <TempChip>HOT</TempChip>
            <TempChip>ICE</TempChip>
            <RoastLabel roastLevel="LIGHT" label="약배전" />
            <RoastLabel roastLevel="MEDIUM_LIGHT" label="중배전" />
            <RoastLabel roastLevel="DARK" label="강배전" />
            <Tag>지연 님 레시피에서</Tag>
            <Tag accent>내가 만든</Tag>
          </div>
        </Part>

        <Part name="Recipe card">
          <RecipeCardKit
            title="내 아침 워시드"
            dose="16 g"
            temp="HOT"
            roast={{ level: "LIGHT", label: "약배전" }}
            footer={
              <>
                <Tag accent>내가 만든</Tag>
                <span className="text-[12px] text-ink-3">21잔 기록</span>
              </>
            }
          />
        </Part>

        <Part name="Bottom CTA · full width">
          <BottomCta>새 레시피</BottomCta>
        </Part>

        <Part name="Section label · number cell">
          <div className="flex flex-col gap-[10px]">
            <SectionLabel>수치</SectionLabel>
            <div className="grid grid-cols-2 gap-[10px]">
              <NumberCell
                label="원두"
                accessibleName="원두량"
                unit="g"
                defaultValue="30.5"
              />
              <NumberCell
                label="물"
                accessibleName="물량"
                unit="g"
                defaultValue="500.0"
              />
              <NumberCell
                label="추출 시간"
                accessibleName="추출 시간"
                inputMode="text"
                defaultValue="3:45"
              />
            </div>
          </div>
        </Part>

        <Part name="Ledger field">
          <div>
            <LedgerField
              label="원두"
              value="프릿츠 · 예가체프"
              sub="로스팅 09.21 · 7일차"
              action="변경"
            />
            <LedgerField
              label="그라인더"
              value="Comandante · C40"
              action="변경"
            />
            <LedgerField label="분쇄도" value="24 클릭" sub="레시피 22 클릭" />
          </div>
        </Part>

        <Part name="Taste dots">
          <div className="flex flex-col">
            <TasteDots label="산미" value={4} />
            <TasteDots label="단맛" value={3} />
            <TasteDots label="바디" value={null} />
          </div>
        </Part>

        <Part name="Bottom sheet">
          <div className="-mx-[24px] -mb-[22px] overflow-hidden bg-sunken pt-[24px]">
            <BottomSheet
              title="필터"
              action={<span className="text-[13.5px] text-ink-3">초기화</span>}
            >
              <div className="flex flex-col gap-[11px]">
                <SheetLabel>추천 배전도</SheetLabel>
                <div className="flex gap-[8px]">
                  {(
                    [
                      ["LIGHT", "약배전"],
                      ["MEDIUM_LIGHT", "중배전"],
                      ["DARK", "강배전"],
                    ] as const
                  ).map(([level, label]) => (
                    <span
                      key={level}
                      className="flex flex-1 items-center justify-center rounded-[7px] border border-border py-[12px]"
                    >
                      <RoastLabel roastLevel={level} label={label} />
                    </span>
                  ))}
                </div>
              </div>
              <BottomCta>31개 결과 보기</BottomCta>
            </BottomSheet>
          </div>
        </Part>
      </div>
    </main>
  );
}
