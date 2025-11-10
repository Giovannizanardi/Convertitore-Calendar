// Converte AAAA-MM-GG in GG-MM-AAAA
export const toDDMMYYYY = (dateString: string): string => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString; // Restituisce l'originale se il formato non è quello previsto
    }
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
};

// Converte GG-MM-AAAA in AAAA-MM-GG
export const toYYYYMMDD = (dateString: string): string => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
        return dateString; // Restituisce l'originale se il formato non è quello previsto
    }
    const [day, month, year] = dateString.split('-');
    return `${year}-${month}-${day}`;
};
