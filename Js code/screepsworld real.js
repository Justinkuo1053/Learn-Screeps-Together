// main.js - Screeps 基礎三角色系統
// 2025/10/14 大幅優化與修正
// - 增加 source 旁自動建 container
// - extension 找空地更智能，避開出口
// - spawning creep 只在能量全滿時最大化body
// - 自動清理死工地
// - 部分碼註解修正

module.exports.loop = function () {
    // === 清理記憶體 ===
    for(let name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('清除記憶:', name);
        }
    }

    // === 計算各角色數量 ===
    const harvesters = _.filter(Game.creeps, c => c.memory.role == 'harvester');
    const upgraders = _.filter(Game.creeps, c => c.memory.role == 'upgrader');
    const builders = _.filter(Game.creeps, c => c.memory.role == 'builder');
    console.log('📊 Harvesters:' + harvesters.length + 
                ' | Upgraders:' + upgraders.length + 
                ' | Builders:' + builders.length);

    const spawn = Game.spawns['Spawn1'];
    const room = spawn.room;

    // ========== 2025/10/14 新增：source 旁自動建 container ==========
    // 目的：加速能量物流、減少路程浪費
    const sources = room.find(FIND_SOURCES);
    for (let source of sources) {
        // 指定右上 source（座標依據你的地圖調整，假設x>35&&y<16）
        if (source.pos.x > 35 && source.pos.y < 16) {
            const hasContainer = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType == STRUCTURE_CONTAINER &&
                    s.pos.isNearTo(source.pos)
            }).length > 0;
            const hasSite = room.find(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType == STRUCTURE_CONTAINER &&
                    s.pos.isNearTo(source.pos)
            }).length > 0;
            if (!hasContainer && !hasSite) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const x = source.pos.x + dx, y = source.pos.y + dy;
                        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                        if (room.getTerrain().get(x, y) === TERRAIN_MASK_WALL) continue;
                        if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) continue;
                        if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) continue;
                        room.createConstructionSite(x, y, STRUCTURE_CONTAINER);
                        break;
                    }
                }
            }
        }
    }

    // ========== 2025/10/14 新增：自動清理爛掉太久沒蓋的 extension 工地 ==========
    // 目的：避免 extension 工地長期卡住
    const allSites = room.find(FIND_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION && s.progress === 0
    });
    if (allSites.length > 0 && allSites.length + room.find(FIND_MY_STRUCTURES, {filter:s=>s.structureType===STRUCTURE_EXTENSION}).length > allowedExtensionsByRCL(room.controller.level)) {
        for (let s of allSites) {
            s.remove();
            console.log('清理死工地', s.pos.x, s.pos.y);
        }
    }

    // ========== 2025/10/14 改良 extension 工地建置規則（保留通道） ==========
    // 目的：繼續自動建置(不堵出口)，並動態範圍擴大
    function allowedExtensionsByRCL(level) {
        const map = {1:0, 2:5, 3:10, 4:20, 5:30, 6:40, 7:50, 8:60};
        return map[level] || 0;
    }
    function findSmartBuildPos(spawn, maxRange = 7) {
        const room = spawn.room;
        const terrain = room.getTerrain();
        const p = spawn.pos;
        // 只挑非主要出口周邊空地：上下左右出口留空（可自訂）
        const exclude = [
            [p.x, p.y+1],
            [p.x, p.y-1],
            [p.x+1, p.y],
            [p.x-1, p.y]
        ];
        for (let r = 1; r <= maxRange; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    const x = p.x + dx, y = p.y + dy;
                    if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                    if (x === p.x && y === p.y) continue;
                    if (exclude.some( pos => pos[0]===x && pos[1]===y )) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) continue;
                    if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) continue;
                    return new RoomPosition(x, y, room.name);
                }
            }
        }
        return null;
    }
    if (room.controller) {
        const allowed = allowedExtensionsByRCL(room.controller.level);
        const existingExtCount = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        const extSiteCount = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        if (room.controller.level >= 2 && (existingExtCount + extSiteCount) < allowed) {
            const pos = findSmartBuildPos(spawn, 7);
            if (pos) {
                const res = room.createConstructionSite(pos.x, pos.y, STRUCTURE_EXTENSION);
                if (res === OK) {
                    console.log('Placed extension site at', pos.x, pos.y, `(${existingExtCount + extSiteCount + 1}/${allowed})`);
                }
            }
        }
    }
    // ===========================================

    // 2025/10/14 改良：只有能量全滿才生產（防止只能生小 creep）
    if(harvesters.length < 2 && room.energyAvailable === room.energyCapacityAvailable) {
        const newName = 'H' + Game.time;
        const body = (room.energyCapacityAvailable >= 550) ? [WORK,WORK,CARRY,MOVE,MOVE] : [WORK,CARRY,MOVE];
        spawn.spawnCreep(body, newName, {memory: {role: 'harvester'}});
    }
    else if(upgraders.length < 1 && room.energyAvailable === room.energyCapacityAvailable) {
        const newName = 'U' + Game.time;
        const body = (room.energyCapacityAvailable >= 550) ? [WORK,WORK,CARRY,MOVE,MOVE] : [WORK,CARRY,MOVE];
        spawn.spawnCreep(body, newName, {memory: {role: 'upgrader'}});
    }
    else if(builders.length < 2 && room.energyAvailable === room.energyCapacityAvailable) {
        const newName = 'B' + Game.time;
        const body = (room.energyCapacityAvailable >= 550) ? [WORK,WORK,CARRY,MOVE,MOVE] : [WORK,CARRY,MOVE];
        spawn.spawnCreep(body, newName, {memory: {role: 'builder'}});
    }

    if(spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        spawn.room.visual.text(
            '🛠️ ' + spawningCreep.memory.role,
            spawn.pos.x + 1, 
            spawn.pos.y, 
            {align: 'left', opacity: 0.8});
    }

    // === 執行各 Creep 的任務 ===
    for(let name in Game.creeps) {
        const creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            runHarvester(creep);
        }
        else if(creep.memory.role == 'upgrader') {
            runUpgrader(creep);
        }
        else if(creep.memory.role == 'builder') {
            runBuilder(creep);
        }
    }
}

