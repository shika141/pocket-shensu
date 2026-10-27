# 🦈 口袋沈溯 · MVP 0.1

一款 React + TypeScript + Vite 的跨平台養成遊戲原型。支援手機直式與桌面瀏覽器，核心遊戲使用灰藍色蛋型電子雞、三顆實體操作按鈕、即時作息、離線結算、本機存檔與可選的 Supabase 雲端帳號。

## 快速開始

需求：Node.js 20+、npm。

```bash
npm install
npm run dev
```

執行正式建置：

```bash
npm run build
npm run preview
```

Cloudflare Pages 的建置指令填 `npm run build`，輸出目錄填 `dist`。Vite 是 SPA，Pages 會以 `index.html` 作為入口。

## 操作方式

- 機身左鍵／鍵盤 ←：上一個分頁；右鍵／→：下一個分頁。
- 機身中鍵／Enter／Space：確認目前選擇。
- ↑、↓：移動選擇；Esc：回到狀態頁。
- 在「互動、場景、服裝」面板中也可直接點選項目。
- 互動先寫入瀏覽器本機存檔；離線後仍可遊玩。重新開啟會依最後存檔時間結算作息、飽足、體力與清潔。

## 功能狀態

### 已可玩的原型

- 響應式桌機／手機電子雞機身與三鍵操作。
- 狀態、互動、場景、服裝、回憶五個頁面。
- 客廳、臥室、廚房、曜川泳池四種 CSS 臨時場景；CSS 角色示意保留深髮、灰藍服裝、右側嘴角小痣等辨識點。
- 本地時間作息重算、關閉期間離線恢復；沈溯不死亡，需求有上下限。
- 餵食、安慰、摸頭、休息、清潔、看比賽錄影、鯊魚娃娃與鯊魚裝事件。
- 本機存檔依登入帳號分區；資料有待同步標記，登出後不會把上一個帳號的資料帶到下一個帳號。
- Supabase Email/Password 登入流程、雲端存檔讀寫、revision CAS 與衝突時採用較新雲端版本；離線本機分支會保留並可下載。
- PWA manifest 基礎設定。

### 示範或尚待完成

- 像素人物與場景以 CSS 臨時素材呈現，不是正式逐格像素動畫；目前沒有精緻事件插圖。
- 作息為平日初版範例，尚未有週末、賽事日或玩家可編輯日程。
- 情緒／親密度是簡化原型平衡，告白及戀人階段事件尚未實作；親密度目前只增不減。
- Supabase 雲端功能需在現有專案執行更新 SQL、確認 Data API 設定並填入 URL/anon key。這個工作區沒有連線憑證，因此無法查看該專案當前設定，也沒有宣稱已驗證真實跨裝置登入。
- PWA 尚未提供離線快取 service worker，安裝可用性會依瀏覽器條件而異；完全離線的遊玩依賴瀏覽器本機儲存。
- 雲端衝突採保守策略：偵測到版本落後即讀取雲端最新存檔，避免整份存檔互相覆蓋；兩台裝置離線同時修改時，較舊一方的未同步修改不會自動合併。

## Supabase 設定（雲端存檔 schema v2）

1. 在你現有的 Supabase 專案 Dashboard SQL Editor 以 `postgres` 專案角色執行最新版 [`supabase/schema.sql`](supabase/schema.sql)。這是可重複套用的 schema v2 更新：重建存檔表的 RLS 政策、撤銷客戶端直接寫入權限，並更新 `save_game_state` RPC。
2. Project Settings > API 確認 Data API 已啟用，且 `public` 位於 Exposed schemas。新專案可能關閉自動暴露新資料表；本 SQL 明確授予 `authenticated` 必要的 `SELECT` 與 RPC `EXECUTE`，不授予直接寫表權限。SQL 會通知 PostgREST 重新載入 schema cache；如果 RPC 仍顯示找不到，等待片刻後重載 schema cache。
3. Authentication > Providers 啟用 Email。依需要設定 Email confirmation 與密碼政策。
4. 本機複製 `.env.example` 為 `.env.local`，填入：

   ```env
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<Supabase publishable/anon key>
   ```

