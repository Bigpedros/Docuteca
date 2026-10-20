# Fase 9C — OCR self-hosted, doppio lettore e certificazione browser

Data: 2026-10-20

## MOTORE

Baseline funzionale iniziale:
fb0d27cbbb288b5b7c7cc63b8cdee6a7d428fd9e

Aggiornamento generico self-host Tesseract:
53be3cf89b6eee5f4e1e1bfcc42ff30689cd822c

La modifica self-host è stata introdotta prima nella pianta madre e ha superato la CI completa MOTORE.

## Doppio lettore

Docuteca usa:
- TesseractLocalProvider
- OcrsWasmRecognizerB
- DualRecognizerOcrProvider

Recognizer B viene servito localmente da:
- /recognizer-b/ocrs_wasm.js
- /recognizer-b/ocrs_wasm_bg.wasm
- /models/text-detection.rten
- /models/text-recognition.rten

Gli asset vengono sincronizzati durante la build da una versione PEI fissata:
9567808dd8d9662014c5e72e80a50bad7d2117a5

## Tesseract self-hosted

Docuteca serve localmente:
- /tesseract/worker.min.js
- /tesseract/core/tesseract-core.wasm.js
- /tesseract/core/tesseract-core-simd.wasm.js
- /tesseract/core/tesseract-core-lstm.wasm.js
- /tesseract/core/tesseract-core-simd-lstm.wasm.js
- /tesseract/lang/ita.traineddata.gz

A runtime il provider usa:
- workerPath=/tesseract/worker.min.js
- corePath=/tesseract/core
- langPath=/tesseract/lang
- workerBlobURL=false

## Certificazione 9C

La CI richiede:
1. npm install
2. typecheck
3. build
4. presenza e non-vacuità di tutti gli asset OCR locali
5. installazione Chromium
6. Playwright smoke test

Lo smoke test:
- apre Docuteca;
- carica una ricevuta immagine;
- avvia Elabora documento;
- attende un risultato di Classificazione MOTORE;
- verifica la versione del motore.

## Deploy

La produzione Netlify attuale resta il vecchio Drop manuale fino al completamento del gate 9C. La nuova build non deve sostituire la produzione prima del verde completo.
