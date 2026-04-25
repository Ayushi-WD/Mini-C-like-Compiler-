

class X86Simulator {
    constructor(asmString) {
        this.asmLines = asmString.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith(';'));
        this.registers = { eax: 0, ebx: 0, ecx: 0, edx: 0, esp: 0, ebp: 0, al: 0 };
        this.flags = { zf: 0, sf: 0, of: 0, cf: 0 };
        this.memory = {}; 
        this.stack = [];
        this.labels = {};
        this.instructions = [];
        this.output = [];
        this.ip = 0; 
    }

    parse() {
        let inData = false;
        let inText = false;

        for (let i = 0; i < this.asmLines.length; i++) {
            let line = this.asmLines[i];
            
            if (line === 'section .data') { inData = true; inText = false; continue; }
            if (line === 'section .text') { inText = true; inData = false; continue; }
            if (line.startsWith('global') || line.startsWith('extern')) continue;

            if (inData) {
                
                
                const parts = line.split(/\s+/);
                const name = parts[0];
                if (parts[1] === 'times') {
                    const size = parseInt(parts[2], 10);
                    const val = parseInt(parts[4], 10);
                    this.memory[name] = new Array(size).fill(val);
                } else if (parts[1] === 'dd') {
                    const val = parseInt(parts[2], 10);
                    this.memory[name] = [val];
                }
            } else if (inText) {
                if (line.endsWith(':')) {
                    const label = line.slice(0, -1);
                    this.labels[label] = this.instructions.length;
                } else {
                    this.instructions.push(line);
                }
            }
        }
        
        
        if (this.labels['_our_code'] !== undefined) {
            this.ip = this.labels['_our_code'];
        }
    }

    
    getValue(operand) {
        if (!operand) return 0;
        if (/^\d+$/.test(operand) || /^-?\d+$/.test(operand)) return parseInt(operand, 10);
        if (this.registers[operand] !== undefined) return this.registers[operand];
        
        
        if (operand.includes('[')) {
            const mem = this.resolveMemory(operand);
            if (mem && this.memory[mem.base] !== undefined) {
                return this.memory[mem.base][mem.index] || 0;
            }
        }
        return 0; 
    }

    
    setValue(operand, value) {
        if (this.registers[operand] !== undefined) {
            this.registers[operand] = value;
            if (operand === 'eax') this.registers['al'] = value & 0xFF; 
        }
    }

    
    resolveMemory(operand) {
        
        
        
        
        const memRegex = /dword\s*\[\s*([a-zA-Z_]\w*)\s*(?:\+\s*([^\]]+))?\s*\]/;
        const match = operand.match(memRegex);
        if (!match) return null;

        const base = match[1];
        let offset = 0;

        if (match[2]) {
            let offsetExpr = match[2].trim();
            if (offsetExpr.includes('*')) {
                
                const parts = offsetExpr.split('*');
                offset = parseInt(parts[0], 10) * parseInt(parts[1], 10);
            } else if (this.registers[offsetExpr] !== undefined) {
                
                offset = this.registers[offsetExpr];
            } else {
                offset = parseInt(offsetExpr, 10);
            }
        }

        const index = Math.floor(offset / 4); 
        return { base, index };
    }

    step() {
        if (this.ip >= this.instructions.length) return false;

        const inst = this.instructions[this.ip++];
        
        
        const spaceIdx = inst.indexOf(' ');
        const opcode = spaceIdx === -1 ? inst : inst.substring(0, spaceIdx).trim();
        const operandsStr = spaceIdx === -1 ? '' : inst.substring(spaceIdx + 1).trim();
        
        
        let ops = [];
        if (operandsStr) {
            if (operandsStr.includes('[')) {
                
                const commaIdx = operandsStr.indexOf(',', operandsStr.indexOf(']'));
                if (commaIdx !== -1) {
                    ops = [operandsStr.substring(0, commaIdx).trim(), operandsStr.substring(commaIdx + 1).trim()];
                } else {
                    const firstComma = operandsStr.indexOf(',');
                    if (firstComma !== -1 && firstComma < operandsStr.indexOf('[')) {
                        ops = [operandsStr.substring(0, firstComma).trim(), operandsStr.substring(firstComma + 1).trim()];
                    } else {
                        ops = [operandsStr];
                    }
                }
            } else {
                ops = operandsStr.split(',').map(s => s.trim());
            }
        }

        const op1 = ops[0];
        const op2 = ops[1];

        switch (opcode) {
            case 'mov':
                const memDest = this.resolveMemory(op1);
                const memSrc = this.resolveMemory(op2);
                
                if (memDest) {
                    
                    this.memory[memDest.base][memDest.index] = memSrc ? this.memory[memSrc.base][memSrc.index] : this.getValue(op2);
                } else if (memSrc) {
                    
                    this.setValue(op1, this.memory[memSrc.base][memSrc.index]);
                } else {
                    
                    this.setValue(op1, this.getValue(op2));
                }
                break;

            case 'add':
                if (op1 === 'esp') break; 
                this.setValue(op1, this.getValue(op1) + this.getValue(op2));
                break;

            case 'sub':
                if (op1 === 'esp') break;
                this.setValue(op1, this.getValue(op1) - this.getValue(op2));
                break;

            case 'imul':
                this.setValue(op1, this.getValue(op1) * this.getValue(op2));
                break;

            case 'idiv':
                const dividend = this.getValue('eax');
                const divisor = this.getValue(op1);
                if (divisor === 0) throw new Error("Division by zero");
                this.setValue('eax', Math.trunc(dividend / divisor));
                this.setValue('edx', dividend % divisor);
                break;

            case 'xor':
                this.setValue(op1, this.getValue(op1) ^ this.getValue(op2));
                break;

            case 'neg':
                this.setValue(op1, -this.getValue(op1));
                break;

            case 'shl':
                this.setValue(op1, this.getValue(op1) << this.getValue(op2));
                break;

            case 'push':
                this.stack.push(this.getValue(op1));
                break;

            case 'pop':
                this.setValue(op1, this.stack.pop());
                break;

            case 'cmp':
                const val1 = this.getValue(op1);
                const val2 = this.getValue(op2);
                const res = val1 - val2;
                this.flags.zf = res === 0 ? 1 : 0;
                this.flags.sf = res < 0 ? 1 : 0;
                break;

            case 'sete': this.setValue(op1, this.flags.zf === 1 ? 1 : 0); break;
            case 'setne': this.setValue(op1, this.flags.zf === 0 ? 1 : 0); break;
            case 'setl': this.setValue(op1, this.flags.sf !== this.flags.of ? 1 : 0); break;
            case 'setle': this.setValue(op1, (this.flags.zf === 1 || this.flags.sf !== this.flags.of) ? 1 : 0); break;
            case 'setg': this.setValue(op1, (this.flags.zf === 0 && this.flags.sf === this.flags.of) ? 1 : 0); break;
            case 'setge': this.setValue(op1, this.flags.sf === this.flags.of ? 1 : 0); break;

            case 'movzx':
                this.setValue(op1, this.getValue(op2));
                break;

            case 'jmp':
                if (this.labels[op1] !== undefined) this.ip = this.labels[op1];
                break;

            case 'je':
                if (this.flags.zf === 1 && this.labels[op1] !== undefined) this.ip = this.labels[op1];
                break;

            case 'call':
                if (op1 === '_print_int') {
                    
                    const arg = this.stack[this.stack.length - 1];
                    this.output.push(arg);
                }
                break;

            case 'ret':
                return false; 
        }

        return true;
    }

    run() {
        this.parse();
        if (this.instructions.length === 0) return { output: [], logs: ["No instructions to execute"] };
        
        let stepCount = 0;
        const MAX_STEPS = 100000; 
        
        try {
            while (this.step() && stepCount < MAX_STEPS) {
                stepCount++;
            }
            if (stepCount >= MAX_STEPS) {
                return { output: this.output, logs: [`Simulator aborted: Exceeded ${MAX_STEPS} steps (infinite loop?)`] };
            }
            return { output: this.output, logs: [`Simulator finished successfully in ${stepCount} steps`] };
        } catch (e) {
            return { output: this.output, logs: [`Simulator crashed: ${e.message} at instruction ${this.ip - 1}`] };
        }
    }
}

module.exports = X86Simulator;
