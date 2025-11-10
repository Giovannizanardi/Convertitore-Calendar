import type { ValidatedEvent } from './types';
import { toYYYYMMDD } from './dateUtils';

// Le intestazioni CSV sono in inglese per garantire la compatibilità con la funzione di importazione di Google Calendar.
const CSV_HEADERS = [
  'Subject',
  'Start Date',
  'Start Time',
  'End Date',
  'End Time',
  'Description',
  'Location',
];

// Funzione per l'escape di una stringa per CSV
const escapeCsvField = (field: string): string => {
  if (field === null || field === undefined) {
    return '';
  }
  const stringField = String(field);
  // If the field contains a comma, double quote, or newline, wrap it in double quotes.
  if (/[",\r\n]/.test(stringField)) {
    // Also, double up any existing double quotes.
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

// Funzione per convertire AAAA-MM-GG in MM/GG/AAAA per Google Calendar
const formatDateForGoogle = (dateString: string): string => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString; // Return original if format is unexpected
    }
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
};


export const generateCsvContent = (events: ValidatedEvent[]): string => {
  const headerRow = CSV_HEADERS.join(',');
  
  const eventRows = events.map(event => {
    const row = [
      escapeCsvField(event.subject),
      formatDateForGoogle(toYYYYMMDD(event.startDate)),
      escapeCsvField(event.startTime),
      formatDateForGoogle(toYYYYMMDD(event.endDate)),
      escapeCsvField(event.endTime),
      escapeCsvField(event.description),
      escapeCsvField(event.location),
    ];
    return row.join(',');
  });

  return [headerRow, ...eventRows].join('\n');
};