# 資安強化交接（OWASP Top 10 稽核，2026-11-09）

> 給下一個 agent：本文件 = 已完成 + 待部署 + 待辦。待辦依優先序排，每項附檔案與做法。

## 0. 部署（尚未執行，必須照順序）

1. **先**在 Supabase SQL Editor 依序執行（先確認哪些已跑過）：
   - `0008_atomic_discount_claim.sql`、`0009_lock_definer_rpcs.sql`（Willy 10/28 commit `ff81c66`，可能已部署）
   - `0010_hide_hidden_products.sql`（本次新增）
2. **再**重部署 Edge Functions：`create-order`、`payuni-notify`
   - 順序反過來 → create-order 呼叫不存在的 `claim_discount_code` RPC，帶折扣碼的訂單全部 500
3. 前端（`_headers`、`.assetsignore`、JS）隨 Cloudflare Workers Builds 自動上線
4. 部署後驗證：
   - `curl -I https://<staging>/` 應有 `X-Frame-Options: DENY`、`Strict-Transport-Security`
   - `curl -I https://<staging>/admin-preview.html` 應為 `SAMEORIGIN`；後台視覺編輯器 iframe 仍能載入
   - 用 anon key 呼叫 `POST /rest/v1/rpc/decrement_stock` 應回 permission denied
   - 帶折扣碼走一次 sandbox 下單 + 付款，確認 used_count +1、訂單轉 paid

## 1. 已完成

標 ★ 的是 Willy 在 `ff81c66` 已做的（0008 折扣碼原子認領、0009 revoke RPC、移除 notify DIAG log），其餘為本次。

| OWASP | 問題 | 修法 | 檔案 |
|---|---|---|---|
| A01 | ★ `decrement_stock` 為 SECURITY DEFINER 且未 revoke，任何人可 rpc 反覆扣庫存到 0 | revoke，僅 service_role | `migrations/0009` |
| A01 | hidden 商品對外可讀、可下單 | RLS 改 `status <> 'hidden'`；create-order 只收 `preorder`/`active` | `migrations/0010`、`create-order` |
| A04 | 重複送同款同尺寸繞過 max_qty / 庫存 | 先依 (id,size) 合併再檢查；品項上限 50 | `create-order` |
| A04 | ★ 折扣碼 max_uses 可併發超用 | 原子 `claim_discount_code` RPC；下單失敗 `release_discount_code` | `migrations/0008`、`create-order` |
| A04/A05 | 客人欄位無型別/長度限制；DB 錯誤訊息原樣回傳 | 字串化 + 長度上限 + email 格式；通用錯誤訊息，細節進 log | `create-order` |
| A08 | notify 未核對金額 / MerID | 不符 → 不標 paid，設 `needs_review` | `payuni-notify` |
| A09 | ★ notify 記錄完整解密付款資料 | DIAG log 移除 | `payuni-notify` |
| A05 | 無 HTTP 安全標頭（meta CSP 的 frame-ancestors 無效 → 可點擊劫持） | 新增 `_headers` | `_headers` |
| A05 | `.assetsignore` 漏 `.env.*`、`.agents` 等 | 補上 | `.assetsignore` |
| A03 | 可上傳 SVG 到公開 bucket；副檔名信任檔名 | MIME 白名單 jpg/png/webp/avif | `admin-data.js`、`admin.js`、`visual-editor.js` |
| A03 | localStorage 購物車未正規化即進 innerHTML | 讀取時強制型別 + 測試 | `cart.js`、`tests/cart.test.js` |
| A03 | 新商品 ID 無格式限制（會變成檔名） | 新建限 `^[a-z0-9-]{1,64}$`；build 跳過含路徑字元的 id | `admin.js`、`scripts/build-products.mjs` |
| — | 小項 | `preview-harness.mjs` 錯誤改 textContent；`admin.js` max_uses 加 esc | |

稽核確認沒問題（不用再查）：RLS 全表啟用、`is_admin()` 用 app_metadata（使用者無法自升 admin）、會員只能讀自己訂單、create-order 價格全伺服器重算、notify 有 constant-time 驗簽 + 原子 pending→paid 冪等、trigger-deploy 伺服器端驗 admin、ReturnURL 白名單、postMessage 有驗 origin、所有 innerHTML 都有 esc、git 歷史無外洩金鑰（只有公開的 anon key）。

