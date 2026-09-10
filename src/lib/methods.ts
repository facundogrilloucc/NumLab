import { evalFn, evalFnDerivative } from "./mathEval";

export interface Iteration {
  n: number;
  [key: string]: number | string | undefined;
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
  if (fa === 0) return { root: a, converged: true, iterations: [], extra: { finalError: 0 } };
  if (fb === 0) return { root: b, converged: true, iterations: [], extra: { finalError: 0 } };
  if (fa * fb > 0)
    return { converged: false, iterations: [], error: "f(a) y f(b) deben tener signos opuestos." };
  let c = a, fc = 0;
  let prevC: number | undefined = undefined;
  let converged = false;
  let lastErr = 0;
  for (let n = 1; n <= maxIter; n++) {
    c = (a + b) / 2;
    fc = evalFn(expr, c);
    const err = prevC !== undefined ? Math.abs(c - prevC) : undefined;
    const intervalErr = Math.abs((b - a) / 2);
    if (!Number.isFinite(fc)) {
      iters.push({ n, a: +a.toFixed(8), b: +b.toFixed(8), c: +c.toFixed(8), "f(c)": "∞", estado: "⚠ f no finita", ...(err !== undefined ? { error: +err.toExponential(4) } : {}) });
      return { root: c, converged: false, iterations: iters, error: `La función dejó de ser finita en la iteración ${n} (x ≈ ${c.toExponential(3)}).` };
    }
    iters.push({ n, a: +a.toFixed(8), b: +b.toFixed(8), c: +c.toFixed(8), "f(c)": +fc.toExponential(4), ...(err !== undefined ? { error: +err.toExponential(4) } : {}) });
    lastErr = err ?? intervalErr;
    if (Math.abs(fc) < tol || intervalErr < tol || (err !== undefined && err < tol)) {
      converged = true;
      break;
    }
    prevC = c;
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return { root: c, converged, iterations: iters, extra: { finalError: lastErr } };
}

export function fixedPoint(
  fExpr: string, gExpr: string, x0: number, tol: number, maxIter: number
): MethodResult {
  const iters: Iteration[] = [];
  let x = x0;
  let prevX: number | undefined = undefined;
  let converged = false;
  let lastErr = 0;
  for (let n = 1; n <= maxIter; n++) {
    const fx = evalFn(fExpr, x);
    const gx = evalFn(gExpr, x);
    const err = prevX !== undefined ? Math.abs(x - prevX) : undefined;
    if (!Number.isFinite(fx) || !Number.isFinite(gx)) {
      iters.push({ n, "x_n": +x.toFixed(8), "g(x_n)": Number.isFinite(gx) ? +gx.toFixed(8) : "∞", "f(x_n)": Number.isFinite(fx) ? +fx.toExponential(4) : "∞", estado: "⚠ f o g no finita", ...(err !== undefined ? { error: +err.toExponential(4) } : {}) });
      return { root: x, converged: false, iterations: iters, error: `La función dejó de ser finita en la iteración ${n} (x ≈ ${x.toExponential(3)}).` };
    }
    iters.push({ n, "x_n": +x.toFixed(8), "g(x_n)": +gx.toFixed(8), "f(x_n)": +fx.toExponential(4), ...(err !== undefined ? { error: +err.toExponential(4) } : {}) });
    const step = Math.abs(gx - x);
    lastErr = step;
    if (step < tol && (Math.abs(fx) < tol || Math.abs(evalFn(fExpr, gx)) < tol)) {
      converged = true;
      x = gx;
      break;
    }
    prevX = x;
    x = gx;
  }
  return { root: x, converged, iterations: iters, extra: { finalError: lastErr } };
}

export function newtonRaphson(
  expr: string, x0: number, tol: number, maxIter: number, dExpr?: string
): MethodResult {
  const iters: Iteration[] = [];
  let x = x0;
  let prevX: number | undefined = undefined;
  let converged = false;
  let lastErr = 0;
  const useAnalytical = typeof dExpr === "string" && dExpr.trim().length > 0;
  for (let n = 1; n <= maxIter; n++) {
    const fx = evalFn(expr, x);
    const fpx = useAnalytical ? evalFn(dExpr, x) : evalFnDerivative(expr, x);
    const err = prevX !== undefined ? Math.abs(x - prevX) : undefined;
    if (!Number.isFinite(fx) || !Number.isFinite(fpx)) {
      iters.push({ n, "x_n": +x.toFixed(8), "f(x_n)": Number.isFinite(fx) ? +fx.toExponential(4) : "∞", "f'(x_n)": Number.isFinite(fpx) ? +fpx.toExponential(4) : "∞", estado: "⚠ f o f' no finita" });
      return { root: x, converged: false, iterations: iters, error: `La función o su derivada no es finita en la iteración ${n} (x ≈ ${x.toExponential(3)}).` };
    }
    if (Math.abs(fpx) < 1e-14) {
      iters.push({ n, "x_n": +x.toFixed(8), "f(x_n)": +fx.toExponential(4), "f'(x_n)": +fpx.toExponential(4), estado: "⚠ derivada ≈ 0" });
      return { converged: false, iterations: iters, error: `Derivada cercana a cero en la iteración ${n} (x ≈ ${x.toExponential(3)}).` };
    }
    const x1 = x - fx / fpx;
    const step = Math.abs(x1 - x);
    lastErr = step;
    iters.push({
      n,
      "x_n": +x.toFixed(8),
      "f(x_n)": +fx.toExponential(4),
      "f'(x_n)": +fpx.toExponential(4),
      "x_{n+1}": +x1.toFixed(8),
      ...(err !== undefined ? { error: +err.toExponential(4) } : {})
    });
    if (step < tol && (Math.abs(fx) < tol || Math.abs(evalFn(expr, x1)) < tol)) {
      converged = true;
      x = x1;
      break;
    }
    prevX = x;
    x = x1;
  }
  return { root: x, converged, iterations: iters, extra: { finalError: lastErr } };
}

export function secant(
  expr: string, x0: number, x1: number, tol: number, maxIter: number
): MethodResult {
  const iters: Iteration[] = [];
  let xa = x0, xb = x1;
  let converged = false;
  let lastErr = 0;
  for (let n = 1; n <= maxIter; n++) {
    const fa = evalFn(expr, xa), fb = evalFn(expr, xb);
    const err = n > 1 ? Math.abs(xb - xa) : undefined;
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
      iters.push({ n, "x_{n-1}": +xa.toFixed(8), "x_n": +xb.toFixed(8), estado: "⚠ f no finita" });
      return { root: xb, converged: false, iterations: iters, error: `La función dejó de ser finita en la iteración ${n} (x ≈ ${xb.toExponential(3)}).` };
    }
    if (Math.abs(fb - fa) < 1e-14) {
      iters.push({ n, "x_{n-1}": +xa.toFixed(8), "x_n": +xb.toFixed(8), "f(x_{n-1})": +fa.toExponential(4), "f(x_n)": +fb.toExponential(4), estado: "⚠ división por cero" });
      return { converged: false, iterations: iters, error: `División por cero en el paso de la secante en la iteración ${n} (x ≈ ${xb.toExponential(3)}).` };
    }
    const xc = xb - fb * (xb - xa) / (fb - fa);
    const step = Math.abs(xc - xb);
    lastErr = step;
    iters.push({
      n,
      "x_{n-1}": +xa.toFixed(8),
      "x_n": +xb.toFixed(8),
      "f(x_n)": +fb.toExponential(4),
      "x_{n+1}": +xc.toFixed(8),
      "f(x_{n+1})": +evalFn(expr, xc).toExponential(4),
      ...(err !== undefined ? { error: +err.toExponential(4) } : {})
    });
    if (step < tol && Math.abs(evalFn(expr, xc)) < tol) {
      converged = true;
      xb = xc;
      break;
    }
    xa = xb;
    xb = xc;
  }
  return { root: xb, converged, iterations: iters, extra: { finalError: lastErr } };
}

