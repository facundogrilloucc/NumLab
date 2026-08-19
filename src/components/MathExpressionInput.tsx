import { useRef, useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

type KbTab = "123" | "fx" | "abc";

// ── Math preview renderer ─────────────────────────────────────────────────────

const FN_NAMES = ["arcsin","arccos","arctan","asin","acos","atan","sinh","cosh","tanh","sqrt","abs","exp","log","ln","sin","cos","tan"];

function renderPreview(expr: string): React.ReactNode {
  if (!expr.trim()) return null;

  // Step 1: preprocess string into display form
  let s = expr
    .replace(/\bpi\b/g, "π")
    .replace(/\bPI\b/g, "π")
    .replace(/\*/g, "·")
    .replace(/\bsqrt\b/g, "√")
    .replace(/\babs\b/g, "|");

  // Tokenize into segments: [type, text]
  type Tok = ["fn" | "op" | "num" | "var" | "paren" | "plain", string];
  const fnPat = new RegExp(`\\b(${FN_NAMES.join("|")})\\b`, "g");
  const parts: Tok[] = [];
  let last = 0;

  // Find all function names
  const matches: { index: number; len: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  fnPat.lastIndex = 0;
  while ((m = fnPat.exec(s)) !== null) matches.push({ index: m.index, len: m[0].length, text: m[0] });

  for (const { index, len, text } of matches) {
    if (index > last) parts.push(["plain", s.slice(last, index)]);
    parts.push(["fn", text]);
    last = index + len;
  }
  if (last < s.length) parts.push(["plain", s.slice(last)]);

  // Render each segment, handling ^N superscripts inside "plain" segments
  const CYAN = "#00d4ff";
  const AMBER = "#f59e0b";
  const PURPLE = "#a855f7";
  const MUTED = "#7a8fa6";

  const renderPlain = (text: string, key: number): React.ReactNode => {
    // Split on ^N or ^{...}
    const parts2: React.ReactNode[] = [];
    const supRe = /\^([0-9]+|\([^)]*\))/g;
    let p = 0, sm: RegExpExecArray | null;
    let ki = 0;
    while ((sm = supRe.exec(text)) !== null) {
      if (sm.index > p) parts2.push(<span key={ki++} style={{ color: "var(--color-text-bright)" }}>{colorize(text.slice(p, sm.index))}</span>);
      parts2.push(<sup key={ki++} style={{ color: AMBER, fontSize: "0.75em" }}>{sm[1].replace(/^\(|\)$/g, "")}</sup>);
      p = sm.index + sm[0].length;
    }
    if (p < text.length) parts2.push(<span key={ki++}>{colorize(text.slice(p))}</span>);
    return <span key={key}>{parts2}</span>;
  };

  const colorize = (t: string): React.ReactNode => {
    // Color numbers, π, e, variables
    return t.split("").map((ch, i) => {
      if (/[0-9.]/.test(ch)) return <span key={i} style={{ color: "#64b5f6" }}>{ch}</span>;
      if (ch === "π") return <span key={i} style={{ color: PURPLE }}>π</span>;
      if (ch === "·" || ch === "+" || ch === "-" || ch === "/" || ch === "|") return <span key={i} style={{ color: MUTED, display: "inline-block", marginInline: 3 }}>{ch}</span>;
      if (ch === "(" || ch === ")") return <span key={i} style={{ color: MUTED, display: "inline-block", marginInline: 2 }}>{ch}</span>;
      if (/[a-z]/.test(ch)) return <span key={i} style={{ color: "var(--color-text-bright)" }}>{ch}</span>;
      return <span key={i} style={{ color: MUTED }}>{ch}</span>;
    });
  };

  return (
    <>
      {parts.map((tok, i) => {
        if (tok[0] === "fn") return <span key={i} style={{ color: CYAN, fontWeight: 600 }}>{tok[1]}</span>;
        return renderPlain(tok[1], i);
      })}
    </>
  );
}

// ── Keyboard sub-components ───────────────────────────────────────────────────

const KEY: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 500,
  background: "#0d1220",
  color: "var(--color-text)",
  border: "1px solid #1c2538",
  borderRadius: 4,
  cursor: "pointer",
  padding: "0 4px",
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.1s, border-color 0.1s",
  userSelect: "none" as const,
  flexShrink: 0,
};

