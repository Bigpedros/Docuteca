import {copyFile,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

await mkdir('public/tesseract',{recursive:true});
await mkdir('public/tesseract/core',{recursive:true});

await copyFile('node_modules/tesseract.js/dist/worker.min.js','public/tesseract/worker.min.js');
{
  const bytes=await readFile('public/tesseract/worker.min.js');
  console.log(`self-hosted public/tesseract/worker.min.js: ${bytes.length} bytes sha256=${createHash('sha256').update(bytes).digest('hex')}`);
}

const coreDir='node_modules/tesseract.js-core';
const coreFiles=(await readdir(coreDir)).filter(name=>/^tesseract-core.*\.wasm\.js$/.test(name)).sort();
if(coreFiles.length<4)throw new Error(`Unexpected tesseract.js-core layout: found only ${coreFiles.length} wasm.js variants`);

for(const name of coreFiles){
  const src=`${coreDir}/${name}`;
  const dst=`public/tesseract/core/${name}`;
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
