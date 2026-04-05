const { parse } = require('mathjs');
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
  if (node.type === 'ParenthesisNode') return extractLinearCoefficients(node.content);
  if (node.type === 'ConstantNode') return { coeffs: {}, constant: Number(node.value), linear: true };
  if (node.type === 'SymbolNode') return { coeffs: { [node.name]: 1 }, constant: 0, linear: true };
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
      return {
        coeffs: { ...left.coeffs },
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
const eq = '10a+10b+10c+10d=40';
const [left,right] = eq.split('=').map(s => s.trim());
const leftInfo = extractLinearCoefficients(parse(normalizeExpression(left)));
const rightInfo = extractLinearCoefficients(parse(normalizeExpression(right)));
const coeffs = {};
mergeCoefficients(coeffs, leftInfo.coeffs, 1);
mergeCoefficients(coeffs, rightInfo.coeffs, -1);
console.log({ leftInfo, rightInfo, coeffs, constant: leftInfo.constant - rightInfo.constant });
