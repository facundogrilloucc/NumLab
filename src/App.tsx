import React, { useState, useMemo, useCallback, useEffect, useRef, Fragment } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  bisection, fixedPoint, newtonRaphson, secant,
  gaussianElimination, gaussSeidel, luDecomposition, findDiagonallyDominantPermutation,
  linearRegression, lagrange, dividedDifferences, cubicSpline,
  threePointDiff, fivePointDiff,
  trapezoid, simpson13,
  buildPlotData,
  type MethodResult, type Iteration,
} from "./lib/methods";
import { isValidExpr } from "./lib/mathEval";
import { exportTableToCSV, copyTableToClipboard, copyTableToLatex, exportChartToPng } from "./lib/exportUtils";
import MathExpressionInput from "./components/MathExpressionInput";
import logo from "./logo.png";
import icon from "./icon.png";

// ── Nav ───────────────────────────────────────────────────────────────────────

interface NavMethod { id: string; name: string }
interface NavCategory { id: string; label: string; icon: string; color: string; methods: NavMethod[] }

const NAV: NavCategory[] = [
  { id: "roots", label: "Raíces de Ecuaciones", icon: "⦿", color: "#00d4ff", methods: [
    { id: "bisection",    name: "Bisección" },
    { id: "fixed-point",  name: "Punto Fijo" },
    { id: "newton",       name: "Newton-Raphson" },
    { id: "secant",       name: "Secante" },
  ]},
  { id: "systems", label: "Sistemas de Ec. Lineales", icon: "⊡", color: "#a855f7", methods: [
    { id: "gaussian",      name: "Eliminación Gaussiana" },
    { id: "gauss-seidel",  name: "Gauss-Seidel" },
    { id: "lu",            name: "Descomposición LU" },
  ]},
  { id: "fitting", label: "Ajuste de Curvas", icon: "∿", color: "#f59e0b", methods: [
    { id: "linear-reg",    name: "Regresión Lineal" },
    { id: "newton-interp", name: "Dif. Divididas (Newton)" },
    { id: "lagrange",      name: "Polinomio de Lagrange" },
    { id: "spline",        name: "Interpolación Spline" },
  ]},
  { id: "diff", label: "Diferenciación Numérica", icon: "∂", color: "#10b981", methods: [
    { id: "three-point", name: "Fórmulas de Tres Puntos" },
    { id: "five-point",  name: "Fórmulas de Cinco Puntos" },
  ]},
  { id: "integration", label: "Integración Numérica", icon: "∫", color: "#f97316", methods: [
    { id: "trapezoid", name: "Regla de los Trapecios" },
    { id: "simpson",   name: "Regla de Simpson 1/3" },
  ]},
];

const ALL_METHODS = NAV.flatMap(c => c.methods.map(m => ({ ...m, category: c.id, color: c.color })));
function getCat(methodId: string) { return NAV.find(c => c.methods.some(m => m.id === methodId)); }
function getMethodMeta(methodId: string) { return ALL_METHODS.find(m => m.id === methodId); }

