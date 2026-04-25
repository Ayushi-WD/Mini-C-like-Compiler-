#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdarg.h>


typedef enum {
    TOKEN_NUMBER,
    TOKEN_PLUS, TOKEN_MINUS, TOKEN_STAR, TOKEN_SLASH,
    TOKEN_LPAREN, TOKEN_RPAREN,
    TOKEN_LBRACE, TOKEN_RBRACE,
    TOKEN_LBRACKET, TOKEN_RBRACKET,
    TOKEN_COMMA,
    TOKEN_KEYWORD_INT, TOKEN_KEYWORD_IF, TOKEN_KEYWORD_ELSE,
    TOKEN_KEYWORD_WHILE, TOKEN_KEYWORD_FOR, TOKEN_KEYWORD_PRINT,
    TOKEN_IDENTIFIER, TOKEN_ASSIGN,
    TOKEN_EQ, TOKEN_NE, TOKEN_LT, TOKEN_LE, TOKEN_GT, TOKEN_GE,
    TOKEN_SEMICOLON,
    TOKEN_EOF
} TokenType;


typedef struct {
    TokenType type;
    int value;
    char name[100];
} Token;


typedef struct {
    char name[100];
    int value;
    int initialized;
    int line;
    int is_array;
    int array_size;
} Symbol;


char *input;
int position = 0;
int current_line = 1;
Token current_token;
FILE *asm_file;
#define MAX_SYMBOLS 1000
Symbol symbol_table[MAX_SYMBOLS];
Symbol saved_symbol_table[MAX_SYMBOLS];
int symbol_count = 0;
int saved_symbol_count = 0;
int label_counter = 0;
int error_count = 0;
int pass_number = 1;
int stop_compilation = 0;


#define MAX_INSTRUCTIONS 5000
char *instruction_buffer[MAX_INSTRUCTIONS];
int instruction_count = 0;

void emit_instruction(const char *format, ...) {
    if (pass_number != 2 || error_count > 0) return;
    
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    
    if (instruction_count < MAX_INSTRUCTIONS) {
        char *s = strdup(buffer);
        if (s) instruction_buffer[instruction_count++] = s;
    }
}


#define EMIT(...) emit_instruction(__VA_ARGS__)


void report_error(const char *message, const char *detail) {
    printf("\n ERROR at line %d: %s", current_line, message);
    if (detail && strlen(detail) > 0) {
        printf(" - '%s'", detail);
    }
    printf("\n");
    error_count++;
}

void report_syntax_error(const char *expected, const char *found) {
    printf("\n SYNTAX ERROR at line %d\n", current_line);
    printf("   Expected: %s\n", expected);
    printf("   Found: %s\n", found);
    error_count++;
}

void report_semantic_error(const char *message) {
    printf("\n SEMANTIC ERROR at line %d: %s\n", current_line, message);
    error_count++;
}


void next_token();
void eat(TokenType type);
void parse_program();
void parse_statement();
void parse_declaration();
void parse_assignment();
void parse_if_statement();
void parse_while_statement();
void parse_for_statement();
void parse_print_statement();
void parse_expression();
void parse_condition();
void parse_term();
void parse_factor();
int get_label();
void add_symbol(char *name, int value, int line, int is_array, int array_size);
int get_symbol(char *name);
void update_symbol(char *name, int value);
void generate_data_section();
void save_symbols();
void restore_symbols();

int get_label() {
    return label_counter++;
}

void save_symbols() {
    saved_symbol_count = symbol_count;
    for (int i = 0; i < symbol_count; i++) {
        strcpy(saved_symbol_table[i].name, symbol_table[i].name);
        saved_symbol_table[i].value = symbol_table[i].value;
        saved_symbol_table[i].initialized = symbol_table[i].initialized;
        saved_symbol_table[i].line = symbol_table[i].line;
        saved_symbol_table[i].is_array = symbol_table[i].is_array;
        saved_symbol_table[i].array_size = symbol_table[i].array_size;
    }
}

