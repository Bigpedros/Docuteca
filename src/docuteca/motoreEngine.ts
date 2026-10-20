import type {EngineDocumentResult,EnginePageResult,StructuralClass} from '../vendor/motore-ocr-ai/contracts.js';
import {DocutecaAdapter} from '../vendor/motore-ocr-ai/adapters/docuteca.js';
import {TesseractLocalProvider} from '../vendor/motore-ocr-ai/core/ocr/tesseractLocalProvider.js';
import {OcrPageOrchestrator} from '../vendor/motore-ocr-ai/core/ocr/orchestrator.js';
import {detectStructuralRegions} from '../vendor/motore-ocr-ai/core/structure/regionDetector.js';
import {analyzeStructure} from '../vendor/motore-ocr-ai/core/structure/analyzer.js';
import {mergeDocumentPages} from '../vendor/motore-ocr-ai/core/document/multiPageMerge.js';
import type {DocutecaMode} from '../types';
import type {RasterPage} from './rasterize';

export const MOTORE_ENGINE_VERSION='0.5.0-rc.1';
export const MOTORE_SOURCE_COMMIT='fb0d27cbbb288b5b7c7cc63b8cdee6a7d428fd9e';

export interface MotoreAnalysis{
  mode:DocutecaMode;
  structuralClass:string;
  classificationLabel:string;
  confidence:number;
  text:string;
  pageCount:number;
  diagnostics:string[];
  engineVersion:string;
  sourceCommit:string;
}

const provider=new TesseractLocalProvider({
  language:'ita',
  segmentation:'auto',
  dpi:300,
  performanceProfile:'med'
});
const orchestrator=new OcrPageOrchestrator(provider);
const adapter=new DocutecaAdapter();

export async function analyzeWithMotore(
  rasters:RasterPage[],
  signal?:AbortSignal,
  onProgress?:(current:number,total:number,label:string)=>void
):Promise<MotoreAnalysis>{
  if(!rasters.length)throw new Error('Nessuna pagina da analizzare');
  const pages:EnginePageResult[]=[];
  const diagnostics:string[]=[];

  for(const [index,raster] of rasters.entries()){
    signal?.throwIfAborted();
    onProgress?.(index+1,rasters.length,raster.sourceName);
    const session=await orchestrator.start({
      pageNumber:raster.pageNumber,
      width:raster.canvas.width,
      height:raster.canvas.height,
      image:raster.canvas
    },signal);

    const ocr=orchestrator.currentPage(session);
    const regions=detectStructuralRegions(raster.canvas,ocr.tokens);
    const structure=analyzeStructure(ocr,{regions});
    const page:EnginePageResult={
      ocr,
      transform:{
        sourceWidth:ocr.width,
        sourceHeight:ocr.height,
        targetWidth:ocr.width,
        targetHeight:ocr.height,
        scale:1,
        offsetX:0,
        offsetY:0,
        deskewDegrees:ocr.geometryCorrection?.deskewDegrees??0,
        deskewApplied:ocr.geometryCorrection?.deskewApplied??false,
        canonical:'source'
      },
      structure,
      pipeline:{
        normalizedImage:session.normalizedImage,
        rawOcr:session.raw,
        evidence:session.evidence,
        stabilized:session.stabilized
      }
    };
    pages.push(page);
    diagnostics.push(...ocr.warnings.map(w=>`P${ocr.pageNumber}:${w}`));
    diagnostics.push(
      `P${ocr.pageNumber}:ORCHESTRATOR_INITIAL_MS:${Math.round(session.diagnostics.initialMs)}`,
      `P${ocr.pageNumber}:ORCHESTRATOR_STABILIZATION_MS:${Math.round(session.diagnostics.stabilizationMs)}`,
      `P${ocr.pageNumber}:REGIONS:${regions.length}`
    );
  }

  const documentMerge=mergeDocumentPages(pages);
  const result:EngineDocumentResult={
    schemaVersion:'3.0',
    engineVersion:MOTORE_ENGINE_VERSION,
    pages,
    diagnostics:[],
    aiSuggestions:[],
    documentMerge
  };
  const adapted=adapter.adapt(result);
  const confidence=pages.reduce((sum,page)=>sum+page.structure.confidence,0)/pages.length;
  diagnostics.push(
    `DOCUMENT_OVERLAPS:${documentMerge.overlaps.length}`,
    `DOCUMENT_DUPLICATE_LINES:${documentMerge.duplicateLineCount}`
  );

  return{
    mode:adapted.modeSuggestion,
    structuralClass:adapted.structuralClass,
    classificationLabel:labelForClass(pages[0]?.structure.class??'unknown'),
    confidence,
    text:documentMerge.mergedText||adapted.text,
    pageCount:adapted.pageCount,
    diagnostics,
    engineVersion:MOTORE_ENGINE_VERSION,
    sourceCommit:MOTORE_SOURCE_COMMIT
  };
}

function labelForClass(value:StructuralClass):string{
  switch(value){
    case 'blank-form':return'Modulo da compilare';
    case 'filled-form':return'Modulo compilato';
    case 'receipt':return'Ricevuta / scontrino';
    case 'invoice':return'Fattura';
    case 'contract':return'Contratto';
    case 'book-page':return'Pagina di libro';
    case 'letter':return'Lettera';
    case 'generic-document':return'Documento generico';
    default:return'Documento da verificare';
  }
}
