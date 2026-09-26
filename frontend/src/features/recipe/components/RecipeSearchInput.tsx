import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
} from "react";
import { Input } from "@/components/ui";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_INPUT_ID = "recipe-search-input";

/**
 * 검색어 입력 — 300ms 디바운스(AC-59), IME 조합 중에는 요청을 미룬다(AC-60),
 * ⌘K/Ctrl+K로 포커스한다(AC-80).
 *
 * <p>로컬 `draft`로 타이핑을 즉시 반영하고, 커밋(부모 `q` 갱신 → URL 동기화)만 지연시킨다.
 * `isComposing`을 input 이벤트가 아니라 composition 이벤트로 직접 추적하는 이유는, jsdom을 포함한
 * 일부 구현이 `input`의 `nativeEvent.isComposing`을 안정적으로 채우지 않기 때문이다.
 */
export function RecipeSearchInput({
  q,
  onCommit,
}: {
  q: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(q);
  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      // Input 프리미티브는 ref를 받지 않는다(AC-DS2-18) — id로 직접 찾는다.
      document.getElementById(SEARCH_INPUT_ID)?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function scheduleCommit(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommit(value), SEARCH_DEBOUNCE_MS);
  }

  return (
    <Input
      id={SEARCH_INPUT_ID}
      type="search"
      label="레시피 검색"
      placeholder="레시피 · 기구 검색"
      value={draft}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setDraft(value);
        if (!composingRef.current) scheduleCommit(value);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      }}
      onCompositionEnd={(e: CompositionEvent<HTMLInputElement>) => {
        composingRef.current = false;
        scheduleCommit((e.target as HTMLInputElement).value);
      }}
    />
  );
}