void restore_symbols() {
    symbol_count = saved_symbol_count;
    for (int i = 0; i < saved_symbol_count; i++) {
        strcpy(symbol_table[i].name, saved_symbol_table[i].name);
        symbol_table[i].value = saved_symbol_table[i].value;
        symbol_table[i].initialized = saved_symbol_table[i].initialized;
        symbol_table[i].line = saved_symbol_table[i].line;
        symbol_table[i].is_array = saved_symbol_table[i].is_array;
        symbol_table[i].array_size = saved_symbol_table[i].array_size;
    }
}


void add_symbol(char *name, int value, int line, int is_array, int array_size) {
    if (stop_compilation) return;
    
    for (int i = 0; i < symbol_count; i++) {
        if (strcmp(symbol_table[i].name, name) == 0) {
            report_error("Variable already declared", name);
            return;
        }
    }
    if (symbol_count < MAX_SYMBOLS) {
        strncpy(symbol_table[symbol_count].name, name, 99);
        symbol_table[symbol_count].name[99] = '\0';
        symbol_table[symbol_count].value = value;
        symbol_table[symbol_count].initialized = 0;
        symbol_table[symbol_count].line = line;
        symbol_table[symbol_count].is_array = is_array;
        symbol_table[symbol_count].array_size = array_size;
        symbol_count++;
    } else {
        report_error("Symbol table overflow", "Too many variables");
    }
}

int get_symbol(char *name) {
    if (stop_compilation) return 0;
    
    for (int i = 0; i < symbol_count; i++) {
        if (strcmp(symbol_table[i].name, name) == 0) {
            return symbol_table[i].value;
        }
    }
    report_semantic_error("Variable not declared");
    return 0;
}

void update_symbol(char *name, int value) {
    if (stop_compilation) return;
    
    for (int i = 0; i < symbol_count; i++) {
        if (strcmp(symbol_table[i].name, name) == 0) {
            symbol_table[i].value = value;
            return;
        }
    }
    report_semantic_error("Cannot assign to undeclared variable");
}

void generate_data_section() {
    if (stop_compilation) return;
    
    fprintf(asm_file, "; Variables\n");
    for (int i = 0; i < symbol_count; i++) {
        if (!symbol_table[i].is_array) {
            fprintf(asm_file, "    %s dd %d\n", symbol_table[i].name, symbol_table[i].value);
        } else {
            fprintf(asm_file, "    %s times %d dd 0\n", symbol_table[i].name, symbol_table[i].array_size);
        }
    }
    fprintf(asm_file, "\n");
}

const char* token_to_string(TokenType type) {
    switch(type) {
        case TOKEN_NUMBER: return "NUMBER";
        case TOKEN_PLUS: return "'+'";
        case TOKEN_MINUS: return "'-'";
        case TOKEN_STAR: return "'*'";
        case TOKEN_SLASH: return "'/'";
        case TOKEN_LPAREN: return "'('";
        case TOKEN_RPAREN: return "')'";
        case TOKEN_LBRACE: return "'{'";
        case TOKEN_RBRACE: return "'}'";
        case TOKEN_LBRACKET: return "'['";
        case TOKEN_RBRACKET: return "']'";
        case TOKEN_COMMA: return "','";
        case TOKEN_KEYWORD_INT: return "'int'";
        case TOKEN_KEYWORD_IF: return "'if'";
        case TOKEN_KEYWORD_ELSE: return "'else'";
        case TOKEN_KEYWORD_WHILE: return "'while'";
        case TOKEN_KEYWORD_FOR: return "'for'";
        case TOKEN_KEYWORD_PRINT: return "'print'";
        case TOKEN_IDENTIFIER: return "IDENTIFIER";
        case TOKEN_ASSIGN: return "'='";
        case TOKEN_EQ: return "'=='";
        case TOKEN_NE: return "'!='";
        case TOKEN_LT: return "'<'";
        case TOKEN_LE: return "'<='";
        case TOKEN_GT: return "'>'";
        case TOKEN_GE: return "'>='";
        case TOKEN_SEMICOLON: return "';'";
        case TOKEN_EOF: return "END OF FILE";
        default: return "UNKNOWN";
    }
}


