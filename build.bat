@echo off
echo  MINI C COMPILER 
echo.

echo Step 1: Building compiler...
gcc src/main.c -o compiler.exe
if %errorlevel% neq 0 (
    echo Compilation failed!
    pause
    exit /b
)
echo Compiler built successfully!
echo.

echo Step 2: Running compiler on test file...
compiler.exe tests/calc.cmini outputs/program.asm
echo.
 
echo Step 3: Assembling with NASM...
nasm -f win32 outputs/program.asm -o outputs/program.obj
echo.

echo Step 4: Compiling runtime driver...
gcc -c runtime/driver.c -o outputs/driver.obj
echo.

echo Step 5: Linking...
gcc outputs/driver.obj outputs/program.obj -o outputs/program.exe
echo.

echo Step 6: Running program...
echo ------------------------
outputs\program.exe
echo ------------------------
echo.

echo  DONE 
pause