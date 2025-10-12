package main

import (
	"fmt"
)


// type Game struct {
//     Spawns 
// }

// type Spawn struct {
//     Name String
//     Energy int
// }

// func (s *Spawn) 



//計算不同角色數量


type Game struct {
    Creeps []*Creep
}

func (g *Game) CountCreepsByRole(role string) int {
    count := 0
    for i:=0; i<len(g.Creeps); i++ {
        if g.Creeps[i].Memory.Role == role {
            count++
// 注意：原本這裡有一個未完成的函式定義（會造成語法錯誤），
// 為了讓檔案維持可讀且不阻礙其他示範，我們先以區塊註解包起來。
/*
func orderCreep(g *Game, role string) error {
    // TODO: 補上你的生產決策邏輯
    return nil
}
*/

// === 自動放置 Extension 工地（Go 版示範）===
// 這一段是把你在 JS 版本的 extension 放置邏輯，轉成容易理解的 Go 範例。
// 說明：
// - 下列型別（SimSpawn/SimRoom/SimController/SimPosition）是教學用途的「模擬型別」。
// - 在 Screeps 真實環境中需使用 JS 並呼叫官方 API（createConstructionSite 等）。
// - 這裡提供演算法思路與函式切割，方便你在 Go 版本練習或單元測試。

// 模擬座標
type SimPosition struct { X, Y int }

// 模擬 Controller
type SimController struct { Level int }

// 模擬 Room（僅保留範例中會用到的欄位）
type SimRoom struct {
    Name       string
    Controller *SimController
}

// 模擬 Spawn
type SimSpawn struct {
    Room *SimRoom
    Pos  SimPosition
}

// 每個 RCL 可建置的 extension 上限（與 Screeps 規則相符）
func allowedExtensionsByRCL(level int) int {
    m := map[int]int{1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60}
    if v, ok := m[level]; ok {
        return v
    }
    return 0
}

// 在 spawn 周圍尋找可放置工地的位置（教學示範版）
// 說明：
// - JS 版會檢查牆、現有結構/工地等；這裡僅示範「同心方框」掃描的概念。
// - 你可以把 "是否可用" 的判斷抽象為一個 callback 來測試不同策略。
func findBuildPosNearSpawnGo(spawn *SimSpawn, maxRange int, isFree func(x, y int) bool) *SimPosition {
    sx, sy := spawn.Pos.X, spawn.Pos.Y
    for r := 1; r <= maxRange; r++ {
        for dx := -r; dx <= r; dx++ {
            for dy := -r; dy <= r; dy++ {
                x, y := sx+dx, sy+dy
                // 排除 spawn 本身
                if x == sx && y == sy { continue }
                // 邊界判斷（模擬 0..49）
                if x < 1 || x > 48 || y < 1 || y > 48 { continue }
                // 可用性檢查（外部傳入，便於測試/替換）
                if isFree != nil && !isFree(x, y) { continue }
                return &SimPosition{X: x, Y: y}
            }
        }
    }
    return nil
}

// 範例：自動放置 extension 的流程（教學示範）
// 參數說明：
// - existing: 目前已建好的 extension 數量
// - planned:  目前已有的 extension 工地數量
// - target:   目標希望達到的 extension 總數（可用 allowedExtensionsByRCL(controller.Level) 取得）
func autoPlaceExtensionsGo(room *SimRoom, spawn *SimSpawn, existing, planned, target int) {
    if room == nil || room.Controller == nil { return }
    if room.Controller.Level < 2 { return }

    total := existing + planned
    if total >= target { return }

    need := target - total
    // 簡單示範的空位檢查：一律視為可用
    isFree := func(x, y int) bool { return true }

    placed := 0
    for i := 0; i < need; i++ {
        pos := findBuildPosNearSpawnGo(spawn, 4, isFree)
        if pos == nil { break }
        // 在真實環境會呼叫：room.createConstructionSite(pos.x, pos.y, STRUCTURE_EXTENSION)
        // 這裡先印出，作為示範與測試觀察點
        fmt.Printf("[GoDemo] Place extension site at (%d,%d) [planned %d/%d]\n", pos.X, pos.Y, total+placed+1, target)
        placed++
        // TODO: 在你的模擬資料結構裡，把此位置記錄到工地清單
    }
    if placed > 0 {
        fmt.Println("[GoDemo] Reminder: 建議確保至少 1 名 builder 來建造這些工地")
    }
}
}   
        

func orderCreep(g *Game, role string) error {
    if g.Creeps

func main() {
    game := &Game{
        Creeps: []*Creep{
            // 範例：這裡沿用你原本的初始化（若你的 Creep 型別不同，請依實際結構調整）
            // {Name: "Harvester1", Memory: &CreepMemory{Role: "harvester"}},
            // {Name: "Upgrader1",  Memory: &CreepMemory{Role: "upgrader"}},
            // {Name: "Builder1",   Memory: &CreepMemory{Role: "builder"}},
            // {Name: "Harvester2", Memory: &CreepMemory{Role: "harvester"}},
        },
    }
    harvesters := game.CountCreepsByRole("harvester")
    upgraders := game.CountCreepsByRole("upgrader")
    builders := game.CountCreepsByRole("builder")
    totalCreeps := len(game.Creeps)

    fmt.Printf("Harvesters: %d | Upgraders: %d | Builders: %d | Total: %d\n", harvesters, upgraders, builders, totalCreeps)

    // Go 版 extension 放置示範（不會真的呼叫 Screeps API，只是印出流程）：
    demoRoom := &SimRoom{Name: "W1N1", Controller: &SimController{Level: 3}}
    demoSpawn := &SimSpawn{Room: demoRoom, Pos: SimPosition{X: 33, Y: 14}}
    existingExtensions := 0 // 你可以依你的模擬資料帶入真正數字
    plannedSites := 0       // 你可以依你的模擬資料帶入真正數字
    target := allowedExtensionsByRCL(demoRoom.Controller.Level)
    autoPlaceExtensionsGo(demoRoom, demoSpawn, existingExtensions, plannedSites, target)

}


