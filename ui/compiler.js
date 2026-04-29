const TokenType = Object.freeze({
    NUMBER: 'NUMBER', PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH',
    LPAREN: 'LPAREN', RPAREN: 'RPAREN', LBRACE: 'LBRACE', RBRACE: 'RBRACE',
    LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET', COMMA: 'COMMA',
    KEYWORD_INT: 'KEYWORD_INT', KEYWORD_IF: 'KEYWORD_IF', KEYWORD_ELSE: 'KEYWORD_ELSE',
    KEYWORD_WHILE: 'KEYWORD_WHILE', KEYWORD_FOR: 'KEYWORD_FOR', KEYWORD_PRINT: 'KEYWORD_PRINT',
    IDENTIFIER: 'IDENTIFIER', ASSIGN: 'ASSIGN',
    EQ: 'EQ', NE: 'NE', LT: 'LT', LE: 'LE', GT: 'GT', GE: 'GE',
    SEMICOLON: 'SEMICOLON', EOF: 'EOF'
});

const TOKEN_DISPLAY = {
    NUMBER: 'NUMBER', PLUS: "'+'", MINUS: "'-'", STAR: "'*'", SLASH: "'/'",
    LPAREN: "'('", RPAREN: "')'", LBRACE: "'{'", RBRACE: "'}'",
    LBRACKET: "'['", RBRACKET: "']'", COMMA: "','",
    KEYWORD_INT: "'int'", KEYWORD_IF: "'if'", KEYWORD_ELSE: "'else'",
    KEYWORD_WHILE: "'while'", KEYWORD_FOR: "'for'", KEYWORD_PRINT: "'print'",
    IDENTIFIER: 'IDENTIFIER', ASSIGN: "'='",
    EQ: "'=='", NE: "'!='", LT: "'<'", LE: "'<='", GT: "'>'", GE: "'>='",
    SEMICOLON: "';'", EOF: 'END OF FILE'
};


class Lexer {
    constructor(source) {
        this.input = source;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
    }

    peek() { return this.pos < this.input.length ? this.input[this.pos] : '\0'; }

    advance() {
        const ch = this.input[this.pos++];
        if (ch === '\n') { this.line++; this.col = 1; } else { this.col++; }
        return ch;
    }

    skipWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.advance();
        }
    }

    tokenize() {
        const tokens = [];
        while (true) {
            const tok = this.nextToken();
            tokens.push(tok);
            if (tok.type === TokenType.EOF) break;
        }
        return tokens;
    }

    nextToken() {
        this.skipWhitespace();
        const line = this.line;
        const col = this.col;

        if (this.pos >= this.input.length) {
            return { type: TokenType.EOF, value: null, name: '', line, col };
        }

        const ch = this.peek();


        if (/[a-zA-Z_]/.test(ch)) {
            let word = '';
            while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
                word += this.advance();
            }
            const keywords = { 'int': TokenType.KEYWORD_INT, 'if': TokenType.KEYWORD_IF, 'else': TokenType.KEYWORD_ELSE, 'while': TokenType.KEYWORD_WHILE, 'for': TokenType.KEYWORD_FOR, 'print': TokenType.KEYWORD_PRINT };
            if (keywords[word]) return { type: keywords[word], value: null, name: word, line, col };
            return { type: TokenType.IDENTIFIER, value: null, name: word, line, col };
        }


        if (/\d/.test(ch)) {
            let num = '';
            while (this.pos < this.input.length && /\d/.test(this.input[this.pos])) {
                num += this.advance();
            }
            return { type: TokenType.NUMBER, value: parseInt(num, 10), name: num, line, col };
        }


        this.advance();
        switch (ch) {
            case '+': return { type: TokenType.PLUS, value: null, name: '+', line, col };
            case '-': return { type: TokenType.MINUS, value: null, name: '-', line, col };
            case '*': return { type: TokenType.STAR, value: null, name: '*', line, col };
            case '/': return { type: TokenType.SLASH, value: null, name: '/', line, col };
            case '(': return { type: TokenType.LPAREN, value: null, name: '(', line, col };
            case ')': return { type: TokenType.RPAREN, value: null, name: ')', line, col };
            case '{': return { type: TokenType.LBRACE, value: null, name: '{', line, col };
            case '}': return { type: TokenType.RBRACE, value: null, name: '}', line, col };
            case '[': return { type: TokenType.LBRACKET, value: null, name: '[', line, col };
            case ']': return { type: TokenType.RBRACKET, value: null, name: ']', line, col };
            case ',': return { type: TokenType.COMMA, value: null, name: ',', line, col };
            case ';': return { type: TokenType.SEMICOLON, value: null, name: ';', line, col };
            case '=':
                if (this.peek() === '=') { this.advance(); return { type: TokenType.EQ, value: null, name: '==', line, col }; }
                return { type: TokenType.ASSIGN, value: null, name: '=', line, col };
            case '!':
                if (this.peek() === '=') { this.advance(); return { type: TokenType.NE, value: null, name: '!=', line, col }; }
                throw { message: `Unexpected '!' (Did you mean '!='?)`, line, col };
            case '<':
                if (this.peek() === '=') { this.advance(); return { type: TokenType.LE, value: null, name: '<=', line, col }; }
                return { type: TokenType.LT, value: null, name: '<', line, col };
            case '>':
                if (this.peek() === '=') { this.advance(); return { type: TokenType.GE, value: null, name: '>=', line, col }; }
                return { type: TokenType.GT, value: null, name: '>', line, col };
            default:
                throw { message: `Unknown character: '${ch}'`, line, col };
        }
    }
}


class MiniCCompiler {
    constructor(source) {
        this.source = source;
        this.lexer = null;
        this.tokens = [];
        this.tokenIndex = 0;
        this.currentToken = null;
        this.asm = [];
        this.symbols = [];
        this.labelCounter = 0;
        this.errors = [];
        this.logs = [];
        this.passNumber = 1;
        this.stopCompilation = false;
    }


    log(msg, type = 'info') { this.logs.push({ msg, type }); }
    reportError(msg, detail = '') {
        const line = this.currentToken ? this.currentToken.line : '?';
        const full = detail ? `${msg} - '${detail}'` : msg;
        this.errors.push({ message: full, line });
        this.log(`ERROR at line ${line}: ${full}`, 'error');
    }
    reportSyntaxError(expected, found) {
        const line = this.currentToken ? this.currentToken.line : '?';
        this.errors.push({ message: `Expected ${expected}, found ${found}`, line });
        this.log(`SYNTAX ERROR at line ${line}: Expected ${expected}, found ${found}`, 'error');
    }
    reportSemanticError(msg) {
        const line = this.currentToken ? this.currentToken.line : '?';
        this.errors.push({ message: msg, line });
        this.log(`SEMANTIC ERROR at line ${line}: ${msg}`, 'error');
    }


    addSymbol(name, value, line, isArray = false, arraySize = 0) {
        if (this.stopCompilation) return;
        if (this.symbols.find(s => s.name === name)) { this.reportError('Variable already declared', name); return; }
        this.symbols.push({ name, value, initialized: true, line, isArray, arraySize });
    }
    getSymbol(name) {
        if (this.stopCompilation) return null;
        const s = this.symbols.find(s => s.name === name);
        if (!s) { this.reportSemanticError(`Variable '${name}' not declared`); return null; }
        return s;
    }
    updateSymbol(name, value) {
        if (this.stopCompilation) return;
        const s = this.symbols.find(s => s.name === name);
        if (!s) { this.reportSemanticError(`Cannot assign to undeclared variable '${name}'`); return; }
        s.value = value;
    }


    getLabel() { return this.labelCounter++; }
    emit(line) { if (this.passNumber === 2 && this.errors.length === 0) this.asm.push(line); }