const OP_KEY: React.CSSProperties = { ...KEY, color: "#00d4ff", borderColor: "#00d4ff30" };
const FN_KEY: React.CSSProperties = { ...KEY, color: "#f59e0b", borderColor: "#f59e0b30", fontSize: 11 };
const VAR_KEY: React.CSSProperties = { ...KEY, color: "#a855f7", borderColor: "#a855f730" };
const UTIL_KEY: React.CSSProperties = { ...KEY, color: "#4f6070", borderColor: "#1c2538" };
const NUM_KEY: React.CSSProperties = { ...KEY, color: "#cdd5e0" };

function Btn({ style, onClick, children, title }: { style: React.CSSProperties; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      style={style}
      title={title}
      onClick={e => { e.preventDefault(); onClick(); }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1a2336"; (e.currentTarget as HTMLElement).style.borderColor = "#2a3550"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#0d1220"; (e.currentTarget as HTMLElement).style.borderColor = style.borderColor as string ?? "#1c2538"; }}
    >
      {children}
    </button>
  );
}

interface KbActions {
  insert: (text: string, cursorBack?: number) => void;
  insertFn: (fn: string) => void;
  reciprocal: () => void;
  wrapPower: (exp: string) => void;
  backspace: () => void;
  moveCursor: (dir: -1 | 1) => void;
}

function Keyboard123({ a }: { a: KbActions }) {
  const g6 = { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 } as React.CSSProperties;
  const g5 = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 } as React.CSSProperties;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {/* Quick powers */}
      <div style={g6}>
        <Btn style={OP_KEY} onClick={() => a.wrapPower("2")}>x²</Btn>
        <Btn style={OP_KEY} onClick={() => a.wrapPower("3")}>x³</Btn>
        <Btn style={OP_KEY} onClick={a.reciprocal} title="Inversa: 1 dividido por la expresión seleccionada">1/x</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert("(", -1)}>(</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert(")")}>)</Btn>
        <Btn style={UTIL_KEY} onClick={a.backspace}>⌫</Btn>
      </div>
      {/* Row 1 */}
      <div style={g5}>
        <Btn style={NUM_KEY} onClick={() => a.insert("7")}>7</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert("8")}>8</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert("9")}>9</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert("*")}>×</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert("/")} >÷</Btn>
      </div>
      {/* Row 2 */}
      <div style={g5}>
        <Btn style={NUM_KEY} onClick={() => a.insert("4")}>4</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert("5")}>5</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert("6")}>6</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert("+")}>+</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert("-")}>−</Btn>
      </div>
      {/* Row 3 */}
      <div style={g5}>
        <Btn style={NUM_KEY} onClick={() => a.insert("1")}>1</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert("2")}>2</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert("3")}>3</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert("^")}>^</Btn>
        <Btn style={OP_KEY} onClick={() => a.insertFn("sqrt")}>√</Btn>
      </div>
      {/* Row 4 */}
      <div style={g5}>
        <Btn style={NUM_KEY} onClick={() => a.insert("0")}>0</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert(".")}>.</Btn>
        <Btn style={VAR_KEY} onClick={() => a.insert("x")}>x</Btn>
        <Btn style={VAR_KEY} onClick={() => a.insert("e")}>e</Btn>
        <Btn style={VAR_KEY} onClick={() => a.insert("pi")}>π</Btn>
      </div>
      {/* Row 5 */}
      <div style={g6}>
        <Btn style={VAR_KEY} onClick={() => a.insert("y")}>y</Btn>
        <Btn style={VAR_KEY} onClick={() => a.insert("z")}>z</Btn>
        <Btn style={VAR_KEY} onClick={() => a.insert("n")}>n</Btn>
        <Btn style={NUM_KEY} onClick={() => a.insert(" ")}>_</Btn>
        <Btn style={UTIL_KEY} onClick={() => a.moveCursor(-1)}>◂</Btn>
        <Btn style={UTIL_KEY} onClick={() => a.moveCursor(1)}>▸</Btn>
      </div>
    </div>
  );
}

