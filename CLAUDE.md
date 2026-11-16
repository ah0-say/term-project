# N빵 정산 앱 (초급프로젝트 Term Project)

2인 팀. 마감 2026-12-18 23:59 KST. 상세 명세는 @docs/SPEC.md 를 따른다.
이 파일은 짧게 유지한다. 길어지는 내용은 docs/SPEC.md로 옮긴다.

## 스택
- React + Vite + TypeScript, react-router-dom
- Firebase Authentication(이메일/비밀번호), Firestore
- 테스트: Vitest, Firebase 에뮬레이터(Rules)
- 배포: JCloud (프런트엔드만), CI: GitHub Actions(build + Vitest)

## 명령어
- npm run dev / npm run build / npm test (vitest run)
- npm run test:rules (에뮬레이터로 Security Rules 테스트)

## 현재 단계
베이스라인. 계산 로직은 src/domain의 순수 함수로 먼저 만들고 테스트한다.
화면은 한 컴포넌트에 몰아서 구현해도 된다. 패턴 적용은 `before-refactor` 태그를 남긴 뒤 이슈별로 시작한다.
단계가 바뀌면 이 줄을 고친다.

## 규칙
- 금액은 원 단위 정수만 쓴다. 소수와 부동소수점 금지.
- src/domain은 순수 TypeScript다. firebase를 import하지 않는다.
- Firebase 접근은 src/data에만 둔다. 리팩터링 단계 이후 UI에서 직접 import하지 않는다.
- 지출은 hard delete 없이 status를 cancelled로 바꾼다.
- 이벤트와 송금 상태는 되돌리지 않는다. 실제 송금 연동은 만들지 않는다.
- 비밀키, 서비스 계정 키, 테스트 계정 정보를 커밋하지 않는다. 환경변수는 .env.local에 두고 .gitignore에 포함한다.
- UI 문구와 커밋 메시지는 한국어, 식별자는 영어.
- 디자인 패턴을 적용하면 `// [Pattern: 이름] 역할` 주석으로 참여 요소를 표시한다.

## Git 작업 방식
- main에 직접 푸시하지 않는다. 이슈, 브랜치(feat/…, fix/…, refactor/…), PR 순서로 진행한다.
- PR 본문에 변경 이유, 확인 결과, AI가 생성한 부분과 직접 수정한 부분, 참고한 출처를 적는다.
- 구현 단위마다 커밋한다. 테스트가 통과한 상태에서만 커밋한다.

## 폴더 구조
- src/domain: 모델, 분할과 정산 계산, 상태 전이 (순수)
- src/data: Firebase 인스턴스, Repository, Adapter
- src/services: Facade
- src/store: Observer 기반 Store
- src/ui: 컴포넌트와 페이지
- tests/rules: Security Rules 테스트
- firestore.rules, docs/SPEC.md
