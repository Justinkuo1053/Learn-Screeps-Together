//Learn and build by Justin Kuo XD
// ============================================================
// main.js - Screeps 新手區16天完整發展系統
// ============================================================
// 版本: 2025/11/08 防禦優先版
// 適用場景: Novice Area 保護期內,有鄰居威脅
// 核心策略: 防禦+經濟雙軌並行, 快速衝 RCL3 解鎖 Tower
// 
// 主要功能模組:
// 1. 記憶體清理系統
// 2. 自動 Safe Mode 觸發系統 (關鍵防禦!)
// 3. 基礎建築自動建造 (Container, Extension, Storage)
// 4. 防禦建築自動
// 建造 (Tower, Rampart)
// 5. Creep 動態生產系統
// 6. 三角色工作邏輯 (Harvester, Upgrader, Builder)
// ============================================================

module.exports.loop = function () {
    
    // ========================================================
    // 模組 1: 記憶體清理系統
    // ========================================================
    // 目的: 清除已死亡 creep 的記憶體數據,避免記憶體洩漏
    // 重要性: ★★★ (長期運行必須,否則記憶體會爆滿)
    // ========================================================
    for(let name in Memory.creeps) {
        // 檢查記憶體中的 creep 是否還存活
        if(!Game.creeps[name]) {
            // creep 已死亡,從記憶體中刪除
            delete Memory.creeps[name];
            console.log('清除記憶:', name);
        }
    }

    // ========================================================
    // 模組 2: 角色統計與基礎設定
    // ========================================================
    // 目的: 統計當前各角色數量,並取得 Spawn 和 Room 物件
    // 重要性: ★★★★★ (所有後續邏輯的基礎)
    // ========================================================
    
    // 使用 lodash 的 filter 函數統計各角色數量
    const harvesters = _.filter(Game.creeps, c => c.memory.role == 'harvester'); // 採集運輸者
    const upgraders = _.filter(Game.creeps, c => c.memory.role == 'upgrader');   // 控制器升級者
    const builders = _.filter(Game.creeps, c => c.memory.role == 'builder');     // 建造修復者
    // 取得 Spawn 物件 (優先找 Spawn1,找不到就取第一個可用的)
    const spawn = Game.spawns['Spawn1'] || Object.values(Game.spawns)[0];
    
    // 在控制台輸出統計資訊 (方便監控)
    console.log('📊 H:' + harvesters.length + 
                ' | U:' + upgraders.length + 
                ' | B:' + builders.length);
    
    // 🔍 診斷: 每 10 ticks 輸出詳細狀態
    if (Game.time % 10 === 0) {
        const room = spawn.room;
        console.log('🔍 診斷報告 (Tick', Game.time, '):');
        console.log('  能量:', room.energyAvailable, '/', room.energyCapacityAvailable);
        console.log('  降級倒數:', room.controller.ticksToDowngrade, 'ticks');
        console.log('  Spawn:', spawn.spawning ? '生產中 (' + spawn.spawning.name + ')' : '閒置');
        if (upgraders.length === 0) {
            console.log('  ⚠️ 沒有 Upgrader！');
        }
    }
    
    // 如果沒有 Spawn,跳過本次循環 (異常狀況)
    if (!spawn) {
        console.log('找不到可用的 Spawn');
        return; // 直接結束本次 tick
    }
    
    // 取得 Spawn 所在的房間物件
    const room = spawn.room;

    // ========================================================
    // 模組 2.5: 攻擊記錄檢測系統 (新增)
    // ========================================================
    // 目的: 追蹤房間是否曾被攻擊
    // 檢測項目: 
    // 1. Safe Mode 是否啟動過
    // 2. 是否有受損建築
    // 3. 是否有 creep 墓碑
    // ========================================================
    
    // 初始化攻擊記錄記憶體
    if (!Memory.attackLog) {
        Memory.attackLog = {
            lastAttackTime: 0,           // 上次攻擊時間
            totalAttacks: 0,              // 總攻擊次數
            safeModeActivations: 0,       // Safe Mode 啟動次數
            creepLosses: 0                // Creep 損失數量
        };
    }
    
    // 檢查是否有受損建築（可能被攻擊）
    const damagedStructures = room.find(FIND_STRUCTURES, {
        filter: s => s.hits < s.hitsMax && 
                     s.structureType !== STRUCTURE_WALL && 
                     s.structureType !== STRUCTURE_RAMPART
    });
    
    // 檢查是否有墓碑（creep 死亡）
    const tombstones = room.find(FIND_TOMBSTONES);
    
    // 檢查 Safe Mode 狀態
    if (room.controller && room.controller.safeMode) {
        if (!Memory.attackLog.inSafeMode) {
            // 剛啟動 Safe Mode
            Memory.attackLog.inSafeMode = true;
            Memory.attackLog.lastAttackTime = Game.time;
            Memory.attackLog.totalAttacks++;
            Memory.attackLog.safeModeActivations++;
            console.log('🚨 記錄攻擊事件! 時間:', Game.time);
        }
    } else {
        Memory.attackLog.inSafeMode = false;
    }
    
    // 記錄 creep 損失
    if (tombstones.length > 0) {
        for (let tomb of tombstones) {
            if (tomb.creep.my && !tomb.ticksToDecay) {
                Memory.attackLog.creepLosses++;
            }
        }
    }
    
    // 每 100 ticks 輸出一次攻擊記錄摘要
    if (Game.time % 100 === 0 && Memory.attackLog.totalAttacks > 0) {
        console.log('📊 攻擊記錄摘要:');
        console.log('  - 總攻擊次數:', Memory.attackLog.totalAttacks);
        console.log('  - 上次攻擊:', Memory.attackLog.lastAttackTime, '(', Game.time - Memory.attackLog.lastAttackTime, 'ticks 前)');
        console.log('  - Safe Mode 啟動次數:', Memory.attackLog.safeModeActivations);
        console.log('  - Creep 損失數:', Memory.attackLog.creepLosses);
        console.log('  - 受損建築:', damagedStructures.length, '個');
    }

    // ========================================================
    // 模組 3: 自動 Safe Mode 觸發系統 (關鍵防禦機制!)
    // ========================================================
    // 目的: 檢測到敵對 creep 時自動啟動 Safe Mode 保護
    // 重要性: ★★★★★ (生存核心,防止被突襲摧毀)
    // 
    // Safe Mode 特性:
    // - 持續時間: 20,000 ticks (約 16 小時)
    // - Novice Area 特權: 無冷卻時間!可以反覆使用
    // - 效果: 敵方 creep 無法攻擊你的建築和 creep
    // - 獲得方式: 每次升級 Controller 獲得 1 次使用次數
    // 
    // 使用時機建議:
    // - 檢測到敵方 creep 立即啟動 (不要等!)
    // - 在 RCL3 達成前盡量保護自己
    // - 有多餘次數可以主動啟動避免突襲
    // ========================================================
    if (room.controller && !room.controller.safeMode) {
        // 檢查條件 1: 房間有 Controller
        // 檢查條件 2: 目前沒有在 Safe Mode 中
        
        // 搜尋房間內所有敵對 creep
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        
        // 如果發現敵人且有可用的 Safe Mode 次數
        if (hostiles.length > 0 && room.controller.safeModeAvailable > 0) {
            // 立即啟動 Safe Mode
            room.controller.activateSafeMode();
            console.log('🚨 檢測到入侵! 自動啟動 Safe Mode');
        }
    }

    // ========================================================
    // 模組 4: Container 自動建造系統
    // ========================================================
    // 目的: 在每個 Source 旁自動建造 Container 作為能量暫存站
    // 重要性: ★★★★ (大幅提升物流效率,減少 creep 往返時間)
    // 
    // Container 優點:
    // - 容量 2000 能量 (比 creep 大得多)
    // - 不會腐爛 (dropped energy 會消失)
    // - 可以讓 Harvester 專注採集, Upgrader/Builder 專注工作
    // - 建造成本: 5000 能量, 血量 5000, 不需修復頻率低
    // 
    // 建造策略:
    // - 每個 Source 旁建 1 個 Container
    // - 選擇 Source 正旁邊的空地 (距離 1 格內)
    // - 避開牆壁、已有建築、已有工地的位置
    // ========================================================
    
    // 找出房間內所有能量源
    const sources = room.find(FIND_SOURCES);
    
    // 遍歷每個能量源
    for (let source of sources) {
        // 檢查該 Source 附近是否已有 Container 建築
        const hasContainer = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER &&
                        s.pos.inRangeTo(source.pos, 1) // 距離 1 格內
        }).length > 0;
        
        // 檢查該 Source 附近是否已有 Container 工地
        const hasSite = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER &&
                        s.pos.inRangeTo(source.pos, 1)
        }).length > 0;
        
        // 如果既沒有建築也沒有工地,就建立一個
        if (!hasContainer && !hasSite) {
            let placed = false; // 標記是否已成功建立工地
            
            // 遍歷 Source 周圍 3x3 的格子
            for (let dx = -1; dx <= 1 && !placed; dx++) {
                for (let dy = -1; dy <= 1 && !placed; dy++) {
                    // 跳過 Source 本身的位置
                    if (dx === 0 && dy === 0) continue;
                    
                    // 計算實際座標
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;
                    
                    // 檢查座標是否在有效範圍內 (1-48)
                    if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                    
                    // 檢查該位置是否為牆壁地形
                    if (room.getTerrain().get(x, y) === TERRAIN_MASK_WALL) continue;
                    
                    // 檢查該位置是否已有建築物
                    if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) continue;
                    
                    // 檢查該位置是否已有工地
                    if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) continue;
                    
                    // 嘗試在該位置建立 Container 工地
                    const res = room.createConstructionSite(x, y, STRUCTURE_CONTAINER);
                    if (res === OK) {
                        placed = true; // 標記已建立,跳出迴圈
                        console.log('📦 建立 Container 工地於 Source 旁', x, y);
                    }
                }
            }
        }
    }

    // ========================================================
    // 模組 5: Tower 自動建造與運作系統
    // ========================================================
    // 目的: 自動建造 Tower 並處理攻擊/修復邏輯
    // 重要性: ★★★★★ (核心防禦建築,RCL3 後的生存關鍵)
    // 
    // Tower 詳細說明:
    // - 解鎖等級: RCL3
    // - 數量上限: RCL3→1個, RCL5→2個, RCL7→3個, RCL8→6個
    // - 攻擊力: 600 (近距離) ~ 150 (遠距離)
    // - 治療量: 400 (近距離) ~ 100 (遠距離)
    // - 修復量: 800 (近距離) ~ 200 (遠距離)
    // - 能量消耗: 每次行動 10 能量
    // - 射程: 整個房間
    // - 建造成本: 5000 能量
    // 
    // 運作邏輯優先級:
    // 1. 攻擊敵對 creep (最高優先)
    // 2. 修復受損建築 (血量 < 5000)
    // 3. 閒置等待
    // 
    // 建造位置建議:
    // - 靠近威脅方向但在 Rampart 防線後方
    // - 確保能覆蓋主要防線和 Spawn
    // ========================================================
    
    // 檢查房間等級是否達到 RCL3 (Tower 解鎖條件)
    if (room.controller && room.controller.level >= 3) {
        // 找出房間內所有已建造的 Tower
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        // 找出房間內所有 Tower 工地
        const towerSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        // 根據 RCL 決定最大 Tower 數量
        // RCL3: 1個, RCL5: 2個, RCL7: 3個, RCL8: 6個
        const maxTowers = room.controller.level >= 8 ? 6 : 
                         room.controller.level >= 7 ? 3 :
                         room.controller.level >= 5 ? 2 : 1;
        
        // 如果 Tower 總數 (建築+工地) 未達上限
        if (towers.length + towerSites.length < maxTowers) {
            // 使用智能尋找函數找到合適的建造位置
            const pos = findSmartBuildPos(spawn, 5, {avoidLowerRight: false});
            
            if (pos) {
                // 嘗試建立 Tower 工地
                const res = room.createConstructionSite(pos.x, pos.y, STRUCTURE_TOWER);
                if (res === OK) {
                    console.log('🗼 建立 Tower 工地 第', towers.length + 1, '/', maxTowers, '個');
                }
            }
        }
        
        // === Tower 自動運作邏輯 ===
        // 遍歷所有已建造的 Tower
        for (let tower of towers) {
            // 優先級 1: 攻擊敵對 creep
            // 尋找最近的敵對 creep
            const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            
            if (closestHostile) {
                // 發現敵人,立即攻擊
                tower.attack(closestHostile);
                // 不需要 continue, 讓其他邏輯不執行
            } else {
                // 優先級 2: 修復受損建築
                // 尋找最近的受損建築
                const damagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax &&              // 血量未滿
                                 s.structureType != STRUCTURE_WALL && // 排除 Wall (血量太高)
                                 s.hits < 5000                      // 只修復低血量的 (節省能量)
                });
                
                if (damagedStructure) {
                    // 修復受損建築
                    tower.repair(damagedStructure);
                }
                // 如果沒有需要修復的,Tower 閒置 (不做任何事)
            }
        }
    }

    // ========================================================
    // 模組 5.5: 左側 Wall 防線自動建造系統
    // ========================================================
    // 目的: 在左側出口建立 Wall 防線,完全封鎖鄰居入侵路徑
    // 重要性: ★★★★★ (生存關鍵,防止突襲)
    // 
    // 防線策略:
    // - 在 x=0 的位置建立 Wall 防線 (完全封鎖出口)
    // - Wall 完全阻擋移動,敵人無法通過
    // - 等之後要去左邊房間時,再改建 Rampart (可通過)
    // 
    // Wall 特性:
    // - RCL2 解鎖 (你已經 RCL3,沒問題)
    // - 建造成本: 2500 能量 (Rampart 5000)
    // - 建造進度: 1250 (Rampart 2500) - 快一倍!
    // - 初始血量: 1K,可升級到 300M
    // - 完全阻擋移動 (敵人無法通過)
    // - 不會自然衰減 (比 Rampart 更耐用)
    // 
    // 建造範圍: x=0, y=5-45 (覆蓋整個左側出口)
    // ========================================================
    
    if (room.controller && room.controller.level >= 2) {
        // ========================================================
        // 🎯 用戶自訂防禦系統 (修正版)
        // ========================================================
        // 防線位置: x=2 的左側防線
        // Y 範圍: 21-24, 35-41, 46-47
        // Tower 位置: (3,11), (3,22), (3,35), (3,41), (3,47)
        // 
        // 防禦策略:
        // - 在 x=2 建立 Wall 防線（靠近左邊邊界）
        // - 在 x=3 建立 Tower（防線後方 1 格，安全位置）
        // - Tower 能量策略：保持 800+ 能量儲備，沒攻擊時不額外充能
        // ========================================================
        
        // === 第一階段: 建立 x=2 左側防線 Wall ===
        const wallYRanges = [
            { start: 21, end: 24 },  // 第一段 (4 個 Wall)
            { start: 35, end: 41 },  // 第二段 (7 個 Wall)
            { start: 46, end: 47 }   // 第三段 (2 個 Wall)
        ];
        
        const wallX = 2; // 左側防線位置
        let wallBuiltCount = 0;
        const maxWallsPerTickCustom = 5; // 每 tick 最多建 5 個 Wall
        
        for (let range of wallYRanges) {
            for (let y = range.start; y <= range.end && wallBuiltCount < maxWallsPerTickCustom; y++) {
                // 檢查是否為牆壁地形
                if (room.getTerrain().get(wallX, y) === TERRAIN_MASK_WALL) continue;
                
                // 檢查是否已有 Wall
                const hasWall = room.lookForAt(LOOK_STRUCTURES, wallX, y)
                    .some(s => s.structureType === STRUCTURE_WALL);
                
                // 檢查是否已有工地
                const hasSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, wallX, y).length > 0;
                
                // 檢查是否已有其他建築
                const hasOtherStructure = room.lookForAt(LOOK_STRUCTURES, wallX, y).length > 0;
                
                if (!hasWall && !hasSite && !hasOtherStructure) {
                    const res = room.createConstructionSite(wallX, y, STRUCTURE_WALL);
                    if (res === OK) {
                        wallBuiltCount++;
                        console.log('🧱 左側防線 Wall (x=2):', wallX, y);
                    }
                }
            }
        }
        
        // === 第二階段: 建立 Tower (等 Wall 都建好後再建) ===
        // 統計 x=2 防線的 Wall 工地數量
        const customWallSitesCount = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_WALL && s.pos.x === wallX
        }).length;
        
        // 統計 x=2 防線已建好的 Wall 數量
        const customWallBuiltCount = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_WALL && s.pos.x === wallX
        }).length;
        
        // 📊 每 50 ticks 輸出一次狀態（方便追蹤）
        if (Game.time % 50 === 0) {
            console.log('📊 左側防線狀態:');
            console.log('  - Wall 已建造:', customWallBuiltCount, '/ 13');
            console.log('  - Wall 工地中:', customWallSitesCount);
            console.log('  - RCL:', room.controller.level);
        }
        
        // 🔧 修正: 不等 Wall 建完，直接開始建 Tower（避免等太久）
        // 條件: RCL3 以上即可建 Tower
        if (room.controller.level >= 3) {
            const towerPositions = [
                { x: 3, y: 11 },  // 北側 Tower
                { x: 3, y: 22 },  // 中北 Tower
                { x: 3, y: 35 },  // 中央 Tower
                { x: 3, y: 41 },  // 中南 Tower
                { x: 3, y: 47 }   // 南側 Tower
            ];
            
            // 統計已有的 Tower 數量
            const existingTowers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            }).length;
            
            const towerSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            }).length;
            
            // RCL 對應的 Tower 上限
            const maxTowersForRCL = room.controller.level >= 8 ? 6 : 
                                   room.controller.level >= 7 ? 3 :
                                   room.controller.level >= 5 ? 2 : 1;
            
            // 📊 輸出 Tower 狀態
            if (Game.time % 50 === 0) {
                console.log('  - Tower 已建造:', existingTowers, '/', maxTowersForRCL, '(RCL', room.controller.level, '上限)');
                console.log('  - Tower 工地中:', towerSites);
            }
            
            // 只建造 RCL 允許的數量
            let towersBuilt = 0;
            for (let pos of towerPositions) {
                // 檢查是否已達上限
                if (existingTowers + towerSites >= maxTowersForRCL) {
                    if (Game.time % 100 === 0) {
                        console.log('⚠️ Tower 已達 RCL', room.controller.level, '上限 (', maxTowersForRCL, '個)');
                    }
                    break;
                }
                
                // 檢查地形
                if (room.getTerrain().get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
                    console.log('⚠️ Tower 位置 (', pos.x, ',', pos.y, ') 是牆壁地形，跳過');
                    continue;
                }
                
                // 檢查是否已有 Tower
                const hasTower = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y)
                    .some(s => s.structureType === STRUCTURE_TOWER);
                
                // 檢查是否已有工地
                const hasSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y).length > 0;
                
                // 檢查是否已有其他建築
                const hasOtherStructure = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y)
                    .filter(s => s.structureType !== STRUCTURE_ROAD).length > 0;
                
                if (!hasTower && !hasSite && !hasOtherStructure) {
                    const res = room.createConstructionSite(pos.x, pos.y, STRUCTURE_TOWER);
                    if (res === OK) {
                        towersBuilt++;
                        console.log('🗼 建立 Tower 工地 (x=3):', pos.x, pos.y);
                    } else if (res === ERR_INVALID_TARGET) {
                        console.log('⚠️ Tower (', pos.x, ',', pos.y, ') 無法建造 ERR_INVALID_TARGET');
                    } else if (res === ERR_RCL_NOT_ENOUGH) {
                        console.log('⚠️ RCL 不足，Tower 需要 RCL3，當前 RCL', room.controller.level);
                    } else if (res === ERR_FULL) {
                        console.log('⚠️ 工地數量已滿 (100個上限)');
                    } else {
                        console.log('⚠️ Tower (', pos.x, ',', pos.y, ') 建造失敗，錯誤碼:', res);
                    }
                }
            }
        }
        
        // === 建立左側 Wall 防線 (原有的 x=2 自動防線) ===
        // ⚠️ 修正 v3: x=0 和 x=1 都無法建造 (ERR_INVALID_TARGET -7)
        // ✅ 最終方案: 在 x=2 建造 Wall 防線
        // 📝 說明: Screeps 邊界限制,x=0/1 y=0/1 x=48/49 y=48/49 都無法建造
        const terrain = room.getTerrain();
        let wallCount = 0;
        const maxWallsPerTick = 3; // 每個 tick 最多建 3 個工地 (Wall 便宜,可以多建一點)
        
        for (let y = 5; y <= 45 && wallCount < maxWallsPerTick; y++) {
            const x = 2; // ✅ 修正 v3: x=2 (邊界內第二格,可建造)
            
            // ✅ 智能判斷: 如果 x=0 或 x=1 有地形牆,x=2 就不需要建 Wall (已有天然屏障)
            if (terrain.get(0, y) === TERRAIN_MASK_WALL || terrain.get(1, y) === TERRAIN_MASK_WALL) {
                // x=0 或 x=1 已經是牆壁,不需要在 x=2 建 Wall
                continue;
            }
            
            // 跳過 x=2 本身的牆壁地形
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            
            // 檢查是否已有 Wall
            const hasWall = room.lookForAt(LOOK_STRUCTURES, x, y)
                .some(s => s.structureType === STRUCTURE_WALL);
            
            if (hasWall) continue;
            
            // 檢查是否已有任何工地
            const hasSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0;
            
            if (hasSite) continue;
            
            // 檢查是否已有其他建築 (避免覆蓋)
            const hasStructure = room.lookForAt(LOOK_STRUCTURES, x, y).length > 0;
            
            if (hasStructure) continue;
            
            // 嘗試建立 Wall 工地
            const res = room.createConstructionSite(x, y, STRUCTURE_WALL);
            if (res === OK) {
                wallCount++;
                console.log('🧱 建立左側 Wall 防線 (x=2):', x, y);
            }
        }
    }

    // ========================================================
    // 模組 6: Storage 自動建造系統
    // ========================================================
    // 目的: 在 RCL4 時自動建造 Storage 作為中央能量庫
    // 重要性: ★★★★ (中後期經濟核心,大幅提升能量管理效率)
    // 
    // Storage 詳細說明:
    // - 解鎖等級: RCL4
    // - 容量: 1,000,000 (超大容量!)
    // - 數量上限: 每個房間 1 個
    // - 建造成本: 30,000 能量
    // - 用途: 集中儲存能量, Upgrader/Builder 優先從這裡取能量
    // 
    // 建造位置建議:
    // - 靠近 Spawn 和 Controller 的中間位置
    // - 方便 Harvester 存放, Upgrader/Builder 提取
    // ========================================================
    
    // 檢查房間等級是否達到 RCL4 (Storage 解鎖條件)
    if (room.controller && room.controller.level >= 4) {
        // 找出房間內所有已建造的 Storage
        const storages = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE
        });
        
        // 找出房間內所有 Storage 工地
        const storageSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_STORAGE
        });
        
        // 如果還沒有 Storage (建築+工地都沒有)
        if (storages.length + storageSites.length === 0) {
            // 在 Spawn 附近找位置建 Storage (搜尋範圍 3 格)
            const pos = findSmartBuildPos(spawn, 3, {preferUpperLeft: true});
            
            if (pos) {
                // 嘗試建立 Storage 工地
                const res = room.createConstructionSite(pos.x, pos.y, STRUCTURE_STORAGE);
                if (res === OK) {
                    console.log('🏦 建立 Storage 工地');
                }
            }
        }
    }

    // ========================================================
    // 模組 7: Extension 自動建造系統
    // ========================================================
    // 目的: 根據 RCL 自動建造 Extension 提升能量容量
    // 重要性: ★★★★★ (經濟發展核心,決定 creep 配置上限)
    // 
    // Extension 詳細說明:
    // - 解鎖等級: RCL2
    // - 容量: 每個 50 能量 (RCL7+ 提升到 100, RCL8 提升到 200)
    // - 數量上限: 依 RCL 而定
    //   RCL1: 0個 | RCL2: 5個  | RCL3: 10個 | RCL4: 20個
    //   RCL5: 30個| RCL6: 40個 | RCL7: 50個 | RCL8: 60個
    // - 建造成本: 3000 能量
    // - 用途: 提升 Spawn 生產 creep 時可用的總能量
    // 
    // 建造策略:
    // - 優先建在左上象限 (避開右下入口)
    // - 避開 Spawn 上下左右直接出口
    // - 按距離由近到遠逐步擴展
    // ========================================================
    
    /**
     * 根據 RCL 返回允許的 Extension 數量
     * @param {number} level - 房間控制器等級 (1-8)
     * @returns {number} 該等級允許的 Extension 數量
     */
    function allowedExtensionsByRCL(level) {
        // Extension 數量映射表
        const map = {
            1: 0,   // RCL1: 無 Extension
            2: 5,   // RCL2: 5個
            3: 10,  // RCL3: 10個
            4: 20,  // RCL4: 20個
            5: 30,  // RCL5: 30個
            6: 40,  // RCL6: 40個
            7: 50,  // RCL7: 50個
            8: 60   // RCL8: 60個
        };
        return map[level] || 0; // 如果等級不在表中,返回 0
    }
    
    /**
     * 智能尋找建造位置函數
     * 目的: 找到符合條件的空地用於建造建築
     * 
     * @param {StructureSpawn} spawn - Spawn 建築物件
     * @param {number} maxRange - 最大搜尋範圍 (預設 7 格)
     * @param {Object} options - 選項設定
     * @param {boolean} options.avoidLowerRight - 是否避開右下象限 (預設 true)
     * @param {boolean} options.preferUpperLeft - 是否優先左上象限 (預設 true)
     * @returns {RoomPosition|null} 找到的位置或 null
     * 
     * 搜尋策略:
     * 1. 第一輪: 只搜尋左上象限 (如果 preferUpperLeft = true)
     * 2. 第二輪: 搜尋全部範圍 (如果第一輪沒找到)
     * 3. 按距離由近到遠搜尋 (確保建築緊湊)
     * 
     * 排除條件:
     * - 地圖邊界外
     * - Spawn 本身位置
     * - Spawn 上下左右四個出口
     * - 右下象限 (如果 avoidLowerRight = true)
     * - 牆壁地形
     * - 已有建築的位置
     * - 已有工地的位置
     */
    function findSmartBuildPos(spawn, maxRange = 7, options = {}) {
        const room = spawn.room;              // 取得房間物件
        const terrain = room.getTerrain();    // 取得地形數據
        const p = spawn.pos;                  // Spawn 的位置
        
        // 排除列表: Spawn 上下左右四個出口位置
        const exclude = [
            [p.x, p.y+1],   // Spawn 下方
            [p.x, p.y-1],   // Spawn 上方
            [p.x+1, p.y],   // Spawn 右方
            [p.x-1, p.y]    // Spawn 左方
        ];
        
        // 讀取選項 (如果沒提供,使用預設值)
        const avoidLowerRight = options.avoidLowerRight !== false; // 預設 true
        const preferUpperLeft = options.preferUpperLeft !== false; // 預設 true

        /**
         * 檢查某個座標是否符合建造條件
         * @param {number} x - X 座標
         * @param {number} y - Y 座標
         * @returns {boolean} true = 可建造, false = 不可建造
         */
        function allowed(x, y) {
            // 條件 1: 座標必須在有效範圍內 (1-48)
            if (x < 1 || x > 48 || y < 1 || y > 48) return false;
            
            // 條件 2: 不能建在 Spawn 本身位置
            if (x === p.x && y === p.y) return false;
            
            // 條件 3: 不能建在排除列表中的位置
            if (exclude.some(pos => pos[0] === x && pos[1] === y)) return false;
            
            // 條件 4: 如果啟用右下象限避讓,不能建在右下區域
            if (avoidLowerRight && x >= p.x && y >= p.y) return false;
            
            // 條件 5: 不能建在牆壁地形上
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
            
            // 條件 6: 不能建在已有建築的位置
            if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) return false;
            
            // 條件 7: 不能建在已有工地的位置
            if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) return false;
            
            // 所有條件都通過,可以建造
            return true;
        }

        // === 第一輪搜尋: 優先左上象限 ===
        if (preferUpperLeft) {
            // 按距離由近到遠搜尋 (r = 1, 2, 3, ...)
            for (let r = 1; r <= maxRange; r++) {
                // 遍歷距離 r 範圍內的所有格子
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const x = p.x + dx;
                        const y = p.y + dy;
                        
                        // 只檢查左上象限 (x <= p.x && y <= p.y)
                        if (!(x <= p.x && y <= p.y)) continue;
                        
                        // 如果該位置符合建造條件
                        if (allowed(x, y)) {
                            // 返回該位置
                            return new RoomPosition(x, y, room.name);
                        }
                    }
                }
            }
        }
        
        // === 第二輪搜尋: 全部範圍 ===
        // 如果第一輪沒找到,擴大到全部範圍
        for (let r = 1; r <= maxRange; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    const x = p.x + dx;
                    const y = p.y + dy;
                    
                    // 如果該位置符合建造條件
                    if (allowed(x, y)) {
                        // 返回該位置
                        return new RoomPosition(x, y, room.name);
                    }
                }
            }
        }
        
        // 找不到合適位置,返回 null
        return null;
    }
    
    // === Extension 建造主邏輯 ===
    // 檢查房間是否有 Controller
    if (room.controller) {
        // 取得當前 RCL 允許的 Extension 數量
        const allowed = allowedExtensionsByRCL(room.controller.level);
        
        // 統計已建造的 Extension 數量
        const existingExtCount = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        
        // 統計正在建造的 Extension 工地數量
        const extSiteCount = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        
        // 如果 RCL >= 2 (Extension 解鎖) 且總數未達上限
        if (room.controller.level >= 2 && (existingExtCount + extSiteCount) < allowed) {
            // 使用智能尋找函數找位置
            const pos = findSmartBuildPos(spawn, 7, { 
                preferUpperLeft: true,    // 優先左上象限
                avoidLowerRight: true     // 避開右下入口
            });
            
            if (pos) {
                // 嘗試建立 Extension 工地
                const res = room.createConstructionSite(pos.x, pos.y, STRUCTURE_EXTENSION);
                if (res === OK) {
                    console.log('⚡ Extension', existingExtCount + extSiteCount + 1, '/', allowed);
                }
            }
        }
    }

    // ========================================================
    // 模組 8: Creep 動態生產系統
    // ========================================================
    // 目的: 根據 RCL 和當前狀況動態生產 creep
    // 重要性: ★★★★★ (人口管理核心)
    // 
    // 生產策略說明:
    // 
    // 1. 緊急啟動模式:
    //    - 觸發條件: Harvester = 0 或 總 creep = 0
    //    - 行為: 立即生產最小配置 Harvester (不等能量全滿)
    //    - 目的: 避免經濟崩潰, 快速恢復生產
    // 
    // 2. 正常生產模式:
    //    - Harvester: 不等能量全滿, 依現有能量生產最大配置
    //    - Upgrader: 等能量全滿才生產 (確保最大配置)
    //    - Builder: 等能量全滿才生產 (確保最大配置)
    // 
    // 3. 動態角色配置 (依 RCL 調整):
    //    RCL 1-2: H:4 U:3 B:2 (衝 RCL3 解鎖 Tower)
    //    RCL 3-4: H:4 U:2 B:2 (穩固防禦)
    //    RCL 5+:  H:5 U:3 B:2 (穩定運營)
    // 
    // 4. Body 配置梯度 (依可用能量選擇):
    //    800+: 高級配置 (4-6 個部件)
    //    550+: 中高配置 (4-5 個部件)
    //    400+: 中級配置 (3-4 個部件)
    //    300+: 標準配置 (3 個部件)
    //    200+: 最小配置 (3 個部件)
    // ========================================================
    
    // 取得當前 RCL
    const rcl = room.controller ? room.controller.level : 1;
    
    // === 動態角色配置 (依 RCL 調整) ===
    let targetHarvesters, targetUpgraders, targetBuilders;
    
    if (rcl < 3) {
        // 🚨 緊急模式: 全力衝 RCL3 (Safe Mode 即將結束!)
        targetHarvesters = 3;  // 減少採集者 (夠用就好)
        targetUpgraders = 6;   // 💥 激增 Upgrader! (全力升級)
        targetBuilders = 0;    // 🛑 暫停建造 (節省能量)
    } else if (rcl < 5) {
        // RCL 3-4: 防禦建設模式
        targetHarvesters = 4;  // 維持能量供應
        targetUpgraders = 2;   // 持續升級
        targetBuilders = 3;    // 💪 增加 Builder 加速防線建造
    } else {
        // RCL 5+: 穩定運營
        targetHarvesters = 5;  // 增加採集效率
        targetUpgraders = 3;   // 加強升級
        targetBuilders = 2;    // 維持建造修復
    }
    
    // 統計當前總 creep 數量
    const totalCreeps = Object.keys(Game.creeps).length;
    
    // ========================================================
    // 生產邏輯 1: 緊急啟動模式
    // ========================================================
    // 觸發條件: 沒有 Harvester 或總 creep 數為 0
    // 目的: 經濟崩潰時快速恢復,避免卡死
    // 特點: 不等能量全滿,有 200 能量就立即生產最小配置
    // ========================================================
    if (!spawn.spawning && (harvesters.length === 0 || totalCreeps === 0)) {
        // 檢查當前可用能量是否足夠生產最小 creep (200 能量)
        if (room.energyAvailable >= 200) {
            // 生成緊急啟動 creep 名稱 (boot = 啟動)
            const name = 'boot-' + Game.time;
            
            // 最小配置: 1 WORK + 1 CARRY + 1 MOVE
            // WORK: 採集能量, CARRY: 運輸能量, MOVE: 移動
            const body = [WORK, CARRY, MOVE];
            
            // 嘗試生產 creep
            const res = spawn.spawnCreep(body, name, { memory: { role: 'harvester' } });
            if (res === OK) {
                console.log('🚨 緊急啟動:', name);
            }
        }
    }
    
    // ========================================================
    // 生產邏輯 2: 正常生產 Harvester
    // ========================================================
    // 觸發條件: Spawn 閒置 且 Harvester 數量 < 目標數量
    // 特點: 不等能量全滿,根據當前能量選擇最佳配置
    // 目的: 快速補充 Harvester,避免經濟停滯
    // ========================================================
    else if (!spawn.spawning && harvesters.length < targetHarvesters) {
        // 取得當前可用能量
        const ea = room.energyAvailable;
        
        // 根據可用能量選擇最佳 body 配置
        let body;
        if (ea >= 800) {
            // 高級配置 (800 能量)
            // 4 WORK: 採集速度 8/tick
            // 2 CARRY: 容量 100
            // 3 MOVE: 負重移動不減速
            body = [WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE];
        }
        else if (ea >= 550) {
            // 中高配置 (550 能量)
            // 3 WORK: 採集速度 6/tick
            // 1 CARRY: 容量 50
            // 2 MOVE: 基本移動速度
            body = [WORK,WORK,WORK,CARRY,MOVE,MOVE];
        }
        else if (ea >= 400) {
            // 中級配置 (400 能量)
            // 2 WORK: 採集速度 4/tick
            // 1 CARRY: 容量 50
            // 1 MOVE: 基本移動
            body = [WORK,WORK,CARRY,MOVE];
        }
        else if (ea >= 300) {
            // 標準配置 (300 能量)
            // 1 WORK: 採集速度 2/tick
            // 1 CARRY: 容量 50
            // 2 MOVE: 提升移動速度
            body = [WORK,CARRY,MOVE,MOVE];
        }
        else if (ea >= 200) {
            // 最小配置 (200 能量)
            // 1 WORK: 採集速度 2/tick
            // 1 CARRY: 容量 50
            // 1 MOVE: 基本移動
            body = [WORK,CARRY,MOVE];
        }
        
        // 如果有可用的 body 配置
        if (body) {
            // 生成 Harvester 名稱 (H = Harvester)
            const newName = 'H' + Game.time;
            
            // 嘗試生產 creep
            const res = spawn.spawnCreep(body, newName, { memory: { role: 'harvester' } });
            if (res === OK) {
                console.log('⛏️ 生產 Harvester (能量:', ea, ') ->', newName);
            }
        }
    }
    
    // ========================================================
    // 生產邏輯 3: 正常生產 Upgrader
    // ========================================================
    // 🔧 修正: RCL4+ 時 Upgrader 很重要，不能等能量全滿
    // 策略: 
    // - 有 200 能量就生產（避免降級）
    // - 優先生產防止 Controller downgrade
    // ========================================================
    else if(upgraders.length < targetUpgraders) {
        // 🚨 緊急: 如果沒有 Upgrader 或 Controller 快降級，立即生產最小配置
        const controllerNearDowngrade = room.controller.ticksToDowngrade < 20000;
        const noUpgraders = upgraders.length === 0;
        
        if ((noUpgraders || controllerNearDowngrade) && room.energyAvailable >= 200) {
            // 緊急模式: 生產最小 Upgrader
            const body = [WORK, CARRY, MOVE];
            const newName = 'Emergency_U' + Game.time;
            const res = spawn.spawnCreep(body, newName, {memory: {role: 'upgrader'}});
            if (res === OK) {
                console.log('🚨 緊急生產 Upgrader (防降級) ->', newName);
            }
        }
        // 正常模式: 等能量充足再生產更好的配置
        else if (room.energyAvailable >= 550 || room.energyAvailable === room.energyCapacityAvailable) {
            // 生成 Upgrader 名稱 (U = Upgrader)
            const newName = 'U' + Game.time;
            
            // 根據當前能量選擇最佳 body 配置
            let body;
            if (room.energyAvailable >= 800) {
                // 🔥 超級配置 (800 能量) - 升級效率最大化!
                // 5 WORK: 升級速度 5/tick
                // 3 CARRY: 容量 150 (更少往返)
                // 2 MOVE: 基本移動速度
                body = [WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE];
            }
            else if (room.energyAvailable >= 550) {
                // 中級配置 (550 能量)
                // 3 WORK: 升級速度 3/tick
                // 2 CARRY: 容量 100
                // 2 MOVE: 基本移動速度
                body = [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE];
            }
            else {
                // 最小配置 (200 能量)
                body = [WORK,CARRY,MOVE];
            }
            
            // 嘗試生產 creep
            const res = spawn.spawnCreep(body, newName, {memory: {role: 'upgrader'}});
            if (res === OK) {
                console.log('⚡ 生產 Upgrader ->', newName);
            }
        }
    }
    
    // ========================================================
    // 生產邏輯 4: 正常生產 Builder
    // ========================================================
    // 🔧 修正: Builder 也不用等能量全滿
    // 策略: 有 400+ 能量就可以生產（建造需求沒那麼急）
    // ========================================================
    else if(builders.length < targetBuilders && room.energyAvailable >= 400) {
        // 生成 Builder 名稱 (B = Builder)
        const newName = 'B' + Game.time;
        
        // 根據能量容量選擇最佳 body 配置
        let body;
        if (room.energyCapacityAvailable >= 800) {
            // 高級配置 (800 能量)
            // 3 WORK: 建造速度 3/tick
            // 2 CARRY: 容量 100
            // 3 MOVE: 提升移動速度
            body = [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE];
        }
        else if (room.energyCapacityAvailable >= 550) {
            // 中級配置 (550 能量)
            // 2 WORK: 建造速度 2/tick
            // 1 CARRY: 容量 50
            // 2 MOVE: 基本移動速度
            body = [WORK,WORK,CARRY,MOVE,MOVE];
        }
        else {
            // 最小配置 (200 能量)
            body = [WORK,CARRY,MOVE];
        }
        
        // 嘗試生產 creep
        const res = spawn.spawnCreep(body, newName, {memory: {role: 'builder'}});
        if (res === OK) {
            console.log('🔨 生產 Builder ->', newName);
        }
    }

    // ========================================================
    // Spawn 狀態顯示
    // ========================================================
    // 如果 Spawn 正在生產 creep,在遊戲畫面上顯示狀態
    // ========================================================
    if(spawn.spawning) {
        // 取得正在生產的 creep 物件
        const spawningCreep = Game.creeps[spawn.spawning.name];
        
        // 在 Spawn 旁邊顯示正在生產的角色
        spawn.room.visual.text(
            '🛠️' + spawningCreep.memory.role, // 顯示角色名稱
            spawn.pos.x + 1,                   // X 座標 (Spawn 右邊)
            spawn.pos.y,                       // Y 座標 (與 Spawn 同高)
            {align: 'left', opacity: 0.8}      // 左對齊,透明度 0.8
        );
    }

    // ========================================================
    // 模組 9: Creep 任務執行系統
    // ========================================================
    // 目的: 遍歷所有 creep 並根據角色執行對應的工作邏輯
    // 重要性: ★★★★★ (Creep 行為核心)
    // ========================================================
    
    // 遍歷所有存活的 creep
    for(let name in Game.creeps) {
        const creep = Game.creeps[name]; // 取得 creep 物件
        
        // 根據 creep 的角色執行對應的邏輯函數
        if(creep.memory.role == 'harvester') {
            runHarvester(creep); // 執行 Harvester 邏輯
        }
        else if(creep.memory.role == 'upgrader') {
            runUpgrader(creep);  // 執行 Upgrader 邏輯
        }
        else if(creep.memory.role == 'builder') {
            runBuilder(creep);   // 執行 Builder 邏輯
        }
    }
}