function KeyboardFx({ a }: { a: KbActions }) {
  const g3 = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 } as React.CSSProperties;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={g3}>
        <Btn style={FN_KEY} onClick={() => a.insertFn("sin")}>sin</Btn>
        <Btn style={FN_KEY} onClick={() => a.insertFn("cos")}>cos</Btn>
        <Btn style={FN_KEY} onClick={() => a.insertFn("tan")}>tan</Btn>
      </div>
      <div style={g3}>
        <Btn style={FN_KEY} onClick={() => a.insertFn("asin")}>sin⁻¹</Btn>
        <Btn style={FN_KEY} onClick={() => a.insertFn("acos")}>cos⁻¹</Btn>
        <Btn style={FN_KEY} onClick={() => a.insertFn("atan")}>tan⁻¹</Btn>
      </div>
      <div style={g3}>
        <Btn style={FN_KEY} onClick={() => a.insertFn("ln")}>ln</Btn>
        <Btn style={FN_KEY} onClick={() => a.insertFn("log")}>log</Btn>
        <Btn style={FN_KEY} onClick={() => a.insertFn("exp")}>exp</Btn>
      </div>
      <div style={g3}>
        <Btn style={FN_KEY} onClick={() => a.insertFn("sqrt")}>√ sqrt</Btn>
        <Btn style={FN_KEY} onClick={() => a.insertFn("abs")}>|abs|</Btn>
        <Btn style={FN_KEY} onClick={() => a.insert("e^(", 1)} >eˣ</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        <Btn style={VAR_KEY} onClick={() => a.insert("pi")}>π</Btn>
        <Btn style={VAR_KEY} onClick={() => a.insert("e")}>e</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert("(", -1)}>(</Btn>
        <Btn style={OP_KEY} onClick={() => a.insert(")")}>)</Btn>
      </div>
    </div>
  );
}

