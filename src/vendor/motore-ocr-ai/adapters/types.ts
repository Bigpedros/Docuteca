import type {EngineDocumentResult} from '../contracts.js';
export interface ApplicationAdapter<TOutput=unknown>{
  readonly id:'pei'|'gestione-casa'|'docuteca';
  adapt(result:EngineDocumentResult):TOutput;
}