function parseFiniteInput(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser un número válido. Usa punto para los decimales, por ejemplo 0.0001.`);
  return parsed;
}

function parsePositiveInput(value: string | undefined, label: string): number {
  const parsed = parseFiniteInput(value, label);
  if (parsed <= 0) throw new Error(`${label} debe ser mayor que cero.`);
  return parsed;
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  const parsed = parsePositiveInput(value, label);
  if (!Number.isInteger(parsed)) throw new Error(`${label} debe ser un número entero.`);
  return parsed;
}

function parseListInput(value: string | undefined, label: string): number[] {
  const items = (value ?? "").split(",").map(item => Number(item.trim()));
  if (!items.length || items.some(item => !Number.isFinite(item))) throw new Error(`${label} contiene valores inválidos.`);
  return items;
}

function validateExpression(expr: string | undefined, label = "La expresión"): string {
  if (!expr?.trim() || !isValidExpr(expr)) throw new Error(`${label} no es válida.`);
  return expr;
}

// ── Default params ─────────────────────────────────────────────────────────────

const DEFAULTS: Record<string, Record<string, string>> = {
  bisection:      { expr: "x^3 - x - 2", a: "1", b: "2", tol: "1e-6", maxIter: "50" },
  "fixed-point":  { fExpr: "x^3 - x - 2", gExpr: "(x + 2)^(1/3)", x0: "1.5", tol: "1e-6", maxIter: "50" },
  newton:         { expr: "x^3 - x - 2", dExpr: "3*x^2 - 1", x0: "1.5", tol: "1e-6", maxIter: "50" },
  secant:         { expr: "x^3 - x - 2", x0: "1", x1: "2", tol: "1e-6", maxIter: "50" },
  gaussian:       { size: "3", A_0_0:"3", A_0_1:"-0.1", A_0_2:"-0.2", A_1_0:"0.1", A_1_1:"7", A_1_2:"-0.3", A_2_0:"0.3", A_2_1:"-0.2", A_2_2:"10", b_0:"7.85", b_1:"-19.3", b_2:"71.4" },
  "gauss-seidel": { size: "3", A_0_0:"3", A_0_1:"-0.1", A_0_2:"-0.2", A_1_0:"0.1", A_1_1:"7", A_1_2:"-0.3", A_2_0:"0.3", A_2_1:"-0.2", A_2_2:"10", b_0:"7.85", b_1:"-19.3", b_2:"71.4", x0_0:"0", x0_1:"0", x0_2:"0", tol:"1e-6", maxIter:"50" },
  lu:             { size: "3", A_0_0:"3", A_0_1:"-0.1", A_0_2:"-0.2", A_1_0:"0.1", A_1_1:"7", A_1_2:"-0.3", A_2_0:"0.3", A_2_1:"-0.2", A_2_2:"10", b_0:"7.85", b_1:"-19.3", b_2:"71.4" },
  "linear-reg":   { xs: "1,2,3,4,5,6", ys: "2.1,3.9,5.8,8.2,10.1,12.0" },
  "newton-interp":{ xs: "0,1,2,3", ys: "1,2.718,7.389,20.086", xq: "1.5" },
  lagrange:       { xs: "0,1,2,3", ys: "1,2.718,7.389,20.086", xq: "1.5" },
  spline:         { xs: "0,1,2,3,4", ys: "0,0.5,2.0,1.5,0.8", xq: "2.5" },
  "three-point":  { expr: "x * e^x", x: "2", h: "0.1" },
  "five-point":   { expr: "x * e^x", x: "2", h: "0.1" },
  trapezoid:      { expr: "sin(x)", a: "0", b: "3.14159265", n: "8" },
  simpson:        { expr: "sin(x)", a: "0", b: "3.14159265", n: "8" },
};

// ── Atoms ─────────────────────────────────────────────────────────────────────

const ui:   React.CSSProperties = { fontFamily: "var(--font-ui)" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ ...ui, fontSize: 10, fontWeight: 600, letterSpacing: "0.09em", color: "var(--color-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>{children}</label>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column" }}><Label>{label}</Label>{children}{hint && <span style={{ ...ui, fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>{hint}</span>}</div>;
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ ...mono, fontSize: 10, fontWeight: 700, background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 3, padding: "2px 8px" }}>{children}</span>;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ ...mono, fontSize: 10, color: "var(--color-text-muted)", letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 6px" }}>{children}</p>;
}
function Inp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}
function NumInp({ value, onChange, w }: { value: string; onChange: (v: string) => void; w?: number }) {
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} style={{ width: w ?? "100%", fontFamily: "var(--font-mono)", textAlign: "center" }} />;
}

function DecimalHint() {
  return <span style={{ ...ui, fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>Usa punto para los decimales, por ejemplo 0.0001.</span>;
}

// ── Matrix input ───────────────────────────────────────────────────────────────

function MatrixInput({
  p,
  onChange,
  showX0 = false,
  onReorderRows,
}: {
  p: Record<string, string>;
  onChange: (k: string, v: string) => void;
  showX0?: boolean;
  onReorderRows?: (perm: number[]) => void;
}) {
  const size = parseInt(p.size ?? "3");
  const sub = ["₁", "₂", "₃", "₄"];

  let reorderInfo: { possible: boolean; perm?: number[]; explanation?: string; isAlreadyDominant: boolean } | null = null;
  if (showX0) {
    try {
      const A = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => parseFloat(p[`A_${i}_${j}`] || "0"))
      );
      if (A.every(row => row.every(val => Number.isFinite(val)))) {
        reorderInfo = findDiagonallyDominantPermutation(A);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Label>Tamaño</Label>
        <select value={size} onChange={e => onChange("size", e.target.value)} style={{ width: 72, padding: "4px 8px", fontSize: 12 }}>
          {[2,3,4].map(n => <option key={n} value={n}>{n} × {n}</option>)}
        </select>
      </div>

      {showX0 && reorderInfo && reorderInfo.possible && !reorderInfo.isAlreadyDominant && onReorderRows && (
        <div style={{ background: "#00d4ff10", border: "1px solid #00d4ff33", borderRadius: 6, padding: "7px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...mono, fontSize: 10, color: "#00d4ff", fontWeight: 700 }}>
              💡 Reordenamiento sugerido
            </span>
            <span style={{ ...mono, fontSize: 9, color: "var(--color-text-muted)" }}>
              {reorderInfo.explanation}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onReorderRows(reorderInfo!.perm!)}
            style={{
              background: "#00d4ff20",
              border: "1px solid #00d4ff55",
              color: "#00d4ff",
              borderRadius: 4,
              padding: "4px 8px",
              ...mono,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#00d4ff35"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#00d4ff20"; }}
          >
            🔄 Reordenar filas para dominancia
          </button>
        </div>
      )}

      {/* Sistema A · x = b */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", paddingBottom: 2 }}>
        <div>
          <Label>Matriz A</Label>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${size}, ${size === 4 ? "44px" : "50px"})`, gap: 3 }}>
            {Array.from({length:size}, (_,i) => Array.from({length:size}, (_,j) => (
              <NumInp key={`${i}_${j}`} w={size === 4 ? 42 : 48} value={p[`A_${i}_${j}`] ?? "0"} onChange={v => onChange(`A_${i}_${j}`, v)} />
            )))}
          </div>
        </div>
        <span style={{ ...mono, color: "var(--color-text-muted)", fontSize: 14, marginTop: 14 }}>·</span>
        <div>
          <Label>x</Label>
          <div style={{ display: "grid", gridTemplateRows: `repeat(${size}, 26px)`, gap: 3, marginTop: 2 }}>
            {Array.from({length:size}, (_,i) => (
              <div key={i} style={{ ...mono, fontSize: 11, color: "var(--color-cyan)", background: "#00d4ff11", border: "1px solid #00d4ff22", borderRadius: 4, width: 28, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
                x{sub[i]}
              </div>
            ))}
          </div>
        </div>
        <span style={{ ...mono, color: "var(--color-text-muted)", fontSize: 14, marginTop: 14 }}>=</span>
        <div>
          <Label>Vector b</Label>
          <div style={{ display: "grid", gridTemplateRows: `repeat(${size}, 26px)`, gap: 3 }}>
            {Array.from({length:size}, (_,i) => <NumInp key={i} w={size === 4 ? 46 : 52} value={p[`b_${i}`] ?? "0"} onChange={v => onChange(`b_${i}`, v)} />)}
          </div>
        </div>
      </div>

      {/* Vector inicial x^(0) para Gauss-Seidel */}
      {showX0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#070b13", border: "1px solid var(--color-border)", borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Label>Vector inicial x⁽⁰⁾</Label>
            <span style={{ ...mono, fontSize: 9, color: "var(--color-text-muted)" }}>Valores semilla</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {Array.from({length:size}, (_,i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ ...mono, fontSize: 11, color: "var(--color-cyan)", fontWeight: 600 }}>x{sub[i]}⁽⁰⁾:</span>
                <NumInp w={46} value={p[`x0_${i}`] ?? "0"} onChange={v => onChange(`x0_${i}`, v)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Points input ──────────────────────────────────────────────────────────────

function PointsInput({ p, onChange, withXq = true }: { p: Record<string, string>; onChange: (k: string, v: string) => void; withXq?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label="Puntos x (separados por coma)"><Inp value={p.xs ?? ""} onChange={v => onChange("xs", v)} placeholder="0, 1, 2, 3" /></Field>
      <Field label="Valores y (separados por coma)"><Inp value={p.ys ?? ""} onChange={v => onChange("ys", v)} placeholder="1.0, 2.718, 7.389, 20.086" /></Field>
      {withXq && <Field label="Interpolar en x ="><Inp value={p.xq ?? ""} onChange={v => onChange("xq", v)} placeholder="1.5" /></Field>}
    </div>
  );
}

// ── Run button ────────────────────────────────────────────────────────────────

function RunBtn({ onClick, color }: { onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} style={{
      background: color, color: "#000", border: "none", borderRadius: 5,
      padding: "9px 0", width: "100%", ...ui, fontWeight: 700, fontSize: 13,
      letterSpacing: "0.04em", cursor: "pointer",
      boxShadow: `0 0 18px ${color}55`, transition: "opacity 0.15s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
    >▶ Ejecutar</button>
  );
}

// ── Params per method ─────────────────────────────────────────────────────────

function ParamsPanel({
  methodId,
  p,
  onChange,
  onReorderRows,
}: {
  methodId: string;
  p: Record<string, string>;
  onChange: (k: string, v: string) => void;
  onReorderRows?: (perm: number[]) => void;
}) {
  const r2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as React.CSSProperties;
  const r3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } as React.CSSProperties;
  const numF = (key: string, label: string, hint?: string) => <Field label={label} hint={hint}><Inp value={p[key] ?? ""} onChange={v => onChange(key, v)} /></Field>;
  const mathF = (key: string, label: string, ph?: string) => (
    <MathExpressionInput label={label} value={p[key] ?? ""} onChange={v => onChange(key, v)} placeholder={ph} />
  );

  if (methodId === "bisection") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mathF("expr", "f(x)", "x^3 - x - 2")}
      <div style={r2}>{numF("a", "a — límite inferior")}{numF("b", "b — límite superior")}</div>
      <div style={r2}>{numF("tol", "Tolerancia", "Decimales con punto: 0.0001")}{numF("maxIter", "Máx. iteraciones")}</div>
    </div>
  );

  if (methodId === "fixed-point") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mathF("fExpr", "f(x) — ecuación original", "x^3 - x - 2")}
      {mathF("gExpr", "g(x) — función de iteración", "(x + 2)^(1/3)")}
      <div style={r3}>{numF("x0", "x₀ inicial")}{numF("tol", "Tolerancia", "Decimales con punto: 0.0001")}{numF("maxIter", "Máx. iter.")}</div>
    </div>
  );

  if (methodId === "newton") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mathF("expr", "f(x)", "cos(x) - x")}
      {mathF("dExpr", "f'(x) — derivada analítica (opcional)", "Si la dejas vacía se usa derivada numérica")}
      <div style={r3}>{numF("x0", "x₀ inicial")}{numF("tol", "Tolerancia", "Decimales con punto: 0.0001")}{numF("maxIter", "Máx. iter.")}</div>
    </div>
  );

  if (methodId === "secant") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mathF("expr", "f(x)", "x^2 - 2")}
      <div style={r2}>{numF("x0", "x₀")}{numF("x1", "x₁")}</div>
      <div style={r2}>{numF("tol", "Tolerancia", "Decimales con punto: 0.0001")}{numF("maxIter", "Máx. iter.")}</div>
    </div>
  );

  if (methodId === "gaussian" || methodId === "lu") return <MatrixInput p={p} onChange={onChange} />;

  if (methodId === "gauss-seidel") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <MatrixInput p={p} onChange={onChange} showX0 onReorderRows={onReorderRows} />
      <div style={r2}>{numF("tol", "Tolerancia", "Decimales con punto: 0.0001")}{numF("maxIter", "Máx. iter.")}</div>
    </div>
  );

  if (methodId === "linear-reg") return <PointsInput p={p} onChange={onChange} withXq={false} />;

  if (["newton-interp","lagrange","spline"].includes(methodId)) return <PointsInput p={p} onChange={onChange} withXq />;

  if (methodId === "three-point" || methodId === "five-point") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mathF("expr", "f(x)", "x * e^x")}
      <div style={r2}>{numF("x", "Punto x₀")}{numF("h", "Paso h")}</div>
    </div>
  );

  if (methodId === "trapezoid" || methodId === "simpson") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mathF("expr", "f(x)", "sin(x)")}
      <div style={r3}>{numF("a", "a")}{numF("b", "b")}{numF("n", "n subintervalos")}</div>
    </div>
  );

  return null;
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function Card({ label, value, color, wide }: { label: string; value: string; color: string; wide?: boolean }) {
  return (
    <div style={{ background: color + "14", border: `1px solid ${color}40`, borderRadius: 6, padding: "9px 14px", flex: wide ? 2 : 1, minWidth: 0 }}>
      <p style={{ ...mono, fontSize: 9, color, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 3px", whiteSpace: "nowrap" }}>{label}</p>
      <p style={{ ...mono, fontSize: 15, fontWeight: 700, color: "var(--color-text-bright)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
    </div>
  );
}

function SummaryRow({ result, methodId, color }: { result: MethodResult; methodId: string; color: string }) {
  const cat = getCat(methodId)?.id ?? "";
  const last = result.iterations.at(-1);
  const finalErr = typeof result.extra?.finalError === "number" ? result.extra.finalError : (last && typeof last.error === "number" ? last.error : undefined);
  const errVal = typeof finalErr === "number" && Number.isFinite(finalErr) ? finalErr.toExponential(3) : "—";

  if (methodId === "gauss-seidel" && result.solution) {
    const isDominant = result.extra?.isDiagonallyDominant as boolean | undefined;
    const numIters = result.iterations.length > 1 ? result.iterations.length - 1 : result.iterations.length;
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {result.solution.map((xi, i) => (
          <Card key={i} label={`x${["₁","₂","₃","₄"][i]}`} value={xi.toFixed(8)} color={color} />
        ))}
        <Card label="Iteraciones" value={String(numIters)} color="#4f6070" />
        {errVal !== "—" && <Card label="Error final" value={errVal} color="#f43f5e" />}
        {typeof isDominant === "boolean" && (
          <Badge color={isDominant ? "#10b981" : "#f59e0b"}>
            {isDominant ? "✓ Diag. dominante" : "⚠ No diag. dominante"}
          </Badge>
        )}
        <Badge color={result.converged ? "#10b981" : "#f43f5e"}>{result.converged ? "✓ Convergió" : "✗ No convergió"}</Badge>
      </div>
    );
  }

  if (result.solution) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {result.solution.map((xi, i) => (
          <Card key={i} label={`x${["₁","₂","₃","₄"][i]}`} value={xi.toFixed(8)} color={color} />
        ))}
        <Badge color={result.converged ? "#10b981" : "#f43f5e"}>{result.converged ? "✓ Convergió" : "✗ No convergió"}</Badge>
      </div>
    );
  }

  if (methodId === "linear-reg" && result.extra) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Card label="Pendiente m" value={(result.extra.m as number).toFixed(6)} color={color} />
        <Card label="Intercepto b" value={(result.extra.b as number).toFixed(6)} color={color} />
        <Card label="R²" value={(result.extra.r2 as number).toFixed(6)} color={color} />
        <Badge color="#10b981">✓ Calculado</Badge>
      </div>
    );
  }

  if (cat === "diff") {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Card label="f′(x₀) — fórmula central" value={result.value?.toFixed(10) ?? "—"} color={color} wide />
        <Card label="Evaluaciones" value={String(result.iterations.length)} color="#4f6070" />
        <Badge color="#10b981">✓ Calculado</Badge>
      </div>
    );
  }

  const mainLabel = cat === "roots" ? "Raíz aproximada" : cat === "integration" ? "Integral ≈" : "Valor interpolado";
  const mainVal = result.root ?? result.value;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Card label={mainLabel} value={mainVal !== undefined ? mainVal.toFixed(10) : "—"} color={color} wide />
      <Card label="Iteraciones" value={String(result.iterations.length)} color="#4f6070" />
      {errVal !== "—" && <Card label="Error final" value={errVal} color="#f43f5e" />}
      <Badge color={result.converged ? "#10b981" : "#f43f5e"}>{result.converged ? "✓ Convergió" : "✗ No convergió"}</Badge>
    </div>
  );
}

