import type {Box,OcrPage,StructuralRegion} from '../../contracts.js';

export function analyzeDocumentLayout(page:OcrPage,geometric:StructuralRegion[]=[]):StructuralRegion[]{
  const output:StructuralRegion[]=[...geometric.map(r=>({...r,box:{...r.box},evidence:[...r.evidence]}))];
  const lines=groupLines(page);
  const pageArea=Math.max(1,page.width*page.height);

  // Blocchi testuali / paragrafi per prossimità verticale.
  const blocks:Array<typeof lines>=[];
  let current:typeof lines=[];
  for(const line of lines){
    const prev=current.at(-1);
    const gap=prev?line.box.y-(prev.box.y+prev.box.height):0;
    const h=prev?Math.max(prev.box.height,line.box.height):line.box.height;
    if(prev&&gap>h*1.7){blocks.push(current);current=[];}
    current.push(line);
  }
  if(current.length)blocks.push(current);
  for(const block of blocks){
    const box=union(block.map(x=>x.box));
    const yRatio=box.y/page.height;
    const dense=block.reduce((s,l)=>s+l.tokens.length,0);
    let kind:StructuralRegion['kind']='paragraph';
    if(yRatio<.1&&box.height/page.height<.12&&block.length<=3)kind='header';
    else if(isFooterBlock(block,box,page))kind='footer';
    else if(block.length<=2&&dense<=12&&block.some(l=>isTitleLike(l,page)))kind='title';
    output.push({id:`layout-${output.length}`,kind,box,confidence:.82,evidence:[`lines:${block.length}`,`tokens:${dense}`],text:block.map(l=>l.text).join('\n')});
  }

  // Colonne: cluster di linee con baricentro x separato.
  const centers=lines.map(line=>({line,cx:line.box.x+line.box.width/2})).sort((a,b)=>a.cx-b.cx);
  if(centers.length>=8){
    let split=-1,maxGap=0;
    for(let i=0;i<centers.length-1;i++){const gap=centers[i+1]!.cx-centers[i]!.cx;if(gap>maxGap){maxGap=gap;split=i;}}
    if(split>=2&&split<centers.length-3&&maxGap>page.width*.18){
      const left=centers.slice(0,split+1).map(x=>x.line),right=centers.slice(split+1).map(x=>x.line);
      for(const group of [left,right]){
        const box=union(group.map(x=>x.box));
        output.push({id:`layout-${output.length}`,kind:'column',box,confidence:.76,evidence:[`lines:${group.length}`],text:group.map(x=>x.text).join('\n')});
      }
    }
  }

  // Tabelle: servono colonne stabili su più righe; gli elenchi numerati restano paragrafi.
  const groups=clusterConsecutive(lines.filter(line=>line.tokens.length>=2),page.height*.035);
  for(const group of groups.filter(g=>g.length>=3&&!isNumberedList(g)&&tableAlignmentScore(g,page)>=.68)){
    const box=union(group.map(x=>x.box)),score=tableAlignmentScore(group,page);
    output.push({id:`layout-${output.length}`,kind:'table',box,confidence:Math.min(.94,.68+score*.22),evidence:[`rows:${group.length}`,`column-alignment:${score.toFixed(2)}`],text:group.map(x=>x.text).join('\n')});
    for(const line of group)output.push({id:`layout-${output.length}`,kind:'table-row',box:{...line.box},confidence:.82,evidence:['stable-columns'],text:line.text});
  }

  // Associa celle geometriche alle tabelle che le contengono.
  const tables=output.filter(region=>region.kind==='table');
  for(const cell of output.filter(region=>region.kind==='cell')){
    const parent=tables.find(table=>contains(table.box,cell.box));
    if(parent)cell.parentId=parent.id;
  }

  // Label/value: due gruppi sulla stessa baseline con spazio significativo.
  for(const line of lines){
    const sorted=[...line.tokens].sort((a,b)=>a.box.x-b.box.x);
    let maxGap=0,index=-1;
    for(let i=0;i<sorted.length-1;i++){const gap=sorted[i+1]!.box.x-(sorted[i]!.box.x+sorted[i]!.box.width);if(gap>maxGap){maxGap=gap;index=i;}}
    if(index>=0&&maxGap>page.width*.045){
      const left=sorted.slice(0,index+1),right=sorted.slice(index+1);
      if(left.length&&right.length){
        output.push({id:`layout-${output.length}`,kind:'label',box:union(left.map(t=>t.box)),confidence:.72,evidence:['same-line-gap'],text:left.map(t=>t.text).join(' ')});
        output.push({id:`layout-${output.length}`,kind:'value',box:union(right.map(t=>t.box)),confidence:.72,evidence:['same-line-gap'],text:right.map(t=>t.text).join(' ')});
      }
    }
  }

  // Firma: area relativamente ampia, poco testo, vicino al fondo e con etichetta "firma".
  for(const line of lines.filter(l=>/firma|signature/i.test(l.text))){
    const candidate:Box={x:Math.min(page.width-1,line.box.x+line.box.width),y:Math.max(0,line.box.y-line.box.height*.3),width:Math.max(1,page.width-(line.box.x+line.box.width)-page.width*.04),height:Math.max(line.box.height*2,page.height*.06)};
    if(candidate.width*candidate.height/pageArea>.004)output.push({id:`layout-${output.length}`,kind:'signature',box:candidate,confidence:.7,evidence:['signature-label-nearby']});
  }

  return compactLayoutRegions(dedupeRegions(output),page).sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x);
}

