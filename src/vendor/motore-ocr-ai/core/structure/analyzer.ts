import type {FieldCandidate,OcrPage,StructuralAnalysis,StructuralRegion} from '../../contracts.js';

export interface StructureHints {regions?:StructuralRegion[]}

export function analyzeStructure(page:OcrPage,hints:StructureHints={}):StructuralAnalysis{
  const regions=hints.regions??[];
  const text=page.text.toLowerCase();
  const checkboxes=regions.filter(region=>region.kind==='checkbox').length;
  const cells=regions.filter(region=>region.kind==='cell').length;
  const form=count(text,/\bnome\b|\bcognome\b|\bdata di nascita\b|\bfirma\b|\bsezione\b|\bclasse\b|\bindirizzo\b|\btelefono\b|\bemail\b|\bcodice fiscale\b/g);
  const receipt=count(text,/\btotale\b|\biva\b|\bscontrino\b|\bdocumento commerciale\b|\bpagamento\b|\bresto\b|\bimporto pagato\b/g);
  const invoice=count(text,/\bfattura\b|\bimponibile\b|\baliquota\b|\bpartita iva\b|\bp\.\s*iva\b|\bscadenza\b|\bnumero fattura\b|\btotale fattura\b/g);
  const contract=count(text,/\bcontratto\b|\bcontraente\b|\blocatore\b|\bconduttore\b|\bclausola\b|\bpremesso\b|\bstipula\b|\barticolo\s+\d+\b|\bart\.\s*\d+\b/g);
  const letter=count(text,/spett\.le|gentile|oggetto:|cordiali saluti|distinti saluti/g);
  const lineCount=new Set(page.tokens.map(token=>token.lineId)).size;
  const averageWordsPerLine=lineCount?page.tokens.length/lineCount:0;
  const bookLike=page.tokens.length>=90&&lineCount>=12&&averageWordsPerLine>=5&&form<2&&receipt<2&&invoice<2&&contract<2;

  let cls:StructuralAnalysis['class']='unknown';
  let confidence=.35;
  const evidence:string[]=[];

  if(invoice>=2){
    cls='invoice';confidence=Math.min(.96,.58+invoice*.07);
    evidence.push(`${invoice} segnali lessicali da fattura`);
  }else if(receipt>=2){
    cls='receipt';confidence=Math.min(.95,.55+receipt*.08);
    evidence.push(`${receipt} segnali lessicali da scontrino/ricevuta`);
  }else if(contract>=2){
    cls='contract';confidence=Math.min(.94,.56+contract*.07);
    evidence.push(`${contract} segnali lessicali contrattuali`);
  }else if(form>=2||checkboxes+cells>=4){
    cls=page.tokens.some(token=>token.provenance==='ocr'&&token.confidence!==null)?'filled-form':'blank-form';
    confidence=Math.min(.9,.5+form*.06+(checkboxes+cells)*.02);
    evidence.push(`${form} etichette da modulo`,`${checkboxes+cells} regioni strutturate`);
  }else if(bookLike){
    cls='book-page';confidence=Math.min(.9,.62+Math.min(.2,page.tokens.length/1000));
    evidence.push(`${page.tokens.length} parole/tokens`,`${lineCount} righe dense`);
  }else if(letter>=2){
    cls='letter';confidence=Math.min(.9,.56+letter*.08);
    evidence.push(`${letter} segnali da corrispondenza`);
  }else if(page.tokens.length){
    cls='generic-document';confidence=.6;
    evidence.push('testo presente senza struttura dominante');
  }

  if(regions.length)evidence.push(`${regions.length} regioni layout/oggetti rilevate`);
  const fields=cls==='receipt'?[]:infer(page,regions);
  const readingOrder=[...regions].sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x).map(region=>region.id);
  return{class:cls,confidence,regions,fields,evidence,readingOrder};
}

function infer(page:OcrPage,regions:StructuralRegion[]):FieldCandidate[]{
  const output:FieldCandidate[]=[];
  for(const region of regions){
    if(!['cell','checkbox','underline','whitespace'].includes(region.kind))continue;
    const near=page.tokens
      .filter(token=>token.box.y<=region.box.y+region.box.height&&token.box.y+token.box.height>=region.box.y)
      .filter(token=>token.box.x+token.box.width<=region.box.x+8)
      .sort((a,b)=>(region.box.x-(a.box.x+a.box.width))-(region.box.x-(b.box.x+b.box.width)))[0];
    output.push({
      id:`p${page.pageNumber}-f${output.length}`,
      pageNumber:page.pageNumber,
      box:{...region.box},
      label:near?.text??null,
      type:region.kind==='checkbox'?'checkbox':guess(near?.text??''),
      confidence:Math.min(.95,region.confidence*(near?1:.7)),
      sourceRegionId:region.id,
      provenance:'structure',
      evidence:[...region.evidence,near?`label:${near.text}`:'label:unresolved']
    });
  }
  return output;
}

function guess(label:string):FieldCandidate['type']{
  if(/data|nascita|giorno/i.test(label))return'date';
  if(/note|descrizione|osservazioni|testo/i.test(label))return'textarea';
  return'text';
}
function count(text:string,re:RegExp){return[...text.matchAll(re)].length;}
