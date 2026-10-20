import type {Box,OcrPage} from '../../contracts.js';

export interface GeometryEvidence {
  angleDegrees:number; weight:number; source:'printed-line'|'text-baseline'|'page-edge';
}
export interface GeometryInput {
  page:OcrPage; target?:'A4'|'source'; evidence?:GeometryEvidence[];
}
export interface GeometryAnalysis {
  transform:import('../../contracts.js').GeometryTransform;
  mapBox(box:Box):Box;
}
