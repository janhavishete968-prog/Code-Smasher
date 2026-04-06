const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let history = [];
const MAX_HISTORY = 40;

/* ---------------- TOKENIZER ---------------- */
function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    let ch = expr[i];

    if (ch === ' ') { i++; continue; }

    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: Number(num) });

      if (i < expr.length && /[a-z(]/i.test(expr[i])) {
        tokens.push({ type: 'op', value: '*' });
      }
      continue;
    }

    if (/[a-z]/i.test(ch)) {
      tokens.push({ type: 'var', value: ch });
      i++;
      if (i < expr.length && expr[i] === '(') {
        tokens.push({ type: 'op', value: '*' });
      }
      continue;
    }

    if ('+-*/()=' .includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    throw new Error("Invalid character: " + ch);
  }

  return tokens;
}

/* ---------------- PARSER ---------------- */
function parseExpression(tokens) {
  let pos = 0;

  function parsePrimary() {
    let token = tokens[pos];
    if (!token) throw new Error("Unexpected end");

    if (token.type === 'number') {
      pos++;
      return { type: 'num', value: token.value };
    }

    if (token.type === 'var') {
      pos++;
      return { type: 'var', name: token.value };
    }

    if (token.value === '(') {
      pos++;
      let expr = parseAddSub();
      if (tokens[pos]?.value !== ')') throw new Error("Missing )");
      pos++;
      return expr;
    }

    throw new Error("Invalid syntax");
  }

  function parseMulDiv() {
    let node = parsePrimary();
    while (tokens[pos] && (tokens[pos].value === '*' || tokens[pos].value === '/')) {
      let op = tokens[pos++].value;
      let right = parsePrimary();
      node = { type: op, left: node, right };
    }
    return node;
  }

  function parseAddSub() {
    let node = parseMulDiv();
    while (tokens[pos] && (tokens[pos].value === '+' || tokens[pos].value === '-')) {
      let op = tokens[pos++].value;
      let right = parseMulDiv();
      node = { type: op, left: node, right };
    }
    return node;
  }

  return parseAddSub();
}

/* ---------------- LINEAR EXTRACTION ---------------- */
function extract(node) {
  if (node.type === 'num') return { coeffs: {}, constant: node.value };
  if (node.type === 'var') return { coeffs: { [node.name]: 1 }, constant: 0 };

  let left = extract(node.left);
  let right = extract(node.right);

  if (node.type === '+') return combine(left, right, 1);
  if (node.type === '-') return combine(left, right, -1);

  if (node.type === '*') {
    if (Object.keys(left.coeffs).length && Object.keys(right.coeffs).length) {
      throw new Error("Non-linear equation not supported");
    }
    return Object.keys(left.coeffs).length ? scale(left, right.constant) : scale(right, left.constant);
  }

  if (node.type === '/') {
    if (Object.keys(right.coeffs).length) throw new Error("Invalid division");
    if (right.constant === 0) throw new Error("Division by zero");
    return scale(left, 1 / right.constant);
  }
}

function combine(a, b, sign) {
  const coeffs = { ...a.coeffs };
  for (let k in b.coeffs) {
    coeffs[k] = (coeffs[k] || 0) + sign * b.coeffs[k];
  }
  return { coeffs, constant: a.constant + sign * b.constant };
}

function scale(obj, factor) {
  const coeffs = {};
  for (let k in obj.coeffs) {
    coeffs[k] = obj.coeffs[k] * factor;
  }
  return { coeffs, constant: obj.constant * factor };
}