    optimizeCode() {
        let optimizedCount = 0;
        for (let i = 0; i < this.asm.length - 4; i++) {
            if (this.asm[i] && this.asm[i].includes('push eax')) {
                const next1 = this.asm[i + 1];
                const next2 = this.asm[i + 2];
                const next3 = this.asm[i + 3];
                const next4 = this.asm[i + 4];

                if (next1 && next2 && next3 && next4 &&
                    next1.includes('mov eax,') &&
                    next2.includes('mov ebx, eax') &&
                    next3.includes('pop eax') &&
                    (next4.includes('add eax, ebx') ||
                        next4.includes('sub eax, ebx') ||
                        next4.includes('imul eax, ebx') ||
                        next4.includes('cmp eax, ebx'))) {


                    const operand = next1.split('mov eax,')[1].trim();

                    const op = next4.split('eax, ebx')[0].trim();

                    this.asm[i] = null;
                    this.asm[i + 1] = null;
                    this.asm[i + 2] = null;
                    this.asm[i + 3] = null;
                    this.asm[i + 4] = `    ${op} eax, ${operand}`;
                    optimizedCount++;
                }
            }
        }
        this.asm = this.asm.filter(line => line !== null);
        if (optimizedCount > 0) {
            this.log(`PASS 3: Optimizer removed ${optimizedCount * 4} redundant instructions!`, 'success');
        }
    }


    initTokens() {
        this.lexer = new Lexer(this.source);
        this.tokens = this.lexer.tokenize();
        this.tokenIndex = 0;
        this.currentToken = this.tokens[0];
    }
    nextToken() {
        this.tokenIndex++;
        this.currentToken = this.tokenIndex < this.tokens.length ? this.tokens[this.tokenIndex] : { type: TokenType.EOF };
    }
    eat(type) {

        if (this.currentToken.type === type) { this.nextToken(); }
        else {
            this.reportSyntaxError(TOKEN_DISPLAY[type] || type, TOKEN_DISPLAY[this.currentToken.type] || this.currentToken.type);

            while (this.currentToken.type !== TokenType.SEMICOLON && this.currentToken.type !== TokenType.RBRACE && this.currentToken.type !== TokenType.EOF) this.nextToken();
            if (this.currentToken.type === TokenType.SEMICOLON || this.currentToken.type === TokenType.RBRACE) this.nextToken();
        }
    }


