import type { ValidatedEvent } from './types';
import { toYYYYMMDD } from './dateUtils';

// Formatta data e ora per iCalendar (YYYYMMDDTHHmmss) come "floating time"
const formatIcsDateTime = (dateStr: string, timeStr: string): string => {
  const yyyymmdd = toYYYYMMDD(dateStr);
  const [year, month, day] = yyyymmdd.split('-');
  const [hours, minutes] = timeStr.split(':');
  
  // Omette 'Z' per creare un "floating time" che verrà interpretato nel fuso orario locale dell'utente all'importazione.
  return `${year}${month}${day}T${hours}${minutes}00`;
};

// Esegue l'escape del testo per il formato iCalendar
const escapeIcsText = (text: string): string => {
  if (!text) return '';
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
};

export const generateIcsContent = (events: ValidatedEvent[]): string => {
  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ForMa//Event Exporter v1.0//IT',
    'CALSCALE:GREGORIAN',
  ];

  events.forEach(event => {
    // DTSTAMP deve essere in formato UTC
    const dtStamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    const uid = `${dtStamp}-${event.id}@forma-app`;

    cal.push('BEGIN:VEVENT');
    cal.push(`UID:${uid}`);
    cal.push(`DTSTAMP:${dtStamp}`);
    cal.push(`DTSTART:${formatIcsDateTime(event.startDate, event.startTime)}`);
    cal.push(`DTEND:${formatIcsDateTime(event.endDate, event.endTime)}`);
    cal.push(`SUMMARY:${escapeIcsText(event.subject)}`);
    if (event.description) {
      cal.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    if (event.location) {
      cal.push(`LOCATION:${escapeIcsText(event.location)}`);
    }
    cal.push('END:VEVENT');
  });

  cal.push('END:VCALENDAR');

  return cal.join('\r\n');
};