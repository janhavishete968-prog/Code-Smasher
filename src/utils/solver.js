const FORMAT_ERROR = "Invalid equation format";
const DIVISION_BY_ZERO_ERROR = "Division by zero";
const INPUT_TOO_LARGE_ERROR = "Input too large";
const NO_SOLUTION = "No whole number solutions exist.";
const INFINITE_SOLUTIONS = "Infinite answers detected. Please apply market limits.";
const NON_LINEAR_ERROR = "Only linear equations are supported";

const MAX_TOTAL = 10000;
const MAX_ITERATIONS = 10000000;
const MAX_SOLUTIONS = 1000000;
const PREVIEW_MAX_SOLUTIONS_WITH_CONSTRAINTS = 200000;

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }

  return x;
}

function cloneCoeffs(coeffs) {
  return { ...coeffs };
}

function coeffKeys(coeffs) {
  return Object.keys(coeffs).filter((key) => coeffs[key] !== 0);
}

function hasVariables(expr) {
  return coeffKeys(expr.coeffs).length > 0;
}

function createConstExpr(value) {
  return { const: value, coeffs: {} };
}

function addExpr(left, right) {
  const coeffs = cloneCoeffs(left.coeffs);

  Object.entries(right.coeffs).forEach(([name, value]) => {
    coeffs[name] = (coeffs[name] || 0) + value;
    if (coeffs[name] === 0) {
      delete coeffs[name];
    }
  });

  return {
    const: left.const + right.const,
    coeffs,
  };
}

function subExpr(left, right) {
  return addExpr(left, scaleExpr(right, -1));
}

function scaleExpr(expr, scalar) {
  const coeffs = {};
  Object.entries(expr.coeffs).forEach(([name, value]) => {
    const nextValue = value * scalar;
    if (nextValue !== 0) {
      coeffs[name] = nextValue;
    }
  });

  return {
    const: expr.const * scalar,
    coeffs,
  };
}

function mulExpr(left, right) {
  const leftHasVars = hasVariables(left);
  const rightHasVars = hasVariables(right);

  if (leftHasVars && rightHasVars) {
    throw new Error(NON_LINEAR_ERROR);
  }

  if (!leftHasVars && !rightHasVars) {
    return createConstExpr(left.const * right.const);
  }

  if (leftHasVars) {
    return scaleExpr(left, right.const);
  }

  return scaleExpr(right, left.const);
}

function divExpr(left, right) {
  if (hasVariables(right)) {
    throw new Error(NON_LINEAR_ERROR);
  }

  if (right.const === 0) {
    throw new Error(DIVISION_BY_ZERO_ERROR);
  }

  const divisor = right.const;

  if (left.const % divisor !== 0) {
    throw new Error(FORMAT_ERROR);
  }

  const coeffs = {};
  Object.entries(left.coeffs).forEach(([name, value]) => {
    if (value % divisor !== 0) {
      throw new Error(FORMAT_ERROR);
    }
    coeffs[name] = value / divisor;
  });

  return {
    const: left.const / divisor,
    coeffs,
  };
}

function tokenize(input) {
  const compact = input.replace(/\s+/g, "");
  if (!compact) {
    throw new Error(FORMAT_ERROR);
  }

  const tokens = [];
  let index = 0;

  while (index < compact.length) {
    const char = compact[index];

    if (/[0-9]/.test(char)) {
      let end = index + 1;
      while (end < compact.length && /[0-9]/.test(compact[end])) {
        end += 1;
      }
      tokens.push({ type: "number", value: compact.slice(index, end) });
      index = end;
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      let end = index + 1;
      while (end < compact.length && /[a-zA-Z]/.test(compact[end])) {
        end += 1;
      }
      tokens.push({ type: "variable", value: compact.slice(index, end).toLowerCase() });
      index = end;
      continue;
    }

    if ("+-*/()=".includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }

    throw new Error(FORMAT_ERROR);
  }

  return tokens;
}

