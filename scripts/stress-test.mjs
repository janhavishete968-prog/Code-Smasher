import { solvePortfolio } from "../src/utils/solver.js";

const stressCases = [
  {
    name: "6 variables baseline",
    equation: "10a + 15b + 20c + 25d + 30e + 35f = 2000",
    constraints: "a >= 0, b >= 0, c >= 0, d >= 0, e >= 0, f >= 0",
  },
  {
    name: "6 variables with pruning constraints",
    equation: "10a + 15b + 20c + 25d + 30e + 35f = 2000",
    constraints: "a >= 10, b <= 20, c must be even, d <= 15, e <= 10, f <= 8",
  },
  {
    name: "5 variables high RHS",
    equation: "150a + 100b + 50c + 10d + 5e = 5000",
    constraints: "a >= 0, b >= 0, c >= 0, d >= 0, e >= 0",
  },
];

console.log("Stress Test Report");
console.log("==================");

stressCases.forEach((testCase) => {
  const startedAt = Date.now();
  const result = solvePortfolio(testCase.equation, testCase.constraints);
  const elapsedMs = Date.now() - startedAt;

  console.log(`\nCase: ${testCase.name}`);
  console.log(`Equation: ${testCase.equation}`);
  console.log(`Constraints: ${testCase.constraints || "None"}`);
  console.log(`Status: ${result.statusMessage}`);
  console.log(`Rows after constraints: ${result.rows.length}`);
  console.log(`Iterations: ${result.metrics.iterations.toLocaleString()}`);
  console.log(`Solve time: ${result.metrics.durationMs} ms`);
  console.log(`End-to-end call time: ${elapsedMs} ms`);
  console.log(`Truncated: ${result.isTruncated ? "yes" : "no"}`);
});
