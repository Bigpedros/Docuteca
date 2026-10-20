import type {DocutecaDocument} from './types';
const KEY='docuteca.documents.v1';
export function loadDocuments():DocutecaDocument[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
export function saveDocuments(v:DocutecaDocument[]):void{localStorage.setItem(KEY,JSON.stringify(v))}
