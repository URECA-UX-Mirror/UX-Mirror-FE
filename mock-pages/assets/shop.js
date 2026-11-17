// 버전(?v=before|after)에 따라 홈 상단 메뉴 라벨만 바꾼다. 나머지 화면은 두 버전이 같다.
// Before `이용정보` / After `주문·환불` (mock 시나리오와 같은 규칙).
const version = new URLSearchParams(location.search).get('v') === 'after' ? 'after' : 'before'
const label = version === 'after' ? '주문·환불' : '이용정보'
document.querySelectorAll('[data-menu-orders]').forEach((el) => {
  el.textContent = label
})
// 페이지 사이를 이동해도 버전을 유지한다.
document.querySelectorAll('a[href$=".html"]').forEach((a) => {
  a.setAttribute('href', `${a.getAttribute('href')}?v=${version}`)
})
document.documentElement.dataset.version = version
