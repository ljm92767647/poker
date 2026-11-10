const bettingPanel = $('#betAnalysis');
const rangeDialog = $('#betRangeDialog');
const betRanges = {facing: new Set(), own: new Set()};
const amountsByMode = {facing: $('#betAmount').defaultValue, own: ''};
const chipNumber = new Intl.NumberFormat('ko-KR', {maximumFractionDigits: 2});
let betMode = 'facing';
let rangeDraft;
let betWorker;
let betScores;
let betError = false;
const autoEnabled = {facing: false, own: false};
const autoFilters = {facing: new Set(), own: new Set()};
let autoTypes = null;
let autoComboCount = 0;
let autoTimer;
const rangeCells = [...document.querySelectorAll('#chart .cell')];
const isAutoRange = () => autoEnabled[betMode];
const activeBetRange = () => isAutoRange() ? autoTypes || new Set() : betRanges[betMode];

function betAmounts() {
  const pot = $('#betPot').valueAsNumber;
  const amount = $('#betAmount').valueAsNumber;
  const valid = pot > 0 && amount > 0 && Number.isFinite(pot + 9 * amount);
  return {pot, amount, valid};
}

$('#betRangeGrid').innerHTML = rangeCells.map(cell =>
  `<button type="button" data-type="${cell.textContent}" aria-pressed="false" style="--band:${cell.style.background}">${cell.textContent}</button>`
).join('');

function updateRangeGrid() {
  $('#betRangeGrid').querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(rangeDraft.has(button.dataset.type)));
  });
}

function availableCombos(type, known) {
  const first = suits.map((_, i) => rankId(type[0], i)).filter(card => !known.includes(card));
  const second = suits.map((_, i) => rankId(type[1], i)).filter(card => !known.includes(card));
  if (type.length === 2) return first.length * (first.length - 1) / 2;
  return first.reduce((total, a) => total + second.filter(b =>
    (Math.floor(a / 13) === Math.floor(b / 13)) === (type[2] === 's')).length, 0);
}

function updateBetRange() {
  const range = activeBetRange();
  const auto = isAutoRange();
  document.querySelectorAll('[data-auto-range]').forEach(button => {
    button.setAttribute('aria-pressed', String(auto));
  });
  document.querySelectorAll('[data-auto-filter]').forEach(button => {
    button.setAttribute('aria-pressed', String(autoFilters[betMode].has(button.dataset.autoFilter)));
  });
  $('#autoCallControls').hidden = betMode !== 'own';
  $('#autoBettorControls').hidden = betMode !== 'facing';
  $('#betRangeLabel').textContent = autoTypes ? betMode === 'own' ? '콜 후보 보기·수정' : '상대 패 후보 보기·수정' :
    betMode === 'own' ? '콜할 것 같은 패 고르기' : '베팅한 상대의 패 후보 고르기';
  $('#betRangeCount').textContent = auto ? autoTypes ? `자동 ${range.size}종` : '자동 선택' :
    range.size ? `${range.size}종 선택` : opponent.includes(null) ? '무작위' : '지정 상대 포함';
  const blockers = $('#betBlockers');
  blockers.hidden = !range.size;
  if (!range.size) return;
  const blocked = [...range].map(type => {
    const before = availableCombos(type, board);
    const after = availableCombos(type, [...board, ...hand]);
    return before > after ? `${type} ${before} → ${after}` : '';
  }).filter(Boolean);
  blockers.innerHTML = blocked.length
    ? `<details><summary>내 패로 줄어든 상대 조합 · ${blocked.length}종</summary><p>${blocked.join(' · ')}</p>${auto ? '<span>시작패 유형 전체 조합 기준</span>' : ''}</details>`
    : '내 패로 줄어든 후보 조합 없음';
}

