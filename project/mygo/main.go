package main

import (
	"fmt"
	"mygo/pkg"
)

func main() {
	g := pkg.NewDog()
	fmt.Printf("%T, %#v\n", g, g)
	fmt.Println(g.Weight)
	fmt.Println(g.Name)
	fmt.Printf("%T\n", (*pkg.Dog).GetName)
	fmt.Printf("%T\n", (*pkg.Dog).GetWeight)
	fmt.Printf("%T\n", pkg.Dog.GetName)
	// fmt.Printf("%T\n", pkg.Dog.GetWeight)

}
