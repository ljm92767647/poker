if(typeof importScripts==='function')importScripts('engine.js');
const ev=typeof evaluate==='function'?evaluate:require('./engine.js').evaluate;
const catOf=v=>Math.floor(v/759375);
const fullDeck=()=>Array.from({length:52},(_,i)=>i);
function finalDistribution(h,b,deck){const hist=Array(10).fill(0);let total=0;const add=bb=>{hist[catOf(ev([...h,...bb]))]++;total++};if(b.length===5)add(b);if(b.length===4)for(const c of deck)add([...b,c]);if(b.length===3)for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)add([...b,deck[i],deck[j]]);return {hist:hist.map(v=>v/total*100),total}}
function averageDistribution(board,deck){const hist=Array(10).fill(0),cards=board.slice(),needed=7-board.length;let total=0;function visit(start,left){if(left===0){hist[catOf(ev(cards))]++;total++;return}for(let i=start;i<=deck.length-left;i++){cards.push(deck[i]);visit(i+1,left-1);cards.pop()}}visit(0,needed);return {hist:hist.map(v=>v/total*100),total}}
function hitChance(outs,remaining,draws){let miss=1;for(let i=0;i<draws;i++)miss*=(remaining-outs-i)/(remaining-i);return 100*(1-miss)}
const matchesDraw=(value,target)=>value===target||([4,5,8].includes(target)&&value>=8);
const drawProbability=(hist,target)=>hist.reduce((sum,p,c)=>sum+(matchesDraw(c,target)?p:0),0);
function waits(h,b,deck){if(b.length<3||b.length===5)return [];const current=catOf(ev([...h,...b])),dist=finalDistribution(h,b,deck);return Array.from({length:7},(_,i)=>i+3).filter(cat=>cat>current&&drawProbability(dist.hist,cat)>0&&(cat!==8||dist.hist[8]>0)).map(cat=>{const outs=deck.filter(c=>matchesDraw(catOf(ev([...h,...b,c])),cat));return {cat,outs,next:outs.length/deck.length*100,hit:hitChance(outs.length,deck.length,5-b.length),river:drawProbability(dist.hist,cat)}})}
function analyze({hand,board,opponent=[]}){
 const known=[...hand,...board,...opponent],deck=fullDeck().filter(c=>!known.includes(c)),hist=Array(10).fill(0),base=Array(10).fill(0),oppHist=Array.from({length:3},()=>Array(10).fill(0)),scores=Array.from({length:3},()=>({win:0,tie:0,share:0}));
 if(hand.length!==2||![0,3,4,5].includes(board.length)||new Set(known).size!==known.length)throw Error('카드를 확인하세요.');
 let seed=known.reduce((a,c)=>(Math.imul(a,31)+c+1)>>>0,90210)||1;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};const iterations=40000;
 for(let k=0;k<iterations;k++){
  const d=deck.slice();let at=0;const draw=()=>{const j=at+Math.floor(rand()*(d.length-at));[d[j],d[at]]=[d[at],d[j]];return d[at++]};
  // The benchmark always uses unknown cards, even when one opponent is specified.
  const holes=Array.from({length:3},(_,p)=>p===0&&opponent.length===2?opponent:[draw(),draw()]);
  const b=board.slice();while(b.length<5)b.push(draw());const hero=ev([...hand,...b]);hist[catOf(hero)]++;let best=hero,winners=1;const seen=new Set();
  for(let p=0;p<3;p++){const value=ev([...holes[p],...b]);if(!(p===0&&opponent.length===2))base[catOf(value)]++;seen.add(catOf(value));seen.forEach(c=>oppHist[p][c]++);if(value>best){best=value;winners=1}else if(value===best)winners++;if(best===hero){if(winners===1)scores[p].win++;else scores[p].tie++;scores[p].share+=1/winners}}
 }
 const heroDist=board.length>=3?finalDistribution(hand,board,deck).hist:hist.map(v=>v/iterations*100),baseN=iterations*(opponent.length===2?2:3),average=board.length>=3?averageDistribution(board,deck):null,baseline=average?average.hist:base.map(v=>v/baseN*100);
 let opponentDraws=[];
 if(board.length>=3&&board.length<5){
  if(opponent.length===2)opponentDraws=waits(opponent,board,deck).map(w=>({...w,hole:opponent}));
  else{
   const candidates={};
   for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++){
    const hole=[deck[i],deck[j]],current=catOf(ev([...hole,...board])),outsByCat={};
    for(const c of deck){if(c===hole[0]||c===hole[1])continue;const cat=catOf(ev([...hole,...board,c]));for(let target=3;target<=9;target++)if(target>current&&matchesDraw(cat,target))(outsByCat[target]??=[]).push(c)}
    for(const [cat,outs] of Object.entries(outsByCat))if(!candidates[cat]||outs.length>candidates[cat].outs.length)candidates[cat]={cat:Number(cat),hole,outs};
   }
   opponentDraws=[5,4,6,7,3,8,9].filter(c=>candidates[c]).slice(0,4).map(c=>{const x=candidates[c],remaining=deck.filter(card=>!x.hole.includes(card)),dist=finalDistribution(x.hole,board,remaining);return {...x,next:x.outs.length/remaining.length*100,hit:hitChance(x.outs.length,remaining.length,5-board.length),river:drawProbability(dist.hist,c)}});
  }
 }
 const opponents=oppHist.map(h=>h.map(v=>v/iterations*100));if(board.length>=3){const exactOne=opponent.length===2?finalDistribution(opponent,board,deck).hist:baseline.slice(),sampleOne=opponents[0].slice();for(let p=1;p<3;p++)for(let c=0;c<10;c++)opponents[p][c]=Math.min(100,exactOne[c]+Math.max(0,opponents[p][c]-sampleOne[c]));opponents[0]=exactOne}
 return {hero:heroDist,baseline,opponents,scores:scores.map(s=>({win:s.win/iterations*100,tie:s.tie/iterations*100,equity:s.share/iterations*100,lose:100-(s.win+s.tie)/iterations*100})),waits:waits(hand,board,deck),opponentDraws,current:board.length>=3?catOf(ev([...hand,...board])):null,iterations,exact:board.length>=3,averageCombos:average?.total||0,remaining:deck.length};
}
if(typeof self!=='undefined')self.onmessage=e=>{try{self.postMessage({result:analyze(e.data)})}catch(error){self.postMessage({error:error.message})}};
if(typeof module!=='undefined')module.exports={analyze,waits,finalDistribution,averageDistribution};
