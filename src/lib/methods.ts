import { evalFn, evalFnDerivative } from "./mathEval";

export interface Iteration {
  n: number;
  [key: string]: number | string;
}

export interface MethodResult {
  root?: number;
  value?: number;
  solution?: number[];
  iterations: Iteration[];
  converged: boolean;
  error?: string;
  plotData?: { x: number; y: number }[];
  extra?: Record<string, unknown>;
}

// ── Root Finding ──────────────────────────────────────────────────────────────

export function bisection(
  expr: string, a: number, b: number, tol: number, maxIter: number
): MethodResult {
  const iters: Iteration[] = [];
  let fa = evalFn(expr, a), fb = evalFn(expr, b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb))
    return { converged: false, iterations: [], error: "La función no es finita en los extremos del intervalo." };
  if (fa === 0) return { root: a, converged: true, iterations: [] };
  if (fb === 0) return { root: b, converged: true, iterations: [] };
  if (fa * fb > 0)
    return { converged: false, iterations: [], error: "f(a) y f(b) deben tener signos opuestos." };
  let c = a, fc = 0;
  let converged = false;
  for (let n = 1; n <= maxIter; n++) {
    c = (a + b) / 2;
    fc = evalFn(expr, c);
    const err = Math.abs((b - a) / 2);
    iters.push({ n, a: +a.toFixed(8), b: +b.toFixed(8), c: +c.toFixed(8), "f(c)": +fc.toExponential(4), error: +err.toExponential(4) });
    if (!Number.isFinite(fc)) return { root: c, converged: false, iterations: iters, error: "La función dejó de ser finita durante la iteración." };
    if (Math.abs(fc) < tol || err < tol) { converged = true; break; }
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return { root: c, converged, iterations: iters };
}

export function fixedPoint(
  fExpr: string, gExpr: string, x0: number, tol: number, maxIter: number
): MethodResult {
  const iters: Iteration[] = [];
  let x = x0;
  let converged = false;
  for (let n = 1; n <= maxIter; n++) {
    const fx = evalFn(fExpr, x);
    const gx = evalFn(gExpr, x);
    const err = Math.abs(gx - x);
    if (!Number.isFinite(fx) || !Number.isFinite(gx)) return { root: x, converged: false, iterations: iters, error: "La función dejó de ser finita durante la iteración." };
    iters.push({ n, "x_n": +x.toFixed(8), "g(x_n)": +gx.toFixed(8), "f(x_n)": +fx.toExponential(4), error: +err.toExponential(4) });
    x = gx;
    if (err < tol && Math.abs(evalFn(fExpr, x)) < tol) { converged = true; break; }
  }
  return { root: x, converged, iterations: iters };
}

export function newtonRaphson(
  expr: string, x0: number, tol: number, maxIter: number
): MethodResult {
  const iters: Iteration[] = [];
  let x = x0;
  let converged = false;
  for (let n = 1; n <= maxIter; n++) {
    const fx = evalFn(expr, x);
    const fpx = evalFnDerivative(expr, x);
    if (!Number.isFinite(fx) || !Number.isFinite(fpx)) return { root: x, converged: false, iterations: iters, error: "La función o su derivada no es finita." };
    if (Math.abs(fpx) < 1e-14) return { converged: false, iterations: iters, error: "Derivada cercana a cero." };
    const x1 = x - fx / fpx;
    const err = Math.abs(x1 - x);
    iters.push({ n, x: +x.toFixed(8), "f(x)": +fx.toExponential(4), "f'(x)": +fpx.toExponential(4), "x₁": +x1.toFixed(8), error: +err.toExponential(4) });
    x = x1;
    if (err < tol && Math.abs(evalFn(expr, x)) < tol) { converged = true; break; }
  }
  return { root: x, converged, iterations: iters };
}

