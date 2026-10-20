export type AiSuggestionKind =
  | 'semantic-key'
  | 'document-class'
  | 'field-label'
  | 'ocr-ranking'
  | 'adapter-choice'
  | 'anomaly-explanation';

export type AiDomain = string;

export interface AiSuggestion {
  id:string;
  kind:AiSuggestionKind;
  pageNumber?:number;
  fieldId?:string;
  proposedValue:string;
  confidence:number;
  reason:string;
  provenance:'ai-suggestion';
  provider:string;
  model:string;
}

export interface AiRequestPolicy {
  mode:'advisory';
  allowGeometryMutation:false;
  allowOcrReplacement:false;
  allowExternalNetwork:false;
  maxSuggestions:number;
  allowedSemanticKeys?:string[];
  allowedValues?:string[];
}

export interface AiRequestToken {
  id:string;
  text:string;
  confidence:number|null;
  box:{x:number;y:number;width:number;height:number};
}

export interface AiRequestField {
  id:string;
  label:string|null;
  type:string;
  confidence:number;
  box:{x:number;y:number;width:number;height:number};
  evidence:string[];
}

export interface AiRequestPage {
  pageNumber:number;
  width:number;
  height:number;
  text:string;
  tokens:AiRequestToken[];
  structuralClass:string;
  structuralConfidence:number;
  fields:AiRequestField[];
}

export interface AiRequest {
  schemaVersion:'1.0';
  requestId:string;
  createdAt:string;
  task:AiSuggestionKind;
  domain:AiDomain;
  purpose:string;
  pages:AiRequestPage[];
  policy:AiRequestPolicy;
}

export interface LocalAiProvider {
  readonly id:string;
  suggest(request:AiRequest,signal?:AbortSignal):Promise<AiSuggestion[]>;
}