// ============================================================
// Harvester 角色邏輯函數
// ============================================================
// 角色定位: 採集者 + 運輸者
// 主要任務: 從 Source/Container 採集能量 → 運送到 Spawn/Extension/Tower/Storage
// 工作流程:
//   1. 背包空 → 去採集能量 (優先從 Container 取,沒有才直接採 Source)
//   2. 背包滿 → 運送能量 (優先級: Spawn/Extension > Tower > Storage > Container)
//   3. 無處存放 → 協助建造或升級 (避免閒置)
// 
// 優先級邏輯說明:
// - Spawn/Extension: 最高優先 (確保能持續生產 creep)
// - Tower: 次優先 (確保防禦能力)
// - Storage: 中優先 (大容量儲能)
// - Container: 低優先 (距離限制 20 格,避免走太遠)
// ============================================================
function runHarvester(creep) {
    
    // === 階段判斷: 背包是否已滿 ===
    if(creep.store.getFreeCapacity() == 0) {
        // 背包已滿,進入運送模式
        
        // --- 優先級 1: 補給 Spawn/Extension ---
        // 目的: 確保能持續生產 creep,經濟不中斷
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_EXTENSION || 
                         s.structureType === STRUCTURE_SPAWN) &&
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // --- 優先級 2: 補給 Tower ---
        // 目的: 確保防禦建築有能量可以攻擊和修復
        // 注意: 只在 Tower 能量低於 800 時補給 (避免過度補給)
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER &&
                            s.store[RESOURCE_ENERGY] < 800
            });
        }
        
        // --- 優先級 3: 補給 Storage ---
        // 目的: 將多餘能量存入中央儲能庫
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
        }
        
        // --- 優先級 4: 補給 Container ---
        // 目的: 作為二級暫存點
        // 注意: 有距離限制,避免為了 Container 走太遠
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
        }
        
        // 如果找到目標建築
        if (target) {
            // 嘗試轉移能量到目標
            const transferResult = creep.transfer(target, RESOURCE_ENERGY);
            
            if (transferResult == ERR_NOT_IN_RANGE) {
                // 不在範圍內,移動過去
                creep.moveTo(target, { 
                    visualizePathStyle: { stroke: '#ffaa00' } // 黃色路徑
                });
            }
        } else {
            // --- 無處存放: 在 Spawn 旁邊等待 ---
            // 🔧 修正: 不要亂花能量！等待能量建築有空間
            // 原因: 如果 Harvester 去建造/升級，會把能量用掉
            //       導致房間能量累積不到 550，無法生產 Upgrader
            
            // 移動到 Spawn 旁邊待命
            const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn && !creep.pos.isNearTo(spawn)) {
                creep.moveTo(spawn, {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
            creep.say('💤'); // 顯示等待圖示
        }
    }
    else {
        // 背包未滿,進入採集模式
        
        // --- 採集策略 1: 優先從 Container 提取能量 ---
        // 目的: 減少直接採集的 creep 數量,提升效率
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] > 0 // 確保有能量
        });
        
        if (container) {
            // 找到有能量的 Container
            const withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
            
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                // 不在範圍內,移動過去
                creep.moveTo(container, {
                    visualizePathStyle: {stroke: '#ffaa00'} // 黃色路徑
                });
            }
        } else {
            // --- 採集策略 2: Container 沒能量才直接採集 Source ---
            
            // 優先使用路徑查找 (findClosestByPath)
            let source = creep.pos.findClosestByPath(FIND_SOURCES);
            
            // 如果找不到路徑,退而求其次用直線距離 (findClosestByRange)
            // 這種情況通常發生在被阻擋或路徑複雜時
            if (!source) {
                source = creep.pos.findClosestByRange(FIND_SOURCES);
            }
            
            if (source) {
                // 找到 Source,嘗試採集
                const harvestResult = creep.harvest(source);
                
                if (harvestResult == ERR_NOT_IN_RANGE) {
                    // 不在範圍內,移動過去
                    creep.moveTo(source, {
                        visualizePathStyle: {stroke: '#ffaa00'} // 黃色路徑
                    });
                }
            }
        }
    }
}