export function secant(
  expr: string, x0: number, x1: number, tol: number, maxIter: number
): MethodResult {
  const iters: Iteration[] = [];
  let xa = x0, xb = x1;
  let converged = false;
  for (let n = 1; n <= maxIter; n++) {
    const fa = evalFn(expr, xa), fb = evalFn(expr, xb);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return { root: xb, converged: false, iterations: iters, error: "La función dejó de ser finita durante la iteración." };
    if (Math.abs(fb - fa) < 1e-14) return { converged: false, iterations: iters, error: "División por cero en el paso de la secante." };
    const xc = xb - fb * (xb - xa) / (fb - fa);
    const err = Math.abs(xc - xb);
    iters.push({ n, "x_{n-1}": +xa.toFixed(8), "x_n": +xb.toFixed(8), "x_{n+1}": +xc.toFixed(8), "f(x_{n+1})": +evalFn(expr, xc).toExponential(4), error: +err.toExponential(4) });
    xa = xb; xb = xc;
    if (err < tol && Math.abs(evalFn(expr, xb)) < tol) { converged = true; break; }
  }
  return { root: xb, converged, iterations: iters };
}

// ── Linear Systems ────────────────────────────────────────────────────────────

export function gaussianElimination(A: number[][], b: number[]): MethodResult {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  const iters: Iteration[] = [];

  for (let k = 0; k < n - 1; k++) {
    // Partial pivoting
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[maxRow][k])) maxRow = i;
    }
    if (maxRow !== k) {
      [M[k], M[maxRow]] = [M[maxRow], M[k]];
      const row: Iteration = { n: iters.length + 1, operación: `Intercambio F${k+1} ↔ F${maxRow+1}` };
      for (let r = 0; r < n; r++) row[`F${r+1}`] = M[r].map(v => +v.toFixed(5)).join("  |  ");
      iters.push(row);
    }
    if (Math.abs(M[k][k]) < 1e-14)
      return { converged: false, iterations: iters, error: "La matriz es singular." };
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j];
      const row: Iteration = { n: iters.length + 1, operación: `F${i+1} ← F${i+1} − (${factor.toFixed(4)})·F${k+1}` };
      for (let r = 0; r < n; r++) row[`F${r+1}`] = M[r].map(v => +v.toFixed(5)).join("  |  ");
      iters.push(row);
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(M[i][i]) < 1e-14) return { converged: false, iterations: iters, error: "La matriz es singular." };
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return { solution: x, converged: true, iterations: iters };
}

export function gaussSeidel(
  A: number[][], b: number[], x0: number[], tol: number, maxIter: number
): MethodResult {
  const n = A.length;
  const x = [...x0];
  const iters: Iteration[] = [];
  let converged = false;
  if (A.some((row, i) => Math.abs(row[i]) < 1e-14)) return { converged: false, iterations: [], error: "Gauss-Seidel requiere una diagonal sin ceros." };
  for (let k = 1; k <= maxIter; k++) {
    const xOld = [...x];
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      for (let j = 0; j < n; j++) if (j !== i) sum -= A[i][j] * x[j];
      x[i] = sum / A[i][i];
    }
    const err = Math.max(...x.map((xi, i) => Math.abs(xi - xOld[i])));
    const row: Iteration = { n: k, error: +err.toExponential(4) };
    x.forEach((xi, i) => { row[`x${i+1}`] = +xi.toFixed(8); });
    iters.push(row);
    if (err < tol) { converged = true; break; }
  }
  return { solution: x, converged, iterations: iters };
}

export function luDecomposition(A: number[][], b: number[]): MethodResult {
  const n = A.length;
  const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const U = A.map(row => [...row]);

  const permutation = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(U[i][k]) > Math.abs(U[maxRow][k])) maxRow = i;
    }
    if (Math.abs(U[maxRow][k]) < 1e-14) {
      return { converged: false, iterations: [], error: "La matriz es singular o no admite factorización LU." };
    }
    if (maxRow !== k) {
      [U[k], U[maxRow]] = [U[maxRow], U[k]];
      [permutation[k], permutation[maxRow]] = [permutation[maxRow], permutation[k]];
      for (let j = 0; j < k; j++) [L[k][j], L[maxRow][j]] = [L[maxRow][j], L[k][j]];
    }
    for (let i = k + 1; i < n; i++) {
      L[i][k] = U[i][k] / U[k][k];
      for (let j = k; j < n; j++) U[i][j] -= L[i][k] * U[k][j];
    }
  }

  const permutedB = permutation.map(i => b[i]);
  // Forward substitution Ly = Pb
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    y[i] = permutedB[i];
    for (let j = 0; j < i; j++) y[i] -= L[i][j] * y[j];
  }
  // Back substitution Ux = y
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = y[i];
    for (let j = i + 1; j < n; j++) x[i] -= U[i][j] * x[j];
    x[i] /= U[i][i];
  }

  const iters: Iteration[] = L.map((row, i) => {
    const r: Iteration = { n: i + 1 };
    row.forEach((v, j) => { r[`L${i+1}${j+1}`] = +v.toFixed(6); });
    U[i].forEach((v, j) => { r[`U${i+1}${j+1}`] = +v.toFixed(6); });
    r[`y${i+1}`] = +y[i].toFixed(6);
    r[`x${i+1}`] = +x[i].toFixed(6);
    return r;
  });

  return { solution: x, converged: true, iterations: iters, extra: { L, U, permutation } };
}

