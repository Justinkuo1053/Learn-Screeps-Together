# Screeps Mini Simulator

這是一個超精簡的本地模擬器，用來驗證「RCL3 能量全滿才生 Harvester」的行為。它不依賴官方伺服器，直接在 Node.js 上跑，讓你能快速觀察策略是否符合預期。

## 需求
- Node.js 12+（你的 Docker 內是 12.22.12；本機 16/18 也可）

## 如何執行

```bash
# 進到模擬器目錄
cd "Screeps-Worls (js)/sim"

# 安裝步驟省略（無第三方依賴）

# 執行
node index.js
```

## 你會看到什麼
- 每個 tick 會輸出 HUD：
  - 房間 RCL
  - 能量 EnergyAvailable/EnergyCapacity
  - 爬數角色統計
- 在 RCL3 時，只有當房間能量到達滿值（例如 550/550）才會嘗試孵化 Harvester（身體 [WORK,WORK,CARRY,MOVE,MOVE]）。
- 在 RCL3 之前，若完全沒有爬且能量 ≥200，會做一次「緊急孵化」基本 Harvester，避免鎖死。

## 和你代碼的對應
- spawn 條件：`room.energyAvailable === room.energyCapacityAvailable && harvesterCount < quota`
- 身體組合：RCL3 預設 `[WORK,WORK,CARRY,MOVE,MOVE]`
- 緊急孵化：無爬 + 能量 ≥200 時允許 `[WORK,CARRY,MOVE]`

## 下一步
- 若你的私服環境就緒，把 `Js code/minimal_rcl3.js` 上傳為 `main.js`，行為會與這個模擬器一致。
- 你也可以將 `config.minHarvesters` 改掉來測試不同配額。
