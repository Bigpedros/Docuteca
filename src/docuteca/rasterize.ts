import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;

export interface RasterPage{
  pageNumber:number;
  canvas:HTMLCanvasElement;
  sourceName:string;
}

export async function rasterizeFiles(files:File[]):Promise<RasterPage[]>{
  const pages:RasterPage[]=[];
  let pageNumber=1;
  for(const file of files){
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
      const pdfPages=await rasterizePdf(file,pageNumber);
      pages.push(...pdfPages);
      pageNumber+=pdfPages.length;
      continue;
    }
    const canvas=await rasterizeImage(file);
    pages.push({pageNumber,canvas,sourceName:file.name});
    pageNumber++;
  }
  return pages;
}

async function rasterizeImage(file:File):Promise<HTMLCanvasElement>{
  const bitmap=await createImageBitmap(file);
  try{
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,bitmap.width);
    canvas.height=Math.max(1,bitmap.height);
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Canvas 2D non disponibile');
    context.drawImage(bitmap,0,0);
    return canvas;
  }finally{
    bitmap.close();
  }
}

async function rasterizePdf(file:File,startPageNumber:number):Promise<RasterPage[]>{
  const data=new Uint8Array(await file.arrayBuffer());
  const loadingTask=pdfjs.getDocument({data});
  const pdf=await loadingTask.promise;
  const output:RasterPage[]=[];
  try{
    for(let index=1;index<=pdf.numPages;index++){
      const page=await pdf.getPage(index);
      const base=page.getViewport({scale:1});
      const targetWidth=Math.min(2200,Math.max(1200,base.width*1.8));
      const scale=targetWidth/base.width;
      const viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(viewport.width));
      canvas.height=Math.max(1,Math.round(viewport.height));
      const context=canvas.getContext('2d',{willReadFrequently:true});
      if(!context)throw new Error('Canvas PDF non disponibile');
      await (page.render as unknown as (params:unknown)=>{promise:Promise<void>})({
        canvasContext:context,
        viewport
      }).promise;
      output.push({pageNumber:startPageNumber+index-1,canvas,sourceName:`${file.name} · pagina ${index}`});
      page.cleanup();
    }
    return output;
  }finally{
    await pdf.destroy();
  }
}
