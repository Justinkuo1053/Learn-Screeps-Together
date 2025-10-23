// main.ts - Screeps 基礎三角色系統 (TypeScript 版)
// 來源：test.10.17.js，同步 2025/10/17 版邏輯

// 注意：此檔案假設在 Screeps 環境下執行，依賴全域 Game/Memory/Room 等型別（由 @types/screeps 提供）

declare const _: _.LoDashStatic; // Screeps 預設提供 lodash

export const loop = function (): void {
  // === 清理記憶體 ===
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      console.log('清除記憶:', name);
    }
  }

  // === 計算各角色數量 ===
  const harvesters = _.filter(Game.creeps, (c) => c.memory.role == 'harvester');
  const upgraders = _.filter(Game.creeps, (c) => c.memory.role == 'upgrader');
  const builders = _.filter(Game.creeps, (c) => c.memory.role == 'builder');
  console.log(
    '📊 Harvesters:' +
      harvesters.length +
      ' | Upgraders:' +
      upgraders.length +
      ' | Builders:' +
      builders.length
  );

  // 允許 Spawn 名稱變動；若找不到 Spawn1，取第一個自己的 Spawn
  const spawn: StructureSpawn | undefined = Game.spawns['Spawn1'] || Object.values(Game.spawns)[0];
  if (!spawn) {
    console.log('找不到可用的 Spawn，跳過本 tick');
    return;
  }
  const room = spawn.room;

  // ========== 2025/10/14 新增：source 旁自動建 container ==========
  const sources = room.find(FIND_SOURCES);
  for (const source of sources) {
    if (source.pos.x > 35 && source.pos.y < 16) {
      const hasContainer =
        room.find(FIND_STRUCTURES, {
          filter: (s: AnyStructure) =>
            s.structureType == STRUCTURE_CONTAINER && s.pos.isNearTo(source.pos),
        }).length > 0;
      const hasSite =
        room.find(FIND_CONSTRUCTION_SITES, {
          filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.pos.isNearTo(source.pos),
        }).length > 0;
      if (!hasContainer && !hasSite) {
        let placed = false;
        for (let dx = -1; dx <= 1 && !placed; dx++) {
          for (let dy = -1; dy <= 1 && !placed; dy++) {
            if (dx === 0 && dy === 0) continue;
            const x = source.pos.x + dx,
              y = source.pos.y + dy;
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
  const allSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
    filter: (s) => s.structureType === STRUCTURE_EXTENSION && s.progress === 0,
  });
  if (
    allSites.length > 0 &&
    allSites.length +
      room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION }).length >
      allowedExtensionsByRCL(room.controller!.level)
  ) {
    for (const s of allSites) {
      s.remove();
      console.log('清理死工地', s.pos.x, s.pos.y);
    }
  }

  function allowedExtensionsByRCL(level: number): number {
    const map: Record<number, number> = { 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 };
    return map[level] || 0;
  }
  function findSmartBuildPos(
    spawn: StructureSpawn,
    maxRange: number = 7,
    options: { avoidLowerRight?: boolean; preferUpperLeft?: boolean } = {}
  ): RoomPosition | null {
    const room = spawn.room;
    const terrain = room.getTerrain();
    const p = spawn.pos;
    const exclude: Array<[number, number]> = [
      [p.x, p.y + 1],
      [p.x, p.y - 1],
      [p.x + 1, p.y],
      [p.x - 1, p.y],
    ];
    const avoidLowerRight = options.avoidLowerRight !== false;
    const preferUpperLeft = options.preferUpperLeft !== false;

    function allowed(x: number, y: number): boolean {
      if (x < 1 || x > 48 || y < 1 || y > 48) return false;
      if (x === p.x && y === p.y) return false;
      if (exclude.some((pos) => pos[0] === x && pos[1] === y)) return false;
      if (avoidLowerRight && x >= p.x && y >= p.y) return false;
      if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
      if (room.lookForAt(LOOK_STRUCTURES, x, y).length > 0) return false;
      if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0) return false;
      return true;
    }

    if (preferUpperLeft) {
      for (let r = 1; r <= maxRange; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            const x = p.x + dx,
              y = p.y + dy;
            if (!(x <= p.x && y <= p.y)) continue;
            if (allowed(x, y)) {
              return new RoomPosition(x, y, room.name);
            }
          }
        }
      }
    }
    for (let r = 1; r <= maxRange; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const x = p.x + dx,
            y = p.y + dy;
          if (allowed(x, y)) {
            return new RoomPosition(x, y, room.name);
          }
        }
      }
    }
    return null;
  }

  if (room.controller) {
    const allowed = allowedExtensionsByRCL(room.controller.level);
    const existingExtCount = room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_EXTENSION,
    }).length;
    const extSiteCount = room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (s) => s.structureType === STRUCTURE_EXTENSION,
    }).length;
    if (room.controller.level >= 2 && existingExtCount + extSiteCount < allowed) {
      const pos = findSmartBuildPos(spawn, 7, { preferUpperLeft: true, avoidLowerRight: true });
      if (pos) {
        const res = room.createConstructionSite(pos.x, pos.y, STRUCTURE_EXTENSION);
        if (res === OK) {
          console.log(
            'Placed extension site at',
            pos.x,
            pos.y,
            `(${existingExtCount + extSiteCount + 1}/${allowed})`
          );
        }
      }
    }
  }

  // 緊急開局/復甦
  const totalCreeps = Object.keys(Game.creeps).length;
  if (!spawn.spawning && (harvesters.length === 0 || totalCreeps === 0)) {
    if (room.energyAvailable >= 200) {
      const name = 'boot-' + Game.time;
      const body: BodyPartConstant[] = [WORK, CARRY, MOVE];
      const res = spawn.spawnCreep(body, name, { memory: { role: 'harvester' } as any });
      if (res === OK) {
        console.log('Emergency spawn:', name);
      }
    }
  }

  // 採集者維持 2 隻，不再要求滿能量才生
  if (!spawn.spawning && harvesters.length < 2) {
    const ea = room.energyAvailable;
    let body: BodyPartConstant[] | undefined;
    if (ea >= 550) body = [WORK, WORK, WORK, CARRY, MOVE, MOVE];
    else if (ea >= 400) body = [WORK, WORK, CARRY, MOVE];
    else if (ea >= 300) body = [WORK, CARRY, MOVE, MOVE];
    else if (ea >= 200) body = [WORK, CARRY, MOVE];
    if (body) {
      const newName = 'H' + Game.time;
      const res = spawn.spawnCreep(body, newName, { memory: { role: 'harvester' } as any });
      if (res === OK) console.log('Spawn harvester (EA:', ea, ') ->', newName, JSON.stringify(body));
    }
  } else if (upgraders.length < 1 && room.energyAvailable === room.energyCapacityAvailable) {
    const newName = 'U' + Game.time;
    const body: BodyPartConstant[] = room.energyCapacityAvailable >= 550 ? [WORK, WORK, CARRY, MOVE, MOVE] : [WORK, CARRY, MOVE];
    spawn.spawnCreep(body, newName, { memory: { role: 'upgrader' } as any });
  } else if (builders.length < 2 && room.energyAvailable === room.energyCapacityAvailable) {
    const newName = 'B' + Game.time;
    const body: BodyPartConstant[] = room.energyCapacityAvailable >= 550 ? [WORK, WORK, CARRY, MOVE, MOVE] : [WORK, CARRY, MOVE];
    spawn.spawnCreep(body, newName, { memory: { role: 'builder' } as any });
  }

  if (spawn.spawning) {
    const spawningCreep = Game.creeps[spawn.spawning.name];
    spawn.room.visual.text('🛠️ ' + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, {
      align: 'left',
      opacity: 0.8,
    });
  }

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.role == 'harvester') {
      runHarvester(creep);
    } else if (creep.memory.role == 'upgrader') {
      runUpgrader(creep);
    } else if (creep.memory.role == 'builder') {
      runBuilder(creep);
    }
  }
};

