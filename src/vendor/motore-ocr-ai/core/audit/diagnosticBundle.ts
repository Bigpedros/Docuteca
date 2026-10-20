import type {EnginePageResult} from '../../contracts.js';

export interface DiagnosticArtifact{
  name:string;
  mediaType:'application/json';
  stage:string;
  payload:Record<string,unknown>;
}
export interface PageDiagnosticBundle{
  pageNumber:number;
  sourceHash:string|null;
  artifacts:DiagnosticArtifact[];
}

export function buildDiagnosticBundle(page:EnginePageResult,sourceHash?:string):PageDiagnosticBundle{
  const no=String(page.ocr.pageNumber).padStart(3,'0');
  const artifacts:DiagnosticArtifact[]=[
    artifact(`page_${no}/00_original.json`,'original',{
      sourceHash:sourceHash??null,
      readOnly:true,
      width:page.ocr.photoScan?.sourceWidth??page.ocr.width,
      height:page.ocr.photoScan?.sourceHeight??page.ocr.height
    }),
    artifact(`page_${no}/05_quality.json`,'quality-gate',{quality:page.ocr.quality??null}),
    artifact(`page_${no}/10_edges.json`,'page-detection',{corners:page.ocr.photoScan?.corners??null,confidence:page.ocr.photoScan?.confidence??null}),
    artifact(`page_${no}/20_perspective.json`,'perspective',{photoScan:page.ocr.photoScan??null}),
    artifact(`page_${no}/30_dewarp.json`,'geometry',{geometryCorrection:page.ocr.geometryCorrection??null}),
    artifact(`page_${no}/40_normalized.json`,'normalization',{transform:page.transform}),
    artifact(`page_${no}/45_variants.json`,'preprocessing',{variants:page.ocr.warnings.filter(w=>w.startsWith('OCR_GC_')||w.startsWith('OCR_CONSENSUS_')),warnings:page.ocr.warnings.filter(w=>w.startsWith('QUALITY:'))}),
    artifact(`page_${no}/50_layout.json`,'layout',{
      class:page.structure.class,confidence:page.structure.confidence,
      readingOrder:page.structure.readingOrder??[],
      regions:page.structure.regions,
      fields:page.structure.fields
    }),
    artifact(`page_${no}/55_text_hierarchy.json`,'text-detection',{
      lines:page.ocr.lines??[],blocks:page.ocr.blocks??[]
    }),
    artifact(`page_${no}/60_ocr_raw.json`,'ocr-raw',{
      fingerprint:page.pipeline?.rawOcr.fingerprint??null,
      text:page.pipeline?.rawOcr.text??page.ocr.text,
      tokens:(page.pipeline?.rawOcr.tokens??page.ocr.tokens).map(token=>({
        id:token.id,text:token.text,confidence:token.confidence,box:token.box,lineId:token.lineId,
        provenance:token.provenance,characters:token.characters??[],alternatives:token.alternatives??[]
      }))
    }),
    artifact(`page_${no}/62_ocr_evidence_decisions.json`,'ocr-decision',{
      evidenceCount:page.pipeline?.stabilizedOcr.evidenceCount??0,
      observationCount:page.pipeline?.stabilizedOcr.observationCount??0,
      decisions:page.pipeline?.stabilizedOcr.decisions??[]
    }),
    artifact(`page_${no}/65_ocr_stabilized.json`,'ocr-stabilized',{
      text:page.pipeline?.stabilizedOcr.page.text??page.ocr.text,
      tokens:(page.pipeline?.stabilizedOcr.page.tokens??page.ocr.tokens).map(token=>({
        id:token.id,text:token.text,raw:token.rawText??token.text,confidence:token.confidence,
        box:token.box,lineId:token.lineId,reason:token.correctionReason??null
      }))
    }),
    artifact(`page_${no}/68_structured_document.json`,'structured-document',{
      checkpoint:page.pipeline?.structuredDocument??null
    }),
    artifact(`page_${no}/70_validation.json`,'validation',{
      checkpoint:page.pipeline?.validation??null,
      validations:page.validations??[]
    }),
    artifact(`page_${no}/75_confidence.json`,'confidence',{confidence:page.confidence??null}),
    artifact(`page_${no}/80_final.json`,'final',{
      text:page.ocr.text,needsReview:page.confidence?.needsReview??true,
      class:page.confidence?.class??'red'
    })
  ];
  return{pageNumber:page.ocr.pageNumber,sourceHash:sourceHash??null,artifacts};
}
function artifact(name:string,stage:string,payload:Record<string,unknown>):DiagnosticArtifact{
  return{name,mediaType:'application/json',stage,payload};
}
