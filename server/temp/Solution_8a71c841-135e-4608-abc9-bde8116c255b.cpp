#include <iostream>
using namespace std;

bool isPrime(int num) {
    if (num <= 1) return false;
    for (int i = 2; i * i <= num; i++) { 
        if (num % i == 0) return false; 
    }
    return true; 
}

int main() {
    int limit;
    cin >> limit;

    for (int num = 2; num <= limit; num++) {
        if (isPrime(num)) {
            cout <<" "<<num<<" " ;
        }
    }
    cout << endl;

    return 0;
}
