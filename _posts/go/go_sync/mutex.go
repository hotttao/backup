package main

import (
	"sync"
)

var threeOnce struct {
	sync.Once
	v *float32
}

func three() {
	threeOnce.Once(func() {
		threeOnce.v = 3
	})
}
