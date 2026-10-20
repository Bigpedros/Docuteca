import {useState} from 'react';
import type {ReactNode} from 'react';
import {Home,Tags,ClipboardCheck,Settings,Upload,FileText,Archive,ScanLine,ChevronRight,CheckCircle2,LoaderCircle,AlertTriangle} from 'lucide-react';
import type {DocutecaDocument,DocutecaView,IntakeFile} from './types';
import type {MotoreAnalysis} from './docuteca/motoreEngine';
import {analyzeWithMotore,MOTORE_SOURCE_COMMIT} from './docuteca/motoreEngine';
import {rasterizeFiles} from './docuteca/rasterize';
import {loadDocuments,saveDocuments} from './storage';

export function App(){
  const [view,setView]=useState<DocutecaView>('home');
  const [rawFiles,setRawFiles]=useState<File[]>([]);
  const [files,setFiles]=useState<IntakeFile[]>([]);
  const [docs,setDocs]=useState<DocutecaDocument[]>(()=>loadDocuments());
  const [analysis,setAnalysis]=useState<MotoreAnalysis|null>(null);
  const [processing,setProcessing]=useState(false);
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');

  const choose=(list:FileList|null)=>{
    if(!list)return;
    const selected=Array.from(list);
    setRawFiles(selected);
    setAnalysis(null);
    setError('');
    setProgress('');
    setFiles(selected.map(file=>({
      id:crypto.randomUUID(),
      name:file.name,
      mime:file.type||'application/octet-stream',
      size:file.size,
      previewUrl:file.type.startsWith('image/')?URL.createObjectURL(file):undefined
    })));
  };

  const process=async()=>{
    if(!rawFiles.length)return;
    setProcessing(true);
    setAnalysis(null);
    setError('');
    try{
      setProgress('Preparazione pagine…');
      const rasters=await rasterizeFiles(rawFiles);
      setProgress(`0 / ${rasters.length} pagine`);
      const result=await analyzeWithMotore(
        rasters,
        undefined,
        (current,total,label)=>setProgress(`${current} / ${total} · ${label}`)
      );
      setAnalysis(result);
      setProgress('Analisi completata');
    }catch(value){
      const message=value instanceof Error?value.message:String(value);
      setError(message);
      setProgress('');
    }finally{
      setProcessing(false);
    }
  };

  const archive=()=>{
    if(!files.length||!analysis)return;
    const doc:DocutecaDocument={
      id:crypto.randomUUID(),
      title:files[0]!.name,
      createdAt:new Date().toISOString(),
      files,
      mode:analysis.mode,
      classification:{
        type:analysis.classificationLabel,
        confidence:analysis.confidence,
        reason:analysis.structuralClass
      },
      extractedText:analysis.text,
      tags:[],
      status:analysis.mode==='review'?'review':'archived',
      pageCount:analysis.pageCount,
      diagnostics:analysis.diagnostics,
      engineVersion:analysis.engineVersion
    };
    const next=[doc,...docs];
    setDocs(next);
    saveDocuments(next);
    setRawFiles([]);
    setFiles([]);
    setAnalysis(null);
    setProgress('');
    setView(doc.status==='review'?'revisione':'classificazione');
  };

  return <div className="shell">
    <aside className="sidebar">
      <div className="logo"><div className="logoMark">D</div><div><strong>Docuteca</strong><span>Archivio documentale</span></div></div>
      <Nav active={view==='home'} icon={<Home/>} label="Home" onClick={()=>setView('home')}/>
      <Nav active={view==='classificazione'} icon={<Tags/>} label="Classificazione" onClick={()=>setView('classificazione')}/>
      <Nav active={view==='revisione'} icon={<ClipboardCheck/>} label="Revisione" onClick={()=>setView('revisione')}/>
      <Nav active={view==='impostazioni'} icon={<Settings/>} label="Impostazioni" onClick={()=>setView('impostazioni')}/>
      <div className="sidebarFoot"><ScanLine/><div><b>MOTORE OCR 0.5</b><small>{MOTORE_SOURCE_COMMIT.slice(0,8)}…</small></div></div>
    </aside>
    <main>
      {view==='home'&&<HomeView files={files} processing={processing} progress={progress} error={error} analysis={analysis} onFiles={choose} onProcess={process} onArchive={archive}/>}
      {view==='classificazione'&&<ClassificationView docs={docs}/>}
      {view==='revisione'&&<ReviewView docs={docs.filter(d=>d.status==='review')}/>}
      {view==='impostazioni'&&<SettingsView/>}
    </main>
  </div>;
}