void next_token() {
    while (input[position] == ' ' || input[position] == '\n' ||
           input[position] == '\r' || input[position] == '\t') {
        if (input[position] == '\n') current_line++;
        position++;
    }

    if (input[position] == '\0') {
        current_token.type = TOKEN_EOF;
        return;
    }

    if (isalpha(input[position]) || input[position] == '_') {
        int start = position;
        while (isalnum(input[position]) || input[position] == '_') position++;
        int len = position - start;
        if (len > 99) len = 99; 
        char word[100];
        strncpy(word, &input[start], len);
        word[len] = '\0';
        
        if (strcmp(word, "int") == 0) current_token.type = TOKEN_KEYWORD_INT;
        else if (strcmp(word, "if") == 0) current_token.type = TOKEN_KEYWORD_IF;
        else if (strcmp(word, "else") == 0) current_token.type = TOKEN_KEYWORD_ELSE;
        else if (strcmp(word, "while") == 0) current_token.type = TOKEN_KEYWORD_WHILE;
        else if (strcmp(word, "for") == 0) current_token.type = TOKEN_KEYWORD_FOR;
        else if (strcmp(word, "print") == 0) current_token.type = TOKEN_KEYWORD_PRINT;
        else {
            current_token.type = TOKEN_IDENTIFIER;
            strcpy(current_token.name, word);
        }
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
        case '+': current_token.type = TOKEN_PLUS; position++; break;
        case '-': current_token.type = TOKEN_MINUS; position++; break;
        case '*': current_token.type = TOKEN_STAR; position++; break;
        case '/': current_token.type = TOKEN_SLASH; position++; break;
        case '(': current_token.type = TOKEN_LPAREN; position++; break;
        case ')': current_token.type = TOKEN_RPAREN; position++; break;
        case '{': current_token.type = TOKEN_LBRACE; position++; break;
        case '}': current_token.type = TOKEN_RBRACE; position++; break;
        case '[': current_token.type = TOKEN_LBRACKET; position++; break;
        case ']': current_token.type = TOKEN_RBRACKET; position++; break;
        case ',': current_token.type = TOKEN_COMMA; position++; break;
        case ';': current_token.type = TOKEN_SEMICOLON; position++; break;
        case '=': 
            if (input[position+1] == '=') {
                current_token.type = TOKEN_EQ;
                position += 2;
            } else {
                current_token.type = TOKEN_ASSIGN;
                position++;
            }
            break;
        case '!':
            if (input[position+1] == '=') {
                current_token.type = TOKEN_NE;
                position += 2;
            } else {
                report_error("Unexpected '!'", "Did you mean '!='?");
                position++;
                next_token();
            }
            break;
        case '<':
            if (input[position+1] == '=') {
                current_token.type = TOKEN_LE;
                position += 2;
            } else {
                current_token.type = TOKEN_LT;
                position++;
            }
            break;
        case '>':
            if (input[position+1] == '=') {
                current_token.type = TOKEN_GE;
                position += 2;
            } else {
                current_token.type = TOKEN_GT;
                position++;
            }
            break;
        default:
            report_error("Unknown character", &input[position]);
            position++;
            next_token();
            break;
    }
}

void eat(TokenType type) {
    
    
    if (current_token.type == type) {
        next_token();
    } else {
        report_syntax_error(token_to_string(type), token_to_string(current_token.type));
        while (current_token.type != TOKEN_SEMICOLON && 
               current_token.type != TOKEN_RBRACE && 
               current_token.type != TOKEN_EOF) {
            next_token();
        }
        if (current_token.type == TOKEN_SEMICOLON || current_token.type == TOKEN_RBRACE) {
            next_token();
        }
    }
}

void parse_program() {
    while (current_token.type != TOKEN_EOF && !stop_compilation) {
        parse_statement();
    }
}

void parse_statement() {
    if (stop_compilation) return;
    
    if (current_token.type == TOKEN_KEYWORD_INT) {
        parse_declaration();
    } else if (current_token.type == TOKEN_IDENTIFIER) {
        parse_assignment();
    } else if (current_token.type == TOKEN_KEYWORD_IF) {
        parse_if_statement();
    } else if (current_token.type == TOKEN_KEYWORD_WHILE) {
        parse_while_statement();
    } else if (current_token.type == TOKEN_KEYWORD_FOR) {
        parse_for_statement();
    } else if (current_token.type == TOKEN_KEYWORD_PRINT) {
        parse_print_statement();
    }
}

