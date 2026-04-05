const express = require('express');
const cors = require('cors');
const { evaluate, simplify, parse, compile } = require('mathjs');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// History storage
let history = [];
const MAX_HISTORY = 40;

function normalizeExpression(expr) {
  return expr
    .replace(/([0-9])([a-zA-Z])/g, '$1*$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1*$2')
    .replace(/\s+/g, '');
}

function mergeCoefficients(target, source, factor = 1) {
  Object.entries(source).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + value * factor;
  });
}

function extractLinearCoefficients(node) {
  if (node.type === 'ParenthesisNode') {
    return extractLinearCoefficients(node.content);
  }

  if (node.type === 'ConstantNode') {
    return { coeffs: {}, constant: Number(node.value), linear: true };
  }

  if (node.type === 'SymbolNode') {
    return { coeffs: { [node.name]: 1 }, constant: 0, linear: true };
  }

  if (node.type === 'OperatorNode') {
    const [leftNode, rightNode] = node.args;
    const op = node.op;

    if (op === 'unaryMinus') {
      const result = extractLinearCoefficients(leftNode);
      if (!result.linear) return result;
      Object.keys(result.coeffs).forEach(key => {
        result.coeffs[key] = -result.coeffs[key];
      });
      result.constant = -result.constant;
      return result;
    }

    if (op === '+') {
      const left = extractLinearCoefficients(leftNode);
      const right = extractLinearCoefficients(rightNode);
      const coeffs = { ...left.coeffs };
      mergeCoefficients(coeffs, right.coeffs, 1);
      return {
        coeffs,
        constant: left.constant + right.constant,
        linear: left.linear && right.linear
      };
    }

    if (op === '-') {
      const left = extractLinearCoefficients(leftNode);
      const right = extractLinearCoefficients(rightNode);
      const coeffs = { ...left.coeffs };
      Object.entries(right.coeffs).forEach(([key, value]) => {
        coeffs[key] = (coeffs[key] || 0) - value;
      });
      return {
        coeffs,
        constant: left.constant - right.constant,
        linear: left.linear && right.linear
      };
    }

    if (op === '*') {
      const left = extractLinearCoefficients(leftNode);
      const right = extractLinearCoefficients(rightNode);
      if (!left.linear || !right.linear) return { coeffs: {}, constant: 0, linear: false };
      const leftVars = Object.keys(left.coeffs).length;
      const rightVars = Object.keys(right.coeffs).length;
      if (leftVars > 0 && rightVars > 0) return { coeffs: {}, constant: 0, linear: false };

      if (leftVars === 0) {
        const coeffs = {};
        mergeCoefficients(coeffs, right.coeffs, left.constant);
        return { coeffs, constant: right.constant * left.constant, linear: true };
      }

      if (rightVars === 0) {
        const coeffs = {};
        mergeCoefficients(coeffs, left.coeffs, right.constant);
        return { coeffs, constant: left.constant * right.constant, linear: true };
      }
    }

    if (op === '/') {
      const left = extractLinearCoefficients(leftNode);
      const right = extractLinearCoefficients(rightNode);
      if (!left.linear || !right.linear || Object.keys(right.coeffs).length > 0 || right.constant === 0) {
        return { coeffs: {}, constant: 0, linear: false };
      }
      const factor = 1 / right.constant;
      const coeffs = {};
      mergeCoefficients(coeffs, left.coeffs, factor);
      return { coeffs, constant: left.constant * factor, linear: true };
    }
  }

  return { coeffs: {}, constant: 0, linear: false };
}

function solveLinearEquation(coeffs, constant, constraints) {
  const variables = Object.keys(coeffs).filter(v => coeffs[v] !== 0);
  if (variables.length === 0) {
    return constant === 0
      ? { output: 'Infinite solutions exist for the constant equation' }
      : { output: 'No solutions exist' };
  }

  const ranges = variables.map(v => {
    const constraint = constraints[v] || { min: 0, max: 10 };
    return {
      var: v,
      coeff: coeffs[v],
      min: Math.max(-1000, Number(constraint.min) || 0),
      max: Math.min(1000, Number(constraint.max) || 10)
    };
  });

  const ordered = ranges.sort((a, b) => Math.abs(b.coeff) - Math.abs(a.coeff));
  const target = -constant;
  const solutions = [];

  if (ordered.length === 1) {
    const only = ordered[0];
    if (only.coeff === 0) {
      return target === 0
        ? { output: 'Infinite solutions exist for the constant equation' }
        : { output: 'No solutions exist' };
    }
    if (target % only.coeff !== 0) {
      return { output: 'No solutions found within the given constraints' };
    }
    const value = target / only.coeff;
    if (value >= only.min && value <= only.max) {
      return { output: `Found 1 solution(s): ${JSON.stringify({ [only.var]: value })}` };
    }
    return { output: 'No solutions found within the given constraints' };
  }

  const last = ordered[ordered.length - 1];
  const independent = ordered.slice(0, -1);
  const independentCombos = independent.reduce((acc, item) => acc * (item.max - item.min + 1), 1);
  if (independentCombos > 2000000) {
    return { output: `Too many combinations (${independentCombos}). Add tighter constraints.` };
  }

  function search(index, currentSum, assignment) {
    if (solutions.length >= 100) return;
    if (index === independent.length) {
      const remainder = target - currentSum;
      if (last.coeff === 0) {
        if (remainder === 0) {
          solutions.push({ ...assignment, [last.var]: last.min });
        }
        return;
      }
      if (remainder % last.coeff !== 0) return;
      const lastValue = remainder / last.coeff;
      if (lastValue >= last.min && lastValue <= last.max) {
        solutions.push({ ...assignment, [last.var]: lastValue });
      }
      return;
    }

    const { var: variable, coeff, min, max } = independent[index];
    for (let value = min; value <= max; value += 1) {
      if (solutions.length >= 100) return;
      assignment[variable] = value;
      search(index + 1, currentSum + coeff * value, assignment);
    }
  }

  search(0, 0, {});

  if (solutions.length === 0) {
    return { output: 'No solutions found within the given constraints' };
  }

  return { output: `Found ${solutions.length} solution(s): ${JSON.stringify(solutions)}` };
}

