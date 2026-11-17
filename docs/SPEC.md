# N빵 정산 앱 상세 명세 (개정판 2026-11-16)

초급프로젝트 Term Project / 2인 팀 / 마감 2026-12-18 23:59 KST.
이 문서가 기준 명세다. 코드와 다르면 이 문서를 먼저 고치고 이슈를 남긴다.

## 1. 개요
- 이벤트(여행 등) > 차수(참여자가 차수마다 다름) > 지출 구조.
- 이벤트 전체를 합산해 사람별 "누구에게 얼마 송금"을 보여준다. 실제 송금 연동은 없다.
- 송금 확인이 모두 끝나면 이벤트는 진행 중 목록에서 빠지고 완료 보관함으로 이동한다. 삭제가 아니며 읽기 전용이다.
- 금액은 원 단위 정수만 쓴다. 소수와 부동소수점 계산은 금지.

## 2. Firestore 구조
- events/{eid}: name, ownerId, inviteCode, status(open, settling, settled), pendingCount(숫자, 기본 0), settlementMode(pairwise, reduced), lastConfirmedTransferId(문자열 또는 null), createdAt, settledAt
- events/{eid}/members/{uid}: displayName, role(owner, member), inviteCode(가입 시 제출한 값), joinedAt
- events/{eid}/rounds/{rid}: title, order, participantIds[], createdBy
- events/{eid}/rounds/{rid}/expenses/{xid}: title, amount, payerId, splitType(equal, custom), shares{uid: 금액}, status(active, cancelled), createdBy, createdAt
- events/{eid}/transfers/{tid}: fromUid, toUid, amount, status(pending, sent, confirmed), sentAt, confirmedAt

shares는 균등분할이어도 계산 결과를 저장한다. 저장 시 shares 합계는 amount와 같아야 하고, shares의 키는 해당 차수 participantIds의 부분집합이어야 한다.

## 3. 계산 규칙
1. 균등분할: 금액÷인원의 몫을 모두에게 주고, 나머지 r원은 참여자 목록 앞 r명에게 1원씩 더한다. 분담 합계는 총액과 같다. 예: 10000÷3은 3334, 3333, 3333.
2. 직접입력분할: shares 합계가 총액과 다르면 저장을 거부한다.
3. 기본 정산(쌍별 상계): status가 active인 지출만 대상이다. 결제자가 아닌 참여자는 결제자에게 자기 분담액만큼 채무가 생긴다. 결제자 본인 분담액은 채무가 아니다. 이벤트 전체에서 같은 두 사람의 양방향 금액을 합산하고 차액 방향으로 1건만 만든다. 차액이 0이면 항목을 만들지 않는다.
4. 옵션 "송금 횟수 줄이기"(settlementMode가 reduced): 사람별 순잔액(받을 돈에서 보낼 돈을 뺀 값)을 구하고, 채권자와 채무자를 그리디로 매칭한다. 순잔액 큰 순으로 정렬하고 동률은 uid 사전순으로 한다. 최대 n-1건이며 최소 횟수를 보장하지 않는 근사 방식이다. 보고서에서는 "최소화"가 아니라 "횟수 줄이기(근사)"라고 쓴다. SettlementStrategy로 교체한다.
5. 결과 정렬은 (fromUid, toUid) 순으로 고정해 테스트가 결정적이도록 한다.

테스트 예시 1: 1차 점심 A,B,C에서 A가 30000 결제 시 B→A 10000, C→A 10000. 2차 카페 A,B,C에서 B가 15000 결제 시 A→B 5000, C→B 5000. 결과는 B→A 5000, C→A 10000, C→B 5000. 횟수 줄이기 옵션이면 C→A 15000 한 건.
테스트 예시 2: 3차 A,B만 참여, A가 20000 결제 시 B→A 10000 추가. 최종 B→A 15000, C→A 10000, C→B 5000. 횟수 줄이기 옵션이면 B→A 10000, C→A 15000.

## 4. 상태 전이
- 이벤트: open, settling, settled 순서로만 이동한다. 되돌리기는 금지.
- 송금: pending, sent, confirmed 순서로만 이동한다. 보내는 사람이 sent, 받는 사람이 confirmed.
- 지출은 hard delete 없이 status를 cancelled로 바꾼다.

정산 시작(방장만, 한 번의 batch):
- events 문서를 status settling, settlementMode, pendingCount n으로 갱신한다. n은 만들 transfers 건수다.
- transfers n건을 만든다. 이후 차수와 지출은 수정할 수 없다.
- n이 0이면 송금이 필요 없으므로 바로 status settled, pendingCount 0으로 갱신한다.
- open→settled 직행은 송금 0건일 때만 허용한다. 이 경우 transfers는 만들지 않고 pendingCount는 0이어야 한다. 송금이 1건 이상이면 반드시 settling을 거친다. 도메인 함수 canTransitionEvent는 open→settled를 거부하고, 이 직행은 startSettlement가 0건일 때만 결과로 돌려준다.