/* Harvester 角色邏輯 */
function runHarvester(creep: Creep): void {
  if (creep.store.getFreeCapacity() == 0) {
    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s: AnyStructure) =>
        (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
        (s as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    }) as AnyStoreStructure | null;
    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s: AnyStructure) =>
          s.structureType === STRUCTURE_CONTAINER && (s as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      }) as AnyStoreStructure | null;
    }
    if (target) {
      const isContainer = target.structureType === STRUCTURE_CONTAINER;
      if (!isContainer || creep.pos.getRangeTo(target) <= 20) {
        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
      }
    } else {
      const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
      if (site) {
        if (creep.build(site) == ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
        creep.say('🚧');
      } else if (creep.room.controller) {
        if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
        creep.say('⚡備援');
      } else {
        creep.drop(RESOURCE_ENERGY);
        creep.say('⬇️');
      }
    }
  } else {
    let source = creep.pos.findClosestByPath(FIND_SOURCES);
    if (!source) source = creep.pos.findClosestByRange(FIND_SOURCES);
    if (source) {
      if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
      }
    } else {
      creep.moveTo(creep.room.controller || (Game.spawns['Spawn1'] as any) || Object.values(Game.spawns)[0]);
      creep.say('❓no src');
    }
  }
}

/* Upgrader 角色邏輯 */
function runUpgrader(creep: Creep): void {
  if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
    creep.memory.upgrading = false as any;
    creep.say('🔄 採集');
  }
  if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
    creep.memory.upgrading = true as any;
    creep.say('⚡ 升級');
  }
  if (creep.memory.upgrading) {
    if (creep.upgradeController(creep.room.controller!) == ERR_NOT_IN_RANGE) {
      creep.moveTo(creep.room.controller!, { visualizePathStyle: { stroke: '#00ff00' } });
    }
  } else {
    const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s: AnyStructure) => s.structureType == STRUCTURE_CONTAINER && (s as AnyStoreStructure).store[RESOURCE_ENERGY] > 0,
    }) as AnyStoreStructure | null;
    if (container && creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(container, { visualizePathStyle: { stroke: '#00ff00' } });
    } else {
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: '#00ff00' } });
      }
    }
  }
}

/* Builder 角色邏輯 */
function runBuilder(creep: Creep): void {
  if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
    creep.memory.building = false as any;
    creep.say('🔄 採集');
  }
  if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
    creep.memory.building = true as any;
    creep.say('🔨 建造');
  }
  if (creep.memory.building) {
    const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (target) {
      if (creep.build(target) == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
      }
    } else {
      if (creep.upgradeController(creep.room.controller!) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller!, { visualizePathStyle: { stroke: '#ffffff' } });
      }
    }
  } else {
    const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s: AnyStructure) => s.structureType == STRUCTURE_CONTAINER && (s as AnyStoreStructure).store[RESOURCE_ENERGY] > 0,
    }) as AnyStoreStructure | null;
    if (container && creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } });
    } else {
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffffff' } });
      }
    }
  }
}

// Screeps 入口：和 module.exports.loop 行為一致
module.exports.loop = loop;
