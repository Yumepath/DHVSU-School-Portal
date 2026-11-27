export function csvText(rows: (string | number | boolean | null)[][]): string {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const safe = typeof value === 'string' && /^[\s]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, rows: (string | number | boolean | null)[][]): void {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csvText(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