// ── Iteration table & Export Action Bar ───────────────────────────────────────

function TableActionBar({
  iterations,
  methodName,
}: {
  iterations: Iteration[];
  methodName: string;
}) {
  const [copiedType, setCopiedType] = useState<"clipboard" | "latex" | null>(null);

  const handleExportCSV = () => {
    const safeName = methodName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const filename = `NumLab_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    exportTableToCSV(iterations, filename);
  };

  const handleCopyClipboard = async () => {
    const ok = await copyTableToClipboard(iterations);
    if (ok) {
      setCopiedType("clipboard");
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleCopyLatex = async () => {
    const ok = await copyTableToLatex(iterations);
    if (ok) {
      setCopiedType("latex");
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 10, flexWrap: "wrap" }}>
      <span style={{ ...mono, fontSize: 11, color: "var(--color-text-muted)" }}>
        {iterations.length} fila{iterations.length !== 1 ? "s" : ""} de datos
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={handleExportCSV}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 5,
            background: "#0c1322", border: "1px solid var(--color-border)",
            color: "var(--color-text-bright)", ...ui, fontSize: 11, cursor: "pointer",
            transition: "all 0.15s",
          }}
          title="Descargar tabla en formato CSV compatible con Excel"
        >
          <span>📥</span> Exportar CSV
        </button>

        <button
          onClick={handleCopyClipboard}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 5,
            background: copiedType === "clipboard" ? "#10b98122" : "#0c1322",
            border: `1px solid ${copiedType === "clipboard" ? "#10b981" : "var(--color-border)"}`,
            color: copiedType === "clipboard" ? "#10b981" : "var(--color-text-bright)",
            ...ui, fontSize: 11, cursor: "pointer", transition: "all 0.15s",
          }}
          title="Copiar celdas para pegar directamente en Excel con Ctrl+V"
        >
          <span>{copiedType === "clipboard" ? "✓" : "📋"}</span>
          {copiedType === "clipboard" ? "¡Copiado a Excel!" : "Copiar a Excel"}
        </button>

        <button
          onClick={handleCopyLatex}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 5,
            background: copiedType === "latex" ? "#3b82f622" : "#0c1322",
            border: `1px solid ${copiedType === "latex" ? "#3b82f6" : "var(--color-border)"}`,
            color: copiedType === "latex" ? "#3b82f6" : "var(--color-text-bright)",
            ...ui, fontSize: 11, cursor: "pointer", transition: "all 0.15s",
          }}
          title="Copiar tabla en formato de código LaTeX"
        >
          <span>{copiedType === "latex" ? "✓" : "📄"}</span>
          {copiedType === "latex" ? "¡LaTeX copiado!" : "Copiar LaTeX"}
        </button>
      </div>
    </div>
  );
}

function IterTable({ iterations, methodName = "Metodo" }: { iterations: Iteration[]; methodName?: string }) {
  if (!iterations.length) return <p style={{ ...mono, fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>Sin datos de iteraciones.</p>;
  const cols = Array.from(new Set(iterations.flatMap(iteration => Object.keys(iteration))));
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <TableActionBar iterations={iterations} methodName={methodName} />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", borderRadius: 6, border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#080c14", position: "sticky", top: 0, zIndex: 1 }}>
            {cols.map(c => {
              const isErr = c === "error" || (c.startsWith("e") && c !== "estado");
              const label = c === "error" ? "error max" : c;
              return (
                <th key={c} style={{
                  padding: "6px 12px", textAlign: "left",
                  color: isErr ? "#f43f5e" : "var(--color-text-muted)",
                  fontWeight: 600, letterSpacing: "0.05em",
                  borderBottom: "1px solid var(--color-border)",
                  whiteSpace: "nowrap"
                }}>
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {iterations.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#0a0f1a" }}>
              {cols.map(c => {
                const isErr = c === "error" || (c.startsWith("e") && c !== "estado");
                return (
                  <td key={c} style={{
                    padding: "5px 12px",
                    color: isErr ? "#f43f5e" : c === "n" ? "var(--color-text-muted)" : "var(--color-text-bright)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    whiteSpace: "nowrap"
                  }}>
                    {row[c] === undefined ? "—" : String(row[c])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Matrix Step Views (Linear Systems) ────────────────────────────────────────

function AugmentedMatrixView({ matrix }: { matrix: number[][] }) {
  if (!matrix || !matrix.length) return null;
  const cols = matrix[0].length;
  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", background: "#070b12", border: "1px solid #1c2638", borderRadius: 6, padding: "8px 12px", gap: 6 }}>
      <div style={{ borderLeft: "2px solid #3b82f6", borderTop: "2px solid #3b82f6", borderBottom: "2px solid #3b82f6", width: 6, borderRadius: "3px 0 0 3px", marginRight: 4 }} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols - 1}, auto) 2px auto`, gap: "6px 12px", alignItems: "center" }}>
        {matrix.map((row, r) => (
          <React.Fragment key={r}>
            {row.slice(0, cols - 1).map((val, c) => {
              const isZero = Math.abs(val) < 1e-10;
              return (
                <div key={c} style={{
                  ...mono, fontSize: 11, textAlign: "right", minWidth: 54, padding: "2px 4px", borderRadius: 3,
                  color: isZero ? "#00d4ff" : "var(--color-text-bright)",
                  background: isZero ? "#00d4ff12" : "transparent",
                  fontWeight: isZero ? 700 : 400,
                }}>
                  {isZero ? "0" : val.toFixed(4)}
                </div>
              );
            })}
            <div style={{ width: 1.5, height: "100%", background: "#24324a" }} />
            <div style={{
              ...mono, fontSize: 11, textAlign: "right", minWidth: 54, padding: "2px 4px", borderRadius: 3,
              color: "#f59e0b", fontWeight: 600,
            }}>
              {row[cols - 1].toFixed(4)}
            </div>
          </React.Fragment>
        ))}
      </div>
      <div style={{ borderRight: "2px solid #3b82f6", borderTop: "2px solid #3b82f6", borderBottom: "2px solid #3b82f6", width: 6, borderRadius: "0 3px 3px 0", marginLeft: 4 }} />
    </div>
  );
}

