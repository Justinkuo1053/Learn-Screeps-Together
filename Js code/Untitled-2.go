


// 基礎主程式 （持續按照tick回合制）


// 清理記憶體

// 計算個角色數量

// 顯示角色數量

// 自動生產

package main

import (
    "github.com/gopherjs/gopherjs/js"
)

func main() {
    loop := func() {
        memory := js.Global.Get("Memory")
        game := js.Global.Get("Game")

        // === 清理記憶體 ===
        creepsMemory := memory.Get("creeps")
        gameCreeps := game.Get("creeps")

        for name := range creepsMemory.Interface().(map[string]interface{}) {
            if !gameCreeps.Get(name).Truthy() {
                creepsMemory.Call("delete", name)
                js.Global.Get("console").Call("log", "清除記憶:", name)
            }
        }

        // === 計算各角色數量 ===
        harvesters := js.Global.Get("_").Call("filter", gameCreeps, func(c *js.Object) bool {
            return c.Get("memory").Get("role").String() == "harvester"
        })
        upgraders := js.Global.Get("_").Call("filter", gameCreeps, func(c *js.Object) bool {
            return c.Get("memory").Get("role").String() == "upgrader"
        })
        builders := js.Global.Get("_").Call("filter", gameCreeps, func(c *js.Object) bool {
            return c.Get("memory").Get("role").String() == "builder"
        })

        js.Global.Get("console").Call("log",
            "📊 Harvesters:", harvesters.Length(),
            " | Upgraders:", upgraders.Length(),
            " | Builders:", builders.Length())

        // === 自動生產 Creep ===
        spawn := game.Get("spawns").Get("Spawn1")

        if harvesters.Length() < 2 {
            newName := "H" + game.Get("time").String()
            spawn.Call("spawnCreep", []interface{}{js.Global.Get("WORK"), js.Global.Get("CARRY"), js.Global.Get("MOVE")}, newName, map[string]interface{}{
                "memory": map[string]interface{}{"role": "harvester"},
            })
        } else if upgraders.Length() < 1 {
            newName := "U" + game.Get("time").String()
            spawn.Call("spawnCreep", []interface{}{js.Global.Get("WORK"), js.Global.Get("CARRY"), js.Global.Get("MOVE")}, newName, map[string]interface{}{
                "memory": map[string]interface{}{"role": "upgrader"},
            })
        } else if builders.Length() < 2 {
            newName := "B" + game.Get("time").String()
            spawn.Call("spawnCreep", []interface{}{js.Global.Get("WORK"), js.Global.Get("CARRY"), js.Global.Get("MOVE")}, newName, map[string]interface{}{
                "memory": map[string]interface{}{"role": "builder"},
            })
        }

        // 顯示生產狀態
        if spawn.Get("spawning").Truthy() {
            spawningCreep := gameCreeps.Get(spawn.Get("spawning").Get("name").String())
            spawn.Get("room").Call("visual").Call("text",
                "🛠️ "+spawningCreep.Get("memory").Get("role").String(),
                spawn.Get("pos").Get("x").Int()+1,
                spawn.Get("pos").Get("y").Int(),
                map[string]interface{}{"align": "left", "opacity": 0.8},
            )
        }

        // === 執行各 Creep 的任務 ===
        for name, _ := range gameCreeps.Interface().(map[string]interface{}) {
            creep := gameCreeps.Get(name)
            role := creep.Get("memory").Get("role").String()
            switch role {
            case "harvester":
                runHarvester(creep)
            case "upgrader":
                runUpgrader(creep)
            case "builder":
                runBuilder(creep)
            }
        }
    }

    js.Global.Set("loop", loop)
}

// === Harvester 角色邏輯 ===
func runHarvester(creep *js.Object) {
    if creep.Get("store").Call("getFreeCapacity").Int() == 0 {
        target := creep.Call("pos").Call("findClosestByPath", js.Global.Get("FIND_STRUCTURES"), map[string]interface{}{
            "filter": func(s *js.Object) bool {
                return (s.Get("structureType") == js.Global.Get("STRUCTURE_EXTENSION") ||
                    s.Get("structureType") == js.Global.Get("STRUCTURE_SPAWN")) &&
                    s.Get("store").Call("getFreeCapacity", js.Global.Get("RESOURCE_ENERGY")).Int() > 0
            },
        })
        if target.Truthy() {
            if creep.Call("transfer", target, js.Global.Get("RESOURCE_ENERGY")).Int() == js.Global.Get("ERR_NOT_IN_RANGE").Int() {
                creep.Call("moveTo", target, map[string]interface{}{
                    "visualizePathStyle": map[string]interface{}{"stroke": "#ffaa00"},
                })
            }
        }
    } else {
        source := creep.Call("pos").Call("findClosestByPath", js.Global.Get("FIND_SOURCES"))
        if creep.Call("harvest", source).Int() == js.Global.Get("ERR_NOT_IN_RANGE").Int() {
            creep.Call("moveTo", source, map[string]interface{}{
                "visualizePathStyle": map[string]interface{}{"stroke": "#ffaa00"},
            })
        }
    }
}