    compile() {
        this.log('=== Mini C Compiler — JavaScript Edition ===', 'step');
        this.log('');


        try {
            this.initTokens();
        } catch (e) {
            this.errors.push({ message: e.message, line: e.line || 1 });
            this.log(`LEXER ERROR: ${e.message}`, 'error');
            return { success: false, asm: '', tokens: [], symbols: [], errors: this.errors, logs: this.logs };
        }

        this.log(`Source: ${this.source.split('\n').length} lines`, 'info');
        this.log('');


        this.log('PASS 1: Collecting variables...', 'step');
        this.passNumber = 1;
        this.stopCompilation = false;
        this.tokenIndex = 0;
        this.currentToken = this.tokens[0];
        this.parseProgram();

        if (this.stopCompilation || this.errors.length > 0) {
            this.log(`Found ${this.errors.length} error(s)! Compilation aborted.`, 'error');
            return { success: false, asm: '', tokens: this.tokens.slice(0, -1), symbols: [...this.symbols], ast: null, errors: this.errors, logs: this.logs };
        }

        const savedSymbols = this.symbols.map(s => ({ ...s }));
        this.log(`Variables collected: ${this.symbols.length}`, 'success');
        this.log('');


        this.log('PASS 2: Generating assembly & AST...', 'step');
        this.passNumber = 2;
        this.asm = [];
        this.stopCompilation = false;
        this.labelCounter = 0;
        this.tokenIndex = 0;
        this.currentToken = this.tokens[0];
        this.symbols = savedSymbols.map(s => ({ ...s }));


        this.asm.push('; Generated by Mini C Compiler (Web Edition)');
        this.asm.push('; ──────────────────────────────────────────');
        this.asm.push('section .data');

        const dataInsertIdx = this.asm.length;

        this.asm.push('');
        this.asm.push('section .text');
        this.asm.push('    global _our_code');
        this.asm.push('    extern _print_int');
        this.asm.push('');
        this.asm.push('_our_code:');

        const ast = this.parseProgram();

        this.asm.push('    ret');


        const dataLines = [];
        dataLines.push('; Variables');
        for (const sym of this.symbols) {
            if (!sym.isArray) {
                dataLines.push(`    ${sym.name} dd ${sym.value}`);
            } else {
                dataLines.push(`    ${sym.name} times ${sym.arraySize} dd 0`);
            }
        }
        this.asm.splice(dataInsertIdx, 0, ...dataLines);

        if (this.stopCompilation || this.errors.length > 0) {
            this.log(`Found ${this.errors.length} error(s) during code generation!`, 'error');
            return { success: false, asm: this.asm.join('\n'), tokens: this.tokens.slice(0, -1), symbols: [...this.symbols], ast: null, errors: this.errors, logs: this.logs };
        }


        this.optimizeCode();

        this.log('');
        this.log('COMPILATION SUCCESSFUL!', 'success');
        return {
            success: true,
            asm: this.asm.join('\n'),
            tokens: this.tokens.slice(0, -1),
            symbols: [...this.symbols],
            ast: ast,
            errors: [],
            logs: this.logs
        };
    }


    parseProgram() {
        const nodes = [];
        while (this.currentToken.type !== TokenType.EOF && !this.stopCompilation) {
            const node = this.parseStatement();
            if (node) nodes.push(node);
        }
        return { type: 'Program', children: nodes };
    }

    parseStatement() {
        if (this.stopCompilation) return null;
        switch (this.currentToken.type) {
            case TokenType.KEYWORD_INT: return this.parseDeclaration();
            case TokenType.IDENTIFIER: return this.parseAssignment();
            case TokenType.KEYWORD_IF: return this.parseIfStatement();
            case TokenType.KEYWORD_WHILE: return this.parseWhileStatement();
            case TokenType.KEYWORD_FOR: return this.parseForStatement();
            case TokenType.KEYWORD_PRINT: return this.parsePrintStatement();
            default:
                this.reportError('Unexpected token', TOKEN_DISPLAY[this.currentToken.type]);
                this.nextToken();
                return null;
        }
    }

    parseDeclaration() {
        if (this.stopCompilation) return null;
        const line = this.currentToken.line;
        this.eat(TokenType.KEYWORD_INT);
        const varName = this.currentToken.name;
        this.eat(TokenType.IDENTIFIER);
        let isArray = false, arraySize = 0;
        if (this.currentToken.type === TokenType.LBRACKET) {
            this.eat(TokenType.LBRACKET);
            isArray = true;
            arraySize = this.currentToken.value;
            this.eat(TokenType.NUMBER);
            this.eat(TokenType.RBRACKET);
        }

        let initExpr = null;
        let initValues = [];

        if (this.currentToken.type === TokenType.ASSIGN) {
            this.eat(TokenType.ASSIGN);
            if (this.currentToken.type === TokenType.LBRACE && isArray) {
                this.eat(TokenType.LBRACE);
                for (let i = 0; i < arraySize; i++) {
                    const val = this.currentToken.value;
                    initValues.push(val);
                    this.eat(TokenType.NUMBER);
                    this.emit(`    mov dword [${varName} + ${i}*4], ${val}`);
                    if (i < arraySize - 1 && this.currentToken.type === TokenType.COMMA) this.eat(TokenType.COMMA);
                }
                this.eat(TokenType.RBRACE);
            } else {
                initExpr = this.parseExpression();
                this.emit(`    mov dword [${varName}], eax`);
            }
        }
        if (this.passNumber === 1 && !this.stopCompilation) {
            this.addSymbol(varName, 0, line, isArray, arraySize);
        }
        if (this.currentToken.type === TokenType.SEMICOLON) { this.eat(TokenType.SEMICOLON); }
        else { this.reportSyntaxError("';'", TOKEN_DISPLAY[this.currentToken.type]); }

        return {
            type: 'Declaration',
            varType: 'int',
            name: varName,
            isArray,
            arraySize,
            initExpr,
            initValues: initValues.length ? initValues : null
        };
    }

