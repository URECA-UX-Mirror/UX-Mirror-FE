// 프로토콜 상대 주소, 역슬래시, 제어 문자는 브라우저가 외부 주소로 해석할 수 있다.
export function internalPath(path: string | null): path is string {
  return path !== null && /^\/(?!\/)[^\\\s]*$/.test(path)
}
