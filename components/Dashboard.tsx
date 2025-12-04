import React from 'react';
import { CalendarPlusIcon, Trash2Icon, ArrowRightIcon } from './Icons';

interface DashboardProps {
    setPage: (page: 'import' | 'cleanup') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setPage }) => {
    return (
        <div className="animate-fade-in-down">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    La tua suite intelligente per il calendario
                </h2>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                    Risparmia tempo e metti ordine nella tua agenda. Scegli se popolare il tuo calendario importando eventi o se fare pulizia eliminando quelli superflui.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Card Importa Eventi */}
                <div 
                    className="group relative bg-card p-8 rounded-xl border border-border hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 transform hover:-translate-y-2 flex flex-col"
                >
                    <div className="mb-6">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                            <CalendarPlusIcon className="w-8 h-8" />
                        </div>
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-3">
                        Aggiungi Eventi in Blocco
                    </h3>
                    <p className="text-muted-foreground mb-6 flex-grow">
                        Trasforma elenchi di eventi da file di testo, Word, Excel o immagini in appuntamenti pronti per essere importati nel tuo Google Calendar.
                    </p>
                    <button 
                        onClick={() => setPage('import')}
                        className="mt-auto inline-flex items-center justify-center space-x-2 text-primary font-semibold group"
                        aria-label="Vai a importa eventi"
                    >
                        <span>Inizia a importare</span>
                        <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </div>

                {/* Card Pulisci Calendario */}
                 <div 
                    className="group relative bg-card p-8 rounded-xl border border-border hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 transform hover:-translate-y-2 flex flex-col"
                >
                    <div className="mb-6">
                         <div className="w-16 h-16 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                            <Trash2Icon className="w-8 h-8" />
                        </div>
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-3">
                        Pulisci Calendario
                    </h3>
                    <p className="text-muted-foreground mb-6 flex-grow">
                        Libera la tua agenda. Trova ed elimina eventi superflui, riunioni ricorrenti obsolete o appuntamenti passati in pochi click, anche con l'aiuto dell'IA.
                    </p>
                    <button 
                        onClick={() => setPage('cleanup')}
                        className="mt-auto inline-flex items-center justify-center space-x-2 text-primary font-semibold group"
                        aria-label="Vai a pulisci calendario"
                    >
                        <span>Fai pulizia</span>
                        <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </div>
            </div>
        </div>
    );
};
