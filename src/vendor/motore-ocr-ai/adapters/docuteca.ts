import type {EngineDocumentResult} from '../contracts.js';
import type {ApplicationAdapter} from './types.js';

export interface DocutecaOutput{modeSuggestion:'archive'|'fillable'|'review';structuralClass:string;text:string;pageCount:number}
export class DocutecaAdapter implements ApplicationAdapter<DocutecaOutput>{
  readonly id='docuteca' as const;
  adapt(result:EngineDocumentResult):DocutecaOutput{
    const classes=result.pages.map(p=>p.structure.class);
    const hasFields=result.pages.some(p=>p.structure.fields.length>0);
    const fillable=classes.some(v=>v==='blank-form');
    const archive=classes.every(v=>['filled-form','generic-document','receipt'].includes(v));
    return{modeSuggestion:fillable&&hasFields?'fillable':archive?'archive':'review',structuralClass:classes.join(','),
      text:result.pages.map(p=>p.ocr.text).join('\n'),pageCount:result.pages.length};
  }
}
