import type { Site } from '../../domain/types.ts'

/** 붙여 넣은 링크의 도메인. `https://`를 빼고 붙여 넣어도 읽는다. 링크가 아니면 `null` */
export function linkHost(link: string): string | null {
  const text = link.trim()
  if (!text) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.hostname.toLowerCase().replace(/\.$/, '') || null
  } catch {
    return null
  }
}

/** 링크 도메인이 `allowedHosts`에 있는 등록 사이트. 실행 요청은 이 사이트의 `siteId`로만 보낸다 */
export function findSiteByLink(sites: Site[], link: string): Site | null {
  const host = linkHost(link)
  if (!host) return null
  return sites.find((site) => site.allowedHosts.includes(host)) ?? null
}