function parseExpressionTokens(tokens) {
  let position = 0;

  function peek() {
    return tokens[position] || null;
  }

  function consume() {
    const token = tokens[position] || null;
    position += 1;
    return token;
  }

  function startsFactor(token) {
    if (!token) {
      return false;
    }

    if (token.type === "number" || token.type === "variable") {
      return true;
    }

    return token.type === "op" && token.value === "(";
  }

  function parseFactor() {
    const token = peek();

    if (!token) {
      throw new Error(FORMAT_ERROR);
    }

    if (token.type === "op" && token.value === "+") {
      consume();
      return parseFactor();
    }

    if (token.type === "op" && token.value === "-") {
      consume();
      return scaleExpr(parseFactor(), -1);
    }

    if (token.type === "number") {
      consume();
      return createConstExpr(Number(token.value));
    }

    if (token.type === "variable") {
      consume();
      return {
        const: 0,
        coeffs: { [token.value]: 1 },
      };
    }

    if (token.type === "op" && token.value === "(") {
      consume();
      const expr = parseAddSub();
      const closeToken = consume();
      if (!closeToken || closeToken.type !== "op" || closeToken.value !== ")") {
        throw new Error(FORMAT_ERROR);
      }
      return expr;
    }

    throw new Error(FORMAT_ERROR);
  }

  function parseMulDiv() {
    let left = parseFactor();

    while (true) {
      const next = peek();

      if (!next) {
        return left;
      }

      if (next.type === "op" && (next.value === "*" || next.value === "/")) {
        const operator = consume().value;
        const right = parseFactor();
        left = operator === "*" ? mulExpr(left, right) : divExpr(left, right);
        continue;
      }

      // Implicit multiplication for forms like 10x or 2(x+y)
      if (startsFactor(next)) {
        const right = parseFactor();
        left = mulExpr(left, right);
        continue;
      }

      return left;
    }
  }

  function parseAddSub() {
    let left = parseMulDiv();

    while (true) {
      const next = peek();
      if (!next || next.type !== "op" || (next.value !== "+" && next.value !== "-")) {
        return left;
      }

      const operator = consume().value;
      const right = parseMulDiv();
      left = operator === "+" ? addExpr(left, right) : subExpr(left, right);
    }
  }

  const expression = parseAddSub();

  if (position !== tokens.length) {
    throw new Error(FORMAT_ERROR);
  }

  return expression;
}

export function parseEquation(rawEquation) {
  if (typeof rawEquation !== "string") {
    throw new Error(FORMAT_ERROR);
  }

  const pieces = rawEquation.split("=");
  if (pieces.length !== 2) {
    throw new Error(FORMAT_ERROR);
  }

  const left = parseExpressionTokens(tokenize(pieces[0]));
  const right = parseExpressionTokens(tokenize(pieces[1]));
  const normalized = subExpr(left, right);

  const coefficients = normalized.coeffs;
  const variables = coeffKeys(coefficients).sort();

  if (variables.length === 0) {
    throw new Error(FORMAT_ERROR);
  }

  const total = -normalized.const;
  if (!Number.isInteger(total)) {
    throw new Error(FORMAT_ERROR);
  }

  for (let index = 0; index < variables.length; index += 1) {
    const coefficient = coefficients[variables[index]];
    if (!Number.isInteger(coefficient) || coefficient <= 0) {
      throw new Error(FORMAT_ERROR);
    }
  }

  return {
    coeffs: coefficients,
    total,
    variables,
  };
}

function normalizeConstraintVariable(token, variables) {
  const cleaned = token.toLowerCase().replace(/\s+/g, "");

  if (variables.includes(cleaned)) {
    return cleaned;
  }

  const letterAlias = /^asset([a-z])$/i.exec(cleaned);
  if (letterAlias) {
    if (variables.includes(letterAlias[1])) {
      return letterAlias[1];
    }

    const offset = letterAlias[1].charCodeAt(0) - 97;
    return variables[offset] || null;
  }

  return null;
}

function normalizeWordOperator(value) {
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, " ");

  if (cleaned === "greater than") {
    return ">";
  }

  if (cleaned === "less than") {
    return "<";
  }

  if (cleaned === "at least") {
    return ">=";
  }

  if (cleaned === "at most") {
    return "<=";
  }

  if (cleaned === "equal to") {
    return "==";
  }

  return null;
}