// ── Linear Systems ────────────────────────────────────────────────────────────

export function gaussianElimination(A: number[][], b: number[]): MethodResult {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  const iters: Iteration[] = [];
  const matrixSteps: { step: number; operation: string; factor?: number; matrix: number[][] }[] = [];

  // Step 0: Initial augmented matrix
  matrixSteps.push({
    step: 0,
    operation: "Matriz aumentada inicial [A | b]",
    matrix: M.map(row => row.map(v => +v.toFixed(6)))
  });

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
      matrixSteps.push({
        step: matrixSteps.length,
        operation: `Pivoteo parcial: Intercambio F${k+1} ↔ F${maxRow+1}`,
        matrix: M.map(row => row.map(v => +v.toFixed(6)))
      });
    }
    if (Math.abs(M[k][k]) < 1e-14)
      return { converged: false, iterations: iters, error: "La matriz es singular." };
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j];
      const opText = `F${i+1} ← F${i+1} − (${factor.toFixed(4)})·F${k+1}`;
      const row: Iteration = { n: iters.length + 1, operación: opText };
      for (let r = 0; r < n; r++) row[`F${r+1}`] = M[r].map(v => +v.toFixed(5)).join("  |  ");
      iters.push(row);
      matrixSteps.push({
        step: matrixSteps.length,
        operation: opText,
        factor: +factor.toFixed(5),
        matrix: M.map(row => row.map(v => +v.toFixed(6)))
      });
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  const backSteps: { variable: string; formula: string; value: number }[] = [];
  const subs = ["₁", "₂", "₃", "₄", "₅", "₆"];

  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(M[i][i]) < 1e-14) return { converged: false, iterations: iters, error: "La matriz es singular." };
    let sum = 0;
    const termParts: string[] = [];
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * x[j];
      termParts.push(`(${M[i][j].toFixed(4)})·(${x[j].toFixed(4)})`);
    }
    x[i] = (M[i][n] - sum) / M[i][i];

    let formulaStr = "";
    if (termParts.length === 0) {
      formulaStr = `${M[i][n].toFixed(4)} / ${M[i][i].toFixed(4)}`;
    } else {
      formulaStr = `(${M[i][n].toFixed(4)} − [${termParts.join(" + ")}]) / ${M[i][i].toFixed(4)}`;
    }

    backSteps.push({
      variable: `x${subs[i] ?? i+1}`,
      formula: formulaStr,
      value: +x[i].toFixed(8)
    });
  }

  return { solution: x, converged: true, iterations: iters, extra: { matrixSteps, backSteps, initialA: A, initialB: b } };
}

