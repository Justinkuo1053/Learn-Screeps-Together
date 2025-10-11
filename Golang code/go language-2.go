package main



// 基礎主程式 （持續按照tick回合制）


// 清理記憶體

// 計算個角色數量

// 顯示角色數量

// 自動生產


package main

import (
	"fmt"
	"math/rand"
	"time"
)

type Role struct {
	Name string
}

var roles []Role

func main() {
	rand.Seed(time.Now().UnixNano())
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			cleanMemory()
			countRoles()
			displayRoleCount()
			autoProduceRole()
		}
	}
}

func cleanMemory() {
	// 模擬清理記憶體
	fmt.Println("Cleaning memory...")
}

func countRoles() int {
	return len(roles)
}

func displayRoleCount() {
	count := countRoles()
	fmt.Printf("Current role count: %d\n", count)
}

func autoProduceRole() {
	newRole := Role{Name: fmt.Sprintf("Role%d", rand.Intn(1000))}
	roles = append(roles, newRole)
	fmt.Printf("Produced new role: %s\n", newRole.Name)
}				