5. Cloudflare Pages > Settings > Environment variables，為 Production 與 Preview 分別設定上述兩個變數，再重新部署。
6. 只使用 Supabase 公開 anon/publishable key。絕不可把 `service_role` key 放進 `VITE_*`、前端、ZIP 或 GitHub。
7. 網頁右上角登入帳號後，雲端會同步 `state` JSON（包含狀態、親密度、服裝、回憶、劇情狀態欄位）與 revision。直接讀取由 RLS 限制到 `auth.uid()` 本人；客戶端沒有表格寫入權限，只能呼叫 RPC。

RPC 參數為 `p_user_id`、`p_expected_revision`、`p_state`，回傳 `{status:'saved',save:{state,revision,updated_at}}` 或 `{status:'conflict',save:<最新資料或 null>}`。首次存檔以 `INSERT ... ON CONFLICT DO NOTHING` 後讀取勝方資料；一般更新以 `UPDATE ... WHERE revision = expected` 原子比對，所以同一 revision 只有一台裝置能寫入。衝突時客戶端採用雲端版本，不會自動覆蓋較新的雲端資料。

本機存檔以 Supabase user ID 分區，未登入存檔只留在 guest 區，不會自動匯入新登入的帳號。離線時先保存在 `localStorage`；回線後使用原 revision 嘗試同步。若離線期間另一裝置已把雲端 revision 往前推進，遊戲載入雲端版本並將本機分支保留在該裝置，可從帳號視窗下載 JSON 備份。這版尚未合併兩台裝置各自的離線操作事件。

`SECURITY DEFINER` 函式固定由 `postgres` 擁有，`search_path` 設為空，所有表與 Auth 函式均使用 schema-qualified 名稱；執行權限只授予 `authenticated`，函式內比對 `auth.uid()` 與傳入玩家 ID。Data API 的 Exposed schemas 是 Supabase 專案設定，無法由 SQL 強制開啟，請依上方步驟確認。

執行 [`supabase/verify_cloud_save.sql`](supabase/verify_cloud_save.sql) 可檢查 RLS、table grants、函式 owner、`SECURITY DEFINER` 設定及 RPC execute 權限。Data API 是否開啟、`public` 是否在 Exposed schemas，仍須到該專案 Dashboard 確認。

## GitHub 與 Cloudflare Pages 部署

1. 將本 ZIP 解壓後的專案檔放進既有 GitHub repository 根目錄，再於該目錄提交更新：

   ```bash
   git add .
   git commit -m "Fix Supabase cloud save concurrency"
   git push
   ```

2. Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git，選擇 repository 與 `main`。
3. Framework preset 選 Vite；Build command `npm run build`；Build output directory `dist`。
4. 設定 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`；尚未設定時遊戲仍可用本機模式。
5. 儲存並部署。往後推送到 main 會觸發 Pages 重建。

## 修改檔案編號

原始碼檔頭和下方變更紀錄均有流水編號。後續修整時請新增下一個編號與修改內容，並在變更摘要中列出修改的檔名，方便追蹤。

## 專案結構

```text
src/01_gameData.ts       角色、狀態型別、作息參數
src/02_simulation.ts     現實時間與離線結算
src/03_storage.ts        本機存檔與待同步標記
src/04_supabase.ts       登入雲端資料 API
src/05_interactions.ts   遊戲互動邏輯
src/06_App.tsx           主介面、操作、帳號同步
src/07_styles.css        遊戲機與響應式樣式
supabase/schema.sql      PostgreSQL、RLS、版本鎖 RPC
```

## 已知限制

瀏覽器本機存檔只存在該瀏覽器／裝置；跨裝置需部署 Supabase 並登入同一帳號。遊戲原型尚未經真實 Supabase 專案與雙裝置實測。電子雞畫面為可替換 CSS 素材，日後可換成 sprite sheet 或 Phaser/Canvas 動畫。
