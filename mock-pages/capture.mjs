// 목업 쇼핑몰(`mock-pages/*.html`)을 1440×900 PNG로 찍어 `public/mock/screens/{variant}/{pageKey}.png`에 저장한다.
// mock 모드의 스크린샷 API가 이 PNG를 돌려준다. 찍은 뒤 `scenario.ts`의 후보 bbox와
// 페이지 안 `data-key` 요소의 위치를 비교하고(기대하는 요소가 없어도), 어긋나면 실패한다(디자인을 바꾸면 한쪽을 맞춰야 한다).
//
// 사용: npm run mock:shots   (Chrome 또는 Edge가 필요하다. 경로는 CHROME_PATH로도 지정할 수 있다)

import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import { stepSpecs } from '../src/mocks/fixtures/scenario.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = join(root, 'public', 'mock', 'screens')
const VIEWPORT = { width: 1440, height: 900 }
const PAGES = ['home', 'mypage', 'orders', 'support', 'refund']
const VARIANTS = ['before', 'after']

// 시나리오의 semanticKey를 페이지 안 요소(`data-key`)와 이어 준다.
const KEYS = {
  home: {
    '상단 메뉴>/shop/orders#1': 'top.orders',
    '상단 메뉴>/shop/mypage#1': 'top.mypage',
    '상단 메뉴>/shop/support#1': 'top.support',
    '본문>/shop/orders#1': 'body.orders',
    '본문>/shop/support#1': 'body.refund-guide',
  },
  mypage: {
    '사이드 메뉴>/shop/refund#1': 'side.refund',
    '사이드 메뉴>/shop/orders#1': 'side.orders',
    '경로 표시>/shop/home#1': 'crumb.home',
  },
  orders: {
    '본문>/shop/refund#1': 'body.refund',
    '상단 메뉴>/shop/mypage#1': 'top.mypage',
    '경로 표시>/shop/home#1': 'crumb.home',
  },
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  const found = candidates.find((path) => existsSync(path))
  if (!found) throw new Error('Chrome/Edge를 찾지 못했습니다. CHROME_PATH에 실행 파일 경로를 지정하세요.')
  return found
}

// 시나리오 후보 bbox를 페이지 단위로 모은다(같은 페이지의 값은 시나리오 전체에서 같다).
const expected = {}
for (const scenario of ['before', 'after', 'direct', 'goback']) {
  for (const spec of stepSpecs(scenario)) {
    for (const candidate of spec.choices.candidates) {
      const key = KEYS[spec.pageKey]?.[candidate.semanticKey]
      if (key) expected[`${spec.pageKey}:${key}`] = candidate.bbox
    }
  }
}

const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true })
let mismatches = 0
try {
  const page = await browser.newPage()
  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 })
  for (const variant of VARIANTS) {
    await mkdir(join(outDir, variant), { recursive: true })
    for (const pageKey of PAGES) {
      const url = `${pathToFileURL(join(here, `${pageKey}.html`)).href}?v=${variant}`
      await page.goto(url, { waitUntil: 'networkidle0' })
      await page.evaluate(() => document.fonts.ready)

      // bbox 검증(홈 상단 메뉴 라벨이 버전마다 다르므로 variant마다 확인한다)
      const boxes = await page.$$eval('[data-key]', (nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect()
          return {
            key: node.getAttribute('data-key'),
            x: Math.round(r.x),
            y: Math.round(r.y + window.scrollY),
            width: Math.round(r.width),
            height: Math.round(r.height),
          }
        }),
      )
      // 역방향: 시나리오가 기대하는 후보 요소가 페이지에 모두 있어야 한다(요소가 사라지면 위 비교는 놓친다)
      for (const id of Object.keys(expected)) {
        const [expectedPage, key] = id.split(':')
        if (expectedPage === pageKey && !boxes.some((box) => box.key === key)) {
          mismatches += 1
          console.error(`[후보 누락] ${pageKey}/${key}: 시나리오에는 있지만 페이지에 data-key 요소가 없습니다`)
        }
      }
      for (const box of boxes) {
        const want = expected[`${pageKey}:${box.key}`]
        if (!want) continue
        const diff = ['x', 'y', 'width', 'height'].filter((k) => Math.abs(box[k] - want[k]) > 1)
        if (diff.length > 0) {
          mismatches += 1
          console.error(
            `[bbox 불일치] ${pageKey}/${box.key}: 페이지 ${JSON.stringify({ x: box.x, y: box.y, width: box.width, height: box.height })} / 시나리오 ${JSON.stringify(want)}`,
          )
        }
      }

      const file = join(outDir, variant, `${pageKey}.png`)
      await page.screenshot({ path: file, type: 'png' })
      console.log(`저장: public/mock/screens/${variant}/${pageKey}.png`)
    }
  }
} finally {
  await browser.close()
}
if (mismatches > 0) {
  console.error(`\n후보 bbox가 어긋난 요소가 ${mismatches}개 있습니다. 페이지 레이아웃이나 scenario.ts를 맞춰 주세요.`)
  process.exit(1)
}
console.log('\n모든 후보 bbox가 시나리오와 일치합니다.')