// ============================================================
// Upgrader 角色邏輯函數
// ============================================================
// 角色定位: 控制器升級專員
// 主要任務: 持續升級房間控制器 (Controller) 提升 RCL
// 工作流程:
//   1. 背包空 → 去補充能量 (優先 Storage > Container > Source)
//   2. 背包滿 → 去升級控制器
//   3. 使用記憶體標記狀態,避免頻繁切換
// 
// 能量來源優先級:
// - Storage: 最高優先 (大容量,專為長期工作設計)
// - Container: 次優先 (暫存站)
// - Source: 最低優先 (直接採集效率低)
// 
// 狀態機制:
// - memory.upgrading = true: 升級模式
// - memory.upgrading = false: 採集模式
// ============================================================
function runUpgrader(creep) {
    
    // === 初始化記憶體 (修正: 新 Upgrader 需要初始狀態) ===
    if (creep.memory.upgrading === undefined) {
        creep.memory.upgrading = false; // 預設: 先去採集能量
    }
    
    // === 狀態切換邏輯 ===
    
    // 如果正在升級但能量用完了
    if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.upgrading = false; // 切換到採集模式
        creep.say('🔄 採集');           // 顯示切換圖示
    }
    
    // 如果不在升級且背包滿了
    if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
        creep.memory.upgrading = true;  // 切換到升級模式
        creep.say('⚡ 升級');           // 顯示升級圖示
    }
    
    // === 執行對應的行動 ===
    
    if(creep.memory.upgrading) {
        // --- 升級模式 ---
        // 嘗試升級控制器
        const upgradeResult = creep.upgradeController(creep.room.controller);
        
        if (upgradeResult == ERR_NOT_IN_RANGE) {
            // 不在範圍內,移動過去
            creep.moveTo(creep.room.controller, {
                visualizePathStyle: {stroke: '#00ff00'} // 綠色路徑
            });
        }
    }
    else {
        // --- 採集模式 ---
        
        // 優先級 1: 從 Storage 提取能量
        // Storage 容量大,專為長期工作者設計
        const storage = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_STORAGE &&
                        s.store[RESOURCE_ENERGY] > 0
        });
        
        if (storage) {
            // 找到 Storage
            const withdrawResult = creep.withdraw(storage, RESOURCE_ENERGY);
            
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                // 不在範圍內,移動過去
                creep.moveTo(storage, {
                    visualizePathStyle: {stroke: '#00ff00'} // 綠色路徑
                });
            }
        } else {
            // 優先級 2: 從 Container 提取能量
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType == STRUCTURE_CONTAINER &&
                            s.store[RESOURCE_ENERGY] > 0
            });
            
            if(container) {
                // 找到 Container
                const withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
                
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    // 不在範圍內,移動過去
                    creep.moveTo(container, {
                        visualizePathStyle:{stroke:'#00ff00'} // 綠色路徑
                    });
                }
            } else {
                // 優先級 3: 直接從 Source 採集
                const source = creep.pos.findClosestByPath(FIND_SOURCES);
                
                if(source) {
                    // 找到 Source
                    const harvestResult = creep.harvest(source);
                    
                    if (harvestResult == ERR_NOT_IN_RANGE) {
                        // 不在範圍內,移動過去
                        creep.moveTo(source, {
                            visualizePathStyle: {stroke: '#00ff00'} // 綠色路徑
                        });
                    }
                }
            }
        }
    }
}

