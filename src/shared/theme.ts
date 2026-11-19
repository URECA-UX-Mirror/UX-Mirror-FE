import { useEffect, useState } from 'react'

/** 화면 테마. 고르지 않았으면 기기 설정(`prefers-color-scheme`)을 따른다 */
export type Theme = 'light' | 'dark'

/** `index.html`의 첫 그리기 전 스크립트와 같은 키 */
export const THEME_KEY = 'um.theme'

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 지금 테마와 바꾸기. 고른 값은 `<html data-theme>`과 localStorage에 남긴다 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [chosen, setChosen] = useState<Theme | null>(storedTheme)
  const theme = chosen ?? systemTheme()

  useEffect(() => {
    if (chosen) document.documentElement.dataset.theme = chosen
    else delete document.documentElement.dataset.theme
  }, [chosen])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setChosen(next)
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // 저장하지 못해도 이번 화면에서는 바뀐다
    }
  }

  return { theme, toggle }
}
