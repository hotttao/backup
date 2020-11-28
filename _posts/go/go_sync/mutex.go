package main

import (
	"fmt"
	"sync"
	"time"
)

func main() {
	var cc counter
	for i := 1; i < 10; i++ {
		go func() {
			for {
				time.Sleep(time.Millisecond)
				fmt.Println(cc.total())
			}
		}()
	}
	for {
		cc.incr()
		time.Sleep(time.Millisecond)
	}
}

type counter struct {
	sync.RWMutex
	count uint64
}

func (c *counter) incr() {
	c.Lock()
	c.count++
	c.Unlock()
}

func (c *counter) total() uint64 {
	c.Lock()
	defer c.Unlock()
	return c.count
}
