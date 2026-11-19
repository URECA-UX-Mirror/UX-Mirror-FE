import { expect, it } from 'vitest'
import { toSiteList } from '../src/adapters/site.ts'
import { findSiteByLink, linkHost } from '../src/features/scenario/siteLink.ts'
import { SITES } from '../src/mocks/fixtures/sites.ts'

const sites = toSiteList({ items: SITES })

it.each([
  ['https://ecudemo360127.cafe24.com', 'ecudemo360127.cafe24.com'],
  ['http://ecudemo360127.cafe24.com/product/list.html?cate=1#top', 'ecudemo360127.cafe24.com'],
  ['ecudemo360127.cafe24.com/board', 'ecudemo360127.cafe24.com'],
  ['  HTTPS://EcuDemo360127.CAFE24.com.  ', 'ecudemo360127.cafe24.com'],
  ['https://shop.example.com:8443/a', 'shop.example.com'],
])('linkHost(%s) = %s', (link, host) => {
  expect(linkHost(link)).toBe(host)
})

it.each(['', '   ', 'ftp://ecudemo360127.cafe24.com', 'javascript:alert(1)', 'http://', '링크 아님 입니다'])(
  'linkHost(%s)는 링크가 아니라 null',
  (link) => {
    expect(linkHost(link)).toBeNull()
  },
)

it('allowedHosts에 있는 도메인이면 그 사이트를, 없으면 null을 준다', () => {
  expect(findSiteByLink(sites, 'https://ecudemo360127.cafe24.com/order/basket.html')?.siteId).toBe('cafe24-ons')
  expect(findSiteByLink(sites, 'nomap.example.com')?.siteId).toBe('demo-no-map')
  expect(findSiteByLink(sites, 'https://unknown.example.com')).toBeNull()
  expect(findSiteByLink(sites, 'not a link')).toBeNull()
  expect(findSiteByLink([], 'https://ecudemo360127.cafe24.com')).toBeNull()
})

it('하위 도메인이나 비슷한 도메인은 같은 사이트로 보지 않는다', () => {
  expect(findSiteByLink(sites, 'https://www.ecudemo360127.cafe24.com')).toBeNull()
  expect(findSiteByLink(sites, 'https://ecudemo360127.cafe24.com.evil.com')).toBeNull()
  expect(findSiteByLink(sites, 'https://evil.com/?u=ecudemo360127.cafe24.com')).toBeNull()
})

it('adapter는 allowedHosts를 소문자로 맞추고, 없으면 빈 목록과 siteUrl null로 둔다', () => {
  const [site] = toSiteList({ items: [{ ...SITES[0], allowedHosts: ['EcuDemo360127.Cafe24.com'] }] })
  expect(findSiteByLink([site], 'https://ecudemo360127.cafe24.com')?.siteId).toBe('cafe24-ons')
  const { siteUrl: _url, allowedHosts: _hosts, ...legacy } = SITES[0]
  const [old] = toSiteList({ items: [legacy] })
  expect(old.allowedHosts).toEqual([])
  expect(old.siteUrl).toBeNull()
  expect(findSiteByLink([old], 'https://ecudemo360127.cafe24.com')).toBeNull()
})
