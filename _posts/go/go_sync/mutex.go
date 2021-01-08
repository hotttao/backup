package main

import (
	"fmt"
	"io"
	"os"
)

func main() {
	f, err := os.Open("text.log")
	var r io.Reader = f
	fmt.Println(f, err)
	fmt.Println(r)
}
