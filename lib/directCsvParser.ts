import * as XLSX from 'xlsx';
import type { EventObject } from './types';
import { toDDMMYYYY } from './dateUtils';

export interface ParseCsvResult {
  events: EventObject[];
  warnings: string[];
}

/**
 * Normalizes date string into DD-MM-YYYY format
 */
export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  
  // Format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}-${month}-${year}`;
  }

  // Format: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const itMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (itMatch) {
    const day = itMatch[1].padStart(2, '0');
    const month = itMatch[2].padStart(2, '0');
    let year = itMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${day}-${month}-${year}`;
  }

  return toDDMMYYYY(trimmed);
}

/**
 * Normalizes time string into HH:mm format
 */
export function normalizeTime(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Match HH:mm:ss or HH:mm or HH.mm or HH
  const timeMatch = trimmed.match(/^(\d{1,2})[:.](\d{1,2})(?:[:.]\d{1,2})?$/);
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0');
    const minutes = timeMatch[2].padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const hourOnlyMatch = trimmed.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) {
    const hours = hourOnlyMatch[1].padStart(2, '0');
    return `${hours}:00`;
  }

  return trimmed;
}

/**
 * Adds 1 hour to a given HH:mm time
 */
export function addOneHour(timeStr: string): string {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const nextHour = (hours + 1) % 24;
  return `${String(nextHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Robust CSV parser that handles quotes, escaped quotes, multiline values, and separators (, ; \t)
 */
export function parseCsvRows(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, ''); // Strip BOM
  if (!cleanText.trim()) return [];

  // Determine separator if not obvious
  // Sample the first line
  const firstLine = cleanText.split(/\r\n|\r|\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let separator = ',';
  if (semiCount > commaCount && semiCount > tabCount) {
    separator = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    separator = '\t';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === separator) {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push any trailing field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes a header label for matching
 */
function cleanHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parses raw CSV string formatted as:
 * Oggetto, Data Inizio, Ora Inizio, Data Fine, Ora Fine, Luogo, Docente
 */
export function parseDirectCsv(csvText: string): ParseCsvResult {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return { events: [], warnings: ['Il file o il testo fornito è vuoto.'] };
  }

  const warnings: string[] = [];
  let startIndex = 0;

  // Check if first row is a header
  const headerRow = rows[0];
  let colIndices = {
    subject: 0,
    startDate: 1,
    startTime: 2,
    endDate: 3,
    endTime: 4,
    location: 5,
    docente: 6,
  };

  if (headerRow && headerRow.length >= 2) {
    const cleanedHeaders = headerRow.map(cleanHeader);
    
    // Check if any recognized header words exist
    const hasSubject = cleanedHeaders.some(h => ['oggetto', 'titolo', 'subject', 'nome', 'evento', 'materia'].includes(h));
    const hasDate = cleanedHeaders.some(h => ['datainizio', 'datadiinizio', 'startdate', 'data'].includes(h));

    if (hasSubject || hasDate) {
      startIndex = 1;

      // Map columns based on identified headers
      cleanedHeaders.forEach((h, idx) => {
        if (['oggetto', 'titolo', 'subject', 'nome', 'evento', 'materia'].includes(h)) {
          colIndices.subject = idx;
        } else if (['datainizio', 'datadiinizio', 'startdate', 'data'].includes(h)) {
          colIndices.startDate = idx;
        } else if (['orainizio', 'oradiinizio', 'starttime', 'ora', 'dalle'].includes(h)) {
          colIndices.startTime = idx;
        } else if (['datafine', 'datadifine', 'enddate'].includes(h)) {
          colIndices.endDate = idx;
        } else if (['orafine', 'oradifine', 'endtime', 'alle'].includes(h)) {
          colIndices.endTime = idx;
        } else if (['luogo', 'sede', 'aula', 'location', 'posto', 'indirizzo'].includes(h)) {
          colIndices.location = idx;
        } else if (['docente', 'insegnante', 'professore', 'formatore', 'descrizione', 'description', 'note'].includes(h)) {
          colIndices.docente = idx;
        }
      });
    }
  }

  const events: EventObject[] = [];

  for (let r = startIndex; r < rows.length; r++) {
    const row = rows[r];
    // Skip completely empty rows
    if (!row || row.every(val => !val.trim())) continue;

    const rawSubject = row[colIndices.subject] || row[0] || '';
    const rawStartDate = row[colIndices.startDate] || row[1] || '';
    const rawStartTime = row[colIndices.startTime] || row[2] || '';
    const rawEndDate = row[colIndices.endDate] || row[3] || '';
    const rawEndTime = row[colIndices.endTime] || row[4] || '';
    const rawLocation = row[colIndices.location] || row[5] || '';
    const rawDocente = row[colIndices.docente] || row[6] || '';

    if (!rawSubject.trim() && !rawStartDate.trim()) {
      continue;
    }

    const normStartDate = normalizeDate(rawStartDate);
    const normStartTime = normalizeTime(rawStartTime);
    const normEndDate = normalizeDate(rawEndDate) || normStartDate;
    let normEndTime = normalizeTime(rawEndTime);
    if (!normEndTime && normStartTime) {
      normEndTime = addOneHour(normStartTime);
    }

    events.push({
      id: events.length,
      subject: rawSubject.trim(),
      startDate: normStartDate,
      startTime: normStartTime,
      endDate: normEndDate,
      endTime: normEndTime,
      location: rawLocation.trim(),
      description: rawDocente.trim(),
    });
  }

  if (events.length === 0) {
    warnings.push('Nessun evento valido trovato nel file.');
  }

  return { events, warnings };
}

/**
 * Parses direct CSV from File object (supports .csv, .txt, .xlsx, .xls)
 */
export async function parseDirectCsvFile(file: File): Promise<ParseCsvResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          if (!data) throw new Error('Impossibile leggere il file Excel.');
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) throw new Error('Nessun foglio trovato nel file Excel.');
          const worksheet = workbook.Sheets[sheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          resolve(parseDirectCsv(csvText));
        } catch (e: any) {
          reject(e);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  // Text or CSV file
  const text = await file.text();
  return parseDirectCsv(text);
}

/**
 * Generates an example CSV template for download
 */
export function generateExampleCsvTemplate(): string {
  return [
    'Oggetto,Data Inizio,Ora Inizio,Data Fine,Ora Fine,Luogo,Docente',
    'Corso Sicurezza sul Lavoro,15-09-2026,09:00,15-09-2026,13:00,Aula Magna,Ing. Marco Neri',
    'Laboratorio Meccanica,16-09-2026,08:30,16-09-2026,12:30,Laboratorio 2,Prof. Roberto Riva',
    'Informatica e Sistemi,17-09-2026,14:00,17-09-2026,17:00,Aula Informatica 1,Prof.ssa Elena Bellini'
  ].join('\r\n');
}
