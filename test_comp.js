const fs = require('fs');

const compCode = fs.readFileSync('ui/compiler.js', 'utf8');
eval(compCode.replace(/window\./g, 'global.'));

const comp = new global.Compiler('int result = 42; print result;');
console.log(comp.compile());