// ── Curve Fitting ─────────────────────────────────────────────────────────────

export function linearRegression(xs: number[], ys: number[]): MethodResult {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return { converged: false, iterations: [], error: "La regresión necesita al menos dos pares x,y del mismo tamaño." };
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denominator = n * sumX2 - sumX ** 2;
  if (Math.abs(denominator) < 1e-14) return { converged: false, iterations: [], error: "Los valores x no pueden ser todos iguales." };
  const m = (n * sumXY - sumX * sumY) / denominator;
  const bCoef = (sumY - m * sumX) / n;
  const yMean = sumY / n;
  const SStot = ys.reduce((a, y) => a + (y - yMean) ** 2, 0);
  const SSres = xs.reduce((a, x, i) => a + (ys[i] - (m * x + bCoef)) ** 2, 0);
  const r2 = SStot < 1e-14 ? (SSres < 1e-14 ? 1 : 0) : 1 - SSres / SStot;
  const iters: Iteration[] = xs.map((x, i) => ({
    n: i + 1, x, y: ys[i],
    "ŷ": +(m * x + bCoef).toFixed(6),
    residual: +(ys[i] - (m * x + bCoef)).toFixed(6),
    "residual²": +((ys[i] - (m * x + bCoef)) ** 2).toFixed(8),
  }));
  const plotData = buildLinearPlot(xs, m, bCoef);
  return { value: r2, converged: true, iterations: iters, plotData, extra: { m, b: bCoef, r2 } };
}

function buildLinearPlot(xs: number[], m: number, b: number): { x: number; y: number }[] {
  const min = Math.min(...xs) - 1, max = Math.max(...xs) + 1;
  return [{ x: min, y: m * min + b }, { x: max, y: m * max + b }];
}

export function lagrange(xs: number[], ys: number[], xq: number): MethodResult {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return { converged: false, iterations: [], error: "La interpolación necesita al menos dos pares x,y del mismo tamaño." };
  if (new Set(xs).size !== n) return { converged: false, iterations: [], error: "Los valores x deben ser distintos." };
  const iters: Iteration[] = [];
  let result = 0;
  for (let i = 0; i < n; i++) {
    let Li = 1;
    for (let j = 0; j < n; j++) {
      if (j !== i) Li *= (xq - xs[j]) / (xs[i] - xs[j]);
    }
    const term = Li * ys[i];
    result += term;
    iters.push({ n: i, "x_i": xs[i], "y_i": ys[i], "L_i(x)": +Li.toFixed(8), "L_i·y_i": +term.toFixed(8) });
  }
  return { value: result, converged: true, iterations: iters };
}

export function dividedDifferences(xs: number[], ys: number[], xq: number): MethodResult {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return { converged: false, iterations: [], error: "La interpolación necesita al menos dos pares x,y del mismo tamaño." };
  if (new Set(xs).size !== n) return { converged: false, iterations: [], error: "Los valores x deben ser distintos." };
  const table: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) table[i][0] = ys[i];
  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      table[i][j] = (table[i + 1][j - 1] - table[i][j - 1]) / (xs[i + j] - xs[i]);
    }
  }
  const iters: Iteration[] = table.map((row, i) => {
    const obj: Iteration = { n: i, "x_i": xs[i] };
    for (let j = 0; j < n - i; j++) obj[`f[${j}]`] = +row[j].toFixed(8);
    return obj;
  });
  let result = table[0][0], product = 1;
  for (let j = 1; j < n; j++) { product *= (xq - xs[j - 1]); result += table[0][j] * product; }
  return { value: result, converged: true, iterations: iters };
}

