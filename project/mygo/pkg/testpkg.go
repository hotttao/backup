package pkg

type animal struct {
	Name string
}

type Dog struct {
	animal
	Weight int
}

func NewDog() Dog {
	return Dog{animal{"aaa"}, 100}
}
func (g Dog) GetName() string {
	return g.Name
}

func (g *Dog) GetWeight() int {
	return g.Weight
}