## 2. 待辦（依優先序）

### P1 — Storage bucket 權限（需進 Supabase Dashboard）
- `product-images` bucket 的 policy 不在 migration 內，無法從 repo 驗證
- 確認 `storage.objects` 的 insert/update/delete 只允許 `public.is_admin()`；舊的「authenticated 可寫」policy 若還在 → 任何 Google 註冊者可覆蓋商品/首圖
- 確認後把 policy 寫進新 migration（`0009_storage_policies.sql`）納入版控

### P1 — Turnstile 正式啟用（2026-11-09 前端已接好，待填 key）
- ✅ `order.js` 依 `admin.config.js` 的 `TURNSTILE_SITE_KEY` 動態載入 widget；CSP 已加 `challenges.cloudflare.com`。空字串 = 不顯示
- 剩：Cloudflare 建 widget → 填 site key → `supabase secrets set TURNSTILE_SECRET_KEY=...`
- `create-order` 只在有 `TURNSTILE_SECRET_KEY` 時才驗證；沒設 = 可無限刷單、暴力猜折扣碼
- 申請 site key → 前端 `order.html`/`order.js` 加 widget（CSP 需加 `https://challenges.cloudflare.com` 到 script-src / frame-src）→ 設 secret

### P2 — 折扣碼改「付款後」才計用量 ✅ 2026-11-09（migration 0011）
- create-order 只驗證；payuni-notify 在 pending→paid 時 `count_discount_use`，超量 → `needs_review`
- `orders.discount_counted` 預設 true，舊訂單（下單時已 +1）不重複計
- 現在下單（pending）就 +1 → 有人可以不付款把限量碼耗盡
- 做法：create-order 只驗證不扣；payuni-notify 認領 paid 時呼叫 `claim_discount_code`，失敗則 `needs_review`。或保留預扣，訂單轉 failed / 逾時未付時 `release_discount_code`（需排程）

### P2 — CSP inline style 造成的功能 bug ✅ 2026-11-09
- 初始隱藏改 `data-hide`（cart.js 載入後轉 style.display）；hero 焦點改 `data-focus`；order-result 容器改 class
- 剩：order/member 頁 vendor/supabase.js 與 Turnstile 自帶的 inline style 仍會被擋（不影響功能）
公開頁 CSP `style-src 'self'` 擋掉所有 `style=""` 屬性：
- 首圖焦點 `object-position`（`preview-render.mjs:25` 產生到 `index.html`）在正式站無效
- `order-result.html:12` `orderNoLine` 的 `display:none` 無效 → 永遠顯示空的「訂單編號：」
- 其他初始 `display:none`：`index.html`、`member.html`、`order.html`、`order-result.html`、`scripts/product-pages.mjs:114`
- 做法：改成 class（如 `.is-hidden`、`.hero-focus-N`）或由 JS 設定

### P3 — 其他強化
- `settings` 公開讀取是 denylist（`0004:58`）→ 改 allowlist，避免日後新增的機密 key 預設公開
- notify 驗簽失敗、trigger-deploy 401/403 加結構化 log（含 `cf-connecting-ip`）；`needs_review` 時寄 Web3Forms 通知店主
- `payuni-notify`：訂單已 `failed` 後客人重付成功會被忽略 → 考慮允許 failed→paid 或標 `needs_review`
- `isPaid`/`isFailed` 尚未 sandbox 校準（DIAG log 已移除；校準時暫時加回只記狀態欄位的 log）
- 後台帳號開 MFA；檢查 Supabase Auth rate limit
- 完整 CSP 從 `<meta>` 搬到 `_headers`（需逐頁測）；`robots.txt` 的 `Disallow: /admin.html` 可移除（已有 noindex header）
- Edge Functions `jsr:@supabase/supabase-js@2` 改鎖小版本
- 長期：`assets.directory` 改指向 build 輸出目錄（allowlist），取代 `.assetsignore` denylist

### 注意
- `data/storefront.json`（公開）含銀行帳號 — 目前判定為刻意公開（匯款用），若不是要移除
- 開發機環境變數 `NODE_TLS_REJECT_UNAUTHORIZED=0` 會關掉 Node 的 TLS 驗證，非刻意請移除
