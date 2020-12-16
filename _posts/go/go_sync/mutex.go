package main

import (
	"fmt"
	"reflect"
	"time"
)

type MLock struct {
	mtx chan int
}

func NewMLock() *MLock {
	ch := make(chan int, 1)
	ch <- 1
	return &MLock{
		mtx: ch,
	}
}

func (m *MLock) Lock() {
	<-m.mtx
}

func (m *MLock) Unlock() {
	select {
	case m.mtx <- 1:
	default:
		panic("unlock of unlocked mutex")
	}
}

func (m *MLock) TryLock() bool {
	select {
	case <-m.mtx:
		return true
	default:
	}
	return false

}

func (m *MLock) LockTimout(timeout time.Duration) bool {
	timer := time.NewTimer(timeout)
	select {
	case <-m.mtx:
		timer.Stop()
		return true
	case <-timer.C:
	}
	return false
}

func (m *MLock) IsLock() bool {
	return len(m.mtx) == 0
}

func main() {
	mutex := NewMLock()
	ok := mutex.TryLock()
	fmt.Printf("locked v %v\n", ok)
	ok = mutex.TryLock()
	fmt.Printf("locked v %v\n", ok)

	mapChan := mapInt()
	mapFn := func(v interface{}) interface{} {
		return v.(int) * 10
	}

	reduceFuc := func(v interface{}, y interface{}) interface{} {
		return v.(int) + y.(int)
	}
	result := reduce(mapStream(mapChan, mapFn), reduceFuc)
	fmt.Println(result)

}

func or(chans ...chan interface{}) chan interface{} {
	switch len(chans) {
	case 0:
		return nil
	case 1:
		return chans[0]
	}
	orDone := make(chan interface{})
	go func() {
		defer close(orDone)
		var scases []reflect.SelectCase
		for _, c := range chans {
			scases = append(scases, reflect.SelectCase{
				Chan: reflect.ValueOf(c),
				Dir:  reflect.SelectRecv,
			})
		}
		reflect.Select(scases)
	}()
	return orDone
}

func fadeIn(in ...chan interface{}) <-chan interface{} {
	out := make(chan interface{})

	if len(in) == 0 {
		close(out)
		return out
	}

	go func() {
		defer close(out)
		var scase []reflect.SelectCase
		for _, ch := range in {
			scase = append(scase, reflect.SelectCase{
				Chan: reflect.ValueOf(ch),
				Dir:  reflect.SelectRecv,
			})
		}

		for len(scase) > 0 {
			chosen, recv, ok := reflect.Select(scase)
			if !ok {
				scase = append(scase[:chosen], scase[chosen+1:]...)
				continue
			}
			out <- recv.Interface()
		}
	}()

	return out
}

func mergeTwo(a, b chan interface{}) <-chan interface{} {
	out := make(chan interface{})
	go func() {
		defer close(out)
		for a != nil || b != nil {
			select {
			case v, ok := <-a:
				if !ok {
					a = nil
					continue
				}
				out <- v
			case v, ok := <-b:
				if !ok {
					b = nil
					continue
				}
				out <- v
			}
		}
	}()
	return out

}

func fadeOut(ch <-chan interface{}, out []chan interface{}, async bool) {

	go func() {
		defer func() {
			for i := 0; i < len(out); i++ {
				close(out[i])
			}
		}()
		for v := range ch {
			for i := 0; i < len(out); i++ {
				if async {
					go func() {
						out[i] <- v
					}()
				} else {
					out[i] <- v
				}
			}
		}
	}()
}

func asStream(done chan int, values ...interface{}) chan interface{} {
	out := make(chan interface{})
	go func() {
		defer close(out)
		for _, v := range values {
			select {
			case <-done:
				return
			case out <- v:
			}
		}
	}()

	return out
}

func taskN(done <-chan int, valueStream chan interface{}, num int) <-chan interface{} {
	out := make(chan interface{})
	go func() {
		defer close(out)
		for i := 0; i < num; i++ {
			select {
			case <-done:
				return
			case out <- <-valueStream:
			}
		}
	}()
	return out
}

func mapStream(in <-chan interface{}, fn func(interface{}) interface{}) <-chan interface{} {
	out := make(chan interface{})
	if in == nil {
		close(out)
		return out
	}
	go func() {
		defer close(out)
		for v := range in {
			out <- fn(v)
		}
	}()
	return out
}

func mapInt() <-chan interface{} {
	out := make(chan interface{})
	values := []int{1, 2, 3, 4, 5}
	go func() {
		defer close(out)
		for _, v := range values {
			out <- v
		}
	}()

	return out
}

func reduce(in <-chan interface{}, fn func(interface{}, interface{}) interface{}) interface{} {
	if in == nil {
		return nil
	}
	out := <-in
	for v := range in {
		fmt.Println(v)
		out = fn(v, out)
	}
	return out
}
