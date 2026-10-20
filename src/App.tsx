import {useMemo,useState} from 'react';
import {Home,Tags,ClipboardCheck,Settings,Upload,FileText,Archive,ScanLine,ChevronRight,CheckCircle2} from 'lucide-react';
import type {DocutecaDocument,DocutecaView,IntakeFile} from './types';
import {classifyFiles,decideMode,MOTORE_SOURCE_COMMIT} from './docuteca/intake';
import {loadDocuments,saveDocuments} from './storage';

export function App(){
  const [view,setView]=useState<DocutecaView>('home');
  const [files,setFiles]=useState<IntakeFile[]>([]);
  const [docs,setDocs]=useState<DocutecaDocument[]>(()=>loadDocuments());
  const [processed,setProcessed]=useState(false);
  const classification=useMemo(()=>classifyFiles(files),[files]);
  const mode=decideMode(classification);

  const choose=(list:FileList|null)=>{
    if(!list)return;
    setProcessed(false);
    setFiles(Array.from(list).map(file=>({id:crypto.randomUUID(),name:file.name,mime:file.type,size:file.size,previewUrl:file.type.startsWith('image/')?URL.createObjectURL(file):undefined})));
  };
  const archive=()=>{
    if(!files.length)return;
    const doc:DocutecaDocument={id:crypto.randomUUID(),title:files[0]!.name,createdAt:new Date().toISOString(),files,mode,classification,extractedText:'',tags:[],status:mode==='review'?'review':'archived'};
    const next=[doc,...docs];setDocs(next);saveDocuments(next);setFiles([]);setProcessed(false);setView(mode==='review'?'revisione':'classificazione');
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
      {view==='home'&&<HomeView files={files} processed={processed} classification={classification} mode={mode} onFiles={choose} onProcess={()=>setProcessed(true)} onArchive={archive}/>}
      {view==='classificazione'&&<ClassificationView docs={docs}/>}
      {view==='revisione'&&<ReviewView docs={docs.filter(d=>d.status==='review')}/>}
      {view==='impostazioni'&&<SettingsView/>}
    </main>
  </div>;
}

function Nav({active,icon,label,onClick}:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}){
  return <button className={active?'nav active':'nav'} onClick={onClick}>{icon}<span>{label}</span></button>
}

function HomeView({files,processed,classification,mode,onFiles,onProcess,onArchive}:{files:IntakeFile[];processed:boolean;classification:ReturnType<typeof classifyFiles>;mode:string;onFiles:(f:FileList|null)=>void;onProcess:()=>void;onArchive:()=>void}){
  return <section className="page">
    <div className="topline"><span>DOCUTECA</span><span className="pill">Privacy locale</span></div>
    <h1>Acquisisci un documento</h1>
    <p className="subtitle">Carica immagini o PDF. Docuteca analizzerà il contenuto e ti proporrà il flusso corretto.</p>

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
        {files.map(f=><div className="fileItem" key={f.id}><span>{f.name}</span><small>{Math.round(f.size/1024)} KB</small></div>)}
      </div>
      <div className="flowCard">
        {!processed?<><h3>Pronto per l'elaborazione</h3><p>Normalizzazione, OCR, classificazione e controllo qualità verranno eseguiti in locale.</p><button className="primary" onClick={onProcess}>Elabora documento <ChevronRight/></button></>
        :<><div className="resultRow"><CheckCircle2/><div><small>Classificazione</small><b>{classification.type}</b></div><strong>{Math.round(classification.confidence*100)}%</strong></div>
        <div className="modeBox"><small>Azione suggerita</small><h2>{mode==='fillable'?'Compila':mode==='review'?'Revisione':'Archivia'}</h2><p>{classification.reason}</p></div>
        <button className="primary" onClick={onArchive}>{mode==='fillable'?'Apri compilazione':mode==='review'?'Invia a revisione':'Archivia documento'}</button></>}
      </div>
    </div>}
  </section>
}

function ClassificationView({docs}:{docs:DocutecaDocument[]}){
  return <section className="page"><div className="topline"><span>CLASSIFICAZIONE</span></div><h1>Documenti classificati</h1><p className="subtitle">Raggruppamento automatico in base al tipo di documento riconosciuto.</p>
    <div className="list">{docs.length?docs.map(d=><article className="doc" key={d.id}><Archive/><div><b>{d.title}</b><span>{d.classification.type} · {Math.round(d.classification.confidence*100)}%</span></div><em>{d.mode==='fillable'?'Compila':d.mode==='review'?'Revisione':'Archivia'}</em></article>):<div className="empty">Nessun documento classificato.</div>}</div>
  </section>
}

function ReviewView({docs}:{docs:DocutecaDocument[]}){
  return <section className="page"><div className="topline"><span>REVISIONE</span></div><h1>Documenti da controllare</h1><p className="subtitle">Qui compaiono i documenti con confidenza insufficiente o struttura ambigua.</p>
    <div className="list">{docs.length?docs.map(d=><article className="doc" key={d.id}><ClipboardCheck/><div><b>{d.title}</b><span>{d.classification.reason}</span></div><em>Da rivedere</em></article>):<div className="empty">Nessun documento richiede revisione.</div>}</div>
  </section>
}

function SettingsView(){
  return <section className="page"><div className="topline"><span>IMPOSTAZIONI</span></div><h1>Configurazione</h1><div className="settings">
    <div><b>Elaborazione locale</b><p>I documenti non vengono inviati a servizi cloud nel flusso base.</p></div>
    <div><b>Scanner desktop</b><p>TWAIN/WIA sarà disponibile nel wrapper desktop, non nel browser.</p></div>
    <div><b>Motore OCR</b><p>Baseline certificata 0.5, mantenuta separata dal livello applicativo Docuteca.</p></div>
  </div></section>
}
