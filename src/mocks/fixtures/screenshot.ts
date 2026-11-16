// MOCK 스크린샷. 쇼핑몰(MORO MARKET)처럼 보이는 1440×900 SVG를 화면(pageKey)별로 만든다.
// 요소 위치는 `scenario.ts`의 후보 bbox와 맞춘다(바꾸면 두 파일을 함께 고친다).
// 실제 서버는 PNG를 주지만 `<img>`에는 형식 차이가 없다. 이 이미지는 실제 쇼핑몰 화면이 아니다.

import type { PageKey } from './scenario.ts'

const W = 1440
const H = 900
const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif"

interface TextOpts {
  size?: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
}

function text(x: number, y: number, value: string, opts: TextOpts = {}) {
  const { size = 14, weight = 400, fill = '#0f172a', anchor = 'start' } = opts
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  opts: { stroke?: string; radius?: number } = {},
) {
  const stroke = opts.stroke ? ` stroke="${opts.stroke}"` : ''
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${opts.radius ?? 0}" fill="${fill}"${stroke}/>`
}

/** 상단 메뉴. 세 항목의 위치는 bbox(470·570·670, y 26, 84×28)와 같다 */
function header(menuLabel: string) {
  const items: [number, string][] = [
    [470, '마이페이지'],
    [570, menuLabel],
    [670, '고객센터'],
  ]
  return [
    rect(0, 0, W, 80, '#ffffff'),
    rect(0, 79, W, 1, '#e2e8f0'),
    rect(40, 24, 32, 32, '#0f172a', { radius: 6 }),
    text(56, 46, 'M', { size: 18, weight: 700, fill: '#ffffff', anchor: 'middle' }),
    text(84, 47, 'MORO MARKET', { size: 20, weight: 700 }),
    ...items.map(([x, label]) =>
      text(x + 42, 45, label, { size: 15, weight: 500, fill: '#334155', anchor: 'middle' }),
    ),
    text(1280, 45, '장바구니 (2)', { size: 14, fill: '#475569' }),
    text(1370, 45, '로그인', { size: 14, fill: '#475569' }),
  ].join('')
}

function breadcrumb() {
  // bbox 40,100,60×28
  return [
    rect(40, 100, 60, 28, '#f1f5f9', { radius: 4 }),
    text(70, 119, '홈으로', { size: 13, fill: '#475569', anchor: 'middle' }),
  ].join('')
}

function card(x: number, y: number, w: number, h: number, title: string, sub: string) {
  return [
    rect(x, y, w, h, '#ffffff', { stroke: '#e2e8f0', radius: 8 }),
    rect(x + 16, y + 16, 28, 28, '#eef2ff', { radius: 6 }),
    text(x + 16, y + 74, title, { size: 15, weight: 600 }),
    text(x + 16, y + 98, sub, { size: 12, fill: '#64748b' }),
  ].join('')
}

function product(x: number, y: number, name: string, price: string) {
  return [
    rect(x, y, 200, 110, '#ffffff', { stroke: '#e2e8f0', radius: 8 }),
    rect(x + 12, y + 12, 64, 64, '#e2e8f0', { radius: 6 }),
    text(x + 88, y + 36, name, { size: 13, weight: 600 }),
    text(x + 88, y + 60, price, { size: 13, fill: '#4f46e5', weight: 700 }),
  ].join('')
}

function home(menuLabel: string) {
  return [
    header(menuLabel),
    // 배너
    rect(100, 110, 1240, 370, '#e8edfb', { radius: 12 }),
    text(160, 230, 'SUMMER SEASON DROP', { size: 14, weight: 700, fill: '#4f46e5' }),
    text(160, 290, '내추럴 리빙 컬렉션 20% 특별전', { size: 40, weight: 700 }),
    text(160, 336, '자연을 닮은 테이블웨어와 패브릭 소품 모음', { size: 18, fill: '#475569' }),
    rect(900, 150, 380, 290, '#d6dffa', { radius: 12 }),
    // 빠른 메뉴(환불·반품 안내는 bbox 330,520,196×120)
    card(100, 520, 196, 120, '공지사항', '서비스 점검 안내'),
    card(330, 520, 196, 120, '환불 · 반품 안내', '신청 방법과 기한'),
    card(560, 520, 196, 120, '쿠폰 · 혜택', '이번 달 혜택'),
    // 상품
    product(800, 520, '오가닉 린넨 키친웨어', '18,000원'),
    product(1020, 520, '아티장 핸드크래프트 머그', '24,500원'),
    product(800, 650, '소이 왁스 무드 캔들', '19,000원'),
    product(1020, 650, '코튼 라운드 러그', '39,000원'),
    // 주문/배송 이용정보(bbox 100,799,196×196, 화면 아래로 이어진다)
    rect(100, 799, 196, 196, '#ffffff', { stroke: '#e2e8f0', radius: 8 }),
    rect(116, 815, 28, 28, '#eef2ff', { radius: 6 }),
    text(116, 873, '실시간 조회', { size: 13, fill: '#64748b' }),
    text(116, 897, '이용정보 · 주문/배송', { size: 15, weight: 600 }),
  ].join('')
}

