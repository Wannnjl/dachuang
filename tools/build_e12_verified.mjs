import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

// Only the separately recorded browser observations are accepted. Never import legacy E12 data.
const d=JSON.parse(await fs.readFile('data/observed/e12_verified_20261026.json','utf8'));
const out=path.resolve('outputs/e12_verified_20261026');
await fs.mkdir(out,{recursive:true});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const date=s=>new Date(s.replace(' ','T')+'Z'); // Excel local clock: source times are Asia/Shanghai.
const collected=date(d.collected_at.slice(0,19));
const topic='#多名韩女性在中国互联网求助#';
const root=d.root_post_id;
const url='https://weibo.com/1553184325/'+root;
const wb=Workbook.create();
function sheet(name,headers,rows){
 const s=wb.worksheets.add(name);
 s.getRangeByIndexes(0,0,rows.length+1,headers.length).values=[headers,...rows];
 s.showGridLines=false;s.freezePanes.freezeRows(1);
 const u=s.getUsedRange();u.format.font={name:'Arial',size:10};u.format.verticalAlignment='top';
 u.format.columnWidth=21;u.format.rowHeight=32;u.format.wrapText=true;
 s.getRangeByIndexes(0,0,1,headers.length).format={fill:'#1F4E78',font:{name:'Arial',size:10,color:'#FFFFFF',bold:true},wrapText:true,rowHeight:46};
 headers.forEach((h,i)=>{
  const r=s.getRangeByIndexes(0,i,rows.length+1,1);
  if(/text_raw|内容|note/.test(h)){r.format.columnWidth=76;r.format.wrapText=true;}
  if(/created_at|collected_at/.test(h)){r.format.columnWidth=22;if(rows.length)s.getRangeByIndexes(1,i,rows.length,1).setNumberFormat('yyyy-mm-dd hh:mm');}
  if(/url|source_page|author_hash|node_id|thread_comment_id/.test(h))r.format.columnWidth=40;
 });
 if(rows.length)s.getRangeByIndexes(1,0,rows.length,headers.length).format.autofitRows();
 return s;
}
const valid=d.nodes.filter(n=>!n[8]);
sheet('说明与进度',['项目','内容'],[
 ['事件','E12 韩国Deepfake性暴力与女性求助事件'],['时间范围','2024-08-27至2024-09-03，源时间按北京时间保存'],
 ['本批进度',`13条候选根帖；4条一级评论；20条文字回复；10条转发观察（含2条排除）`],
 ['完整性','仅一话题首页和一个根帖的部分节点。不是全事件、不是最终热度前20，未冻结样本范围。'],
 ['旧数据隔离','未导入原E12工作簿、初始化脚本或interim CSV。'],
 ['关系规则','回复的thread_comment_id确认所属评论；直接parent_node_id未知则留空，不能据此计算真实回复深度。转发链引用不等于已确认父节点。'],
 ['空值规则','平台未显示的计数留空，不写0。评论comment_count仅在明确显示共N条回复时填写，repost_count未知。'],
 ['文本规则','保留文字和表情含义，纯表情、图片评论、默认转发不进入情绪训练。@提及脱敏；文本中的事实指控未经事实核查。'],
 ['时间规则','本次记录的是2026年现时可见互动量，不是2024年历史互动快照。'],
 ['下一步','继续遍历全部结果及其他核心话题，补全截断根文；继续Ouz6wtwfX评论、回复与转发。'],
 ['采集批次时间',d.collected_at],...d.notes.map(n=>['记录说明',n])]);
