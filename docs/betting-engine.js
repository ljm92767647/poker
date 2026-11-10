if (typeof importScripts === 'function') importScripts('engine.js');
const evaluateHand = typeof importScripts === 'function' ? evaluate : require('./engine.js').evaluate;
const ranks = '23456789TJQKA';
const deck = Array.from({length: 52}, (_, card) => card);
const categoryOf = value => Math.floor(value / 759375);
const pairKey = (a, b) => a * 52 + b;

function handType(a, b) {
  const high = Math.max(a % 13, b % 13);
  const low = Math.min(a % 13, b % 13);
  return ranks[high] + ranks[low] + (high === low ? '' : Math.floor(a / 13) === Math.floor(b / 13) ? 's' : 'o');
}

function boardHands(board, unseen) {
  return unseen.flatMap((a, i) => unseen.slice(i + 1).map(b => ({
    a, b, value: evaluateHand([a, b, ...board])
  })));
}

function asRange(pairs) {
  return {
    types: [...new Set(pairs.map(({a, b}) => handType(a, b)))],
    comboKeys: pairs.map(({a, b}) => pairKey(a, b))
  };
}

function mainDraw({a, b, value}, runouts) {
  const current = categoryOf(value);
  const counts = Array(10).fill(0);
  for (const {next, river, finalBoard, boardCategory} of runouts) {
    if (next === a || next === b || river === a || river === b) continue;
    const category = categoryOf(evaluateHand([a, b, ...finalBoard]));
    if (category > current && category > boardCategory) counts[category]++;
  }
  let target = 0;
  for (let category = current + 1; category < counts.length; category++) {
    if (counts[category] && counts[category] >= counts[target]) target = category;
  }
  return target;
}

function filterRange(pairs, {hand, board, excludeOnePair = false, excludeTwoPair = false, excludePocket = false}) {
  const available = deck.filter(card => !board.includes(card) && !hand.includes(card));
  const runouts = [];
  if (board.length < 5 && (excludeOnePair || excludeTwoPair)) {
    for (const [i, next] of available.entries()) {
      for (const river of board.length === 3 ? available.slice(i + 1) : [null]) {
        const finalBoard = river === null ? [...board, next] : [...board, next, river];
        runouts.push({next, river, finalBoard, boardCategory: categoryOf(evaluateHand(finalBoard))});
      }
    }
  }
  return asRange(pairs.filter(pair => {
    const current = categoryOf(pair.value);
    if (excludePocket && pair.a % 13 === pair.b % 13) {
      // Keep a made hand when the pocket pair is needed for its current best five.
      const withoutPair = current >= 2 && Math.max(
        evaluateHand([...board, pair.a]), evaluateHand([...board, pair.b]));
      if (current < 2 || pair.value <= withoutPair) return false;
    }
    if (!runouts.length || current >= (excludeTwoPair ? 2 : 1)) return true;
    const target = mainDraw(pair, runouts);
    return !(excludeOnePair && target === 1) && !(excludeTwoPair && target === 2);
  }));
}

function suggestCallers(data) {
  const {hand, board, callThreshold} = data;
  const unseen = deck.filter(card => !board.includes(card));
  const hands = boardHands(board, unseen);
  const sorted = hands.slice().sort((a, b) => b.value - a.value);
  const cutoff = sorted[Math.floor(sorted.length * 0.3)].value;
  const strong = hands.filter(pair => pair.value >= cutoff);
  const totals = new Map(), eligible = [];
  const isRiver = board.length === 5;
  const share = (a, b) => a > b ? 1 : a === b ? 0.5 : 0;
  for (const candidate of hands) {
    const {a, b, value} = candidate;
    if (hand.includes(a) || hand.includes(b)) continue;
    const overlaps = pair => pair.a === a || pair.a === b || pair.b === a || pair.b === b;
    let equity;
    if (isRiver) {
      let allShare = 0, strongShare = 0, allCount = 0, strongCount = 0;
      for (const pair of hands) {
        if (overlaps(pair)) continue;
        const outcome = share(value, pair.value);
        allShare += outcome;
        allCount++;
        if (pair.value >= cutoff) {
          strongShare += outcome;
          strongCount++;
        }
      }
      const againstAll = allShare / allCount;
      equity = strongCount ? 0.75 * strongShare / strongCount + 0.25 * againstAll : againstAll;
    } else {
      // Reuse the same samples when the bet changes so only the call threshold moves.
      let seed = 397 + 53 * a + b;
      const randomIndex = length => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return Math.floor(seed / 4294967296 * length);
      };
      const strongPool = strong.filter(pair => !overlaps(pair));
      let total = 0;
      for (let trial = 0; trial < 120; trial++) {
        const pool = trial % 4 !== 0 && strongPool.length ? strongPool : hands;
        let pair;
        do { pair = pool[randomIndex(pool.length)]; } while (overlaps(pair));
        const runout = board.slice();
        while (runout.length < 5) {
          const card = unseen[randomIndex(unseen.length)];
          if (card !== a && card !== b && card !== pair.a && card !== pair.b && !runout.includes(card)) runout.push(card);
        }
        total += share(evaluateHand([a, b, ...runout]), evaluateHand([pair.a, pair.b, ...runout]));
      }
      equity = total / 120;
    }
    const type = handType(a, b);
    const aggregate = totals.get(type) || {equity: 0, count: 0};
    aggregate.equity += equity;
    aggregate.count++;
    totals.set(type, aggregate);
    eligible.push(candidate);
  }
  const chosen = new Set([...totals].filter(([, row]) => row.equity / row.count >= callThreshold).map(([type]) => type));
  return filterRange(eligible.filter(({a, b}) => chosen.has(handType(a, b))), data);
}

