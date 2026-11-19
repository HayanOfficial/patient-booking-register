const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'reference', 'Surgical_Procedures_List.xlsx');
const wb = XLSX.readFile(filePath);

console.log('Sheets found:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n=== Sheet: ${sheetName} ===`);
  rows.slice(0, 30).forEach((row, i) => console.log(`  Row ${i}:`, JSON.stringify(row)));
  if (rows.length > 30) console.log(`  ... and ${rows.length - 30} more rows`);
});
