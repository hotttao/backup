package main

import (
	"fmt"

	"golang.org/x/sync/singleflight"
)

func main() {
	f := singleflight.Group{}
	fmt.Println(f)
}
