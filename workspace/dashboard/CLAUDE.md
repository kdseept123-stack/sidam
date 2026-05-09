# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

정적 HTML 랜딩 페이지(`index.html`)로 시작하는 대시보드 프로젝트. 빌드 도구 없이 Tailwind CDN + 바닐라 HTML/CSS로 구성되어 있음.

---

## 디자인 시스템

### 글로벌 스타일

- **CSS**: Tailwind CSS 사용. gray 계열은 전부 `neutral-*` 사용 (`slate`, `gray`, `zinc`, `stone` 등 cool gray 계열 금지)
- **배경**: `neutral-950` / **텍스트**: `white`
- **포인트 컬러**: `orange-500` (`#ff6b35`에 가장 가까운 Tailwind 톤)
- **폰트**: sans → Pretendard, mono → Geist Mono
- **폰트 굵기**: 본문은 `font-regular`. `semibold` / `bold`는 헤드라인(행사명)에만 사용
- **라벨/캡션**: 전부 lowercase (`uppercase` 사용 금지)
- **아이콘**: Heroicons micro (16×16 viewbox). 색상 기본 `neutral-500`, 활성 상태만 `white`

### 레이아웃

- 카드/패널 사용 금지. 섹션 구분은 `1px border`, `white/10%` opacity 디바이더로 처리
- 폼 영역도 카드로 감싸지 말 것 — 배경 위에 그대로 놓고 위아래 디바이더로 구분
- 최대 너비: `max-w-2xl`, 가운데 정렬
- 섹션 간 간격: `py-16`
- 행사 정보(일시/장소/대상/준비물)는 2×2 그리드. 세로 디바이더는 상하 보더에 붙도록 (그룹 padding 아닌 개별 항목 padding)

### 폼 스타일

- input/select 컨테이너: border 없음. 배경 `white/5%` opacity, 포커스 시 `white/10%` opacity
- input 높이: `h-10` (40px)
- input 텍스트: `text-sm`, `font-regular`
- 라벨: `text-xs`, `neutral-400`, 라벨↔input 간격 `mb-1.5`
- 드롭다운(select)도 input과 동일한 스타일
- 제출 버튼: `orange-500` 배경, `white` 텍스트, pill shape (`rounded-full`), `h-10`, `text-sm`, `font-medium`. 호버: `orange-400`
- 버튼 위 간격: `mt-8`

### 헤드라인 영역

- 행사명: `text-4xl` (모바일 `text-2xl`), `font-semibold`, `white`
- 부제: `text-lg`, `neutral-400`, `font-regular`, 행사명 아래 `mt-3`
- 강의 소개 텍스트: `text-base`, `neutral-300`, `leading-relaxed`, `max-w-lg`

### 반응형

- 모바일 퍼스트
- 행사 정보 그리드: 모바일 1열 스택 → `md:` 이상 2×2
- 768px 미만 좌우 패딩: `px-6`

### 금지 사항

| 항목 | 금지 이유 |
|------|-----------|
| `indigo`, `blue` 계열 강조색 | 포인트 컬러는 `orange-500` 단일 사용 |
| `box-shadow` | 그림자 대신 디바이더로 구분 |
| `uppercase` 텍스트 | 라벨/캡션은 모두 lowercase |
| `font-bold` / `font-semibold` 남용 | 헤드라인 외 전부 `font-regular` |
| 비표준 폰트 크기 (12.5px, 13px 등) | Tailwind 스케일(`text-xs`, `text-sm`, …)만 허용 |