function updateBetResults() {
  if (!bettingPanel.open) return;
  const facing = betMode === 'facing';
  const auto = isAutoRange();
  const range = activeBetRange();
  const {pot, amount, valid:hasAmounts} = betAmounts();
  const needed = hasAmounts ? 100 / (pot / amount + 2) : null;
  const chosen = auto || range.size > 0;
  const scores = chosen ? betScores : result?.scores.map(row => row.equity);
  const validCards = !hand.includes(null) && [0, 3, 4, 5].includes(board.length);
  const prompt = hand.includes(null) ? '내 패 두 장을 골라 주세요.' :
    auto && board.length < 3 ? '자동 후보를 보려면 바닥패를 3장 이상 골라 주세요.' :
    auto && !hasAmounts ? `베팅 전 팟과 ${facing ? '상대' : '내'} 베팅액을 입력하면 후보를 골라요.` :
    auto && !betError ? '패 후보를 고르는 중…' :
    !validCards ? '바닥패를 3장 이상 골라 주세요.' :
    !chosen && opponent.filter(c => c !== null).length === 1 ? '지정 상대 패를 두 장 고르거나 지워 주세요.' :
    betError && chosen ? '계산이 끊겼어요. 후보를 다시 적용해 주세요.' : '팟지분 계산 중…';
  const assumptions = auto ? `자동 후보 ${range.size}종 · ${autoComboCount}가지 조합. ${facing && people > 2 ? '베팅한 한 명에 적용해요.' : ''}` :
    chosen ? facing && people > 2 ? '베팅한 한 명에만 후보를 적용하고 다른 상대는 무작위로 계산해요.' :
    '선택한 패의 가능한 조합을 같은 비중으로 계산해요.' :
    opponent.includes(null) ? '상대 패는 무작위로 계산해요.' : '지정 상대 한 명을 포함해 계산해요.';
  const players = people - 1;
  const share = scores?.[players - 1];
  const noMatch = '이 조건에 맞는 후보가 없어요. 다른 필터를 선택하거나 패를 직접 골라 주세요.';
  const shortRange = auto && !range.size ? noMatch : '이 인원으로 계산할 조합이 부족해요. 패 후보를 더 골라 주세요.';
  const sizing = hasAmounts ? `<span class="bet-sizing">팟의 ${percentage(100 * amount / pot)} 베팅</span>` : '';
  if (facing) {
    $('#betResults').innerHTML = `
      <div class="bet-metrics">
        <div><span>콜에 필요한 팟지분</span><strong>${needed === null ? '—' : percentage(needed)}</strong></div>
        <div><span>내 예상 팟지분 · ${people}명</span><strong>${share === undefined ? '—' : percentage(share)}</strong></div>
      </div>
      ${sizing}
      <p class="micro">${scores ? share === undefined ? shortRange : assumptions : prompt}
      ${hasAmounts ? '팟에는 내 콜만 더해요. 이후 베팅 없이 끝나는 기준이에요.' : '팟과 베팅액을 입력하면 콜 기준이 나와요.'}</p>`;
    return;
  }
  if (auto && scores && !range.size) {
    $('#betResults').innerHTML = `${sizing}<p class="micro">${noMatch}</p>`;
    return;
  }
  $('#betResults').innerHTML = `
    ${sizing}
    <p class="micro">${scores ? assumptions : prompt} ${scores && chosen ? '콜한 상대마다 이 후보를 적용해요.' : ''}</p>
    ${scores ? `<table class="bet-callers"><thead><tr><th>콜한 상대</th><th>내 팟지분</th>${hasAmounts ? '<th>콜한 뒤 팟</th>' : ''}</tr></thead><tbody>
      ${Array.from({length: players}, (_, i) => `<tr><td>${i + 1}명</td><td class="accent">${scores[i] === undefined ? '—' : percentage(scores[i])}</td>
      ${hasAmounts ? `<td>${chipNumber.format(pot + amount * (i + 2))}</td>` : ''}</tr>`).join('')}
    </tbody></table>
    <p class="micro">${scores.length < players ? shortRange : players === 1 ? '위에서 전체 인원을 늘리면 여러 명이 콜하는 경우를 비교할 수 있어요.' : '콜한 사람과 리버까지 갔을 때의 예상이에요.'}</p>` : ''}`;
}

