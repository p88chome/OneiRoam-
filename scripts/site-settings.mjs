// 站點設定渲染已抽到 repo 根 preview-render.mjs（後台視覺預覽需可被瀏覽器 import；
// scripts/ 在 .assetsignore 內不會被 CDN 服務）。此處 re-export 維持既有 import 路徑與測試。
export {
  THEMES, esc, heroImgsHtml, announceHtml, eyebrowHtml, heroDescHtml,
  bilingualText, applyTheme,
} from '../preview-render.mjs';
