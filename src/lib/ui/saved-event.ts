// 바로 저장되는 화면(법인카드·차량·회의실·부서·기능 스위치)이 저장에 성공하면 부른다 → 관리자 틀의 "저장했어요" 알림(U-2, D-301)
export const SAVED_EVENT = "pe:saved";
export function showSaved(message = "저장했어요") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: message }));
}
