# PAYUNi 金流上線 Handoff 清單

分支：`feat/payuni-payment`
狀態：程式碼完成、38/38 單元測試綠、逐任務審 + 全分支審（含 2 個 payment 併發洞已修）。
範圍：全程 **PAYUNi sandbox 測試環境**，尚未接正式金流。

設計 / 計畫（local-only，gitignored）：
`docs/superpowers/specs/2026-07-04-payuni-payment-design.md`、`docs/superpowers/plans/2026-07-04-payuni-payment.md`

---

## 部署端待辦（依序）

### 1. 套用資料庫 migration
- Supabase SQL Editor 貼上執行 `supabase/migrations/0002_orders.sql`
- 驗證：`orders` 表有 `gateway_trade_no` 欄；`decrement_stock` 函式存在
- 若先前已套用過舊版（含 `ecpay_trade_no`）：需 `alter table orders rename column ecpay_trade_no to gateway_trade_no;` 並重跑函式（已含 `set search_path = public`）

### 2. 取得 PAYUNi sandbox 金鑰
- PAYUNi 後台開測試商店，取 `MerID` / `HashKey`（32 碼）/ `HashIV`（16 碼）
- 同時確認 UPP 介接的 **`Version`** 欄位值（對照 PAYUNi 文件；目前預設 `2.0`）

### 3. 部署 Edge Functions + 設定 secrets
```bash
supabase functions deploy create-order
supabase functions deploy payuni-notify --no-verify-jwt   # PAYUNi 無法帶 JWT，必須關閉驗證
supabase secrets set \
  PAYUNI_ENV=sandbox \
  PAYUNI_MER_ID=<sandbox 商店代號> \
  PAYUNI_HASH_KEY=<sandbox HashKey> \
  PAYUNI_HASH_IV=<sandbox HashIV> \
  PAYUNI_VERSION=2.0 \
  SITE_URL=https://www.oneiroam.com \
  WEB3FORMS_KEY=<通知用，可選>
# SUPABASE_URL / SUPABASE_SERVICE_KEY 由平台自動注入
```
> 密鑰只進 Edge Function secret，**絕不進 git / 前端**。

### 4. 前台設定 + 部署
- 確認 `admin.config.js` 已設 `window.SUPABASE_URL` / `window.SUPABASE_ANON_KEY`（`order.html` 現已引入此檔）
- Cloudflare 重新部署（含新的 `order.html` / `order.js` / `order-result.html`）
- 確認 order 頁 CSP 放行：`connect-src` 含 `https://*.supabase.co`、`form-action` 含 PAYUNi 網域（已在 `order.html`）

### 5. Sandbox 端到端測試 + 校準（重要）
1. 開 `order.html` → 加商品 → 選訂金/全額 → 送出 → 應跳 `sandbox-api.payuni.com.tw` 收銀台
2. 用 PAYUNi sandbox 測試付款方式完成付款
3. **校準 `payuni-notify` 的 `isPaid` / `isFailed`**：目前為初步判斷
   `inner.Status === 'SUCCESS' && inner.TradeStatus === '1'`（成功）、`inner.Status` 存在且非 SUCCESS（失敗）。
   以 PAYUNi 實際 notify 解密後的欄位名/值校正（檔內已標 `// calibrate against sandbox (Task 7)`），改後重部署 `payuni-notify`。
4. 驗證 DB：`orders.payment_status='paid'`、`gateway_trade_no` 有值、`paid_at` 有值、對應 `product_variants.stock` 減少一次
5. **冪等驗證**：重送同一 notify（模擬 PAYUNi 重試）→ 不得二次扣庫存、不得重複標記

### 6. 正式上線（待老闆申請正式商店後）
- 換 `PAYUNI_ENV=prod` + 正式 `MerID` / `HashKey` / `HashIV`
- 重跑一次真實小額交易驗證

### ⚠️ 測試期暫時改動 — 上線前必還原
- `order.js` `PREORDER_END` 測試期改為 `2026-12-31`（原為 `2026-06-30`）→ 上線前設回真實預售窗
- `payuni-notify/index.ts` 有一行 `console.log('PAYUNi notify DIAG inner=' ...)` 診斷 log → 校準完 `isPaid/isFailed` 後移除並重部署

---

## 已知限制 / 後續 follow-up（非阻擋上線）
- **create-order 公開可呼叫**（前台用 anon key）：任何人可灌 `pending` 單 / 探庫存（不扣庫存、有商品/尺寸/庫存驗證）。日後加 pending 單 TTL 清理或後台過濾。
- **notify orchestration 尚無單元測試**：crypto 層已 KAT 覆蓋；建議 sandbox 校準後補一組 notify 決策/認領/冪等/缺貨測試。
- **`inner.TradeAmt` 未與 `orders.pay_amount` 交叉核對**：目前信任已驗證的 notify；可加金額比對做 defense-in-depth。
- **`order_items.variant_id` 未填**：`decrement_stock` 以 `(product_id, size)` 配對扣庫存（此組合唯一）；日後可改用 variant_id 更穩。

---

## 安全重點（已實作，勿回退）
- 金額**伺服器重算**，不信前端價格。
- notify **先驗 HashInfo（timing-safe）+ AES-GCM 解密**才信任，且狀態決策**只讀已驗證的內層** payload（不用未驗證的外層 `Status`）。
- 標付款 + 扣庫存採**原子認領**（`update ... where payment_status='pending'`）→ 保證每單至多扣一次庫存，重試/併發冪等。
- 前台移除 `pay_last5`（匯款末五碼）與 web3forms 金鑰；通知改由 notify 伺服器端寄。