// ============================================================
// Builder 角色邏輯函數
// ============================================================
// 角色定位: 建造者 + 修復者
// 主要任務: 建造工地 → 修復防禦建築 → 沒工地時協助升級
// 工作流程:
//   1. 背包空 → 去補充能量 (優先 Storage > Container > Source)
//   2. 背包滿 → 優先建造 (防禦建築 > 經濟建築)
//   3. 沒工地 → 修復低血量防禦建築
//   4. 都沒事 → 協助升級控制器
// 
// 工作優先級:
// - 建造工地: 最高優先 (Tower > Rampart > Extension > 其他)
// - 修復防禦: 次優先 (Rampart < 10K 血量)
// - 升級控制器: 低優先 (避免閒置)
// 
// 狀態機制:
// - memory.building = true: 建造模式
// - memory.building = false: 採集模式
// ============================================================
function runBuilder(creep) {
    
    // === 初始化記憶體 (修正: 新 Builder 需要初始狀態) ===
    if (creep.memory.building === undefined) {
        creep.memory.building = false; // 預設: 先去採集能量
    }
    
    // === 狀態切換邏輯 ===
    
    // 如果正在建造但能量用完了
    if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.building = false; // 切換到採集模式
        creep.say('🔄 採集');          // 顯示切換圖示
    }
    
    // 如果不在建造且背包滿了
    if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
        creep.memory.building = true;  // 切換到建造模式
        creep.say('🔨 建造');          // 顯示建造圖示
    }
    
    // === 執行對應的行動 ===
    
    if(creep.memory.building) {
        // --- 建造模式 ---
        
        // 優先級 1: 建造 Tower (最優先)
        let target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        // 優先級 2: 建造 Wall (防禦優先 - 封鎖左側出口)
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_WALL
            });
        }
        
        // 優先級 3: 建造 Extension (經濟發展)
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            });
        }
        
        // 優先級 4: 建造其他建築
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        }
        
        if(target) {
            // 找到工地,進行建造
            const buildResult = creep.build(target);
            
            if (buildResult == ERR_NOT_IN_RANGE) {
                // 不在範圍內,移動過去
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#ffffff'} // 白色路徑
                });
            }
        }
        else {
            // === 沒有工地: 修復低血量防禦建築 ===
            const damagedDefense = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_WALL || 
                             s.structureType === STRUCTURE_RAMPART) &&
                            s.hits < 10000 // 只修復低於 10K 血量的
            });
            
            if (damagedDefense) {
                const repairResult = creep.repair(damagedDefense);
                
                if (repairResult == ERR_NOT_IN_RANGE) {
                    creep.moveTo(damagedDefense, {
                        visualizePathStyle: {stroke: '#ffffff'}
                    });
                }
                creep.say('🔧'); // 顯示修復圖示
            } else {
                // 都沒事,協助升級控制器 (避免閒置)
                const upgradeResult = creep.upgradeController(creep.room.controller);
                
                if (upgradeResult == ERR_NOT_IN_RANGE) {
                    // 不在範圍內,移動過去
                    creep.moveTo(creep.room.controller, {
                        visualizePathStyle: {stroke: '#ffffff'} // 白色路徑
                    });
                }
            }
        }
    }
    else {
        // --- 採集模式 ---
        
        // 優先級 1: 從 Storage 提取能量
        const storage = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType == STRUCTURE_STORAGE &&
                        s.store[RESOURCE_ENERGY] > 0
        });
        
        if (storage) {
            // 找到 Storage
            const withdrawResult = creep.withdraw(storage, RESOURCE_ENERGY);
            
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                // 不在範圍內,移動過去
                creep.moveTo(storage, {
                    visualizePathStyle: {stroke: '#ffffff'} // 白色路徑
                });
            }
        } else {
            // 優先級 2: 從 Container 提取能量
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType == STRUCTURE_CONTAINER &&
                            s.store[RESOURCE_ENERGY] > 0
            });
            
            if(container) {
                // 找到 Container
                const withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
                
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    // 不在範圍內,移動過去
                    creep.moveTo(container, {
                        visualizePathStyle:{stroke:'#ffffff'} // 白色路徑
                    });
                }
            } else {
                // 優先級 3: 直接從 Source 採集
                const source = creep.pos.findClosestByPath(FIND_SOURCES);
                
                if(source) {
                    // 找到 Source
                    const harvestResult = creep.harvest(source);
                    
                    if (harvestResult == ERR_NOT_IN_RANGE) {
                        // 不在範圍內,移動過去
                        creep.moveTo(source, {
                            visualizePathStyle: {stroke: '#ffffff'} // 白色路徑
                        });
                    }
                }
            }
        }
    }
}

