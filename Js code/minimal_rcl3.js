// minimal_rcl3.js - RCL3 超精簡版（可讀性、練習友善）
// 功能：記憶體清理、三角色（Harvester/Upgrader/Builder）、簡單孵化、基本行為
// 不包含：自動建置 extension/container、進階路徑/物流（你可在熟悉後再加回）

const CONFIG = {
  counts: { harvester: 2, upgrader: 1, builder: 1 },
  body: {
    big: [WORK, WORK, CARRY, MOVE, MOVE],
    small: [WORK, CARRY, MOVE],
  },
  onlyFullEnergySpawn: true, // 只有能量全滿才生（避免生小孩）
  emergency: true, // 當沒有採集者時，允許緊急生一隻小採集者
  nearBaseRange: 8, // 視為基地附近的半徑（交付限制）
  longTripLimit: 20, // 距離過遠不交付，改走備援
};

module.exports.loop = function () {
  // === 清理記憶體 ===
  for (let name in Memory.creeps) {
    if (!Game.creeps[name]) delete Memory.creeps[name];
  }

  // === 取得 Spawn/Room ===
  const spawn = Game.spawns['Spawn1'] || Object.values(Game.spawns)[0];
  if (!spawn) return;
  const room = spawn.room;

  // === 控制面板（Memory） ===
  // 可在控制台設定：
  // Memory.ctrl = { spawnPaused: false, quotas: { harvester: 2, upgrader: 1, builder: 1 } }
  if (!Memory.ctrl) Memory.ctrl = { spawnPaused: false };
  const CTRL = Memory.ctrl;
  const QUOTAS = Object.assign({}, CONFIG.counts, CTRL.quotas || {});

  // === 計數 ===
  const harvesters = _.filter(Game.creeps, c => c.memory.role === 'harvester');
  const upgraders = _.filter(Game.creeps, c => c.memory.role === 'upgrader');
  const builders = _.filter(Game.creeps, c => c.memory.role === 'builder');

  // === 緊急孵化（避免滅團） ===
  if (CONFIG.emergency && !CTRL.spawnPaused && !spawn.spawning && harvesters.length === 0 && room.energyAvailable >= 200) {
    spawn.spawnCreep(CONFIG.body.small, 'boot-' + Game.time, { memory: { role: 'harvester' } });
  }

  // === 正常孵化（能量滿再生） ===
  let nextSpawnRole = null;
  const canSpawnBig = !CTRL.spawnPaused && !spawn.spawning && (!CONFIG.onlyFullEnergySpawn || room.energyAvailable === room.energyCapacityAvailable);
  if (canSpawnBig) {
    if (harvesters.length < QUOTAS.harvester) nextSpawnRole = 'harvester';
    else if (upgraders.length < QUOTAS.upgrader) nextSpawnRole = 'upgrader';
    else if (builders.length < QUOTAS.builder) nextSpawnRole = 'builder';
    if (nextSpawnRole) {
      const name = (nextSpawnRole[0].toUpperCase()) + Game.time;
      const body = CONFIG.body.big;
      spawn.spawnCreep(body, name, { memory: { role: nextSpawnRole } });
    }
  }

  // === 視覺化孵化資訊 ===
  if (spawn.spawning) {
    const spawningCreep = Game.creeps[spawn.spawning.name];
    spawn.room.visual.text('🛠️ ' + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, { align: 'left', opacity: 0.8 });
  }

  // === 角色執行 ===
  for (let name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.role === 'harvester') runHarvester(creep);
    else if (creep.memory.role === 'upgrader') runUpgrader(creep);
    else if (creep.memory.role === 'builder') runBuilder(creep);
  }

  // === HUD ===
  renderHUD(room, {
    counts: { H: harvesters.length, U: upgraders.length, B: builders.length },
    quotas: QUOTAS,
    energy: { a: room.energyAvailable, c: room.energyCapacityAvailable },
    ctrlLevel: room.controller ? room.controller.level : 0,
    ctrlProgress: room.controller ? room.controller.progress : 0,
    ctrlTotal: room.controller ? room.controller.progressTotal : 0,
    paused: !!CTRL.spawnPaused,
    next: nextSpawnRole,
  }, spawn);
};

// ========== 角色邏輯（簡化版） ==========
function runHarvester(creep) {
  if (creep.store.getFreeCapacity() === 0) {
    // 先補給基地附近的 Spawn/Extension；沒有就備援（建造/升級）
    const anchor = (creep.room.find(FIND_MY_SPAWNS)[0] || { pos: creep.pos }).pos;
    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && s.pos.inRangeTo(anchor, CONFIG.nearBaseRange)
    });
    if (target && creep.pos.getRangeTo(target) <= CONFIG.longTripLimit) {
      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target);
      return;
    }
    // 備援：建造 > 升級 > 丟地上
    const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) creep.moveTo(site);
    } else if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
    } else {
      creep.drop(RESOURCE_ENERGY);
    }
  } else {
    const src = creep.pos.findClosestByPath(FIND_SOURCES) || creep.pos.findClosestByRange(FIND_SOURCES);
    if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
  }
}

// === 視覺化 HUD ===
function renderHUD(room, stats, spawn) {
  const v = room.visual;
  const x0 = Math.max(1, spawn.pos.x - 6);
  const y0 = Math.max(1, spawn.pos.y - 5);
  const lines = [];
  const pct = stats.ctrlTotal ? Math.floor((stats.ctrlProgress / stats.ctrlTotal) * 100) : 0;
  lines.push(`H:${stats.counts.H}/${stats.quotas.harvester}  U:${stats.counts.U}/${stats.quotas.upgrader}  B:${stats.counts.B}/${stats.quotas.builder}`);
  lines.push(`Energy ${stats.energy.a}/${stats.energy.c}`);
  lines.push(`RCL${stats.ctrlLevel} ${stats.ctrlProgress}/${stats.ctrlTotal} (${pct}%)`);
  if (stats.paused) lines.push('SPAWN: PAUSED');
  else if (stats.next) lines.push(`SPAWN NEXT: ${stats.next}`);
  // 畫出背景與文字
  const width = 16; const height = lines.length + 1.2;
  v.rect(x0 - 0.5, y0 - 0.5, width, height, { fill: '#000', opacity: 0.35, stroke: '#999', strokeWidth: 0.1 });
  for (let i = 0; i < lines.length; i++) {
    v.text(lines[i], x0, y0 + i, { align: 'left', color: '#e6e6e6', font: 0.8 });
  }
}

function runUpgrader(creep) {
  if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) creep.memory.upgrading = false;
  if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) creep.memory.upgrading = true;
  if (creep.memory.upgrading) {
    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
  } else {
    // 先從容器拿，沒有就去採
    const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
    });
    if (cont) {
      if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont);
    } else {
      const src = creep.pos.findClosestByPath(FIND_SOURCES) || creep.pos.findClosestByRange(FIND_SOURCES);
      if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
    }
  }
}

function runBuilder(creep) {
  if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) creep.memory.building = false;
  if (!creep.memory.building && creep.store.getFreeCapacity() === 0) creep.memory.building = true;
  if (creep.memory.building) {
    const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) creep.moveTo(site);
    } else if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
    }
  } else {
    const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
    });
    if (cont) {
      if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont);
    } else {
      const src = creep.pos.findClosestByPath(FIND_SOURCES) || creep.pos.findClosestByRange(FIND_SOURCES);
      if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
    }
  }
}
