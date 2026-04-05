const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- TOKENIZER & PARSER ---
const tokenize = (str) => {
  const tokens = [];
  const regex = /\s*([0-9]+|[a-z]|[+*/()-=])\s*/g;
  let m;
  while ((m = regex.exec(str)) !== null) {
    const lastToken = tokens[tokens.length - 1];
    const currentToken = m[1];
    if (lastToken && /[0-9]+/.test(lastToken) && /[a-z]/.test(currentToken)) tokens.push('*');
    tokens.push(currentToken);
  }
  return tokens;
};

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }
  parseExpression() {
    let node = this.parseTerm();
    while (this.tokens[this.pos] === '+' || this.tokens[this.pos] === '-') {
      const op = this.tokens[this.pos++];
      node = { type: 'BinaryOp', op, left: node, right: this.parseTerm() };
    }
    return node;
  }
  parseTerm() {
    let node = this.parseFactor();
    while (this.tokens[this.pos] === '*' || this.tokens[this.pos] === '/') {
      const op = this.tokens[this.pos++];
      node = { type: 'BinaryOp', op, left: node, right: this.parseFactor() };
    }
    return node;
  }
  parseFactor() {
    const token = this.tokens[this.pos++];
    if (token === '(') {
      const node = this.parseExpression();
      if (this.tokens[this.pos] === ')') this.pos++;
      return node;
    }
    if (/[0-9]+/.test(token)) return { type: 'Number', value: parseInt(token) };
    if (/[a-z]/.test(token)) return { type: 'Variable', name: token };
    throw new Error("Syntax Error");
  }
}

function evaluateAST(node, vars) {
  if (node.type === 'Number') return node.value;
  if (node.type === 'Variable') return vars[node.name] || 0;
  const left = evaluateAST(node.left, vars);
  const right = evaluateAST(node.right, vars);
  if (node.op === '+') return left + right;
  if (node.op === '-') return left - right;
  if (node.op === '*') return left * right;
  if (node.op === '/') return right === 0 ? Infinity : left / right;
}

// --- SOLVER ---
const solveQuant = (equationStr, rules = []) => {
  const [lhs, rhs] = equationStr.replace(/\s/g, '').split('=');
  const target = parseInt(rhs);
  const tokens = tokenize(lhs);
  const parser = new Parser(tokens);
  const ast = parser.parseExpression();
  const vars = [...new Set(tokens.filter(t => /[a-z]/.test(t)))].sort();
  const results = [];
  const backtrack = (index, current) => {
    if (results.length >= 2000) return;
    if (index === vars.length) {
      if (evaluateAST(ast, current) === target) results.push({ ...current });
      return;
    }
    const varName = vars[index];
    let min = 0, max = Math.max(target, 1000);
    rules.forEach(r => {
      if (r.variable === varName) {
        if (r.type === 'min') min = Math.max(min, parseInt(r.value));
        if (r.type === 'max') max = Math.min(max, parseInt(r.value));
      }
    });
    for (let i = min; i <= max; i++) {
      current[varName] = i;
      backtrack(index + 1, current);
    }
  };
  backtrack(0, {});
  return results;
};

// --- ROUTES ---
let historyDB = [];
app.post('/api/solve', (req, res) => {
  const { equation, rules } = req.body;
  try {
    const solutions = solveQuant(equation, rules || []);
    const formattedOutput = solutions.length > 0 
      ? solutions.map(s => `{${Object.entries(s).map(([k,v]) => `${k}:${v}`).join(',')}}`).join(',')
      : "No positive whole number solutions exist.";
    
    const record = {
      id: Date.now(),
      input: equation,
      output: formattedOutput,
      count: solutions.length,
      // CHANGE: Added hour12: true for AM/PM display
      timestamp: new Date().toLocaleString('en-US', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit', 
        hour12: true 
      })
    };
    historyDB.unshift(record);
    res.json(record);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/history', (req, res) => res.json(historyDB));
app.listen(5000, () => console.log("QS_STRICT_SERVER_v4_READY"));