function KeyboardAbc({ a }: { a: KbActions }) {
  const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
        {ALPHA.slice(0, 10).map(ch => <Btn key={ch} style={{ ...KEY, fontSize: 11 }} onClick={() => a.insert(ch)}>{ch}</Btn>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
        {ALPHA.slice(10, 20).map(ch => <Btn key={ch} style={{ ...KEY, fontSize: 11 }} onClick={() => a.insert(ch)}>{ch}</Btn>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
        {ALPHA.slice(20).map(ch => <Btn key={ch} style={{ ...KEY, fontSize: 11 }} onClick={() => a.insert(ch)}>{ch}</Btn>)}
        <Btn style={UTIL_KEY} onClick={a.backspace}>⌫</Btn>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MathExpressionInput({ label, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<KbTab>("123");
  const inputRef = useRef<HTMLInputElement>(null);

  // Get cursor position from input
  const getCursor = (): [number, number] => {
    const el = inputRef.current;
    if (!el) return [value.length, value.length];
    return [el.selectionStart ?? value.length, el.selectionEnd ?? value.length];
  };

  // Apply new value and schedule cursor restoration
  const apply = useCallback((newVal: string, pos: number) => {
    onChange(newVal);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    }, 0);
  }, [onChange]);

  const insert = useCallback((text: string, cursorBack = 0) => {
    const [start, end] = getCursor();
    const newVal = value.slice(0, start) + text + value.slice(end);
    const pos = start + text.length - cursorBack;
    apply(newVal, pos);
  }, [value, apply]);

  const insertFn = useCallback((fn: string) => {
    const [start, end] = getCursor();
    const selected = value.slice(start, end);
    const text = selected ? `${fn}(${selected})` : `${fn}()`;
    const newVal = value.slice(0, start) + text + value.slice(end);
    // Cursor inside parens when no selection, after closing paren when selection
    const pos = selected ? start + text.length : start + fn.length + 1;
    apply(newVal, pos);
  }, [value, apply]);

  const reciprocal = useCallback(() => {
    const [start, end] = getCursor();
    const selected = value.slice(start, end);
    const text = selected ? `1/(${selected})` : "1/(x)";
    const pos = selected ? start + text.length : start + 3;
    apply(value.slice(0, start) + text + value.slice(end), pos);
  }, [value, apply]);

  const wrapPower = useCallback((exp: string) => {
    const [start, end] = getCursor();
    if (start !== end) {
      const selected = value.slice(start, end);
      const text = `(${selected})^${exp}`;
      apply(value.slice(0, start) + text + value.slice(end), start + text.length);
      return;
    }
    // Find last token before cursor
    const before = value.slice(0, start);
    const m = before.match(/([a-zA-Z_][a-zA-Z0-9_]*|\d+\.?\d*|\))$/);
    if (m) {
      const idx = before.length - m[0].length;
      const newVal = value.slice(0, idx) + m[0] + `^${exp}` + value.slice(start);
      apply(newVal, idx + m[0].length + 1 + exp.length);
    } else {
      insert(`^${exp}`);
    }
  }, [value, apply, insert]);

  const backspace = useCallback(() => {
    const [start, end] = getCursor();
    if (start !== end) {
      apply(value.slice(0, start) + value.slice(end), start);
    } else if (start > 0) {
      apply(value.slice(0, start - 1) + value.slice(start), start - 1);
    }
  }, [value, apply]);

  const moveCursor = useCallback((dir: -1 | 1) => {
    const [start] = getCursor();
    const pos = Math.max(0, Math.min(value.length, start + dir));
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }, [value]);

  const actions: KbActions = useMemo(() => ({ insert, insertFn, reciprocal, wrapPower, backspace, moveCursor }), [insert, insertFn, reciprocal, wrapPower, backspace, moveCursor]);

  const preview = useMemo(() => renderPreview(value), [value]);

  const TABS: { id: KbTab; label: string }[] = [
    { id: "123", label: "123" },
    { id: "fx", label: "f(x)" },
    { id: "abc", label: "ABC" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Label */}
      <label style={{ fontFamily: "var(--font-ui)", fontSize: 10, fontWeight: 600, letterSpacing: "0.09em", color: "var(--color-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>{label}</label>

      {/* Input row */}
      <div style={{ display: "flex", gap: 5, alignItems: "stretch" }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13 }}
        />
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            background: open ? "#00d4ff22" : "#0d1220",
            color: open ? "#00d4ff" : "#4f6070",
            border: `1px solid ${open ? "#00d4ff44" : "#1c2538"}`,
            borderRadius: 4,
            padding: "0 10px",
            cursor: "pointer",
            transition: "all 0.15s",
            lineHeight: 1,
          }}
          title="Teclado matemático"
        >⌨</button>
      </div>

      {/* Math preview */}
      {value.trim() && (
        <div style={{
          marginTop: 4,
          padding: "4px 10px",
          background: "#060a12",
          border: "1px solid #131926",
          borderRadius: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          lineHeight: 1.5,
          minHeight: 26,
          color: "var(--color-text-bright)",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}>
          {preview}
        </div>
      )}

      {/* Keyboard panel */}
      {open && (
        <div style={{
          marginTop: 6,
          background: "#0a0f1a",
          border: "1px solid #1c2538",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #1c2538" }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: tab === t.id ? 700 : 400,
                  background: tab === t.id ? "#00d4ff14" : "transparent",
                  color: tab === t.id ? "#00d4ff" : "#4f6070",
                  borderTop: "none",
                  borderRight: "none",
                  borderLeft: "none",
                  borderBottom: tab === t.id ? "2px solid #00d4ff" : "2px solid transparent",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  marginBottom: -1,
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* Keys */}
          <div style={{ padding: 8 }}>
            {tab === "123" && <Keyboard123 a={actions} />}
            {tab === "fx"  && <KeyboardFx  a={actions} />}
            {tab === "abc" && <KeyboardAbc a={actions} />}
          </div>

          {/* Close bar */}
          <div style={{ borderTop: "1px solid #131926", padding: "4px 8px", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setOpen(false)}
              style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "#4f6070", background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.06em" }}
            >cerrar ×</button>
          </div>
        </div>
      )}
    </div>
  );
}