void parse_declaration() {
    if (stop_compilation) return;
    
    eat(TOKEN_KEYWORD_INT);
    
    char var_name[100];
    strcpy(var_name, current_token.name);
    eat(TOKEN_IDENTIFIER);
    
    int is_array = 0;
    int array_size = 0;
    
    if (current_token.type == TOKEN_LBRACKET) {
        eat(TOKEN_LBRACKET);
        is_array = 1;
        array_size = current_token.value;
        eat(TOKEN_NUMBER);
        eat(TOKEN_RBRACKET);
    }
    
    if (current_token.type == TOKEN_ASSIGN) {
        eat(TOKEN_ASSIGN);
        if (current_token.type == TOKEN_LBRACE && is_array) {
            
            eat(TOKEN_LBRACE);
            for (int i = 0; i < array_size; i++) {
                int init_val = current_token.value;
                eat(TOKEN_NUMBER);
                EMIT("    mov dword [%s + %d*4], %d\n", var_name, i, init_val);
                if (i < array_size - 1 && current_token.type == TOKEN_COMMA) {
                    eat(TOKEN_COMMA);
                }
            }
            eat(TOKEN_RBRACE);
        } else {
            parse_expression();
            EMIT("    mov dword [%s], eax\n", var_name);
        }
    }
    
    if (pass_number == 1 && !stop_compilation) {
        add_symbol(var_name, 0, current_line, is_array, array_size);
    }
    
    
    if (current_token.type == TOKEN_SEMICOLON) {
        eat(TOKEN_SEMICOLON);
    } else {
        report_syntax_error("';'", token_to_string(current_token.type));
    }
}

void parse_assignment() {
    if (stop_compilation) return;
    
    char var_name[100];
    strcpy(var_name, current_token.name);
    eat(TOKEN_IDENTIFIER);
    
    int is_array_access = 0;
    
    if (current_token.type == TOKEN_LBRACKET) {
        is_array_access = 1;
        eat(TOKEN_LBRACKET);
        parse_expression(); 
        EMIT("    push eax\n"); 
        eat(TOKEN_RBRACKET);
    }
    
    eat(TOKEN_ASSIGN);
    parse_expression(); 
    
    if (is_array_access) {
        EMIT("    pop ebx\n"); 
        EMIT("    shl ebx, 2\n");
        EMIT("    mov dword [%s + ebx], eax\n", var_name);
    } else {
        EMIT("    mov dword [%s], eax\n", var_name);
    }
    
    
    if (current_token.type == TOKEN_SEMICOLON) {
        eat(TOKEN_SEMICOLON);
    } else {
        report_syntax_error("';'", token_to_string(current_token.type));
    }
}

void parse_if_statement() {
    if (stop_compilation) return;
    
    eat(TOKEN_KEYWORD_IF);
    eat(TOKEN_LPAREN);
    
    int else_label = get_label();
    int end_label = get_label();
    
    parse_condition();
    EMIT("    cmp eax, 0\n");
    EMIT("    je .Lelse%d\n", else_label);
    
    eat(TOKEN_RPAREN);
    eat(TOKEN_LBRACE);
    
    while (current_token.type != TOKEN_RBRACE && current_token.type != TOKEN_EOF && !stop_compilation) {
        parse_statement();
    }
    eat(TOKEN_RBRACE);
    
    EMIT("    jmp .Lend%d\n", end_label);
    EMIT(".Lelse%d:\n", else_label);
    
    if (current_token.type == TOKEN_KEYWORD_ELSE) {
        eat(TOKEN_KEYWORD_ELSE);
        eat(TOKEN_LBRACE);
        while (current_token.type != TOKEN_RBRACE && current_token.type != TOKEN_EOF && !stop_compilation) {
            parse_statement();
        }
        eat(TOKEN_RBRACE);
    }
    
    EMIT(".Lend%d:\n", end_label);
}

