import type { Iteration } from "./methods";

/**
 * Exports iteration rows as a UTF-8 CSV with BOM for universal Excel/Sheets compatibility.
 */
export function exportTableToCSV(iterations: Iteration[], filename = "NumLab_Resultados.csv") {
  if (!iterations || !iterations.length) return;

  const cols = Array.from(new Set(iterations.flatMap(it => Object.keys(it))));

  const escapeCSV = (val: unknown): string => {
    if (val === undefined || val === null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = cols.map(escapeCSV).join(",");
  const dataRows = iterations.map(row => cols.map(c => escapeCSV(row[c])).join(","));
  const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies the iteration table to the clipboard as TSV (tab-separated values)
 * which pastes directly into cells in Excel, Google Sheets, or Numbers.
 */
export async function copyTableToClipboard(iterations: Iteration[]): Promise<boolean> {
  if (!iterations || !iterations.length) return false;

  const cols = Array.from(new Set(iterations.flatMap(it => Object.keys(it))));
  const headerRow = cols.join("\t");
  const dataRows = iterations.map(row => cols.map(c => (row[c] === undefined ? "" : String(row[c]))).join("\t"));
  const tsvContent = [headerRow, ...dataRows].join("\n");

  try {
    await navigator.clipboard.writeText(tsvContent);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies the iteration table formatted as LaTeX code (\begin{tabular}).
 */
export async function copyTableToLatex(iterations: Iteration[]): Promise<boolean> {
  if (!iterations || !iterations.length) return false;

  const cols = Array.from(new Set(iterations.flatMap(it => Object.keys(it))));
  const align = `|${cols.map(() => "c").join("|")}|`;
  const header = cols.map(c => `\\textbf{${c}}`).join(" & ") + " \\\\ \\hline";
  const rows = iterations
    .map(row => cols.map(c => (row[c] === undefined ? "—" : String(row[c]))).join(" & ") + " \\\\")
    .join("\n");

  const latex = [
    "\\begin{table}[htbp]",
    "  \\centering",
    `  \\begin{tabular}{${align}}`,
    "    \\hline",
    `    ${header}`,
    rows,
    "    \\hline",
    "  \\end{tabular}",
    "  \\caption{Tabla de iteraciones}",
    "\\end{table}",
  ].join("\n");

  try {
    await navigator.clipboard.writeText(latex);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exports an SVG chart from a DOM container to a high-resolution PNG file.
 */
export function exportChartToPng(
  container: HTMLElement | null,
  filename = "NumLab_Grafica.png",
  bgColor = "#0b101b"
) {
  if (!container) return;

  const svg = container.querySelector("svg");
  if (!svg) return;

  const svgRect = svg.getBoundingClientRect();
  const width = svgRect.width || 600;
  const height = svgRect.height || 360;
  const scale = 2; // 2x scale for Retina sharpness

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const URLObj = window.URL || window.webkitURL || window;
  const blobURL = URLObj.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw scaled chart
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Add subtle watermark
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.textAlign = "right";
    ctx.fillText("NumLab", canvas.width - 24, canvas.height - 20);

    URLObj.revokeObjectURL(blobURL);

    // Download PNG
    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  img.src = blobURL;
}

