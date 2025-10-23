// 物件 screeps
// 物件 spawn
//物件 momory

package main

type memoryStruct struct {
	Creeps map[string]creepMemoryStruct
}

type creepMemoryStruct struct {
	Role      string
	Name      string
	Health    int
	Body      []string
	Working   bool
	Building  bool
	Upgrading bool
	Mining    bool
	SourceID  string
	TargetID  string
}

// 清理記憶體
func (g *creepMemoryStruct) CleanMemory() {
	delete(g.Creeps, g.Name)
}

// type Role struct {
// 	Name string
// 	Body []string
// 	Count int
// }

type creep struct {
	Name      string
	Body      []string
	Health    int
	Working   bool
	Building  bool
	Upgrading bool
	Mining    bool
	SourceID  string
	TargetID  string
}

func (c *creep) Memory() *creepMemoryStruct {
	// Implementation of the Memory method
	return &creepMemoryStruct{
		Role:      c.Memory().Role,
		Name:      c.Name,
		Health:    c.Health,
		Body:      c.Body,
		Working:   c.Working,
		Building:  c.Building,
		Upgrading: c.Upgrading,
		Mining:    c.Mining,
		SourceID:  c.SourceID,
		TargetID:  c.TargetID,
	}
}

func (c *creep) Say(message string) {
	// Implementation of the Say method
}

func (c *creep) MoveTo(i, j int, x int, y int) (int, int) {
	// Implementation of the MoveTo method
	return i + x, j + y
}

func (c *creep) Harvest(sourceID string) int {
	// Implementation of the Harvest method
	return 1
}

type Game struct {
	Time   int
	Creeps map[string]*creep
	Spawns map[string]*Spawn
}

type Room struct {
	Visual Visual
	Creeps map[string]*creep
	Spawns map[string]*Spawn
}

func (r *Room) FindCreepsByRole(role string) []*creep {
	var creeps []*creep
	for _, c := range r.Creeps {
		if c.Memory().Role == role {
			creeps = append(creeps, c)
		}
	}
	return creeps
}

type Spawn struct {
	Name     string
	Store    map[string]int
	Spawning *creep
	Room     *Room
}

func (s *Spawn) SpawnCreep(body []string, name string, memory creepMemoryStruct) {
	newCreep := &creep{
		Name: name,
		Body: body,
		// 其他屬性可以根據 memory 初始化
		Health:    memory.Health,
		Working:   memory.Working,
		Building:  memory.Building,
		Upgrading: memory.Upgrading,
		Mining:    memory.Mining,
		SourceID:  memory.SourceID,
		TargetID:  memory.TargetID,
	}
	if s.Room != nil {
		if s.Room.Creeps == nil {
			s.Room.Creeps = make(map[string]*creep)
		}
		s.Room.Creeps[name] = newCreep
	}
	// 將記憶體加入到 Room 的 Creeps 記憶體結構中
	if s.Room != nil && s.Room.Creeps != nil {
		if s.Room.Creeps[name] == nil {
			s.Room.Creeps[name] = newCreep
		}
	}
	s.Spawning = newCreep
}
