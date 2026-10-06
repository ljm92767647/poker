const NAMES=['하이 카드','원페어','투페어','트리플','스트레이트','플러시','풀하우스','포카드','스트레이트 플러시','로열 플러시'];
function evaluate(cards){
 const counts=Array(15).fill(0), suits=[[],[],[],[]];
 for(const c of cards){const r=c%13+2;counts[r]++;suits[Math.floor(c/13)].push(r)}
 const ranks=[];for(let r=14;r>=2;r--)if(counts[r])ranks.push(r);
 const straight=rs=>{const set=new Set(rs);if(set.has(14))set.add(1);for(let h=14;h>=5;h--)if([0,1,2,3,4].every(d=>set.has(h-d)))return h;return 0};
 const encode=(cat,rs)=>{let v=cat;for(let i=0;i<5;i++)v=v*15+(rs[i]||0);return v};
 const flush=suits.find(s=>s.length>=5);
 if(flush){const h=straight(flush);if(h)return encode(h===14?9:8,[h])}
 const four=ranks.find(r=>counts[r]===4);if(four)return encode(7,[four,ranks.find(r=>r!==four)]);
 const trips=ranks.filter(r=>counts[r]>=3), pairs=ranks.filter(r=>counts[r]>=2);
 if(trips.length&&pairs.some(r=>r!==trips[0]))return encode(6,[trips[0],pairs.find(r=>r!==trips[0])]);
 if(flush)return encode(5,flush.sort((a,b)=>b-a).slice(0,5));
 const h=straight(ranks);if(h)return encode(4,[h]);
 if(trips.length)return encode(3,[trips[0],...ranks.filter(r=>r!==trips[0]).slice(0,2)]);
 if(pairs.length>=2)return encode(2,[...pairs.slice(0,2),ranks.find(r=>!pairs.slice(0,2).includes(r))]);
 if(pairs.length)return encode(1,[pairs[0],...ranks.filter(r=>r!==pairs[0]).slice(0,3)]);
 return encode(0,ranks.slice(0,5));
}
const category=v=>Math.floor(v/759375);
function boardAnalysis(hand,opponent,board){
 const all=Array.from({length:52},(_,i)=>i),flopDeck=all.filter(c=>![...hand,...opponent].includes(c)),deck=flopDeck.filter(c=>!board.includes(c));
 const texture=[0,0,0],suits=[0,0,0],heroHist=Array(10).fill(0),events={match:0,set:0,flushDraw:0,straightDraw:0};let total=0;
 const inspect=b=>{total++;const rc=Array(13).fill(0),sc=Array(4).fill(0);for(const c of b){rc[c%13]++;sc[Math.floor(c/13)]++}texture[Math.max(...rc)-1]++;suits[Math.max(...sc)-1]++;const cards=[...hand,...b],cat=category(evaluate(cards));heroHist[cat]++;
  if(b.some(c=>hand.some(h=>h%13===c%13)))events.match++;
  if(hand[0]%13===hand[1]%13&&b.some(c=>c%13===hand[0]%13))events.set++;
  const combined=Array(4).fill(0);for(const c of cards)combined[Math.floor(c/13)]++;if(combined.some(v=>v===4))events.flushDraw++;
  const rs=new Set(cards.map(c=>c%13+2));if(rs.has(14))rs.add(1);if(cat!==4&&cat!==8&&cat!==9){for(let h=14;h>=5;h--){if([0,1,2,3,4].filter(d=>rs.has(h-d)).length===4){events.straightDraw++;break}}}
 };
 for(let i=0;i<flopDeck.length;i++)for(let j=i+1;j<flopDeck.length;j++)for(let k=j+1;k<flopDeck.length;k++)inspect([flopDeck[i],flopDeck[j],flopDeck[k]]);
 const until=5-board.length,hit=outs=>{let noHit=1;for(let k=0;k<until;k++)noHit*=(deck.length-outs-k)/(deck.length-k);return 100*(1-noHit)};
 const rankChances=Array.from({length:13},(_,i)=>{const rank=12-i,cs=deck.filter(c=>c%13===rank);return {rank:rank+2,count:cs.length,cards:cs,next:cs.length/deck.length*100,river:hit(cs.length)}});
 const suitChances=Array.from({length:4},(_,s)=>{const cs=deck.filter(c=>Math.floor(c/13)===s);return {s,count:cs.length,next:cs.length/deck.length*100,river:hit(cs.length)}});
 const flop={total,remaining:flopDeck.length,texture:texture.map(v=>v/total*100),suits:suits.map(v=>v/total*100),heroHist:heroHist.map(v=>v/total*100),events:Object.fromEntries(Object.entries(events).map(([k,v])=>[k,v/total*100])),pocketPair:hand[0]%13===hand[1]%13};
 return {flop,rankChances,suitChances,remaining:deck.length,until};
}
function opponentAnalysis(hand,board,opponent,n,rand){
 if(board.length<3)return null;
 const deck=Array.from({length:52},(_,i)=>i).filter(c=>![...hand,...board,...opponent].includes(c)),hero=evaluate([...hand,...board]),counts=Array(10).fill(0),samples=Array.from({length:10},()=>[]);let total=0,better=0,equal=0;
 const add=hole=>{const value=evaluate([...hole,...board]),cat=category(value);counts[cat]++;total++;if(value>hero)better++;if(value===hero)equal++;samples[cat].push({cards:hole.slice(),value})};
 if(opponent.length===2)add(opponent);else for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)add([deck[i],deck[j]]);
 for(const bucket of samples){bucket.sort((a,b)=>b.value-a.value);bucket.splice(6)}
 const anyNow=Array(10).fill(0),oneRiver=Array(10).fill(0),anyRiver=Array(10).fill(0),riverSamples=Array.from({length:10},()=>[]);let anyBetter=0,riverBetter=0,riverAnyBetter=0;
 const iterations=20000;
 for(let k=0;k<iterations;k++){
  const d=deck.slice();let at=0;const draw=()=>{const j=at+Math.floor(rand()*(d.length-at));[d[j],d[at]]=[d[at],d[j]];return d[at++]};
  const holes=Array.from({length:n},(_,p)=>p===0&&opponent.length===2?opponent:[draw(),draw()]);
  const future=board.slice();while(future.length<5)future.push(draw());const heroFinal=evaluate([...hand,...future]),nowSeen=new Set(),riverSeen=new Set();let beats=false,finalBeats=false;
  holes.forEach((hole,p)=>{const v=evaluate([...hole,...board]),cat=category(v),endValue=evaluate([...hole,...future]),end=category(endValue);nowSeen.add(cat);riverSeen.add(end);if(p===0){oneRiver[end]++;if(endValue>heroFinal)riverBetter++;const added=future.slice(board.length);if(riverSamples[end].length<3&&!riverSamples[end].some(x=>x.cards.join(',')===hole.join(',')&&x.added.join(',')===added.join(',')))riverSamples[end].push({cards:hole.slice(),added,value:endValue})}if(v>hero)beats=true;if(endValue>heroFinal)finalBeats=true});
  nowSeen.forEach(c=>anyNow[c]++);riverSeen.forEach(c=>anyRiver[c]++);if(beats)anyBetter++;if(finalBeats)riverAnyBetter++;
 }
 if(board.length===5)for(let c=0;c<10;c++)riverSamples[c]=samples[c].slice(0,3).map(x=>({...x,added:[]}));
 return {total,counts,samples,riverSamples,oneNow:counts.map(v=>v/total*100),anyNow:n===1?counts.map(v=>v/total*100):anyNow.map(v=>v/iterations*100),oneRiver:board.length===5?counts.map(v=>v/total*100):oneRiver.map(v=>v/iterations*100),anyRiver:board.length===5&&n===1?counts.map(v=>v/total*100):anyRiver.map(v=>v/iterations*100),better:better/total*100,equal:equal/total*100,anyBetter:n===1?better/total*100:anyBetter/iterations*100,riverBetter:board.length===5?better/total*100:riverBetter/iterations*100,riverAnyBetter:board.length===5&&n===1?better/total*100:riverAnyBetter/iterations*100,fixed:opponent.length===2,n};
}
function run(input){
 const {hand,board,opponent,n}=input, known=[...hand,...board,...opponent], deck=Array.from({length:52},(_,i)=>i).filter(c=>!known.includes(c));
 let seed=known.reduce((a,c)=>(Math.imul(a,31)+c+1)>>>0,12345)+n;
 const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};
 function equity(b,iterations){
  const pool=deck.filter(c=>!b.includes(c));let wins=0,ties=0,share=0;
  for(let k=0;k<iterations;k++){
   const d=pool.slice();let at=0;const draw=()=>{const j=at+Math.floor(rand()*(d.length-at));[d[j],d[at]]=[d[at],d[j]];return d[at++]};
   const final=b.slice();while(final.length<5)final.push(draw());const hero=evaluate([...hand,...final]);let best=hero,winners=1;
   for(let p=0;p<n;p++){const oh=p===0&&opponent.length===2?opponent:[draw(),draw()];const value=evaluate([...oh,...final]);if(value>best){best=value;winners=1}else if(value===best)winners++}
   if(best===hero){if(winners===1)wins++;else ties++;share+=1/winners}
  }return {win:wins/iterations*100,tie:ties/iterations*100,equity:share/iterations*100};
 }
 const result=equity(board,20000), hist=Array(10).fill(0);let total=0;const missing=5-board.length;
 const add=b=>{hist[category(evaluate([...hand,...b]))]++;total++};
 if(missing===0)add(board);else if(missing===1)for(const c of deck)add([...board,c]);else if(missing===2){for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)add([...board,deck[i],deck[j]])}else{for(let k=0;k<20000;k++){const d=deck.slice();for(let i=0;i<missing;i++){const j=i+Math.floor(rand()*(d.length-i));[d[j],d[i]]=[d[i],d[j]]}add([...board,...d.slice(0,missing)])}}
 const current=category(evaluate([...hand,...board]));let next=[],improve=[];
 if(board.length>=3&&board.length<5){for(const c of deck){const cat=category(evaluate([...hand,...board,c]));if(cat>current)improve.push(c);next.push({cards:[c],cat,...equity([...board,c],2500),prob:100/deck.length})}next.sort((a,b)=>b.equity-a.equity)}
 if(board.length===0){const proposals=[];for(let i=0;i<6;i++){const d=deck.slice();for(let j=0;j<3;j++){const k=j+Math.floor(rand()*(d.length-j));[d[k],d[j]]=[d[j],d[k]]}proposals.push(d.slice(0,3))}next=proposals.map(b=>({cards:b,cat:category(evaluate([...hand,...b])),...equity(b,4000),prob:100/(deck.length*(deck.length-1)*(deck.length-2)/6)})).sort((a,b)=>b.equity-a.equity)}
 const suits=[0,1,2,3];const drawInfo=suits.map(s=>{const have=[...hand,...board].filter(c=>Math.floor(c/13)===s).length,outs=deck.filter(c=>Math.floor(c/13)===s);if(have!==4||missing<1)return null;let miss=1;for(let i=0;i<missing;i++)miss*= (deck.length-outs.length-i)/(deck.length-i);return {s,outs:outs.length,next:100*outs.length/deck.length,river:100*(1-miss)}}).filter(Boolean);
 return {...result,current,hist:hist.map(v=>100*v/total),exact:missing<=2,next,improve,deck:deck.length,drawInfo,boardDetails:boardAnalysis(hand,opponent,board),opponentDetails:opponentAnalysis(hand,board,opponent,n,rand)};
}
if(typeof self!=='undefined')self.onmessage=e=>{try{self.postMessage({result:run(e.data)})}catch(err){self.postMessage({error:err.message})}};
if(typeof module!=='undefined')module.exports={evaluate,category,run,boardAnalysis,opponentAnalysis};