/* Harvester 角色邏輯 */
function runHarvester(creep) {
    // 2025/10/14 若有 container優先補給，再補 Spawn/Extension
    if(creep.store.getFreeCapacity() == 0) {
        let targets = creep.room.find(FIND_STRUCTURES, {
            filter: s => (
                (s.structureType == STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                (s.structureType == STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                (s.structureType == STRUCTURE_SPAWN && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            )
        });
        const target = creep.pos.findClosestByPath(targets);
        if(target) {
            if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
    else {
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
    }
}

/* Upgrader 角色邏輯 */
function runUpgrader(creep) {
    if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.upgrading = false;
        creep.say('🔄 採集');
    }
    if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
        creep.memory.upgrading = true;
        creep.say('⚡ 升級');
    }
    if(creep.memory.upgrading) {
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#00ff00'}});
        }
    }
    else {
        // 2025/10/14：優先container補能，再source
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        if(container && creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(container, {visualizePathStyle:{stroke:'#00ff00'}});
        } else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES);
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#00ff00'}});
            }
        }
    }
}

/* Builder 角色邏輯 */
function runBuilder(creep) {
    if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.building = false;
        creep.say('🔄 採集');
    }
    if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
        creep.memory.building = true;
        creep.say('🔨 建造');
    }
    if(creep.memory.building) {
        const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if(target) {
            if(creep.build(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            else{
                creep.say('🏠滿了!');
            }
        }
        else {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
    }
    else {
        // 2025/10/14：優先container補能，再source
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        if(container && creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(container, {visualizePathStyle:{stroke:'#ffffff'}});
        } else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES);
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
    }
}




ㄠㄠㄠㄠㄠ

// main.js - Screeps 基礎三角色系統
// 2025/10/14 大幅優化與修正
// - 增加 source 旁自動建 container
// - extension 找空地更智能，避開出口
// - spawning creep 只在能量全滿時最大化body
// - 自動清理死工地
// - 部分碼註解修正

module.exports.loop = function () {
    // === 清理記憶體 ===
    for(let name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('清除記憶:', name);
        }
    }

    // === 計算各角色數量 ===
    const harvesters = _.filter(Game.creeps, c => c.memory.role == 'harvester');
    const upgraders = _.filter(Game.creeps, c => c.memory.role == 'upgrader');
    const builders = _.filter(Game.creeps, c => c.memory.role == 'builder');
    console.log('📊 Harvesters:' + harvesters.length + 
                ' | Upgraders:' + upgraders.length + 
                ' | Builders:' + builders.length);

    // 允許 Spawn 名稱變動；若找不到 Spawn1，取第一個自己的 Spawn
    const spawn = Game.spawns['Spawn1'] || Object.values(Game.spawns)[0];
    if (!spawn) {
        console.log('找不到可用的 Spawn，跳過本 tick');
        return;
    }
    const room = spawn.room;

    // ========== 2025/10/14 新增：source 旁自動建 container ==========
    // 目的：加速能量物流、減少路程浪費
    const sources = room.find(FIND_SOURCES);
    for (let source of sources) {
        // 指定右上 source（座標依據你的地圖調整，假設x>35&&y<16）
        if (source.pos.x > 35 && source.pos.y < 16) {
            const hasContainer = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType == STRUCTURE_CONTAINER &&
                    s.pos.isNearTo(source.pos)
            }).length > 0;
            const hasSite = room.find(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType == STRUCTURE_CONTAINER &&
                    s.pos.isNearTo(source.pos)
            }).length > 0;
            if (!hasContainer && !hasSite) {
                // 確保只建立一個工地（雙層迴圈 break）
                let placed = false;
                for (let dx = -1; dx <= 1 && !placed; dx++) {
                    for (let dy = -1; dy <= 1 && !placed; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const x = source.pos.x + dx, y = source.pos.y + dy;
                        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                        if (room.getTerrain().get(x, y) === TERRAIN_MASK_WALL) continue;
                        if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) continue;
                        if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) continue;
                        const res = room.createConstructionSite(x, y, STRUCTURE_CONTAINER);
                        if (res === OK) {
                            placed = true;
                            console.log('於 source 旁建立 container 工地', x, y);
                        }
                    }
                }
            }
        }
    }

    // ========== 2025/10/14 新增：自動清理爛掉太久沒蓋的 extension 工地 ==========
    // 目的：避免 extension 工地長期卡住
    const allSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION && s.progress === 0
    });
    if (allSites.length > 0 && allSites.length + room.find(FIND_MY_STRUCTURES, {filter:s=>s.structureType===STRUCTURE_EXTENSION}).length > allowedExtensionsByRCL(room.controller.level)) {
        for (let s of allSites) {
            s.remove();
            console.log('清理死工地', s.pos.x, s.pos.y);
        }
    }

    // ========== 2025/10/14 改良 extension 工地建置規則（保留通道） ==========
    // 目的：繼續自動建置(不堵出口)，並動態範圍擴大
    function allowedExtensionsByRCL(level) {
        const map = {1:0, 2:5, 3:10, 4:20, 5:30, 6:40, 7:50, 8:60};
        return map[level] || 0;
    }
    function findSmartBuildPos(spawn, maxRange = 7) {
        const room = spawn.room;
        const terrain = room.getTerrain();
        const p = spawn.pos;
        // 只挑非主要出口周邊空地：上下左右出口留空（可自訂）
        const exclude = [
            [p.x, p.y+1],
            [p.x, p.y-1],
            [p.x+1, p.y],
            [p.x-1, p.y]
        ];
        for (let r = 1; r <= maxRange; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    const x = p.x + dx, y = p.y + dy;
                    if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                    if (x === p.x && y === p.y) continue;
                    if (exclude.some( pos => pos[0]===x && pos[1]===y )) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) continue;
                    if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) continue;
                    return new RoomPosition(x, y, room.name);
                }
            }
        }
        return null;
    }
    if (room.controller) {
        const allowed = allowedExtensionsByRCL(room.controller.level);
        const existingExtCount = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        const extSiteCount = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        if (room.controller.level >= 2 && (existingExtCount + extSiteCount) < allowed) {
            const pos = findSmartBuildPos(spawn, 7);
            if (pos) {
                const res = room.createConstructionSite(pos.x, pos.y, STRUCTURE_EXTENSION);
                if (res === OK) {
                    console.log('Placed extension site at', pos.x, pos.y, `(${existingExtCount + extSiteCount + 1}/${allowed})`);
                }
            }
        }
    }
    // ===========================================

    // 緊急開局/復甦：若沒工或沒有採集者，直接生最小採集者，不等滿能量
    const totalCreeps = Object.keys(Game.creeps).length;
    if (!spawn.spawning && (harvesters.length === 0 || totalCreeps === 0)) {
        if (room.energyAvailable >= 200) {
            const name = 'boot-' + Game.time;
            const body = [WORK, CARRY, MOVE];
            const res = spawn.spawnCreep(body, name, { memory: { role: 'harvester' } });
            if (res === OK) {
                console.log('Emergency spawn:', name);
            }
        }
    }

    // 2025/10/14 改良：只有能量全滿才生產（防止只能生小 creep）
    if(harvesters.length < 2 && room.energyAvailable === room.energyCapacityAvailable) {
        const newName = 'H' + Game.time;
        const body = (room.energyCapacityAvailable >= 550) ? [WORK,WORK,CARRY,MOVE,MOVE] : [WORK,CARRY,MOVE];
        spawn.spawnCreep(body, newName, {memory: {role: 'harvester'}});
    }
    else if(upgraders.length < 1 && room.energyAvailable === room.energyCapacityAvailable) {
        const newName = 'U' + Game.time;
        const body = (room.energyCapacityAvailable >= 550) ? [WORK,WORK,CARRY,MOVE,MOVE] : [WORK,CARRY,MOVE];
        spawn.spawnCreep(body, newName, {memory: {role: 'upgrader'}});
    }
    else if(builders.length < 2 && room.energyAvailable === room.energyCapacityAvailable) {
        const newName = 'B' + Game.time;
        const body = (room.energyCapacityAvailable >= 550) ? [WORK,WORK,CARRY,MOVE,MOVE] : [WORK,CARRY,MOVE];
        spawn.spawnCreep(body, newName, {memory: {role: 'builder'}});
    }

    if(spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        spawn.room.visual.text(
            '🛠️ ' + spawningCreep.memory.role,
            spawn.pos.x + 1, 
            spawn.pos.y, 
            {align: 'left', opacity: 0.8});
    }

    // === 執行各 Creep 的任務 ===
    for(let name in Game.creeps) {
        const creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            runHarvester(creep);
        }
        else if(creep.memory.role == 'upgrader') {
            runUpgrader(creep);
        }
        else if(creep.memory.role == 'builder') {
            runBuilder(creep);
        }
    }
}