// ============================================================
// 程式碼結束
// ============================================================
// 總結: 這是一個完整的新手區發展系統,包含:
// ✅ 自動 Safe Mode 防禦
// ✅ 基礎建築自動建造 (Container, Extension, Storage)
// ✅ 防禦建築自動建造 (Tower)
// ✅ 動態 Creep 生產系統
// ✅ 三角色完整工作邏輯
// 
// 適用場景: Novice Area 16天保護期
// 目標: 快速衝到 RCL3-5, 建立完整防禦體系
// ============================================================
// // Basic configuration for a new room in Screeps

// module.exports.loop = function () {
//     const roomName = 'W3N28'; // Replace with your actual room name
//     const room = Game.rooms[roomName];

//     // Check if the room exists and is visible
//     if (!room) {
//         console.log(`Room ${roomName} is not visible.`);
//         return;
//     }

//     // Step 1: Harvest Energy
//     const sources = room.find(FIND_SOURCES);
//     for (const source of sources) {
//         const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester');
//         if (harvesters.length < sources.length) {
//             Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], `Harvester${Game.time}`, {
//                 memory: { role: 'harvester', sourceId: source.id }
//             });
//         }
//     }

//     // Step 2: Build Basic Structures
//     if (Game.spawns['Spawn1'].store[RESOURCE_ENERGY] > 200) {
//         const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
//         if (constructionSites.length === 0) {
//             room.createConstructionSite(25, 25, STRUCTURE_EXTENSION);
//             room.createConstructionSite(26, 25, STRUCTURE_CONTAINER);
//         }
//     }

