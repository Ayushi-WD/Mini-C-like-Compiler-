# 🛠️ Mini C-Like Compiler

A lightweight compiler that translates a subset of the C programming language into x86-64 assembly
and produces executable Windows programs. Built entirely from scratch in C — implementing every
phase of compilation manually with no external frameworks or parser generators.

## 📌 About
This project demonstrates the complete working flow of a compiler, from reading raw source code
to generating a native Windows executable. It supports a custom C-like language with `.cmini` files
processed through lexing, parsing, semantic analysis, and code generation using NASM and MinGW GCC.

## ✨ Features
- ✅ Arithmetic expressions with operator precedence (`+`, `-`, `*`, `/`)
- ✅ Variables and arrays with initialization (`int arr[5] = {1, 2, 3, 4, 5};`)
- ✅ Array access with constant and variable indices (`arr[0]`, `arr[i]`)
- ✅ Control flow: `if-else`, `while` loops, `for` loops
- ✅ Print statement for output
- ✅ Error handling with line numbers (syntax errors, undeclared variables, division by zero)
- ✅ Two-pass compilation — variable collection then code generation
- ✅ x86-64 assembly generation with basic optimizations

## 🔧 Technology Stack
| Component  | Technology     |
|------------|----------------|
| Language   | C (C99)        |
| Assembler  | NASM           |
| Linker     | MinGW GCC      |
| Platform   | Windows x86-64 |

## 💡 Language Example
```c
int arr[5] = {1, 2, 3, 4, 5};
int sum = 0;
for (int i = 0; i < 5; i = i + 1) {
    sum = sum + arr[i];
}
print sum;   // Output: 15
```

## 🚀 Build & Run
```bash
gcc src/main.c -o compiler.exe
compiler.exe tests/array.cmini outputs/program.asm
nasm -f win64 outputs/program.asm -o outputs/program.obj
gcc -c runtime/driver.c -o outputs/driver.obj
gcc outputs/driver.obj outputs/program.obj -o outputs/program.exe
outputs\program.exe
```

## ⚡ Quick Start
Skip the manual steps — just run: `build.bat array.cmini`
