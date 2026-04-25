const fs = require('fs');

const compCode = fs.readFileSync('ui/compiler.js', 'utf8').replace(/window\./g, 'global.');
eval(compCode);

const simCode = fs.readFileSync('ui/simulator.js', 'utf8').replace('window.X86Simulator = X86Simulator;', 'global.X86Simulator = X86Simulator;');
eval(simCode);

const code = "int result = 42;\nprint result;";
const compiler = new global.Compiler(code);
const compResult = compiler.compile();

console.log("=== COMPILER RESULT ===");
console.log(compResult.success ? "SUCCESS" : "FAIL");
console.log("ASM:");
console.log(compResult.asm);

if (compResult.success) {
    const sim = new global.X86Simulator(compResult.asm);
    const simResult = sim.run();
    console.log("=== SIMULATOR RESULT ===");
    console.log(simResult);
}