const roots=[...d.roots].sort((a,b)=>((b[3]??-1)+b[4]+b[5])-((a[3]??-1)+a[4]+a[5]));
const rh=['event_id','topic','post_id','created_at','text_raw','author_hash','repost_count','comment_count','like_count','engagement_total','post_url','collected_at','text_truncated','emoji_alt','collection_status','source_page'];
const rr=roots.map(r=>['E12',topic,r[0],date(r[2]),r[7],hash(r[1]),r[3],r[4],r[5],null,`https://weibo.com/${r[1]}/${r[0]}`,collected,r[6],r[8],r[0]===root?'partial_nodes':'search_page_only',d.source_page]);
const rs=sheet('全部候选根帖',rh,rr);
rr.forEach((r,i)=>{rs.getCell(i+1,9).formulas=[[`=IF(COUNT(G${i+2}:I${i+2})=3,SUM(G${i+2}:I${i+2}),"")`]]});
const idMap=new Map(d.nodes.map(n=>[n[0],'obs_'+hash([root,n[3],n[4],n[5]].join('|')).slice(0,32)]));
const nh=['platform','event_id','topic','root_post_id','node_id','parent_node_id','node_type','created_at','text_raw','like_count','repost_count','comment_count','depth','author_hash','collected_at','platform_node_id','thread_comment_id','parent_relation_status','source_url','emotion_eligible','exclusion_reason'];
const nr=d.nodes.map(n=>['weibo','E12',topic,root,idMap.get(n[0]),n[1]==='comment'?root:null,n[1],date(n[4]),n[5],n[6],null,n[7],n[1]==='comment'?1:null,n[3],collected,null,n[2]?idMap.get(n[2]):null,n[1]==='comment'?'observed_root_comment':'thread_known_direct_parent_unknown',url+'#comment',n[8]?0:1,n[8]||null]);
sheet('评论节点',nh,nr.filter(r=>r[6]==='comment'));
sheet('回复节点',nh,nr.filter(r=>r[6]==='reply'&&!r[20]));
const rp=d.reposts.map(r=>{let parts=new URL(r[0]).pathname.split('/');return ['weibo','E12',topic,root,parts[2],null,'repost',date(r[1]),r[2],r[3],null,null,null,hash(parts[1]),collected,parts[2],null,'root_association_only_parent_unknown',r[0],r[4]?0:1,r[4]||null];});
sheet('转发节点',nh,rp.filter(r=>!r[20]));
sheet('排除节点',nh,[...nr.filter(r=>r[20]),...rp.filter(r=>r[20])]);
sheet('多级转发待核验',['root_post_id','node_id','created_at','text_raw','parent_node_id','relation_status'],rp.filter(r=>r[8].includes('//')).map(r=>[root,r[4],r[7],r[8],null,'quoted_chain_not_verified_edge']));
sheet('逐帖完整性',['post_id','reported_comments','reported_reposts','collected_comments','collected_replies','collected_reposts','excluded_nodes','status','note'],roots.map(r=>[r[0],r[4],r[3],r[0]===root?4:0,r[0]===root?20:0,r[0]===root?8:0,r[0]===root?4:0,'incomplete',r[0]===root?'仅部分可见节点；排除表含2图片回复、1纯表情转发、1默认转发':'尚未采集传播节点']));
sheet('话题遍历',['topic','page_start','page_end','candidate_count','status','collected_at','source_page','note'],[[topic,1,1,13,'partial',collected,d.source_page,'页面显示286条、29页，混入区间外结果；只保留本页范围内13条，其他话题未遍历。']]);
if(new Set(rr.map(r=>r[2])).size!==rr.length)throw Error('Duplicate roots');
if(new Set(nr.map(r=>r[4])).size!==nr.length)throw Error('Duplicate nodes');
if(nr.some(r=>r[16]&&!nr.some(p=>p[4]===r[16])))throw Error('Missing thread comment');
wb.recalculate();
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?',options:{useRegex:true,maxResults:10}})).ndjson);
for(const s of wb.worksheets.items){const preview=await wb.render({sheetName:s.name,range:s.name==='说明与进度'?'A1:B11':'A1:F4',scale:1,format:'png'});await fs.writeFile(path.join(out,s.name+'.png'),new Uint8Array(await preview.arrayBuffer()));}
await(await SpreadsheetFile.exportXlsx(wb)).save(path.join(out,'韩国Deepfake_已核验采集表.xlsx'));
console.log(JSON.stringify({roots:rr.length,comments:4,replies:20,reposts:8,excluded:4,output:out}));