// === Upgrader 角色邏輯 ===
func runUpgrader(creep *js.Object) {
    if creep.Get("memory").Get("upgrading").Truthy() && creep.Get("store").Get(js.Global.Get("RESOURCE_ENERGY").String()).Int() == 0 {
        creep.Get("memory").Set("upgrading", false)
        creep.Call("say", "🔄 採集")
    }
    if !creep.Get("memory").Get("upgrading").Truthy() && creep.Get("store").Call("getFreeCapacity").Int() == 0 {
        creep.Get("memory").Set("upgrading", true)
        creep.Call("say", "⚡ 升級")
    }

    if creep.Get("memory").Get("upgrading").Truthy() {
        if creep.Call("upgradeController", creep.Get("room").Get("controller")).Int() == js.Global.Get("ERR_NOT_IN_RANGE").Int() {
            creep.Call("moveTo", creep.Get("room").Get("controller"), map[string]interface{}{
                "visualizePathStyle": map[string]interface{}{"stroke": "#00ff00"},
            })
        }
    } else {
        source := creep.Call("pos").Call("findClosestByPath", js.Global.Get("FIND_SOURCES"))
        if creep.Call("harvest", source).Int() == js.Global.Get("ERR_NOT_IN_RANGE").Int() {
            creep.Call("moveTo", source, map[string]interface{}{
                "visualizePathStyle": map[string]interface{}{"stroke": "#00ff00"},
            })
        }
    }
}

// === Builder 角色邏輯 ===
func runBuilder(creep *js.Object) {
    if creep.Get("memory").Get("building").Truthy() && creep.Get("store").Get(js.Global.Get("RESOURCE_ENERGY").String()).Int() == 0 {
        creep.Get("memory").Set("building", false)
        creep.Call("say", "🔄 採集")
    }
    if !creep.Get("memory").Get("building").Truthy() && creep.Get("store").Call("getFreeCapacity").Int() == 0 {
        creep.Get("memory").Set("building", true)
        creep.Call("say", "🔨 建造")
    }

    if creep.Get("memory").Get("building").Truthy() {
        target := creep.Call("pos").Call("findClosestByPath", js.Global.Get("FIND_CONSTRUCTION_SITES"))
        if target.Truthy() {
            if creep.Call("build", target).Int() == js.Global.Get("ERR_NOT_IN_RANGE").Int() {
                creep.Call("moveTo", target, map[string]interface{}{
                    "visualizePathStyle": map[string]interface{}{"stroke": "#ffffff"},
                })
            } else {
                creep.Call("say", "🏠滿了!")
            }
        } else {
            if creep.Call("upgradeController", creep.Get("room").Get("controller")).Int() == js.Global.Get("ERR_NOT_IN_RANGE").Int() {
                creep.Call("moveTo", creep.Get("room").Get("controller"), map[string]interface{}{
                    "visualizePathStyle": map[string]interface{}{"stroke": "#ffffff"},
                })
            }
        }
    } else {
        source := creep.Call("pos").Call("findClosestByPath", js.Global.Get("FIND_SOURCES"))
        if creep.Call("harvest", source).Int() == js.Global.Get("ERR_NOT_IN_RANGE").Int() {
            creep.Call("moveTo", source, map[string]interface{}{
                "visualizePathStyle": map[string]interface{}{"stroke": "#ffffff"},
            })
        }
    }
}

func cleanMemory() {
	// 模擬清理記憶體
	fmt.Println("Cleaning memory...")
}

func countRoles() int {
	return len(roles)
}

func displayRoleCount() {
	count := countRoles()
	fmt.Printf("Current role count: %d\n", count)
}

func autoProduceRole() {
	newRole := Role{Name: fmt.Sprintf("Role%d", rand.Intn(1000))}
	roles = append(roles, newRole)
	fmt.Printf("Produced new role: %s\n", newRole.Name)
}

