#include <stdio.h>

extern int our_code();

void print_int(int value) {
    printf("%d\n", value);
}

int main() {
    our_code();
    return 0;
}