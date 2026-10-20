import type {EnginePageResult} from '../../contracts.js';
import {createStructuredDocumentCheckpoint,type StructuredDocumentCheckpoint} from '../pipeline/checkpoints.js';

export function structuredDocumentForPage(page:EnginePageResult):StructuredDocumentCheckpoint{
  return page.pipeline?.structuredDocument??createStructuredDocumentCheckpoint(page.ocr,page.structure);
}