void parse_while_statement() {
    if (stop_compilation) return;
    
    eat(TOKEN_KEYWORD_WHILE);
    eat(TOKEN_LPAREN);
    
    int start_label = get_label();
    int end_label = get_label();
    
    EMIT(".Lstart%d:\n", start_label);
    
    parse_condition();
    EMIT("    cmp eax, 0\n");
    EMIT("    je .Lend%d\n", end_label);
    
    eat(TOKEN_RPAREN);
    eat(TOKEN_LBRACE);
    
    while (current_token.type != TOKEN_RBRACE && current_token.type != TOKEN_EOF && !stop_compilation) {
        parse_statement();
    }
    eat(TOKEN_RBRACE);
    
    EMIT("    jmp .Lstart%d\n", start_label);
    EMIT(".Lend%d:\n", end_label);
}

void parse_for_statement() {
    if (stop_compilation) return;
    
    eat(TOKEN_KEYWORD_FOR);
    eat(TOKEN_LPAREN);
    
    int start_label = get_label();
    int end_label = get_label();
    
    
    if (current_token.type == TOKEN_KEYWORD_INT) {
        parse_declaration();
    } else if (current_token.type == TOKEN_IDENTIFIER) {
        parse_assignment();
    } else if (current_token.type == TOKEN_SEMICOLON) {
        eat(TOKEN_SEMICOLON);
    }
    
    
    EMIT(".Lstart%d:\n", start_label);
    
    parse_condition();
    EMIT("    cmp eax, 0\n");
    EMIT("    je .Lend%d\n", end_label);
    
    
    if (current_token.type == TOKEN_SEMICOLON) {
        eat(TOKEN_SEMICOLON);
    } else {
        report_syntax_error("';'", token_to_string(current_token.type));
    }
    
    
    char inc_buffer[1000] = "";
    if (current_token.type != TOKEN_RPAREN) {
        FILE *temp = tmpfile();
        FILE *old = asm_file;
        asm_file = temp;
        
        if (current_token.type == TOKEN_IDENTIFIER) {
            char var[100];
            strcpy(var, current_token.name);
            eat(TOKEN_IDENTIFIER);
            eat(TOKEN_ASSIGN);
            parse_expression();
            fprintf(temp, "    mov dword [%s], eax\n", var);
        } else {
            while (current_token.type != TOKEN_RPAREN && current_token.type != TOKEN_EOF) {
                next_token();
            }
        }
        
        fflush(temp);
        rewind(temp);
        size_t bytes = fread(inc_buffer, 1, sizeof(inc_buffer) - 1, temp);
        inc_buffer[bytes] = '\0';
        fclose(temp);
        asm_file = old;
    }
    
    
    while (current_token.type != TOKEN_RPAREN && current_token.type != TOKEN_EOF) {
        next_token();
    }
    eat(TOKEN_RPAREN);
    
    
    eat(TOKEN_LBRACE);
    
    while (current_token.type != TOKEN_RBRACE && current_token.type != TOKEN_EOF && !stop_compilation) {
        parse_statement();
    }
    eat(TOKEN_RBRACE);
    
    
    EMIT("%s", inc_buffer);
    
    
    EMIT("    jmp .Lstart%d\n", start_label);
    EMIT(".Lend%d:\n", end_label);
}

void parse_print_statement() {
    if (stop_compilation) return;
    
    eat(TOKEN_KEYWORD_PRINT);
    parse_expression();
    EMIT("    push eax\n");
    EMIT("    call _print_int\n");
    EMIT("    add esp, 4\n");
    
    
    if (current_token.type == TOKEN_SEMICOLON) {
        eat(TOKEN_SEMICOLON);
    } else {
        report_syntax_error("';'", token_to_string(current_token.type));
        stop_compilation = 1;
    }
}

