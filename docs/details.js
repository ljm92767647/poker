let opponentStage='river',selectedCategory=null;
const precise=v=>v===0?'0%':v<.01?'<0.01%':v.toFixed(2)+'%';
const detailTab=document.createElement('button');detailTab.dataset.tab='details';detailTab.textContent='상세 확률';detailTab.onclick=()=>showTab('details');$('.tabs').append(detailTab);
const detailView=document.createElement('section');detailView.id='details';detailView.className='view';detailView.hidden=true;
detailView.innerHTML=`<div class="detailheading"><div><span class="eyebrow">READ THE WHOLE TABLE</span><h2>내 패와 보드의 상세 확률</h2><p>상대가 가질 수 있는 패, 내가 만날 바닥패를 나눠 살펴보세요.</p></div><button class="outlinebtn" id="backToCards">카드 설정으로 돌아가기</button></div><div id="detailCards" class="detailcards"></div><div class="detailgrid"><div class="panel opponentpanel"><div class="sectiontitle"><h2>상대는 어떤 족보일까?</h2><span class="pill" id="opponentMethod">플랍 이후</span></div><div class="segment" role="group" aria-label="상대 족보 시점"><button id="opponentNow">현재 족보 · 참고</button><button id="opponentRiver" class="active">최종 족보 · 리버까지</button></div><p id="opponentExplain"></p><div id="opponentStats"></div><div class="tablewrap"><table class="probtable"><thead><tr><th>족보</th><th id="oneOpponentLabel">상대 한 명</th><th>누군가 한 명 이상</th></tr></thead><tbody id="opponentTable"></tbody></table></div><div id="opponentSamples"></div><p class="hint" id="opponentNote"></p></div><div class="panel flopdetail"><div class="sectiontitle"><h2>내 패를 받고 만날 플랍</h2><span class="pill">전수 계산</span></div><p id="flopExplain"></p><h3>바닥패의 숫자 구성</h3><div id="flopTexture"></div><h3>바닥패의 무늬 구성</h3><div id="flopSuits"></div><h3>내 패와 연결되는 상황</h3><div id="flopEvents"></div><p class="hint">각 구성 안의 항목은 합계 100%입니다. 연결되는 상황은 서로 겹칠 수 있습니다. 이미 선택한 바닥패와 관계없이, 내 패를 받았던 시점의 가능한 플랍을 비교합니다.</p><details><summary>플랍에서 내 족보가 완성될 확률</summary><div id="flopHero"></div><p class="hint">내 패 2장과 플랍 3장으로 만든 가장 좋은 족보. 드로는 완성된 족보가 아닙니다.</p></details></div><div class="panel futurepanel"><div class="sectiontitle"><h2>다음 바닥패 · 숫자와 무늬별</h2><span class="pill">정확한 출현 확률</span></div><p id="futureExplain"></p><div class="futuregrid"><div><h3>숫자별</h3><div class="tablewrap"><table class="probtable"><thead><tr><th>숫자</th><th>남은 장수</th><th>다음 한 장</th><th>리버까지 ≥1장</th></tr></thead><tbody id="futureRanks"></tbody></table></div></div><div><h3>무늬별</h3><div id="futureSuits"></div><div id="futureInfo" class="callout"></div></div></div><p class="hint">리버까지 확률은 남은 바닥패에서 해당 숫자·무늬가 한 번 이상 나오는 확률입니다. 여러 숫자·무늬가 함께 나올 수 있어 이 열은 합계 100%가 아닙니다. 상대의 미지 패와 번 카드는 따로 제외하지 않고 알려진 카드만 제외합니다.</p></div></div>`;
$('footer').before(detailView);$('#backToCards').onclick=()=>showTab('lab');
const summaryPanel=document.createElement('div');summaryPanel.className='panel opponentsummary';summaryPanel.innerHTML=`<div class="sectiontitle"><h2>상대의 최종 족보 가능성</h2><button class="outlinebtn" id="openDetails">상세 확률 보기</button></div><div id="opponentPreview"></div><p class="hint" id="opponentPreviewNote">플랍 3장을 선택하면 가능한 상대 패를 분석합니다.</p>`;
$('.tablepanel').after(summaryPanel);$('#openDetails').onclick=()=>showTab('details');
$('#opponentNow').onclick=()=>{opponentStage='now';selectedCategory=null;if(result)renderOpponentDetails(result)};
$('#opponentRiver').onclick=()=>{opponentStage='river';selectedCategory=null;if(result)renderOpponentDetails(result)};
function clearDetails(){
 ['opponentPreview','opponentTable','opponentStats','opponentSamples','detailCards','flopTexture','flopSuits','flopEvents','flopHero','futureRanks','futureSuits','futureInfo'].forEach(id=>$('#'+id).innerHTML='');
 $('#opponentPreviewNote').textContent='카드를 선택하면 상세 확률이 함께 계산됩니다.';
 $('#opponentExplain').textContent='내 패 2장과 바닥패 3·4장을 선택하면 상대의 리버 완성 확률을 볼 수 있습니다.';
 $('#flopExplain').textContent='내 패를 선택하면 가능한 플랍을 모두 계산합니다.';$('#futureExplain').textContent='카드 설정이 필요합니다.';$('#opponentNote').textContent='';
}
function displayDetails(r){
 $('#detailCards').innerHTML=`<div><span>내 패</span><div class="mini">${hand.map(c=>card(c,'',-1)).join('')}</div></div><div><span>현재 바닥패</span><div class="mini">${board.length?board.map(c=>card(c,'',-1)).join(''):'<small>프리플랍 · 아직 없음</small>'}</div></div><div class="detailcontext">상대 ${$('#players').value}명<br>${$('#mode').value==='known'?'한 명의 패 지정':'모든 상대 패 무작위'}</div>`;
 const a=r.boardDetails,f=a.flop;$('#flopExplain').textContent=`내 패${$('#mode').value==='known'?'와 지정 상대 패':''}를 제외한 ${f.remaining}장으로 가능한 ${f.total.toLocaleString()}개 플랍 조합을 모두 계산했습니다.`;
 const breakdown=(labels,values)=>labels.map((name,i)=>`<div class="distrow"><span>${name}</span><div class="bar"><i style="width:${values[i]}%"></i></div><span>${precise(values[i])}</span></div>`).join('');
 $('#flopTexture').innerHTML=breakdown(['모두 다른 숫자','페어 한 개','같은 숫자 3장'],f.texture);
 $('#flopSuits').innerHTML=breakdown(['무늬 세 종류','같은 무늬 2장','모두 같은 무늬'],f.suits);
 const ev=[['내 숫자와 ≥1장 일치',f.events.match,'내 두 장 중 어떤 숫자든 플랍에 한 번 이상 등장'],...(f.pocketPair?[['내 포켓페어와 일치',f.events.set,'내가 가진 페어의 숫자가 플랍에 등장 · 트리플 이상 가능']]:[]),['플러시 드로',f.events.flushDraw,'내 패와 플랍에 같은 무늬가 정확히 4장'],['스트레이트 드로',f.events.straightDraw,'연속 5개 숫자 중 4개 보유 · 거샷 포함, 완성 스트레이트 제외']];
 $('#flopEvents').innerHTML=ev.map(([label,p,desc])=>`<div class="eventrow"><div><b>${label}</b><small>${desc}</small></div><strong>${precise(p)}</strong></div>`).join('');
 $('#flopHero').innerHTML=breakdown(names.slice().reverse(),f.heroHist.slice().reverse());
 $('#futureExplain').textContent=a.until?`현재 알려진 카드를 제외하면 ${a.remaining}장이 남습니다. 앞으로 공개될 바닥패는 ${a.until}장입니다.`:'리버까지 모든 바닥패가 공개됐습니다. 다음 카드 확률은 0%입니다.';
 $('#futureRanks').innerHTML=a.rankChances.map(x=>`<tr><td>${ranks[14-x.rank]}</td><td>${x.count}장</td><td>${a.until?precise(x.next):'0%'}</td><td>${precise(x.river)}</td></tr>`).join('');
 $('#futureSuits').innerHTML=a.suitChances.map(x=>`<div class="suitrow"><span class="suiticon ${x.s===1||x.s===2?'red':''}">${symbols[x.s]}</span><div><b>${x.count}장 남음</b><small>리버까지 ≥1장 ${precise(x.river)}</small></div><strong>${a.until?precise(x.next):'0%'}</strong></div>`).join('');
 $('#futureInfo').innerHTML=a.until?`특정 카드 한 장의 다음 출현 확률은 <b>${precise(100/a.remaining)}</b>입니다.<br>같은 숫자 카드 ${a.rankChances.find(x=>x.rank===hand[0]%13+2).count}장이 남았다면, 그 숫자는 다음에 <b>${precise(a.rankChances.find(x=>x.rank===hand[0]%13+2).next)}</b> 확률로 나옵니다.`:'다른 보드를 비교하려면 카드 설정에서 선택한 바닥패를 지워주세요.';
 const o=r.opponentDetails;
 if(o){$('#opponentPreview').innerHTML=o.oneRiver.map((p,c)=>({p,c})).filter(x=>x.p>0).sort((a,b)=>b.p-a.p).slice(0,3).map(x=>`<div class="previewitem"><span>${names[x.c]}</span><b>${precise(x.p)}</b></div>`).join('');$('#opponentPreviewNote').textContent=`${o.fixed?'지정 상대':'무작위 상대 한 명'}의 리버 최종 족보 기준${board.length<5?' · 남은 바닥패 '+(5-board.length)+'장 포함 · 추정':''}. 상대 중 누군가가 리버에서 내 패보다 강할 확률 ${precise(o.riverAnyBetter)}.`;}
 else {$('#opponentPreview').innerHTML='';$('#opponentPreviewNote').textContent='플랍 3장을 선택하면 상대 족보와 구체적인 패 조합이 보입니다. 상세 확률에서 내 패 기준 플랍 확률을 먼저 확인할 수 있어요.';}
 renderOpponentDetails(r);
}
function renderOpponentDetails(r){
 const o=r.opponentDetails,river=opponentStage==='river';$('#opponentNow').classList.toggle('active',!river);$('#opponentRiver').classList.toggle('active',river);
 $('#opponentMethod').textContent=river&&board.length<5?'20,000회 추정':'상대 조합 전수 계산';
 if(!o){$('#opponentTable').innerHTML='';$('#opponentExplain').textContent='아직 바닥패가 없습니다. 플랍 3장을 선택하면 분석할 수 있어요.';return}
 $('#oneOpponentLabel').textContent=o.fixed?'지정 상대 한 명':'무작위 상대 한 명';
 $('#opponentExplain').textContent=river?`바닥패 ${board.length}장에 남은 ${5-board.length}장을 더 공개하고, 상대 패 2장과 합친 최종 7장에서 가장 좋은 5장의 족보를 계산합니다. 족보를 누르면 완성되는 카드 예시를 볼 수 있어요.`:'현재 공개된 바닥패와 상대의 두 장만으로 이미 만들어진 족보입니다. 이후의 카드 가능성은 “최종 족보 · 리버까지”에서 보세요.';
 $('#opponentStats').innerHTML=`<div class="opponentstat"><div><small>${river?'리버에서':'현재'} 내 패보다 강함 · 한 명</small><b>${precise(river?o.riverBetter:o.better)}</b></div><div><small>${river?'리버에서':'현재'} 내 패보다 강함 · 누군가</small><b>${precise(river?o.riverAnyBetter:o.anyBetter)}</b></div></div>`;
 const one=river?o.oneRiver:o.oneNow,any=river?o.anyRiver:o.anyNow;
 if(selectedCategory===null||!one[selectedCategory])selectedCategory=one.map((p,c)=>({p,c})).filter(x=>x.p).sort((a,b)=>b.p-a.p)[0].c;
 $('#opponentTable').innerHTML=names.map((name,c)=>({name,c})).reverse().map(({name,c})=>`<tr class="${selectedCategory===c?'chosen':''}"><td><button data-category="${c}" ${one[c]?'':'disabled'}>${name}</button></td><td>${precise(one[c])}</td><td>${precise(any[c])}</td></tr>`).join('');
 $('#opponentNote').textContent=`${o.fixed?'한 명 열은 지정한 상대 패 기준입니다.':'한 명 열은 가능한 '+o.total.toLocaleString()+'개 두 장 조합을 균등하게 가정합니다.'} ${o.n>1?'누군가 열은 상대 '+o.n+'명에게 중복 없이 카드를 배분한 20,000회 추정입니다.':'누군가 열도 상대 1명 기준입니다.'} 족보 완성 확률과 상대가 이길 확률은 다릅니다. 누군가 열은 여러 상대가 다른 족보를 함께 가질 수 있어 합계 100%를 넘을 수 있습니다. 추정치 0%는 이번 표본에서 관측되지 않았다는 뜻으로, 불가능을 뜻하지 않습니다.`;
 renderOpponentSamples(o,river);
 document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{selectedCategory=Number(b.dataset.category);renderOpponentDetails(r)});
}
function renderOpponentSamples(o,river){
 if(river){const c=selectedCategory,examples=o.riverSamples[c];$('#opponentSamples').innerHTML=`<div class="sampleshead"><h3>${names[c]} · 리버 완성 예시</h3><span>최종 확률 ${precise(o.oneRiver[c])}</span></div><p class="hint">현재 바닥패는 그대로 두고, 아래 추가 카드가 나온 경우입니다. 각 예시는 해당 족보가 만들어지는 경우 중 일부입니다.</p>`+examples.map((x,i)=>`<div class="riverexample"><div class="examplecards"><div><small>상대 패</small><div class="mini">${x.cards.map(cardId=>card(cardId,'',-1)).join('')}</div></div><div><small>${x.added.length?'앞으로 나올 바닥패':'바닥패 공개 완료'}</small><div class="mini">${x.added.map(cardId=>card(cardId,'',-1)).join('')}</div></div></div><button data-river-sample="${i}" class="outlinebtn">상대 패로 비교</button></div>`).join('');document.querySelectorAll('[data-river-sample]').forEach(b=>b.onclick=()=>{opponent=examples[Number(b.dataset.riverSample)].cards.slice();$('#mode').value='known';target=['opponent',0];selectedCategory=null;render();calculate()});return}
 const c=selectedCategory;
 $('#opponentSamples').innerHTML=`<div class="sampleshead"><h3>${names[c]} · 가능한 상대 패</h3><span>${o.counts[c].toLocaleString()} / ${o.total.toLocaleString()}개 조합</span></div><p class="hint">${o.fixed?'지정된 상대 패입니다.':'가능한 조합 중 숫자가 높은 예시를 최대 6개 표시합니다. 각 정확한 두 장 조합의 확률은 '+precise(100/o.total)+'이며, 이 예시 목록 자체가 전체 조합은 아닙니다.'}</p>`+o.samples[c].map((x,i)=>`<div class="samplehand"><div class="mini">${x.cards.map(cardId=>card(cardId,'',-1)).join('')}</div><div><b>${names[c]}</b><small>이 두 장 ${precise(100/o.total)}</small></div><button data-sample="${i}" class="outlinebtn">이 패로 비교</button></div>`).join('');
 document.querySelectorAll('[data-sample]').forEach(b=>b.onclick=()=>{opponent=o.samples[c][Number(b.dataset.sample)].cards.slice();$('#mode').value='known';target=['opponent',0];selectedCategory=null;render();calculate()});
}
