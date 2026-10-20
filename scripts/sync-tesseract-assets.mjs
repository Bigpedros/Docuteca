import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const copies=[
  ['node_modules/tesseract.js/dist/worker.min.js','public/tesseract/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm.js','public/tesseract/core/tesseract-core.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd.wasm.js','public/tesseract/core/tesseract-core-simd.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js','public/tesseract/core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js','public/tesseract/core/tesseract-core-simd-lstm.wasm.js']
];

for(const [src,dst] of copies){
  await mkdir(dst.slice(0,dst.lastIndexOf('/')),{recursive:true});
  await copyFile(src,dst);
  const bytes=await readFile(dst);
  console.log(`self-hosted ${dst}: ${bytes.length} bytes sha256=${createHash('sha256').update(bytes).digest('hex')}`);
}

const langUrl='https://tessdata.projectnaptha.com/4.0.0/ita.traineddata.gz';
const langResponse=await fetch(langUrl);
if(!langResponse.ok)throw new Error(`Tesseract language fetch failed: ${langResponse.status} ${langUrl}`);
const lang=new Uint8Array(await langResponse.arrayBuffer());
if(lang.length<100000)throw new Error(`Italian traineddata suspiciously small: ${lang.length} bytes`);
await mkdir('public/tesseract/lang',{recursive:true});
await writeFile('public/tesseract/lang/ita.traineddata.gz',lang);
console.log(`self-hosted public/tesseract/lang/ita.traineddata.gz: ${lang.length} bytes sha256=${createHash('sha256').update(lang).digest('hex')}`);
