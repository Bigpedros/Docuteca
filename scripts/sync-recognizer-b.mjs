import {mkdir,writeFile} from 'node:fs/promises';

const sourceRepo='Bigpedros/PEI-Facile-2';
const sourceCommit='9567808dd8d9662014c5e72e80a50bad7d2117a5';
const files=[
  'public/recognizer-b/ocrs_wasm.js',
  'public/recognizer-b/ocrs_wasm_bg.wasm',
  'public/models/text-detection.rten',
  'public/models/text-recognition.rten',
  'public/licenses/recognizer-b/NOTICE.md'
];

for(const path of files){
  const rawPath=path.replace(/^public\//,'');
  const url=`https://raw.githubusercontent.com/${sourceRepo}/${sourceCommit}/public/${rawPath}`;
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Recognizer B asset fetch failed: ${response.status} ${url}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<32)throw new Error(`Recognizer B asset suspiciously small: ${path} (${bytes.length} bytes)`);
  await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});
  await writeFile(path,bytes);
  console.log(`synced ${path}: ${bytes.length} bytes`);
}
