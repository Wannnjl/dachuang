import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {Workbook,SpreadsheetFile,FileBlob} from '@oai/artifact-tool';

const out=path.resolve('outputs/e12_verified_20261026');
const file=path.join(out,'韩国Deepfake_已核验采集表.xlsx');
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const serial=s=>{let m=s.match(/^(\d{2})-(\d+)-(\d+) (\d+):(\d+)$/);if(!m)throw Error('Invalid source time '+s);return Date.UTC(2000+Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]))/86400000+25569;};
const batchDate=s=>Date.parse(s.slice(0,19)+'Z')/86400000+25569;
const topics='#多名韩女性在中国互联网求助#';
const names=['评论节点','回复节点','转发节点','排除节点'];
const rows=name=>wb.worksheets.getItem(name).getUsedRange().values;
const oldRows=Object.fromEntries(names.map(n=>[n,rows(n).slice(1).filter(r=>r[4])]));
const known=new Set(Object.values(oldRows).flat().map(r=>r[3]+'|'+r[4]));
const added=Object.fromEntries(names.map(n=>[n,[]]));
const multi=[];
const modifications=[];
const fulltexts=[];
const progressNotes=new Map();
const rootBatches=[];
const batches=process.argv.slice(2);
if(!batches.length)throw Error('Pass observed batch JSON paths');
for(const filename of batches){
 if(!/^data\/observed\/e12_(batch|fulltext|roots)_/.test(filename))throw Error('Only verified observation batches accepted');
 const b=JSON.parse(await fs.readFile(filename,'utf8'));
 if(b.roots){rootBatches.push(b);continue;}
 if(b.updates){for(const u of b.updates)fulltexts.push({root:b.root_post_id,id:u[0],url:u[1],text:u[2],date:b.collected_at});continue;}
 if(b.progress_note)progressNotes.set(b.comment_root,b.progress_note);
 const ts=batchDate(b.collected_at);
 // Reuse legacy observation IDs when the verified identity tuple matches.
 const cid=r=>{
  const dt=serial(r[2]);
  const prior=Object.values(oldRows).flat().find(n=>n[3]===b.comment_root&&n[6]===r[0]&&n[13]===r[1]&&String(n[8]).replace(/\s+/g,'')===r[3].replace(/\s+/g,'')&&Math.abs((n[7] instanceof Date?n[7].getTime()/86400000+25569:n[7])-dt)<1/86400);
  return prior?.[4]||'obs_'+hash([b.comment_root,r[1],r[2],r[3]].join('|')).slice(0,32);
 };
 for(const r of b.comments){
  const [type,author,time,text,likes,count,parent,explicitReason]=r;
  if(!text.trim())throw Error('Blank text rejected');
  const dt=serial(time);let reason=explicitReason||null;
  if(dt<serial('24-8-27 00:00')||dt>=serial('24-9-4 00:00'))reason='out_of_event_window';
  if(parent!==null&&(!b.comments[parent]||b.comments[parent][0]!=='comment'))throw Error('Missing parent observation');
  const row=['weibo','E12',topics,b.comment_root,cid(r),type==='comment'?b.comment_root:null,type,dt,text,likes,null,count,type==='comment'?1:null,author,ts,null,parent===null?null:cid(b.comments[parent]),type==='comment'?'observed_root_comment':'thread_known_direct_parent_unknown',b.comment_source,reason?0:1,reason];
  const key=row[3]+'|'+row[4];if(known.has(key))continue;known.add(key);
  added[reason?'排除节点':type==='comment'?'评论节点':'回复节点'].push(row);
 }
 for(const r of b.reposts){
  const [url,time,text,likes]=r,parts=new URL(url).pathname.split('/'),id=parts[2];
  let reason=/^(转发微博|轉發微博|Repost)$/i.test(text.trim())?'default_repost':null;
  const dt=serial(time);if(dt<serial('24-8-27 00:00')||dt>=serial('24-9-4 00:00'))reason='out_of_event_window';
  const truncated=/\.\.\.\s*全文$/.test(text);
  const row=['weibo','E12',topics,b.repost_root,id,null,'repost',dt,text,likes,null,null,null,hash(parts[1]),ts,id,null,truncated?'root_association_only_parent_unknown;text_truncated=1':'root_association_only_parent_unknown',url,(reason||truncated)?0:1,reason];
  const key=row[3]+'|'+id;if(known.has(key))continue;known.add(key);
  added[reason?'排除节点':'转发节点'].push(row);
  if(!reason&&text.includes('//'))multi.push([b.repost_root,id,dt,text,null,truncated?'quoted_chain_not_verified_edge;text_truncated=1':'quoted_chain_not_verified_edge']);
 }
 if(b.root_text)modifications.push({id:b.comment_root,text:b.root_text,time:ts});
}
function append(name,data){
 if(!data.length)return;
 const s=wb.worksheets.getItem(name),existing=s.getUsedRange().values;
 const start=existing.length,cols=existing[0].length;
 if(data.some(r=>r.length!==cols))throw Error('Column mismatch '+name);
 for(let i=0;i<data.length;i++)s.getRangeByIndexes(start+i,0,1,cols).copyFrom(s.getRangeByIndexes(Math.max(1,start-1),0,1,cols),'all');
 const range=s.getRangeByIndexes(start,0,data.length,cols);range.values=data;range.format.autofitRows();
}
let addedRoots=0;
for(const b of rootBatches){
 const rs=wb.worksheets.getItem('全部候选根帖');
 const existing=new Set(rs.getUsedRange().values.slice(1).map(r=>r[2]));
 let count=0;
 for(const r of b.roots){
  const [page,uid,id,time,text,reposts,comments,likes,truncated]=r;
  if(existing.has(id))continue;
  if(time<'2024-08-27'||time>='2024-09-04'||!text.trim())throw Error('Invalid root record');
  const url=`https://weibo.com/${uid}/${id}`,source='https://s.weibo.com/weibo?q='+encodeURIComponent(b.topic)+'&page='+page;
  const status=id==='OuDxv8Uef'?'detail_verified;nodes_pending':'search_page_verified;created_at_pending_detail_check;nodes_pending';
  const n=rs.getUsedRange().rowCount;
  append('全部候选根帖',[['E12',b.topic,id,batchDate(time.replace(' ','T')+':00'),text,hash(uid),reposts,comments,likes,null,url,batchDate(b.collected_at),truncated,(text.match(/\[[^\]]+\]/g)||[]).join(' '),status,source]]);
  rs.getCell(n,9).formulas=[[`=IF(COUNT(G${n+1}:I${n+1})=3,SUM(G${n+1}:I${n+1}),"")`]];
  append('逐帖完整性',[[id,comments,reposts,0,0,0,0,'incomplete',status+(truncated?';正文截断待补齐':'')]]);
  existing.add(id);count++;addedRoots++;
 }
 append('话题遍历',[[b.topic,b.page_start,b.page_end,count,'partial',batchDate(b.collected_at),'https://s.weibo.com/weibo?q='+encodeURIComponent(b.topic)+'&page='+b.page_end,b.note]]);
}
for(const n of names)append(n,added[n]);
append('多级转发待核验',multi);
for(const u of fulltexts){
 const s=wb.worksheets.getItem('转发节点'),rs=s.getUsedRange().values,i=rs.findIndex(r=>r[3]===u.root&&r[4]===u.id);
 if(i<1||rs[i][18]!==u.url)throw Error('Fulltext identity mismatch '+u.id);
 s.getCell(i,8).values=[[u.text]];s.getCell(i,17).values=[['root_association_only_parent_unknown;fulltext_verified='+u.date]];s.getCell(i,19).values=[[rs[i][20]?0:1]];
 const original=oldRows['转发节点'].find(r=>r[3]===u.root&&r[4]===u.id);original[8]=u.text;original[17]='root_association_only_parent_unknown;fulltext_verified='+u.date;original[19]=original[20]?0:1;
  const ps=wb.worksheets.getItem('逐帖完整性'),pr=ps.getUsedRange().values,pi=pr.findIndex(r=>r[0]===u.root);
  if(pi>0&&String(pr[pi][8]).includes(u.id+'仍截断'))ps.getCell(pi,8).values=[[String(pr[pi][8]).replace(u.id+'仍截断，暂不用于情绪训练',u.id+'已核实补齐全文')]];
 const ms=wb.worksheets.getItem('多级转发待核验'),mr=ms.getUsedRange().values,mi=mr.findIndex(r=>r[0]===u.root&&r[1]===u.id);
 if(mi>0){ms.getCell(mi,3).values=[[u.text]];ms.getCell(mi,5).values=[['quoted_chain_not_verified_edge;fulltext_verified']];}
}
const rootSheet=wb.worksheets.getItem('全部候选根帖'),rootRows=rootSheet.getUsedRange().values;
for(const update of modifications){let i=rootRows.findIndex(r=>r[2]===update.id);if(i<1)throw Error('Root absent');rootSheet.getCell(i,4).values=[[update.text]];rootSheet.getCell(i,12).values=[[0]];rootSheet.getCell(i,14).values=[['partial_nodes;full_text_verified']];rootSheet.getRangeByIndexes(i,0,1,rootRows[0].length).format.autofitRows();}
const all=Object.fromEntries(names.map(n=>[n,rows(n).slice(1).filter(r=>r[4])]));
const progress=wb.worksheets.getItem('逐帖完整性'),p=progress.getUsedRange().values;
for(let i=1;i<p.length;i++){
 const id=p[i][0];if(!id)continue;
 const counts=names.map(n=>all[n].filter(r=>r[3]===id).length);
 progress.getRangeByIndexes(i,3,1,4).values=[counts];
 if(counts.some(Boolean)){
  progress.getCell(i,7).values=[['incomplete']];if(progressNotes.has(id))progress.getCell(i,8).values=[[progressNotes.get(id)]];
  const j=rootRows.findIndex(r=>r[2]===id);if(j>0&&!modifications.some(x=>x.id===id))rootSheet.getCell(j,14).values=[['partial_nodes']];
 }
}
const totals=Object.fromEntries(names.map(n=>[n,all[n].length]));
const info=wb.worksheets.getItem('说明与进度');
info.getRange('B4').values=[[`累计${rootRows.length-1}条候选根帖；${totals['评论节点']}条一级评论；${totals['回复节点']}条回复；${totals['转发节点']}条转发；${totals['排除节点']}条排除记录。`]];
const covered=new Set(Object.values(all).flat().map(r=>r[3])).size;
info.getRange('B5').values=[['已查一话题部分搜索页，'+covered+'个根帖有部分传播节点。不是全事件、不是最终热度前20，未冻结样本范围。']];
info.getRange('B11').values=[['继续话题遍历及未完评论、回复和转发列表。已核验表示平台原文核对，不代表内容主张为事实。']];
const ir=info.getUsedRange().values;for(let i=1;i<ir.length;i++)if(ir[i][0]==='截断转发')info.getCell(i,1).values=[['历史截断记录见原观察JSON；当前仍截断转发数：'+all['转发节点'].filter(r=>String(r[17]).includes('text_truncated=1')).length]];
append('说明与进度',[['本轮追加',JSON.stringify({根帖:addedRoots,...Object.fromEntries(names.map(n=>[n,added[n].length]))})],['本轮观察批次',batches.join('；')],['本轮补全文',fulltexts.length+'条既有转发，保留原身份和时间字段，不推断直接父节点。']]);
info.getUsedRange().format.autofitRows();
for(const n of names){const current=rows(n).slice(1).filter(r=>r[4]);for(const old of oldRows[n]){const found=current.find(r=>r[3]===old[3]&&r[4]===old[4]);if(JSON.stringify(found)!==JSON.stringify(old))throw Error('Existing row modified '+n+old[4]);}}
const ids=Object.values(all).flat().map(r=>r[3]+'|'+r[4]);if(new Set(ids).size!==ids.length)throw Error('Duplicate node IDs');
const comments=new Set(all['评论节点'].map(r=>r[4]));for(const r of [...all['回复节点'],...all['排除节点']])if(r[16]&&!comments.has(r[16]))throw Error('Orphan thread');
wb.recalculate();
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?',options:{useRegex:true,maxResults:20}})).ndjson);
const backup=path.join(out,'backup_before_'+Date.now()+'.xlsx');await fs.copyFile(file,backup,fs.constants.COPYFILE_EXCL);
await(await SpreadsheetFile.exportXlsx(wb)).save(file);
for(const n of ['说明与进度','全部候选根帖',...names,'多级转发待核验','逐帖完整性']){
 const s=wb.worksheets.getItem(n),last=s.getUsedRange().rowCount;
 const range=n==='说明与进度'?'A1:B11':n==='逐帖完整性'?'A1:I5':n==='全部候选根帖'?'C1:F4':n==='多级转发待核验'?`A${Math.max(1,last-2)}:F${last}`:`G${Math.max(1,last-2)}:U${last}`;
 const img=await wb.render({sheetName:n,range,scale:1,format:'png'});await fs.writeFile(path.join(out,'updated_'+n+'.png'),new Uint8Array(await img.arrayBuffer()));
}
console.log(JSON.stringify({addedRoots,roots:rootRows.length-1,added:Object.fromEntries(names.map(n=>[n,added[n].length])),totals,file}));
