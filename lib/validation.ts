import type { EventObject, ValidatedEvent, ValidationErrors } from './types';
import { toYYYYMMDD } from './dateUtils';

function isValidDateString(dateString: string): boolean {
  if (!dateString) return false;
  // GG-MM-AAAA
  if (!/^\d{2}-\d{2}-\d{4}$/.test(dateString)) return false;

  const [day, month, year] = dateString.split('-').map(Number);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

  // Il mese è a base 0 nel costruttore Date di JavaScript
  const d = new Date(year, month - 1, day);

  // Il controllo principale: se i componenti della data creata corrispondono all'input, è una data valida.
  // Questo gestisce in modo intelligente date non valide come il 30 febbraio.
  return (
      d.getFullYear() === year &&
      d.getMonth() === month - 1 &&
      d.getDate() === day
  );
}


function isValidTimeString(timeString: string): boolean {
    if (!timeString) return false;
    // HH:mm
    if(!/^\d{2}:\d{2}$/.test(timeString)) return false;
    const [hours, minutes] = timeString.split(':').map(Number);
    if(isNaN(hours) || isNaN(minutes)) return false;
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}


export const validateEvent = (event: EventObject): ValidatedEvent => {
    const errors: ValidationErrors = {};
    if (!event.subject?.trim()) {
        errors.subject = "L'oggetto è obbligatorio.";
    }

    if (!isValidDateString(event.startDate)) {
        errors.startDate = "Formato non valido. Usa GG-MM-AAAA.";
    }

    if (!isValidTimeString(event.startTime)) {
        errors.startTime = "Formato non valido. Usa HH:mm.";
    }

    if (!isValidDateString(event.endDate)) {
        errors.endDate = "Formato non valido. Usa GG-MM-AAAA.";
    }

    if (!isValidTimeString(event.endTime)) {
        errors.endTime = "Formato non valido. Usa HH:mm.";
    }

    // Controlla se la data/ora di fine è precedente alla data/ora di inizio
    if (isValidDateString(event.startDate) && isValidTimeString(event.startTime) && isValidDateString(event.endDate) && isValidTimeString(event.endTime)) {
        const startDateTime = new Date(`${toYYYYMMDD(event.startDate)}T${event.startTime}`);
        const endDateTime = new Date(`${toYYYYMMDD(event.endDate)}T${event.endTime}`);
        if(endDateTime < startDateTime) {
            errors.endDate = "La data di fine non può precedere la data di inizio.";
            errors.endTime = "L'orario di fine non può precedere l'orario di inizio.";
        }
    }

    return {
        ...event,
        errors,
        isValid: Object.keys(errors).length === 0,
    };
};

export const validateEvents = (events: EventObject[]): ValidatedEvent[] => {
    return events.map(validateEvent);
}