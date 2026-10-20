# Fase 9A — Ricostruzione sorgente Docuteca

Riferimento visuale: screenshot forniti dall'utente della Docuteca pubblicata su Netlify Drop.
Riferimento deploy: 6ac2cd2e49bf23781a01b49c.

## Ricostruito
- sidebar scura con Home / Classificazione / Revisione / Impostazioni
- home di acquisizione con drop-zone
- anteprima file
- fase Elabora documento
- suggerimento Archivia / Compila / Revisione
- archivio classificato
- coda di revisione
- impostazioni privacy / scanner desktop / MOTORE
- storage locale
- Vite + React + TypeScript
- configurazione Netlify
- baseline MOTORE OCR 0.5 fissata a fb0d27cbbb288b5b7c7cc63b8cdee6a7d428fd9e

## Limite 9A
La UI e il flusso sono ricostruiti a livello sorgente. L'OCR reale viene innestato nella 9B: in 9A la classificazione è un boundary temporaneo e non viene presentata come OCR certificato.
