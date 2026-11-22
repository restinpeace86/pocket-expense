// 저장 안 한 변경(U-2, D-301): [저장]을 눌러야 저장되는 영역에서 입력이 바뀌었는데 아직 저장을 안 누른 영역 목록
// 영역(scope) = 가장 가까운 form(제출 버튼 있음), 없으면 [저장] 버튼을 품은 가장 가까운 조상(main 바로 아래까지)
// 관리자 설정 화면의 UnsavedGuard가 채우고, 진행 띠(설정 마법사)도 같은 목록을 본다. data-unsaved-ignore 안은 무시
const dirty = new Set<HTMLElement>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const SAVE_TEXT = /저장/;
const NOT_SAVE = /저장하지 않고|돌아가서 저장|저장 공간/;
export function isSaveButton(el: Element): el is HTMLButtonElement {
  if (!(el instanceof HTMLButtonElement) || el.closest("[data-unsaved-bar], [data-setup-bar]")) return false;
  if (el.hasAttribute("data-save")) return true;
  const label = `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.trim();
  return SAVE_TEXT.test(label) && !NOT_SAVE.test(label);
}
function saveButtonsIn(scope: HTMLElement): HTMLButtonElement[] {
  return [...scope.querySelectorAll("button")].filter(isSaveButton);
}

// 입력이 바뀐 곳에서 저장 영역 찾기
export function scopeFor(target: HTMLElement, root: HTMLElement): HTMLElement | null {
  if (target.closest("[data-unsaved-ignore]")) return null;
  const form = target.closest("form");
  if (form) return form.querySelector('button[type="submit"], button:not([type])') ? form : null;
  for (let el = target.parentElement; el && el !== root; el = el.parentElement) {
    if (saveButtonsIn(el).length) return el;
  }
  return null;
}

export function saveTargetOf(scope: HTMLElement): { form?: HTMLFormElement; button?: HTMLButtonElement } {
  if (scope instanceof HTMLFormElement) {
    return { form: scope, button: scope.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled]), button:not([type]):not([disabled])') ?? undefined };
  }
  return { button: saveButtonsIn(scope).find((b) => !b.disabled) };
}

export function markDirty(scope: HTMLElement) {
  if (!dirty.has(scope)) {
    dirty.add(scope);
    emit();
  }
}
// 저장(제출·[저장] 클릭)한 영역과 그 안 영역을 비운다
export function clearWithin(el: HTMLElement) {
  let changed = false;
  for (const s of dirty) if (s === el || el.contains(s) || s.contains(el)) changed = dirty.delete(s) || changed;
  if (changed) emit();
}
export function clearAll() {
  if (dirty.size) {
    dirty.clear();
    emit();
  }
}
export function dirtyScopes(): HTMLElement[] {
  for (const s of dirty) if (!s.isConnected) dirty.delete(s);
  return [...dirty];
}
export function hasUnsaved(): boolean {
  return dirtyScopes().length > 0;
}
export function subscribeUnsaved(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