function suggestBettor(data) {
  const {hand, board, betRatio} = data;
  const unseen = deck.filter(card => !board.includes(card));
  const hands = boardHands(board, unseen);
  const sorted = hands.slice().sort((a, b) => b.value - a.value);
  // Larger bets use a narrower made-hand range and stronger draws.
  const fraction = 0.50 - 0.32 / (1 + 1 / betRatio);
  const cutoff = sorted[Math.floor(sorted.length * fraction)].value;
  const available = unseen.filter(card => !hand.includes(card));
  const boardScores = new Map(board.length === 4
    ? available.map(card => [card, evaluateHand([...board, card])]) : []);
  const minOuts = betRatio <= 0.75 ? 4 : 8;
  const candidates = hands.filter(({a, b, value}) => {
    if (hand.includes(a) || hand.includes(b)) return false;
    if (value >= cutoff) return true;
    if (board.length === 5 || categoryOf(value) >= 4) return false;
    let outs = 0;
    for (const card of available) {
      if (card === a || card === b) continue;
      const next = evaluateHand([a, b, ...board, card]);
      const category = categoryOf(next);
      if ((category === 4 || category === 5 || category >= 8) &&
          (!boardScores.has(card) || next > boardScores.get(card)) && ++outs >= minOuts) return true;
    }
    return false;
  });
  return filterRange(candidates, data);
}

function rangeAnalysis({hand, board, types, comboKeys, callers, onlyBettor = false}) {
  const selected = new Set(types);
  const selectedCombos = comboKeys ? new Set(comboKeys) : null;
  const available = deck.filter(card => !hand.includes(card) && !board.includes(card));
  const candidates = [];
  for (const [i, a] of available.entries()) {
    for (const b of available.slice(i + 1)) {
      if (selectedCombos ? selectedCombos.has(pairKey(a, b)) : selected.has(handType(a, b))) candidates.push([a, b]);
    }
  }
  if (!candidates.length) return [];
  const candidateCardCount = new Set(candidates.flat()).size;
  const results = [];
  for (let count = 1; count <= callers; count++) {
    let trials = 0;
    let share = 0;
    if (!onlyBettor && candidateCardCount < count * 2) break;
    // Drawing whole deals and rejecting overlaps gives each legal deal the same weight.
    for (let attempt = 0; attempt < 80000 && trials < 5000; attempt++) {
      const holes = [];
      const used = new Set();
      const draw = () => {
        let card;
        do { card = available[Math.floor(Math.random() * available.length)]; } while (used.has(card));
        used.add(card);
        return card;
      };
      const constrained = onlyBettor ? 1 : count;
      while (holes.length < constrained) {
        const pair = candidates[Math.floor(Math.random() * candidates.length)];
        if (pair.some(card => used.has(card))) break;
        holes.push(pair);
        pair.forEach(card => used.add(card));
      }
      if (holes.length < constrained) continue;
      while (holes.length < count) holes.push([draw(), draw()]);
      const finalBoard = board.slice();
      while (finalBoard.length < 5) finalBoard.push(draw());
      const hero = evaluateHand([...hand, ...finalBoard]);
      let winners = 1;
      for (const pair of holes) {
        const score = evaluateHand([...pair, ...finalBoard]);
        if (score > hero) {
          winners = 0;
          break;
        }
        if (score === hero) winners++;
      }
      trials++;
      if (winners) share += 1 / winners;
    }
    if (trials < 400) break;
    results.push(share * 100 / trials);
  }
  return results;
}

if (typeof self !== 'undefined') self.onmessage = ({data}) => {
  try {
    const range = data.auto === 'bettor' ? suggestBettor(data) : data.auto === 'caller' ? suggestCallers(data) : null;
    self.postMessage({suggestions: range?.types, comboCount: range?.comboKeys.length,
      scores: rangeAnalysis(range ? {...data, ...range} : data)});
  } catch {
    self.postMessage({error: true});
  }
};
if (typeof module !== 'undefined') module.exports = {rangeAnalysis, suggestCallers, suggestBettor};