송금 확인(받는 사람, runTransaction):
- transfers 문서를 status confirmed, confirmedAt으로 갱신한다.
- 같은 트랜잭션에서 events 문서를 pendingCount를 1 줄이고 lastConfirmedTransferId를 해당 tid로 바꾼다. 줄인 결과가 0이면 status를 settled, settledAt을 함께 쓴다. increment 대신 읽은 값에서 1을 뺀 값을 직접 쓴다.

## 5. Security Rules
공통: 비로그인과 비멤버는 모두 거절. 멤버 여부는 members/{auth.uid} 문서 존재로 판단한다.

| 대상 | 읽기 | 쓰기 조건 |
|---|---|---|
| events | 멤버 | 생성: ownerId가 본인이고 status open, pendingCount 0. 정산 시작: 방장만. 송금 확인에 따른 갱신: 아래 참고 |
| members | 멤버 | 생성: 본인 uid이고, (role member이며 inviteCode가 이벤트 값과 일치) 또는 (이벤트 생성 batch에서 방장 본인 문서). 수정: 본인 displayName만 |
| rounds | 멤버 | 생성: 멤버, event open, createdBy 본인. 수정: 작성자 또는 방장, event open |
| expenses | 멤버 | 생성: 멤버, event open, createdBy 본인. 수정 및 cancelled 전환: 작성자 또는 방장, event open. 삭제는 항상 거절 |
| transfers | 멤버 | 생성: 방장만, 이벤트가 open에서 settling으로 바뀌는 batch 안에서만. sent: fromUid 본인, pending에서 sent로, 변경 필드는 status와 sentAt만. confirmed: toUid 본인, sent에서 confirmed로, 변경 필드는 status와 confirmedAt만 |

세부 규칙:
- 가입: 초대 링크는 /join/{eid}?code=코드 형태다. 비멤버는 이벤트를 읽을 수 없으므로 eid를 링크로 전달한다. members 생성 시 role이 member가 아니면 거절해서 스스로 방장이 되는 것을 막는다.
- 0건 정산 직행: 방장만 events를 open에서 settled로 바꿀 수 있고, 이때 pendingCount는 0이며 같은 batch에 transfers 생성이 없어야 한다(settledAt 함께 기록). 비방장, 송금 건수가 있는 정산(transfers 생성이 포함된 batch), pendingCount가 0이 아닌 경우의 직행은 거절한다. 송금이 있는 정산은 open→settling만 허용한다.
- 송금 금액, fromUid, toUid는 생성 후 수정 불가(affectedKeys로 제한).
- settled 이벤트는 전체 읽기 전용이다.
- 송금 확인에 따른 events 갱신(방장 아님)은 다음을 모두 만족할 때만 허용한다: 변경 필드가 pendingCount, status, settledAt, lastConfirmedTransferId뿐이다. 이전 status가 settling이다. pendingCount가 정확히 1 줄었다. 줄인 결과가 0이면 status가 settled이고 아니면 settling이다. lastConfirmedTransferId가 가리키는 transfer가 같은 batch에서 sent에서 confirmed로 바뀌고 그 toUid가 요청자다(get과 getAfter 사용).
- transfers의 confirmed 규칙에서도 getAfter로 events의 pendingCount가 1 줄었는지 확인한다. 두 문서가 서로를 확인하는 구조다.
- 구현 난항 시 대안: events를 settled로 바꾸는 권한을 방장으로 한정하고 한계로 기재한다. 이 경우에도 비멤버와 타인 접근 거절 검증은 그대로 유지한다.
- 한계(보고서 기재): Rules는 방장이 계산한 transfers 금액이 올바른지, 만든 건수가 pendingCount와 같은지 검증할 수 없다. 정산 시작을 방장 전용으로 제한해 신뢰 범위를 좁힌다.

## 6. 디자인 패턴 (10종, 필수 8종 이상)
같은 패턴을 여러 곳에 써도 1종으로 센다. 파일 분리나 라이브러리 사용만으로는 인정되지 않으므로 참여 요소와 협력이 코드에서 보여야 한다. 코드에는 `// [Pattern: 이름] 역할` 주석으로 참여 요소를 표시한다.

