import type {Box,EngineDocumentResult,OcrToken} from '../../contracts.js';
import {structuredDocumentForPage} from '../structure/structuredDocument.js';

export type ReconstructionStatus='reliable'|'uncertain'|'error'|'unreadable'|'user-confirmed';
export type ReconstructionSource='native-pdf'|'ocr'|'ai-suggestion'|'user-confirmed';

export interface ReconstructionElement{
  id:string;
  pageNumber:number;
  lineId:string;
  box:Box;
  originalText:string;
  rawText:string;
  normalizedText:string;
  correctedText:string|null;
  text:string;
  confidence:number|null;
  status:ReconstructionStatus;
  editable:boolean;
  source:ReconstructionSource;
  suggestedText?:string;
  reason?:string;
}

export interface ReconstructionVisualObject{
  id:string;
  kind:'signature'|'stamp'|'image';
  box:Box;
  confidence:number;
}
export interface ReconstructionLineSegment{
  id:string;
  box:Box;
  elementIds:string[];
  alignment:'left'|'center'|'right';
}
export interface ReconstructionLine{
  id:string;
  box:Box;
  baselineY:number;
  fontSize:number;
  segments:ReconstructionLineSegment[];
}
export interface ReconstructionPage{
  pageNumber:number;
  width:number;
  height:number;
  renderMode:'native-text'|'digital-structured';
  visualObjects:ReconstructionVisualObject[];
  elements:ReconstructionElement[];
  lines:ReconstructionLine[];
}

export interface DigitalReconstruction{
  schemaVersion:'1.0';
  engineVersion:string;
  pages:ReconstructionPage[];
  corrections:Array<{
    elementId:string;
    pageNumber:number;
    originalText:string;
    confirmedText:string;
    changed:boolean;
    confirmedAt:string;
  }>;
}

export interface ReconstructionReviewSuggestion{
  tokenId:string;
  status:'uncertain'|'error'|'unreadable';
  suggestedText?:string;
  reason?:string;
}

export function buildDigitalReconstruction(result:EngineDocumentResult):DigitalReconstruction{
  return{
    schemaVersion:'1.0',
    engineVersion:result.engineVersion,
    pages:result.pages.map(page=>{
      const structured=structuredDocumentForPage(page);
      const elements=structured.tokens.map(token=>fromToken(structured.pageNumber,token,structured.nativePdfVerified,structured.warnings));
      return{
        pageNumber:structured.pageNumber,
        width:structured.width,
        height:structured.height,
        renderMode:structured.nativePdfVerified?'native-text':'digital-structured',
        visualObjects:structured.regions
          .filter(region=>region.kind==='signature'||region.kind==='stamp'||region.kind==='image')
          .map(region=>({id:region.id,kind:region.kind as 'signature'|'stamp'|'image',box:{...region.box},confidence:region.confidence})),
        elements,
        lines:buildLineLayout(structured.lines,elements,structured.width,structured.height)
      };
    }),
    corrections:[]
  };
}

export function applyReconstructionReview(
  reconstruction:DigitalReconstruction,
  pageNumber:number,
  suggestions:ReconstructionReviewSuggestion[]
):DigitalReconstruction{
  if(!suggestions.length)return reconstruction;
  const byId=new Map(suggestions.map(item=>[item.tokenId,item]));
  return{
    ...reconstruction,
    pages:reconstruction.pages.map(page=>page.pageNumber!==pageNumber?page:{
      ...page,
      elements:page.elements.map(element=>{
        const suggestion=byId.get(element.id);
        if(!suggestion||element.status==='user-confirmed')return element;
        return{
          ...element,
          status:suggestion.status,
          editable:true,
          source:'ai-suggestion',
          ...(suggestion.suggestedText?{suggestedText:suggestion.suggestedText}:{}),
          ...(suggestion.reason?{reason:suggestion.reason}:{})
        };
      })
    })
  };
}