function refreshBetAnalysis() {
  clearTimeout(autoTimer);
  betWorker?.terminate();
  betScores = null;
  betError = false;
  autoTypes = null;
  autoComboCount = 0;
  if (!bettingPanel.open) return;
  updateBetRange();
  updateBetResults();
  const auto = isAutoRange();
  const types = [...activeBetRange()];
  const {pot, amount, valid} = betAmounts();
  if ((!auto && !types.length) || (auto && (!valid || board.length < 3)) ||
      hand.includes(null) || ![0, 3, 4, 5].includes(board.length)) return;
  const facing = betMode === 'facing';
  betWorker = new Worker('betting-engine.js?v=20261110e');
  betWorker.onmessage = ({data}) => {
    betScores = data.scores;
    betError = !!data.error;
    if (data.suggestions) {
      autoTypes = new Set(data.suggestions);
      autoComboCount = data.comboCount;
      updateBetRange();
    }
    updateBetResults();
  };
  betWorker.onerror = () => { betError = true; updateBetResults(); };
  betWorker.postMessage({hand, board, types, callers: people - 1, onlyBettor: facing,
    auto: auto ? facing ? 'bettor' : 'caller' : null,
    betRatio: amount / pot, callThreshold: 1 / (pot / amount + 2),
    ...Object.fromEntries([...autoFilters[betMode]].map(filter => [filter, true]))});
}

function setBetMode(mode) {
  betMode = mode;
  $('#betAmount').value = amountsByMode[mode];
  $('#betAmountLabel').textContent = mode === 'facing' ? '상대 베팅액' : '내 베팅액';
  document.querySelectorAll('[data-bet-mode]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.betMode === mode)));
  refreshBetAnalysis();
}

bettingPanel.addEventListener('toggle', refreshBetAnalysis);
document.querySelectorAll('[data-bet-mode]').forEach(button => {
  button.onclick = () => setBetMode(button.dataset.betMode);
});
$('#betPot').oninput = $('#betAmount').oninput = () => {
  amountsByMode[betMode] = $('#betAmount').value;
  if (!isAutoRange()) {
    updateBetResults();
    return;
  }
  clearTimeout(autoTimer);
  betWorker?.terminate();
  autoTypes = null;
  betScores = null;
  betError = false;
  updateBetRange();
  updateBetResults();
  autoTimer = setTimeout(refreshBetAnalysis, 250);
};
document.querySelectorAll('[data-auto-range]').forEach(button => {
  button.onclick = () => {
    autoEnabled[betMode] = !autoEnabled[betMode];
    if (!isAutoRange()) autoFilters[betMode].clear();
    refreshBetAnalysis();
  };
});
document.querySelectorAll('[data-auto-filter]').forEach(button => {
  button.onclick = () => {
    const filter = button.dataset.autoFilter;
    const filters = autoFilters[betMode];
    if (filters.has(filter)) filters.delete(filter);
    else filters.add(filter);
    autoEnabled[betMode] = true;
    refreshBetAnalysis();
  };
});
$('#openBetRange').onclick = () => {
  rangeDraft = new Set(activeBetRange());
  $('#autoRangeNote').hidden = !isAutoRange();
  $('#betRangeTitle').textContent = betMode === 'own' ? '콜할 것 같은 패' : '상대 패 후보';
  updateRangeGrid();
  rangeDialog.showModal();
};
$('#betRangeGrid').onclick = ({target}) => {
  const type = target.dataset.type;
  if (!type) return;
  if (rangeDraft.has(type)) rangeDraft.delete(type);
  else rangeDraft.add(type);
  target.setAttribute('aria-pressed', String(rangeDraft.has(type)));
};
$('#clearBetRange').onclick = () => { rangeDraft.clear(); updateRangeGrid(); };
$('#closeBetRange').onclick = () => rangeDialog.close();
$('#applyBetRange').onclick = () => {
  autoEnabled[betMode] = false;
  autoFilters[betMode].clear();
  betRanges[betMode] = rangeDraft;
  rangeDialog.close();
  refreshBetAnalysis();
};
$('#reset').addEventListener('click', () => {
  $('#betPot').value = $('#betPot').defaultValue;
  amountsByMode.facing = $('#betAmount').defaultValue;
  amountsByMode.own = '';
  betRanges.facing.clear();
  betRanges.own.clear();
  autoEnabled.facing = autoEnabled.own = false;
  autoFilters.facing.clear();
  autoFilters.own.clear();
  bettingPanel.open = false;
  setBetMode('facing');
});
window.refreshBetAnalysis = refreshBetAnalysis;
window.updateBetResults = updateBetResults;