export function checkDiagonalDominance(A: number[][]): { isDominant: boolean; details: string[] } {
  const n = A.length;
  const details: string[] = [];
  let isDominant = true;
  for (let i = 0; i < n; i++) {
    const diag = Math.abs(A[i][i]);
    let sumOther = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i) sumOther += Math.abs(A[i][j]);
    }
    const ok = diag > sumOther;
    if (!ok) isDominant = false;
    details.push(`Fila ${i + 1}: |${A[i][i]}| = ${diag.toFixed(2)} ${ok ? ">" : "≤"} suma = ${sumOther.toFixed(2)}`);
  }
  return { isDominant, details };
}

export function findDiagonallyDominantPermutation(A: number[][]): {
  possible: boolean;
  perm?: number[];
  explanation?: string;
  isAlreadyDominant: boolean;
} {
  const n = A.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  let alreadyDominant = true;
  for (let i = 0; i < n; i++) {
    const diag = Math.abs(A[i][i]);
    let sumOther = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i) sumOther += Math.abs(A[i][j]);
    }
    if (diag <= sumOther) {
      alreadyDominant = false;
      break;
    }
  }

  if (alreadyDominant) {
    return { possible: true, perm: indices, isAlreadyDominant: true };
  }

  function getPermutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];
    const result: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of getPermutations(rest)) {
        result.push([arr[i], ...p]);
      }
    }
    return result;
  }

  const allPerms = getPermutations(indices);
  for (const perm of allPerms) {
    let isDominant = true;
    for (let i = 0; i < n; i++) {
      const rowIdx = perm[i];
      const diag = Math.abs(A[rowIdx][i]);
      let sumOther = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i) sumOther += Math.abs(A[rowIdx][j]);
      }
      if (diag <= sumOther) {
        isDominant = false;
        break;
      }
    }

    if (isDominant) {
      const subs = ["₁", "₂", "₃", "₄", "₅", "₆"];
      const steps = perm.map((oldIdx, newIdx) => `F${subs[newIdx] ?? newIdx + 1} ← F${subs[oldIdx] ?? oldIdx + 1}`);
      return {
        possible: true,
        perm,
        explanation: steps.join(", "),
        isAlreadyDominant: false,
      };
    }
  }

  return { possible: false, isAlreadyDominant: false };
}

