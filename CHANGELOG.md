# 修改紀錄

## 001｜建立可執行 MVP

- 新增 React、TypeScript、Vite 專案骨架與 Cloudflare Pages 建置設定。
- 新增 `src/01_gameData.ts`：沈溯狀態、場景、作息和參數。
- 新增 `src/02_simulation.ts`：本地實際時間、每日作息與離線狀態恢復。
- 新增 `src/03_storage.ts`：本機存檔與離線待同步旗標。
- 新增 `src/04_supabase.ts`：Supabase Auth 資料客戶端、版本化讀寫。
- 新增 `src/05_interactions.ts`：養成互動與服裝／場景操作。
- 新增 `src/App.tsx`、`src/styles.css`：蛋型電子雞、三鍵控制、響應式畫面和帳號面板。
- 新增 `supabase/schema.sql`：玩家存檔資料表、RLS 與 revision 衝突檢查 RPC。
- 新增 `.env.example`、`README.md`、PWA manifest 與部署說明。

## 002｜修正作息判斷並完成建置驗證

- 修正 `src/02_simulation.ts` 的時段比對：之前只檢查「目前時間晚於活動開始」，會讓上午早餐時段延伸到當日其餘時段；現在以開始與結束時間共同判斷，並正確處理跨午夜睡眠。
- 收緊 `supabase/schema.sql` 權限：前端只可直接讀取本人存檔，所有寫入統一走 revision 檢查 RPC。
- 驗證 `npm run build`、八個日程時間點及 24 小時離線需求上下限。
