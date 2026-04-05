const express = require('express');
const cors = require('cors');
const { evaluate } = require('mathjs'); // Import mathjs for complex parsing

const app = express();
app.use(cors());
app.use(express.json());

let history = [];

// The Recursive Solver
const solveRecursive = (lhs, target, variables, constraints) => {
  const results = [];
  const varKeys = variables; 

  function backtrack(index, currentScope) {
    // Base Case: All variables (x, y, z...) have been assigned a test value
    if (index === varKeys.length) {
      try {
        // mathjs handles ((10x+20y)2)+5z automatically
        const calculatedValue = evaluate(lhs, currentScope);
        
        // Use epsilon check for floating point (e.g., 499.99999 === 500)
        if (Math.abs(calculatedValue - target) < 0.001) {
          const solutionRow = varKeys.map(k => `${k}:${currentScope[k]}`).join(' | ');
          results.push(`[ ${solutionRow} ]`);
        }
      } catch (err) { /* Ignore math errors like div by zero */ }
      return;
    }

    const currentVar = varKeys[index];
    const { min, max } = constraints[currentVar] || { min: 0, max: 10 }; // Default range

    for (let i = min; i <= max; i++) {
      currentScope[currentVar] = i;
      backtrack(index + 1, { ...currentScope });
      
      if (results.length >= 500) break; // Performance cap
    }
  }

  backtrack(0, {});
  return results;
};

app.post('/api/solve', (req, res) => {
  const { equation, variables, rules } = req.body;

  try {
    const [lhs, rhs] = equation.split('=');
    const targetValue = evaluate(rhs); // Evaluate RHS in case it's "100 * 5"

    // Map rules to constraints
    const constraintsMap = {};
    variables.forEach(v => { constraintsMap[v] = { min: 0, max: 20 }; });
    rules.forEach(rule => {
      const v = rule.variable;
      if (constraintsMap[v]) {
        if (rule.type === 'min') constraintsMap[v].min = parseInt(rule.value);
        if (rule.type === 'max') constraintsMap[v].max = parseInt(rule.value);
      }
    });

    const solutions = solveRecursive(lhs.trim(), targetValue, variables, constraintsMap);

    const resultEntry = {
      id: Date.now(),
      input: equation,
      output: solutions.length > 0 ? solutions.join('\n') : "LIMITS_EXCEEDED_OR_NO_SOLUTIONS",
      count: solutions.length,
      timestamp: new Date().toLocaleTimeString()
    };
    history.unshift(resultEntry);
    res.json(resultEntry);

  } catch (error) {
    res.status(500).json({ error: "SYNTAX_ERROR: Check parentheses and operators." });
  }
});

app.get('/api/history', (req, res) => res.json(history));

app.listen(5000, () => console.log("CORE_ENGINE_ACTIVE: PORT 5000"));