export function buildRecurrenceEquations(A: number[][], b: number[]): string[] {
  const n = A.length;
  const subs = ["₁", "₂", "₃", "₄", "₅", "₆"];
  const eqns: string[] = [];
  for (let i = 0; i < n; i++) {
    const varName = `x${subs[i] ?? i + 1}`;
    const termParts: string[] = [];
    for (let j = 0; j < n; j++) {
      if (j !== i) {
        const coef = A[i][j];
        const otherVar = `x${subs[j] ?? j + 1}`;
        if (coef > 0) {
          termParts.push(`− ${coef}·${otherVar}`);
        } else if (coef < 0) {
          termParts.push(`+ ${Math.abs(coef)}·${otherVar}`);
        }
      }
    }
    const bStr = `${b[i]}`;
    const numerator = [bStr, ...termParts].join(" ");
    eqns.push(`${varName} = (${numerator}) / ${A[i][i]}`);
  }
  return eqns;
}

export function gaussSeidel(
  A: number[][], b: number[], x0: number[], tol: number, maxIter: number
): MethodResult {
  const n = A.length;
  const x = [...x0];
  const iters: Iteration[] = [];
  let converged = false;
  let lastErr = 0;

  if (A.some((row, i) => Math.abs(row[i]) < 1e-14)) {
    return { converged: false, iterations: [], error: "Gauss-Seidel requiere que los elementos de la diagonal principal no sean cero (a_ii ≠ 0)." };
  }

  const diagCheck = checkDiagonalDominance(A);
  const permCheck = findDiagonallyDominantPermutation(A);
  const recurrenceEquations = buildRecurrenceEquations(A, b);

  // Iteración 0: Vector inicial ingresado x^(0) (sin error previo)
  const row0: Iteration = { n: 0 };
  for (let i = 0; i < n; i++) {
    row0[`x${i + 1}`] = +x0[i].toFixed(8);
    row0[`e${i + 1}`] = undefined;
  }
  row0.error = undefined;
  iters.push(row0);

  for (let k = 1; k <= maxIter; k++) {
    const xOld = [...x];
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      for (let j = 0; j < n; j++) if (j !== i) sum -= A[i][j] * x[j];
      x[i] = sum / A[i][i];
    }

    // Detección temprana de divergencia numérica
    const hasNonFinite = x.some(val => !Number.isFinite(val) || Math.abs(val) > 1e15);
    if (hasNonFinite) {
      const row: Iteration = { n: k, estado: "⚠ divergencia detectada" };
      for (let i = 0; i < n; i++) {
        row[`x${i + 1}`] = Number.isFinite(x[i]) ? +x[i].toFixed(4) : "∞";
        row[`e${i + 1}`] = "∞";
      }
      row.error = Infinity;
      iters.push(row);
      return {
        solution: xOld,
        converged: false,
        iterations: iters,
        error: `El método divergió en la iteración ${k}. La matriz ${diagCheck.isDominant ? "no cumple con el radio espectral de convergencia" : "no es diagonalmente dominante"}.`,
        extra: {
          finalError: Infinity,
          isDiagonallyDominant: diagCheck.isDominant,
          dominanceDetails: diagCheck.details,
          recurrenceEquations,
          reorderPossible: permCheck.possible && !permCheck.isAlreadyDominant,
          reorderPerm: permCheck.perm,
          reorderExplanation: permCheck.explanation,
        }
      };
    }

    const errs = x.map((xi, i) => Math.abs(xi - xOld[i]));
    const err = Math.max(...errs);
    lastErr = err;
    const row: Iteration = { n: k };
    for (let i = 0; i < n; i++) {
      row[`x${i + 1}`] = +x[i].toFixed(8);
      row[`e${i + 1}`] = +errs[i].toExponential(4);
    }
    row.error = +err.toExponential(4);
    iters.push(row);

    if (err < tol) {
      converged = true;
      break;
    }
  }

  if (!converged && iters.length > 0) {
    const last = iters[iters.length - 1];
    last.estado = `⚠ no convergió en ${maxIter} iteraciones`;
  }

  return {
    solution: x,
    converged,
    iterations: iters,
    extra: {
      finalError: lastErr,
      isDiagonallyDominant: diagCheck.isDominant,
      dominanceDetails: diagCheck.details,
      recurrenceEquations,
      reorderPossible: permCheck.possible && !permCheck.isAlreadyDominant,
      reorderPerm: permCheck.perm,
      reorderExplanation: permCheck.explanation,
    }
  };
}

