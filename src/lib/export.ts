import { slugFilePart } from "@/lib/utils";

export function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\r\n")}`;
}

export function exportFilename(type: string, month: number, year: number, manager?: string, extension = "xlsx") {
  const parts = ["adim", type, `${String(month).padStart(2, "0")}-${year}`];
  if (manager) parts.push(slugFilePart(manager));
  return `${parts.join("-")}.${extension}`;
}
