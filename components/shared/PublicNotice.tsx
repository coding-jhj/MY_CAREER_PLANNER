import { WarningCircle } from "@phosphor-icons/react";

export function PublicNotice() {
  return <aside className="notice" aria-label="공개 이용 안내"><WarningCircle weight="duotone" aria-hidden="true" /><p><strong>공개 작업공간</strong> 로그인 기능이 없습니다. 링크를 아는 사람은 내용을 볼 수 있으니 비밀번호·연락처·비공개 지원 자료는 입력하지 마세요.</p></aside>;
}
