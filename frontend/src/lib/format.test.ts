import { describe, expect, it } from 'vitest';
import { formatCumulativeGrams, formatDuration, formatGrams, formatRatio, formatTemperature } from './format';

describe('formatDuration', () => {
  it('초를 m:ss로 바꾼다', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(15)).toBe('0:15');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(210)).toBe('3:30');
  });

  it('10분을 넘겨도 자릿수를 늘리지 않는다', () => {
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3600)).toBe('60:00');
  });
});

describe('formatGrams', () => {
  it('중량은 스케일 1로 표시한다', () => {
    expect(formatGrams(30)).toBe('30.0g');
    expect(formatGrams(500)).toBe('500.0g');
    expect(formatGrams(16.5)).toBe('16.5g');
  });
});

describe('formatCumulativeGrams', () => {
  it('소수점 이하가 0이면 생략한다', () => {
    expect(formatCumulativeGrams(60)).toBe('60g');
    expect(formatCumulativeGrams(300)).toBe('300g');
    expect(formatCumulativeGrams(500)).toBe('500g');
  });

  it('소수가 있으면 한 자리까지 남긴다', () => {
    expect(formatCumulativeGrams(62.5)).toBe('62.5g');
  });
});

describe('formatRatio', () => {
  it('1:N 형태로 만든다', () => {
    expect(formatRatio(16.7)).toBe('1:16.7');
    expect(formatRatio(15)).toBe('1:15.0');
  });
});

describe('formatTemperature', () => {
  it('소수점 이하가 0이면 생략한다', () => {
    expect(formatTemperature(100)).toBe('100°C');
    expect(formatTemperature(92)).toBe('92°C');
  });

  it('소수가 있으면 한 자리까지 남긴다', () => {
    expect(formatTemperature(93.5)).toBe('93.5°C');
  });
});
