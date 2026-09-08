<div align="center">

# Post-training Research Engineer 지원 준비 다이어리

**계획을 세우고 · 실제로 실행하고 · 다음 계획을 개선하는 공개 실행 다이어리**

`Plan` → `Do` → `See`

</div>

---

## 서비스 한눈에 보기

| 준비 과정의 문제 | 이 서비스의 해결 방식 |
| --- | --- |
| 학습·실험·포트폴리오 기록이 여러 곳에 흩어짐 | 하나의 공개 작업공간에서 계획부터 회고까지 연결 |
| 계획과 실제 실행의 차이를 알기 어려움 | 예상 시간·실제 시간·실행 근거를 함께 기록 |
| 회고가 감상으로 끝나고 다음 행동으로 이어지지 않음 | 개선점을 다음 계획에 직접 연결 |

> 취업 준비를 단순한 할 일 목록이 아니라 **검증 가능한 실행 기록**으로 바꾸는 서비스입니다.

## 핵심 흐름

<table>
  <tr>
    <td align="center" width="33%"><strong>📝 Plan</strong><br />목표·기간·성공 기준·예상 시간을 정합니다.</td>
    <td align="center" width="33%"><strong>⚡ Do</strong><br />실제 할 일과 시작·종료·문제를 기록합니다.</td>
    <td align="center" width="33%"><strong>🔎 See</strong><br />예상과 실제를 비교하고 다음 계획을 고칩니다.</td>
  </tr>
</table>

## 핵심 기능

| 영역 | 제공 기능 |
| --- | --- |
| 계획 | 계획 생성·수정·기간·우선순위·성공 기준·예상 시간 관리 |
| 수정 이력 | 계획을 바꾸기 전 이전 상태를 revision으로 보존 |
| 할 일 | 생성·수정·완료·재진행·soft delete·검색·필터·정렬 |
| 실행 기록 | 실제 시작·종료 시각, 소요 시간, 실행 중 문제 기록 |
| 대시보드 | 계획·완료·지연·차단 수와 예상·실제 시간 차이 확인 |
| 회고 | 개선점을 다음 계획과 연결 |
| Export | 공개 작업공간 전체 자료를 JSON으로 내보내기 |

## 누구를 위한 서비스인가요?

- Post-training·fine-tuning·RLHF·RLVR·데이터 합성을 공부하는 사람
- AI/ML 연구 엔지니어 취업과 포트폴리오를 함께 준비하는 사람
- 예상 시간, 실제 결과, 다음 액션까지 남기고 싶은 사람

기획 배경은 [Upstage AI Research Engineer - Post-training 공고](https://careers.upstage.ai/ko/o/194876)를 참고했습니다. 특정 회사 지원 현황을 저장하는 서비스가 아니라, 목표 직무를 준비하는 과정을 구조화하는 서비스입니다.

## 기록을 믿을 수 있게 만든 이유

<table>
  <tr>
    <td>🔁 <strong>중복 방지</strong><br />idempotency key와 DB 제약으로 완료 기록 중복을 차단합니다.</td>
    <td>🧮 <strong>실제 시간 계산</strong><br />소요 시간은 시작·종료 시각으로 서버에서 계산합니다.</td>
  </tr>
  <tr>
    <td>🗂️ <strong>이력 보존</strong><br />계획 수정 이력과 soft delete로 과거 기록의 맥락을 유지합니다.</td>
    <td>🛡️ <strong>서버 중심 저장</strong><br />브라우저에 DB 자격 증명을 전달하지 않습니다.</td>
  </tr>
</table>

## 공개 서비스 범위

현재는 ALEPH Studio T06 범위에 맞춰 로그인 없는 단일 공개 작업공간으로 동작합니다.

- 로그인·회원가입·OAuth 없음
- 공개 URL을 아는 사람은 기록을 볼 수 있음
- 회사 지원 자동 제출·AI 자동 첨삭 기능은 포함하지 않음
- 개인정보·비밀번호·API 키·비공개 지원서 원문은 저장하지 않음

## 기술 구조

| 영역 | 기술 |
| --- | --- |
| 화면·서버 | Next.js App Router · React · TypeScript |
| API | Next.js Route Handlers |
| 데이터베이스 | Supabase PostgreSQL |
| 입력 검증 | Zod |
| 테스트 | Vitest · React Testing Library · Playwright |
| 시간대 | Asia/Seoul |

```text
공개 브라우저
    ↓ HTTPS
Next.js 화면 + 서버 API
    ↓ 서버 측 DB 접근
Supabase PostgreSQL
```

## 저장소 구조

```text
app/                 화면과 API Route Handler
components/          대시보드·계획·할 일·실행·회고 UI
lib/domain/          타입·검증·집계·export 규칙
lib/server/          Supabase 접근·Repository·Service
supabase/migrations/ 데이터베이스 스키마와 트랜잭션 함수
contracts/           공개 export 데이터 계약
tests/               단위·컴포넌트·API·E2E 테스트
```

<div align="center">

**Plan의 의도를 Do의 기록으로 남기고, See의 판단을 다음 Plan으로 연결합니다.**

</div>
