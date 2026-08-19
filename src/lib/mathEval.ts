import { evaluate, parse } from "mathjs";

export function evalFn(expr: string, x: number): number {
  try {
    const result = evaluate(expr, { x, e: Math.E, pi: Math.PI });
    return typeof result === "number" ? result : Number(result);
  } catch {
    return NaN;
  }
}

export function evalFnDerivative(expr: string, x: number, h = 1e-7): number {
  return (evalFn(expr, x + h) - evalFn(expr, x - h)) / (2 * h);
}

export function isValidExpr(expr: string): boolean {
  try {
    parse(expr);
    return true;
  } catch {
    return false;
  }
}
