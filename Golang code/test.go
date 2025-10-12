
type Game struct {
	Creeps []*Creep
}

type Creep struct {
	ID     string
	Role   string
	Name  string
	Health int
}

func (g*Game) CreateCreep(role string, name string) *Creep {
	newCreep := &Creep{
		ID:     "unique-id", // In real scenario, generate a unique ID
		Role:   role,
		Name:   randomName(),
		Health: 100, // Default health
	}
	g.Creeps = append(g.Creeps, newCreep)
	return newCreep
}
