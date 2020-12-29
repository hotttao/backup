package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"go.etcd.io/etcd/client/v3/concurrency"
	"go.etcd.io/etcd/clientv3"
)

var (
	nodeID    = flag.Int("id", 0, "node ID")
	addr      = flag.String("addr", "http://192.168.108.55:2379", "etcd address")
	electName = flag.String("name", "my-test-elect", "election name")
	count     int
)

func main() {
	endpoints := strings.Split(*addr, ",")
	cli, err := clientv3.New(clientv3.Config{Endpoints: endpoints})
	if err != nil {
		log.Fatal(err)
	}
	defer cli.Close()
	session, err := concurrency.NewSession(cli)
	defer session.Close()

	el := concurrency.NewElection(session, *electName)
	consolescanner := bufio.NewScanner(os.Stdin)
	for consolescanner.Scan() {
		action := consolescanner.Text()
		switch action {
		case "elect":
			go elect(el, *electName)
		case "proclaim":
			proclaim(el, *electName)
		case "resign":
			resign(el, *electName)
		case "watch":
			go watch(el, *electName)
		case "query":
			query(el, *electName)
		case "rev":
			rev(el, *electName)
		default:
			fmt.Println("unkonw error")
		}

	}
}

// 选主
func elect(e1 *concurrency.Election, electName string) {
	log.Println("acampaigning for ID:", *nodeID)
	// 调用Campaign方法选主,主的值为value-<主节点ID>-<count>
	if err := e1.Campaign(context.Background(), fmt.Sprintf("value-%d-%d", *nodeID, count)); err != nil {
		log.Println(err)
	}
	log.Println("campaigned for ID:", *nodeID)
	count++
}

// 为主设置新值
func proclaim(e1 *concurrency.Election, electName string) {
	log.Println("proclaiming for ID:", *nodeID)
	// 调用Proclaim方法设置新值,新值为value-<主节点ID>-<count>
	if err := e1.Proclaim(context.Background(), fmt.Sprintf("value-%d-%d", *nodeID, count)); err != nil {
		log.Println(err)
	}
	log.Println("proclaimed for ID:", *nodeID)
	count++
}

// 重新选主，有可能另外一个节点被选为了主
func resign(e1 *concurrency.Election, electName string) {
	log.Println("resigning for ID:", *nodeID)
	// 调用Resign重新选主
	if err := e1.Resign(context.TODO()); err != nil {
		log.Println(err)
	}
	log.Println("resigned for ID:", *nodeID)
}

// 查询主的信息
func query(e1 *concurrency.Election, electName string) {
	// 调用Leader返回主的信息，包括key和value等信息
	resp, err := e1.Leader(context.Background())
	if err != nil {
		log.Printf("failed to get the current leader: %v", err)
	}
	log.Println("current leader:", string(resp.Kvs[0].Key), string(resp.Kvs[0].Value))
}

// 可以直接查询主的rev信息
func rev(e1 *concurrency.Election, electName string) {
	rev := e1.Rev()
	log.Println("current rev:", rev)
}

// 监控主节点的变化
func watch(e1 *concurrency.Election, electName string) {
	ch := e1.Observe(context.TODO())

	log.Println("start to watch for ID:", *nodeID)
	for i := 0; i < 10; i++ {
		resp := <-ch
		log.Println("leader changed to", string(resp.Kvs[0].Key), string(resp.Kvs[0].Value))
	}
}
