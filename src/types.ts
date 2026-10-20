export type DocutecaView='home'|'classificazione'|'revisione'|'impostazioni';
export type DocutecaMode='archive'|'fillable'|'review';
export interface IntakeFile{ id:string; name:string; mime:string; size:number; previewUrl?:string; }
export interface ClassificationResult{ type:string; confidence:number; reason:string; }
export interface DocutecaDocument{
  id:string; title:string; createdAt:string; files:IntakeFile[]; mode:DocutecaMode;
  classification:ClassificationResult; extractedText:string; tags:string[]; status:'archived'|'review';
  pageCount:number; diagnostics:string[]; engineVersion:string;
}