void parse_condition() {
    if (stop_compilation) return;
    
    parse_expression();
    
    if (current_token.type == TOKEN_EQ || current_token.type == TOKEN_NE ||
        current_token.type == TOKEN_LT || current_token.type == TOKEN_LE ||
        current_token.type == TOKEN_GT || current_token.type == TOKEN_GE) {
        TokenType op = current_token.type;
        eat(op);
        
        EMIT("    push eax\n");
        parse_expression();
        EMIT("    mov ebx, eax\n");
        EMIT("    pop eax\n");
        EMIT("    cmp eax, ebx\n");
        
        switch (op) {
            case TOKEN_EQ: EMIT("    sete al\n    movzx eax, al\n"); break;
            case TOKEN_NE: EMIT("    setne al\n    movzx eax, al\n"); break;
            case TOKEN_LT: EMIT("    setl al\n    movzx eax, al\n"); break;
            case TOKEN_LE: EMIT("    setle al\n    movzx eax, al\n"); break;
            case TOKEN_GT: EMIT("    setg al\n    movzx eax, al\n"); break;
            case TOKEN_GE: EMIT("    setge al\n    movzx eax, al\n"); break;
            default: break;
        }
    }
}

void parse_expression() {
    if (stop_compilation) return;
    
    parse_term();
    
    while (!stop_compilation && (current_token.type == TOKEN_PLUS || current_token.type == TOKEN_MINUS)) {
        TokenType op = current_token.type;
        eat(op);
        
        EMIT("    push eax\n");
        parse_term();
        EMIT("    mov ebx, eax\n");
        EMIT("    pop eax\n");
        
        if (op == TOKEN_PLUS) {
            EMIT("    add eax, ebx\n");
        } else {
            EMIT("    sub eax, ebx\n");
        }
    }
}

void parse_term() {
    if (stop_compilation) return;
    
    parse_factor();
    
    while (!stop_compilation && (current_token.type == TOKEN_STAR || current_token.type == TOKEN_SLASH)) {
        TokenType op = current_token.type;
        eat(op);
        
        if (op == TOKEN_SLASH && current_token.type == TOKEN_NUMBER && current_token.value == 0) {
            report_error("Division by zero", "");
            return;
        }
        
        EMIT("    push eax\n");
        parse_factor();
        EMIT("    mov ebx, eax\n");
        EMIT("    pop eax\n");
        
        if (op == TOKEN_STAR) {
            EMIT("    imul eax, ebx\n");
        } else {
            EMIT("    xor edx, edx\n");
            EMIT("    idiv ebx\n");
        }
    }
}

void parse_factor() {
    if (stop_compilation) return;
    
    if (current_token.type == TOKEN_MINUS) {
        eat(TOKEN_MINUS);
        parse_factor();
        EMIT("    neg eax\n");
    } 
    else if (current_token.type == TOKEN_NUMBER) {
        EMIT("    mov eax, %d\n", current_token.value);
        eat(TOKEN_NUMBER);
    } 
    else if (current_token.type == TOKEN_IDENTIFIER) {
        char var_name[100];
        strcpy(var_name, current_token.name);
        eat(TOKEN_IDENTIFIER);
        
        if (current_token.type == TOKEN_LBRACKET) {
            eat(TOKEN_LBRACKET);
            parse_expression(); 
            EMIT("    mov ebx, eax\n");
            EMIT("    shl ebx, 2\n");
            EMIT("    mov eax, dword [%s + ebx]\n", var_name);
            eat(TOKEN_RBRACKET);
        } else {
            EMIT("    mov eax, dword [%s]\n", var_name);
        }
    }
    else if (current_token.type == TOKEN_LPAREN) {
        eat(TOKEN_LPAREN);
        parse_expression();
        eat(TOKEN_RPAREN);
    } else {
        report_syntax_error("number, identifier, or '('", token_to_string(current_token.type));
    }
}