function SimpleMatrixView({ matrix, highlightColor }: { matrix: number[][]; highlightColor: string }) {
  if (!matrix || !matrix.length) return null;
  const cols = matrix[0].length;
  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", background: "#070b12", border: "1px solid #1c2638", borderRadius: 6, padding: "8px 12px", gap: 6 }}>
      <div style={{ borderLeft: `2px solid ${highlightColor}`, borderTop: `2px solid ${highlightColor}`, borderBottom: `2px solid ${highlightColor}`, width: 6, borderRadius: "3px 0 0 3px", marginRight: 4 }} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, auto)`, gap: "6px 12px", alignItems: "center" }}>
        {matrix.map((row, r) => (
          <React.Fragment key={r}>
            {row.map((val, c) => {
              const isZero = Math.abs(val) < 1e-10;
              return (
                <div key={c} style={{
                  ...mono, fontSize: 11, textAlign: "right", minWidth: 48, padding: "2px 4px", borderRadius: 3,
                  color: isZero ? "#4f6070" : "var(--color-text-bright)",
                  fontWeight: Math.abs(val) >= 1e-10 ? 600 : 400,
                }}>
                  {isZero ? "0" : val.toFixed(4)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ borderRight: `2px solid ${highlightColor}`, borderTop: `2px solid ${highlightColor}`, borderBottom: `2px solid ${highlightColor}`, width: 6, borderRadius: "0 3px 3px 0", marginLeft: 4 }} />
    </div>
  );
}

function GaussianStepsView({
  matrixSteps,
  backSteps,
  color
}: {
  matrixSteps: { step: number; operation: string; factor?: number; matrix: number[][] }[];
  backSteps?: { variable: string; formula: string; value: number }[];
  color: string;
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel>1. Triangulación de la matriz aumentada [A | b]</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {matrixSteps.map(s => (
            <div key={s.step} style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: s.step === 0 ? "#10b981" : color, textTransform: "uppercase", letterSpacing: "0.05em", background: (s.step === 0 ? "#10b981" : color) + "18", padding: "2px 8px", borderRadius: 4 }}>
                  {s.step === 0 ? "Paso 0 (Inicial)" : `Paso ${s.step}`}
                </span>
                <span style={{ ...mono, fontSize: 11, color: "var(--color-text-bright)", fontWeight: 500 }}>
                  {s.operation}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
                <AugmentedMatrixView matrix={s.matrix} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {backSteps && backSteps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <SectionLabel>2. Sustitución regresiva (despeje de variables)</SectionLabel>
          <div style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {backSteps.map((b, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, ...mono, fontSize: 12, borderBottom: idx < backSteps.length - 1 ? "1px solid #141d2d" : "none", paddingBottom: idx < backSteps.length - 1 ? 8 : 0 }}>
                <span style={{ color: "#00d4ff", fontWeight: 700, minWidth: 32 }}>{b.variable}</span>
                <span style={{ color: "var(--color-text-muted)" }}>=</span>
                <span style={{ color: "var(--color-text-bright)", flex: 1 }}>{b.formula}</span>
                <span style={{ color: "var(--color-text-muted)" }}>=</span>
                <span style={{ color: "#10b981", fontWeight: 700, background: "#10b98115", padding: "2px 8px", borderRadius: 4 }}>{b.value.toFixed(8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LUStepsView({
  L,
  U,
  forwardSteps,
  backSteps,
  color
}: {
  L: number[][];
  U: number[][];
  forwardSteps?: { variable: string; formula: string; value: number }[];
  backSteps?: { variable: string; formula: string; value: number }[];
  color: string;
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel>Factorización A = L · U</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: "#3b82f6" }}>Matriz L (Triangular Inferior)</span>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <SimpleMatrixView matrix={L} highlightColor="#3b82f6" />
            </div>
          </div>
          <div style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: color }}>Matriz U (Triangular Superior)</span>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <SimpleMatrixView matrix={U} highlightColor={color} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {forwardSteps && forwardSteps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionLabel>1. Sustitución progresiva (L·y = P·b)</SectionLabel>
            <div style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {forwardSteps.map((b, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, ...mono, fontSize: 11 }}>
                  <span style={{ color: "#3b82f6", fontWeight: 700, minWidth: 24 }}>{b.variable}</span>
                  <span style={{ color: "var(--color-text-muted)" }}>=</span>
                  <span style={{ color: "var(--color-text-bright)", flex: 1, fontSize: 10 }}>{b.formula}</span>
                  <span style={{ color: "#10b981", fontWeight: 700 }}>= {b.value.toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {backSteps && backSteps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionLabel>2. Sustitución regresiva (U·x = y)</SectionLabel>
            <div style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {backSteps.map((b, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, ...mono, fontSize: 11 }}>
                  <span style={{ color: "#00d4ff", fontWeight: 700, minWidth: 24 }}>{b.variable}</span>
                  <span style={{ color: "var(--color-text-muted)" }}>=</span>
                  <span style={{ color: "var(--color-text-bright)", flex: 1, fontSize: 10 }}>{b.formula}</span>
                  <span style={{ color: "#10b981", fontWeight: 700 }}>= {b.value.toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GaussSeidelView({
  result,
  methodName,
  color,
  onReorderRows,
}: {
  result: MethodResult;
  methodName: string;
  color: string;
  onReorderRows?: (perm: number[]) => void;
}) {
  const eqns = result.extra?.recurrenceEquations as string[] | undefined;
  const isDominant = result.extra?.isDiagonallyDominant as boolean | undefined;
  const details = result.extra?.dominanceDetails as string[] | undefined;
  const reorderPossible = result.extra?.reorderPossible as boolean | undefined;
  const reorderPerm = result.extra?.reorderPerm as number[] | undefined;
  const reorderExplanation = result.extra?.reorderExplanation as string | undefined;

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 }}>
      {/* Recurrence formulas & Convergence info */}
      <div style={{ display: "grid", gridTemplateColumns: eqns && eqns.length > 0 ? "1fr 1fr" : "1fr", gap: 12 }}>
        {eqns && eqns.length > 0 && (
          <div style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ ...mono, fontSize: 11, fontWeight: 700, color }}>
              Ecuaciones de recurrencia despejadas
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {eqns.map((eq, i) => (
                <div key={i} style={{ ...mono, fontSize: 11, color: "var(--color-text-bright)", background: "#060911", padding: "6px 10px", borderRadius: 4, border: "1px solid #1c2638" }}>
                  {eq}
                </div>
              ))}
            </div>
          </div>
        )}

        {typeof isDominant === "boolean" && details && (
          <div style={{ background: "#0b101b", border: "1px solid var(--color-border)", borderRadius: 7, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: isDominant ? "#10b981" : "#f59e0b" }}>
                Condición de dominancia diagonal
              </span>
              <span style={{ ...mono, fontSize: 10, padding: "2px 6px", borderRadius: 3, background: isDominant ? "#10b98122" : "#f59e0b22", color: isDominant ? "#10b981" : "#f59e0b" }}>
                {isDominant ? "Convergencia garantizada" : "Sin garantía de convergencia"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {details.map((d, i) => (
                <div key={i} style={{ ...mono, fontSize: 10, color: "var(--color-text-muted)" }}>
                  {d}
                </div>
              ))}
            </div>

            {!isDominant && reorderPossible && reorderPerm && (
              <div style={{ background: "#00d4ff10", border: "1px solid #00d4ff33", borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...mono, fontSize: 10, color: "#00d4ff" }}>
                  <span>💡 Es posible lograr dominancia diagonal:</span>
                  <span style={{ fontWeight: 600 }}>{reorderExplanation}</span>
                </div>
                {onReorderRows && (
                  <button
                    type="button"
                    onClick={() => onReorderRows(reorderPerm)}
                    style={{
                      alignSelf: "flex-start",
                      background: "#00d4ff22",
                      border: "1px solid #00d4ff66",
                      color: "#00d4ff",
                      borderRadius: 4,
                      padding: "5px 12px",
                      ...mono,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#00d4ff35"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#00d4ff22"; }}
                  >
                    🔄 Reordenar filas y resolver
                  </button>
                )}
              </div>
            )}

            {!isDominant && !reorderPossible && (
              <div style={{ ...mono, fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>
                ℹ Ninguna permutación de filas logra dominancia diagonal para esta matriz.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Iteration table */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <SectionLabel>Tabla de iteraciones (k = 0 es el vector inicial x⁽⁰⁾)</SectionLabel>
        <IterTable iterations={result.iterations} methodName={methodName} />
      </div>
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

const CS = {
  tooltip: { background: "#0e1321", border: "1px solid #1c2538", borderRadius: 5, fontFamily: "var(--font-mono)", fontSize: 11 },
  axis: { tick: { fontFamily: "var(--font-mono)", fontSize: 10, fill: "#4f6070" } },
  grid: { strokeDasharray: "2 4", stroke: "#1c2538" },
};

function FnChart({
  plotData,
  root,
  x0,
  a,
  b,
  isIntegration = false
}: {
  plotData: { x: number; y: number }[];
  root?: number;
  x0?: number;
  a?: number;
  b?: number;
  isIntegration?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={plotData} margin={{ top: 12, right: 16, left: -5, bottom: 8 }}>
        <CartesianGrid {...CS.grid} />
        <XAxis
          dataKey="x"
          type="number"
          domain={['dataMin', 'dataMax']}
          {...CS.axis}
          tickFormatter={(v: number) => typeof v === "number" ? v.toFixed(1) : String(v)}
          interval="preserveStartEnd"
          minTickGap={45}
        />
        <YAxis
          {...CS.axis}
          tickFormatter={(v: number) => typeof v === "number" ? (Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(1) : v.toFixed(2)) : String(v)}
        />
        <ReferenceLine y={0} stroke="#3b4a68" strokeWidth={1.5} />
        {x0 !== undefined && Number.isFinite(x0) && (
          <ReferenceLine
            x={x0}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            strokeWidth={1.5}
            label={{ value: `x₀=${x0}`, position: "top", fill: "#f59e0b", fontSize: 10, fontFamily: "var(--font-mono)" }}
          />
        )}
        {root !== undefined && Number.isFinite(root) && (
          <ReferenceLine
            x={root}
            stroke="#00d4ff"
            strokeDasharray="4 2"
            strokeWidth={2}
            label={{ value: `x*≈${root.toFixed(3)}`, position: "insideTopRight", fill: "#00d4ff", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)" }}
          />
        )}
        {isIntegration && a !== undefined && Number.isFinite(a) && (
          <ReferenceLine x={a} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `a=${a}`, position: "top", fill: "#f97316", fontSize: 10, fontFamily: "var(--font-mono)" }} />
        )}
        {isIntegration && b !== undefined && Number.isFinite(b) && (
          <ReferenceLine x={b} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `b=${b}`, position: "top", fill: "#f97316", fontSize: 10, fontFamily: "var(--font-mono)" }} />
        )}
        <Tooltip
          contentStyle={CS.tooltip}
          formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(6) : String(v ?? ""), "f(x)"]}
          labelFormatter={(l: unknown) => `x = ${typeof l === "number" ? l.toFixed(4) : l}`}
        />
        <Line type="monotone" dataKey="y" stroke="#00d4ff" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ConvChart({ iterations, color }: { iterations: Iteration[]; color: string }) {
  const data = iterations
    .filter(r => typeof r.error === "number" && (r.error as number) > 0)
    .map(r => ({ n: r.n, error: Math.abs(r.error as number) }));
  if (data.length < 2) return <p style={{ ...mono, fontSize: 11, color: "var(--color-text-muted)" }}>Datos insuficientes para graficar la convergencia.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 16, left: 5, bottom: 8 }}>
        <CartesianGrid {...CS.grid} />
        <XAxis
          dataKey="n"
          {...CS.axis}
          allowDecimals={false}
          tickFormatter={(v: number) => `Iter ${v}`}
          interval={0}
          minTickGap={25}
        />
        <YAxis scale="log" domain={["auto","auto"]} {...CS.axis} tickFormatter={(v: number) => typeof v === "number" ? v.toExponential(0) : String(v)} />
        <Tooltip
          contentStyle={CS.tooltip}
          formatter={(v: unknown) => [typeof v === "number" ? v.toExponential(4) : String(v ?? ""), "Error"]}
          labelFormatter={(l: unknown) => `Iteración ${l}`}
        />
        <Line
          type="monotone"
          dataKey="error"
          stroke={color}
          strokeWidth={2.5}
          dot={{ fill: color, r: 4, stroke: "#0e1321", strokeWidth: 1.5 }}
          activeDot={{ r: 6, fill: "#ffffff", stroke: color, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function InterpChart({
  plotData,
  xs,
  ys,
  xq,
  yq,
  color
}: {
  plotData: { x: number; y: number }[];
  xs: number[];
  ys: number[];
  xq?: number;
  yq?: number;
  color: string;
}) {
  const pts = xs.map((x, i) => ({ x, y: ys[i] }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart margin={{ top: 12, right: 16, left: -5, bottom: 8 }}>
        <CartesianGrid {...CS.grid} />
        <XAxis
          dataKey="x"
          type="number"
          domain={["auto","auto"]}
          {...CS.axis}
          tickFormatter={(v: number) => typeof v === "number" ? v.toFixed(1) : String(v)}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis {...CS.axis} tickFormatter={(v: number) => typeof v === "number" ? v.toFixed(2) : String(v)} />
        <ReferenceLine y={0} stroke="#3b4a68" />
        {xq !== undefined && Number.isFinite(xq) && (
          <ReferenceLine
            x={xq}
            stroke="#f59e0b"
            strokeDasharray="4 2"
            strokeWidth={1.5}
            label={{ value: `xq = ${xq}`, position: "top", fill: "#f59e0b", fontSize: 10, fontFamily: "var(--font-mono)" }}
          />
        )}
        <Tooltip contentStyle={CS.tooltip} labelFormatter={(l: unknown) => `x = ${typeof l === "number" ? l.toFixed(3) : l}`} />
        <Line data={plotData} type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} name="Curva interpolante" isAnimationActive={false} />
        <Line data={pts} type="linear" dataKey="y" stroke="transparent" dot={{ fill: "#00d4ff", r: 5, stroke: "#0e1321", strokeWidth: 1.5 }} name="Nodos (xi, yi)" isAnimationActive={false} />
        {xq !== undefined && yq !== undefined && Number.isFinite(xq) && Number.isFinite(yq) && (
          <Line data={[{ x: xq, y: yq }]} type="linear" dataKey="y" stroke="transparent" dot={{ fill: "#f59e0b", r: 7, stroke: "#ffffff", strokeWidth: 2 }} name="P(xq) evaluado" isAnimationActive={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

function RegChart({ xs, ys, m, b }: { xs: number[]; ys: number[]; m: number; b: number }) {
  const pts = xs.map((x, i) => ({ x, y: ys[i] }));
  const mn = Math.min(...xs) - 0.5, mx = Math.max(...xs) + 0.5;
  const line = [{ x: mn, y: m * mn + b }, { x: mx, y: m * mx + b }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart margin={{ top: 12, right: 16, left: -5, bottom: 8 }}>
        <CartesianGrid {...CS.grid} />
        <XAxis dataKey="x" type="number" {...CS.axis} domain={["auto","auto"]} interval="preserveStartEnd" minTickGap={40} />
        <YAxis {...CS.axis} />
        <Tooltip contentStyle={CS.tooltip} />
        <Line data={line} type="linear" dataKey="y" stroke="#f59e0b" strokeWidth={2} dot={false} name="y = mx + b" isAnimationActive={false} />
        <Line data={pts} type="linear" dataKey="y" stroke="transparent" dot={{ fill: "#00d4ff", r: 5, stroke: "#00d4ff" }} name="Datos" isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DiffBars({ formulas, color }: { formulas: { name: string; value: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formulas} margin={{ top: 12, right: 16, left: -10, bottom: 8 }}>
        <CartesianGrid {...CS.grid} />
        <XAxis dataKey="name" {...CS.axis} />
        <YAxis {...CS.axis} domain={["auto","auto"]} />
        <Tooltip contentStyle={CS.tooltip} formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(8) : String(v ?? ""), "f′(x)"]} />
        <Bar dataKey="value" name="f′(x)" radius={[3,3,0,0]} isAnimationActive={false}>
          {formulas.map((_, i) => <Cell key={i} fill={i === 2 ? color : color + "77"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Graphs tab ────────────────────────────────────────────────────────────────

function GraphsTab({ result, methodId, p, color }: { result: MethodResult; methodId: string; p: Record<string, string>; color: string }) {
  const cat = getCat(methodId)?.id ?? "";
  const methodName = getMethodMeta(methodId)?.name ?? "Metodo";
  const isRootOrInt = ["roots", "integration"].includes(cat);

  const fnChartRef = useRef<HTMLDivElement>(null);
  const interpChartRef = useRef<HTMLDivElement>(null);
  const diffChartRef = useRef<HTMLDivElement>(null);
  const regChartRef = useRef<HTMLDivElement>(null);
  const convChartRef = useRef<HTMLDivElement>(null);

  const plotData = useMemo(() => {
    if (!isRootOrInt) return null;
    const expr = p.expr ?? p.fExpr ?? "";
    if (!expr) return null;

    // Collect all relevant domain anchor points
    const xPoints: number[] = [];
    if (typeof result.root === "number" && Number.isFinite(result.root)) xPoints.push(result.root);
    if (p.x0 !== undefined) { const v = parseFloat(p.x0); if (Number.isFinite(v)) xPoints.push(v); }
    if (p.x1 !== undefined) { const v = parseFloat(p.x1); if (Number.isFinite(v)) xPoints.push(v); }
    if (p.a !== undefined) { const v = parseFloat(p.a); if (Number.isFinite(v)) xPoints.push(v); }
    if (p.b !== undefined) { const v = parseFloat(p.b); if (Number.isFinite(v)) xPoints.push(v); }
    result.iterations.forEach(it => {
      if (typeof it.x === "number" && Number.isFinite(it.x)) xPoints.push(it.x);
      if (typeof it.x_n === "number" && Number.isFinite(it.x_n)) xPoints.push(it.x_n);
      if (typeof it["x_{n+1}"] === "number" && Number.isFinite(it["x_{n+1}"] as number)) xPoints.push(it["x_{n+1}"] as number);
      if (typeof it.c === "number" && Number.isFinite(it.c)) xPoints.push(it.c);
    });

    let minX = xPoints.length ? Math.min(...xPoints) : -5;
    let maxX = xPoints.length ? Math.max(...xPoints) : 5;
    if (minX === maxX) { minX -= 3; maxX += 3; }
    const span = Math.max(1, maxX - minX);
    let pMin = minX - span * 0.25;
    let pMax = maxX + span * 0.25;

    // Safeguard for logarithmic and square root domains
    const isLog = /\b(ln|log)\b/i.test(expr);
    const isSqrt = /\bsqrt\b/i.test(expr);
    if ((isLog || isSqrt) && pMin <= 0) {
      pMin = Math.max(0.01, minX > 0 ? minX * 0.5 : 0.01);
    }

    return buildPlotData(expr, pMin, pMax, 300);
  }, [cat, p, result, isRootOrInt]);

  const x0Val = p.x0 !== undefined ? parseFloat(p.x0) : undefined;
  const aVal = p.a !== undefined ? parseFloat(p.a) : undefined;
  const bVal = p.b !== undefined ? parseFloat(p.b) : undefined;

  const hasInterpPlot = ["lagrange", "newton-interp", "spline"].includes(methodId) && !!result.plotData?.length;
  const hasDiffFormulas = !!(result.extra?.formulas as unknown[])?.length;
  const hasConv = result.iterations.some(r => typeof r.error === "number" && (r.error as number) > 0);

  const numCharts = (plotData ? 1 : 0) + (hasInterpPlot ? 1 : 0) + (hasDiffFormulas ? 1 : 0) + (methodId === "linear-reg" ? 1 : 0) + (hasConv ? 1 : 0);
  const cols = numCharts >= 2 ? "1fr 1fr" : "1fr";

  const safeMethodName = methodName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");

  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, flex: 1, minHeight: 0 }}>
      {plotData && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <SectionLabel>{cat === "integration" ? "Función a integrar f(x)" : "Gráfica de f(x)"}</SectionLabel>
            <button
              onClick={() => exportChartToPng(fnChartRef.current, `NumLab_${safeMethodName}_fx.png`)}
              style={{
                background: "#0c1322", border: "1px solid var(--color-border)", borderRadius: 4,
                padding: "2px 8px", color: "var(--color-text-muted)", ...ui, fontSize: 10, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.15s"
              }}
              title="Descargar gráfica como imagen PNG en alta definición"
            >
              <span>📥</span> Descargar PNG
            </button>
          </div>
          <div ref={fnChartRef} style={{ flex: 1, minHeight: 220 }}>
            <FnChart
              plotData={plotData}
              root={result.root}
              x0={x0Val}
              a={aVal}
              b={bVal}
              isIntegration={cat === "integration"}
            />
          </div>
        </div>
      )}
      {hasInterpPlot && result.extra && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <SectionLabel>Curva interpolante y puntos</SectionLabel>
            <button
              onClick={() => exportChartToPng(interpChartRef.current, `NumLab_${safeMethodName}_Interpolacion.png`)}
              style={{
                background: "#0c1322", border: "1px solid var(--color-border)", borderRadius: 4,
                padding: "2px 8px", color: "var(--color-text-muted)", ...ui, fontSize: 10, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.15s"
              }}
              title="Descargar gráfica de interpolación en PNG"
            >
              <span>📥</span> Descargar PNG
            </button>
          </div>
          <div ref={interpChartRef} style={{ flex: 1, minHeight: 220 }}>
            <InterpChart
              plotData={result.plotData!}
              xs={(result.extra.xs as number[]) ?? []}
              ys={(result.extra.ys as number[]) ?? []}
              xq={result.extra.xq as number | undefined}
              yq={result.extra.yq as number | undefined}
              color={color}
            />
          </div>
        </div>
      )}
      {hasDiffFormulas && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <SectionLabel>Comparación de fórmulas — f′(x₀)</SectionLabel>
            <button
              onClick={() => exportChartToPng(diffChartRef.current, `NumLab_${safeMethodName}_Diferenciacion.png`)}
              style={{
                background: "#0c1322", border: "1px solid var(--color-border)", borderRadius: 4,
                padding: "2px 8px", color: "var(--color-text-muted)", ...ui, fontSize: 10, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.15s"
              }}
              title="Descargar gráfica de diferenciación en PNG"
            >
              <span>📥</span> Descargar PNG
            </button>
          </div>
          <div ref={diffChartRef} style={{ flex: 1, minHeight: 220 }}>
            <DiffBars formulas={result.extra!.formulas as { name: string; value: number }[]} color={color} />
          </div>
        </div>
      )}
      {methodId === "linear-reg" && result.extra && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <SectionLabel>Recta de regresión y datos</SectionLabel>
            <button
              onClick={() => exportChartToPng(regChartRef.current, `NumLab_Regresion_Lineal.png`)}
              style={{
                background: "#0c1322", border: "1px solid var(--color-border)", borderRadius: 4,
                padding: "2px 8px", color: "var(--color-text-muted)", ...ui, fontSize: 10, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.15s"
              }}
              title="Descargar gráfica de regresión en PNG"
            >
              <span>📥</span> Descargar PNG
            </button>
          </div>
          <div ref={regChartRef} style={{ flex: 1, minHeight: 220 }}>
            <RegChart xs={p.xs?.split(",").map(Number) ?? []} ys={p.ys?.split(",").map(Number) ?? []} m={result.extra.m as number} b={result.extra.b as number} />
          </div>
        </div>
      )}
      {hasConv && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <SectionLabel>Convergencia del error</SectionLabel>
            <button
              onClick={() => exportChartToPng(convChartRef.current, `NumLab_${safeMethodName}_Convergencia.png`)}
              style={{
                background: "#0c1322", border: "1px solid var(--color-border)", borderRadius: 4,
                padding: "2px 8px", color: "var(--color-text-muted)", ...ui, fontSize: 10, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.15s"
              }}
              title="Descargar gráfica de convergencia en PNG"
            >
              <span>📥</span> Descargar PNG
            </button>
          </div>
          <div ref={convChartRef} style={{ flex: 1, minHeight: 220 }}>
            <ConvChart iterations={result.iterations} color={color} />
          </div>
        </div>
      )}
      {!plotData && !hasInterpPlot && !hasDiffFormulas && methodId !== "linear-reg" && !hasConv && (
        <p style={{ ...mono, fontSize: 12, color: "var(--color-text-muted)" }}>No hay gráficas disponibles para este método.</p>
      )}
    </div>
  );
}

// ── Result panel ──────────────────────────────────────────────────────────────

function ResultPanel({
  result,
  methodId,
  p,
  color,
  onReorderRows,
}: {
  result: MethodResult | null;
  methodId: string;
  p: Record<string, string>;
  color: string;
  onReorderRows?: (perm: number[]) => void;
}) {
  const [tab, setTab] = useState<"table" | "graph">("table");

  if (!result) {
    return (
      <div style={{ flex: 1, background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div style={{ fontSize: 40, opacity: 0.1, color }}>{getCat(methodId)?.icon}</div>
        <p style={{ ...ui, fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>Configura los parámetros y ejecuta el método</p>
      </div>
    );
  }

  const methodName = getMethodMeta(methodId)?.name ?? methodId;
  const isLinearStepMethod = methodId === "gaussian" || methodId === "lu";
  const tableTabLabel = isLinearStepMethod ? "Pasos de resolución" : "Tabla de iteraciones";

  return (
    <div style={{ flex: 1, background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, minHeight: 0 }}>
      {/* Top summary card */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
        <SummaryRow result={result} methodId={methodId} color={color} />
      </div>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
        {(["table","graph"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", background: "transparent", cursor: "pointer",
            borderTop: "none", borderRight: "none", borderLeft: "none",
            borderBottom: tab === t ? `2px solid ${color}` : "2px solid transparent",
            ...ui, fontSize: 12, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? color : "var(--color-text-muted)", transition: "all 0.15s", marginBottom: -1,
          }}>
            {t === "table" ? tableTabLabel : "Gráficas"}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", padding: 14, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {tab === "table" && (
          methodId === "gaussian" && result.extra?.matrixSteps ? (
            <GaussianStepsView
              matrixSteps={result.extra.matrixSteps as { step: number; operation: string; factor?: number; matrix: number[][] }[]}
              backSteps={result.extra.backSteps as { variable: string; formula: string; value: number }[]}
              color={color}
            />
          ) : methodId === "lu" && result.extra?.L ? (
            <LUStepsView
              L={result.extra.L as number[][]}
              U={result.extra.U as number[][]}
              forwardSteps={result.extra.forwardSteps as { variable: string; formula: string; value: number }[]}
              backSteps={result.extra.backSteps as { variable: string; formula: string; value: number }[]}
              color={color}
            />
          ) : methodId === "gauss-seidel" ? (
            <GaussSeidelView result={result} methodName={methodName} color={color} onReorderRows={onReorderRows} />
          ) : (
            <IterTable iterations={result.iterations} methodName={methodName} />
          )
        )}
        {tab === "graph" && <GraphsTab result={result} methodId={methodId} p={p} color={color} />}
      </div>
    </div>
  );
}

// ── Home screen ───────────────────────────────────────────────────────────────

function HomeScreen({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "8px 0 4px" }}>
        <img src={logo} alt="NumLab" style={{ width: "min(420px, 48vw)", height: "auto", display: "block" }} />
        <div>
        <p style={{ ...mono, fontSize: 10, color: "var(--color-cyan)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 6px" }}>Bienvenido a</p>
        <h1 style={{ ...ui, fontSize: 30, fontWeight: 700, color: "var(--color-text-bright)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Laboratorio de métodos numéricos</h1>
        <p style={{ ...ui, fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>Selecciona un método numérico del menú lateral o desde las categorías a continuación.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {NAV.map(cat => (
          <div key={cat.id} style={{ background: "var(--color-panel)", border: `1px solid ${cat.color}33`, borderRadius: 8, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 7, background: cat.color + "20", border: `1px solid ${cat.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: cat.color }}>
                {cat.icon}
              </div>
              <div>
                <p style={{ ...ui, fontSize: 12, fontWeight: 700, color: "var(--color-text-bright)", margin: 0 }}>{cat.label}</p>
                <p style={{ ...mono, fontSize: 9, color: "var(--color-text-muted)", margin: "2px 0 0" }}>{cat.methods.length} métodos</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {cat.methods.map(m => (
                <button key={m.id} onClick={() => onSelect(m.id)} style={{
                  background: "transparent", padding: "5px 10px", textAlign: "left",
                  borderTop: "none", borderRight: "none", borderBottom: "none",
                  borderLeft: `2px solid ${cat.color}33`,
                  ...ui, fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer",
                  borderRadius: "0 4px 4px 0", transition: "all 0.12s",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = cat.color + "11"; el.style.color = "var(--color-text-bright)"; el.style.borderLeftColor = cat.color; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-muted)"; el.style.borderLeftColor = cat.color + "33"; }}
                >{m.name}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 18px", background: "#00d4ff08", border: "1px solid #00d4ff18", borderRadius: 8, display: "flex", gap: 28, flexWrap: "wrap" }}>
        {["f(xₙ) = 0", "Ax = b", "∫ f dx ≈ Σ wᵢf(xᵢ)", "f′(x) ≈ [f(x+h)−f(x−h)] / 2h", "xₙ₊₁ = g(xₙ)"].map(f => (
          <span key={f} style={{ ...mono, fontSize: 12, color: "var(--color-cyan)", opacity: 0.6 }}>{f}</span>
        ))}
      </div>
    </div>
  );
}

function AboutScreen() {
  return (
    <div style={{ flex: 1, padding: "34px 44px", overflowY: "auto" }}>
      <div style={{ maxWidth: 760 }}>
        <img src={logo} alt="NumLab" style={{ width: "min(430px, 70vw)", height: "auto", display: "block", marginBottom: 28 }} />
        <p style={{ ...mono, fontSize: 10, color: "var(--color-cyan)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 8px" }}>Acerca de</p>
        <h1 style={{ ...ui, fontSize: 30, color: "var(--color-text-bright)", margin: "0 0 14px" }}>Una herramienta para aprender haciendo</h1>
        <p style={{ ...ui, fontSize: 15, lineHeight: 1.7, color: "var(--color-text)", margin: "0 0 26px" }}>
          NumLab es una calculadora interactiva de métodos numéricos. Permite explorar raíces de ecuaciones, sistemas lineales, interpolación, ajuste de curvas, diferenciación e integración numérica mediante sus parámetros, tablas de iteraciones y gráficas.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 20px", background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
          <img src={icon} alt="Icono de NumLab" style={{ width: 76, height: 76, objectFit: "contain", flexShrink: 0 }} />
          <div>
            <p style={{ ...mono, fontSize: 10, color: "var(--color-cyan)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 6px" }}>Creador</p>
            <h2 style={{ ...ui, fontSize: 20, color: "var(--color-text-bright)", margin: "0 0 5px" }}>Facundo Grillo</h2>
            <p style={{ ...ui, fontSize: 13, lineHeight: 1.5, color: "var(--color-text-muted)", margin: 0 }}>Estudiante de Ingeniería Informática en la Universidad Católica de Córdoba.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("home");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [params, setParams] = useState<Record<string, Record<string, string>>>(DEFAULTS);
  const [result, setResult] = useState<MethodResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "NumLab | Métodos Numéricos";
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.type = "image/png";
    favicon.href = icon;
  }, []);

  const selectMethod = useCallback((id: string) => {
    setView(id);
    setResult(null);
    setRunError(null);
    const cat = getCat(id);
    if (cat) setExpanded(prev => new Set([...prev, cat.id]));
  }, []);

  const toggleCat = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const p = params[view] ?? {};
  const onChange = (k: string, v: string) => setParams(prev => ({ ...prev, [view]: { ...(prev[view] ?? {}), [k]: v } }));
  const meta = getMethodMeta(view);
  const cat  = getCat(view);
  const color = cat?.color ?? "#00d4ff";

  function run(overrideP?: Record<string, string>) {
    const currentP = overrideP ?? p;
    setRunError(null);
    setResult(null);
    try {
      const tol = parsePositiveInput(currentP.tol ?? "1e-6", "La tolerancia");
      const maxIter = parsePositiveInteger(currentP.maxIter ?? "50", "El máximo de iteraciones");
      let res: MethodResult;

      if (view === "bisection") {
        const expr = validateExpression(currentP.expr);
        res = bisection(expr, parseFiniteInput(currentP.a, "a"), parseFiniteInput(currentP.b, "b"), tol, maxIter);
      } else if (view === "fixed-point") {
        res = fixedPoint(validateExpression(currentP.fExpr, "f(x)"), validateExpression(currentP.gExpr, "g(x)"), parseFiniteInput(currentP.x0, "x₀"), tol, maxIter);
      } else if (view === "newton") {
        const dExpr = currentP.dExpr?.trim();
        res = newtonRaphson(validateExpression(currentP.expr), parseFiniteInput(currentP.x0, "x₀"), tol, maxIter, dExpr && dExpr.length > 0 ? validateExpression(currentP.dExpr, "f'(x)") : undefined);
      } else if (view === "secant") {
        res = secant(validateExpression(currentP.expr), parseFiniteInput(currentP.x0, "x₀"), parseFiniteInput(currentP.x1, "x₁"), tol, maxIter);
      } else if (view === "gaussian" || view === "lu" || view === "gauss-seidel") {
        const size = parsePositiveInteger(currentP.size ?? "3", "El tamaño de la matriz");
        const A = Array.from({length:size}, (_,i) => Array.from({length:size}, (_,j) => parseFiniteInput(currentP[`A_${i}_${j}`], `A${i + 1},${j + 1}`)));
        const b = Array.from({length:size}, (_,i) => parseFiniteInput(currentP[`b_${i}`], `b${i + 1}`));
        if (view === "gaussian") res = gaussianElimination(A, b);
        else if (view === "lu") res = luDecomposition(A, b);
        else res = gaussSeidel(A, b, Array.from({length:size}, (_,i) => parseFiniteInput(currentP[`x0_${i}`], `x₀${i + 1}`)), tol, maxIter);
      } else if (view === "linear-reg") {
        const xs = parseListInput(currentP.xs, "Los puntos x");
        const ys = parseListInput(currentP.ys, "Los valores y");
        if (xs.length !== ys.length || xs.length < 2) throw new Error("Se necesitan al menos dos pares x,y del mismo tamaño.");
        res = linearRegression(xs, ys);
      } else if (view === "newton-interp") {
        const xs = parseListInput(currentP.xs, "Los puntos x");
        const ys = parseListInput(currentP.ys, "Los valores y");
        if (xs.length !== ys.length || xs.length < 2) throw new Error("Se necesitan al menos dos pares x,y del mismo tamaño.");
        res = dividedDifferences(xs, ys, parseFiniteInput(currentP.xq, "x de consulta"));
      } else if (view === "lagrange") {
        const xs = parseListInput(currentP.xs, "Los puntos x");
        const ys = parseListInput(currentP.ys, "Los valores y");
        if (xs.length !== ys.length || xs.length < 2) throw new Error("Se necesitan al menos dos pares x,y del mismo tamaño.");
        res = lagrange(xs, ys, parseFiniteInput(currentP.xq, "x de consulta"));
      } else if (view === "spline") {
        res = cubicSpline(parseListInput(currentP.xs, "Los puntos x"), parseListInput(currentP.ys, "Los valores y"), parseFiniteInput(currentP.xq, "x de consulta"));
      } else if (view === "three-point") {
        res = threePointDiff(validateExpression(currentP.expr), parseFiniteInput(currentP.x, "x₀"), parsePositiveInput(currentP.h, "h"));
      } else if (view === "five-point") {
        res = fivePointDiff(validateExpression(currentP.expr), parseFiniteInput(currentP.x, "x₀"), parsePositiveInput(currentP.h, "h"));
      } else if (view === "trapezoid") {
        res = trapezoid(validateExpression(currentP.expr), parseFiniteInput(currentP.a, "a"), parseFiniteInput(currentP.b, "b"), parsePositiveInteger(currentP.n ?? "8", "n"));
      } else if (view === "simpson") {
        res = simpson13(validateExpression(currentP.expr), parseFiniteInput(currentP.a, "a"), parseFiniteInput(currentP.b, "b"), parsePositiveInteger(currentP.n ?? "8", "n"));
      } else return;

      if (res.error) setRunError(res.error);
      setResult(res);
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : "Error desconocido.");
    }
  }

  function handleReorderRows(perm: number[]) {
    const size = parseInt(p.size ?? "3");
    const newP: Record<string, string> = { ...p };
    for (let newIdx = 0; newIdx < size; newIdx++) {
      const oldIdx = perm[newIdx];
      for (let j = 0; j < size; j++) {
        newP[`A_${newIdx}_${j}`] = p[`A_${oldIdx}_${j}`] ?? "0";
      }
      newP[`b_${newIdx}`] = p[`b_${oldIdx}`] ?? "0";
    }
    setParams(prev => ({ ...prev, [view]: newP }));
    run(newP);
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "var(--color-bg)" }}>

      {/* Sidebar */}
      <aside style={{ width: 228, minWidth: 228, maxWidth: 228, background: "var(--color-surface)", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Brand */}
        <div style={{ padding: "15px 16px 13px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={icon} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <p style={{ ...mono, fontSize: 14, fontWeight: 700, color: "var(--color-cyan)", margin: 0, letterSpacing: "-0.02em" }}>NumLab</p>
          </div>
          <p style={{ ...ui, fontSize: 9, color: "var(--color-text-muted)", margin: 0, letterSpacing: "0.04em" }}>Laboratorio de Métodos Numéricos</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {/* Home */}
          <button onClick={() => setView("home")} style={{
            display: "block", width: "100%", textAlign: "left", padding: "7px 16px",
            background: view === "home" ? "#00d4ff14" : "transparent",
            borderTop: "none", borderRight: "none", borderBottom: "none",
            borderLeft: view === "home" ? "2px solid var(--color-cyan)" : "2px solid transparent",
            ...ui, fontSize: 12, fontWeight: view === "home" ? 600 : 400,
            color: view === "home" ? "var(--color-text-bright)" : "var(--color-text-muted)", cursor: "pointer",
          }}>⌂  Inicio</button>

          <button onClick={() => setView("about")} style={{
            display: "block", width: "100%", textAlign: "left", padding: "7px 16px",
            background: view === "about" ? "#00d4ff14" : "transparent",
            borderTop: "none", borderRight: "none", borderBottom: "none",
            borderLeft: view === "about" ? "2px solid var(--color-cyan)" : "2px solid transparent",
            ...ui, fontSize: 12, fontWeight: view === "about" ? 600 : 400,
            color: view === "about" ? "var(--color-text-bright)" : "var(--color-text-muted)", cursor: "pointer",
          }}>ⓘ  Acerca de</button>

          {NAV.map(category => {
            const open = expanded.has(category.id);
            return (
              <div key={category.id}>
                <button onClick={() => toggleCat(category.id)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "7px 16px", background: "transparent",
                  border: "none", cursor: "pointer",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ffffff06"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <span style={{ ...ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: category.color, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 12 }}>{category.icon}</span>{category.label}
                  </span>
                  <span style={{ color: category.color, fontSize: 9, opacity: 0.6, display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                </button>
                {open && category.methods.map(m => {
                  const active = view === m.id;
                  return (
                    <button key={m.id} onClick={() => selectMethod(m.id)} style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "5px 16px 5px 30px",
                      background: active ? category.color + "18" : "transparent",
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderLeft: active ? `2px solid ${category.color}` : "2px solid transparent",
                      ...ui, fontSize: 12, fontWeight: active ? 600 : 400,
                      color: active ? "var(--color-text-bright)" : "var(--color-text-muted)",
                      cursor: "pointer", transition: "all 0.1s",
                    }}
                    onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = "#ffffff08"; el.style.color = "var(--color-text)"; }}}
                    onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "var(--color-text-muted)"; }}}
                    >{m.name}</button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer hint */}
        <div style={{ padding: "9px 16px", borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
          <p style={{ ...mono, fontSize: 9, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.7 }}>
            Variables: x, y, z, e, pi<br />
            Funciones: sin, cos, tan, ln, sqrt, exp
          </p>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {view === "home" ? (
          <HomeScreen onSelect={selectMethod} />
        ) : view === "about" ? (
          <AboutScreen />
        ) : (
          <>
            {/* Header */}
            <header style={{ padding: "11px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: color + "20", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color }}>
                {cat?.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ ...ui, fontSize: 15, fontWeight: 700, color: "var(--color-text-bright)", margin: 0, letterSpacing: "-0.01em" }}>{meta?.name}</h1>
                <p style={{ ...ui, fontSize: 10, color: "var(--color-text-muted)", margin: 0 }}>{cat?.label}</p>
              </div>
              <Badge color={color}>{cat?.label}</Badge>
            </header>

            {/* Two-panel body */}
            <div style={{ flex: 1, display: "flex", gap: 14, padding: 14, overflow: "hidden", minHeight: 0 }}>
              {/* Left: params */}
              <div style={{ width: 330, minWidth: 330, maxWidth: 330, background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 12, padding: 16, overflowY: "auto", flexShrink: 0 }}>
                <SectionLabel>Parámetros de entrada</SectionLabel>
                <ParamsPanel methodId={view} p={p} onChange={onChange} onReorderRows={handleReorderRows} />
                <RunBtn onClick={() => run()} color={color} />
                {runError && (
                  <div style={{ background: "#f43f5e18", border: "1px solid #f43f5e44", borderRadius: 5, padding: "7px 12px", ...mono, fontSize: 11, color: "#f43f5e" }}>
                    ⚠ {runError}
                  </div>
                )}
              </div>
              {/* Right: results */}
              <ResultPanel result={result} methodId={view} p={p} color={color} onReorderRows={handleReorderRows} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
