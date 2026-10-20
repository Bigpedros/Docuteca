import type {EnginePageResult,StructuralClass} from '../../contracts.js';

export interface DocumentClassification{
  class:StructuralClass;
  confidence:number;
  pageClasses:Array<{pageNumber:number;class:StructuralClass;confidence:number}>;
}

export function classifyDocumentPages(pages:EnginePageResult[]):DocumentClassification{
  if(!pages.length)return{class:'unknown',confidence:0,pageClasses:[]};
  const joined=pages.map(page=>page.ocr.text).join('\n').toUpperCase();
  const medicalSignals=[/CARTELLA\s+CLINICA/,/PRONTO\s+SOCCORSO/,/PAZIENTE:/,/ANAMNESI/,/TRIAGE/,/TERAPIA\s+DOMICILIARE/,/CODICE\s+ACCESSO/].filter(pattern=>pattern.test(joined)).length;
  if(pages.length>=2&&medicalSignals>=3){
    return{
      class:'generic-document',confidence:Math.min(.96,.82+medicalSignals*.02),
      pageClasses:pages.map(page=>({pageNumber:page.ocr.pageNumber,class:medicalPageClass(page),confidence:Math.max(page.structure.confidence,.78)}))
    };
  }
  const scores=new Map<StructuralClass,number>();
  for(const page of pages){
    const tokenWeight=Math.min(1.6,.65+page.ocr.tokens.length/300);
    const contribution=page.structure.confidence*tokenWeight;
    scores.set(page.structure.class,(scores.get(page.structure.class)??0)+contribution);
  }
  const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]);
  const [winner,winnerScore]=ranked[0]??(['unknown',0] as const);
  const total=[...scores.values()].reduce((sum,value)=>sum+value,0)||1;
  const matching=pages.filter(page=>page.structure.class===winner);
  const local=matching.length?matching.reduce((sum,page)=>sum+page.structure.confidence,0)/matching.length:0;
  return{
    class:winner,
    confidence:Math.max(0,Math.min(.99,(winnerScore/total)*.55+local*.45)),
    pageClasses:pages.map(page=>({pageNumber:page.ocr.pageNumber,class:page.structure.class,confidence:page.structure.confidence}))
  };
}


function medicalPageClass(page:EnginePageResult):StructuralClass{
  const text=page.ocr.text.toUpperCase();
  if(/(?:PAZIENTE:|CODICE\s+FISCALE|DATA\s+DI\s+NASCITA|TRIAGE|ANAMNESI|TERAPIA|VISITA\s+MEDICA)/.test(text))return'filled-form';
  return'generic-document';
}