void optimize_and_write_code(FILE *out) {
    printf(" PASS 3: Optimizing generated code...\n");
    int i;
    int optimized_count = 0;
    
    for (i = 0; i < instruction_count - 4; i++) {
        if (!instruction_buffer[i]) continue;
        
        
        if (strstr(instruction_buffer[i], "push eax")) {
            char *next1 = instruction_buffer[i+1];
            char *next2 = instruction_buffer[i+2];
            char *next3 = instruction_buffer[i+3];
            char *next4 = instruction_buffer[i+4];
            
            if (next1 && next2 && next3 && next4 &&
                strstr(next1, "mov eax,") &&
                strstr(next2, "mov ebx, eax") &&
                strstr(next3, "pop eax") &&
                (strstr(next4, "add eax, ebx") || 
                 strstr(next4, "sub eax, ebx") || 
                 strstr(next4, "imul eax, ebx") || 
                 strstr(next4, "cmp eax, ebx"))) {
                
                
                char operand[100] = {0};
                sscanf(next1, "    mov eax, %[^\n]", operand);
                
                
                char op[20] = {0};
                sscanf(next4, "    %s eax, ebx", op);
                
                
                free(instruction_buffer[i]);
                free(instruction_buffer[i+1]);
                free(instruction_buffer[i+2]);
                free(instruction_buffer[i+3]);
                
                instruction_buffer[i] = NULL;
                instruction_buffer[i+1] = NULL;
                instruction_buffer[i+2] = NULL;
                instruction_buffer[i+3] = NULL;
                
                char new_inst[256];
                snprintf(new_inst, sizeof(new_inst), "    %s eax, %s\n", op, operand);
                free(instruction_buffer[i+4]);
                instruction_buffer[i+4] = strdup(new_inst);
                
                optimized_count++;
            }
        }
    }
    
    
    for (i = 0; i < instruction_count; i++) {
        if (instruction_buffer[i]) {
            fprintf(out, "%s", instruction_buffer[i]);
            free(instruction_buffer[i]);
        }
    }
    instruction_count = 0;
    
    if (optimized_count > 0) {
        printf(" Removed %d redundant instructions!\n", optimized_count * 4);
    }
}

int main(int argc, char **argv) {
    if (argc < 3) {
        printf("Usage: %s <input.cmini> <output.asm>\n", argv[0]);
        return 1;
    }

    FILE* in = fopen(argv[1], "rb");
    if (!in) {
        printf(" ERROR: Cannot open input file '%s'\n", argv[1]);
        return 1;
    }

    fseek(in, 0, SEEK_END);
    long size = ftell(in);
    fseek(in, 0, SEEK_SET);

    input = (char*)malloc(size + 1);
    if (!input) {
        printf(" ERROR: Memory allocation failed\n");
        fclose(in);
        return 1;
    }
    size_t bytes_read = fread(input, 1, size, in);
    input[bytes_read] = '\0';
    fclose(in);

    printf("=== Mini C Compiler - Complete Edition ===\n");
    printf("--------------------------------------------\n\n");
    printf(" Input file: %s\n", argv[1]);
    printf(" Source code:\n---------------\n%s\n---------------\n\n", input);

    printf("PASS 1: Collecting variables...\n");
    pass_number = 1;
    stop_compilation = 0;
    next_token();
    parse_program();
    save_symbols(); 

    if (stop_compilation || error_count > 0) {
        printf("\nFound %d error(s)!\n Compilation aborted.\n", error_count);
        free(input);
        return 1;
    }

    printf("Variables collected successfully! (%d variables)\n\n", symbol_count);

    printf(" PASS 2: Generating assembly...\n");
    asm_file = fopen(argv[2], "w");
    if (!asm_file) {
        printf(" ERROR: Cannot create output file %s\n", argv[2]);
        free(input);
        return 1;
    }
    
    restore_symbols();
    
    fprintf(asm_file, "; Generated by Mini C Compiler\n");
    fprintf(asm_file, "; Source: %s\n", argv[1]);
    fprintf(asm_file, "section .data\n");
    generate_data_section();

    fprintf(asm_file, "section .text\n");
    fprintf(asm_file, "    global _our_code\n");
    fprintf(asm_file, "    extern _print_int\n\n");
    fprintf(asm_file, "_our_code:\n");

    position = 0;
    current_line = 1;
    label_counter = 0;
    stop_compilation = 0;
    pass_number = 2;
    instruction_count = 0;
    next_token();
    parse_program();

    optimize_and_write_code(asm_file);

    fprintf(asm_file, "    ret\n");
    
    if (stop_compilation || error_count > 0) {
        printf("\nFound %d error(s) during code generation!\n", error_count);
        printf(" Compilation aborted.\n");
        fclose(asm_file);
        free(input);
        return 1;
    }
    
    printf(" Assembly generated: %s\n\n", argv[2]);

    fclose(asm_file);
    free(input);
    
   
    printf(" COMPILATION SUCCESSFUL!\n");
    printf("==========================================\n");
    
    return 0;
}