export function confirmReconstructionElement(
  reconstruction:DigitalReconstruction,
  elementId:string,
  confirmedText?:string,
  confirmedAt=new Date().toISOString()
):DigitalReconstruction{
  let correction:DigitalReconstruction['corrections'][number]|undefined;
  const pages=reconstruction.pages.map(page=>({
    ...page,
    elements:page.elements.map(element=>{
      if(element.id!==elementId)return element;
      if(!element.editable&&element.status!=='user-confirmed')throw new Error('Elemento affidabile: modifica non consentita.');
      const nextText=(confirmedText??element.text).trim();
      if(!nextText)throw new Error('La correzione non può essere vuota.');
      correction={
        elementId:element.id,
        pageNumber:element.pageNumber,
        originalText:element.originalText,
        confirmedText:nextText,
        changed:nextText!==element.originalText,
        confirmedAt
      };
      return{
        ...element,
        text:nextText,
        correctedText:nextText,
        status:'user-confirmed' as const,
        editable:false,
        source:'user-confirmed' as const,
        suggestedText:undefined,
        reason:undefined
      };
    })
  }));
  if(!correction)throw new Error('Elemento di ricostruzione non trovato.');
  const previous=reconstruction.corrections.filter(item=>item.elementId!==elementId);
  return{...reconstruction,pages,corrections:[...previous,correction]};
}

export function getReconstructedText(reconstruction:DigitalReconstruction,pageNumber:number):string{
  const page=reconstruction.pages.find(item=>item.pageNumber===pageNumber);
  if(!page)return'';
  const byId=new Map(page.elements.map(element=>[element.id,element]));
  return page.lines
    .sort((a,b)=>a.box.y-b.box.y)
    .map(line=>line.segments
      .sort((a,b)=>a.box.x-b.box.x)
      .map(segment=>segment.elementIds.map(id=>byId.get(id)?.text??'').filter(Boolean).join(' '))
      .filter(Boolean)
      .join('   '))
    .join('\n');
}

function buildLineLayout(
  sourceLines:Array<{id:string;tokens:OcrToken[]}>,
  elements:ReconstructionElement[],
  pageWidth:number,
  pageHeight:number
):ReconstructionLine[]{
  const byId=new Map(elements.map(element=>[element.id,element]));
  const allHeights=elements.map(element=>element.box.height).filter(value=>value>2&&Number.isFinite(value));
  const globalHeight=median(allHeights)||Math.max(10,pageHeight*.018);
  return sourceLines.map(line=>{
    const lineElements=line.tokens
      .map(token=>byId.get(token.id))
      .filter((element):element is ReconstructionElement=>!!element)
      .sort((a,b)=>a.box.x-b.box.x);
    if(!lineElements.length)return null;

    const centers=lineElements.map(element=>element.box.y+element.box.height/2);
    const localHeight=median(lineElements.map(element=>element.box.height).filter(value=>value>2))||globalHeight;
    const robustHeight=clamp(localHeight,globalHeight*.62,globalHeight*1.38);
    const centerY=median(centers);
    const y=clamp(centerY-robustHeight/2,0,Math.max(0,pageHeight-robustHeight));
    const x=Math.max(0,Math.min(...lineElements.map(element=>element.box.x)));
    const right=Math.min(pageWidth,Math.max(...lineElements.map(element=>element.box.x+element.box.width)));
    const segments=buildSegments(line.id,lineElements,robustHeight,pageWidth,y);
    return{
      id:line.id,
      box:{x,y,width:Math.max(1,right-x),height:robustHeight},
      baselineY:y+robustHeight*.78,
      fontSize:clamp(robustHeight*.68,globalHeight*.46,globalHeight*.82),
      segments
    };
  }).filter((line):line is ReconstructionLine=>!!line)
    .sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x);
}

function buildSegments(
  lineId:string,
  elements:ReconstructionElement[],
  lineHeight:number,
  pageWidth:number,
  lineY:number
):ReconstructionLineSegment[]{
  const groups:ReconstructionElement[][]=[];
  let current:ReconstructionElement[]=[];
  const gapThreshold=Math.max(lineHeight*.9,pageWidth*.035);
  for(const element of elements){
    const previous=current.at(-1);
    const gap=previous?element.box.x-(previous.box.x+previous.box.width):0;
    if(previous&&gap>gapThreshold){
      groups.push(current);
      current=[];
    }
    current.push(element);
  }
  if(current.length)groups.push(current);
  return groups.map((group,index)=>{
    const x=Math.max(0,Math.min(...group.map(element=>element.box.x)));
    const right=Math.min(pageWidth,Math.max(...group.map(element=>element.box.x+element.box.width)));
    const center=(x+right)/2;
    const alignment=center>pageWidth*.68?'right':center>pageWidth*.38&&center<pageWidth*.62?'center':'left';
    return{
      id:`${lineId}-segment-${index}`,
      box:{x,y:lineY,width:Math.max(1,right-x),height:lineHeight},
      elementIds:group.map(element=>element.id),
      alignment
    };
  });
}

