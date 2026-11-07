const db = (window.STARMATCH_DATA || []).filter(i => ['第一類群','第二類群','第三類群'].includes(i['類群']));
const subjects = {ch:'國文',en:'英文',ma:'數學A',mb:'數學B',so:'社會',sc:'自然'};
const points = {'頂標':5,'前標':4,'均標':3,'後標':2,'底標':1,'--':0};
let hasSearched = false;
let view = "pass", page = 1;
const pageSize = 24;
let currentFilter = null;
let saved = new Set();
let storageAvailable = true;
try { const ids=JSON.parse(localStorage.getItem("starmatch-116-saved") || "[]"); if(Array.isArray(ids)) saved=new Set(ids.filter(id=>db.some(i=>i["學系代碼"]===id))); } catch { storageAvailable=false; }
const el = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function region(i) {
 const campus=(i['學系名稱'] || '').match(/[（(]([^()（）]*校區)[)）]/);
 const a=campus && /高雄|臺北|台北|桃園|臺南|台南/.test(campus[1]) ? campus[1] : (i['學校地址'] || '');
 if (/金門|澎湖|連江/.test(a)) return 'ISLAND';
 if (/宜蘭|花蓮|臺東|台東/.test(a)) return 'EAST';
 if (/苗栗|臺中|台中|彰化|南投|雲林/.test(a)) return 'CENTRAL';
 if (/嘉義|臺南|台南|高雄|屏東/.test(a)) return 'SOUTH';
 if (/臺北|台北|新北|基隆|桃園|新竹/.test(a)) return 'NORTH';
 return '';
}
const hearingPoints = {'A級':3,'B級':2,'C級':1,'--':0};
const years = ['115','114','113','112'];
const full = v => String(v ?? '--').replace(/\\n/g,'\n');
function eligibilityReasons(i,f) {
 const reasons=[];
 if(!Number.isInteger(f.rank)||f.rank<1||f.rank>100) reasons.push('尚未填寫有效的校內排名百分比');
 else if(f.rank>i['在校排名門檻']) reasons.push(`校內排名 ${f.rank}%，未達前 ${i['在校排名門檻']}%`);
 const check=(id,s)=>{const required=points[i[s+'檢定']] ?? Infinity; if(required>(f.levels[id]??0)) reasons.push(`${s}需${i[s+'檢定']}，目前${f.levels[id]?['','底標','後標','均標','前標','頂標'][f.levels[id]]:'未填／未達底標'}`);};
 const both=points[i['數學A檢定']]>0&&points[i['數學B檢定']]>0;
 for(const [id,s] of Object.entries(subjects)) if(!['ma','mb'].includes(id)) check(id,s);
 if(both) {
  if((f.levels.ma??0)<points[i['數學A檢定']]&&(f.levels.mb??0)<points[i['數學B檢定']]) reasons.push(`數A需${i['數學A檢定']}或數B需${i['數學B檢定']}（擇一），目前兩科皆未達`);
 } else {check('ma','數學A');check('mb','數學B');}
 if((hearingPoints[i['大考英聽檢定']]??Infinity)>(f.hearing??0)) reasons.push(`英聽需${i['大考英聽檢定']}，目前${f.hearing?['','C級','B級','A級'][f.hearing]:'未填／F級'}`);
 return reasons;
}
function matchesContext(i,f) {
 if(f.group!=='ALL'&&i['類群']!==f.group) return false;
 const searchable=(i['校系代碼名稱']+' '+i['學系代碼']).replace(/台/g,'臺').toLowerCase();
 if(f.keyword&&!f.keyword.replace(/台/g,'臺').split(/\s+/).every(t=>searchable.includes(t))) return false;
 const pub=/^(國立|臺北市立)/.test(i['學校名稱']);
 if(f.type==='PUBLIC'&&!pub||f.type==='PRIVATE'&&pub) return false;
 return f.region==='ALL'||region(i)===f.region;
}
function matches(i,f){return matchesContext(i,f)&&!eligibilityReasons(i,f).length;}
function readFilter() {
 const raw=el('rank').value;
 return {rank:raw===''?null:Number(raw),hearing:Number(el('hearing').value||0),group:el('groupFilter').value,region:el('regionFilter').value,type:el('typeFilter').value,keyword:el('keyword').value.trim().toLowerCase(),levels:Object.fromEntries(Object.keys(subjects).map(k=>[k,Number(el(k).value||0)]))};
}
function validRank(f){return Number.isInteger(f.rank)&&f.rank>=1&&f.rank<=100;}
function renderHistory(i,yr) {
 const url=i[yr+'_來源'],pn=i[yr+'_頁碼'];
 const link=url?`<a href="${esc(url)}${pn?'#page='+pn:''}" target="_blank" rel="noopener noreferrer">${yr} 官方錄取表 ↗</a>`:'';
 if(!Object.hasOwn(i,yr+'_一輪人數'))return `<div class="history"><b>${yr}</b><p class="muted">無對應資料</p>${link}</div>`;
 const brief=v=>esc(full(v).split('\n')[0]);
 return `<div class="history"><b>${yr} 錄取</b><p>一輪 ${brief(i[yr+'_一輪人數'])} 人（${brief(i[yr+'_一輪標準'])}）<br>二輪 ${brief(i[yr+'_二輪人數'])} 人（${brief(i[yr+'_二輪標準'])}）</p>${link}<details><summary>完整比序標準</summary><p>比序項目：\n${esc(full(i[yr+'_分發項目']))}\n\n第一輪：\n${esc(full(i[yr+'_一輪標準']))}\n\n第二輪：\n${esc(full(i[yr+'_二輪標準']))}</p></details></div>`;
}
function firstSearch() {
 alert('【溫馨提醒】\n\n本系統僅供初步參考。請務必詳閱簡章，並與老師及家長討論。祝福您金榜題名！');
 hasSearched=true;el('search-section').hidden=false;runFilter();
 if(!validRank(readFilter())){el('rank').focus();return;}
 if(window.matchMedia('(max-width: 1024px)').matches)el('score-editor').open=false;
}
function setView(next){view=next;page=1;renderResults();}
function runFilter() {
 if(!hasSearched)return;
 currentFilter=readFilter();page=1;updateScoreSummary();renderResults();renderSaved();
}
function renderCard(i,failed=false) {
 const id=i['學系代碼'];
 const seq=['一','二','三','四','五','六','七'].map(n=>i['分發比序項目'+n]).filter(Boolean);
 const detail=['大考英聽檢定','備註'].filter(k=>i[k]!=null&&i[k]!=='--').map(k=>`<p><b>${esc(k)}：</b>${esc(i[k])}</p>`).join('');
 return `<article class="result-card ${failed?'failed-card':''}">${failed?'<p class="failure-label">未通過成績門檻 · 供查詢原因</p>':''}<div class="card-top"><div><p class="meta">${esc(i['類群'])} · ${esc(id)} <a href="${esc(i['116_分則網址'])}" target="_blank" rel="noopener noreferrer">查看簡章</a></p><h3>${esc(i['校系代碼名稱'])}</h3></div><button class="save-button ${saved.has(id)?'saved':''}" aria-label="${saved.has(id)?'取消收藏':'收藏'}${esc(i['校系代碼名稱'])}" aria-pressed="${saved.has(id)}" onclick="toggleSaved('${id}')">${saved.has(id)?'已收藏':'＋ 收藏'}</button></div><p class="seats">校排前 ${esc(i['在校排名門檻'])}% · 招生 ${esc(i['招生名額'])} 名 · 外加 ${esc(i['外加名額'])} 名</p>${failed?`<ul class="reasons">${eligibilityReasons(i,currentFilter).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}<div class="thresholds">${Object.values(subjects).map(s=>`<div>${s}<b>${esc(i[s+'檢定'])}</b></div>`).join('')}<div>英聽<b>${esc(i['大考英聽檢定'])}</b></div></div><details><summary>116 比序與校系說明</summary><div class="details-body"><p>${seq.map(esc).join(' → ')}</p>${detail}</div></details><div class="history-grid">${years.map(y=>renderHistory(i,y)).join('')}</div></article>`;
}
function renderResults() {
 for(const name of ['pass','fail']){el('tab-'+name).classList.toggle('active',view===name);el('tab-'+name).setAttribute('aria-pressed',String(view===name));}
 el('failure-search').hidden=view!=='fail';
 el('pagination').innerHTML='';
 if(!hasSearched){el('result-container').innerHTML='<div class="empty">填妥成績，按「執行篩選」開始查詢。</div>';return;}
 currentFilter=readFilter();
 if(!validRank(currentFilter)){el('result-count').textContent='請填校排';el('result-container').innerHTML='<div class="empty">請先填寫校內排名百分比（1 至 100 的整數）。</div>';return;}
 const context=db.filter(i=>matchesContext(i,currentFilter));
 const pass=context.filter(i=>!eligibilityReasons(i,currentFilter).length);
 el('result-count').textContent=pass.length+' 筆';
 let list=pass;
 if(view==='fail'){
  const query=el('failure-keyword').value.trim().replace(/台/g,'臺').toLowerCase();
  if(!query){el('result-container').innerHTML='<div class="empty">輸入想查的校名、系名或代碼，查看未通過原因。</div>';return;}
  list=context.filter(i=>eligibilityReasons(i,currentFilter).length&&query.split(/\s+/).every(t=>(i['校系代碼名稱']+' '+i['學系代碼']).replace(/台/g,'臺').toLowerCase().includes(t)));
 }
 const max=Math.max(1,Math.ceil(list.length/pageSize));page=Math.min(Math.max(1,page),max);
 el('result-container').innerHTML=list.length?list.slice((page-1)*pageSize,page*pageSize).map(i=>renderCard(i,view==='fail')).join(''):`<div class="empty">${view==='fail'?'找不到符合搜尋條件的未通過校系。它可能已達門檻，或被進階條件排除；請查看符合條件清單或清除進階條件。':'查無符合條件的校系。請確認成績與英聽，或清除進階條件。'}</div>`;
 if(list.length)el('pagination').innerHTML=`<button onclick="changePage(-1)" ${page===1?'disabled':''}>上一頁</button><span>${view==='fail'?'未通過':'符合條件'} ${list.length} 筆 · ${page} / ${max} 頁</span><button onclick="changePage(1)" ${page===max?'disabled':''}>下一頁</button>`;
}
function changePage(delta){page+=delta;renderResults();el('result-container').scrollIntoView({behavior:'smooth',block:'start'});}
function resetAdvanced(){el('keyword').value='';el('regionFilter').value='ALL';el('typeFilter').value='ALL';runFilter();}
function persistSaved(){try{localStorage.setItem('starmatch-116-saved',JSON.stringify([...saved]));}catch{storageAvailable=false;}}
function toggleSaved(id){if(!db.some(i=>i['學系代碼']===id))return;saved.has(id)?saved.delete(id):saved.add(id);persistSaved();renderResults();renderSaved();}
function clearSaved(){if(saved.size&&confirm('要清空這台裝置的收藏嗎？')){saved.clear();persistSaved();renderResults();renderSaved();}}
function groupKey(i){return i['學校代碼']+'|'+i['類群'];}
function renderSaved(){
 el('saved-count').textContent=saved.size;
 el('saved-message').textContent=storageAvailable?'':'瀏覽器無法儲存收藏，目前僅保留至本頁關閉。';
 const items=db.filter(i=>saved.has(i['學系代碼']));
 const select=el('compare-group'),previous=select.value;
 const groups=[...new Set(items.map(groupKey))];
 select.innerHTML=groups.length?groups.map(k=>{const i=items.find(i=>groupKey(i)===k);return `<option value="${esc(k)}">${esc(i['學校名稱'])} · ${esc(i['類群'])}（${items.filter(i=>groupKey(i)===k).length} 系）</option>`;}).join(''):'<option value="">尚無收藏</option>';
 select.value=groups.includes(previous)?previous:(groups[0]||'');
 const selected=items.filter(i=>groupKey(i)===select.value);
 el('print-button').disabled=!items.length;
 el('print-button').textContent='列印全部收藏（'+items.length+'）';
 if(!selected.length){el('comparison-container').innerHTML='<div class="empty">在校系卡片按「收藏」，建立你的討論清單。</div>';return;}
 el('comparison-container').innerHTML=`<p class="hint">${selected.length} 個候選科系。平板及手機可左右滑動比較表。</p><div class="compare-scroll" tabindex="0" role="region" aria-label="候選校系比較表"><table class="compare-table"><thead><tr><th>候選校系</th><th>116 名額與門檻</th>${years.map(y=>`<th>${y} 錄取與比序</th>`).join('')}</tr></thead><tbody>${selected.map(i=>{
  const f=readFilter(),checked=hasSearched&&validRank(f),reasons=checked?eligibilityReasons(i,f):[];
  return `<tr><th scope="row">${esc(i['學系名稱'])}<p class="meta">${esc(i['學系代碼'])}</p><p class="${reasons.length?'status-fail':'status-pass'}">${!checked?'尚未檢核成績':reasons.length?'未通過門檻':'符合成績門檻'}</p>${reasons.length?`<p class="hint">${reasons.map(esc).join('；')}</p>`:''}<button class="text-button" onclick="toggleSaved('${i['學系代碼']}')">移除收藏</button></th><td>招生 ${esc(i['招生名額'])} 名<br>外加 ${esc(i['外加名額'])} 名<br>校排前 ${esc(i['在校排名門檻'])}%<details><summary>116 門檻與比序</summary><p>${Object.values(subjects).map(s=>`${s} ${esc(i[s+'檢定'])}`).join('、')}；英聽 ${esc(i['大考英聽檢定'])}</p><p>${['一','二','三','四','五','六','七'].map(n=>i['分發比序項目'+n]).filter(Boolean).map(esc).join(' → ')}</p></details><a href="${esc(i['116_分則網址'])}" target="_blank" rel="noopener noreferrer">查看簡章</a></td>${years.map(y=>`<td>${renderHistory(i,y)}</td>`).join('')}</tr>`;
 }).join('')}</tbody></table></div>`;
}
let activePage = 'search';
const pageScroll = {search:0,saved:0};
function applyPageRoute(initial=false) {
 const next=window.location.hash==='#saved'?'saved':'search';
 if(!initial && next===activePage)return;
 if(!initial)pageScroll[activePage]=window.scrollY || 0;
 activePage=next;
 el('search-page').hidden=next!=='search';
 el('saved-page').hidden=next!=='saved';
 el('saved-nav').hidden=next==='saved';
 el('return-nav').hidden=next!=='saved';
 document.title=next==='saved'?'收藏與比較｜116年繁星推薦落點建議':'116年繁星推薦落點建議';
 if(next==='saved')renderSaved();
 requestAnimationFrame(()=>{
  el(next==='saved'?'saved-page-title':'search-title').focus({preventScroll:true});
  window.scrollTo({top:pageScroll[next],behavior:'instant'});
 });
}
function openSaved(){if(window.location.hash!=='#saved')window.location.hash='saved';else applyPageRoute();}
function openSearch(){if(window.location.hash!=='#search')window.location.hash='search';else applyPageRoute();}
window.addEventListener('hashchange',()=>applyPageRoute());

function printDiscussion(){
 const items=db.filter(i=>saved.has(i['學系代碼']));
 if(!items.length)return;
 const f=readFilter(),checked=hasSearched&&validRank(f);
 const scores=checked?`校內排名 ${f.rank}%；${Object.entries(subjects).map(([k,s])=>s+' '+(['未填／未達底標','底標','後標','均標','前標','頂標'][f.levels[k]])).join('；')}；英聽 ${['未填／F級','C級','B級','A級'][f.hearing]}`:'尚未提供完整有效的校排，成績未檢核。';
 const note=el('discussion-notes').value;
 const overview=`<h1>116 繁星推薦・師生討論單</h1><h2>全部收藏 ${items.length} 系 · ${new Set(items.map(i=>i['學校代碼'])).size} 所大學</h2><p>${esc(scores)}</p><p>姓名：________________　班級：________________　討論日期：________________</p>${note?`<p>討論筆記：${esc(note)}</p>`:''}<table class="print-overview"><thead><tr><th>候選科系</th><th>招生名額</th><th>外加名額</th><th>校排門檻</th><th>本次成績檢核</th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i['校系代碼名稱'])}（${esc(i['學系代碼'])}）<br>${esc(i['類群'])}</td><td>${esc(i['招生名額'])}</td><td>${esc(i['外加名額'])}</td><td>前${esc(i['在校排名門檻'])}%</td><td>${!checked?'未檢核':eligibilityReasons(i,f).length?esc(eligibilityReasons(i,f).join('；')):'符合成績門檻'}</td></tr>`).join('')}</tbody></table>`;
 const historicalOverview=`<h2>歷年錄取比較</h2><table><thead><tr><th>候選科系</th>${years.map(y=>`<th>${y} 錄取</th>`).join('')}</tr></thead><tbody>${items.map(i=>`<tr><th>${esc(i['校系代碼名稱'])}<br>${esc(i['類群'])}</th>${years.map(y=>`<td>${!Object.hasOwn(i,y+'_一輪人數')?'無對應資料':esc('一輪 '+i[y+'_一輪人數']+' 人（'+full(i[y+'_一輪標準']).split('\n')[0]+'）\n二輪 '+i[y+'_二輪人數']+' 人（'+full(i[y+'_二輪標準']).split('\n')[0]+'）')}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="print-footnote">括號為第一項在校排名標準；各校系完整比序見後附明細。</p>`;
 const detail=items.map(i=>`<section class="print-candidate"><h2>${esc(i['校系代碼名稱'])}</h2><p>116 門檻：${Object.values(subjects).map(s=>s+' '+esc(i[s+'檢定'])).join('；')}；英聽 ${esc(i['大考英聽檢定'])}</p><p>116 比序：${['一','二','三','四','五','六','七'].map(n=>i['分發比序項目'+n]).filter(Boolean).map(esc).join(' → ')}</p><table><thead><tr>${years.map(y=>`<th>${y} 錄取紀錄</th>`).join('')}</tr></thead><tbody><tr>${years.map(y=>`<td>${!Object.hasOwn(i,y+'_一輪人數')?'無對應資料':esc('一輪 '+i[y+'_一輪人數']+' 人；二輪 '+i[y+'_二輪人數']+' 人\n\n比序項目：\n'+full(i[y+'_分發項目'])+'\n\n一輪標準：\n'+full(i[y+'_一輪標準'])+'\n\n二輪標準：\n'+full(i[y+'_二輪標準']))}</td>`).join('')}</tr></tbody></table></section>`).join('');
 el('print-area').innerHTML=overview+historicalOverview+detail+'<p class="print-footnote">符合成績門檻不代表錄取。高中推薦資格、校內推薦順序與正式選填，請依116簡章及所屬高中規定辦理。歷年資料僅供參考。</p>';
 window.print();
}
el('data-status').textContent=db.length?`116 · ${db.length.toLocaleString()} 筆`:'載入失敗';el('btn-search').disabled=!db.length;
for(const id of ['rank',...Object.keys(subjects),'hearing','groupFilter'])el(id).addEventListener('change',()=>{if(hasSearched)runFilter();else {updateScoreSummary();renderSaved();}});
renderSaved();

applyPageRoute(true);

function updateScoreSummary(){
 const f=readFilter();
 const rank=validRank(f)?'校排 '+f.rank+'%':'校排未填';
 const names={ch:'國',en:'英',ma:'數A',mb:'數B',so:'社',sc:'自'};
 const text=Object.entries(names).filter(([id])=>f.levels[id]>0).map(([id,n])=>n+['','底','後','均','前','頂'][f.levels[id]]).join(' · ');
 el('score-summary-text').textContent=rank+(text?' · '+text:'');
 el('rank').setAttribute('aria-invalid',String(hasSearched&&!validRank(f)));
}
for(const id of ['rank',...Object.keys(subjects),'hearing','groupFilter','keyword'])el(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();firstSearch();}});
updateScoreSummary();
