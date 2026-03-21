#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// Token types
typedef enum {
    TOKEN_NUMBER,
    TOKEN_PLUS, TOKEN_MINUS, TOKEN_STAR, TOKEN_SLASH,
    TOKEN_LPAREN, TOKEN_RPAREN,
    TOKEN_EOF
} TokenType;

// Token structure
typedef struct {
    TokenType type;
    int value;
} Token;

// Global variables
char *input;
int position = 0;
Token current_token;
FILE *asm_file;

// Function prototypes
void next_token();
void eat(TokenType type);
int parse_expression();
int parse_term();
int parse_factor();

// Lexer
void next_token() {
    while (input[position] == ' ' || input[position] == '\n' ||
           input[position] == '\r' || input[position] == '\t') {
        position++;
    }

    if (input[position] == '\0') {
        current_token.type = TOKEN_EOF;
        return;
    }

    if (isdigit(input[position])) {
        current_token.type = TOKEN_NUMBER;
        current_token.value = 0;
        while (isdigit(input[position])) {
            current_token.value = current_token.value * 10 + (input[position] - '0');
            position++;
        }
        return;
    }

    switch (input[position]) {
        case '+': current_token.type = TOKEN_PLUS;   position++; break;
        case '-': current_token.type = TOKEN_MINUS;  position++; break;
        case '*': current_token.type = TOKEN_STAR;   position++; break;
        case '/': current_token.type = TOKEN_SLASH;  position++; break;
        case '(': current_token.type = TOKEN_LPAREN; position++; break;
        case ')': current_token.type = TOKEN_RPAREN; position++; break;
        default:
            printf("Warning: Unknown character '%c' - skipping\n", input[position]);
            position++;
            next_token();
            break;
    }
}

void eat(TokenType type) {
    if (current_token.type == type) {
        next_token();
    } else {
        printf("Syntax error: unexpected token\n");
        exit(1);
    }
}

// expression = term { ('+' | '-') term }
int parse_expression() {
    int left = parse_term();

    while (current_token.type == TOKEN_PLUS || current_token.type == TOKEN_MINUS) {
        TokenType op = current_token.type;
        eat(op);

        fprintf(asm_file, "    push eax\n");
        int right = parse_term();
        fprintf(asm_file, "    mov ebx, eax\n");
        fprintf(asm_file, "    pop eax\n");

        if (op == TOKEN_PLUS) {
            fprintf(asm_file, "    add eax, ebx\n");
            left = left + right;
        } else {
            fprintf(asm_file, "    sub eax, ebx\n");
            left = left - right;
        }
    }

    return left;
}

// term = factor { ('*' | '/') factor }
int parse_term() {
    int left = parse_factor();

    while (current_token.type == TOKEN_STAR || current_token.type == TOKEN_SLASH) {
        TokenType op = current_token.type;
        eat(op);

        fprintf(asm_file, "    push eax\n");
        int right = parse_factor();
        fprintf(asm_file, "    mov ebx, eax\n");
        fprintf(asm_file, "    pop eax\n");

        if (op == TOKEN_STAR) {
            fprintf(asm_file, "    imul eax, ebx\n");
            left = left * right;
        } else {
            fprintf(asm_file, "    ; Division\n");
            fprintf(asm_file, "    xor edx, edx\n");
            fprintf(asm_file, "    idiv ebx\n");
            left = left / right;
        }
    }

    return left;
}

// factor = number | '(' expression ')'
int parse_factor() {
    if (current_token.type == TOKEN_NUMBER) {
        int value = current_token.value;
        fprintf(asm_file, "    mov eax, %d\n", value);
        eat(TOKEN_NUMBER);
        return value;
    } else if (current_token.type == TOKEN_LPAREN) {
        eat(TOKEN_LPAREN);
        int value = parse_expression();
        eat(TOKEN_RPAREN);
        return value;
    } else {
        printf("Syntax error: expected number or '('\n");
        exit(1);
    }
}

int main(int argc, char* argv[]) {
    printf("=== Mini C Compiler - Arithmetic Edition ===\n");

    if (argc != 3) {
        printf("Usage: %s input.cmini output.asm\n", argv[0]);
        return 1;
    }

    // Read input file
    FILE* in = fopen(argv[1], "r");
    if (!in) {
        printf("Error: Cannot open input file %s\n", argv[1]);
        return 1;
    }

    fseek(in, 0, SEEK_END);
    long size = ftell(in);
    fseek(in, 0, SEEK_SET);

    input = (char*)malloc(size + 1);
    if (!input) {
        printf("Error: Cannot allocate memory\n");
        fclose(in);
        return 1;
    }

    size_t bytes_read = fread(input, 1, size, in);
    input[bytes_read] = '\0';
    fclose(in);

    // Strip trailing newlines
    int len = strlen(input);
    while (len > 0 && (input[len-1] == '\n' || input[len-1] == '\r')) {
        input[len-1] = '\0';
        len--;
    }

    printf("Input expression: %s\n", input);

    // Open output file
    asm_file = fopen(argv[2], "w");
    if (!asm_file) {
        printf("Error: Cannot create output file %s\n", argv[2]);
        free(input);
        return 1;
    }

    // Assembly prologue
    fprintf(asm_file, "; Generated by Mini C Compiler\n");
    fprintf(asm_file, "; Expression: %s\n", input);
    fprintf(asm_file, "section .text\n");
    fprintf(asm_file, "    global _our_code\n\n");
    fprintf(asm_file, "_our_code:\n");

    // Parse
    position = 0;
    next_token();

    int result = parse_expression();

    if (current_token.type != TOKEN_EOF) {
        printf("Warning: Extra characters after expression\n");
    }

    fprintf(asm_file, "    ret\n");
    printf("Parsed result: %d\n", result);

    fclose(asm_file);
    printf("Assembly generated: %s\n", argv[2]);

    free(input);
    return 0;
}