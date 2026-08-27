import { evaluate, parse } from "mathjs";

/**
 * Normaliza nombres de funciones y sintaxis para mathjs.
 * Convierte `ln(x)` → `log(x)` (mathjs usa `log` para logaritmo natural),
 * así como variantes comunes en español (`sen`, `tg`, `arctg`, etc.).
 */
function normalizeExpr(expr: string): string {
  return expr
    .replace(/\bln\s*\(/gi, "log(")
    .replace(/\barcsen\s*\(/gi, "asin(")
    .replace(/\barctg\s*\(/gi, "atan(")
    .replace(/\bsen\s*\(/gi, "sin(")
    .replace(/\btg\s*\(/gi, "tan(")
    .replace(/\bctg\s*\(/gi, "cot(");
}

export function evalFn(expr: string, x: number): number {
  try {
    const result = evaluate(normalizeExpr(expr), { x, e: Math.E, pi: Math.PI });
    return typeof result === "number" ? result : Number(result);
  } catch {
    return NaN;
  }
}

export function evalFnDerivative(expr: string, x: number, baseH = 1e-7): number {
  const h = Math.max(1, Math.abs(x)) * baseH;
  return (evalFn(expr, x + h) - evalFn(expr, x - h)) / (2 * h);
}

export function isValidExpr(expr: string): boolean {
  try {
    parse(normalizeExpr(expr));
    return true;
  } catch {
    return false;
  }
}
