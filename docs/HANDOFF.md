# OneiRoam — Agent Handoff

給接手的 AI agent / 開發者的現況與下一步。最後更新：2026-06-22。

## 這是什麼

OneiRoam 夢遊 = 獨立設計女裝**預購**電商。純靜態前台 + Supabase 後台。

- **線上站**：https://www.oneiroam.com （Cloudflare 部署，repo `p88chome/OneiRoam-`）
- **後台**：https://www.oneiroam.com/admin.html （Supabase Auth 登入）
- **預售窗口**：2026-06-23 ~ 06-30，8 月出貨。訂金一半、其餘貨到付款。

## 技術棧

- 前台：vanilla HTML/CSS/JS（無框架、無 build 相依）。嚴格 CSP。
- 訂單：web3forms 寄信（`order.js`）。
- 後台 + 資料：**Supabase**（PostgreSQL + Auth + Storage）。專案 ref `ywzsjhaqgidgxnjmyyeg`。
- 部署：Cloudflare。商品走 **build-time**（`scripts/build-products.mjs` 讀 Supabase → 注入 `index.html` 的 `<!-- BUILD:PRODUCTS:START/END -->` 之間）。
- 測試：`node --test tests/`（純函式：`cart.js` 定價、`render-products.mjs`、`dashboard-stats.js`）。

## 機密在哪

- `.env`（**gitignored**）：`SUPABASE_URL`（純網域，**勿加 /rest/v1/**）、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_KEY`、`CLOUDFLARE_DEPLOY_HOOK_URL`。
- `admin.config.js`（**committed**，僅 anon key，公開安全）。service key 只進 `.env` + Cloudflare 環境變數。

## 已完成（Phase 1 + Dashboard）

- Supabase schema/RLS/seed：`supabase/migrations/0001_init.sql`、`supabase/seed.sql`。
- 商品資料驅動化 + build 腳本（已驗冪等）。
- 後台：登入、**總覽 Dashboard**（`dashboard-stats.js`）、商品 CRUD、圖片上傳、發布鈕。

## 待辦（owner/dashboard 手動，非寫碼）

- [ ] Supabase 建 `product-images` public bucket + policies（圖片上傳需要）。
- [ ] Cloudflare：Build command `node scripts/build-products.mjs` + 環境變數 SUPABASE_URL/SERVICE_KEY + 建 Deploy Hook → 填進 Supabase `settings.deploy_hook_url`（發布鈕與前台切換 Supabase 來源需要）。
- [ ] **關閉 Supabase 自由註冊**（RLS 寫入 = 任何登入者）。
- [ ] 填收款 `settings.bank_holder`（戶名）。

## 下一步（規劃中，spec 在本機 `docs/superpowers/specs/`，**gitignored**）

- **Phase 2**：訂單寫入 Supabase（`place_order` RPC，送單原子扣庫存）+ 後台訂單管理（即時）。
- **Phase 3**：組合價 + 設定（銀行/窗口/訂金）後台化。
- **Phase 4**：流量數據嵌入 Dashboard（Cloudflare GraphQL Analytics API + proxy）。

> 注意：`docs/superpowers/` 的 spec/plan 與 `~/.claude` 的記憶都是**本機限定**。換機器接手請先在本機補做設計（或把該設計重點貼給 agent）。

## 慣例 / 踩過的雷

- 工作流：superpowers `brainstorming → writing-plans → subagent-driven-development`。改碼前先 spec。
- 寫前台/admin 渲染 DB 值務必過 `esc()`（防 XSS）。
- **`admin.config.js` 一定要 commit**，否則部署後 `window.SUPABASE_URL` 為空、後台開機橫幅報錯。
- CSS 的 `display` 會蓋掉 `[hidden]` 屬性 → admin.css 有 `[hidden]{display:none!important}` 修正，勿移除。
- 改商品後要按後台「發布」才會更新前台（build-time 快照）；訂單/後台操作則即時。
