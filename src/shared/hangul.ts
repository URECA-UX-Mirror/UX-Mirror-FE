/** 한글이 들어 있는지. 서버 문구가 사용자에게 보여 줄 한국어 문장인지 가릴 때 쓴다(영어 예외 문구·코드는 보이지 않는다) */
export const hasHangul = (text: string | null | undefined): boolean => !!text && /[가-힣]/.test(text)