export function cubicSpline(xs: number[], ys: number[], xq: number): MethodResult {
  if (xs.length < 2 || xs.length !== ys.length) return { converged: false, iterations: [], error: "El spline necesita al menos dos puntos y vectores del mismo tamaño." };
  if (xs.some((x, i) => i > 0 && x <= xs[i - 1])) return { converged: false, iterations: [], error: "Los valores de x deben estar estrictamente ordenados." };
  if (xq < xs[0] || xq > xs[xs.length - 1]) return { converged: false, iterations: [], error: "El punto de consulta debe estar dentro del intervalo de interpolación." };
  const n = xs.length - 1;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  // Natural cubic spline: M_0 = M_n = 0
  const M = new Array(n + 1).fill(0);
  // Tridiagonal system
  const diag = h.slice(0, n - 1).map((hi, i) => 2 * (hi + h[i + 1]));
  const rhs = h.slice(0, n - 1).map((_, i) => {
    const i1 = i + 1;
    return 6 * ((ys[i1 + 1] - ys[i1]) / h[i1] - (ys[i1] - ys[i1 - 1]) / h[i1 - 1]);
  });
  // Thomas algorithm
  const a = h.slice(1, n - 1), c = h.slice(1, n - 1);
  const d = [...rhs], dl = [...diag];
  for (let i = 1; i < n - 1; i++) {
    const w = a[i - 1] / dl[i - 1];
    dl[i] -= w * c[i - 1];
    d[i] -= w * d[i - 1];
  }
  M[n - 1] = d[n - 2] / dl[n - 2];
  for (let i = n - 3; i >= 0; i--) M[i + 1] = (d[i] - c[i] * M[i + 2]) / dl[i];

  // Find interval
  let k = 0;
  for (let i = 0; i < n; i++) { if (xq >= xs[i] && xq <= xs[i + 1]) k = i; }
  const dx = xq - xs[k];
  const val = ys[k]
    + ((ys[k + 1] - ys[k]) / h[k] - h[k] * (2 * M[k] + M[k + 1]) / 6) * dx
    + (M[k] / 2) * dx ** 2
    + ((M[k + 1] - M[k]) / (6 * h[k])) * dx ** 3;

  const iters: Iteration[] = Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    "intervalo": `[${xs[i]}, ${xs[i+1]}]`,
    h_i: +h[i].toFixed(6),
    M_i: +M[i].toFixed(6),
    "M_{i+1}": +M[i + 1].toFixed(6),
    a_i: +ys[i].toFixed(6),
    b_i: +((ys[i + 1] - ys[i]) / h[i] - h[i] * (2 * M[i] + M[i + 1]) / 6).toFixed(6),
    c_i: +(M[i] / 2).toFixed(6),
    d_i: +((M[i + 1] - M[i]) / (6 * h[i])).toFixed(6),
  }));

  return { value: val, converged: true, iterations: iters };
}

// ── Numerical Differentiation ─────────────────────────────────────────────────

export function threePointDiff(expr: string, x: number, h: number): MethodResult {
  const f = (xi: number) => evalFn(expr, xi);
  const fwd = (-3 * f(x) + 4 * f(x + h) - f(x + 2 * h)) / (2 * h);
  const bwd = (f(x - 2 * h) - 4 * f(x - h) + 3 * f(x)) / (2 * h);
  const mid = (f(x + h) - f(x - h)) / (2 * h);
  const exact = evalFnDerivative(expr, x);

  const iters: Iteration[] = [
    { n: 1, fórmula: "Adelante", puntos: `x, x+h, x+2h`, f_vals: `${f(x).toFixed(5)}, ${f(x+h).toFixed(5)}, ${f(x+2*h).toFixed(5)}`, resultado: +fwd.toFixed(8), "error vs central": +Math.abs(fwd - mid).toExponential(3) },
    { n: 2, fórmula: "Atrás",    puntos: `x−2h, x−h, x`, f_vals: `${f(x-2*h).toFixed(5)}, ${f(x-h).toFixed(5)}, ${f(x).toFixed(5)}`, resultado: +bwd.toFixed(8), "error vs central": +Math.abs(bwd - mid).toExponential(3) },
    { n: 3, fórmula: "Central",  puntos: `x−h, x+h`, f_vals: `${f(x-h).toFixed(5)}, ${f(x+h).toFixed(5)}`, resultado: +mid.toFixed(8), "error vs central": 0 },
  ];

  return {
    value: mid, converged: true, iterations: iters,
    extra: { fwd, bwd, mid, exact, formulas: [{ name: "Adelante", value: fwd }, { name: "Atrás", value: bwd }, { name: "Central", value: mid }] }
  };
}

