import { exportToExcel } from '../../services/export';

export default function ExportButton({ data, columns, sheetName, filename, label }) {
  const handleExport = () => {
    if (!data || data.length === 0) return;

    // Map data to readable column names
    const exportData = data.map(row => {
      const obj = {};
      for (const col of columns) {
        obj[col.label] = typeof col.exportValue === 'function'
          ? col.exportValue(row)
          : row[col.key] ?? '';
      }
      return obj;
    });

    const date = new Date().toISOString().slice(0, 10);
    exportToExcel(exportData, sheetName || 'Donn\u00e9es', filename || `export-IR-${date}.xlsx`);
  };

  return (
    <button className="btn btn-outline" onClick={handleExport} disabled={!data?.length}>
      {'\u{1F4E5}'} {label || 'Exporter Excel'}
    </button>
  );
}
