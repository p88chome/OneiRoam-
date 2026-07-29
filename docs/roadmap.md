# OneiRoam 待做方向（roadmap）

> 2026-07-13 整理。標記：〔工程〕要寫程式／〔老闆〕內容或後台操作／〔設定〕Dashboard 手動設定。
> 資安審查（2026-07-12）結論 ship-ready；上線擋路的只剩本清單第一層。
>
> **開發注意（2026-07-14 發現）**：前台頁面 CSP 的 `style-src` 沒開 `unsafe-inline`，
> HTML 原始碼寫死的 `style="display:none"` 之類行內樣式會被瀏覽器**靜默忽略**（不是保護、是失效）。
> 舊有的 modal/cartEmpty/preorderGate 等靠 JS 在載入時重設一次 `.style.display=` 而「意外沒事」；
> 新頁面若沒有這層 JS 重設就會整個露餡（product.js 就踩到過，已修）。
> **往後新增隱藏元素一律用 CSS class（`.js-hidden`），不要用行內 `style=`。**

## 第一層：上線前必做

- [ ] **整疊分支 merge 回 main**〔工程〕：目前 `main` 停在超早期版本，整合內容都在 `feat/member-zone`。
      Merge 後確認 Cloudflare 正式站建置綁定的分支＋deploy hook 建的是 main——不然後台「發布到網站」會建出舊站。
- [ ] **執行上線手冊**〔設定〕：`docs/google-login-setup.md` 全部步驟，嚴格照順序
      （SQL 0003/0004/0005 → admin role → 重佈 trigger-deploy／create-order → Storage 權限 → Google OAuth → Redirect URLs 含 member.html → 開註冊 → 驗收清單）。
- [ ] **PAYUNi 收尾**〔工程＋設定〕：sandbox 校準 `isPaid`/`isFailed`、移除 payuni-notify 的 DIAG log、
      `order.js` 預購結束日改回真實日期（現在是測試用 2026-12-31）、上線時換正式商店 MerID/金鑰。
- [ ] **內容補齊**〔老闆〕：4 個沒照片的商品（花嫁之夢、夢雲網紗上衣×2、蕾絲花圃套裝）補上傳照片或狀態改「隱藏」；
      選品商品上架（分類選「選品・上衣／下著／配件」）；穿搭日記 6 張照片（有了就把 index.html `#lookbook` 的 `hidden` 拿掉）；
      銀行戶名補進 settings。
- [ ] **上傳新 banner**〔老闆〕：下載資料夾有四張（桌機橫式＋手機直式，各有無字／帶字版）；
      無字版上傳後台「網站設定」，帶字版做 IG／LINE 宣傳。

## 第二層：上線後馬上做（體驗差很多）

- [ ] **訂單確認信**〔工程，卡在需要 Resend API key〕：付款成功自動寄 Email 給客人（訂單明細＋匯款/出貨說明），
      老闆同時收「新訂單」通知。程式碼待 Resend 帳號＋API key 到位後接上（payuni-notify 標 paid 時觸發）。
      （現在表單寫「收訂單確認信」但實際沒有寄任何信。）
- [x] **後台訂單管理**〔工程〕✅ 2026-07-14：admin 「訂單」頁——列表（編號/客人/金額/付款狀態/出貨狀態）、
      一鍵標記已出貨；`orders.fulfillment_status` 欄位（migration 0006），會員頁「我的訂單」同步顯示已出貨徽章。
- [ ] **商品多圖**〔工程，～一天〕：`product_images` 表本來就支援多列（sort_order），
      後台改多張上傳＋排序，前台商品彈窗做輪播。服飾需要正面/背面/細節照。

## 第三層：錦上添花

- [x] **折扣碼**〔工程〕✅ 2026-07-14：`discount_codes` 表（migration 0006）、後台管理頁（新增/停用）、
      結帳頁輸入框、create-order 伺服器端驗證＋計價（折扣％或固定金額擇一，可設用量上限/到期日）。
- [ ] **老闆 LINE 新訂單通知**〔工程，卡在需要 LINE Notify token〕：payuni-notify 標 paid 時推播。
      去 notify-bot.line.me 用 LINE 帳號登入直接產生 token 最快。
- [x] **商品獨立頁**〔工程〕✅ 2026-07-14：`/product-{id}.html` 建置期逐商品生成——SEO meta／OG／JSON-LD Product
      結構化資料，直接加入購物車（不經彈窗），商品卡名稱可點連過去。
- [x] **結帳防機器人**〔工程，需你申請 Turnstile site key 才會真的啟用〕✅ 2026-07-14：create-order 已接 Cloudflare
      Turnstile server-side 驗證，**只有設定 `TURNSTILE_SECRET_KEY` 這個 function secret 才會強制檢查**——
      沒設定前完全不影響結帳。要啟用：① Cloudflare Dashboard → Turnstile 建 widget 拿 site key/secret
      ② `supabase secrets set TURNSTILE_SECRET_KEY=...` ③ order.html 加 widget script（需把
      `challenges.cloudflare.com` 加進 CSP 的 script-src/frame-src/connect-src）④ 表單送出時帶上 token。
      步驟③④我還沒做（沒有 site key 无法測試），你申請好金鑰後跟我說一聲我就接完。
- [ ] **流量分析**〔工程，卡在需要 Cloudflare API Token〕：Phase 4 舊規劃——Cloudflare GraphQL API 經 proxy
      進後台總覽；去 Cloudflare Dashboard → My Profile → API Tokens 申請（Zone Analytics 讀取權限）。
      短期先用 Cloudflare dashboard 直接看。
- [x] **CSP img-src 收斂**〔工程〕✅ 2026-07-14：五個頁面的 `https:` 萬用改成只允許 Supabase storage 網域。
- [ ] **LINE 登入**〔工程，大，卡在需要 LINE Login channel〕：Supabase 無原生 LINE provider，要自寫 OIDC 交換；
      去 LINE Developers Console 建 LINE Login channel（跟 LINE Notify 是不同東西）。除非老闆強烈要求否則不急。

## 已完成（存檔備查）

- ✅ 改版：矮 banner／4 欄商品格／新導覽（原創設計下拉）／新分類制（PR #12）
- ✅ 選品獨立頁＋首頁預告＋子分類 上衣/下著/配件（PR #15＋後續）
- ✅ 後台網站設定：banner（含手機版直式）／四組配色主題／公告與 hero 文字（PR #16＋後續）
- ✅ 客人 Google 登入＋結帳自動帶入（PR #18）；會員專區 我的訂單/我的資料（PR #19）
- ✅ PAYUNi 付款回跳 405 修復（worker 303）；訂單掛帳號（0005）
- ✅ UI 打磨：表單卡片化/購物車縮圖/頁首三區對齊/靜態公告列/刪跑馬燈
- ✅ 全面資安審查 ship-ready，兩個 Important 已修（admin CDN vendored、尺寸選項跳脫）