function groupLines(page:OcrPage){
  const map=new Map<string,typeof page.tokens>();for(const t of page.tokens){const a=map.get(t.lineId)??[];a.push(t);map.set(t.lineId,a);}
  return[...map].map(([id,tokens])=>{const sorted=[...tokens].sort((a,b)=>a.box.x-b.box.x);return{id,tokens:sorted,text:sorted.map(t=>t.text).join(' '),box:union(sorted.map(t=>t.box))};}).sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x);
}
function isTitleLike(line:ReturnType<typeof groupLines>[number],page:OcrPage){const median=medianOf(page.tokens.map(t=>t.box.height));return line.box.height>=median*1.2||line.text.length<70&&/^[A-ZÀ-Ý0-9 .:'-]+$/.test(line.text);}
function isFooterBlock(block:ReturnType<typeof groupLines>,box:Box,page:OcrPage){const top=box.y/page.height,bottom=(box.y+box.height)/page.height,height=box.height/page.height;if(top<.86||bottom<.93||height>.11||block.length>3)return false;const text=block.map(line=>line.text).join(' ');return /\b(pagina|page)\s*\d+\b|copyright|©|www\.|https?:\/\/|\b\d+\s*\/\s*\d+\b/i.test(text)||text.length<120;}
function isNumberedList(group:ReturnType<typeof groupLines>){const numbered=group.filter(line=>/^(?:\d{1,3}|[A-Z])[.)]?\s+/i.test(line.text.trim())).length;return numbered/Math.max(1,group.length)>=.5;}
function tableAlignmentScore(group:ReturnType<typeof groupLines>,page:OcrPage){const splits=group.flatMap(line=>{const sorted=[...line.tokens].sort((a,b)=>a.box.x-b.box.x);if(sorted.length<2)return[];let maxGap=0,split=0;for(let i=0;i<sorted.length-1;i++){const gap=sorted[i+1]!.box.x-(sorted[i]!.box.x+sorted[i]!.box.width);if(gap>maxGap){maxGap=gap;split=(sorted[i]!.box.x+sorted[i]!.box.width+sorted[i+1]!.box.x)/2;}}return maxGap>page.width*.035?[split]:[];});if(splits.length<Math.ceil(group.length*.7))return 0;const mean=splits.reduce((a,b)=>a+b,0)/splits.length;const variance=splits.reduce((sum,value)=>sum+(value-mean)**2,0)/splits.length;const stability=Math.max(0,1-Math.sqrt(variance)/Math.max(1,page.width*.04));return stability*.75+Math.min(1,splits.length/group.length)*.25;}
function clusterConsecutive<T extends {box:Box}>(lines:T[],maxGap:number){const sorted=[...lines].sort((a,b)=>a.box.y-b.box.y),out:T[][]=[];let cur:T[]=[];for(const line of sorted){const prev=cur.at(-1);if(prev&&line.box.y-(prev.box.y+prev.box.height)>maxGap){out.push(cur);cur=[];}cur.push(line);}if(cur.length)out.push(cur);return out;}
function gScore(group:Array<{box:Box}>){return Math.min(5,group.length);}
function union(boxes:Box[]):Box{const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),r=Math.max(...boxes.map(b=>b.x+b.width)),bt=Math.max(...boxes.map(b=>b.y+b.height));return{x,y,width:r-x,height:bt-y};}
function medianOf(v:number[]){if(!v.length)return 1;const s=[...v].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]!:((s[m-1]??0)+(s[m]??0))/2;}
function dedupeRegions(regions:StructuralRegion[]){const out:StructuralRegion[]=[];for(const r of regions){if(out.some(x=>x.kind===r.kind&&iou(x.box,r.box)>.86))continue;out.push(r);}return out;}
function contains(outer:Box,inner:Box){return inner.x>=outer.x-3&&inner.y>=outer.y-3&&inner.x+inner.width<=outer.x+outer.width+3&&inner.y+inner.height<=outer.y+outer.height+3;}
function iou(a:Box,b:Box){const l=Math.max(a.x,b.x),t=Math.max(a.y,b.y),r=Math.min(a.x+a.width,b.x+b.width),bt=Math.min(a.y+a.height,b.y+b.height);if(r<=l||bt<=t)return 0;const i=(r-l)*(bt-t);return i/(a.width*a.height+b.width*b.height-i);}


function compactLayoutRegions(regions:StructuralRegion[],page:OcrPage):StructuralRegion[]{
  const essential=new Set<StructuralRegion['kind']>(['signature','stamp','image','checkbox','radio','table','title','header','footer']);
  const rowsByParent=new Map<string,number>();
  const filtered=regions.filter(region=>{
    if(region.kind==='table-row'&&region.parentId){
      const count=rowsByParent.get(region.parentId)??0;
      if(count>=18)return false;
      rowsByParent.set(region.parentId,count+1);
    }
    return true;
  });
  const budget=page.tokens.length>700?68:page.tokens.length>350?76:page.tokens.length>150?84:96;
  if(filtered.length<=budget)return filtered;
  const priority=(region:StructuralRegion)=>{
    if(essential.has(region.kind))return 0;
    if(region.kind==='paragraph'||region.kind==='column')return 1;
    if(region.kind==='label'||region.kind==='value')return 2;
    if(region.kind==='cell'||region.kind==='underline'||region.kind==='table-row')return 4;
    return 3;
  };
  const selected=[...filtered]
    .sort((a,b)=>priority(a)-priority(b)||b.confidence-a.confidence||regionArea(b)-regionArea(a))
    .slice(0,budget);
  return selected;
}
function regionArea(region:StructuralRegion){return Math.max(0,region.box.width)*Math.max(0,region.box.height);}