function sideMenu(active: string) {
  const rows: [number, string][] = [
    [200, '주문 내역'],
    [240, '환불 신청'],
  ]
  return [
    rect(40, 150, 180, 150, '#ffffff', { stroke: '#e2e8f0', radius: 8 }),
    text(60, 180, '쇼핑 관리', { size: 12, weight: 600, fill: '#64748b' }),
    ...rows.map(([y, label]) =>
      [
        label === active ? rect(40, y, 120, 32, '#eef2ff', { radius: 4 }) : '',
        text(52, y + 21, label, { size: 14, fill: label === active ? '#4f46e5' : '#334155', weight: 500 }),
      ].join(''),
    ),
  ].join('')
}

function mypage(menuLabel: string) {
  return [
    header(menuLabel),
    breadcrumb(),
    sideMenu(''),
    text(260, 175, '마이페이지', { size: 28, weight: 700 }),
    card(260, 205, 280, 130, '배송 중', '2건'),
    card(560, 205, 280, 130, '쿠폰', '3장'),
    card(860, 205, 280, 130, '적립금', '4,200원'),
    rect(260, 365, 880, 220, '#ffffff', { stroke: '#e2e8f0', radius: 8 }),
    text(284, 400, '최근 활동', { size: 16, weight: 600 }),
  ].join('')
}

function orders(menuLabel: string) {
  // 환불 신청 버튼은 bbox 980,320,120×36
  const rows = [300, 400, 500]
  return [
    header(menuLabel),
    breadcrumb(),
    text(40, 190, '주문 내역', { size: 28, weight: 700 }),
    rect(40, 230, 1360, 44, '#f1f5f9', { radius: 8 }),
    text(60, 258, '상품', { size: 13, weight: 600, fill: '#64748b' }),
    text(700, 258, '주문일', { size: 13, weight: 600, fill: '#64748b' }),
    text(860, 258, '상태', { size: 13, weight: 600, fill: '#64748b' }),
    ...rows.map((y, i) =>
      [
        rect(40, y, 1360, 76, '#ffffff', { stroke: '#e2e8f0', radius: 8 }),
        rect(60, y + 12, 52, 52, '#e2e8f0', { radius: 6 }),
        text(128, y + 38, ['오가닉 린넨 키친웨어', '소이 왁스 무드 캔들', '아티장 핸드크래프트 머그'][i], { size: 15, weight: 600 }),
        text(700, y + 42, `2025.02.${20 - i * 3}`, { size: 14, fill: '#475569' }),
        text(860, y + 42, i === 0 ? '배송 완료' : '구매 확정', { size: 14, fill: '#047857' }),
        i === 0
          ? [
              rect(980, y + 20, 120, 36, '#ffffff', { stroke: '#cbd5e1', radius: 4 }),
              text(1040, y + 43, '환불 신청', { size: 14, weight: 600, anchor: 'middle' }),
            ].join('')
          : '',
        rect(1120, y + 20, 120, 36, '#ffffff', { stroke: '#e2e8f0', radius: 4 }),
        text(1180, y + 43, '배송 조회', { size: 14, fill: '#475569', anchor: 'middle' }),
      ].join(''),
    ),
  ].join('')
}

function plain(menuLabel: string, title: string, note: string) {
  return [
    header(menuLabel),
    breadcrumb(),
    text(40, 190, title, { size: 28, weight: 700 }),
    rect(40, 230, 1360, 160, '#ffffff', { stroke: '#e2e8f0', radius: 8 }),
    text(64, 280, note, { size: 15, fill: '#475569' }),
  ].join('')
}

/** 화면별 mock 스크린샷(SVG 문자열). `menuLabel`은 홈 상단 메뉴 라벨(Before `이용정보`, After `주문·환불`) */
export function screenshotSvg(pageKey: PageKey, menuLabel: string): string {
  const body =
    pageKey === 'home'
      ? home(menuLabel)
      : pageKey === 'mypage'
        ? mypage(menuLabel)
        : pageKey === 'orders'
          ? orders(menuLabel)
          : pageKey === 'support'
            ? plain(menuLabel, '고객센터', '자주 묻는 질문과 문의 안내')
            : plain(menuLabel, '환불 / 반품 신청', '환불할 주문과 사유를 선택해 주세요')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}"><rect width="${W}" height="${H}" fill="#f8fafc"/>${body}</svg>`
}
