import { solvePortfolio } from "../src/utils/solver.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCase(label, callback) {
  try {
    callback();
    console.log(`PASS: ${label}`);
  } catch (error) {
    console.error(`FAIL: ${label}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

runCase("Example 1 - single variable", () => {
  const result = solvePortfolio("50x = 200", "x >= 0");
  assert(result.rows.length === 1, "Expected one solution");
  assert(result.rows[0].x === 4, "Expected x=4");
});

runCase("Example 2 - two variables", () => {
  const result = solvePortfolio("10x + 20y = 100", "x >= 0, y >= 0");
  assert(result.rows.length === 6, "Expected 6 solutions");
  assert(result.rows[0].x === 10 && result.rows[0].y === 0, "Expected first row (10,0)");
  assert(result.rows[5].x === 0 && result.rows[5].y === 5, "Expected last row (0,5)");
});

runCase("Example 3 - many variables", () => {
  const result = solvePortfolio(
    "10a + 15b + 20c + 50d + 5e = 1000",
    "a >= 0, b >= 0, c >= 0, d >= 0, e >= 0",
  );
  assert(result.rows.length > 0, "Expected at least one solution");
  assert(result.isTruncated === false, "Expected full result set for Example 3");
});

runCase("Example 4 - with rules", () => {
  const result = solvePortfolio("10x + 20y + 5z = 100", "x > 5, y < 3, z >= 0");
  assert(result.rows.length > 0, "Expected filtered solutions");
  assert(result.rows.every((row) => row.x > 5 && row.y < 3), "Constraints were not enforced");
});

runCase("Rule engine - even constraint", () => {
  const result = solvePortfolio("10a + 5c = 50", "a >= 0, c must be even");
  assert(result.rows.length > 0, "Expected rows for even-rule case");
  assert(result.rows.every((row) => row.c % 2 === 0), "Expected c to be even in all rows");
});

runCase("Rule engine - asset label constraints", () => {
  const result = solvePortfolio(
    "10a + 5c = 50",
    "Asset A must be greater than 0, Asset C must be even",
  );

  assert(result.rows.length > 0, "Expected rows for asset-label rule case");
  assert(result.rows.every((row) => row.a > 0), "Expected a to be greater than 0");
  assert(result.rows.every((row) => row.c % 2 === 0), "Expected c to be even in all rows");
});

runCase("Example 5 - brackets", () => {
  const result = solvePortfolio(
    "((10x + 20y) * 2) + 5z = 500",
    "x >= 0, y >= 0, z >= 0",
  );
  assert(result.rows.length > 0, "Expected bracketed equation to solve");
});

runCase("Order of operations", () => {
  const first = solvePortfolio(
    "10x + 20y * 2 + 5z = 500",
    "x >= 0, y >= 0, z >= 0",
  );
  const second = solvePortfolio(
    "10x + 40y + 5z = 500",
    "x >= 0, y >= 0, z >= 0",
  );

  const firstRows = JSON.stringify(first.rows);
  const secondRows = JSON.stringify(second.rows);
  assert(firstRows === secondRows, "Expected precedence-aware parsing to match equivalent form");
});

runCase("Example 6 - impossible", () => {
  const result = solvePortfolio("2x + 4y = 3", "x >= 0, y >= 0");
  assert(result.statusMessage === "No whole number solutions exist.", "Expected no-solution message");
  assert(result.rows.length === 0, "Expected zero solutions");
});

runCase("Example 6 - impossible without limits", () => {
  const result = solvePortfolio("2x + 4y = 3", "");
  assert(result.statusMessage === "No whole number solutions exist.", "Expected no-solution message");
  assert(result.rows.length === 0, "Expected zero solutions");
});

runCase("Infinity trap", () => {
  const result = solvePortfolio("x + y = 100", "");
  assert(
    result.statusMessage === "Infinite answers detected. Please apply market limits.",
    "Expected infinity warning",
  );
});

runCase("Invalid format", () => {
  let thrown = "";
  try {
    solvePortfolio("x + * y = 10", "x >= 0");
  } catch (error) {
    thrown = error.message;
  }

  assert(thrown === "Invalid equation format", "Expected invalid format error");
});

runCase("Invalid format - duplicate operators", () => {
  let thrown = "";
  try {
    solvePortfolio("10x++20y==100", "x >= 0, y >= 0");
  } catch (error) {
    thrown = error.message;
  }

  assert(thrown === "Invalid equation format", "Expected invalid format error");
});

runCase("Invalid format - unbalanced brackets", () => {
  let thrown = "";
  try {
    solvePortfolio("(10x + (20y * 2) = 100", "x >= 0, y >= 0");
  } catch (error) {
    thrown = error.message;
  }

  assert(thrown === "Invalid equation format", "Expected invalid format error");
});

runCase("Division by zero", () => {
  let thrown = "";
  try {
    solvePortfolio("x / 0 = 2", "x >= 0");
  } catch (error) {
    thrown = error.message;
  }

  assert(thrown === "Division by zero", "Expected division-by-zero error");
});

runCase("No duplicate combinations", () => {
  const result = solvePortfolio(
    "10a + 15b + 20c + 50d + 5e = 1000",
    "a >= 0, b >= 0, c >= 0, d >= 0, e >= 0",
  );

  const keys = result.rows.map((row) => `${row.a}|${row.b}|${row.c}|${row.d}|${row.e}`);
  const uniqueCount = new Set(keys).size;
  assert(uniqueCount === result.rows.length, "Expected unique combinations only");
});

runCase("Stress 6 variables", () => {
  const result = solvePortfolio(
    "10a + 15b + 20c + 25d + 30e + 35f = 2000",
    "a >= 0, b >= 0, c >= 0, d >= 0, e >= 0, f >= 0",
  );

  assert(result.rows.length > 0, "Expected stress case to produce rows");
  assert(result.metrics.iterations > 0, "Expected non-zero iteration count");
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("All smoke checks passed.");
