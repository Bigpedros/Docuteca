# Fase 9B — Innesto MOTORE OCR 0.5

Data: 2026-10-20

## Baseline

MOTORE-OCR-AI 0.5.0-rc.1
Commit certificato: fb0d27cbbb288b5b7c7cc63b8cdee6a7d428fd9e

## Obiettivo

Sostituire il boundary euristico della 9A con OCR e struttura reali derivati dal core certificato.

## Percorso implementato

File utente
→ rasterizzazione immagini / PDF
→ TesseractLocalProvider MOTORE
→ photo document scanner
→ orientation / deskew / curvature / dewarp
→ camera cleanup
→ lazy OCR variants / semantic quality gate
→ OcrPageOrchestrator
→ Decision Engine
→ structural region detection
→ analyzeStructure
→ multiPageMerge
→ DocutecaAdapter
→ Archivia / Compila / Revisione

## Provenienza

Il core vendorizzato in src/vendor/motore-ocr-ai è una snapshot read-only della baseline certificata. Docuteca non deve modificarne la semantica: gli adattamenti applicativi vivono in src/docuteca.

## PDF

I PDF vengono rasterizzati nel browser con pdfjs-dist e ogni pagina entra nel MOTORE come pagina autonoma dello stesso documento.

## Stato Recognizer B

La 9B iniziale usa il canale primario Tesseract certificato e tutto il pipeline core. Il canale indipendente OCRS/RTen richiede i tre asset browser:
- recognizer-b/ocrs_wasm.js
- models/text-detection.rten
- models/text-recognition.rten

Non viene simulato: sarà attivato solo quando questi asset sono realmente presenti nel repository/deploy.

## Offline

L'elaborazione avviene nel browser. La baseline Tesseract attuale non forza ancora langPath/corePath self-hosted, quindi il primo caricamento degli asset Tesseract può dipendere dai percorsi standard della libreria. L'hardening self-hosted è separato e non viene mascherato come già risolto.
