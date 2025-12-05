import React, { useMemo } from 'react';
import { XIcon } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, content }) => {

    const formattedContent = useMemo(() => {
        if (!content) return '';

        let html = content;

        // Process multiline blocks first (code blocks)
        html = html.replace(/```bash\n([\s\S]*?)```/gim, (_match, p1) => {
            const escapedCode = p1.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<pre class="bg-secondary/50 p-4 rounded-md text-sm overflow-x-auto my-4 text-left"><code>${escapedCode}</code></pre>`;
        });

        const lines = html.split('\n');
        const newLines: string[] = [];
        let inList = false;

        for (const line of lines) {
            // Skip lines that have already been processed into <pre> blocks
            if (line.startsWith('<pre>')) {
                if (inList) { newLines.push('</ul>'); inList = false; }
                newLines.push(line);
                continue;
            }

            let processedLine = line
                .replace(/`([^`]+)`/gim, '<code class="bg-secondary/50 text-primary-foreground px-1 py-0.5 rounded-sm font-mono text-sm">$1</code>')
                .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');

            if (processedLine.startsWith('### ')) {
                if (inList) { newLines.push('</ul>'); inList = false; }
                newLines.push(`<h3 class="text-xl font-semibold mt-4 mb-2">${processedLine.substring(4)}</h3>`);
            } else if (processedLine.startsWith('## ')) {
                if (inList) { newLines.push('</ul>'); inList = false; }
                newLines.push(`<h2 class="text-2xl font-bold mt-5 mb-2 pb-2 border-b border-border">${processedLine.substring(3)}</h2>`);
            } else if (processedLine.startsWith('# ')) {
                if (inList) { newLines.push('</ul>'); inList = false; }
                newLines.push(`<h1 class="text-3xl font-bold mt-6 mb-3">${processedLine.substring(2)}</h1>`);
            } else if (processedLine.startsWith('---')) {
                if (inList) { newLines.push('</ul>'); inList = false; }
                newLines.push('<hr class="my-6 border-border" />');
            } else if (processedLine.startsWith('- ')) {
                if (!inList) { newLines.push('<ul class="list-disc list-inside space-y-2 my-4 text-left">'); inList = true; }
                newLines.push(`<li>${processedLine.substring(2)}</li>`);
            } else {
                if (inList) { newLines.push('</ul>'); inList = false; }
                if (processedLine.trim() !== '') {
                    newLines.push(`<p class="mb-4 text-left">${processedLine}</p>`);
                }
            }
        }

        if (inList) {
            newLines.push('</ul>');
        }

        return newLines.join('');
    }, [content]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
        >
            <div 
                className="bg-card text-card-foreground w-full max-w-4xl h-[90vh] max-h-[800px] rounded-xl shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
                    <h2 id="help-modal-title" className="text-xl font-bold">Guida Utente</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted" aria-label="Chiudi guida">
                        <XIcon className="h-6 w-6" />
                    </button>
                </header>
                <main className="flex-grow overflow-y-auto p-6 text-muted-foreground">
                    <div className="prose" dangerouslySetInnerHTML={{ __html: formattedContent }} />
                </main>
            </div>
        </div>
    );
};