export function parseConstraints(rawConstraints, variables) {
  const trimmed = (rawConstraints || "").trim();
  if (!trimmed) {
    return [];
  }

  const chunks = trimmed
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const evenLongMatch = chunk.match(/^([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+must\s+be\s+even$/i);
    if (evenLongMatch) {
      const variable = normalizeConstraintVariable(evenLongMatch[1], variables);
      if (!variable) {
        throw new Error("Invalid constraints format");
      }

      return {
        type: "even",
        variable,
      };
    }

    const evenShortMatch = chunk.match(/^([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+even$/i);
    if (evenShortMatch) {
      const variable = normalizeConstraintVariable(evenShortMatch[1], variables);
      if (!variable) {
        throw new Error("Invalid constraints format");
      }

      return {
        type: "even",
        variable,
      };
    }

    const compareMatch = chunk.match(/^([a-zA-Z][a-zA-Z\s]*?)\s*(>=|<=|>|<|==|=)\s*(-?\d+)$/i);
    if (compareMatch) {
      const variable = normalizeConstraintVariable(compareMatch[1], variables);
      if (!variable) {
        throw new Error("Invalid constraints format");
      }

      return {
        type: "compare",
        variable,
        operator: compareMatch[2] === "=" ? "==" : compareMatch[2],
        value: Number(compareMatch[3]),
      };
    }

    const wordCompareMatch = chunk.match(
      /^([a-zA-Z][a-zA-Z\s]*)\s+must\s+be\s+(greater\s+than|less\s+than|at\s+least|at\s+most|equal\s+to)\s+(-?\d+)$/i,
    );
    if (!wordCompareMatch) {
      throw new Error("Invalid constraints format");
    }

    const variable = normalizeConstraintVariable(wordCompareMatch[1], variables);
    const operator = normalizeWordOperator(wordCompareMatch[2]);

    if (!variable || !operator) {
      throw new Error("Invalid constraints format");
    }

    return {
      type: "compare",
      variable,
      operator,
      value: Number(wordCompareMatch[3]),
    };
  });
}

function compareValue(actual, operator, expected) {
  if (operator === ">") {
    return actual > expected;
  }

  if (operator === ">=") {
    return actual >= expected;
  }

  if (operator === "<") {
    return actual < expected;
  }

  if (operator === "<=") {
    return actual <= expected;
  }

  if (operator === "==") {
    return actual === expected;
  }

  return false;
}

function rowPassesConstraint(row, constraint) {
  const value = row[constraint.variable];

  if (constraint.type === "even") {
    return value % 2 === 0;
  }

  return compareValue(value, constraint.operator, constraint.value);
}

export function applyConstraints(rows, constraints) {
  if (!constraints.length) {
    return rows;
  }

  return rows.filter((row) => constraints.every((constraint) => rowPassesConstraint(row, constraint)));
}

function buildConstraintRules(variables, constraints) {
  const rules = {};

  variables.forEach((variable) => {
    rules[variable] = {
      min: 0,
      max: Number.POSITIVE_INFINITY,
      even: false,
    };
  });

  constraints.forEach((constraint) => {
    const rule = rules[constraint.variable];

    if (constraint.type === "even") {
      rule.even = true;
      return;
    }

    if (constraint.operator === ">") {
      rule.min = Math.max(rule.min, constraint.value + 1);
      return;
    }

    if (constraint.operator === ">=") {
      rule.min = Math.max(rule.min, constraint.value);
      return;
    }

    if (constraint.operator === "<") {
      rule.max = Math.min(rule.max, constraint.value - 1);
      return;
    }

    if (constraint.operator === "<=") {
      rule.max = Math.min(rule.max, constraint.value);
      return;
    }

    if (constraint.operator === "==") {
      rule.min = Math.max(rule.min, constraint.value);
      rule.max = Math.min(rule.max, constraint.value);
    }
  });

  let impossible = false;

  variables.forEach((variable) => {
    const rule = rules[variable];

    rule.min = Math.max(0, rule.min);
    if (rule.even && rule.min % 2 !== 0) {
      rule.min += 1;
    }

    if (Number.isFinite(rule.max) && rule.max < 0) {
      impossible = true;
      return;
    }

    if (Number.isFinite(rule.max) && rule.even && rule.max % 2 !== 0) {
      rule.max -= 1;
    }

    if (rule.min > rule.max) {
      impossible = true;
    }
  });

  return {
    rules,
    impossible,
  };
}

function getSuffixBounds(variables, coeffs, rules) {
  const suffixGcd = new Array(variables.length + 1).fill(0);
  const suffixMin = new Array(variables.length + 1).fill(0);
  const suffixMax = new Array(variables.length + 1).fill(0);
  const suffixAllFinite = new Array(variables.length + 1).fill(true);

  for (let index = variables.length - 1; index >= 0; index -= 1) {
    const variable = variables[index];
    const coefficient = coeffs[variable];
    const rule = rules[variable];
    const maxFinite = Number.isFinite(rule.max);

    suffixGcd[index] = gcd(suffixGcd[index + 1], coefficient);
    suffixMin[index] = suffixMin[index + 1] + coefficient * rule.min;
    suffixAllFinite[index] = suffixAllFinite[index + 1] && maxFinite;
    suffixMax[index] = maxFinite
      ? suffixMax[index + 1] + coefficient * rule.max
      : Number.POSITIVE_INFINITY;
  }

  return {
    suffixGcd,
    suffixMin,
    suffixMax,
    suffixAllFinite,
  };
}

function dedupeRows(rows, variables) {
  const unique = [];
  const seen = new Set();

  rows.forEach((row) => {
    const key = variables.map((variable) => row[variable]).join("|");
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(row);
  });

  return unique;
}

function solveRecursive(
  variables,
  coeffs,
  rules,
  total,
  index,
  current,
  rows,
  state,
  suffixBounds,
) {
  state.iterations += 1;
  if (state.iterations > MAX_ITERATIONS) {
    throw new Error(INPUT_TOO_LARGE_ERROR);
  }

  if (state.truncated) {
    return;
  }

  if (suffixBounds.suffixGcd[index] !== 0 && total % suffixBounds.suffixGcd[index] !== 0) {
    return;
  }

  if (total < suffixBounds.suffixMin[index]) {
    return;
  }

  if (
    suffixBounds.suffixAllFinite[index] &&
    total > suffixBounds.suffixMax[index]
  ) {
    return;
  }

  if (index === variables.length - 1) {
    const variable = variables[index];
    const coefficient = coeffs[variable];
    const rule = rules[variable];

    if (coefficient === 0) {
      return;
    }

    if (total % coefficient !== 0) {
      return;
    }

    const value = total / coefficient;
    if (value < rule.min || value > rule.max) {
      return;
    }

    if (rule.even && value % 2 !== 0) {
      return;
    }

    rows.push({
      ...current,
      [variable]: value,
    });

    if (rows.length >= state.maxSolutions) {
      state.truncated = true;
    }
    return;
  }

  const variable = variables[index];
  const coefficient = coeffs[variable];
  const rule = rules[variable];
  const lowerBound = rule.min;
  const upperBound = Math.min(rule.max, Math.floor(total / coefficient));

  if (upperBound < lowerBound) {
    return;
  }

  let value = lowerBound;
  if (rule.even && value % 2 !== 0) {
    value += 1;
  }

  const step = rule.even ? 2 : 1;

  for (; value <= upperBound; value += step) {
    const nextTotal = total - coefficient * value;
    if (nextTotal < 0) {
      break;
    }

    if (nextTotal < suffixBounds.suffixMin[index + 1]) {
      break;
    }

    if (
      suffixBounds.suffixAllFinite[index + 1] &&
      nextTotal > suffixBounds.suffixMax[index + 1]
    ) {
      continue;
    }

    current[variable] = value;
    if (
      suffixBounds.suffixGcd[index + 1] !== 0 &&
      nextTotal % suffixBounds.suffixGcd[index + 1] !== 0
    ) {
      continue;
    }

    solveRecursive(
      variables,
      coeffs,
      rules,
      nextTotal,
      index + 1,
      current,
      rows,
      state,
      suffixBounds,
    );

    if (state.truncated) {
      break;
    }
  }

  delete current[variable];
}

export function solveEquation(parsedEquation, constraints = [], options = {}) {
  const { coeffs, total, variables } = parsedEquation;
  const startTime = Date.now();
  const maxSolutions = options.maxSolutions || MAX_SOLUTIONS;

  if (!Number.isInteger(total) || total < 0 || total > MAX_TOTAL) {
    throw new Error(INPUT_TOO_LARGE_ERROR);
  }

  const compiled = buildConstraintRules(variables, constraints);
  if (compiled.impossible) {
    return {
      rows: [],
      truncated: false,
      iterations: 0,
      durationMs: Date.now() - startTime,
    };
  }

  const gcdValue = variables.reduce((acc, variable) => gcd(acc, coeffs[variable]), 0);
  if (gcdValue !== 0 && total % gcdValue !== 0) {
    return {
      rows: [],
      truncated: false,
      iterations: 0,
      durationMs: Date.now() - startTime,
    };
  }

  const rows = [];
  const state = { iterations: 0, truncated: false, maxSolutions };
  const suffixBounds = getSuffixBounds(variables, coeffs, compiled.rules);

  if (
    total < suffixBounds.suffixMin[0] ||
    (suffixBounds.suffixAllFinite[0] && total > suffixBounds.suffixMax[0])
  ) {
    return {
      rows: [],
      truncated: false,
      iterations: 0,
      durationMs: Date.now() - startTime,
    };
  }

  solveRecursive(
    variables,
    coeffs,
    compiled.rules,
    total,
    0,
    {},
    rows,
    state,
    suffixBounds,
  );

  const uniqueRows = dedupeRows(rows, variables);

  return {
    rows: uniqueRows,
    truncated: state.truncated,
    iterations: state.iterations,
    durationMs: Date.now() - startTime,
  };
}

export function sortSolutions(rows, variables) {
  const [first, second] = variables;

  return [...rows].sort((left, right) => {
    if (first && right[first] !== left[first]) {
      return right[first] - left[first];
    }

    if (second && left[second] !== right[second]) {
      return left[second] - right[second];
    }

    for (let index = 2; index < variables.length; index += 1) {
      const variable = variables[index];
      if (left[variable] !== right[variable]) {
        return left[variable] - right[variable];
      }
    }

    return 0;
  });
}

export function pickRecommendedSolution(rows, variables) {
  if (!rows.length) {
    return null;
  }

  let winner = rows[0];
  let winnerScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < rows.length; index += 1) {
    const candidate = rows[index];
    const values = variables.map((variable) => candidate[variable]);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const mean = sum / values.length;
    const varianceScore = values.reduce((acc, value) => acc + Math.abs(value - mean), 0);

    if (varianceScore < winnerScore) {
      winner = candidate;
      winnerScore = varianceScore;
      continue;
    }

    if (varianceScore === winnerScore && candidate[variables[0]] > winner[variables[0]]) {
      winner = candidate;
      winnerScore = varianceScore;
    }
  }

  return winner;
}

export function solvePortfolio(equationText, constraintsText) {
  const parsed = parseEquation(equationText);
  const constraints = parseConstraints(constraintsText, parsed.variables);
  const shouldUsePreviewCap = constraints.length > 0 && parsed.variables.length > 5;

  const allSolved = solveEquation(parsed, [], {
    maxSolutions: shouldUsePreviewCap
      ? PREVIEW_MAX_SOLUTIONS_WITH_CONSTRAINTS
      : MAX_SOLUTIONS,
  });
  const filteredSolved = constraints.length
    ? solveEquation(parsed, constraints)
    : allSolved;

  const allRows = allSolved.rows;
  const filteredRows = filteredSolved.rows;
  const sortedRows = sortSolutions(filteredRows, parsed.variables);

  let statusMessage = "";
  const gcdValue = parsed.variables.reduce(
    (acc, variable) => gcd(acc, parsed.coeffs[variable]),
    0,
  );
  const hasIntegerFamily = gcdValue !== 0 && parsed.total % gcdValue === 0;
  const degreesOfFreedom = parsed.variables.length - 1;
  const isInfinite =
    constraints.length === 0 &&
    degreesOfFreedom > 0 &&
    hasIntegerFamily &&
    sortedRows.length > 0;

  if (sortedRows.length === 0) {
    statusMessage = NO_SOLUTION;
  } else if (isInfinite) {
    statusMessage = INFINITE_SOLUTIONS;
  } else if (allSolved.truncated || filteredSolved.truncated) {
    statusMessage = `Showing first ${sortedRows.length} allocations. Apply tighter market limits for full result.`;
  } else {
    statusMessage = `Found ${sortedRows.length} valid allocations.`;
  }

  return {
    parsed,
    constraints,
    rows: sortedRows,
    totals: {
      beforeConstraints: allRows.length,
      afterConstraints: sortedRows.length,
    },
    metrics: {
      iterations: allSolved.iterations + (constraints.length ? filteredSolved.iterations : 0),
      durationMs: allSolved.durationMs + (constraints.length ? filteredSolved.durationMs : 0),
    },
    statusMessage,
    hasInfiniteSolutions: isInfinite,
    isTruncated: allSolved.truncated || filteredSolved.truncated,
    recommended: pickRecommendedSolution(sortedRows, parsed.variables),
  };
}
