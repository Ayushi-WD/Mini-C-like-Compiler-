@echo off
echo ===== MINI C COMPILER - PHASE 3 =====
echo.

if "%1"=="" (
    set TEST_FILE=program.cmini
) else (
    set TEST_FILE=%1
)
echo Testing file: tests/%TEST_FILE%
echo.

echo Step 1: Building compiler...
gcc src/main.c -o compiler.exe
if %errorlevel% neq 0 (
    echo.
    echo  COMPILER BUILD FAILED!
    echo Please fix the errors in src/main.c
    pause
    exit /b 1
)
echo  Compiler built successfully!
echo.

echo Step 2: Running compiler on test file...
compiler.exe tests/%TEST_FILE% outputs/program.asm
if %errorlevel% neq 0 (
    echo.
    echo  COMPILATION FAILED!
    echo Please fix the errors in tests/%TEST_FILE%
    echo.
    echo Deleting old executable to avoid running stale code...
    if exist outputs\program.exe del outputs\program.exe
    pause
    exit /b 1
)
echo Assembly generated successfully!
echo.

echo Step 3: Assembling with NASM...
nasm -f win32 outputs/program.asm -o outputs/program.obj
if %errorlevel% neq 0 (
    echo.
    echo  NASM ASSEMBLY FAILED!
    pause
    exit /b 1
)
echo  Assembly successful!
echo.

echo Step 4: Compiling runtime driver...
gcc -c runtime/driver.c -o outputs/driver.obj
if %errorlevel% neq 0 (
    echo.
    echo  RUNTIME COMPILATION FAILED!
    pause
    exit /b 1
)
echo  Runtime compiled successfully!
echo.

echo Step 5: Linking...
gcc outputs/driver.obj outputs/program.obj -o outputs/program.exe
if %errorlevel% neq 0 (
    echo.
    echo  LINKING FAILED!
    pause
    exit /b 1
)
echo Linking successful!
echo.

echo Step 6: Running program...
echo ------------------------
outputs\program.exe
if %errorlevel% neq 0 (
    echo.
    echo  Program exited with error code: %errorlevel%
)
echo ------------------------
echo.

echo  ALL STEPS COMPLETED SUCCESSFULLY 
pause