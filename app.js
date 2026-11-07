const db = (window.STARMATCH_DATA || []).filter(i => ['第一類群','第二類群','第三類群'].includes(i['類群']));
const subjects = {ch:'國文',en:'英文',ma:'數學A',mb:'數學B',so:'社會',sc:'自然'};
const points = {'頂標':5,'前標':4,'均標':3,'後標':2,'底標':1,'--':0};
let hasSearched = false;
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
function matches(i, f) {
 if(f.group!=='ALL' && i['類群']!==f.group) return false;
 const searchable=(i['校系代碼名稱']+' '+i['學系代碼']).replace(/台/g,'臺').toLowerCase();
 if(f.keyword && !f.keyword.replace(/台/g,'臺').split(/\s+/).every(word=>searchable.includes(word))) return false;
 const pub=/^(國立|臺北市立)/.test(i['學校名稱']);
 if(f.type==='PUBLIC'&&!pub || f.type==='PRIVATE'&&pub) return false;
 if(f.region!=='ALL' && region(i)!==f.region) return false;
 if(!Number.isInteger(f.rank) || f.rank<1 || f.rank>i['在校排名門檻']) return false;
 const hearing={'A級':3,'B級':2,'C級':1,'--':0};
 if((hearing[i['大考英聽檢定']] ?? Infinity)>(f.hearing ?? 0)) return false;
 const pass = (id,s) => (points[i[s+'檢定']] ?? Infinity)<=(f.levels[id] ?? 0);
 const bothMath = points[i['數學A檢定']]>0 && points[i['數學B檢定']]>0;
 const mathPass = !bothMath ? pass('ma','數學A') && pass('mb','數學B') :
   (f.levels.ma!==null && f.levels.ma>=points[i['數學A檢定']]) ||
   (f.levels.mb!==null && f.levels.mb>=points[i['數學B檢定']]);
 return mathPass && Object.entries(subjects).filter(([id])=>!['ma','mb'].includes(id)).every(([id,s])=>pass(id,s));
}
function renderHistory(i,yr) {
 const url=i[yr+'_來源'];
 const page=i[yr+'_頁碼'];
 const source=url?`<a class="block my-2 text-blue-700 underline font-bold" href="${esc(url)}${page?'#page='+page:''}" target="_blank" rel="noopener noreferrer">${yr} 官方錄取表 ↗</a>`:'';
 if(!Object.hasOwn(i,yr+'_一輪人數')) return `<div class="bg-slate-50 rounded-lg p-2 text-xs text-slate-400"><b>${yr} 無對應資料</b>${source}</div>`;
 const brief=v=>esc(String(v ?? '--').split(/\\n|\n/)[0]);
 const full=v=>esc(String(v ?? '--').replace(/\\n/g,'\n'));
 return `<div class="bg-slate-50 rounded-lg p-2 text-xs"><b>${yr} 錄取</b><br>一輪：${brief(i[yr+'_一輪人數'])} 人（${brief(i[yr+'_一輪標準'])}）<br>二輪：${brief(i[yr+'_二輪人數'])} 人（${brief(i[yr+'_二輪標準'])}）${source}<details class="mt-2"><summary class="cursor-pointer text-blue-700">完整比序標準</summary><p class="whitespace-pre-line mt-2">比序項目：${full(i[yr+'_分發項目'])}\n\n第一輪：\n${full(i[yr+'_一輪標準'])}\n\n第二輪：\n${full(i[yr+'_二輪標準'])}</p></details></div>`;
}
function firstSearch() {
 alert('【溫馨提醒】\n\n本系統僅供初步參考。請務必詳閱簡章，並與老師及家長討論。祝福您金榜題名！');
 hasSearched = true;
 el('search-section').style.display='block';
 runFilter();
}
function runFilter() {
 if(!hasSearched) return;
 const rank=el('rank').value;
 if(rank==='' || !Number.isInteger(Number(rank)) || Number(rank)<1 || Number(rank)>100) {
  el('result-container').textContent='請先填寫校內排名百分比（1 至 100 的整數），再進行篩選。';el('result-count').textContent='請確認輸入';return;
 }
 const f={rank:Number(rank),hearing:Number(el('hearing').value || 0),group:el('groupFilter').value,region:el('regionFilter').value,type:el('typeFilter').value,keyword:el('keyword').value.trim().toLowerCase(),levels:Object.fromEntries(Object.keys(subjects).map(id=>[id,Number(el(id).value || 0)]))};
 const res=db.filter(i=>matches(i,f));
 el('result-count').textContent=`${res.length} 筆`;
 el('result-container').innerHTML=(res.length?res.map(i=>{
 const seq=['一','二','三','四','五','六','七'].map(n=>i['分發比序項目'+n]).filter(Boolean);
 const details=['大考英聽檢定','術科考試','術科項目1檢定','術科項目2檢定','術科項目3檢定','術科項目4檢定','術科項目5檢定','預計甄試人數','甄試費用','寄發或公告甄試通知','甄試日期起','甄試日期迄','榜示日期','複查日期','指定項目甄試','指定項目佔分比例','指定項目說明','備註'].filter(k=>i[k]!==null && i[k]!==undefined && i[k]!=='--').map(k=>`<p class="mb-2 whitespace-pre-line"><b>${esc(k)}：</b>${esc(i[k])}</p>`).join('');
 return `<article class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><div class="text-xs text-blue-700 font-bold">${esc(i['類群'])} · 校系代碼 ${esc(i['學系代碼'])} · <a href="${esc(i['116_分則網址'])}" target="_blank" rel="noopener noreferrer" class="underline">查看簡章</a></div><h3 class="text-base font-black my-2">${esc(i['校系代碼名稱'])}</h3><p class="text-sm mb-3">在校排名前 ${esc(i['在校排名門檻'])}% · 招生 ${esc(i['招生名額'])} 名 · 外加 ${esc(i['外加名額'])} 名</p><div class="flex justify-between bg-slate-50 p-2 rounded-xl">${Object.values(subjects).map(s=>`<div class="text-center text-xs">${s}<span class="std-tag tag-${esc(i[s+'檢定']==='--'?'不採計':i[s+'檢定'])}">${esc(i[s+'檢定'])}</span></div>`).join('')}</div><details class="text-xs my-3"><summary class="cursor-pointer text-blue-700 font-bold">116 比序、甄試及校系說明</summary><div class="mt-3"><p class="mb-3"><b>分發比序：</b>${seq.map(esc).join(' → ')}</p>${details}</div></details><div class="grid grid-cols-2 md:grid-cols-4 gap-2">${['115','114','113','112'].map(y=>renderHistory(i,y)).join('')}</div></article>`;
 }).join(''):'<p class="p-10 text-center">查無符合條件的校系。請確認已填校內排名、應考科目五標與英聽；也可清除進階條件後重試。</p>');
}
el('data-status').textContent=db.length?`116 · ${db.length} 筆`:'載入失敗';
el('btn-search').disabled=!db.length;

function resetAdvanced() {
 el('keyword').value=''; el('regionFilter').value='ALL';el('typeFilter').value='ALL';runFilter();
}
for(const id of ['rank',...Object.keys(subjects),'hearing','groupFilter']) {
 el(id).addEventListener('change',()=>{if(hasSearched) runFilter();});
}

