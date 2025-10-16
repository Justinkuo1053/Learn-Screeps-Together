// Minimal Screeps-like simulator for local testing
// Focus: RCL3 "spawn harvester only when energy is full" policy

class Room {
  constructor(name, energyCapacityAvailable, controllerLevel = 3) {
    this.name = name
    this.energyAvailable = 0
    this.energyCapacityAvailable = energyCapacityAvailable
    this.controller = { level: controllerLevel }
    this.spawns = []
    this.extensions = []
    this.creeps = []
    this.sources = [{ id: 'source1' }, { id: 'source2' }]
  }
}

class Spawn {
  constructor(name, room) {
    this.name = name
    this.room = room
    this.spawning = null
  }
  canCreateCreep(body) {
    const costMap = { move: 50, work: 100, carry: 50 }
    const cost = body.reduce((s, p) => s + (costMap[p.toLowerCase()] || 0), 0)
    return this.room.energyAvailable >= cost
  }
  spawnCreep(body, name, opts = {}) {
    if (!this.canCreateCreep(body)) return -6 // ERR_NOT_ENOUGH_ENERGY
    const creep = { name, body, role: (opts.memory && opts.memory.role) || 'harvester', ticksToLive: 1500, carrying: 0 }
    this.room.creeps.push(creep)
    const costMap = { move: 50, work: 100, carry: 50 }
    const cost = body.reduce((s, p) => s + (costMap[p.toLowerCase()] || 0), 0)
    this.room.energyAvailable -= cost
    return 0
  }
}

function harvesterStep(creep, room) {
  // Super simplified: if carrying < 50, "harvest" energy; else deliver to room
  if (creep.carrying < 50) {
    // harvest from infinite source
    creep.carrying = 50
  } else {
    const need = room.energyCapacityAvailable - room.energyAvailable
    const give = Math.min(need, creep.carrying)
    room.energyAvailable += give
    creep.carrying -= give
  }
}

function runTick(world, config) {
  const { room, spawn } = world
  // 1) Creeps act
  for (const c of room.creeps) {
    if (c.role === 'harvester') harvesterStep(c, room)
  }
  // 2) Spawn policy
  const wantHarvesters = config.minHarvesters
  const harvCount = room.creeps.filter(c => c.role === 'harvester').length
  if (room.controller.level >= 3) {
    // Only spawn when energy is FULL
    if (harvCount < wantHarvesters && room.energyAvailable === room.energyCapacityAvailable) {
      const body = ['work', 'work', 'carry', 'move', 'move']
      spawn.spawnCreep(body, `H${Date.now()%100000}`, { memory: { role: 'harvester' } })
    }
  } else {
    // Pre-RCL3: allow emergency spawn if no creeps and some energy >= 200
    if (harvCount === 0 && room.energyAvailable >= 200) {
      spawn.spawnCreep(['work', 'carry', 'move'], `E${Date.now()%100000}`, { memory: { role: 'harvester' } })
    }
  }
}

function renderHUD(world, tick) {
  const { room } = world
  const lines = []
  lines.push(`Room ${room.name} | RCL ${room.controller.level}`)
  lines.push(`Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`)
  const roles = room.creeps.reduce((m, c) => (m[c.role] = (m[c.role]||0)+1, m), {})
  lines.push(`Creeps: total ${room.creeps.length} ${Object.entries(roles).map(([k,v])=>`${k}:${v}`).join(' ')}`)
  console.log(`\n=== TICK ${tick} ===\n` + lines.join('\n'))
}

function main() {
  // Config
  const config = { minHarvesters: 2 }
  // World init
  const room = new Room('W0N0', 550, 3)
  const spawn = new Spawn('Spawn1', room)
  room.spawns.push(spawn)

  // Seed energy slowly to simulate mining/delivery
  let tick = 0
  const maxTicks = 80
  while (tick < maxTicks) {
    // Simulate passive energy gain by external factors (container fill etc.) for demo
    if (room.energyAvailable < room.energyCapacityAvailable) {
      room.energyAvailable = Math.min(room.energyCapacityAvailable, room.energyAvailable + 50)
    }
    runTick({ room, spawn }, config)
    renderHUD({ room, spawn }, tick)
    tick++
  }
}

if (require.main === module) {
  main()
}
