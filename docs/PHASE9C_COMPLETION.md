# Fase 9C — Completion checkpoint

Data: 2026-10-20
Stato: COMPLETATA / CERTIFICATA

## Docuteca certified HEAD

2cdfa9ee6daef4f5448f1fd836c310abe138f9e0

GitHub Actions:
- run: 39476393710
- run number: 61
- result: success

Passed:
- npm install
- typecheck
- production build
- self-hosted OCR asset verification
- Chromium install
- browser E2E OCR smoke test on real PNG
- Netlify dist artifact upload

## MOTORE

Generic self-host Tesseract support landed first in MOTORE:
53be3cf89b6eee5f4e1e1bfcc42ff30689cd822c

MOTORE CI run 628: success.

Docuteca uses:
- TesseractLocalProvider
- OcrsWasmRecognizerB
- DualRecognizerOcrProvider
- OcrPageOrchestrator
- Decision Engine
- structural analysis
- multipage merge
- DocutecaAdapter

## Self-hosted Recognizer B

Build copies pinned assets from PEI-Facile-2 commit:
9567808dd8d9662014c5e72e80a50bad7d2117a5

Served locally by Docuteca:
- /recognizer-b/ocrs_wasm.js
- /recognizer-b/ocrs_wasm_bg.wasm
- /models/text-detection.rten
- /models/text-recognition.rten

## Self-hosted Tesseract 7

Build copies every tesseract-core*.wasm.js variant from installed tesseract.js-core, including relaxedsimd, plus:
- /tesseract/worker.min.js
- /tesseract/lang/ita.traineddata.gz

Runtime configuration:
- workerPath=/tesseract/worker.min.js
- corePath=/tesseract/core
- langPath=/tesseract/lang
- workerBlobURL=false

## E2E

The browser smoke test:
1. generates a real PNG receipt;
2. uploads it through the Docuteca UI;
3. clicks Elabora documento;
4. executes the real OCR pipeline;
5. waits for Classificazione MOTORE;
6. verifies the MOTORE 0.5 result is visible.

## Netlify artifact

Artifact name:
docuteca-netlify-dist

Artifact ID:
12289468082

Size:
29,505,656 bytes

Digest:
sha256:8f2856c92a1c01bcba0a5dc447738549f6462e0311efbfabdcfa1f07b5bbfd41

Expires:
2027-01-18

## Production deploy

The existing production site docuteca.netlify.app is still the previous manual Drop.

This environment has authenticated Netlify read/project access, but the available connector does not expose deploy creation/upload and no NETLIFY_AUTH_TOKEN is present in the runtime. Therefore production was deliberately NOT overwritten automatically.

The certified artifact above is the exact build to publish to the existing Netlify site, or the repository can be connected to Netlify Git continuous deployment.
