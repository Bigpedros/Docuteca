import type {ClassificationResult,DocutecaMode,IntakeFile} from '../types';

export const MOTORE_SOURCE_COMMIT='fb0d27cbbb288b5b7c7cc63b8cdee6a7d428fd9e';

export function classifyFiles(files:IntakeFile[]):ClassificationResult{
  const names=files.map(f=>f.name.toLowerCase()).join(' ');
  if(/modulo|form|istanza|domanda|scheda/.test(names))return{type:'Modulo',confidence:.91,reason:'Struttura compatibile con documento compilabile'};
  if(/scontrino|ricevuta|receipt/.test(names))return{type:'Ricevuta',confidence:.94,reason:'Documento commerciale'};
  if(/fattura|invoice/.test(names))return{type:'Fattura',confidence:.92,reason:'Documento fiscale strutturato'};
  return{type:'Documento generico',confidence:.78,reason:'Nessun profilo specialistico prevalente'};
}
export function decideMode(c:ClassificationResult):DocutecaMode{
  if(c.type==='Modulo')return'fillable';
  return c.confidence<.8?'review':'archive';
}