function Nav({active,icon,label,onClick}:{active:boolean;icon:ReactNode;label:string;onClick:()=>void}){
  return <button className={active?'nav active':'nav'} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function HomeView({
  files,processing,progress,error,analysis,onFiles,onProcess,onArchive
}:{
  files:IntakeFile[];
  processing:boolean;
  progress:string;
  error:string;
  analysis:MotoreAnalysis|null;
  onFiles:(f:FileList|null)=>void;
  onProcess:()=>void;
  onArchive:()=>void;
}){
  return <section className="page">
    <div className="topline"><span>DOCUTECA</span><span className="pill">Elaborazione locale</span></div>
    <h1>Acquisisci un documento</h1>
    <p className="subtitle">Carica immagini o PDF. Il MOTORE OCR 0.5 normalizza, legge, classifica e verifica il documento.</p>

    <label className="drop">
      <div className="uploadIcon"><Upload/></div>
      <b>Trascina qui il documento</b>
      <span>oppure fai clic per selezionare</span>
      <small>JPG · PNG · WEBP · PDF · anche più file</small>
      <input type="file" multiple accept="image/*,.pdf" onChange={e=>onFiles(e.target.files)}/>
    </label>

    {files.length>0&&<div className="workarea">
      <div className="previewCard">
        <div className="cardTitle"><FileText/> Anteprima</div>
        {files.map(file=><div className="fileItem" key={file.id}><span>{file.name}</span><small>{Math.round(file.size/1024)} KB</small></div>)}
        {analysis&&<div className="textPreview">
          <small>Testo OCR</small>
          <pre>{analysis.text.slice(0,2200)||'Nessun testo riconosciuto.'}</pre>
        </div>}
      </div>

      <div className="flowCard">
        {!analysis?<>
          <h3>{processing?'Elaborazione in corso':'Pronto per l’elaborazione'}</h3>
          <p>Scanner fotografico, geometry correction, camera cleanup, OCR Tesseract, Decision Engine, struttura e merge multipagina.</p>
          {processing&&<div className="progress"><LoaderCircle className="spin"/><span>{progress||'Avvio MOTORE OCR…'}</span></div>}
          {error&&<div className="errorBox"><AlertTriangle/><span>{error}</span></div>}
          <button className="primary" onClick={onProcess} disabled={processing}>
            {processing?'Elaborazione…':'Elabora documento'} {!processing&&<ChevronRight/>}
          </button>
        </>:<>
          <div className="resultRow"><CheckCircle2/><div><small>Classificazione MOTORE</small><b>{analysis.classificationLabel}</b></div><strong>{Math.round(analysis.confidence*100)}%</strong></div>
          <div className="modeBox">
            <small>Azione suggerita</small>
            <h2>{analysis.mode==='fillable'?'Compila':analysis.mode==='review'?'Revisione':'Archivia'}</h2>
            <p>{analysis.structuralClass} · {analysis.pageCount} pagina/e</p>
          </div>
          <div className="engineMeta">
            <span>MOTORE {analysis.engineVersion}</span>
            <span>{analysis.sourceCommit.slice(0,8)}…</span>
          </div>
          <button className="primary" onClick={onArchive}>
            {analysis.mode==='fillable'?'Salva e apri compilazione':analysis.mode==='review'?'Invia a revisione':'Archivia documento'}
          </button>
        </>}
      </div>
    </div>}
  </section>;
}

function ClassificationView({docs}:{docs:DocutecaDocument[]}){
  return <section className="page">
    <div className="topline"><span>CLASSIFICAZIONE</span></div>
    <h1>Documenti classificati</h1>
    <p className="subtitle">Classificazione derivata dal risultato strutturale del MOTORE OCR.</p>
    <div className="list">
      {docs.length?docs.map(doc=><article className="doc" key={doc.id}>
        <Archive/>
        <div><b>{doc.title}</b><span>{doc.classification.type} · {Math.round(doc.classification.confidence*100)}% · {doc.pageCount} pagina/e</span></div>
        <em>{doc.mode==='fillable'?'Compila':doc.mode==='review'?'Revisione':'Archivia'}</em>
      </article>):<div className="empty">Nessun documento classificato.</div>}
    </div>
  </section>;
}

function ReviewView({docs}:{docs:DocutecaDocument[]}){
  return <section className="page">
    <div className="topline"><span>REVISIONE</span></div>
    <h1>Documenti da controllare</h1>
    <p className="subtitle">Qui compaiono i documenti per cui il MOTORE non propone archiviazione o compilazione automatica.</p>
    <div className="list">
      {docs.length?docs.map(doc=><article className="doc" key={doc.id}>
        <ClipboardCheck/>
        <div><b>{doc.title}</b><span>{doc.classification.type} · {doc.classification.reason}</span></div>
        <em>Da rivedere</em>
      </article>):<div className="empty">Nessun documento richiede revisione.</div>}
    </div>
  </section>;
}

function SettingsView(){
  return <section className="page">
    <div className="topline"><span>IMPOSTAZIONI</span></div>
    <h1>Configurazione</h1>
    <div className="settings">
      <div><b>Elaborazione</b><p>OCR, geometria e classificazione vengono eseguiti nel browser. La baseline MOTORE è fissata e non viene modificata da Docuteca.</p></div>
      <div><b>Asset OCR</b><p>La 9B usa il runtime Tesseract del MOTORE. Il self-hosting completo degli asset lingua/core è il successivo hardening offline.</p></div>
      <div><b>Scanner desktop</b><p>TWAIN/WIA resta previsto nel wrapper desktop e non viene simulato nel browser.</p></div>
    </div>
  </section>;
}
