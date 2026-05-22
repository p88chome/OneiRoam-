# OneiRoam — Feature Backlog

## Project Context

Static single-page fashion brand site: https://dainty-pie-1c4b12.netlify.app (正式)  
Stack: HTML5 + CSS3 + Vanilla JS. No backend. No framework.  
Order flow: browse → LINE message → confirm → bank transfer.  
Target: Taiwanese independent women's fashion brand, bilingual (zh-TW / en).

---

## 環境架構

| Branch | URL | 用途 |
|--------|-----|------|
| `main` | https://dainty-pie-1c4b12.netlify.app | 正式站，客人看到的 |
| `staging` | https://staging--dainty-pie-1c4b12.netlify.app | 測試站，QC 用 |
| `feat/*` | Netlify PR preview URL（自動生成） | 單功能開發測試 |

**工作流：** `feat/*` → PR → merge `staging` → 確認OK → merge `main`

---

## 商品價格 & 庫存狀態（已完成 2026-05-22）

### 現行價格
| 商品 | 價格 |
|------|------|
| 所有衣物（洋裝、上衣、套裝） | NT$ 1,690 |
| 所有包款 | NT$ 690 |

### 修改方式

**改價格** — 直接在 `index.html` 找到對應商品的 `.product-price`：
```html
<span class="product-price">NT$ 1,690</span>
```

**改庫存狀態** — 換 class 和文字：
```html
<!-- 預購中 -->
<span class="product-status status-preorder" data-zh="預購中" data-en="Pre-order">預購中</span>

<!-- 現貨 -->
<span class="product-status status-instock" data-zh="現貨" data-en="In Stock">現貨</span>

<!-- 售完 -->
<span class="product-status status-soldout" data-zh="售完" data-en="Sold Out">售完</span>
```

**標記售完商品** — 在 `product-card` div 加 `is-sold-out` class：
```html
<div class="product-card is-sold-out" data-category="...">
```
效果：圖片變灰、查看詳情按鈕消失、價格加刪除線。

### 未來後台（待實作）
當老闆想用 UI 改而不碰 code → 裝 **Netlify CMS（Decap CMS）**：
- 免費，已在 Netlify 上，不需後端
- 安裝後有 `/admin` 頁面，瀏覽器直接改 → 自動 commit → 自動 deploy
- 等功能穩定後再裝，目前手動改 HTML 即可

---

## Security (已完成 2026-05-22)

- [x] 移除所有 `onerror` inline event handlers → 改用 JS addEventListener
- [x] 加 Content-Security-Policy meta tag
- [x] 修 `querySelector` href 驗證（防 CSS selector injection）
- [x] 集中式 img error fallback handler

殘留（GitHub Pages 無法設 HTTP header，已移至 Netlify 待處理）:
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security (HSTS)

---

## Brand Features — Backlog

### A. 商品資訊強化
**痛點：** 客人找不到完整資訊，要額外 LINE 詢問基本問題
- [x] 價格顯示
- [x] 庫存狀態標籤（現貨 / 預購 / 售完）
- [ ] 尺寸表 modal（每個商品可展開尺寸對照）
- [ ] 商品圖片多張輪播（現在每件只有一張圖）
- [ ] 材質說明區塊（蕾絲、歐根紗、手染細節）

### B. 回頭客經營
**痛點：** 沒有機制讓客人知道新品上架
- [ ] Email 訂閱表單（用 Mailchimp / Resend 免費方案，不需後端）
- [ ] 新品上架通知（串 Mailchimp 發信）
- [ ] LINE 官方帳號群發（已有 LINE ID，可直接用）

### C. SEO / 流量
**痛點：** 靠 Instagram 導流，有斷流風險
- [ ] 結構化資料 (Schema.org Product markup) — 讓 Google 顯示商品卡
- [ ] sitemap.xml
- [ ] robots.txt
- [ ] 穿搭部落格 / 品牌故事文章頁（獨立 HTML 頁面）
- [ ] Google Analytics 或 Umami（隱私友善）流量追蹤
- [ ] 圖片 alt text 優化（現在部分空白）

### D. 訂購流程簡化
**痛點：** 現在流程需要跳出網站到 LINE，摩擦高
- [ ] 站內訂購表單（姓名、商品、尺寸、聯絡方式）→ 送出後自動發 email 通知賣家
  - 免費方案：Formspree / Web3Forms（不需後端）
- [ ] 自動回覆訊息樣板（LINE 官方帳號設定，不需工程）
- [ ] 購物車（複雜，需 JS state 管理，低優先）

### E. 視覺 / UX 升級
- [ ] Lookbook 加燈箱（點圖放大）
- [ ] 頁面載入骨架屏（skeleton screen）取代 loading spinner
- [ ] 深色模式

---

## 金流（暫緩）

**結論：** 現在月營業額小，維持匯款最省。

| 時機 | 行動 |
|------|------|
| 月營業額 > NT$30,000 穩定 | 辦行號 + 申請綠界 ECPay（信用卡 2.75%/筆）|
| 有外國客戶 | 加 Stripe（2.9% + $0.30 USD + 1.5% 換匯）|

金流開發需要 staging URL 作為 webhook endpoint（本機 localhost 無法用）。
Netlify staging branch 已備妥，時機到直接串。

---

## 優先順序

1. **立即可做（低成本高效益）**
   - [x] 商品價格 + 庫存狀態
   - [ ] 訂購表單（Formspree，不需後端）
   - [ ] Google Analytics
   - [ ] sitemap.xml + robots.txt

2. **短期（1-2週）**
   - [ ] 商品多圖輪播
   - [ ] Email 訂閱（Mailchimp 免費）
   - [ ] Schema.org Product markup

3. **長期（有流量再做）**
   - [ ] 部落格
   - [ ] 金流 + 購物車
   - [ ] Netlify CMS 後台