    parseAssignment() {
        if (this.stopCompilation) return null;
        const varName = this.currentToken.name;
        this.eat(TokenType.IDENTIFIER);
        let isArrayAccess = false;
        let indexExpr = null;
        if (this.currentToken.type === TokenType.LBRACKET) {
            isArrayAccess = true;
            this.eat(TokenType.LBRACKET);
            indexExpr = this.parseExpression();
            this.emit(`    push eax`);
            this.eat(TokenType.RBRACKET);
        }
        this.eat(TokenType.ASSIGN);
        const valueExpr = this.parseExpression();
        this.getSymbol(varName);

        if (isArrayAccess) {
            this.emit(`    pop ebx`);
            this.emit(`    shl ebx, 2`);
            this.emit(`    mov dword [${varName} + ebx], eax`);
        } else {
            this.emit(`    mov dword [${varName}], eax`);
        }
        if (this.currentToken.type === TokenType.SEMICOLON) { this.eat(TokenType.SEMICOLON); }
        else { this.reportSyntaxError("';'", TOKEN_DISPLAY[this.currentToken.type]); }

        return {
            type: 'Assignment',
            name: varName,
            isArrayAccess,
            indexExpr,
            valueExpr
        };
    }

    parseIfStatement() {
        if (this.stopCompilation) return null;
        this.eat(TokenType.KEYWORD_IF);
        this.eat(TokenType.LPAREN);
        const elseLabel = this.getLabel();
        const endLabel = this.getLabel();
        const condition = this.parseCondition();
        this.emit(`    cmp eax, 0`);
        this.emit(`    je .Lelse${elseLabel}`);
        this.eat(TokenType.RPAREN);
        this.eat(TokenType.LBRACE);
        const thenBody = [];
        while (this.currentToken.type !== TokenType.RBRACE && this.currentToken.type !== TokenType.EOF && !this.stopCompilation) {
            thenBody.push(this.parseStatement());
        }
        this.eat(TokenType.RBRACE);
        this.emit(`    jmp .Lend${endLabel}`);
        this.emit(`.Lelse${elseLabel}:`);
        const elseBody = [];
        if (this.currentToken.type === TokenType.KEYWORD_ELSE) {
            this.eat(TokenType.KEYWORD_ELSE);
            this.eat(TokenType.LBRACE);
            while (this.currentToken.type !== TokenType.RBRACE && this.currentToken.type !== TokenType.EOF && !this.stopCompilation) {
                elseBody.push(this.parseStatement());
            }
            this.eat(TokenType.RBRACE);
        }
        this.emit(`.Lend${endLabel}:`);

        return {
            type: 'IfStatement',
            condition,
            thenBody,
            elseBody: elseBody.length ? elseBody : null
        };
    }

