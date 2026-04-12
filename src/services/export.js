import * as XLSX from 'xlsx';

// ─── Export Excel ─────────────────────────────────────

export function exportToExcel(data, sheetName, filename) {
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-width des colonnes
  const colWidths = Object.keys(data[0] || {}).map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportMultiSheet(sheets, filename) {
  const wb = XLSX.utils.book_new();
  for (const { data, name } of sheets) {
    if (!data || data.length === 0) continue;
    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0]).map(key => {
      const maxLen = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, filename);
}

// ─── Import Excel/CSV ─────────────────────────────────

export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
        resolve({ data: jsonData, headers, sheetNames: workbook.SheetNames });
      } catch (err) {
        reject(new Error('Impossible de lire ce fichier. Vérifiez le format.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsArrayBuffer(file);
  });
}

// Valide un email
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Détecte les doublons par email
export function findDuplicates(newRows, existingEmails) {
  const seen = new Set(existingEmails.map(e => e.toLowerCase()));
  const duplicates = [];
  const unique = [];

  for (const row of newRows) {
    const email = (row.email || '').toLowerCase();
    if (!email) {
      unique.push(row);
      continue;
    }
    if (seen.has(email)) {
      duplicates.push(row);
    } else {
      seen.add(email);
      unique.push(row);
    }
  }

  return { unique, duplicates };
}
