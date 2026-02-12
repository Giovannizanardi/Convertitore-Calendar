import React from 'react';
import { CalendarPlusIcon, Trash2Icon, PencilLineIcon, ArrowRightIcon } from './Icons';

interface DashboardProps {
    setPage: (page: 'import' | 'cleanup' | 'massive-edit') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setPage }) => {
    return (
        <div className="animate-fade-in-down px-4 sm:px-0">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    La tua suite intelligente per il calendario
                </h2>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                    Risparmia tempo e metti ordine nella tua agenda. Scegli se popolare il tuo calendario, fare pulizia o modificare i tuoi appuntamenti in blocco.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {/* Card Importa Eventi */}
                <div 
                    className="group relative bg-card p-8 rounded-2xl border border-border hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 transform hover:-translate-y-2 flex flex-col"
                >
                    <div className="mb-6">
                        <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            <CalendarPlusIcon className="w-7 h-7" />
                        </div>
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-3">
                        Aggiungi Eventi in Blocco
                    </h3>
                    <p className="text-muted-foreground mb-8 flex-grow">
                        Trasforma elenchi di eventi da file o immagini in appuntamenti pronti per essere importati nel tuo Google Calendar.
                    </p>
                    <button 
                        onClick={() => setPage('import')}
                        className="mt-auto inline-flex items-center justify-center space-x-2 text-primary font-bold group/btn"
                    >
                        <span>Inizia a importare</span>
                        <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                    </button>
                </div>

                {/* Card Modifica Massiva */}
                <div 
                    className="group relative bg-card p-8 rounded-2xl border border-border hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 transform hover:-translate-y-2 flex flex-col"
                >
                    <div className="mb-6">
                        <div className="w-14 h-14 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
                            <PencilLineIcon className="w-7 h-7" />
                        </div>
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-3">
                        Modifica Massiva
                    </h3>
                    <p className="text-muted-foreground mb-8 flex-grow">
                        Aggiorna contemporaneamente luogo, descrizione o orari di più eventi esistenti nel tuo calendario con l'aiuto dell'IA.
                    </p>
                    <button 
                        onClick={() => setPage('massive-edit')}
                        className="mt-auto inline-flex items-center justify-center space-x-2 text-indigo-500 font-bold group/btn"
                    >
                        <span>Inizia a modificare</span>
                        <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                    </button>
                </div>

                {/* Card Pulisci Calendario */}
                 <div 
                    className="group relative bg-card p-8 rounded-2xl border border-border hover:border-destructive/50 hover:shadow-2xl hover:shadow-destructive/10 transition-all duration-300 transform hover:-translate-y-2 flex flex-col"
                >
                    <div className="mb-6">
                         <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center">
                            <Trash2Icon className="w-7 h-7" />
                        </div>
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-3">
                        Pulisci Calendario
                    </h3>
                    <p className="text-muted-foreground mb-8 flex-grow">
                        Libera la tua agenda. Trova ed elimina eventi superflui, riunioni ricorrenti obsolete o appuntamenti passati in pochi click.
                    </p>
                    <button 
                        onClick={() => setPage('cleanup')}
                        className="mt-auto inline-flex items-center justify-center space-x-2 text-destructive font-bold group/btn"
                    >
                        <span>Fai pulizia</span>
                        <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                    </button>
                </div>
            </div>
        </div>
    );
};