//     // Step 3: Upgrade Controller
//     const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader');
//     console.log(`Number of upgraders: ${upgraders.length}`); // Log the number of upgraders

//     if (upgraders.length < 2) {
//         Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], `Upgrader${Game.time}`, {
//             memory: { role: 'upgrader' }
//         });
//     }

//     for (const name in Game.creeps) {
//         const creep = Game.creeps[name];
//         if (creep.memory.role === 'harvester') {
//             const source = Game.getObjectById(creep.memory.sourceId);
//             if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
//                 creep.moveTo(source);
//             }
//         } else if (creep.memory.role === 'upgrader') {
//             console.log(`Upgrader ${creep.name} energy: ${creep.store[RESOURCE_ENERGY]}`);
//             if (creep.store[RESOURCE_ENERGY] > 0) {
//                 const upgradeResult = creep.upgradeController(room.controller);
//                 if (upgradeResult === ERR_NOT_IN_RANGE) {
//                     console.log(`Upgrader ${creep.name} moving to controller.`);
//                     creep.moveTo(room.controller);
//                 } else if (upgradeResult !== OK) {
//                     console.log(`Upgrader ${creep.name} failed to upgrade controller: ${upgradeResult}`);
//                 }
//             } else {
//                 const closestContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
//                     filter: (structure) => structure.structureType === STRUCTURE_CONTAINER &&
//                         structure.store[RESOURCE_ENERGY] > 0
//                 });
//                 if (closestContainer) {
//                     const withdrawResult = creep.withdraw(closestContainer, RESOURCE_ENERGY);
//                     if (withdrawResult === ERR_NOT_IN_RANGE) {
//                         console.log(`Upgrader ${creep.name} moving to container.`);
//                         creep.moveTo(closestContainer);
//                     } else if (withdrawResult !== OK) {
//                         console.log(`Upgrader ${creep.name} failed to withdraw energy: ${withdrawResult}`);
//                     }
//                 } else {
//                     console.log(`Upgrader ${creep.name} could not find a container with energy.`);
//                     const closestSource = creep.pos.findClosestByPath(FIND_SOURCES);
//                     if (closestSource && creep.harvest(closestSource) === ERR_NOT_IN_RANGE) {
//                         console.log(`Upgrader ${creep.name} moving to source.`);
//                         creep.moveTo(closestSource);
//                     }
//                 }
//             }
//         }
//     }
// };