    parseWhileStatement() {
        if (this.stopCompilation) return null;
        this.eat(TokenType.KEYWORD_WHILE);
        this.eat(TokenType.LPAREN);
        const startLabel = this.getLabel();
        const endLabel = this.getLabel();
        this.emit(`.Lstart${startLabel}:`);
        const condition = this.parseCondition();
        this.emit(`    cmp eax, 0`);
        this.emit(`    je .Lend${endLabel}`);
        this.eat(TokenType.RPAREN);
        this.eat(TokenType.LBRACE);
        const body = [];
        while (this.currentToken.type !== TokenType.RBRACE && this.currentToken.type !== TokenType.EOF && !this.stopCompilation) {
            body.push(this.parseStatement());
        }
        this.eat(TokenType.RBRACE);
        this.emit(`    jmp .Lstart${startLabel}`);
        this.emit(`.Lend${endLabel}:`);

        return {
            type: 'WhileStatement',
            condition,
            body
        };
    }

    parseForStatement() {
        if (this.stopCompilation) return null;
        this.eat(TokenType.KEYWORD_FOR);
        this.eat(TokenType.LPAREN);
        const startLabel = this.getLabel();
        const endLabel = this.getLabel();

        let init = null;
        if (this.currentToken.type === TokenType.KEYWORD_INT) init = this.parseDeclaration();
        else if (this.currentToken.type === TokenType.IDENTIFIER) init = this.parseAssignment();
        else if (this.currentToken.type === TokenType.SEMICOLON) this.eat(TokenType.SEMICOLON);

        this.emit(`.Lstart${startLabel}:`);
        const condition = this.parseCondition();
        this.emit(`    cmp eax, 0`);
        this.emit(`    je .Lend${endLabel}`);

        if (this.currentToken.type === TokenType.SEMICOLON) { this.eat(TokenType.SEMICOLON); }
        else { this.reportSyntaxError("';'", TOKEN_DISPLAY[this.currentToken.type]); return null; }


        const savedPass = this.passNumber;
        const incAsm = [];
        let step = null;
        if (this.currentToken.type !== TokenType.RPAREN) {

            this.passNumber = 2;
            const oldAsm = this.asm;
            this.asm = incAsm;
            if (this.currentToken.type === TokenType.IDENTIFIER) {
                const v = this.currentToken.name;
                this.nextToken();
                this.eat(TokenType.ASSIGN);
                const stepExpr = this.parseExpression();
                this.emit(`    mov dword [${v}], eax`);
                step = { type: 'Assignment', name: v, valueExpr: stepExpr };
            }
            this.asm = oldAsm;
            this.passNumber = savedPass;
        }

        while (this.currentToken.type !== TokenType.RPAREN && this.currentToken.type !== TokenType.EOF) this.nextToken();
        this.eat(TokenType.RPAREN);

        this.eat(TokenType.LBRACE);
        const body = [];
        while (this.currentToken.type !== TokenType.RBRACE && this.currentToken.type !== TokenType.EOF && !this.stopCompilation) {
            body.push(this.parseStatement());
        }
        this.eat(TokenType.RBRACE);


        for (const line of incAsm) this.emit(line);

        this.emit(`    jmp .Lstart${startLabel}`);
        this.emit(`.Lend${endLabel}:`);

        return {
            type: 'ForStatement',
            init,
            condition,
            step,
            body
        };
    }

    parsePrintStatement() {
        if (this.stopCompilation) return null;
        this.eat(TokenType.KEYWORD_PRINT);
        const expr = this.parseExpression();
        this.emit(`    push eax`);
        this.emit(`    call _print_int`);
        this.emit(`    add esp, 4`);
        if (this.currentToken.type === TokenType.SEMICOLON) { this.eat(TokenType.SEMICOLON); }
        else { this.reportSyntaxError("';'", TOKEN_DISPLAY[this.currentToken.type]); }

        return { type: 'PrintStatement', expression: expr };
    }

