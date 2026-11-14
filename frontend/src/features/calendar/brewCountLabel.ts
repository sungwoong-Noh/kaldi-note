/** 월 헤더·목록 헤더의 건수 라벨. 활동일수가 함께 주어지면 `N일 · M잔`, 아니면 `N잔`. */
export function brewCountLabel(count: number, activeDays?: number): string {
  return activeDays !== undefined ? `${activeDays}일 · ${count}잔` : `${count}잔`;
}