function median(values:number[]):number{
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]!:((sorted[middle-1]??0)+(sorted[middle]??0))/2;
}
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}

function fromToken(pageNumber:number,token:OcrToken,nativePdfVerified=false,warnings:string[]=[]):ReconstructionElement{
  const trustedNativePdf=nativePdfVerified&&token.provenance==='native-pdf'&&token.text.trim().length>0;
  const criticalGateFailed=warnings.includes('CRITICAL_FIELD_GATE:FAIL')||warnings.includes('RECEIPT_AMOUNT_RECONCILIATION:REVIEW');
  const destructiveCorrection=isDestructiveCorrection(token);
  let status=trustedNativePdf?'reliable':statusFromConfidence(token.confidence,token.text);
  if(!trustedNativePdf&&destructiveCorrection)status='uncertain';
  if(!trustedNativePdf&&criticalGateFailed&&isCriticalReceiptToken(token))status=status==='error'?'error':'uncertain';
  return{
    id:token.id,
    pageNumber,
    lineId:token.lineId,
    box:{...token.box},
    originalText:token.rawText??token.text,
    rawText:token.rawText??token.text,
    normalizedText:token.normalizedText??normalizeTokenText(token.text),
    correctedText:null,
    text:token.text,
    confidence:token.confidence,
    status,
    editable:status!=='reliable',
    source:trustedNativePdf?'native-pdf':'ocr',
    ...(trustedNativePdf?{reason:'verified native PDF text layer'}:destructiveCorrection?{reason:'correzione OCR divergente: verifica richiesta'}:{})
  };
}

function isDestructiveCorrection(token:OcrToken):boolean{
  const raw=(token.rawText??'').trim();
  const current=token.text.trim();
  if(!token.correctionReason||!raw||raw===current)return false;
  const rawNorm=raw.normalize('NFKC').toUpperCase().replace(/\s+/g,'');
  const curNorm=current.normalize('NFKC').toUpperCase().replace(/\s+/g,'');
  if(rawNorm===curNorm)return false;
  const rawAlnum=rawNorm.replace(/[^\p{L}\p{N}]/gu,'');
  const curAlnum=curNorm.replace(/[^\p{L}\p{N}]/gu,'');
  const money=/^\d{1,5}[.,]\d{2}$/.test(current);
  const rawMoney=/^\d{1,5}[.,]\d{2}$/.test(raw);
  if(money&&!rawMoney)return true;
  if(curAlnum.length&&rawAlnum.length&&Math.abs(curAlnum.length-rawAlnum.length)>=3)return true;
  if(/[\p{L}]/u.test(raw)&&/^\d/.test(current))return true;
  return false;
}
function isCriticalReceiptToken(token:OcrToken):boolean{
  const text=token.text.trim();
  if(/^\d{1,5}[.,]\d{2,}$/.test(text))return true;
  if(/^\d{2}-\d{2}-\d{4}$/.test(text)||/^\d{2}:\d{2}$/.test(text))return true;
  if(/^\d{11}$/.test(text))return true;
  return /^(TOTALE|IVA|P\.?IVA|PAGAMENTO|IMPORTO|BANCOMAT|CONTANTI|CARTA)$/i.test(text);
}

function statusFromConfidence(confidence:number|null,text:string):ReconstructionStatus{
  if(!text.trim())return'unreadable';
  if(confidence===null)return'uncertain';
  if(confidence<35)return'error';
  if(confidence<75)return'uncertain';
  return'reliable';
}


function normalizeTokenText(text:string):string{
  return text.normalize('NFKC')
    .replace(/[“”]/g,'"')
    .replace(/[’‘]/g,"'")
    .replace(/\s+/g,' ')
    .trim();
}