    parseCondition() {
        if (this.stopCompilation) return null;
        let left = this.parseExpression();
        const compOps = [TokenType.EQ, TokenType.NE, TokenType.LT, TokenType.LE, TokenType.GT, TokenType.GE];
        if (compOps.includes(this.currentToken.type)) {
            const op = this.currentToken.type;
            this.eat(op);
            this.emit(`    push eax`);
            const right = this.parseExpression();
            this.emit(`    mov ebx, eax`);
            this.emit(`    pop eax`);
            this.emit(`    cmp eax, ebx`);
            const setMap = { EQ: 'sete', NE: 'setne', LT: 'setl', LE: 'setle', GT: 'setg', GE: 'setge' };
            this.emit(`    ${setMap[op]} al`);
            this.emit(`    movzx eax, al`);
            return { type: 'Condition', left, operator: op, right };
        }
        return left;
    }

    parseExpression() {
        if (this.stopCompilation) return null;
        let node = this.parseTerm();
        while (!this.stopCompilation && (this.currentToken.type === TokenType.PLUS || this.currentToken.type === TokenType.MINUS)) {
            const op = this.currentToken.type;
            this.eat(op);
            this.emit(`    push eax`);
            const right = this.parseTerm();
            this.emit(`    mov ebx, eax`);
            this.emit(`    pop eax`);
            this.emit(op === TokenType.PLUS ? `    add eax, ebx` : `    sub eax, ebx`);
            node = { type: 'BinaryExpression', left: node, operator: op, right };
        }
        return node;
    }

    parseTerm() {
        if (this.stopCompilation) return null;
        let node = this.parseFactor();
        while (!this.stopCompilation && (this.currentToken.type === TokenType.STAR || this.currentToken.type === TokenType.SLASH)) {
            const op = this.currentToken.type;
            this.eat(op);
            if (op === TokenType.SLASH && this.currentToken.type === TokenType.NUMBER && this.currentToken.value === 0) {
                this.reportError('Division by zero', ''); return null;
            }
            this.emit(`    push eax`);
            const right = this.parseFactor();
            this.emit(`    mov ebx, eax`);
            this.emit(`    pop eax`);
            if (op === TokenType.STAR) {
                this.emit(`    imul eax, ebx`);
            } else {
                this.emit(`    xor edx, edx`);
                this.emit(`    idiv ebx`);
            }
            node = { type: 'BinaryExpression', left: node, operator: op, right };
        }
        return node;
    }

    parseFactor() {
        if (this.stopCompilation) return null;
        if (this.currentToken.type === TokenType.MINUS) {
            this.eat(TokenType.MINUS);
            const factor = this.parseFactor();
            this.emit('    neg eax');
            return { type: 'UnaryExpression', operator: 'MINUS', argument: factor };
        } else if (this.currentToken.type === TokenType.NUMBER) {
            const val = this.currentToken.value;
            this.emit(`    mov eax, ${val}`);
            this.eat(TokenType.NUMBER);
            return { type: 'Literal', value: val };
        } else if (this.currentToken.type === TokenType.IDENTIFIER) {
            const varName = this.currentToken.name;
            this.eat(TokenType.IDENTIFIER);
            this.getSymbol(varName);

            if (this.currentToken.type === TokenType.LBRACKET) {
                this.eat(TokenType.LBRACKET);
                const index = this.parseExpression();
                this.emit(`    mov ebx, eax`);
                this.emit(`    shl ebx, 2`);
                this.emit(`    mov eax, dword [${varName} + ebx]`);
                this.eat(TokenType.RBRACKET);
                return { type: 'ArrayAccess', name: varName, index };
            } else {
                this.emit(`    mov eax, dword [${varName}]`);
                return { type: 'Variable', name: varName };
            }
        } else if (this.currentToken.type === TokenType.LPAREN) {
            this.eat(TokenType.LPAREN);
            const expr = this.parseExpression();
            this.eat(TokenType.RPAREN);
            return expr;
        } else {
            this.reportSyntaxError("number, identifier, or '('", TOKEN_DISPLAY[this.currentToken.type]);
            return null;
        }
    }
}


window.Lexer = Lexer;
window.MiniCCompiler = MiniCCompiler;
window.TokenType = TokenType;
window.TOKEN_DISPLAY = TOKEN_DISPLAY;
