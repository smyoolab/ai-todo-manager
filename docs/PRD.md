# PRD (Product Requirements Document)
## AI 기반 할 일 관리 웹 애플리케이션

---

## 1. 프로젝트 개요

### 1.1 목적
본 프로젝트는 개인 사용자가 할 일을 효율적으로 관리할 수 있도록 돕는 **AI 기반 할 일 관리(To-do) 웹 애플리케이션**이다.  
사용자는 기본적인 할 일 관리(CRUD)는 물론, 자연어 입력을 통한 AI 할 일 생성과 AI 요약·분석 기능을 통해 생산성을 향상시킬 수 있다.

### 1.2 핵심 가치
- 간단한 사용자 인증 및 개인화된 할 일 관리
- 자연어 기반 입력을 통한 할 일 생성 자동화
- 일/주 단위 생산성 분석 제공

---

## 2. 주요 기능

### 2.1 사용자 인증

- 이메일/비밀번호 기반 로그인 및 회원가입
- Supabase Auth를 활용한 인증 처리
- 로그인 사용자 기준 데이터 접근 제한 (Row Level Security)

---

### 2.2 할 일 관리 (CRUD)

#### 기능 범위
- 할 일 생성(Create)
- 할 일 조회(Read)
- 할 일 수정(Update)
- 할 일 삭제(Delete)

#### 할 일 필드 정의
| 필드명 | 타입 | 설명 |
|------|------|------|
| title | string | 할 일 제목 |
| description | string | 할 일 상세 설명 |
| created_date | datetime | 생성일 |
| due_date | datetime | 마감일 |
| priority | enum | 우선순위 (high / medium / low) |
| category | string[] | 카테고리 (업무, 개인, 학습 등) |
| completed | boolean | 완료 여부 |

---

### 2.3 검색, 필터, 정렬

#### 검색
- 제목(title) 및 설명(description) 기반 텍스트 검색

#### 필터
- 우선순위: 높음 / 중간 / 낮음
- 카테고리: 업무 / 개인 / 학습 등
- 진행 상태:
  - 진행 중 (completed = false, due_date ≥ today)
  - 완료 (completed = true)
  - 지연 (completed = false, due_date < today)

#### 정렬
- 우선순위순
- 마감일순
- 생성일순

---

### 2.4 AI 할 일 생성 기능

#### 기능 설명
사용자가 자연어로 입력한 문장을 AI가 분석하여 구조화된 할 일 데이터(JSON)로 변환한다.

#### 입력 예
> “내일 오전 10시에 팀 회의 준비”

#### 변환 결과 예
```json
{
  "title": "팀 회의 준비",
  "description": "내일 오전 10시에 있을 팀 회의를 위해 자료 작성하기",
  "created_date": "YYYY-MM-DD, HH:MM",
  "due_date": "YYYY-MM-DD, 10:00",
  "priority": "high",
  "category": ["업무"],
  "completed": false
}
```

#### 처리 방식
- Google Gemini API 호출
- 날짜/시간 표현 파싱
- 우선순위 및 카테고리 추론

---

### 2.5 AI 요약 및 분석 기능

#### 일일 요약
- 오늘 완료한 할 일 목록
- 아직 남아 있는 할 일 요약

#### 주간 요약
- 이번 주 전체 할 일 수
- 완료율(%) 계산
- 가장 많이 사용된 카테고리

---

## 3. 화면 구성

### 3.1 로그인 / 회원가입 화면
- 이메일/비밀번호 입력 폼
- 회원가입 / 로그인 전환
- 인증 오류 메시지 표시

### 3.2 할 일 관리 메인 화면
- 할 일 목록 테이블 또는 카드 UI
- 할 일 추가/수정/삭제 UI
- 검색/필터/정렬 컨트롤
- AI 할 일 생성 입력창
- AI 요약/분석 버튼

### 3.3 통계 및 분석 화면 (확장)
- 주간 활동량 차트
- 완료율 시각화
- 카테고리별 통계 그래프

---

## 4. 기술 스택

### 프론트엔드
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui

### 백엔드 / BaaS
- Supabase
  - Auth
  - PostgreSQL
  - Row Level Security

### AI
- Google Gemini API
- AI SDK 활용

---

## 5. 데이터 구조 (Supabase)

### 5.1 users
- Supabase Auth 기본 users 테이블 사용
- 추가 사용자 메타 정보 확장 가능

### 5.2 todos
| 컬럼명 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| title | text | 제목 |
| description | text | 설명 |
| created_date | timestamp | 생성일 |
| due_date | timestamp | 마감일 |
| priority | text | 우선순위 |
| category | text[] | 카테고리 |
| completed | boolean | 완료 여부 |

---

## 6. 보안 및 권한

- Supabase Row Level Security 적용
- 사용자 본인의 데이터만 CRUD 가능

---

## 7. 향후 확장 아이디어

- 반복 일정 지원
- 알림(Notification) 기능
- 팀/공유 할 일
- 모바일 대응(PWA)

---
