# Google 會員登入 — 上線設定手冊

結帳頁的「用 Google 登入」要能動，需要以下人工設定。
**⚠️ 請嚴格照順序做**：順序錯了會出現「客人登入後能改商品」的安全空窗。
（程式碼已就緒：migration `0004`、`trigger-deploy` 權限檢查、結帳頁 UI 都在 repo 裡。）

## 第 1 步：把管理員帳號標成 admin

Supabase Dashboard → SQL Editor，執行（**換成 admin 後台登入用的 email**）：

```sql
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  where email = 'ADMIN_EMAIL_HERE';
```

確認有一列被更新（`Rows affected: 1`）。

## 第 2 步：執行 migration 0004

SQL Editor 貼上 `supabase/migrations/0004_admin_role_and_profiles.sql` 全文執行。
做了三件事：寫入權限鎖到 admin、建 `customer_profiles` 表、每人只能讀寫自己的資料。

## 第 3 步：admin 後台重新登入

登出再登入一次（舊的登入憑證不帶 admin 標記，不重登的話後台會存不了東西）。
驗證：後台隨便改一個商品存檔，成功即通過。

## 第 4 步：重新部署 trigger-deploy function

```bash
npx supabase functions deploy trigger-deploy --project-ref ywzsjhaqgidgxnjmyyeg
```

（新版多了 admin 檢查——沒有這步，之後任何 Google 註冊的客人都能觸發網站部署。）

## 第 5 步：Storage 權限收緊

Dashboard → Storage → product-images → Policies：
把「authenticated 可上傳/修改/刪除」類的 policy 刪掉，改成（SQL Editor 也可執行）：

```sql
create policy "admin write storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
```

（公開讀取的 policy 保留不動。）

## 第 6 步：Google Cloud OAuth 憑證

1. https://console.cloud.google.com → 建立專案（或用現有的）
2. APIs & Services → OAuth consent screen：External、填 App 名稱（OneiRoam）、support email，發布（Publish）
3. APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application
   - Authorized redirect URIs 填：`https://ywzsjhaqgidgxnjmyyeg.supabase.co/auth/v1/callback`
4. 記下 Client ID 和 Client Secret

## 第 7 步：Supabase Auth 設定

Dashboard → Authentication：

1. **Providers → Google**：Enable，貼上第 6 步的 Client ID / Secret
2. **URL Configuration**：
   - Site URL：`https://www.oneiroam.com`
   - Redirect URLs 加入：`https://www.oneiroam.com/order.html`、staging 網域（`https://*.oneiroam.workers.dev/order.html`）
3. **Sign In / Up**：確認「Allow new users to sign up」開啟（Google 註冊需要）；
   Email provider 可以維持關閉/不開放註冊（後台照常用密碼登入）

## 第 8 步：上線驗收

部署網站後，用一個普通 Google 帳號走一遍：

- [ ] order.html 點「用 Google 登入」→ 跳 Google → 回到結帳頁顯示「已登入 xxx@gmail.com」
- [ ] 填資料下單（sandbox）→ 付款跳轉正常
- [ ] 重新開 order.html → 姓名/電話/社群/Email 自動帶入
- [ ] 登出按鈕正常
- [ ] **安全驗收**：用這個客人帳號的身分「不能」做到以下事情——admin 後台登入後改商品（應失敗）、觸發發布（應 403）
- [ ] admin 帳號在後台一切照舊（商品、網站設定、發布）