/* ---------------- LINEAR SOLVER ---------------- */
function solveLinear(coeffs, constant, constraints) {
  const vars = Object.keys(coeffs);
  const target = -constant;
  const solutions = [];
  const MAX_SOLUTIONS = 5000;

  function dfs(i, sum, assign) {
    if (solutions.length >= MAX_SOLUTIONS) return;

    if (i === vars.length - 1) {
      let v = vars[i];
      let c = coeffs[v];
      let remaining = target - sum;

      if (remaining % c === 0) {
        let val = remaining / c;
        let { min = 0, max = Infinity } = constraints[v] || {};
        if (val >= min && val <= max) {
          solutions.push({ ...assign, [v]: val });
        }
      }
      return;
    }

    let v = vars[i];
    let c = coeffs[v];
    let { min = 0, max = Infinity } = constraints[v] || {};

    let upper = Math.floor((target - sum) / c);
    if (max !== Infinity) upper = Math.min(upper, max);

    for (let val = min; val <= upper; val++) {
      assign[v] = val;
      dfs(i + 1, sum + c * val, assign);
    }
    delete assign[v];
  }

  dfs(0, 0, {});

  return {
    message: solutions.length ? `Found ${solutions.length} solution(s)` : "No solutions",
    solutions
  };
}

/* ---------------- POLYNOMIAL ---------------- */
function isPolynomial(eq) {
  return eq.includes('^');
}

function solveSingleVarPoly(eq) {
  let clean = eq.replace(/\s+/g, '');
  let [L, R] = clean.split('=');
  let expr = L + "-(" + R + ")";

  let a = 0, b = 0, c = 0;
  const regex = /([+-]?\d*)x\^2|([+-]?\d*)x(?!\^)|([+-]?\d+)/g;
  let m;

  while ((m = regex.exec(expr))) {
    if (m[1] !== undefined) {
      let v = m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : Number(m[1]);
      a += v;
    } else if (m[2] !== undefined) {
      let v = m[2] === "" || m[2] === "+" ? 1 : m[2] === "-" ? -1 : Number(m[2]);
      b += v;
    } else {
      c += Number(m[3]);
    }
  }

  let D = b*b - 4*a*c;

  if (D < 0) return { message: "No real solutions", solutions: [] };

  return {
    message: "Polynomial solutions",
    solutions: [
      { x: (-b + Math.sqrt(D)) / (2*a) },
      { x: (-b - Math.sqrt(D)) / (2*a) }
    ]
  };
}

function solveTwoVarPoly(eq) {
  const solutions = [];

  for (let x = -20; x <= 20; x++) {
    for (let y = -20; y <= 20; y++) {
      let exp = eq.replace(/x/g, `(${x})`)
                  .replace(/y/g, `(${y})`)
                  .replace('=', '==');

      try {
        if (eval(exp)) solutions.push({ x, y });
      } catch {}
    }
  }

  return {
    message: `Found ${solutions.length} solutions`,
    solutions
  };
}

/* ---------------- MAIN SOLVER ---------------- */
function solveEquation(eq, rules) {
  try {
    if (isPolynomial(eq)) {
      const vars = (eq.match(/[a-z]/gi) || []).length;

      if (vars === 1) return solveSingleVarPoly(eq);
      else return solveTwoVarPoly(eq);
    }

    let [L, R] = eq.split('=');
    if (!L || !R) return { message: "Invalid format", solutions: [] };

    const left = extract(parseExpression(tokenize(L)));
    const right = extract(parseExpression(tokenize(R)));

    const combined = combine(left, right, -1);

    const constraints = {};
    (rules || []).forEach(r => {
      if (!constraints[r.variable]) constraints[r.variable] = {};
      constraints[r.variable][r.type] = Number(r.value);
    });

    return solveLinear(combined.coeffs, combined.constant, constraints);

  } catch (err) {
    return { message: err.message, solutions: [] };
  }
}

/* ---------------- ROUTES ---------------- */
app.post('/api/solve', (req, res) => {
  const { equation, rules } = req.body;

  if (!equation) {
    return res.json({ success: false, message: "Missing equation", solutions: [] });
  }

  const result = solveEquation(equation, rules);

  history.unshift({
    id: history.length,
    input: equation,
    output: result.message,
    timestamp: new Date().toLocaleString()
  });

  history = history.slice(0, MAX_HISTORY);

  res.json({ success: true, ...result });
});

app.get('/api/history', (req, res) => {
  res.json(history);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});