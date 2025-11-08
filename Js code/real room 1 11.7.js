// Basic configuration for a new room in Screeps

module.exports.loop = function () {
    const roomName = 'W3N28'; // Replace with your actual room name
    const room = Game.rooms[roomName];

    // Check if the room exists and is visible
    if (!room) {
        console.log(`Room ${roomName} is not visible.`);
        return;
    }

    // Step 1: Harvest Energy
    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester');
        if (harvesters.length < sources.length) {
            Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], `Harvester${Game.time}`, {
                memory: { role: 'harvester', sourceId: source.id }
            });
        }
    }

    // Step 2: Build Basic Structures
    if (Game.spawns['Spawn1'].store[RESOURCE_ENERGY] > 200) {
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        if (constructionSites.length === 0) {
            room.createConstructionSite(25, 25, STRUCTURE_EXTENSION);
            room.createConstructionSite(26, 25, STRUCTURE_CONTAINER);
        }
    }

    // Step 3: Upgrade Controller
    const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader');
    console.log(`Number of upgraders: ${upgraders.length}`); // Log the number of upgraders

    if (upgraders.length < 2) {
        Game.spawns['Spawn1'].spawnCreep([WORK, CARRY, MOVE], `Upgrader${Game.time}`, {
            memory: { role: 'upgrader' }
        });
    }

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.memory.role === 'harvester') {
            const source = Game.getObjectById(creep.memory.sourceId);
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source);
            }
        } else if (creep.memory.role === 'upgrader') {
            console.log(`Upgrader ${creep.name} energy: ${creep.store[RESOURCE_ENERGY]}`);
            if (creep.store[RESOURCE_ENERGY] > 0) {
                const upgradeResult = creep.upgradeController(room.controller);
                if (upgradeResult === ERR_NOT_IN_RANGE) {
                    console.log(`Upgrader ${creep.name} moving to controller.`);
                    creep.moveTo(room.controller);
                } else if (upgradeResult !== OK) {
                    console.log(`Upgrader ${creep.name} failed to upgrade controller: ${upgradeResult}`);
                }
            } else {
                const closestContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER &&
                        structure.store[RESOURCE_ENERGY] > 0
                });
                if (closestContainer) {
                    const withdrawResult = creep.withdraw(closestContainer, RESOURCE_ENERGY);
                    if (withdrawResult === ERR_NOT_IN_RANGE) {
                        console.log(`Upgrader ${creep.name} moving to container.`);
                        creep.moveTo(closestContainer);
                    } else if (withdrawResult !== OK) {
                        console.log(`Upgrader ${creep.name} failed to withdraw energy: ${withdrawResult}`);
                    }
                } else {
                    console.log(`Upgrader ${creep.name} could not find a container with energy.`);
                    const closestSource = creep.pos.findClosestByPath(FIND_SOURCES);
                    if (closestSource && creep.harvest(closestSource) === ERR_NOT_IN_RANGE) {
                        console.log(`Upgrader ${creep.name} moving to source.`);
                        creep.moveTo(closestSource);
                    }
                }
            }
        }
    }
};