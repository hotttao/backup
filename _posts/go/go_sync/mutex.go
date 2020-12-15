package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	var closing = make(chan int)
	var closed = make(chan int)

	go func() {
		for {
			select {
			case <-closing:
				fmt.Println("任务结束")
				return
			}
		}
	}()

	termChan := make(chan os.Signal)
	signal.Notify(termChan, syscall.SIGTERM, syscall.SIGINT)
	<-termChan
	close(closing)
	go doClean(closed)
	select {
	case <-closed:
		fmt.Println("任务正常退出")
	case <-time.After(time.Second * 10):
		fmt.Println("清理超时，不等了")
	}
}

func doClean(closed chan int) {
	time.Sleep(time.Second)
	close(closed)
}