export function luDecomposition(A: number[][], b: number[]): MethodResult {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const U = A.map(row => [...row]);
  const subs = ["₁", "₂", "₃", "₄", "₅", "₆"];

  const permutation = Array.from({ length: n }, (_, i) => i);
  const pivotingSteps: string[] = [];

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
      pivotingSteps.push(`F${subs[k] ?? k + 1} ↔ F${subs[maxRow] ?? maxRow + 1}`);
    }
    for (let i = k + 1; i < n; i++) {
      L[i][k] = U[i][k] / U[k][k];
      for (let j = k; j < n; j++) U[i][j] -= L[i][k] * U[k][j];
      U[i][k] = 0; // Cero estricto para eliminar residuo de punto flotante
    }
  }

  const hadPivoting = pivotingSteps.length > 0;
  const permutedB = permutation.map(i => b[i]);

  // Forward substitution Ly = Pb
  const y = new Array(n).fill(0);
  const forwardSteps: { variable: string; formula: string; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const termParts: string[] = [];
    for (let j = 0; j < i; j++) {
      sum += L[i][j] * y[j];
      termParts.push(`(${L[i][j].toFixed(3)})·(${y[j].toFixed(3)})`);
    }
    y[i] = permutedB[i] - sum;
    const formula = termParts.length ? `${permutedB[i].toFixed(4)} − [${termParts.join(" + ")}]` : `${permutedB[i].toFixed(4)}`;
    forwardSteps.push({ variable: `y${subs[i] ?? i+1}`, formula, value: +y[i].toFixed(6) });
  }

  // Back substitution Ux = y
  const x = new Array(n).fill(0);
  const backSteps: { variable: string; formula: string; value: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    const termParts: string[] = [];
    for (let j = i + 1; j < n; j++) {
      sum += U[i][j] * x[j];
      termParts.push(`(${U[i][j].toFixed(3)})·(${x[j].toFixed(3)})`);
    }
    x[i] = (y[i] - sum) / U[i][i];
    const formula = termParts.length ? `(${y[i].toFixed(4)} − [${termParts.join(" + ")}]) / ${U[i][i].toFixed(4)}` : `${y[i].toFixed(4)} / ${U[i][i].toFixed(4)}`;
    backSteps.push({ variable: `x${subs[i] ?? i+1}`, formula, value: +x[i].toFixed(8) });
  }

  // Verificar producto L * U vs P * A
  let isVerified = true;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let prod = 0;
      for (let k = 0; k < n; k++) prod += L[i][k] * U[k][j];
      const target = A[permutation[i]][j];
      if (Math.abs(prod - target) > 1e-6) isVerified = false;
    }
  }

  const iters: Iteration[] = L.map((row, i) => {
    const r: Iteration = { n: i + 1 };
    row.forEach((v, j) => { r[`L${i+1}${j+1}`] = +v.toFixed(6); });
    U[i].forEach((v, j) => { r[`U${i+1}${j+1}`] = +v.toFixed(6); });
    r[`y${i+1}`] = +y[i].toFixed(6);
    r[`x${i+1}`] = +x[i].toFixed(6);
    return r;
  });

  return {
    solution: x,
    converged: true,
    iterations: iters,
    extra: {
      L,
      U,
      permutation,
      hadPivoting,
      pivotingSteps,
      permutedB,
      forwardSteps,
      backSteps,
      isVerified,
      initialA: A,
      initialB: b,
    }
  };
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

