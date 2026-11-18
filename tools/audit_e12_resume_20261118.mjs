import fs from 'node:fs/promises';
import {SpreadsheetFile,FileBlob} from '@oai/artifact-tool';
const dir='outputs/e12_verified_20261026';
const file=dir+'/韩国Deepfake_已核验采集表.xlsx';
const w=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const names=['评论节点','回复节点','转发节点','排除节点'];
const serial=v=>v instanceof Date?v.getTime()/86400000+25569:v;
const batch=JSON.parse(await fs.readFile('data/observed/e12_batch_20261118_1452.json','utf8'));
const corrected=Date.parse(batch.collected_at.slice(0,19)+'Z')/86400000+25569;
const original=Date.parse('2026-11-18T14:52:00Z')/86400000+25569;
const ids=new Set(batch.reposts.map(r=>r[0].split('/').pop()));
let repaired=0;
for(const name of names){
 const sheet=w.worksheets.getItem(name),rs=sheet.getUsedRange().values;
 for(let i=1;i<rs.length;i++)if(rs[i][3]===batch.repost_root&&ids.has(rs[i][4])&&Math.abs(serial(rs[i][14])-original)<1/86400){sheet.getCell(i,14).values=[[corrected]];repaired++;}
}
if(repaired){
 await fs.copyFile(file,dir+'/backup_before_timestamp_audit_'+Date.now()+'.xlsx');
 w.recalculate();await(await SpreadsheetFile.exportXlsx(w)).save(file);
}
const rows=n=>w.worksheets.getItem(n).getUsedRange().values.slice(1);
const nodes=names.flatMap(rows);
const keys=nodes.map(r=>r[3]+'|'+r[4]);
if(new Set(keys).size!==keys.length)throw Error('Duplicate ID');
if(nodes.some(r=>!r[8]))throw Error('Blank text');
const comments=new Set(rows('评论节点').map(r=>r[4]));
if(nodes.some(r=>r[16]&&!comments.has(r[16])))throw Error('Missing comment thread');
const canonical=nodes.map(r=>[r[3],r[6],r[13],Math.round(serial(r[7])*1440),String(r[8]).replace(/\s+/g,'')].join('|'));
const report={repairedCollectionTimestamps:repaired,totals:Object.fromEntries(names.map(n=>[n,rows(n).length])),duplicateIdentityTuples:canonical.length-new Set(canonical).size,roots:[]};
for(const id of ['OuDxv8Uef','Ouy72x6Cb']){
 const root=rows('全部候选根帖').find(r=>r[2]===id),start=serial(root[3]);
 const ns=nodes.filter(r=>r[3]===id&&r[19]===1);
 report.roots.push({id,counts:Object.fromEntries(names.map(n=>[n,rows(n).filter(r=>r[3]===id).length])),early6h:ns.filter(r=>serial(r[7])>=start&&serial(r[7])<start+0.25).length});
}
console.log(JSON.stringify(report));
for(const [sheet,range,label] of [['回复节点','G100:L110','reply'],['转发节点','G79:O85','repost'],['排除节点','G42:U45','excluded']]){
 const img=await w.render({sheetName:sheet,range,scale:1,format:'png'});
 await fs.writeFile(dir+'/audit_20261118_'+label+'.png',new Uint8Array(await img.arrayBuffer()));
}
