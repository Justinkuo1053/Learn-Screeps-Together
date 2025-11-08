

func groupAnagrams(strs []string) [][]string {
	var mp map[[26]int][]string
	mp = make(map[[26]int][]string)

	for i := 0; i < len(strs); i++ {
		var count [26]int
		for j := 0; j < len(strs[i]); j++ {
			count[strs[i][j]-'a']++
		}
		// 下面這行代表把 strs[i] 放到對應的 key 裡面去
		mp[count] = append(mp[count], strs[i])
	}

	var res [][]string
	for _, v := range mp {
		res = append(res, v)
	}
	return res

}
