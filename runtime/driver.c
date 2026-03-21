#include <stdio.h>

// This function will be implemented in our generated assembly code.
extern int our_code();

int main() {
    int result = our_code();
    printf("%d\n", result);
    return 0;
}