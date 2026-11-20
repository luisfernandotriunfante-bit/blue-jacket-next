import * as XLSX from 'xlsx'

export function textFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' })
}

export function sparseRow(map: Record<number, unknown>, length: number): unknown[] {
  const row = new Array(length).fill('')
  for (const [index, value] of Object.entries(map)) row[Number(index)] = value
  return row
}

export function xlsxFile(name: string, sheets: Record<string, unknown[][]>): File {
  const book = XLSX.utils.book_new()
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheetName)
  }
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new File([buffer], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
