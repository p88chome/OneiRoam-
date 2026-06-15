# OneiRoam 訂單表單 — 設計文件

日期：2026-06-15
分支：staging
狀態：已核准設計，待寫實作計畫

## 目標

在靜態網站新增站內訂購功能。客人可一次選購多件商品（含尺寸、數量），填寫訂單表單，
送出後系統將訂單寄到賣家 Email 並同步寄一份副本給客人，畫面顯示訂單編號與銀行帳號。
匯款與對帳維持人工，靠訂單編號串接。

不做：金流串接（綠界/Stripe）、後台資料庫、自動確認匯款。這些列於 feature-backlog 未來項。

## 核心問題與結論

**訂單有沒有送到賣家？** — 能確認。送出按鈕只在 Web3Forms 回傳 HTTP 200 後才顯示成功與
銀行帳號；失敗顯示錯誤 + LINE 備援。Web3Forms autoresponder 另寄副本給客人，雙方皆有記錄。

**客人有沒有匯款？** — 靜態站無法自動確認，本質為人工對帳（任何未串金流方案皆同）。
以訂單編號讓對帳清楚不出錯。

對帳閉環：
```
客人送單 → email 進賣家信箱（含編號、品項、金額）
         → 客人看到編號 + 銀行帳號 + 「匯款請備註編號」
客人匯款（備註編號）
賣家查銀行 → 用編號對上 email 訂單 → 手動確認 → LINE 通知客人已收到
```

## 架構

```
新增檔案
├── order.html          訂購頁（清單 + 表單 + 送出後顯示帳號）
├── cart.js             訂單清單邏輯（讀寫 localStorage，單一資料來源）
└── order.js            訂購頁專用（渲染清單、收集表單、送 Web3Forms）

改動現有
├── index.html          每張商品卡加「加入訂單」鈕；header 加購物袋 icon + 數量 badge
├── script.js           商品卡鈕 → 呼叫 cart.js 的 addItem()
└── style.css           鈕、購物袋 badge、訂購頁、清單樣式
```

### 資料流
```
商品卡「加入訂單」→ cart.addItem({id,name,price,size,qty})
   → 寫 localStorage → header badge 更新
訂購頁載入 → cart.getItems() → 渲染清單（可改數量/尺寸/刪除）
送出 → 收集表單+清單 → fetch Web3Forms → 成功 → 顯示銀行帳號 → cart.clear()
```

### 解耦點
送出邏輯獨立成 `submitOrder(payload)`。未來換 LINE 通知 / Google Sheet 只改此 function，
表單與清單 UI 不動。Web3Forms 本身亦可後接 webhook → Zapier/Make → LINE/Sheet。

## 資料結構

localStorage key：`oneiRoamCart`
```js
[
  { id: "dress-white-lace", name: "花嫁之夢", price: 1690, size: "M", qty: 1 },
  { id: "bag-ruffle-blue",  name: "雲朵荷葉包", price: 690, size: "F", qty: 2 }
]
```
- `id` 從商品卡新增的 `data-id` 讀（現有卡片無 id，需補上）。
- `size` 為自訂時存客人輸入的字串。
- 同 `id` + `size` 再加入 → `qty` 累加，不新增列。

### 商品卡尺寸來源
卡片加 `data-sizes="S,M,L,XL"`；未寫則用預設 `S,M,L,XL`。包款設 `data-sizes="F"`（均碼）。
加入訂單時讓客人選尺寸，選「自訂」可輸入文字（如訂製腰圍）。

### 訂單編號
前端產生：`OR-` + 日期 + 3 碼亂數。
```js
"OR-20260615-" + Math.random().toString(36).slice(2,5).toUpperCase()  // → OR-20260615-K7P
```
非全域唯一；對小店量足夠，並以姓名 + 金額交叉比對。

## Web3Forms 送出

純前端 POST，無後端：
```js
async function submitOrder(payload) {
  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_key: "WEB3FORMS_ACCESS_KEY",   // 註冊免費取得，填 email 即發
      subject: `新訂單 ${payload.orderNo}`,
      from_name: "OneiRoam 訂單",
      ...payload          // 編號、品項清單、姓名、地址、聯絡、金額合計
    })
  });
  if (!res.ok) throw new Error("送出失敗");
  return res.json();
}
```
- `access_key` 為公開金鑰，放前端可接受（只能寄到賣家註冊信箱）。
- 自動回覆副本：payload 帶 `replyto` = 客人 email，後台開 autoresponder。
- CSP 修改：`connect-src 'self'` → 加 `https://api.web3forms.com`。

## 頁面流程

### order.html
1. 訂單清單區 — 渲染 localStorage，每列可改數量（+/−）、改尺寸、刪除；即時算合計。
2. 清單空 → 顯示「尚未選購，去逛逛」連回首頁。
3. 表單 — 姓名、收件地址、LINE ID/電話、Email、備註。
4. 送出 → loading → 成功畫面：訂單編號 + 銀行帳號 + 「匯款請備註編號」+「LINE 傳收據」提示 → 清空 cart。
5. 失敗 → 錯誤訊息 + LINE 連結備援。

### index.html 改動
- 每張商品卡 modal 區加「加入訂單」鈕（保留現有「查看詳情」）。
- header 加購物袋 icon + 數量 badge，連到 order.html。

### 雙語
沿用現有 `data-zh` / `data-en` + localStorage 機制，新頁同套。

## 元件職責

| 單元 | 做什麼 | 依賴 |
|------|--------|------|
| `cart.js` | 訂單清單 CRUD（addItem/getItems/updateQty/updateSize/remove/clear），同步 badge | localStorage |
| `order.js` | 渲染清單、收集表單、產編號、呼叫 submitOrder、切換成功/失敗畫面 | cart.js |
| `submitOrder()` | 唯一對外送出點（目前 Web3Forms） | fetch |
| `script.js`（既有）| 商品卡加入鈕 → cart.addItem | cart.js |

## 測試重點

- cart：加入、累加、改數量/尺寸、刪除、清空、跨頁持久。
- 編號格式正確。
- 送出成功 → 顯示帳號 + 清空 cart；送出失敗 → 不清空、顯示 LINE 備援。
- 空清單不可送出。
- 雙語切換在 order.html 正常。
- CSP 不擋 Web3Forms 請求。

## 安全

- `access_key` 公開金鑰，前端可放。
- CSP connect-src 僅加 Web3Forms 網域，不放寬其他。
- 表單輸入渲染回畫面時需轉義（防 XSS），勿用 innerHTML 塞客人輸入。
