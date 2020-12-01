package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
)

type MyMutex struct {
	sync.RWMutex
}

func (m *MyMutex) ReaderCount() int32 {
	read := atomic.LoadInt32((*int32)(unsafe.Pointer(uintptr(unsafe.Pointer(&m.RWMutex)) +
		unsafe.Sizeof(sync.Mutex{}) + unsafe.Sizeof(uint32(0)))))
	return read
}

func Read(m *MyMutex, i int) {
	defer m.RUnlock()
	m.RLock()
	fmt.Println("Reader:", i)
	time.Sleep(time.Millisecond)
	fmt.Println("Reader:", i, "over")

}

func Writer(m *MyMutex, j int) {
	defer m.Unlock()
	fmt.Println("Writer:", j)
	time.Sleep(time.Second * 2)
	fmt.Println("get reader")
	fmt.Println(m.ReaderCount())
	m.Lock()
	fmt.Println("get reader over")

}

func main() {
	my := MyMutex{}
	for {
		for i := 1; i < 10; i++ {
			i := i
			go Read(&my, i)
		}
		go Writer(&my, 1)
		time.Sleep(time.Microsecond)
	}
}
