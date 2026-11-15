/* 홈 화면 설치 프롬프트 보관 */
let prompt = null;

export function setInstallPrompt(p) { prompt = p; }
export function getInstallPrompt() { return prompt; }
export function clearInstallPrompt() { prompt = null; }