export function fivePointDiff(expr: string, x: number, h: number): MethodResult {
  const f = (xi: number) => evalFn(expr, xi);
  const mid5  = (f(x - 2*h) - 8*f(x - h) + 8*f(x + h) - f(x + 2*h)) / (12 * h);
  const fwd5  = (-25*f(x) + 48*f(x+h) - 36*f(x+2*h) + 16*f(x+3*h) - 3*f(x+4*h)) / (12 * h);
  const bwd5  = (3*f(x-4*h) - 16*f(x-3*h) + 36*f(x-2*h) - 48*f(x-h) + 25*f(x)) / (12 * h);

  const iters: Iteration[] = [
    { n: 1, fórmula: "5P Adelante", puntos: "x…x+4h", resultado: +fwd5.toFixed(8), "error vs central": +Math.abs(fwd5 - mid5).toExponential(3) },
    { n: 2, fórmula: "5P Atrás",   puntos: "x−4h…x", resultado: +bwd5.toFixed(8), "error vs central": +Math.abs(bwd5 - mid5).toExponential(3) },
    { n: 3, fórmula: "5P Central", puntos: "x−2h…x+2h", resultado: +mid5.toFixed(8), "error vs central": 0 },
  ];

  return {
    value: mid5, converged: true, iterations: iters,
    extra: { formulas: [{ name: "5P Adelante", value: fwd5 }, { name: "5P Atrás", value: bwd5 }, { name: "5P Central", value: mid5 }] }
  };
}

// ── Numerical Integration ─────────────────────────────────────────────────────

export function trapezoid(expr: string, a: number, b: number, n: number): MethodResult {
  const h = (b - a) / n;
  let sum = evalFn(expr, a) + evalFn(expr, b);
  const iters: Iteration[] = [];
  for (let i = 1; i < n; i++) {
    const xi = a + i * h;
    const fi = evalFn(expr, xi);
    sum += 2 * fi;
    iters.push({ n: i, x_i: +xi.toFixed(6), "f(x_i)": +fi.toFixed(6), coef: 2, "suma parcial": +(sum * h / 2).toFixed(8) });
  }
  return { value: (h / 2) * sum, converged: true, iterations: iters };
}

export function simpson13(expr: string, a: number, b: number, n: number): MethodResult {
  if (!Number.isInteger(n) || n <= 0 || n % 2 !== 0) return { converged: false, iterations: [], error: "Simpson 1/3 requiere un número positivo y par de subintervalos." };
  const h = (b - a) / n;
  let sum = evalFn(expr, a) + evalFn(expr, b);
  const iters: Iteration[] = [];
  for (let i = 1; i < n; i++) {
    const xi = a + i * h;
    const fi = evalFn(expr, xi);
    const coeff = i % 2 === 0 ? 2 : 4;
    sum += coeff * fi;
    iters.push({ n: i, x_i: +xi.toFixed(6), "f(x_i)": +fi.toFixed(6), coef: coeff, "suma parcial": +(sum * h / 3).toFixed(8) });
  }
  return { value: (h / 3) * sum, converged: true, iterations: iters };
}

// ── Plot helpers ──────────────────────────────────────────────────────────────

export function buildPlotData(expr: string, a: number, b: number, pts = 300): { x: number; y: number }[] {
  const data: { x: number; y: number }[] = [];
  for (let i = 0; i <= pts; i++) {
    const x = a + (i / pts) * (b - a);
    const y = evalFn(expr, x);
    if (isFinite(y)) data.push({ x: +x.toFixed(5), y: +y.toFixed(6) });
  }
  return data;
}
