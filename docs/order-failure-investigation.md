# 調查：訂單偶爾建立失敗、過一陣子又好（給遠端 agent）

> **只調查、不修**。查完把結論回報，修法另外討論。
> 發生時間：**2026-11-14 約 15:50（台灣時間 UTC+8）＝ 07:50 UTC**。
> 若 15:50 前後查不到，再查 03:50（＝ 前一天 19:50 UTC），使用者口述「3 點 50 分」未註明上下午。
> Supabase Dashboard 的 log 時間是 **UTC**，查詢時記得換算。建議查 07:30–08:15 UTC。

## 背景（為什麼光看前端訊息分不出原因）

- 結帳送出 → 瀏覽器呼叫 Edge Function `create-order` → 成功回傳 PAYUNi 參數 → 表單跳轉 PAYUNi。
- `order.js` 的錯誤處理：只有折扣碼與人機驗證的錯誤原樣顯示，**其他所有錯誤（庫存不足、超過限購、尺寸不存在、5xx、非 JSON 回應）都顯示同一句「建立訂單失敗，請改用 LINE 聯絡我們。」**
- `create-order` 由平台驗 JWT（部署時沒加 `--no-verify-jwt`）；登入會員送的是自己的 access token，訪客送 anon key。

## 假說（依可能性排序）與判別方式

| # | 假說 | 在 log 會看到 | 「過一陣子又好」的原因 |
|---|---|---|---|
| H1 | Edge Function 暫時失敗（冷啟動逾時、資源上限、平台 5xx） | Invocations 有 **5xx / 546**，或 function log 有 boot / timeout 錯誤 | 平台恢復 |
| H2 | 庫存不足 / 超過限購 / 尺寸不存在（被前端蓋成通用訊息） | Invocations **409 或 400** | 店主補庫存或改商品後恢復；或客人重新加購物車 |
| H3 | 人機驗證失敗（常見於 IG / LINE 內建瀏覽器） | 400，function log 有 `turnstile rejected` | 換瀏覽器或重新整理 |
| H4 | 訂單其實建立成功，是跳轉到 PAYUNi 後失敗 | create-order **200**；`orders` 有該時段的 `pending` 訂單 | PAYUNi 恢復 |
| H5 | 登入 token 過期 / 被拒（手機時間不準、多分頁 refresh token 競態） | Invocations **401**，函式本身沒有執行紀錄 | 重新整理後 token 更新 |

## 步驟

### 1. Edge Function 呼叫紀錄（最關鍵）
Dashboard → Edge Functions → `create-order` → **Invocations**，篩 07:30–08:15 UTC：
- 記下每一筆的 **狀態碼、執行時間（ms）、時間點**
- 有 5xx / 546 → H1；401 → H5；400 / 409 → 看第 2 步的 log 內容；200 → H4

同頁 **Logs** 分頁，找同時段的訊息：`turnstile rejected`（H3）、`order insert failed`、`order_items insert failed`、`create-order error`、`claim_discount_code failed`、boot / timeout 錯誤。

（也可用 Logs Explorer，`function_edge_logs` 看狀態碼、`function_logs` 看 console 輸出，依 Dashboard 提供的範本查詢。）

### 2. 該時段的訂單（判斷 H4）
SQL Editor：

```sql
select order_no, created_at at time zone 'Asia/Taipei' as tw_time,
       payment_status, pay_amount, discount_code, user_id is not null as member
from orders
where created_at between '2026-11-14 07:20+00' and '2026-11-14 08:30+00'
order by created_at;
```

- 有 `pending` 訂單、沒有轉 `paid` → 訂單已建立，失敗在 PAYUNi 那段（H4）
- 完全沒有訂單 → 失敗在 create-order（H1/H2/H3/H5）

### 3. 庫存與限購現況（判斷 H2）

```sql
select v.product_id, p.name_zh, p.status, v.size, v.stock, v.max_qty
from product_variants v join products p on p.id = v.product_id
where p.status in ('preorder', 'active')
order by v.product_id, v.size;
```

- 有 `stock = 0` 的尺寸、或 `max_qty = 1`（後台存商品預設就是 1）→ 客人買 2 件或剛好售完就會失敗
- 問店主 15:50 前後有沒有在後台**編輯商品**：後台存檔會先刪掉所有尺寸再重建，中間一瞬間下單會得到「尺寸不存在」

### 4. 向使用者 / 客人確認
- 畫面上的**確切文字**：「建立訂單失敗，請改用 LINE 聯絡我們」還是「請完成人機驗證」「人機驗證失敗，請重新整理再試一次」（後兩句 → H3）
- 用什麼開網頁：IG / LINE 內建瀏覽器，還是 Safari / Chrome
- 有沒有登入會員（有 → H5 可能性上升）
- 購物車裡是哪件商品、哪個尺寸、幾件
- 有沒有跳到 PAYUNi 付款頁才出錯（有 → H4）

## 回報格式

1. 第 1 步：該時段每筆 invocation 的時間（台灣時間）、狀態碼、耗時，以及相關 log 原文
2. 第 2 步：查詢結果
3. 第 3 步：有問題的尺寸（stock 0 / max_qty）
4. 判定是哪個假說，以及證據；判不出來就列出還缺什麼資訊

## 已知可改善處（先不要動，等調查結果再決定）
- 前端把 400 / 409 的具體原因（庫存不足、超過限購、尺寸不存在）顯示給客人
- 5xx 或非 JSON 回應時自動重試一次
- 後台存商品改成更新尺寸而非「全刪再建」
