/** 월 헤더·목록 헤더의 건수 라벨. 1건은 단수, 그 외는 복수(0건 포함). */
export function brewCountLabel(count: number): string {
  return count === 1 ? "1 BREW" : `${count} BREWS`;
}