/* Harvester 角色邏輯 */
function runHarvester(creep) {
    // 2025/10/14 若有 container優先補給，再補 Spawn/Extension
    if(creep.store.getFreeCapacity() == 0) {
        // 先找 Container，有空位就優先填
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        // 若沒有可填的 Container，再找 Spawn / Extension
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (
                    (s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                )
            });
        }
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
    else {
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
    }
}

/* Upgrader 角色邏輯 */
function runUpgrader(creep) {
    if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.upgrading = false;
        creep.say('🔄 採集');
    }
    if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
        creep.memory.upgrading = true;
        creep.say('⚡ 升級');
    }
    if(creep.memory.upgrading) {
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#00ff00'}});
        }
    }
    else {
        // 2025/10/14：優先container補能，再source
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        if(container && creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(container, {visualizePathStyle:{stroke:'#00ff00'}});
        } else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES);
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#00ff00'}});
            }
        }
    }
}

/* Builder 角色邏輯 */
function runBuilder(creep) {
    if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.building = false;
        creep.say('🔄 採集');
    }
    if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
        creep.memory.building = true;
        creep.say('🔨 建造');
    }
    if(creep.memory.building) {
        const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if(target) {
            if(creep.build(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        else {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
    }
    else {
        // 2025/10/14：優先container補能，再source
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        if(container && creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(container, {visualizePathStyle:{stroke:'#ffffff'}});
        } else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES);
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
    }
}
