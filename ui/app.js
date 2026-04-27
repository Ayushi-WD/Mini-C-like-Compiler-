
(function () {
    'use strict';

    
    const EXAMPLES = [
        { name: 'Hello Variables', desc: 'Basic variable declaration & print', code: 'int x = 10;\nint y = 20;\nint z = x + y;\nprint z;' },
        { name: 'If / Else', desc: 'Conditional branching', code: 'int score = 75;\nif (score > 50) {\n    print 1;\n} else {\n    print 0;\n}' },
        { name: 'While Loop', desc: 'Print 1 to 5', code: 'int x = 10;\nint y = 20;\nint z = x + y;\nprint z;\n\nif (z > 25) {\n    print 100;\n} else {\n    print 0;\n}\n\nint i = 1;\nwhile (i <= 5) {\n    print i;\n    i = i + 1;\n}' },
        { name: 'For Loop', desc: 'Nested for loops', code: 'for (int i = 1; i <= 3; i = i + 1) {\n    for (int j = 1; j <= 2; j = j + 1) {\n        print i * 10 + j;\n    }\n}' },
        { name: 'Array Sum', desc: 'Array with while loop', code: 'int arr[5];\narr[0] = 1;\narr[1] = 2;\narr[2] = 3;\narr[3] = 4;\narr[4] = 5;\nint sum = 0;\nint i = 0;\nwhile (i < 5) {\n    sum = sum + arr[i];\n    i = i + 1;\n}\nprint sum;' },
        { name: 'Optimization', desc: 'Arithmetic expressions', code: 'int a = 5 + 3 * 2;\nint b = 10 * 2;\nint c = 8 / 4;\nint d = 2 * 2 * 2;\nint e = a + 0;\nint f = b * 1;\nint g = c * 0;\n\nprint a;\nprint b;\nprint c;\nprint d;\nprint e;\nprint f;\nprint g;' },
        { name: 'Calculator', desc: 'Simple expression', code: 'int result = (5 + 3) * 2;\nprint result;' },
        { name: '⚠ Missing Semicolon', desc: 'Error example', code: 'int x = 10\nprint x;' },
        { name: '⚠ Undeclared Var', desc: 'Error example', code: 'int x = 10;\nprint y;' },
    ];

    
    const $ = id => document.getElementById(id);
    const editor = $('sourceEditor');
    const lineNumbers = $('lineNumbers');
    const lineColInfo = $('lineColInfo');
    const assemblyOutput = $('assemblyOutput');
    const tokensOutput = $('tokensOutput');
    const symbolsOutput = $('symbolsOutput');
    const statusText = $('statusText');
    const treeOutput = $('treeOutput');
    const consoleBadge = $('consoleBadge');
    const examplesDropdown = $('examplesDropdown');
    const fileUpload = $('fileUpload');
    const exportDropdown = $('exportDropdown');
    const btnExport = $('btnExport');
    
    
    let lastCompiledAsm = '';

    
    EXAMPLES.forEach((ex, i) => {
        const btn = document.createElement('button');
        btn.className = 'dropdown-item';
        btn.setAttribute('role', 'menuitem');
        btn.innerHTML = `${ex.name}<span class="dropdown-item-desc">${ex.desc}</span>`;
        btn.addEventListener('click', () => {
            editor.value = ex.code;
            updateLineNumbers();
            closeDropdown();
        });
        btn.style.animationDelay = `${i * 30}ms`;
        examplesDropdown.appendChild(btn);
    });

    
    const btnExamples = $('btnExamples');
    function toggleDropdown(el, btn) {
        const open = el.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
    }
    function closeAllDropdowns() {
        examplesDropdown.classList.remove('open');
        btnExamples.setAttribute('aria-expanded', 'false');
        if (exportDropdown) {
            exportDropdown.classList.remove('open');
            btnExport.setAttribute('aria-expanded', 'false');
        }
    }
    
    btnExamples.addEventListener('click', e => { e.stopPropagation(); closeAllDropdowns(); toggleDropdown(examplesDropdown, btnExamples); });
    if (btnExport) btnExport.addEventListener('click', e => { e.stopPropagation(); closeAllDropdowns(); toggleDropdown(exportDropdown, btnExport); });
    document.addEventListener('click', closeAllDropdowns);

    
    function updateLineNumbers() {
        const lines = editor.value.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) html += i + '\n';
        lineNumbers.textContent = html;
    }

    editor.addEventListener('input', updateLineNumbers);
    editor.addEventListener('scroll', () => { lineNumbers.scrollTop = editor.scrollTop; });
    editor.addEventListener('keyup', updateCursorInfo);
    editor.addEventListener('click', updateCursorInfo);

    function updateCursorInfo() {
        const val = editor.value.substring(0, editor.selectionStart);
        const line = val.split('\n').length;
        const col = val.split('\n').pop().length + 1;
        lineColInfo.textContent = `Ln ${line}, Col ${col}`;
    }

    
    editor.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 4;
            updateLineNumbers();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            doCompile();
        }
    });

    
    const tabs = document.querySelectorAll('#outputPanel .panel-tab');
    const contents = document.querySelectorAll('#outputPanel .tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            const contentId = 'content' + target.charAt(0).toUpperCase() + target.slice(1);
            const content = document.getElementById(contentId);
            if (content) content.classList.add('active');
        });
    });

    
    function setStatus(text, type = 'ready') {
        statusText.textContent = text;
        statusIndicator.className = 'status-indicator';
        if (type === 'error') statusIndicator.classList.add('error');
        else if (type === 'compiling') statusIndicator.classList.add('compiling');
    }

    
    const pipelineSteps = document.querySelectorAll('.pipeline-step');
    function resetPipeline() { pipelineSteps.forEach(s => { s.classList.remove('active', 'done'); }); }
    function setPipelineStep(n, state) {
        const el = document.querySelector(`.pipeline-step[data-step="${n}"]`);
        if (el) { el.classList.remove('active', 'done'); if (state) el.classList.add(state); }
    }

    async function animatePipeline(success) {
        resetPipeline();
        for (let i = 1; i <= 5; i++) {
            setPipelineStep(i, 'active');
            await sleep(180);
            setPipelineStep(i, success || i < 5 ? 'done' : '');
            if (!success && i >= 3) break;
        }
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    
    function doCompile() {
        const source = editor.value.trim();
        if (!source) { setStatus('No source code', 'error'); return; }

        setStatus('Compiling...', 'compiling');

        
        setTimeout(() => {
            const compiler = new MiniCCompiler(source);
            const result = compiler.compile();

            
            if (result.success && result.asm) {
                lastCompiledAsm = result.asm;
                assemblyOutput.innerHTML = highlightAsm(result.asm);
            } else {
                lastCompiledAsm = '';
                assemblyOutput.innerHTML = '<span class="output-placeholder">; No assembly generated (compilation failed)</span>';
            }

            
            renderTokens(result.tokens);
            renderSymbols(result.symbols);
            renderConsole(result.logs, result.errors);

            
            if (result.ast) {
                renderTree(result.ast, treeOutput);
            } else {
                treeOutput.innerHTML = '<div class="output-placeholder-wrapper"><span class="output-placeholder">No parse tree generated</span></div>';
            }

            
            animatePipeline(result.success);

            if (result.success) {
                setStatus('Compiled Successfully', 'ready');
                switchTab('assembly');
            } else {
                setStatus(`${result.errors.length} Error(s)`, 'error');
                switchTab('console');
            }
            
            
            if (window._runAfterCompileCallback) {
                const cb = window._runAfterCompileCallback;
                window._runAfterCompileCallback = null;
                cb(result);
            }
        }, 80);
    }

    function doTokenize() {
        const source = editor.value.trim();
        if (!source) { setStatus('No source code', 'error'); return; }

        try {
            const lexer = new Lexer(source);
            const tokens = lexer.tokenize().filter(t => t.type !== TokenType.EOF);
            renderTokens(tokens);
            switchTab('tokens');
            setStatus(`${tokens.length} tokens found`, 'ready');
            
            resetPipeline();
            setPipelineStep(1, 'done');
            setPipelineStep(2, 'done');
        } catch (e) {
            renderConsole([{ msg: `LEXER ERROR: ${e.message}`, type: 'error' }], [{ message: e.message, line: e.line || 1 }]);
            switchTab('console');
            setStatus('Lexer Error', 'error');
        }
    }

    function switchTab(name) {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        const tab = document.querySelector(`[data-tab="${name}"]`);
        if (tab) tab.classList.add('active');
        const content = document.getElementById('content' + name.charAt(0).toUpperCase() + name.slice(1));
        if (content) content.classList.add('active');
    }

    
    function getTokenCategory(type) {
        if (type.startsWith('KEYWORD')) return 'keyword';
        if (type === 'NUMBER') return 'number';
        if (type === 'IDENTIFIER') return 'identifier';
        if (['PLUS', 'MINUS', 'STAR', 'SLASH', 'ASSIGN', 'EQ', 'NE', 'LT', 'LE', 'GT', 'GE'].includes(type)) return 'operator';
        return 'punctuation';
    }

    function renderTokens(tokens) {
        if (!tokens || tokens.length === 0) {
            tokensOutput.innerHTML = '<div class="output-placeholder-wrapper"><span class="output-placeholder">No tokens to display</span></div>';
            return;
        }
        tokensOutput.innerHTML = tokens.map((t, i) => {
            const cat = getTokenCategory(t.type);
            const display = t.type === 'NUMBER' ? t.value : (t.type === 'IDENTIFIER' ? t.name : (TOKEN_DISPLAY[t.type] || t.type));
            return `<div class="token-chip" style="animation-delay:${i * 20}ms">
                <span class="token-type token-type-${cat}">${t.type.replace('KEYWORD_', '')}</span>
                <span class="token-value">${escapeHtml(String(display))}</span>
            </div>`;
        }).join('');
    }

    function renderSymbols(symbols) {
        if (!symbols || symbols.length === 0) {
            symbolsOutput.innerHTML = '<div class="output-placeholder-wrapper"><span class="output-placeholder">No symbols declared</span></div>';
            return;
        }
        let html = '<table class="symbols-table"><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Value</th><th>Line</th></tr></thead><tbody>';
        symbols.forEach((s, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td class="sym-name">${escapeHtml(s.name)}</td>
                <td class="sym-type">${s.isArray ? `int[${s.arraySize}]` : 'int'}</td>
                <td class="sym-value">${s.value}</td>
                <td>${s.line}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        symbolsOutput.innerHTML = html;
    }

    function renderTree(ast, container) {
        if (!ast) {
            container.innerHTML = '<div class="output-placeholder-wrapper"><span class="output-placeholder">No parse tree to display</span></div>';
            return;
        }

        const root = document.createElement('div');
        root.className = 'tree-root';
        root.appendChild(createTreeNode(ast));
        container.innerHTML = '';
        container.appendChild(root);
    }

    function createTreeNode(node) {
        if (!node) return document.createTextNode('null');

        const el = document.createElement('div');
        el.className = 'tree-node';

        const content = document.createElement('div');
        content.className = `tree-content type-${node.type.toLowerCase()}`;

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.textContent = getNodeIcon(node.type);
        content.appendChild(icon);

        const typeSpan = document.createElement('span');
        typeSpan.className = 'tree-type';
        typeSpan.textContent = node.type;
        content.appendChild(typeSpan);

        if (node.name) {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'tree-val';
            nameSpan.textContent = node.name;
            content.appendChild(nameSpan);
        }

        if (node.value !== undefined) {
            const valSpan = document.createElement('span');
            valSpan.className = 'tree-val';
            valSpan.textContent = node.value;
            content.appendChild(valSpan);
        }

        if (node.operator) {
            const opSpan = document.createElement('span');
            opSpan.className = 'tree-val';
            opSpan.textContent = (typeof node.operator === 'string') ? node.operator : TOKEN_DISPLAY[node.operator];
            content.appendChild(opSpan);
        }

        el.appendChild(content);

        const children = getChildren(node);
        if (children && children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            children.forEach(child => {
                if (child.label) {
                    const labelNode = document.createElement('div');
                    labelNode.className = 'tree-node';
                    const labelContent = document.createElement('div');
                    labelContent.className = 'tree-content';
                    labelContent.innerHTML = `<span class="tree-label">${child.label}:</span>`;
                    labelNode.appendChild(labelContent);
                    if (child.node) {
                        labelNode.appendChild(createTreeNode(child.node));
                    } else if (child.list) {
                        const listContainer = document.createElement('div');
                        listContainer.className = 'tree-children';
                        child.list.forEach(item => listContainer.appendChild(createTreeNode(item)));
                        labelNode.appendChild(listContainer);
                    }
                    childrenContainer.appendChild(labelNode);
                } else {
                    childrenContainer.appendChild(createTreeNode(child));
                }
            });
            el.appendChild(childrenContainer);
        }

        return el;
    }

    function getNodeIcon(type) {
        switch (type) {
            case 'Program': return '📦';
            case 'Declaration': return '💎';
            case 'Assignment': return '📝';
            case 'IfStatement': return '🔀';
            case 'WhileStatement': return '🔁';
            case 'ForStatement': return '🔄';
            case 'PrintStatement': return '📠';
            case 'BinaryExpression': return '🧮';
            case 'UnaryExpression': return '➖';
            case 'Literal': return '🔢';
            case 'Variable': return '🏷️';
            case 'ArrayAccess': return '📑';
            case 'Condition': return '⚖️';
            default: return '📄';
        }
    }

    function getChildren(node) {
        switch (node.type) {
            case 'Program': return node.children;
            case 'Declaration': {
                const c = [];
                if (node.initExpr) c.push({ label: 'init', node: node.initExpr });
                if (node.initValues) c.push({ label: 'values', list: node.initValues.map(v => ({ type: 'Literal', value: v })) });
                return c;
            }
            case 'Assignment': {
                const c = [];
                if (node.indexExpr) c.push({ label: 'index', node: node.indexExpr });
                c.push({ label: 'value', node: node.valueExpr });
                return c;
            }
            case 'IfStatement': {
                const c = [{ label: 'cond', node: node.condition }, { label: 'then', list: node.thenBody }];
                if (node.elseBody) c.push({ label: 'else', list: node.elseBody });
                return c;
            }
            case 'WhileStatement': return [{ label: 'cond', node: node.condition }, { label: 'body', list: node.body }];
            case 'ForStatement': {
                const c = [];
                if (node.init) c.push({ label: 'init', node: node.init });
                c.push({ label: 'cond', node: node.condition });
                if (node.step) c.push({ label: 'step', node: node.step });
                c.push({ label: 'body', list: node.body });
                return c;
            }
            case 'PrintStatement': return [node.expression];
            case 'BinaryExpression': return [node.left, node.right];
            case 'UnaryExpression': return [node.argument];
            case 'Condition': return [node.left, node.right];
            case 'ArrayAccess': return [{ label: 'index', node: node.index }];
            default: return null;
        }
    }

    function renderConsole(logs, errors) {
        let html = '';
        if (logs && logs.length > 0) {
            logs.forEach(l => {
                const cls = l.type === 'error' ? 'log-error' : l.type === 'success' ? 'log-success' : l.type === 'step' ? 'log-step' : 'log-info';
                
                if (l.type === 'success') {
                    html += `<div class="${cls} program-output-line">${escapeHtml(l.msg)}</div>`;
                } else {
                    html += `<div class="${cls}">${escapeHtml(l.msg)}</div>`;
                }
            });
        }
        if (errors && errors.length > 0) {
            html += '<div class="console-separator"></div>';
            errors.forEach(e => {
                html += `<div class="log-error">✖ Line ${e.line}: ${escapeHtml(e.message)}</div>`;
            });
        }
        consoleOutput.innerHTML = html || '<span class="output-placeholder">No output recorded.</span>';
        
        
        setTimeout(() => {
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }, 10);

        
        if (errors && errors.length > 0) {
            consoleBadge.textContent = errors.length;
            consoleBadge.style.display = 'inline-flex';
        } else {
            consoleBadge.style.display = 'none';
        }
    }

    
    function highlightAsm(asm) {
        return asm.split('\n').map(line => {
            
            if (line.trim().startsWith(';')) return `<span class="asm-comment">${escapeHtml(line)}</span>`;
            
            if (/^\s*section\s/i.test(line)) return `<span class="asm-directive">${escapeHtml(line)}</span>`;
            
            if (/^[._a-zA-Z][\w]*:/.test(line.trim())) return `<span class="asm-label">${escapeHtml(line)}</span>`;
            
            if (/^\s*(global|extern)\s/i.test(line)) return `<span class="asm-keyword">${escapeHtml(line)}</span>`;
            
            let escaped = escapeHtml(line);
            
            escaped = escaped.replace(/\b(eax|ebx|ecx|edx|esi|edi|esp|ebp|al|bl|cl|dl|rax|rbx|rcx|rdx)\b/g, '<span class="asm-register">$1</span>');
            
            escaped = escaped.replace(/\b(\d+)\b/g, '<span class="asm-number">$1</span>');
            
            escaped = escaped.replace(/^\s*(mov|add|sub|imul|idiv|push|pop|call|ret|cmp|je|jmp|jne|jg|jge|jl|jle|sete|setne|setl|setle|setg|setge|movzx|xor|shl|shr|dword|dd|times)\b/i, (m, p1) => m.replace(p1, `<span class="asm-instruction">${p1}</span>`));
            
            escaped = escaped.replace(/(\[.*?\])/g, '<span class="asm-memory">$1</span>');
            return escaped;
        }).join('\n');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    
    
    
    if ($('btnUpload')) {
        $('btnUpload').addEventListener('click', () => fileUpload.click());
        fileUpload.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = evt => {
                editor.value = evt.target.result;
                updateLineNumbers();
                setStatus(`Loaded: ${file.name}`);
                fileUpload.value = ''; 
            };
            reader.readAsText(file);
        });
    }

    
    function downloadBlob(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    if ($('exportCmini')) {
        $('exportCmini').addEventListener('click', () => {
            const src = editor.value.trim();
            if (!src) return alert('No source code to export.');
            downloadBlob(src, 'program.cmini');
        });
    }

    if ($('exportAsm')) {
        $('exportAsm').addEventListener('click', () => {
            if (!lastCompiledAsm) return alert('Please compile successfully first.');
            downloadBlob(lastCompiledAsm, 'program.asm');
        });
    }

    
    function doRun() {
        
        window._runAfterCompileCallback = (result) => {
            if (!result.success || !lastCompiledAsm) {
                setStatus('Compilation failed, cannot run.', 'error');
                return;
            }
            
            setStatus('Simulating x86...', 'compiling');
            setTimeout(() => {
                try {
                    const sim = new X86Simulator(lastCompiledAsm);
                    const simResult = sim.run();
                    
                    
                    const formattedLogs = simResult.logs.map(m => ({ msg: m, type: 'step' }));
                    if (simResult.output.length > 0) {
                        formattedLogs.push({ msg: '--- PROGRAM OUTPUT ---', type: 'info' });
                        simResult.output.forEach(val => formattedLogs.push({ msg: `${val}`, type: 'success' }));
                    } else {
                        formattedLogs.push({ msg: 'Program exited with no output.', type: 'info' });
                    }
                    
                    
                    const existingLogs = result.logs || [];
                    const allLogs = existingLogs.concat([{ msg: '', type: 'info' }], formattedLogs);
                    
                    
                    if (result.symbols && sim.memory) {
                        result.symbols.forEach(s => {
                            if (sim.memory[s.name] !== undefined) {
                                s.value = s.memoryValue = sim.memory[s.name][0];
                                if (s.isArray) {
                                    s.value = `[${sim.memory[s.name].join(', ')}]`;
                                }
                            }
                        });
                    }

                    renderConsole(allLogs, result.errors);
                    renderSymbols(result.symbols);
                    switchTab('console');
                    setStatus('Simulation Complete', 'ready');
                } catch (err) {
                    const existingLogs = result.logs || [];
                    existingLogs.push({ msg: 'SIMULATOR CRASH: ' + err.message, type: 'error' });
                    renderConsole(existingLogs, result.errors);
                    switchTab('console');
                    setStatus('Simulation Error', 'error');
                }
            }, 50);
        };
        
        doCompile();
    }

    
    $('btnCompile').addEventListener('click', doCompile);
    if ($('btnRun')) $('btnRun').addEventListener('click', doRun);
    $('btnTokenize').addEventListener('click', doTokenize);
    $('btnClear').addEventListener('click', () => {
        editor.value = '';
        lastCompiledAsm = '';
        assemblyOutput.innerHTML = '<span class="output-placeholder">; Assembly output will appear here after compilation</span>';
        tokensOutput.innerHTML = '<div class="output-placeholder-wrapper"><span class="output-placeholder">Click "Tokenize" to see the lexical analysis output</span></div>';
        symbolsOutput.innerHTML = '<div class="output-placeholder-wrapper"><span class="output-placeholder">Symbol table will appear here after compilation</span></div>';
        consoleOutput.innerHTML = '<span class="output-placeholder">Compiler console output will appear here...</span>';
        consoleBadge.style.display = 'none';
        updateLineNumbers();
        resetPipeline();
        setStatus('Ready');
        switchTab('assembly');
    });

    
    const themeIcon = $('themeIcon');
    $('btnThemeToggle').addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        themeIcon.textContent = document.body.classList.contains('light-theme') ? '☀️' : '🌙';
    });

    
    
    editor.value = EXAMPLES[0].code;
    updateLineNumbers();
    updateCursorInfo();
})();
