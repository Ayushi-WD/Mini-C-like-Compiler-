const fs = require('fs');

const simCode = fs.readFileSync('ui/simulator.js', 'utf8').replace('window.X86Simulator = X86Simulator;', 'module.exports = X86Simulator;');
fs.writeFileSync('temp_sim.js', simCode);
const X86Simulator = require('./temp_sim.js');

const asm = `
section .data
    result dd 0
section .text
    global _our_code
    extern _print_int

_our_code:
    mov eax, 42
    mov dword [result], eax
    mov eax, dword [result]
    push eax
    call _print_int
    add esp, 4
    ret
`;

const sim = new X86Simulator(asm);
const result = sim.run();
console.log('Output:', result.output);
console.log('Logs:', result.logs);