export function evalLagrange(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  let result = 0;
  for (let i = 0; i < n; i++) {
    let Li = 1;
    for (let j = 0; j < n; j++) {
      if (j !== i) Li *= (x - xs[j]) / (xs[i] - xs[j]);
    }
    result += Li * ys[i];
  }
  return result;
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

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const span = Math.max(1, maxX - minX);
  const pMin = minX - span * 0.1, pMax = maxX + span * 0.1;
  const plotData: { x: number; y: number }[] = [];
  const pts = 120;
  for (let i = 0; i <= pts; i++) {
    const px = pMin + (i / pts) * (pMax - pMin);
    const py = evalLagrange(xs, ys, px);
    if (Number.isFinite(py)) plotData.push({ x: +px.toFixed(4), y: +py.toFixed(4) });
  }

  return { value: result, converged: true, iterations: iters, plotData, extra: { xs, ys, xq, yq: result } };
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

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const span = Math.max(1, maxX - minX);
  const pMin = minX - span * 0.1, pMax = maxX + span * 0.1;
  const plotData: { x: number; y: number }[] = [];
  const pts = 120;
  for (let i = 0; i <= pts; i++) {
    const px = pMin + (i / pts) * (pMax - pMin);
    let py = table[0][0], prod = 1;
    for (let j = 1; j < n; j++) { prod *= (px - xs[j - 1]); py += table[0][j] * prod; }
    if (Number.isFinite(py)) plotData.push({ x: +px.toFixed(4), y: +py.toFixed(4) });
  }

  return { value: result, converged: true, iterations: iters, plotData, extra: { xs, ys, xq, yq: result } };
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

  const evalSplineAt = (xval: number) => {
    let k = 0;
    for (let i = 0; i < n; i++) { if (xval >= xs[i] && xval <= xs[i + 1]) k = i; }
    const dx = xval - xs[k];
    return ys[k]
      + ((ys[k + 1] - ys[k]) / h[k] - h[k] * (2 * M[k] + M[k + 1]) / 6) * dx
      + (M[k] / 2) * dx ** 2
      + ((M[k + 1] - M[k]) / (6 * h[k])) * dx ** 3;
  };

  const val = evalSplineAt(xq);

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

  const plotData: { x: number; y: number }[] = [];
  const pts = 150;
  const pMin = xs[0], pMax = xs[xs.length - 1];
  for (let i = 0; i <= pts; i++) {
    const px = pMin + (i / pts) * (pMax - pMin);
    const py = evalSplineAt(px);
    if (Number.isFinite(py)) plotData.push({ x: +px.toFixed(4), y: +py.toFixed(4) });
  }

  return { value: val, converged: true, iterations: iters, plotData, extra: { xs, ys, xq, yq: val } };
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
  if (!Number.isInteger(n) || n <= 0) return { converged: false, iterations: [], error: "La regla de los trapecios requiere un número entero positivo de subintervalos." };
  const h = (b - a) / n;
  let runningSum = 0;
  const iters: Iteration[] = [];
  for (let i = 0; i <= n; i++) {
    const xi = a + i * h;
    const fi = evalFn(expr, xi);
    if (!Number.isFinite(fi)) {
      return { converged: false, iterations: iters, error: `La función no es finita en x = ${xi.toFixed(4)}.` };
    }
    const coef = (i === 0 || i === n) ? 1 : 2;
    runningSum += coef * fi;
    iters.push({
      n: i,
      "x_i": +xi.toFixed(6),
      "f(x_i)": +fi.toFixed(6),
      coef,
      "término (c·f)": +(coef * fi).toFixed(6),
      "integral parcial": +(runningSum * h / 2).toFixed(8),
    });
  }
  return { value: (h / 2) * runningSum, converged: true, iterations: iters };
}

export function simpson13(expr: string, a: number, b: number, n: number): MethodResult {
  if (!Number.isInteger(n) || n <= 0 || n % 2 !== 0) return { converged: false, iterations: [], error: "Simpson 1/3 requiere un número positivo y par de subintervalos." };
  const h = (b - a) / n;
  let runningSum = 0;
  const iters: Iteration[] = [];
  for (let i = 0; i <= n; i++) {
    const xi = a + i * h;
    const fi = evalFn(expr, xi);
    if (!Number.isFinite(fi)) {
      return { converged: false, iterations: iters, error: `La función no es finita en x = ${xi.toFixed(4)}.` };
    }
    const coef = (i === 0 || i === n) ? 1 : (i % 2 === 0 ? 2 : 4);
    runningSum += coef * fi;
    iters.push({
      n: i,
      "x_i": +xi.toFixed(6),
      "f(x_i)": +fi.toFixed(6),
      coef,
      "término (c·f)": +(coef * fi).toFixed(6),
      "integral parcial": +(runningSum * h / 3).toFixed(8),
    });
  }
  return { value: (h / 3) * runningSum, converged: true, iterations: iters };
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