| 패턴 | 적용 | 인정 조건 | 담당 |
|---|---|---|---|
| Singleton | Firebase 인스턴스 | 클래스와 getInstance 구조, 중복 생성 방지 | A |
| State | 이벤트와 송금 상태 | 상태별 클래스, 허용되지 않은 전이는 거부 | A |
| Repository | Firestore 접근 | 인터페이스와 Firestore 구현체 분리 | A |
| Adapter | 문서와 도메인 객체 변환 | 도메인 인터페이스를 구현하는 Adapter 클래스 | A |
| Strategy | 분할(균등, 직접입력)과 정산(쌍별, 횟수 줄이기) | 공통 인터페이스, 런타임 교체 | B |
| Factory | 전략 생성 | splitType과 settlementMode에 따라 생성 | B |
| Composite | 이벤트, 차수, 지출의 합계와 분담액 | 공통 인터페이스로 잎과 합성 객체를 동일하게 처리 | B |
| Command | 지출 추가와 취소, 송금 확인, undo | execute와 undo, 이력 스택 | B |
| Observer | 화면 실시간 갱신 | 직접 만든 Store의 subscribe와 notify, onSnapshot은 그 안에서 연결 | 공통 |
| Facade | 서비스 창구 | 여러 하위 객체를 하나의 API로 묶음 | 공통 |

Strategy, State, Command, Composite, Repository, Factory는 구조가 분명해서 안전하다. Singleton, Adapter, Observer, Facade는 위 인정 조건을 지켜야 8종으로 센다.

## 7. 테스트
- Vitest(src/domain): 테스트 예시 1과 2, 나머지 배분, 합계 불일치 거부, 지출 금액 1원 미만 거부, 횟수 줄이기 결과, 취소 지출 제외, 0건 정산, 상태 전이 거부, pendingCount 계산.
- Rules 에뮬레이터: 비로그인, 비멤버, 멤버, 방장 각각의 허용과 거절. 추가 케이스: 가입하면서 role owner 시도, 송금 금액 변경 시도, 다른 사람 송금 confirmed 시도, transfer 없이 pendingCount 줄이기, settled 이후 쓰기, 방장의 0건 정산 직행(open→settled) 허용, 비방장의 직행 거절, 송금 1건 이상인데 open→settled 직행 거절.
- GitHub Actions: build와 Vitest. 에뮬레이터 테스트는 Java가 필요하므로 로컬 실행 결과를 보고서에 기록해도 된다.
- 실제 화면 검증: 배포 주소에서 로그인, 데이터 유지, 비멤버 접근 거절을 직접 확인하고 준비 상태, 동작, 예상 결과, 실제 결과를 기록한다.

## 8. 개발 방식과 일정
- 계산 로직을 순수 함수와 테스트로 먼저 만든다.
- 이후 한 컴포넌트에 화면, 입력 검사, 계산, Firebase 요청을 몰아 구현한 베이스라인을 만들고 `before-refactor` 태그를 남긴다.
- 그 뒤 패턴별로 이슈, 브랜치, PR 순서로 리팩터링한다. PR에는 전후 비교와 확인 결과를 적는다.
- MVP: 이벤트와 초대, 차수와 참여자, 균등과 직접입력 분할, 쌍별 정산, 송금 확인, 보관함. 여유 시 횟수 줄이기 옵션, 비율분할, undo.

일정:
- 11/16~22: 세팅, 인증, 계산 로직, 베이스라인
- 11/23~29: Rules, 정산 시작과 송금 확인, 리팩터링 1
- 11/30~12/6: 리팩터링 2, 테스트, Actions
- 12/7~13: 에뮬레이터 검증, JCloud 배포, 보고서
- 12/14~18: 버퍼, 영상 1~3분, PDF, 최종 커밋 SHA

역할 분담:
- A: 인증, 이벤트, 멤버, Rules, 배포, Singleton, State, Repository, Adapter
- B: 차수, 지출, 계산 로직, Vitest, Strategy, Factory, Composite, Command
- 공통: Observer, Facade, 서로의 PR 리뷰

## 9. 배포 체크
- Firebase Authorized domains에 JCloud 주소를 추가한다.
- SPA 새로고침 라우팅은 HashRouter 또는 서버 fallback으로 처리한다.
- 비밀키와 서비스 계정 키는 커밋하지 않는다. 테스트 계정 정보는 LMS 제출란에만 적는다.
- 채점 기간 동안 배포된 서비스를 유지하고, 시연 데이터(다른 사용자 권한을 확인할 수 있는 이벤트)를 준비한다.

## 10. 초안 대비 변경점
- pendingCount와 lastConfirmedTransferId를 추가해 마지막 송금 확인과 완료 전환을 Rules로 검증하도록 변경.
- 송금 0건 정산은 바로 settled로 처리.
- 송금 문서의 변경 가능 필드를 제한.
- 초대 링크에 eid를 포함하고 가입 시 role을 member로 고정.
- rounds와 expenses에 createdBy 추가.
- 그리디 옵션 명칭을 "횟수 줄이기(근사)"로 변경.
- 패턴별 인정 조건을 추가하고 담당을 재배분(Repository와 Adapter를 A로).