function solveEquation(equation, rules) {
  try {
    const [left, right] = equation.split('=').map(s => s.trim());
    if (!left || !right) {
      return { output: 'Error: Invalid equation format' };
    }

    const normalizedLeft = normalizeExpression(left);
    const normalizedRight = normalizeExpression(right);
    const leftNode = parse(normalizedLeft);
    const rightNode = parse(normalizedRight);

    const leftInfo = extractLinearCoefficients(leftNode);
    const rightInfo = extractLinearCoefficients(rightNode);
    const constraints = {};

    (rules || []).forEach(rule => {
      if (rule.variable) {
        if (!constraints[rule.variable]) {
          constraints[rule.variable] = { min: 0, max: 10 };
        }
        if (rule.type === 'min') {
          constraints[rule.variable].min = Number(rule.value);
        } else if (rule.type === 'max') {
          constraints[rule.variable].max = Number(rule.value);
        }
      }
    });

    if (leftInfo.linear && rightInfo.linear) {
      const coeffs = {};
      mergeCoefficients(coeffs, leftInfo.coeffs, 1);
      mergeCoefficients(coeffs, rightInfo.coeffs, -1);
      const constant = leftInfo.constant - rightInfo.constant;
      return solveLinearEquation(coeffs, constant, constraints);
    }

    const varRegex = /[a-z]/gi;
    const variables = [...new Set(equation.match(varRegex) || [])].sort();
    if (variables.length === 0) {
      return { output: 'Error: No variables found in equation' };
    }

    variables.forEach(v => {
      if (!constraints[v]) {
        constraints[v] = { min: 0, max: 10 };
      }
    });

    const ranges = variables.map(v => ({
      var: v,
      min: Math.max(-1000, Number(constraints[v].min) || 0),
      max: Math.min(1000, Number(constraints[v].max) || 10)
    }));

    const totalCombos = ranges.reduce((acc, item) => acc * (item.max - item.min + 1), 1);
    if (totalCombos > 200000) {
      return { output: `Too many possible combinations (${totalCombos}). Add tighter constraints.` };
    }

    const solutions = [];
    const normalizedExpression = normalizeExpression(`${left}-${right}`);
    const expression = parse(normalizedExpression);

    function search(index, assignment) {
      if (solutions.length >= 50) return;
      if (index === variables.length) {
        const scope = {};
        variables.forEach(v => {
          scope[v] = assignment[v];
        });
        try {
          const value = evaluate(expression, scope);
          if (Math.abs(value) < 0.001) {
            solutions.push({ ...assignment });
          }
        } catch (e) {}
        return;
      }

      const { var: variable, min, max } = ranges[index];
      for (let value = min; value <= max; value += 1) {
        assignment[variable] = value;
        search(index + 1, assignment);
      }
    }

    search(0, {});
    if (solutions.length === 0) {
      return { output: 'No solutions found within the given constraints' };
    }

    return { output: `Found ${solutions.length} solution(s): ${JSON.stringify(solutions)}` };
  } catch (err) {
    return { output: `Error: ${err.message}` };
  }
}

// POST /api/solve
app.post('/api/solve', (req, res) => {
  const { equation, rules } = req.body;

  if (!equation) {
    return res.json({ output: 'Error: Missing equation' });
  }

  const result = solveEquation(equation, rules);

  // Add to history
  history.unshift({
    id: history.length,
    input: equation,
    output: result.output,
    timestamp: new Date().toLocaleString()
  });

  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  res.json(result);
});

// GET /api/history
app.get('/api/history', (req, res) => {
  res.json(history);
});

app.listen(PORT, () => {
  console.log(`QuantSolve Node.js backend listening on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});