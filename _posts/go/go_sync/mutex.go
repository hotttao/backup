package main

import (
	"fmt"
	"io"
	"os"
)

type display interface {
	getColumns() int
	getRows() int
	getRowText(row int) string
	Show(display display) string
}

type defaultDisplay struct {
	display
}

func main() {
	f, err := os.Open("text.log")
	var r io.Reader = f
	fmt.Println(f, err)
	fmt.Println(r)
	t := &defaultDisplay{}
	fmt.Printf("%T", t)
}
