package thefarm

// TODO: define the 'DivideFood' function


type FodderCalculator func(int) (float64, error)	

func FodderCalculator (Fodder float64, growfactor float64) float64 {
	return Fodder * growfactor
}



func DivideFood(fc FodderCalculator, n int) float64 {
	amount, error := fc(n)
	if error != nil {
		panic(error)
	}
	return amount / float64(n)
}       







// TODO: define the 'ValidateInputAndDivideFood' function

// TODO: define the 'ValidateNumberOfCows' function

// Your first steps could be to read through the tasks, and create
// these functions with their correct parameter lists and return types.
// The function body only needs to contain `panic("")`.
//
// This will make the tests compile, but they will fail.
// You can then implement the function logic one by one and see
// an increasing number of tests passing as you implement more
// functionality.
