/* 빌더 앱 제어: 공통 상태·입력·계산 연동·보드·이벤트 (14개 기능 섹션) */
/* ── 01 · 설정·공통 상태 ── */
const DPS_CONFIG={
  storage:{
    version:(window.DPS_BUILD_VERSION || 'dev'),
    scope:'browser_local',
    key:'gbd_dps_calculator:personal_state',
    fontKey:'gbd_dps_calculator:font_scale',
    clientKey:'gbd_dps_calculator:client_id',
    traitPresetKey:'gbd_dps_calculator:trait_presets',
    traitPresetStatusKey:'gbd_dps_calculator:trait_preset_status'
  },

  state:{
    skipElementIds:['ep','artifactDpsViewToggle']
  },

  dpsTable:DPS_TABLE_UI_RULES,

  ui:{
    updateDelay:16,
    confirmDelayMs:1600,
    traitHoldInitialDelay:320,
    traitHoldRepeatMs:55,
    traitHoldAccelEvery:7,
    traitHoldMaxStep:50,
    fontScaleDefault:1,
    fontScaleMin:0.9,
    fontScaleMax:2,
    fontScaleStep:0.05,
    mobileMaxWidth:600
  }
};

let calculationElementOverrides=null;
function withCalculationElementOverrides(ids,callback){
  const previous=calculationElementOverrides;
  const next=previous ? new Map(previous) : new Map();
  (ids || []).forEach(id=>{
    const real=document.getElementById(id);
    if(!real) return;
    const clone=real.cloneNode(true);
    if('value' in real) clone.value=real.value;
    if('checked' in real) clone.checked=real.checked;
    if('indeterminate' in real) clone.indeterminate=real.indeterminate;
    next.set(id,clone);
  });
  calculationElementOverrides=next;
  try{return callback();}
  finally{calculationElementOverrides=previous;}
}
const $=id=>calculationElementOverrides?.get(id) || document.getElementById(id);
const qs=selector=>document.querySelector(selector);
const qsa=selector=>document.querySelectorAll(selector);
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char=>({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
}

const INV={};
TRAITS.forEach(t=>{INV[t[0]]=0;});
function appliedTraitInvestment(row){return INV[row]||0;}
const ENCHANT_INPUT_IDS=['enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR'];
const ENCHANT_INPUT_ID_SET=new Set(ENCHANT_INPUT_IDS);

/* ── 02 · 공통 UI·입력 유틸리티 ── */
function rememberAppIssue(kind,label,error){
  window.DPS_LAST_ISSUE={kind,label,error,time:Date.now()};
}
function alertApp(message){
  showToast(String(message ?? ''),'err',5600);
}
function alertAppError(prefix, error){
  alertApp(prefix+(error?.message || error));
}
function showToast(message, type='ok', durationMs){
  try{
    let root=$('toastRoot');
    if(!root){
      root=document.createElement('div');
      root.id='toastRoot';
      root.className='toast-root';
      root.setAttribute('aria-live','polite');
      document.body.appendChild(root);
    }
    const text=String(message ?? '').trim();
    if(!text) return;
    const toastKey=`${type}:${text}`;
    if(Array.from(root.children).some(item=>item.dataset.toastKey===toastKey)) return;
    while(root.children.length>=4) root.firstElementChild?.remove();
    const el=document.createElement('div');
    el.className='toast '+type;
    el.dataset.toastKey=toastKey;
    el.textContent=text;
    root.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    const requestedMs=Number(durationMs);
    const visibleMs=Number.isFinite(requestedMs) && requestedMs>0 ? requestedMs : (text.includes('\n') ? 5200 : 2200);
    setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=>el.remove(), 220);
    }, visibleMs);
  }catch(error){
    rememberAppIssue('warn','showToast',error);
  }
}
let pendingConfirmAction=null;
function requestConfirmAction(key,message,run){
  const now=Date.now();
  const delay=DPS_CONFIG.ui.confirmDelayMs || 1600;
  if(pendingConfirmAction && pendingConfirmAction.key===key && now<pendingConfirmAction.until){
    const timer=pendingConfirmAction.timer;
    pendingConfirmAction=null;
    if(timer) clearTimeout(timer);
    return run();
  }
  if(pendingConfirmAction && pendingConfirmAction.timer) clearTimeout(pendingConfirmAction.timer);
  showToast(message,'warn');
  pendingConfirmAction={
    key,
    until:now+delay,
    timer:setTimeout(()=>{
      if(pendingConfirmAction && pendingConfirmAction.key===key) pendingConfirmAction=null;
    }, delay)
  };
  return false;
}

function v(id){
  const el=$(id); if(!el) return 0;
  if(id==='round') return normalizedRoundNumber(targetRoundStoredValue());
  if(id==='challengeTowerFloor') return normalizedTowerFloorNumber(challengeTowerFloorStoredValue());
  if(id==='planetExplorationFloor') return normalizedPlanetExplorationFloorNumber(planetExplorationFloorStoredValue());
  if(id==='penance') return effectivePenanceValue();
  if(id==='pbless') return effectivePowerBlessValue();
  const raw=String(el.value??'').replace(/,/g,'').trim();
  if(id==='skillRound') return normalizedSkillRoundNumber(raw);
  return +raw||0;
}
function vs(id){const el=$(id); return el ? el.value : '';}
function normalizeXpInput(){
  const el=$('xp');
  if(!el) return 1;
  const n=Math.max(1, v('xp'));
  if(v('xp')!==n) el.value=String(n.toLocaleString('ko-KR'));
  return n;
}
function setElementProp(id, prop, value){const el=$(id); if(el) el[prop]=value;}
function setText(id,val){setElementProp(id,'textContent',val);}
function setValue(id,val){setElementProp(id,'value',String(val));}
function setSelectOptions(select, options){
  if(!select) return;
  select.innerHTML='';
  options.forEach(({value,label,selected=false})=>{
    const option=document.createElement('option');
    option.value=String(value);
    option.textContent=String(label ?? value);
    option.selected=!!selected;
    select.appendChild(option);
  });
}
function syncSelectOptionsBySignature(select, signature, options, signatureKey='optionSignature'){
  if(!select) return;
  if(select.dataset[signatureKey]!==signature){
    setSelectOptions(select, options);
    select.dataset[signatureKey]=signature;
  }
}
function normalizedUnsignedDigits(value, fallback='0'){
  const digits=String(value ?? '').replace(/[^0-9]/g,'').replace(/^0+(?=\d)/,'');
  return digits || fallback;
}
function clampedIntegerString(value, min, max, fallback=0){
  const digits=normalizedUnsignedDigits(value, '');
  const number=digits ? Number(digits) : fallback;
  const finite=Number.isFinite(number) ? Math.round(number) : fallback;
  return String(Math.max(min, Math.min(max, finite)));
}
function setClassState(el, classNames, active){
  if(!el) return;
  const names=Array.isArray(classNames) ? classNames : [classNames];
  names.forEach(name=>el.classList.toggle(name, !!active));
}
function setTogglePressed(el, active, options={}){
  if(!el) return;
  setClassState(el, options.classes || ['active','is-active'], active);
  el.setAttribute(options.attribute || 'aria-pressed', active ? 'true' : 'false');
  if(options.activeText || options.inactiveText) el.textContent=active ? (options.activeText || '') : (options.inactiveText || '');
}
function setTextMap(map){
  Object.entries(map).forEach(([id,value])=>setText(id,value));
}

const RUNE_CHOICE_TARGETS=[['ap','rAP'],['ua','rUA'],['td','rTD'],['harmony','rHarmony']];
const SPEC_BOARD_PIERCE_VALUES=Object.freeze([0,10,15,20,25,30,35,40]);
const SPEC_BOARD_PIERCE_VALUE_SET=new Set(SPEC_BOARD_PIERCE_VALUES.map(String));
function normalizeSpecBoardPierceValue(value){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  return SPEC_BOARD_PIERCE_VALUE_SET.has(raw) ? raw : '0';
}
function specBoardPierceValue(){
  return Number(normalizeSpecBoardPierceValue(vs('specBoardPierce'))) || 0;
}

/* ── 03 · 입력·화면 동기화 ── */
function syncRuneChoice(){
  const type=vs('runeChoiceType') || 'harmony';
  const value=v('runeChoiceValue');
  RUNE_CHOICE_TARGETS.forEach(([kind,id])=>setValue(id, kind===type ? value : 0));
}
function hydrateRuneChoiceFromHidden(){
  const typeEl=$('runeChoiceType');
  const valueEl=$('runeChoiceValue');
  if(!typeEl || !valueEl) return;
  const selected=RUNE_CHOICE_TARGETS.find(([,id])=>v(id)!==0);
  typeEl.value=selected ? selected[0] : 'harmony';
  valueEl.value=String(selected ? v(selected[1]) : 0);
  syncRuneChoice();
}
function setSelectButton(id,value){
  const el=$(id);
  if(!el) return;
  if(['aprRunePlus','sepRunePlus'].includes(id) && Number(value)>v(id.replace('Plus','Normal'))) return;
  el.value=value;
  syncSelectButtons();
  commitAppUpdate();
}
function syncSelectButtons(){
  const runePlusLimits={};
  ['aprRune','sepRune'].forEach(prefix=>{
    const normal=$(prefix+'Normal');
    const plus=$(prefix+'Plus');
    if(!normal || !plus) return;
    const limit=Math.max(0,Math.min(6,Number(normal.value)||0));
    runePlusLimits[plus.id]=limit;
    if(Number(plus.value)>limit) plus.value=String(limit);
    [...plus.options].forEach(option=>{
      const disabled=Number(option.value)>limit;
      if(option.disabled!==disabled) option.disabled=disabled;
    });
  });
  qsa('.seg-btns[data-target]').forEach(group=>{
    const id=group.dataset.target;
    const val=$(id)?.value;
    group.querySelectorAll('button[data-value]').forEach(btn=>{
      if(Object.hasOwn(runePlusLimits,id)) btn.disabled=Number(btn.dataset.value)>runePlusLimits[id];
      setClassState(btn, 'active', btn.dataset.value===val);
    });
  });
}
function syncBuffChoiceButtons(){
  qsa('.buff-choice-item').forEach(item=>{
    const input=item.querySelector('input[type="checkbox"]');
    setTogglePressed(item, !!input?.checked, {classes:'is-active'});
  });
}
function syncDonationBuffControl(){
  const select=$('donationBuffType');
  if(!select) return;
  const value=activeDonationBuffType();
  if(select.value!==value) select.value=value;
  qsa('.donation-buff-grid button[data-value]').forEach(button=>{
    const selected=button.dataset.value===value;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',selected ? 'true' : 'false');
  });
}
function setDonationBuffType(value){
  const select=$('donationBuffType');
  if(!select) return false;
  const normalized=normalizeDonationBuffType(value);
  INV[116]=donationInvestmentFromType(normalized);
  select.value=normalized;
  syncDonationBuffControl();
  syncSelectButtons();
  commitAppUpdate();
  return true;
}
const originalDifficultyOptions=[];
const lastValidDifficultyByMode=new Map();
function syncDifficultyOptions({restoreAll=false}={}){
  const el=$('diff');
  if(!el) return;
  if(!originalDifficultyOptions.length){
    originalDifficultyOptions.push(...[...el.options].map(option=>({value:option.value,label:option.textContent})));
  }
  const monthlyPlanetDifficulty=currentPlanetExplorationDifficulty();
  const planetOption=originalDifficultyOptions.find(option=>isPlanetExplorationDifficulty(option.value));
  if(planetOption) planetOption.value=monthlyPlanetDifficulty;
  const coop=isCoopMode();
  const artifact=!restoreAll && isArtifactDpsViewEnabled();
  const key=`${coop?'coop':'solo'}:${artifact?'artifact':'normal'}`;
  const options=originalDifficultyOptions.filter(option=>restoreAll ||
    (!coop || isCoopAllowedDifficulty(option.value)) &&
    (!artifact || !artifactDpsUnavailableDifficulty(option.value)));
  const current=isPlanetExplorationDifficulty(el.value) ? monthlyPlanetDifficulty : el.value;
  syncSelectOptionsBySignature(el,`${restoreAll?'all':key}:${monthlyPlanetDifficulty}`,options,'difficultyOptionSignature');
  const allowed=new Set(options.map(option=>option.value));
  const next=allowed.has(current) ? current :
    (allowed.has(lastValidDifficultyByMode.get(key)) ? lastValidDifficultyByMode.get(key) : 'Hall Of Fame');
  el.value=next;
  if(!restoreAll) lastValidDifficultyByMode.set(key,next);
}
function penanceOptionLabel(value){return value>0 ? `${value} 고행` : '선택 안함';}
function syncPenanceOptions(){
  const el=$('penance');
  if(!el) return;
  const diff=vs('diff');
  const ignored=shouldIgnorePenanceForDifficulty(diff);
  const max=ignored ? 0 : diff==='Abyss road' ? DPS_CONFIG.dpsTable.abyssRoadPenanceMax : currentPenanceMax();
  const current=normalizePenanceValue(el.value || el.dataset.penanceValue || '0', max);
  syncSelectOptionsBySignature(
    el,
    String(max),
    Array.from({length:max+1}, (_,value)=>({value,label:penanceOptionLabel(value)})),
    'penanceMax'
  );
  el.value=current;
  el.dataset.penanceValue=current;
  el.disabled=ignored;
}
function powerBlessOptionLabel(value){return Number(value)>0 ? String(value) : '선택 안함';}
function syncPowerBlessOptions(){
  const el=$('pbless');
  if(!el) return;
  const current=normalizePowerBlessRawValue(el.value);
  syncSelectOptionsBySignature(
    el,
    `pbless:${POWER_BLESS_ALL_OPTIONS.join(',')}`,
    POWER_BLESS_ALL_OPTIONS.map(value=>({value,label:powerBlessOptionLabel(value)}))
  );
  el.value=current;
}
function syncModeChoiceButtons(){
  const coop=normalizeOnOffValue($('coopMode')?.value,'OFF')==='ON';
  const bank=normalizeSpBankApplyValue($('spBankApply')?.value);
  qsa('[data-mode-choice]').forEach(button=>{
    const group=button.dataset.modeChoice;
    const selected=group==='battle' ? button.dataset.value===(coop?'coop':'solo') : button.dataset.value===bank;
    button.setAttribute('aria-pressed',selected ? 'true' : 'false');
    button.classList.toggle('is-selected',selected);
  });
}
function syncBattleMode(sourceId='', options={}){
  const solo=$('soloMode'), coop=$('coopMode');
  if(!solo || !coop) return;
  const normalizedCoop=normalizeOnOffValue(coop.value,'OFF');
  syncSelectOptionsBySignature(coop, 'coop-mode-toggle', [{value:'OFF',label:'OFF'},{value:'ON',label:'ON'}]);
  coop.value=normalizedCoop;
  const sourceValue=sourceId==='soloMode' ? normalizeOnOffValue(solo.value,'ON') : normalizeOnOffValue(coop.value,'OFF');
  const coopOn=sourceId==='soloMode' ? sourceValue!=='ON' : sourceValue==='ON';
  solo.value=coopOn ? 'OFF' : 'ON';
  coop.value=coopOn ? 'ON' : 'OFF';
  syncDifficultyOptions();
  syncPenanceOptions();
  syncTeamSelect({restorePersonal: !!sourceId && !coopOn, preserveCurrent: !sourceId, defaultCoop: !!options.defaultCoop && coopOn});
  syncModeChoiceButtons();
}
function syncTeamButtons(){
  const selected=vs('team');
  const available=new Set([...($('team')?.options || [])].map(option=>option.value));
  qsa('[data-team-count]').forEach(button=>{
    const active=button.dataset.teamCount===selected;
    button.disabled=!available.has(button.dataset.teamCount);
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function syncTeamSelect(options={}){
  const el=$('team');
  if(!el) return;
  const row=el.closest?.('[data-basic-row="team"]');
  const coopActive=isCoopActive();
  const locked=!coopActive && SOLO_START_LOCK_DIFFICULTIES.has(difficultyName());
  const current=normalizeTeamCountValue(el.value);
  const optionValues=coopActive ? [2,3] : locked ? [1] : [1,2,3];
  if(locked && current!=='1') el.dataset.personalTeamValue=current;
  syncSelectOptionsBySignature(
    el,
    `team:${coopActive?'coop':locked?'locked':'solo'}:${optionValues.join(',')}`,
    optionValues.map(value=>({value,label:String(value)})),
    'teamOptionSignature'
  );
  el.disabled=false;
  row?.classList.toggle('is-locked',locked);
  if(coopActive){
    const source=options.defaultCoop ? '3' : ((current==='2' || current==='3') ? current : (el.dataset.coopTeamValue || '3'));
    const value=normalizeTeamCountValue(source,3)==='1' ? '3' : normalizeTeamCountValue(source,3);
    el.value=value;
    el.dataset.coopTeamValue=value;
  }else{
    const restorePersonal=options.restorePersonal || (current==='1' && !!el.dataset.personalTeamValue && options.preserveCurrent!==true);
    const source=locked ? '1' : restorePersonal ? (el.dataset.personalTeamValue || current) : current;
    const value=normalizeTeamCountValue(source,1);
    el.value=value;
    if(!locked) el.dataset.personalTeamValue=value;
  }
  syncTeamButtons();
}
function clampEnchantInput(el){
  let n=parseInt(String(el.value||'0').replace(/[^0-9]/g,''),10);
  if(!Number.isFinite(n)) n=0;
  n=Math.max(0,Math.min(9,n));
  el.value=String(n);
  return n;
}
function syncEnchantInputs(){
  const code=ENCHANT_INPUT_IDS.map(id=>{
    const el=$(id);
    return el ? clampEnchantInput(el) : 0;
  }).join('');
  const hidden=$('enchantCode');
  if(hidden) hidden.value=code;
}
function syncEnchantCodeFromInputs(updateInputs=true){
  const hidden=$('enchantCode');
  const hasInputs=ENCHANT_INPUT_IDS.some(id=>$(id));
  if(!hasInputs) return;
  if(updateInputs && hidden){
    const code=String(hidden.value||'999999').padEnd(6,'0');
    ENCHANT_INPUT_IDS.forEach((id,i)=>{
      const el=$(id);
      if(el) el.value=String(Math.max(0,Math.min(9,parseInt(code[i]||'0',10)||0)));
    });
  }
  syncEnchantInputs();
}
function formatMoneyInput(el){
  if(!el) return;
  if(typeof SHARD_VALUE_IDS!=='undefined' && SHARD_VALUE_IDS.has(el.id)){
    const normalized=normalizeShardStorageValue(el.value);
    el.value=normalized.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    return;
  }
  const raw=String(el.value||'').replace(/[^\d-]/g,'');
  if(raw===''||raw==='-'){el.value=raw;return;}
  const neg=raw[0]==='-';
  const digits=(neg?raw.slice(1):raw).replace(/^0+(?=\d)/,'');
  el.value=(neg?'-':'') + (digits?digits.replace(/\B(?=(\d{3})+(?!\d))/g,','):'0');
}
const DECIMAL_DISPLAY_INPUT_IDS=new Set(['addAD','addAS','addCD','addCRI','addAP','addTD','addUA']);
function formatAllMoneyInputs(){
  qsa('.money-input').forEach(formatMoneyInput);
  DECIMAL_DISPLAY_INPUT_IDS.forEach(id=>{
    const el=$(id);
    if(el) el.value=normalizeDecimalDisplayValue(el.value);
  });
}

function currentArtifactDpsResult(){
  const diff=vs('diff');
  const battleMode=isCoopMode() ? 'coop' : 'solo';
  if(isTowerDifficulty()){
    return calculateArtifactDpsPreview(TOWER_DIFFICULTY_NAME, 0, challengeTowerFloorStoredValue(), {battleMode:'solo'});
  }
  return calculateArtifactDpsPreview(diff, v('penance'), targetRoundStoredValue(), {battleMode});
}
function renderDpsSummary(s){
  updateDpsContextSummary();
  syncDpsBaseUnitControl();
  const artifactView=isArtifactDpsViewEnabled();
  setText('dpsMainLabel', artifactView ? '유물 DPS' : '스펙 DPS');
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    renderDpsBaseUnitSummary(s,true);
    return;
  }
  const artifactResult=artifactView ? currentArtifactDpsResult() : null;
  const displayDps=artifactView ? artifactResult.dps : s.M19;
  setText('dpsVal', Number.isFinite(displayDps) ? displayDps.toFixed(2) : '—');
  renderDpsBaseUnitSummary(s,false);
}
const STAT_COMPARE_ROWS=[
  ['AD', s=>fmt(s.displayAD,0), s=>fmt(s.M4,0)],
  ['APS', s=>fmt(s.displayAPS,0), s=>fmt(s.displayAPS,0)],
  ['APU', s=>fmt(s.displayAPU,0), s=>fmt(s.actualAPU ?? s.displayAPU,0)],
  ['AS', s=>fmt(s.M7,1), s=>fmt(s.M7,1)],
  ['CRI', s=>fmt(s.M8,1), s=>fmt(s.M8,1)],
  ['CD', s=>fmt(s.displayCD,1), s=>fmt(s.actualCD,2)],
  ['MC', s=>fmt(s.M10,0), s=>fmt(s.M10,0)],
  ['TD', s=>fmt(s.rawTD,1), s=>fmt(s.M11,2)],
  ['DR', s=>fmt(s.M12,0), s=>fmt(s.actualM12,0)],
  ['DR2P', ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger2Dr'),0), ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger2Dr'),0)],
  ['DR3P', ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger3Dr'),0), ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger3Dr'),0)],
  ['PIERCE', s=>`${fmt(s.effectivePierce,0)}%`, s=>`${fmt(s.effectivePierce,0)}%`],
  ['UA', s=>fmt(s.displayUA,4), s=>fmt(s.M13,4)],
  ['SR', s=>fmt(s.displaySR,2), s=>fmt(s.actualSR ?? s.displaySR,2)],
  ['HR', s=>fmt(s.displayHR,2), s=>fmt(s.actualHR ?? s.displayHR,2)],
  ['MD', s=>fmt(s.M16,0), s=>fmt(s.M16,0)],
  ['MP', s=>fmt(s.M17,0), s=>fmt(s.M17,0)],
  ['MCP', s=>fmt(s.M18,0), s=>fmt(s.M18,0)]
];
function dpsBoardContextHtml(){
  const context=getDpsContextValues();
  const difficulty=isPlanetExplorationDifficulty() ? planetExplorationDisplayName() : selectedControlText($('diff'));
  return `<span class="spec-board-mode">${escapeHtml(context.modePrimary)}</span><span class="spec-board-difficulty">${escapeHtml(difficulty)}</span>`;
}
function renderRightHeroContext(){
  const target=$('rightHeroCompactContext');
  if(target) target.innerHTML=dpsBoardContextHtml();
  const tower=isTowerDifficulty();
  const planet=isPlanetExplorationDifficulty();
  setText('specHeroStageLabel',tower||planet?'현재 층':'현재 고행 / 라운드');
  setText('specHeroStage',tower?`${challengeTowerFloorStoredValue()}층`:planet?`${planetExplorationFloorStoredValue()}층`:`${effectivePenanceValue()} 고행`);
  setText('specHeroRound',tower||planet?'':`${normalizedRoundNumber(targetRoundStoredValue())} 라운드`);
}
function renderStatSummary(s){
  renderRightHeroContext();
  const artifactView=isArtifactDpsViewEnabled();
  const coopActive=isCoopActive();
  const teamCount=typeof effectiveTeamCount==='function' ? effectiveTeamCount() : Math.max(1, Math.min(3, Number(v('team')) || 1));
  qsa('[data-coop-stat-row]').forEach(row=>{
    const player=Number(row.dataset.coopStatRow)||0;
    row.hidden=!coopActive || player>teamCount;
  });
  STAT_COMPARE_ROWS.forEach(([key,display,actual])=>{
    const displayText=artifactView && key==='PIERCE' ? '0%' : display(s);
    const actualText=artifactView && key==='PIERCE' ? '0%' : actual(s);
    setText('s'+key+'Display', displayText);
    setText('s'+key+'Actual', actualText);
  });
}
function renderResourceSummary(s){
  const totalSp=s.effectiveSP ?? effectiveSP();
  const usedSp=s.spUsedTotal ?? ((s.spO||0)+(s.spU||0));
  const spRemain=totalSp-usedSp;
  const epOwned=v('ep');
  const epRemain=epOwned-s.epU;
  const rpRemain=v('rp')-s.rpU;
  const soulRemain=v('soul')-s.soulU;
  setTextMap({
    spTotalBasicView:fullNumber(totalSp),
    spAttackView:fullNumber(s.spO), spUtilityView:fullNumber(s.spU), spRemainBasicView:fullNumber(spRemain),
    epUsedBasicView:fullNumber(s.epU), epRemainBasicView:fullNumber(epRemain),
    rpUsedBasicView:fullNumber(s.rpU), rpRemainBasicView:fullNumber(rpRemain),
    soulUsedBasicView:fullNumber(s.soulU), soulRemainBasicView:fullNumber(soulRemain)
  });
  syncSpBankDisplay();
}
function syncControlDisplays(){
  [syncSelectButtons,syncDonationBuffControl,syncBuffChoiceButtons,syncBattleMode,syncSpBankApplyControl,syncDifficultyTargetControls,syncErosionControlElements,syncPowerBlessOptions,syncSpecDpsSpeedSwitch,normalizeAllDpsBaseUnitQuantityInputs,formatAllMoneyInputs].forEach(fn=>fn());
}
function syncSpBankApplyControl(){
  const select=$('spBankApply');
  if(!select) return false;
  const state=normalizeSpBankApplyValue(select.value);
  if(select.value!==state) select.value=state;
  syncModeChoiceButtons();
  return true;
}
function syncPreCalculationViews(){
  normalizeRoundInputs();
  syncExclusiveRuneOptions();
  syncRuneChoice();
  syncDonationBuffControl();
  syncEnchantInputs();
  syncControlDisplays();
  syncTraitLimitInputs();
  renderEnchantPreview();
  renderXpCut();
}
function renderCalculatedViews(s){
  renderSkillDamage(s);
  renderDpsSummary(s);
  renderStatSummary(s);
  syncSpecDpsSpeedSwitch();
  syncArtifactDpsViewSwitch();
  syncPlanetExplorationRestrictedControls();
  renderEnhanceSummary(s.enhanceStats);
  renderResourceSummary(s);
  updateTraits();
}
/* 특성 투자 제한: 원본 ON/OFF 셀렉트와 좌우 선택 버튼 동기화 */
const TRAIT_LIMIT_STATUS_FIELDS=['traitLimitAS','traitLimitCRI','traitLimitMultiTarget','traitLimitInfinite'];
function syncTraitLimitControlPresentation(){
  for(const id of ['traitLimitMultiTarget','traitLimitInfinite']){
    const field=$(id);
    if(!field) continue;
    document.querySelectorAll(`[data-limit-select="${id}"]`).forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.limitValue===field.value));
    });
  }
}
function bindTraitLimitChoiceEvents(){
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-limit-select][data-limit-value]');
    if(!button || button.disabled) return;
    const field=$(button.dataset.limitSelect);
    if(!field || field.value===button.dataset.limitValue) return;
    field.value=button.dataset.limitValue;
    syncTraitLimitControlPresentation();
    field.dispatchEvent(new Event('change',{bubbles:true}));
  });
  ['input','change'].forEach(type=>{
    document.addEventListener(type,event=>{
      if(TRAIT_LIMIT_STATUS_FIELDS.includes(event.target?.id)) syncTraitLimitControlPresentation();
    },true);
  });
}
/* ── 04 · 계산 실행·예약 ── */
let appCalculationRevision=0;
let appUpdateTimer=0;
let pendingAppUpdateSave=false;
function invalidateAppCalculations(){
  appCalculationRevision++;
}
function recalc(options={}){
  try{
    syncPreCalculationViews();
    syncTraitLimitControlPresentation();
    withArtifactDpsViewBuffApplied(()=>{
      const stats=computeStatsRaw();
      invalidateAppCalculations();
      renderCalculatedViews(stats);
    });
    if(options.save!==false) saveState({silent:true});
  }catch(e){
    rememberAppIssue('error','recalc',e);
    try{updateTraits();}catch(traitError){rememberAppIssue('error','특성 표시',traitError);}
    return false;
  }
  return true;
}
function requestAppUpdate(options={}){
  invalidateAppCalculations();
  pendingAppUpdateSave = pendingAppUpdateSave || options.save!==false;
  if(appUpdateTimer) clearTimeout(appUpdateTimer);
  appUpdateTimer=setTimeout(()=>{
    const save=pendingAppUpdateSave;
    appUpdateTimer=0;
    pendingAppUpdateSave=false;
    recalc({save});
  }, DPS_CONFIG.ui.updateDelay);
}
function commitAppUpdate(options={}){
  const recalculate=options.recalculate ?? 'defer';
  const save=options.save!==false && !dpsUnitSlotDraft;
  const saveNow=options.saveNow===true;
  if(recalculate==='now'){
    if(appUpdateTimer) clearTimeout(appUpdateTimer);
    appUpdateTimer=0;
    pendingAppUpdateSave=false;
    recalc({save:save && saveNow});
  }else if(recalculate!==false) requestAppUpdate({save:save && saveNow});
  if(save) scheduleAutoSave();
}
function renderEnhanceSummary(stats=null){
  const e=stats || unitEnhanceStats();
  const unitLimit=dpsBaseUnitQuantityLimit();
  const sepPlusUniqueAd=SYSTEM_COMMON_BUFFS.uniqueUnit.baseAd + septemberPlusUniqueAdBonus(e.septemberPlus);
  setTextMap({
    enhanceChanceView:(e.chance*100).toFixed(2)+'%',
    enhanceCountView:`${fmt(e.count,0)}회`,
    enhanceValueView:fmt(e.value,0),
    sepRuneQuantityView:fmt(unitLimit,0),
    sepRuneAttackView:`+${fmt(sepPlusUniqueAd,0)}`
  });
}
function renderEnchantPreview(){
  const keys=['ad','cri','ua','td','sr','hr'];
  const outIds=['enchOutAD','enchOutCRI','enchOutUA','enchOutTD','enchOutSR','enchOutHR'];
  const enchantStats=currentEnchantStats();
  keys.forEach((key,i)=>{
    const e=enchantStats[i];
    const val=key==='ua'
      ? e[key].toFixed(2)+'×'
      : fmt(e[key], ['ad','cri','td'].includes(key)?0:2);
    const out=$(outIds[i]);
    if(out) out.textContent=val;
  });
}

function renderXpCut(){
  const base=xpCutCoopBase(v('sp'));
  const target=$('xpCutRows');
  if(!target) return;
  target.innerHTML=XP_CUT_DIVISOR_GROUPS.map(group=>{
    const rows=group.rows.map(row=>{
      const value=big(base/row.divisor);
      return `<div class="bus-cut-row"><span class="bus-cut-stage">${row.stage}·${row.divisor}배</span><span class="bus-cut-value">${value}</span></div>`;
    }).join('');
    return `<div class="bus-cut-group"><span class="bus-cut-mode">${group.label}</span><div class="bus-cut-group-rows">${rows}</div></div>`;
  }).join('');
}

function planetExplorationRestrictionsActive(){
  return typeof isPlanetExplorationDifficulty==='function' && isPlanetExplorationDifficulty();
}
function artifactDpsUnavailableDifficulty(diff=vs('diff')){
  return diff==='Abyss road' || diff==='Deep Abyss' || isPlanetExplorationDifficulty(diff);
}
function isArtifactDpsViewEnabled(){
  const toggle=$('artifactDpsViewToggle');
  return !artifactDpsUnavailableDifficulty() && toggle?.getAttribute('aria-checked')==='true';
}
function setArtifactDpsViewEnabled(enabled){
  const toggle=$('artifactDpsViewToggle');
  if(!toggle) return;
  toggle.setAttribute('aria-checked',enabled && !artifactDpsUnavailableDifficulty() ? 'true' : 'false');
  syncArtifactDpsViewSwitch();
  syncDifficultyOptions();
}
function syncArtifactDpsViewSwitch(){
  const toggle=$('artifactDpsViewToggle');
  if(!toggle) return;
  const disabled=artifactDpsUnavailableDifficulty();
  if(disabled) toggle.setAttribute('aria-checked','false');
  const active=isArtifactDpsViewEnabled();
  const dpsTableTitle=active ? '유물 DPS표' : 'DPS표';
  setText('dpsCompareOpen',dpsTableTitle);
  setText('dpsCompareModalLabel',dpsTableTitle);
  setText('traitOptimizeScopeTitle',active ? '유물 최적화 범위' : '특성 최적화 범위');
  const optimizeButton=document.querySelector('[data-action="optimizeSP"]');
  if(optimizeButton) optimizeButton.textContent=active ? '유물 최적화' : '특성 최적화';
  syncOnOffSwitch(toggle,{
    active,disabled,label:'유물 DPS',disabledLabel:'유물 DPS 사용 불가',
    containerSelector:'.artifact-dps-switch-wrap'
  });
}
function syncOnOffSwitch(toggle,{active=false,disabled=false,label='설정',disabledLabel='',containerSelector=''}){
  if(!toggle) return;
  toggle.disabled=disabled;
  toggle.classList.toggle('is-active',active);
  toggle.setAttribute('aria-checked',active ? 'true' : 'false');
  toggle.setAttribute('aria-disabled',disabled ? 'true' : 'false');
  toggle.setAttribute('aria-label',disabled && disabledLabel ? disabledLabel : `${label} ${active ? '켬' : '끔'}`);
  if(containerSelector) toggle.closest(containerSelector)?.classList.toggle('is-disabled',disabled);
}
const UNIFIED_DPS_SPEED_MODE_INPUT_IDS=Object.freeze(['specDpsSpeedMode','dpsBaseUnitSpeedMode']);
function setUnifiedDpsSpeedModeValue(enabled){
  const disabled=!speedModeSupported();
  const active=!disabled && !!enabled;
  UNIFIED_DPS_SPEED_MODE_INPUT_IDS.forEach(id=>{
    const input=$(id);
    if(input) input.value=active ? 'ON' : 'OFF';
  });
  return {active,disabled};
}
function normalizeUnifiedDpsSpeedModeValue(){
  const active=UNIFIED_DPS_SPEED_MODE_INPUT_IDS.some(id=>storedSpeedModeEnabled(id));
  return setUnifiedDpsSpeedModeValue(active);
}
function syncSpecDpsSpeedSwitch(){
  const toggles=qsa('[data-spec-dps-speed-toggle]');
  if(!toggles.length) return;
  const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
  toggles.forEach(toggle=>syncOnOffSwitch(toggle,{active,disabled,label:'스피드 모드',containerSelector:'.spec-dps-speed-switch-wrap'}));
}
function syncPlanetExplorationRestrictedControls(){
  const disabled=planetExplorationRestrictionsActive();
  const artifact=$('prodArtifact');
  if(artifact){
    if(disabled) artifact.checked=false;
    artifact.disabled=disabled;
    artifact.closest('.buff-choice-item')?.classList.toggle('is-disabled',disabled);
  }
  syncBuffChoiceButtons();
  if(disabled) setArtifactDpsViewEnabled(false);
}
function applyUnifiedDpsSpeedModeToggle(active){
  setUnifiedDpsSpeedModeValue(!active);
  syncSpecDpsSpeedSwitch();
  commitAppUpdate();
  return true;
}
function toggleSpecDpsSpeedMode(){
  const toggle=$('specDpsSpeedModeToggle');
  const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
  if(toggle?.disabled || disabled) return false;
  return applyUnifiedDpsSpeedModeToggle(active);
}
function withArtifactDpsViewBuffApplied(callback){
  const artifactEl=$('prodArtifact');
  if(!artifactEl || !isArtifactDpsViewEnabled()) return callback();
  const checked=artifactEl.checked;
  artifactEl.checked=true;
  try{
    return callback();
  }finally{
    artifactEl.checked=checked;
  }
}
function renderSkillDamage(s){
  const ap=s?.displayAPU ?? 535;
  const rows=calculateSkillDamageRows({ap,doubleSpace:v('skillDouble'),round:v('skillRound'),mode:vs('skillMode')});
  const apView=$('skillAPView');
  if(apView) apView.textContent=fmt(ap,0);
  const pv=$('skillPenaltyView');
  if(pv) pv.textContent=`${(rows.penalty*100).toFixed(1)}%`;
  const el=$('skillRows');
  if(!el) return;
  el.innerHTML=rows.items.map(row=>`<tr><td>${row.name}</td><td>${fmt(row.total,1)}%</td><td>AP ${fmt(ap,0)} / 더블 ${fmt(rows.doubleSpace,2)}</td></tr>`).join('');
}
/* ── 05 · DPS표 및 미리보기 ── */
const DPS_TABLE_DIFFICULTIES=DPS_CONFIG.dpsTable.difficulties;
const COOP_DPS_TABLE_DIFFICULTIES=DPS_TABLE_DIFFICULTIES.slice(0, DPS_TABLE_DIFFICULTIES.indexOf('Hall Of Fame') + 1);
const COOP_DPS_TABLE_PENANCE_MIN=0;
const COOP_DPS_TABLE_PENANCE_MAX=COOP_PENANCE_MAX;
const DPS_TABLE_PENANCE_MIN=Math.max(0,DPS_CONFIG.dpsTable.penanceMin ?? 0);
const DPS_TABLE_PENANCE_MAX=DPS_CONFIG.dpsTable.penanceMax ?? 20;
let dpsPreviewCacheRevision=-1;
const dpsPreviewValueCache=new Map();
const dpsPreviewCoreCache=new Map();
function dpsTablePreviewCore(diff,round,options,artifactView){
  const cacheKey=JSON.stringify([artifactView,diff,round,options.battleMode||'',options.teamCount||'']);
  if(dpsPreviewCoreCache.has(cacheKey)) return dpsPreviewCoreCache.get(cacheKey);
  try{
    const core=calculateDpsPreviewCore(diff,round,options,artifactView);
    dpsPreviewCoreCache.set(cacheKey,core);
    return core;
  }catch(e){
    rememberAppIssue('error','[DPS preview core failed]',e);
    return null;
  }
}
function dpsTablePreviewValue(diff, penance, round, options={}){
  if(dpsPreviewCacheRevision!==appCalculationRevision){
    dpsPreviewValueCache.clear();
    dpsPreviewCoreCache.clear();
    dpsPreviewCacheRevision=appCalculationRevision;
  }
  const artifactView=isArtifactDpsViewEnabled();
  const cacheKey=JSON.stringify([artifactView,diff,penance,round,options.battleMode||'',options.teamCount||'']);
  if(dpsPreviewValueCache.has(cacheKey)) return dpsPreviewValueCache.get(cacheKey);
  const previewOptions={...options,previewCore:dpsTablePreviewCore(diff,round,options,artifactView)};
  const value=artifactView
    ? calculateArtifactDpsPreview(diff, penance, round, previewOptions).dps
    : computeDpsPreview(diff, penance, round, previewOptions);
  dpsPreviewValueCache.set(cacheKey,value);
  return value;
}
function selectedDpsTableTeamCount(coop=false){
  const teamCount=Number(normalizeTeamCountValue(vs('team'),coop?2:1));
  return coop ? Math.max(2,teamCount) : teamCount;
}
// 분석 보드 DPS표: 기존 입력값과 DPS 미리보기 캐시를 그대로 활용합니다.
let activeDpsCompareMode='solo';
function formatDpsCompareValue(value){
  if(!Number.isFinite(value)) return '—';
  const displayed=value.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1});
  return Number(displayed.replace(/,/g,''))<=0 ? '-' : displayed;
}
function dpsCompareMatrixHtml(coop){
  const round=normalizedRoundNumber(targetRoundStoredValue());
  const teamCount=selectedDpsTableTeamCount(coop);
  const difficulties=(coop?COOP_DPS_TABLE_DIFFICULTIES:DPS_TABLE_DIFFICULTIES).filter(diff=>!isArtifactDpsViewEnabled() || !artifactDpsUnavailableDifficulty(diff));
  const min=coop?COOP_DPS_TABLE_PENANCE_MIN:DPS_TABLE_PENANCE_MIN;
  const max=coop?COOP_DPS_TABLE_PENANCE_MAX:DPS_TABLE_PENANCE_MAX;
  const currentDiff=vs('diff');
  const currentPenance=Number(penanceStoredValue());
  const head=difficulties.map(diff=>`<th scope="col"${diff===currentDiff?' class="is-current"':''}>${escapeHtml(diff)}</th>`).join('');
  const rows=Array.from({length:max-min+1},(_,index)=>{
    const pen=min+index;
    const values=difficulties.map(diff=>{
      const unavailable=(diff==='Deep Abyss' && pen>0) ||
        (diff==='Abyss road' && pen>DPS_CONFIG.dpsTable.abyssRoadPenanceMax);
      const displayed=unavailable ? '-' : formatDpsCompareValue(dpsTablePreviewValue(diff,pen,round,{battleMode:coop?'coop':'solo',teamCount}));
      const current=diff===currentDiff && pen===currentPenance;
      const classes=[current?'is-current':'',diff===currentDiff?'is-reference-column':'',unavailable?'is-unavailable':''].filter(Boolean).join(' ');
      return `<td${classes?` class="${classes}"`:''}${current?' aria-current="true"':''} aria-label="${escapeHtml(diff)} · ${pen}고행 · ${escapeHtml(displayed)}">${displayed}</td>`;
    }).join('');
    return `<tr${pen===currentPenance?' class="is-reference-row"':''}><th scope="row"${pen===currentPenance?' class="is-current"':''}>${pen}고행</th>${values}</tr>`;
  }).join('');
  return `<div class="dps-compare-reading-guide"><span><b>${round} 라운드</b> · 난이도 → / 고행 ↓</span><span class="dps-compare-reading-key">강조된 행·열: ${escapeHtml(currentDiff)} · ${currentPenance}고행</span></div><div class="dps-compare-scroll"><table class="dps-compare-matrix${coop?' is-coop':' is-solo'}" aria-label="${coop?'협동전':'개인전'} 고행별 전체 난이도 DPS"><thead><tr><th scope="col">고행</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function dpsCompareFloorsHtml(){
  const teamCount=selectedDpsTableTeamCount();
  const tables=[
    {title:'도전의 탑',diff:'도전의 탑',config:DPS_CONFIG.dpsTable.tower,current:normalizedTowerFloorNumber(challengeTowerFloorStoredValue())},
    {title:planetExplorationDisplayName(currentPlanetExplorationDifficulty()),diff:currentPlanetExplorationDifficulty(),config:DPS_CONFIG.dpsTable.planet,current:normalizedPlanetExplorationFloorNumber(planetExplorationFloorStoredValue())}
  ].filter(item=>!isArtifactDpsViewEnabled() || !artifactDpsUnavailableDifficulty(item.diff)).map(item=>{
    const min=Math.max(1,Math.round(item.config.minFloor||1));
    const max=Math.max(min,Math.round(item.config.maxFloor||1));
    const mid=Math.floor((min+max)/2);
    const halves=[{start:min,end:mid},{start:mid+1,end:max}].map(range=>{
      const rows=[];
      for(let floor=range.start;floor<=range.end;floor++){
        const dps=dpsTablePreviewValue(item.diff,0,floor,{battleMode:'solo',teamCount});
        const current=floor===item.current;
        rows.push(`<tr${current?' class="is-current" aria-current="true"':''}><th scope="row">${floor}층</th><td>${formatDpsCompareValue(dps)}</td></tr>`);
      }
      return `<div class="dps-compare-floor-half"><table class="dps-compare-floor-table" aria-label="${item.title} ${range.start}~${range.end}층 DPS"><thead><tr><th class="dps-compare-floor-range" colspan="2" scope="colgroup">${range.start}~${range.end}층</th></tr><tr><th scope="col">층</th><th scope="col">DPS</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
    });
    return `<section class="dps-compare-floor" aria-label="${item.title} 전체 층 DPS"><h3>${item.title}</h3><div class="dps-compare-floor-halves">${halves.join('')}</div></section>`;
  });
  return `<div class="dps-compare-reading-guide"><span><b>층별 DPS 비교</b> · 왼쪽부터 낮은 층 → 높은 층</span><span class="dps-compare-reading-key">테두리 강조: 현재 설정한 층</span></div><div class="dps-compare-scroll"><div class="dps-compare-floor-grid">${tables.join('')}</div></div>`;
}
function renderDpsCompareContent(){
  const content=$('dpsCompareContent');
  if(!content) return;
  qsa('[data-dps-compare-tab]').forEach(tab=>{
    const active=tab.dataset.dpsCompareTab===activeDpsCompareMode;
    tab.classList.toggle('is-active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
  });
  content.setAttribute('aria-labelledby',`dpsCompareTab-${activeDpsCompareMode}`);
  content.innerHTML=activeDpsCompareMode==='floor'?dpsCompareFloorsHtml():dpsCompareMatrixHtml(activeDpsCompareMode==='coop');
}
function switchDpsCompareMode(mode){
  if(!['solo','coop','floor'].includes(mode) || mode===activeDpsCompareMode) return;
  activeDpsCompareMode=mode;
  renderDpsCompareContent();
}
let dpsCompareReturnFocus=null;
function openDpsCompareModal(trigger){
  const overlay=$('dpsCompareModalOverlay');
  if(!overlay || !overlay.hidden) return;
  dpsCompareReturnFocus=trigger||document.activeElement;
  activeDpsCompareMode=isTowerDifficulty() || isPlanetExplorationDifficulty() ? 'floor' : (isCoopActive() ? 'coop' : 'solo');
  overlay.hidden=false;
  document.body.classList.add('dps-compare-modal-open');
  renderDpsCompareContent();
  $('dpsCompareModal')?.focus({preventScroll:true});
}
function closeDpsCompareModal(){
  const overlay=$('dpsCompareModalOverlay');
  if(!overlay || overlay.hidden) return;
  overlay.hidden=true;
  document.body.classList.remove('dps-compare-modal-open');
  const focus=dpsCompareReturnFocus;
  dpsCompareReturnFocus=null;
  if(focus?.isConnected) focus.focus({preventScroll:true});
}
function bindDpsCompareEvents(){
  const overlay=$('dpsCompareModalOverlay');
  const open=$('dpsCompareOpen');
  if(!overlay || !open) return;
  open.addEventListener('click',()=>openDpsCompareModal(open));
  overlay.addEventListener('click',event=>{
    const tab=event.target.closest('[data-dps-compare-tab]');
    if(tab){ switchDpsCompareMode(tab.dataset.dpsCompareTab); return; }
    if(event.target===overlay || event.target.closest('[data-dps-compare-close]')) closeDpsCompareModal();
  });
  overlay.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-dps-compare-tab]');
    if(tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      const tabs=[...overlay.querySelectorAll('[data-dps-compare-tab]')];
      const i=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      event.preventDefault();
      switchDpsCompareMode(tabs[next].dataset.dpsCompareTab);
      tabs[next].focus({preventScroll:true});
      return;
    }
    if(event.key==='Escape'){event.preventDefault();closeDpsCompareModal();return;}
    if(event.key!=='Tab') return;
    const dialog=$('dpsCompareModal');
    const focusable=[...dialog.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length);
    if(!focusable.length){dialog.focus();event.preventDefault();return;}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey && (document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  });
}
/* ── 06 · 저장 필드 레지스트리 ── */
const FIELD_REGISTRY={
  sp:{kind:'기본 정보',name:'시작 SP',save:true},
  xp:{kind:'기본 정보',name:'보유 XP',save:true},
  bxp:{kind:'기본 정보',name:'보유 BXP',save:true},
  rp:{kind:'기본 정보',name:'보유 RP',save:true},
  soul:{kind:'기본 정보',name:'본인 심연의혼',save:true},
  coralShard:{kind:'목표설정',name:'코랄의 파편',save:true},
  aiurShard:{kind:'목표설정',name:'아이어의 파편',save:true},
  xerusShard:{kind:'목표설정',name:'제루스의 파편',save:true},
  diff:{kind:'목표설정',name:'난이도',save:true},
  round:{kind:'목표설정',name:'목표 라운드',save:true},
  challengeTowerFloor:{kind:'목표설정',name:'도전의 탑 층',save:true},
  planetExplorationFloor:{kind:'목표설정',name:'행성탐사 층',save:true},
  soloMode:{kind:'목표설정',name:'개인전',save:true},
  coopMode:{kind:'목표설정',name:'협동전',save:true},
  coopPassenger2Dr:{kind:'목표설정',name:'협동전 2P 방어력 감소',save:true},
  coopPassenger3Dr:{kind:'목표설정',name:'협동전 3P 방어력 감소',save:true},
  team:{kind:'목표설정',name:'출발 지원 인원수',save:true},
  pbless:{kind:'목표설정',name:'파워 블레스',save:true},
  spBankApply:{kind:'기본 정보',name:'SP 은행',save:true},
  penance:{kind:'목표설정',name:'고행 단계',save:true},
  titleTdBonus:{kind:'목표설정',name:'타이틀 총 데미지',save:true},
  specDpsSpeedMode:{kind:'스펙 보드',name:'스피드 모드',save:true},
  dpsBaseUnits:{kind:'유닛 보드',name:'유닛 구성',save:true},
  dpsBaseUnitSlots:{kind:'유닛 보드',name:'유닛 선택 위치',save:true},
  dpsBaseUnitVisibleSlotCount:{kind:'유닛 보드',name:'표시 슬롯 수',save:true},
  dpsJewelSettings:{kind:'쥬얼 설정',name:'전설·신화 쥬얼',save:true},
  dpsBaseUnitExtraSettings:{kind:'유닛 보드',name:'추가 유닛 쥬얼 & 한계 돌파',save:true},
  dpsBaseUnitSlotExpansions:{kind:'유닛 보드',name:'슬롯 확장',save:true},
  dpsBaseUnitSpeedMode:{kind:'유닛 보드',name:'스피드 모드',save:true},
  dpsSanctuaryInfo:{kind:'유닛 보드',name:'성소 정보',save:true},
  erosionStack:{kind:'목표설정',name:'어비스 침식 스택',save:true},
  jewelErosionRes:{kind:'목표설정',name:'어비스 심연 내성',save:true},
  aprRuneNormal:{kind:'룬효과 버프',name:'4월 일반',save:true},
  aprRunePlus:{kind:'룬효과 버프',name:'4월 강화(+)',save:true},
  sepRuneNormal:{kind:'룬효과 버프',name:'9월 일반',save:true},
  sepRunePlus:{kind:'룬효과 버프',name:'9월 강화(+)',save:true},
  overEnhance:{kind:'룬효과 버프',name:'오버핸스',save:true},
  repairEnhance:{kind:'룬효과 버프',name:'리페핸스',save:true},
  enhanceMaster:{kind:'룬효과 버프',name:'강화의 달인',save:true},
  prodArtifact:{kind:'룬효과 버프',name:'유물',save:true},
  prodNova:{kind:'룬효과 버프',name:'비밀 작전 노바',save:true},
  prodTeratron:{kind:'룬효과 버프',name:'테라트론',save:true},
  prodAmon:{kind:'룬효과 버프',name:'아몬',save:true},
  prodAdun:{kind:'룬효과 버프',name:'아둔의 창',save:true},
  prodKerrigan:{kind:'룬효과 버프',name:'불새 케리건',save:true},
  prodOvermind:{kind:'룬효과 버프',name:'초월체',save:true},
  prodNarud:{kind:'룬효과 버프',name:'나루드',save:true},
  flowerSkill1:{kind:'룬효과 버프',name:'근성의 꽃가루',save:true},
  flowerSkill2:{kind:'룬효과 버프',name:'바람의 꽃가루',save:true},
  flowerSkill3:{kind:'룬효과 버프',name:'안개의 꽃가루',save:true},
  specBoardPierce:{kind:'룬효과 버프',name:'방어력 관통',save:true},
  donationBuffType:{kind:'룬효과 버프',name:'나눔 유저 적용',save:false},
  rAD:{kind:'룬정보',name:'공격력',save:true},
  rModAD:{kind:'룬정보',name:'공격력 개조',save:true},
  runeChoiceType:{kind:'룬정보',name:'룬 특수 옵션',save:true},
  runeChoiceValue:{kind:'룬정보',name:'룬 특수 옵션',save:true},
  rAS:{kind:'룬정보',name:'공격속도',save:true},
  rModAS:{kind:'룬정보',name:'공격속도 개조',save:true},
  rCD:{kind:'룬정보',name:'크리 데미지',save:true},
  rModCD:{kind:'룬정보',name:'크리 데미지 개조',save:true},
  rCRI:{kind:'룬정보',name:'크리 확률',save:true},
  rModCRI:{kind:'룬정보',name:'크리 확률 개조',save:true},
  rReinf:{kind:'룬정보',name:'룬 강화 수',save:true},
  rAsc:{kind:'룬정보',name:'룬 각성',save:true},
  raceOpt:{kind:'룬정보',name:'종족 업그레이드',save:true},
  opt10:{kind:'룬정보',name:'10강 옵션',save:true},
  opt15:{kind:'룬정보',name:'15강 옵션',save:true},
  transOpt:{kind:'룬정보',name:'초월 옵션',save:true},
  addAD:{kind:'에디셔널',name:'공격력',save:true},
  addAS:{kind:'에디셔널',name:'공격속도',save:true},
  addCD:{kind:'에디셔널',name:'크리 데미지',save:true},
  addCRI:{kind:'에디셔널',name:'크리 확률',save:true},
  addAP:{kind:'에디셔널',name:'마법공격력',save:true},
  addTD:{kind:'에디셔널',name:'총 데미지',save:true},
  addUA:{kind:'에디셔널',name:'유닛 가속',save:true},
  enchAD:{kind:'인첸트 레벨 / 결과',name:'공격력',save:true},
  enchCRI:{kind:'인첸트 레벨 / 결과',name:'크리 확률',save:true},
  enchUA:{kind:'인첸트 레벨 / 결과',name:'유닛 가속',save:true},
  enchTD:{kind:'인첸트 레벨 / 결과',name:'총 데미지',save:true},
  enchSR:{kind:'인첸트 레벨 / 결과',name:'실드 감소',save:true},
  enchHR:{kind:'인첸트 레벨 / 결과',name:'체력 감소',save:true},
  enchantCode:{kind:'인첸트 레벨 / 결과',name:'인첸트 코드',save:true},
  optTier:{kind:'특성 보드',name:'특성 최적화',save:true},
  utilOptTier:{kind:'특성 보드',name:'유틸 마스터',save:true},
  traitLimitAD:{kind:'특성 투자 제한',name:'공격력',save:true},
  traitLimitAS:{kind:'특성 투자 제한',name:'공격속도',save:true},
  traitLimitCRI:{kind:'특성 투자 제한',name:'크리 확률',save:true},
  traitLimitCD:{kind:'특성 투자 제한',name:'크리 데미지',save:true},
  traitLimitMultiTarget:{kind:'특성 투자 제한',name:'멀티 타겟',save:true},
  traitLimitInfinite:{kind:'특성 투자 제한',name:'무한특성',save:true},
  skillDouble:{kind:'성소 보드',name:'더블스페',save:true},
  skillMode:{kind:'성소 보드',name:'모드',save:true},
  skillRound:{kind:'성소 보드',name:'라운드',save:true},
  unitGrade:{kind:'룬효과 버프',name:'유닛 등급'},
  unitLevel:{kind:'룬효과 버프',name:'유닛 레벨'},
};

/* ── 07 · 유닛 보드 상태·표시: unit.js로 이동 ── */
/* ── 08 · 유닛 상세·쥬얼·성소: unit.js로 이동 ── */
/* ── 09 · 통합 헤더·화면 전환 ── */
/* 탭 공통: Home/End/좌우 화살표의 순환 이동 인덱스 */
function nextHorizontalTabIndex(key,current,length){
  return key==='Home'?0:key==='End'?length-1:(current+(key==='ArrowRight'?1:-1)+length)%length;
}
/* 통합 헤더 하위 탭: 원래 DOM을 유지하여 계산·저장 필드 재생성을 방지 */
function activateIntegratedTab(group,index){
  const tabs=[...qsa(`[data-integrated-tab="${group}"]`)];
  const panels=qsa(`[data-integrated-panel="${group}"]`);
  if(!tabs.some(button=>button.dataset.integratedIndex===String(index))) return;
  tabs.forEach(button=>{
    const active=button.dataset.integratedIndex===String(index);
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
  });
  panels.forEach(panel=>{
    const active=panel.dataset.integratedIndex===String(index);
    panel.classList.toggle('is-active',active);
    panel.hidden=!active;
  });
}
function bindIntegratedTabEvents(){
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-integrated-tab]');
    if(!button) return;
    activateIntegratedTab(button.dataset.integratedTab,Number(button.dataset.integratedIndex));
  });
  document.addEventListener('keydown',event=>{
    const button=event.target.closest?.('[data-integrated-tab]');
    if(!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const group=button.dataset.integratedTab;
    const tabs=[...qsa(`[data-integrated-tab="${group}"]`)];
    const current=tabs.indexOf(button);
    const next=nextHorizontalTabIndex(event.key,current,tabs.length);
    event.preventDefault();
    activateIntegratedTab(group,Number(tabs[next].dataset.integratedIndex));
    tabs[next].focus({preventScroll:true});
  });
  // Each jewel disclosure retains its controls and data when folded.
  document.addEventListener('click',event=>{
    const toggle=event.target.closest?.('[data-dps-jewel-toggle]');
    if(!toggle) return;
    const card=toggle.closest('[data-dps-jewel-card]');
    const wasOpen=card?.classList.contains('is-expanded');
    qsa('#dpsJewelConfigGrid [data-dps-jewel-card]').forEach(item=>{
      item.classList.remove('is-expanded');
      item.querySelector('[data-dps-jewel-toggle]')?.setAttribute('aria-expanded','false');
      const content=item.querySelector('.dps-jewel-card-detail');
      if(content) content.hidden=true;
    });
    if(card && !wasOpen){
      card.classList.add('is-expanded');
      toggle.setAttribute('aria-expanded','true');
      const content=card.querySelector('.dps-jewel-card-detail');
      if(content) content.hidden=false;
    }
  });
}

/* 스펙·유닛 보드 전환 및 상태 이벤트 */
let activeDamageBoardMode='spec';
function setDamageBoardTab(active){
  const next=['spec','unit','jewel'].includes(active) ? active : activeDamageBoardMode;
  activeDamageBoardMode=next;
  qsa('[data-damage-board-subtab]').forEach(tab=>{
    const isActive=tab.dataset.damageBoardSubtab===next;
    const isDisabled=tab.dataset.damageBoardSubtab==='jewel' && next==='spec';
    tab.disabled=isDisabled;
    tab.setAttribute('aria-disabled',String(isDisabled));
    tab.classList.toggle('is-active',isActive);
    tab.setAttribute('aria-selected',String(isActive));
    tab.tabIndex=isActive?0:-1;
  });
  const panelMode=next==='jewel'?'unit':next;
  qsa('[data-damage-board-panel]').forEach(panel=>{
    const isActive=panel.dataset.damageBoardPanel===panelMode;
    panel.classList.toggle('is-active',isActive);
    panel.hidden=!isActive;
  });
  qsa('[data-damage-board-unit-panel]').forEach(panel=>{
    const isActive=panel.dataset.damageBoardUnitPanel===(next==='jewel'?'jewel':'unit');
    panel.classList.toggle('is-active',isActive);
    panel.hidden=!isActive;
  });
  if(next==='jewel') renderDpsJewelConfigGrids();
}
/* 고정 글로벌 헤더의 실제 높이를 본문과 모바일 탭의 상단 여백에 반영한다. */
function initAppHeaderLayout(){
  const header=qs('.hdr.app-header');
  if(!header || window.DPS_STANDALONE_VIEW) return;
  function syncHeaderHeight(){
    const height=Math.ceil(header.getBoundingClientRect().height);
    if(height>0) document.documentElement.style.setProperty('--app-header-h',height+'px');
  }
  syncHeaderHeight();
  if(typeof ResizeObserver!=='undefined') new ResizeObserver(syncHeaderHeight).observe(header);
  window.addEventListener('resize',syncHeaderHeight,{passive:true});
}
/* 글로벌 헤더: 원본과 별도로 실행되는 독립 창 세 가지 보기. */
function setIndependentWindowMenuOpen(open,restoreFocus=false){
  const menu=$('independentWindowMenu');
  const button=$('independentWindowToggle');
  if(!menu || !button) return;
  const next=!!open && !window.DPS_STANDALONE_VIEW;
  menu.hidden=!next;
  button.setAttribute('aria-expanded',String(next));
  button.setAttribute('aria-label',next?'독립 창 메뉴 닫기':'독립 창 보기 선택');
  if(next){
    const rect=button.getBoundingClientRect();
    const width=menu.offsetWidth;
    const height=menu.offsetHeight;
    menu.style.left=Math.max(8,Math.min(rect.right-width,window.innerWidth-width-8))+'px';
    menu.style.top=Math.max(8,rect.bottom+5+height<=window.innerHeight ? rect.bottom+5 : rect.top-height-5)+'px';
    menu.querySelector('button')?.focus({preventScroll:true});
  }else if(restoreFocus) button.focus();
}
function openIndependentAnalysisWindow(view='board'){
  if(window.DPS_STANDALONE_VIEW || !['board','utility','both'].includes(view)) return;
  saveState({silent:true});
  // 페이지 자체를 새 창에서 실행해 원본 탭 종료에 종속되지 않도록 한다.
  const url=new URL(window.location.href);
  url.searchParams.set('dpsWindow',view);
  url.searchParams.delete('fresh');
  url.searchParams.delete('__dps_check');
  const sizes=view==='utility' ? {width:480,height:690} : view==='both' ? {width:820,height:740} : {width:620,height:690};
  const features=`popup=yes,width=${sizes.width},height=${sizes.height},resizable=yes,scrollbars=yes`;
  const win=window.open(url.href,'_blank',features);
  if(!win){showToast('독립 창이 차단되었습니다. 팝업 허용 설정을 확인해 주세요.','warn');return;}
  try{win.opener=null;win.focus();}catch{}
}
function bindIndependentWindowButton(){
  if(window.DPS_STANDALONE_VIEW) return;
  $('independentWindowToggle')?.addEventListener('click',()=>setIndependentWindowMenuOpen($('independentWindowMenu')?.hidden));
  $('independentWindowMenu')?.addEventListener('click',event=>{
    const action=event.target.closest('[data-independent-view]');
    if(!action) return;
    setIndependentWindowMenuOpen(false);
    openIndependentAnalysisWindow(action.dataset.independentView);
  });
  document.addEventListener('click',event=>{
    if($('independentWindowMenu')?.hidden!==false) return;
    if(event.target.closest('#independentWindowMenu,#independentWindowToggle')) return;
    setIndependentWindowMenuOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape' || $('independentWindowMenu')?.hidden!==false) return;
    event.preventDefault();
    setIndependentWindowMenuOpen(false,true);
  });
  window.addEventListener('resize',()=>setIndependentWindowMenuOpen(false));
}
function bindDamageBoardTabEvents(){
  document.addEventListener('click',event=>{
    const tab=event.target?.closest?.('[data-damage-board-subtab]');
    if(!tab || tab.disabled || tab.dataset.damageBoardSubtab==='dps') return;
    event.preventDefault();
    setDamageBoardTab(tab.dataset.damageBoardSubtab);
  },true);
  document.addEventListener('keydown',event=>{
    const tab=event.target?.closest?.('[data-damage-board-subtab]');
    if(!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs=[...tab.parentElement.querySelectorAll('[data-damage-board-subtab]')].filter(button=>!button.disabled);
    const current=tabs.indexOf(tab);
    if(current<0 || !tabs.length) return;
    const next=nextHorizontalTabIndex(event.key,current,tabs.length);
    event.preventDefault();
    if(tabs[next].dataset.damageBoardSubtab==='dps') openDpsCompareModal(tabs[next]);
    else {
      setDamageBoardTab(tabs[next].dataset.damageBoardSubtab);
      tabs[next].focus({preventScroll:true});
    }
  });
}
function bindDamageBoardSwitchEvents(){
  const guide=$('battleModeGuideDialog');
  const guideOpen=$('battleModeGuideOpen');
  if(guide && guideOpen){
    const tabs=[...guide.querySelectorAll('[data-battle-guide-tab]')];
    const panels=[...guide.querySelectorAll('[data-battle-guide-panel]')];
    const selectGuideTab=(name,focus=false)=>{
      const selected=tabs.find(tab=>tab.dataset.battleGuideTab===name);
      if(!selected) return;
      tabs.forEach(tab=>{
        const active=tab===selected;
        tab.setAttribute('aria-selected',String(active));
        tab.tabIndex=active ? 0 : -1;
      });
      panels.forEach(panel=>{
        panel.hidden=panel.dataset.battleGuidePanel!==name;
        if(!panel.hidden) panel.scrollTop=0;
      });
      if(focus) selected.focus({preventScroll:true});
    };
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>selectGuideTab(tab.dataset.battleGuideTab));
      tab.addEventListener('keydown',event=>{
        let next=index;
        if(event.key==='ArrowRight') next=(index+1)%tabs.length;
        else if(event.key==='ArrowLeft') next=(index+tabs.length-1)%tabs.length;
        else if(event.key==='Home') next=0;
        else if(event.key==='End') next=tabs.length-1;
        else return;
        event.preventDefault();
        selectGuideTab(tabs[next].dataset.battleGuideTab,true);
      });
    });
    guideOpen.addEventListener('click',()=>{
      const selected=tabs.find(tab=>tab.getAttribute('aria-selected')==='true');
      selectGuideTab(selected?.dataset.battleGuideTab || 'compare');
      if(!guide.open) guide.showModal();
    });
    guide.querySelector('[data-battle-mode-guide-close]')?.addEventListener('click',()=>guide.close());
    guide.addEventListener('close',()=>guideOpen.focus({preventScroll:true}));
    guide.addEventListener('click',event=>{
      if(event.target!==guide) return;
      const bounds=guide.getBoundingClientRect();
      if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) guide.close();
    });
  }
  document.addEventListener('click', e=>{
    const speedToggle=e.target?.closest?.('[data-spec-dps-speed-toggle]');
    if(speedToggle){
      e.preventDefault();
      toggleSpecDpsSpeedMode();
      return;
    }
    const artifactToggle=e.target?.closest?.('#artifactDpsViewToggle');
    if(!artifactToggle) return;
    e.preventDefault();
    if(artifactToggle.disabled || artifactDpsUnavailableDifficulty()) return;
    setArtifactDpsViewEnabled(!isArtifactDpsViewEnabled());
    requestAppUpdate();
  }, true);
}
/* ── 10 · 특성 보드·투자·최적화 ── */
const OPTIMIZATION_TIERS=TIERS;
// 게임 모드에 따른 특성 입력 제한을 두지 않는다. 기존 효과 계산 조건은 그대로 유지한다.
/* 10-A · 특성 표시·투자 가능 상태 */
// 펼침 여부는 화면 상태로만 관리하며 프리셋 데이터에는 저장하지 않는다.
const expandedTraitTiers=new Set();
// 입력 요소를 DOM에 그대로 둔 채 높이만 애니메이션으로 전환한다.
function setAccordionContentExpanded(content,expanded){
  if(!content) return;
  const oldAnimation=content.getAnimations?.().find(animation=>animation.id==='dpsAccordion');
  oldAnimation?.cancel();
  const wasOpen=!content.hidden;
  const fromHeight=wasOpen ? content.getBoundingClientRect().height : 0;
  if(expanded) content.hidden=false;
  content.inert=!expanded;
  content.setAttribute('aria-hidden',String(!expanded));
  if(fromHeight===0 && !expanded){content.hidden=true;return;}
  const toHeight=expanded ? content.scrollHeight : 0;
  if(Math.abs(fromHeight-toHeight)<1 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !content.animate){
    content.hidden=!expanded;
    return;
  }
  const animation=content.animate([{height:`${fromHeight}px`,opacity:expanded?0:1},{height:`${toHeight}px`,opacity:expanded?1:0}],{duration:250,easing:'cubic-bezier(.22,1,.36,1)'});
  animation.id='dpsAccordion';
  animation.onfinish=()=>{if(!expanded) content.hidden=true;};
}
function setTraitTierExpanded(tier,expanded,exclusive=true){
  if(!TIERS.includes(tier)) return;
  if(expanded && exclusive) [...expandedTraitTiers].filter(open=>open!==tier).forEach(open=>setTraitTierExpanded(open,false));
  if(expanded) expandedTraitTiers.add(tier);
  else expandedTraitTiers.delete(tier);
  const panel=Array.from(qsa('.trait-tier-panel[data-tier]')).find(el=>el.dataset.tier===tier);
  if(!panel) return;
  const toggle=panel.querySelector('.trait-tier-toggle');
  const list=panel.querySelector('.trait-invest-list');
  panel.classList.toggle('is-expanded',expanded);
  if(toggle) toggle.setAttribute('aria-expanded',String(expanded));
  setAccordionContentExpanded(list,expanded);
}
function updateTraits(){
  const body=$('traitBody');
  if(!body) return;
  body.innerHTML=TIERS.map((tier,tierIndex)=>{
    const tierTraits=TRAITS.filter(t=>t[2]===tier && t[0]!==116);
    const eligibleTierTraits=tierTraits;
    const tierInvested=eligibleTierTraits.reduce((sum,t)=>sum+(INV[t[0]]||0),0);
    const tierMaximum=eligibleTierTraits.reduce((sum,t)=>sum+(TMAX[t[0]]||999),0);
    const tierMastered=eligibleTierTraits.length>0 && eligibleTierTraits.every(t=>(INV[t[0]]||0)>=(TMAX[t[0]]||999));
    const tierSummary=tierInvested>0
      ? `<span class="collapsed-summary trait-tier-summary${tierMastered?' is-mastered':''}">${tierMastered?'✓ 전체 마스터':`${fullNumber(tierInvested)} / ${fullNumber(tierMaximum)}`}</span>`
      : '';
    const rows=tierTraits.map((t,index)=>{
      const [row,name,,type,rate]=t;
      const n=INV[row]||0, mx=TMAX[row]||999;
      const isMax=n>=mx;
      const cost=nextCost(row);
      // 어비스 난이도의 특성별 계수는 기존 DPS 계산과 동일하게 표시한다.
      const currentRate=isAbyssDifficulty() ? ({133:15,134:7.5,135:1.5,136:3}[row] ?? rate) : rate;
      const rStr=row===58?'강화수 +1':row===96?'2단 강화 +0.5':traitEffectText(row,type,currentRate);
      return `<article class="tr trait-invest-card${isMax?' is-mastered':''}" data-trait-id="${row}">
        <div class="trait-invest-main">
          <span class="trait-invest-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>
          <div class="trait-row-detail">
            <div class="trait-invest-topline"><div class="tr-name">${escapeHtml(name)}</div><div class="tr-type"><span class="trait-effect-text">${escapeHtml(rStr)}</span><span class="trait-cost-chip ${isMax?'is-complete':''}">${isMax?'✓ 마스터 완료':`다음 투자 · ${fullNumber(cost)}`}</span></div></div>
          </div>
        </div>
        <div class="tr-ctrl" aria-label="${escapeHtml(name)} 투자 조절">
          <button type="button" class="ui-step-btn" data-action="traitAdjust" data-row="${row}" data-delta="-1" ${n<=0?'disabled':''} aria-label="${escapeHtml(name)} 1 환불">−</button>
          <div class="trait-value-pair">
            <input class="tv-input" type="text" inputmode="numeric" value="${n}" data-row="${row}" aria-label="${escapeHtml(name)} 현재 투자">
            <span class="trait-max-sep">/</span><span class="trait-max-val">${mx}</span>
          </div>
          <button type="button" class="ui-step-btn" data-action="traitAdjust" data-row="${row}" data-delta="1" ${isMax?'disabled':''} aria-label="${escapeHtml(name)} 1 투자">+</button>
          <button type="button" class="ui-action-btn trait-master-btn" data-action="traitMax" data-row="${row}" ${isMax?'disabled':''}>마스터</button>
          ${mx>=50 ? `<div class="trait-quick-actions">
            ${[10,50].map(step=>`<button type="button" data-action="traitQuickAdjust" data-row="${row}" data-step="${step}" ${mx-n<step?'disabled':''} aria-label="${escapeHtml(name)} ${step}회 추가 투자">+${step}</button>`).join('')}
          </div>` : ''}
        </div>
      </article>`;
    }).join('');
    const isExpanded=expandedTraitTiers.has(tier);
    return `<section class="trait-group trait-tier-panel${isExpanded?' is-expanded':''}" data-tier-index="${tierIndex+1}" data-tier="${tier}">
      <h4><button type="button" class="trait-tier-toggle" data-action="toggleTraitTier" data-tier="${tier}" aria-expanded="${isExpanded}" aria-controls="traitTierContent${tierIndex+1}"><span class="trait-title"><span class="trait-tier-index" aria-hidden="true">${String(tierIndex+1).padStart(2,'0')}</span><span class="trait-tier-name">${tier}</span></span>${tierSummary}</button><span class="trait-tools"><button type="button" class="ui-action-btn mini-btn master" data-action="masterTier" data-tier="${tier}">구간 마스터</button><button type="button" class="ui-action-btn mini-btn reset danger" data-action="resetTier" data-tier="${tier}">초기화</button></span></h4>
      <div class="trait-invest-list" id="traitTierContent${tierIndex+1}" ${isExpanded?'':'hidden'}>${rows}</div>
    </section>`;
  }).join('');
}
/* 수동 특성 입력·반복 투자 이벤트 */
let traitKeyNavGuardUntil=0;
/* 10-B · 수동 투자·반복 입력 */
function commitTraitInput(el){
  const row=+(el && el.dataset ? el.dataset.row : NaN);
  if(!Number.isFinite(row) || el.disabled) return;
  setInv(row,+el.value);
}
function getTraitScrollHost(){
  return qs('.mobile-page-trait.active') || qs('.col-mid') || document.scrollingElement || document.documentElement;
}
function getNextTraitInputRow(el,dir){
  const inputs=Array.from(qsa('.tv-input[data-row]:not(:disabled)'));
  const idx=inputs.indexOf(el);
  const nextIndex=Math.max(0,Math.min(inputs.length-1,idx+dir));
  return +(inputs[nextIndex]?.dataset?.row ?? el?.dataset?.row);
}
function focusTraitInputRow(row,hostScroll,pageX,pageY){
  const host=getTraitScrollHost();
  const focusNow=()=>{
    const next=qs(`.tv-input[data-row="${row}"]`);
    if(!next) return false;
    const panel=next.closest('.trait-tier-panel[data-tier]');
    if(panel && !expandedTraitTiers.has(panel.dataset.tier)) setTraitTierExpanded(panel.dataset.tier,true);
    try{next.focus({preventScroll:true});}catch{next.focus();}
    if(typeof next.select==='function') next.select();
    if(host) host.scrollTop=hostScroll;
    window.scrollTo(pageX,pageY);
    return true;
  };
  setTimeout(()=>{ if(!focusNow()) requestAnimationFrame(focusNow); },0);
}
function bindTraitInputEvents(){
  document.addEventListener('change', e=>{
    if(Date.now()<traitKeyNavGuardUntil) return;
    const input=e.target.closest && e.target.closest('.tv-input[data-row]');
    if(input) commitTraitInput(input);
  }, true);
  document.addEventListener('keydown', e=>{
    const input=e.target.closest && e.target.closest('.tv-input[data-row]');
    if(!input || (e.key!=='Tab' && e.key!=='Enter')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const dir=e.shiftKey?-1:1;
    const nextRow=getNextTraitInputRow(input,dir);
    const host=getTraitScrollHost();
    const hostScroll=host ? host.scrollTop : 0;
    const pageX=window.scrollX, pageY=window.scrollY;
    traitKeyNavGuardUntil=Date.now()+250;
    commitTraitInput(input);
    focusTraitInputRow(nextRow,hostScroll,pageX,pageY);
  }, true);
  document.addEventListener('click', e=>{
    const target=e.target;
    if(!(target instanceof Element)) return;
    const input=target.closest('.tv-input[data-row]');
    if(input){input.select();return;}
    const card=target.closest('.trait-invest-card[data-trait-id]');
    if(!card || target.closest('button, a, select, textarea, input, [role="button"]')) return;
    const field=card.querySelector('.tv-input[data-row]');
    if(!field || field.disabled || field.readOnly) return;
    field.focus({preventScroll:true});
    field.select();
  }, true);
}
function adjustTraitBy(row,d,step=1){
  row=+row;
  d=+d;
  step=Math.max(1,Math.round(+step||1));
  if(row===116 || !Number.isFinite(row) || !Number.isFinite(d) || d===0) return false;
  const before=INV[row]||0;
  let applied=0;
  if(d>0){
    applied=setRowToAffordableValue(row,before+step)-before;
    if(applied===0) showToast('보유 재화가 부족합니다','warn');
  }else{
    const next=Math.max(0,before-step);
    applied=before-next;
    INV[row]=next;
  }
  if(applied>0){
    commitAppUpdate({recalculate:'now'});
    return true;
  }
  return false;
}
let traitHoldTimer=null;
let traitHoldRepeatTimer=null;
let traitHoldSuppressClickUntil=0;
function stopTraitAdjustHold(){
  if(traitHoldTimer) clearTimeout(traitHoldTimer);
  if(traitHoldRepeatTimer) clearTimeout(traitHoldRepeatTimer);
  traitHoldTimer=null;
  traitHoldRepeatTimer=null;
  traitHoldSuppressClickUntil=Date.now()+260;
}
function startTraitAdjustHold(trigger,e){
  if(!trigger || trigger.disabled) return;
  const row=+trigger.dataset.row;
  const delta=+trigger.dataset.delta;
  if(!Number.isFinite(row) || !Number.isFinite(delta) || delta===0) return;
  if(e){ e.preventDefault(); e.stopPropagation(); }
  stopTraitAdjustHold();
  let count=0;
  const every=Math.max(1,DPS_CONFIG.ui.traitHoldAccelEvery||7);
  const maxStep=Math.max(1,DPS_CONFIG.ui.traitHoldMaxStep||50);
  const apply=()=>{
    const step=Math.min(maxStep, 1+Math.floor(count/every));
    count++;
    adjustTraitBy(row,delta,step);
  };
  apply();
  traitHoldTimer=setTimeout(function repeat(){
    apply();
    traitHoldRepeatTimer=setTimeout(repeat, DPS_CONFIG.ui.traitHoldRepeatMs||55);
  }, DPS_CONFIG.ui.traitHoldInitialDelay||320);
}
function commitTraitInvestmentChange(){
  commitAppUpdate({recalculate:'now'});
}
function bindTraitHoldEvents(){
  document.addEventListener('pointerdown', e=>{
    const btn=e.target.closest('[data-action="traitAdjust"]');
    if(!btn) return;
    startTraitAdjustHold(btn,e);
  }, true);
  ['pointerup','pointercancel','pointerleave','blur'].forEach(type=>{
    window.addEventListener(type, stopTraitAdjustHold, true);
  });
}
function setInv(row,val){
  if(row===116) return;
  if(isNaN(val)||val<0) val=0;
  const wanted=Math.round(val);
  const applied=setRowToAffordableValue(row,wanted);
  if(applied<wanted) showToast('보유 재화 한도까지만 입력되었습니다','warn');
  commitTraitInvestmentChange();
}
function adjMax(row){
  try{
    if(row===116) return false;
    const before=INV[row]||0;
    fillRowToBudget(row);
    commitTraitInvestmentChange();
    if((INV[row]||0)<=before) showToast('보유 재화가 부족합니다','warn');
    return (INV[row]||0)>before;
  }catch(e){
    rememberAppIssue('error','[adjMax failed]', e);
    return false;
  }
}
function forEachTraitInTier(tier, callback){
  TRAITS.forEach(t=>{
    const row=t[0];
    if(t[2]!==tier || row===116) return;
    callback(t,row);
  });
}
function masterTier(tier){
  forEachTraitInTier(tier,(_,row)=>fillRowToBudget(row));
  commitTraitInvestmentChange();
}
function resetTier(tier){
  forEachTraitInTier(tier,(_,row)=>{ INV[row]=0; });
  commitTraitInvestmentChange();
}
/* 특성 초기화·유틸 최적화 */
const UTILITY_OPT_TYPES=new Set(['유틸','경험치','AP','RA']);
const UTILITY_OPT_TIERS=OPTIMIZATION_TIERS;
/* 10-C · 재화별 투자 초기화·최적화 */
function isUtilityOptimizationTrait(t, maxTierIndex=null){
  if(!Array.isArray(t)) return false;
  const row=t[0], tier=t[2], type=t[3];
  if(row===116 || row===112) return false;
  const tierIdx=UTILITY_OPT_TIERS.indexOf(tier);
  if(tierIdx<0) return false;
  if(maxTierIndex!==null && tierIdx>maxTierIndex) return false;
  return UTILITY_OPT_TYPES.has(type);
}
function utilityRowsOrNotify(){
  const idx=UTILITY_OPT_TIERS.indexOf(vs('utilOptTier')||'루키');
  const maxTierIndex=idx>=0 ? idx : UTILITY_OPT_TIERS.indexOf('더원2');
  const rows=TRAITS.filter(t=>isUtilityOptimizationTrait(t, maxTierIndex)).map(t=>t[0]);
  if(rows.length) return rows;
  showToast('선택 범위에 유틸 특성이 없습니다','warn');
  return null;
}
function optimizeUtility(){
  const rows=utilityRowsOrNotify();
  if(!rows) return false;
  let changed=0;
  rows.forEach(row=>{
    const before=INV[row]||0;
    fillRowToBudget(row);
    if((INV[row]||0)!==before) changed++;
  });
  commitTraitInvestmentChange();
  if(!changed) showToast('보유 재화가 부족하거나 이미 최대입니다','warn');
  return changed>0;
}
function isUtilityClearTrait(t){
  if(!Array.isArray(t) || t[0]===116) return false;
  // 엑셀의 유틸 초기화 범위: SP의 AP/경험치/각성석과 전 재화의 편의·보조 특성.
  return t[3]==='유틸' || (SP_ROWS.has(t[0]) && isUtilitySpTrait(t));
}
function isAttackClearTrait(t){
  return Array.isArray(t) && t[0]!==116 && !isUtilityClearTrait(t);
}
function clearTraitInvestmentsBy(predicate){
  let changed=0;
  TRAITS.forEach(t=>{
    if(!predicate(t)) return;
    const row=+t[0];
    if((INV[row]||0)>0){
      INV[row]=0;
      changed++;
    }
  });
  commitTraitInvestmentChange();
  return changed;
}
function clearUtility(){
  const changed=clearTraitInvestmentsBy(isUtilityClearTrait);
  if(!changed) showToast('초기화할 유틸 특성이 없습니다','warn');
  return changed>0;
}
function clearAll(){
  try{
    const changed=clearTraitInvestmentsBy(isAttackClearTrait);
    if(!changed) showToast('초기화할 공격 특성이 없습니다','warn');
    return changed>0;
  }catch(e){
    rememberAppIssue('error','[clearAll failed]', e);
    alertApp('특성 초기화 실패: '+(e && e.message ? e.message : e));
    return false;
  }
}
/* ── 11 · 화면 설정·승단 ── */
/* 11-A · 글자 크기·화면 설정 */
function isFontScaleLockedViewport(){
  const w=window.innerWidth || document.documentElement.clientWidth || 0;
  const h=window.innerHeight || document.documentElement.clientHeight || 0;
  const max=DPS_CONFIG.ui.mobileMaxWidth || 600;
  const mobile=window.matchMedia ? window.matchMedia(`(max-width:${max}px)`).matches : window.innerWidth<=max;
  return mobile || (w>=768 && w<=1368 && h>w);
}
function getFontScale(){
  if(isFontScaleLockedViewport()) return DPS_CONFIG.ui.fontScaleDefault;
  const root=document.documentElement;
  const raw=root.style.getPropertyValue('--app-font-scale') || String(DPS_CONFIG.ui.fontScaleDefault);
  const n=parseFloat(raw);
  return Number.isFinite(n) ? n : DPS_CONFIG.ui.fontScaleDefault;
}
function applyFontScale(scale, options={}){
  const label=$('fontScaleLabel');
  if(isFontScaleLockedViewport()){
    document.documentElement.style.setProperty('--app-font-scale', DPS_CONFIG.ui.fontScaleDefault.toFixed(2));
    if(label) label.textContent='100%';
    return false;
  }
  const min=DPS_CONFIG.ui.fontScaleMin, max=DPS_CONFIG.ui.fontScaleMax;
  const next=Math.max(min, Math.min(max, Number(scale)||DPS_CONFIG.ui.fontScaleDefault));
  document.documentElement.style.setProperty('--app-font-scale', next.toFixed(2));
  if(label) label.textContent=Math.round(next*100)+'%';
  try{ localStorage.setItem(DPS_CONFIG.storage.fontKey, String(next)); }catch(error){ rememberAppIssue('warn','글씨 크기 저장', error); }
  if(!options.silent) notifyStorageAction('글씨 크기 '+Math.round(next*100)+'% 저장 완료', 'ok');
  return true;
}
function setFontScalePopoverOpen(open, restoreFocus=false){
  const popover=$('fontScalePopover');
  const trigger=document.querySelector('.font-scale-trigger');
  if(!popover || !trigger) return;
  const next=!!open && !isFontScaleLockedViewport();
  popover.hidden=!next;
  trigger.setAttribute('aria-expanded',String(next));
  trigger.setAttribute('aria-label',next?'글씨 크기 조절 닫기':'글씨 크기 조절 열기');
  if(next) popover.querySelector('[data-action="decreaseFont"]')?.focus();
  else if(restoreFocus) trigger.focus();
}
function toggleFontScalePopover(){
  setFontScalePopoverOpen($('fontScalePopover')?.hidden);
}
function bindFontScalePopover(){
  document.addEventListener('click',event=>{
    const popover=$('fontScalePopover');
    if(!popover || popover.hidden || event.target.closest('.font-scale-ctrl')) return;
    setFontScalePopoverOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape' || $('fontScalePopover')?.hidden!==false) return;
    event.preventDefault();
    setFontScalePopoverOpen(false,true);
  });
}
function loadFontScale(){
  let scale=DPS_CONFIG.ui.fontScaleDefault;
  try{
    const saved=parseFloat(localStorage.getItem(DPS_CONFIG.storage.fontKey)||'');
    if(Number.isFinite(saved)) scale=saved;
  }catch(error){
    rememberAppIssue('warn','글씨 크기 불러오기', error);
  }
  applyFontScale(scale, {silent:true});
}
function changeFontScale(delta){
  if(isFontScaleLockedViewport()) return false;
  return applyFontScale(getFontScale()+delta);
}
function bindFontScaleViewportGuard(){
  window.addEventListener('resize', ()=>{
    if(isFontScaleLockedViewport()) {
      applyFontScale(DPS_CONFIG.ui.fontScaleDefault, {silent:true});
      setFontScalePopoverOpen(false);
    }
  });
}
/* 11-B · 앱 제목·버전 표시 */
function renderAppTitleVersion(){
  const versionText=$('appTitleVersion');
  if(!versionText) return;
  const buildVersion=String(window.APP_VERSION || window.DPS_BUILD_VERSION || '');
  const shortVersion=buildVersion.match(/B-VAERON-(.+)$/i)?.[1] || '';
  versionText.textContent=shortVersion ? ` · ${shortVersion}` : '';
}
/* 더제로 승단 */

const ZERO_PENANCE_ROWS=[
  'Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final'
].map((name,index)=>({name,row:13+index}));
/* 11-C · 더제로 승단·계산 UI */
function zeroScoreInputHtml(className, options={}){
  const inputMode=options.inputmode || 'numeric';
  const placeholder=options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
  const maxLength=options.maxlength ? ` maxlength="${Number(options.maxlength)}"` : '';
  const label=options.label ? ` aria-label="${escapeHtml(options.label)}"` : '';
  const range=options.range ? ` min="${options.range[0]}" max="${options.range[1]}" step="1"` : '';
  return `<input class="${className}" inputmode="${inputMode}"${maxLength}${placeholder}${label}${range} autocomplete="off" type="${options.range ? 'number' : 'text'}" value="${options.range ? options.range[0] : '0'}"/>`;
}
const ZERO_PENANCE_SELECT_VALUES=Object.freeze([0,7,9,13,16,17,18,19,20]);
function zeroScorePenanceSelectHtml(className, label){
  return `<select class="${className}" aria-label="${escapeHtml(label)}">${ZERO_PENANCE_SELECT_VALUES.map(value=>`<option value="${value}">${value===0?'없음':value}</option>`).join('')}</select>`;
}
function zeroScoreHonorSelectHtml(className, label){
  const options=[['0','없음'],...ZERO_HONOR_STAGES.map(({key})=>[key,key.toUpperCase()])];
  return `<select class="${className}" aria-label="${escapeHtml(label)}">${options.map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select>`;
}
function zeroScoreStarButtonHtml(){
  return '<button class="ui-toggle-btn zero-star-toggle" data-action="zeroScoreStar" type="button" aria-pressed="false" aria-label="24스타 미적용">미적용</button>';
}
function buildZeroScoreCalcRow(config){
  const name=escapeHtml(config.name);
  const penance=config.type==='penance';
  const generalCurrent=penance ? zeroScorePenanceSelectHtml('zero-calc-current',`${config.name} 일반 현재`) : zeroScoreInputHtml('zero-calc-current',{label:`${config.name} 일반 현재`});
  const generalTarget=penance ? zeroScorePenanceSelectHtml('zero-calc-target',`${config.name} 일반 목표`) : zeroScoreInputHtml('zero-calc-target',{label:`${config.name} 일반 목표`});
  const honorCurrent=penance ? zeroScoreHonorSelectHtml(config.currentHonorClass,`${config.name} 명예 현재`) : zeroScoreInputHtml(config.currentHonorClass,{...config.honorOptions,label:`${config.name} 명예 현재`});
  const honorTarget=penance ? zeroScoreHonorSelectHtml(config.targetHonorClass,`${config.name} 명예 목표`) : zeroScoreInputHtml(config.targetHonorClass,{...config.honorOptions,label:`${config.name} 명예 목표`});
  const field=(label,control)=>`<label class="zero-calc-field"><span>${label}</span>${control}</label>`;
  const generalLabel=penance?'일반 고행':'도전의 탑';
  const honorLabel=penance?'명예':'명예의탑';
  const starControl=config.star===false
    ? '<span class="zero-calc-unavailable" aria-label="24스타 해당 없음">해당 없음</span>'
    : zeroScoreStarButtonHtml();
  return `<article class="zero-calc-row" data-row-type="${config.type}">
    <div class="zero-calc-row-bar">
      <button class="zero-calc-row-head" type="button" aria-expanded="false" aria-controls="zeroScoreDetails${config.number}" aria-describedby="zeroScoreSummary${config.number}" aria-label="${name} 승단 점수 입력 펼치기">
        <span class="zero-calc-name"><span class="zero-calc-row-symbol" aria-hidden="true">${String(config.number).padStart(2,'0')}</span><strong>${name}</strong></span>
        <span class="zero-calc-inline-labels" aria-hidden="true"><span>구분</span><span>현재</span><span>목표</span><span>목표 추가점수</span></span>
        <span class="zero-calc-head-summary" id="zeroScoreSummary${config.number}" hidden></span>
      </button>
    </div>
    <div class="zero-calc-details" id="zeroScoreDetails${config.number}" hidden>
      <div class="zero-calc-fields">
        <div class="zero-calc-input-row"><span class="zero-calc-kind">${generalLabel}</span>${field('현재',generalCurrent)}${field('목표',generalTarget)}</div>
        <div class="zero-calc-input-row"><span class="zero-calc-kind">${honorLabel}</span>${field('현재',honorCurrent)}${field('목표',honorTarget)}</div>
        <div class="zero-calc-input-footer">
        <div class="zero-calc-metric"><span>24스타</span>${starControl}</div>
        <div class="zero-calc-metric zero-calc-score"><span>목표 추가점수</span><b class="zero-row-score">+0</b></div>
        </div>
      </div>
    </div>
  </article>`;
}
function buildZeroPenanceCalcRow(name,number){
  return buildZeroScoreCalcRow({type:'penance',name,number,currentHonorClass:'zero-current-honor zero-honor-input',targetHonorClass:'zero-target-honor zero-honor-input',honorOptions:{inputmode:'latin',maxlength:2,placeholder:'B'}});
}
function buildZeroTowerCalcRow(){
  return buildZeroScoreCalcRow({type:'towerCombo',name:'도전의 탑',number:ZERO_PENANCE_ROWS.length+1,star:false,currentHonorClass:'zero-tower-honor-current',targetHonorClass:'zero-tower-honor-target'});
}
function renderZeroScoreCalculatorRows(){
  const rows=$('zeroScoreRows');
  if(!rows || rows.dataset.rendered==='1') return;
  rows.innerHTML=ZERO_PENANCE_ROWS.map(({name},index)=>buildZeroPenanceCalcRow(name,index+1)).join('') + buildZeroTowerCalcRow();
  rows.dataset.rendered='1';
}

function getZeroRankTable(){
  return ZERO_RANK_FALLBACK_TABLE;
}
function zeroRankEntry(score){
  const value=Number(score)||0;
  const table=getZeroRankTable();
  return table.reduce((best,item)=>value>=item.score ? item : best, table[0] || ZERO_RANK_FALLBACK_TABLE[0]);
}
function zeroRankName(score){
  return zeroRankEntry(score)?.name || '입문';
}
function updateZeroRankHighlights(currentRank, targetRank){
  const current=dataText(currentRank);
  const target=dataText(targetRank);
  const card=qs('.zero-rank-result-card');
  if(card){
    card.classList.toggle('zero-rank-same', !!current && current===target);
    card.classList.toggle('zero-rank-upgrade', !!current && !!target && current!==target);
    // 최종 승단에 현재·목표가 모두 도달한 경우 같은 이름을 두 번 표시하지 않습니다.
    card.classList.toggle('zero-rank-final', current===getZeroRankTable().at(-1)?.name && target===current);
  }
}
// 혜택 미리보기는 조회 상태만 별도로 보관합니다. 승단 점수와 프리셋은 변경하지 않습니다.
let zeroBenefitActualIndex=0;
let zeroBenefitViewIndex=null;
function renderZeroBenefitsPreview(){
  const table=getZeroRankTable();
  if(!table.length) return;
  const current=Math.max(0,Math.min(table.length-1,zeroBenefitActualIndex));
  const index=Math.max(0,Math.min(table.length-1,zeroBenefitViewIndex ?? current));
  const entry=table[index];
  const title=$('zeroCurrentBenefitsTitle');
  const items=$('zeroCurrentBenefitsItems');
  const label=$('zeroBenefitsViewLabel');
  const position=$('zeroBenefitsPosition');
  const prev=$('zeroBenefitsPrev');
  const next=$('zeroBenefitsNext');
  if(title) title.textContent=`더제로 ${entry.name} 혜택`;
  if(label) label.textContent=index===current?'현재 타이틀':'단계 미리보기';
  if(position) position.textContent=`${index+1} / ${table.length}`;
  if(prev) prev.disabled=index===0;
  if(next) next.disabled=index===table.length-1;
  if(items){
    const benefits=entry.benefits||[];
    // Column-major reading order: for 10 benefits, left 1~6 and right 7~10.
    // Longer tiers distribute the overflow to avoid unnecessarily tall columns.
    const rows=benefits.length<=6 ? Math.ceil(benefits.length/2) : Math.max(6,Math.ceil(benefits.length/2));
    items.style.setProperty('--benefits-rows',String(Math.max(1,rows)));
    items.replaceChildren(...benefits.map((text,index)=>{
      const row=document.createElement('span');
      const number=document.createElement('span');
      number.className='zero-benefit-index';
      number.textContent=String(index+1).padStart(2,'0');
      number.setAttribute('aria-hidden','true');
      const description=document.createElement('span');
      description.className='zero-benefit-description';
      description.textContent=text;
      row.append(number,description);
      return row;
    }));
  }
}
function stepZeroBenefitsPreview(direction){
  const table=getZeroRankTable();
  const current=zeroBenefitViewIndex ?? zeroBenefitActualIndex;
  zeroBenefitViewIndex=Math.max(0,Math.min(table.length-1,current+direction));
  renderZeroBenefitsPreview();
}
function updateZeroScoreCalculator(){
  const calc=qs('.zero-score-calc');
  const state=collectZeroScoreState();
  if(!calc || !state) return;
  let currentTotal=0, total=0;
  calc.querySelectorAll('#zeroScoreRows > .zero-calc-row').forEach((row,index)=>{
    const result=zeroScoreRowCalculation(state.rows[index]);
    currentTotal+=result.currentScore;
    total+=result.score;
    const out=row.querySelector('.zero-row-score');
    if(out){
      out.textContent=`+${fullNumber(result.score)}`;
      out.classList.toggle('is-pending',result.score>0);
    }
    const summary=row.querySelector('.zero-calc-head-summary');
    if(summary){
      const saved=state.rows[index];
      const tower=saved.type==='towerCombo';
      const progressRows=[];
      let achievedCount=0;
      const normalResult=zeroScorePair(saved,tower?zeroTowerScore:zeroPenanceScore);
      const honorResult=tower
        ? zeroScorePair(saved,zeroHonorTowerScore,'towerHonor')
        : zeroScorePair({current:saved.currentHonor,target:saved.targetHonor},zeroHonorScore);
      const progress=(label,current,target,score,format=value=>Number(value)>0?fullNumber(Number(value)):'')=>{
        const cells=[label,format(current),format(target)].map(value=>escapeHtml(value));
        if(!cells[1] && !cells[2]) return;
        const achieved=cells[1]===cells[2];
        if(achieved) achievedCount++;
        const scoreText=achieved?'✓ 달성':`+${fullNumber(score)}`;
        const scoreClass=achieved?' zero-progress-achieved':score>0?' is-pending':'';
        progressRows.push(`<span class="zero-progress-kind">${cells[0]}</span><b aria-label="${cells[0]} 현재 ${cells[1]||'미입력'}">${cells[1]}</b><b aria-label="${cells[0]} 목표 ${cells[2]||'미입력'}">${cells[2]}</b><b class="zero-progress-score${scoreClass}" aria-label="${cells[0]} ${achieved?'목표 달성':`목표 추가점수 +${fullNumber(score)}`}">${scoreText}</b>`);
      };
      progress(tower?'일반탑':'일반',saved.current,saved.target,normalResult.score);
      if(tower){
        progress('명예탑',saved.honorCurrent,saved.honorTarget,honorResult.score);
      }else{
        progress('명예',saved.currentHonor,saved.targetHonor,honorResult.score,value=>value==='0'?'':String(value).toUpperCase());
      }
      const progressTable=progressRows.length
        ? `<span class="zero-calc-progress">${progressRows.join('')}</span>`
        : '';
      summary.hidden=!progressRows.length;
      summary.innerHTML=achievedCount===2
        ? '<span class="zero-calc-complete"><span class="zero-calc-all-achieved">✓ 목표 달성</span></span>'
        : progressTable;
    }
  });
  const targetScore=currentTotal+total;
  const currentRank=zeroRankName(currentTotal);
  const targetRank=zeroRankName(targetScore);
  const values=[
    ['.zero-current-score',currentTotal],
    ['.zero-total-add',`+${fullNumber(total)}`],
    ['.zero-target-score',targetScore],
    ['.zero-current-rank',currentRank],
    ['.zero-target-rank',targetRank]
  ];
  values.forEach(([selector,value])=>{
    const element=calc.querySelector(selector);
    if(element) element.textContent=String(value);
  });
  updateZeroRankHighlights(currentRank,targetRank);
  zeroBenefitActualIndex=getZeroRankTable().indexOf(zeroRankEntry(currentTotal));
  renderZeroBenefitsPreview();
}
const ZERO_SCORE_DOM_FIELDS=Object.freeze({
  current:{selector:'.zero-calc-current',fallback:'0'},
  target:{selector:'.zero-calc-target',fallback:'0'},
  currentHonor:{selector:'.zero-current-honor',fallback:'0',normalize:value=>normalizeZeroHonorValue(value)},
  targetHonor:{selector:'.zero-target-honor',fallback:'0',normalize:value=>normalizeZeroHonorValue(value)},
  honorCurrent:{selector:'.zero-tower-honor-current',fallback:'0'},
  honorTarget:{selector:'.zero-tower-honor-target',fallback:'0'}
});
function zeroScoreDomField(row, key){
  const def=ZERO_SCORE_DOM_FIELDS[key];
  return def ? row.querySelector(def.selector) : null;
}
function readZeroScoreDomField(row, key){
  const def=ZERO_SCORE_DOM_FIELDS[key];
  const value=zeroScoreDomField(row,key)?.value ?? def?.fallback ?? '0';
  return def?.normalize ? def.normalize(value) : value;
}
function writeZeroScoreDomField(row, key, value){
  const def=ZERO_SCORE_DOM_FIELDS[key];
  const field=zeroScoreDomField(row,key);
  if(!field) return;
  if(row.dataset.rowType==='penance' && (key==='current' || key==='target')){
    const numeric=Math.max(0,Math.min(20,Math.trunc(Number(value) || 0)));
    // Keep previously saved levels readable without adding them to the new choice list.
    field.querySelector('option[data-legacy-penance]')?.remove();
    if(!ZERO_PENANCE_SELECT_VALUES.includes(numeric)){
      const legacy=document.createElement('option');
      legacy.value=String(numeric);
      legacy.textContent=String(numeric);
      legacy.hidden=true;
      legacy.dataset.legacyPenance='1';
      field.appendChild(legacy);
    }
    field.value=String(numeric);
    return;
  }
  field.value=def?.normalize ? def.normalize(value ?? def.fallback) : String(value ?? def?.fallback ?? '0');
}
function collectZeroScoreState(){
  const calc=qs('.zero-score-calc');
  if(!calc) return null;
  return {
    rows:Array.from(calc.querySelectorAll('#zeroScoreRows > .zero-calc-row')).map(row=>{
      const type=row.dataset.rowType || 'penance';
      const state={
        type,
        current:readZeroScoreDomField(row,'current'),
        target:readZeroScoreDomField(row,'target'),
        star:type==='penance' && !!row.querySelector('.zero-star-toggle.active'),
        currentHonor:readZeroScoreDomField(row,'currentHonor').toLowerCase(),
        targetHonor:readZeroScoreDomField(row,'targetHonor').toLowerCase()
      };
      if(type==='towerCombo'){
        state.honorCurrent=readZeroScoreDomField(row,'honorCurrent');
        state.honorTarget=readZeroScoreDomField(row,'honorTarget');
      }
      return state;
    })
  };
}
function setZeroScoreStarButton(starBtn,active){
  setTogglePressed(starBtn, active, {activeText:'적용', inactiveText:'미적용'});
  if(starBtn) starBtn.setAttribute('aria-label',active?'24스타 적용중':'24스타 미적용');
}
function applyZeroScoreState(zeroScore){
  const calc=qs('.zero-score-calc');
  if(!calc) return;
  const rows=zeroScore ? normalizeZeroScoreState(zeroScore).rows : [];
  calc.querySelectorAll('#zeroScoreRows > .zero-calc-row').forEach((row,idx)=>{
    const type=row.dataset.rowType || 'penance';
    const saved=type==='towerCombo' ? zeroTowerComboFromRows(rows,idx) : (rows[idx] || {});
    ['current','target','currentHonor','targetHonor','honorCurrent','honorTarget'].forEach(key=>writeZeroScoreDomField(row,key,saved[key]));
    setZeroScoreStarButton(row.querySelector('.zero-star-toggle:not(:disabled)'), !!saved.star);
  });
  updateZeroScoreCalculator();
}
function commitZeroScoreChange(){
  updateZeroScoreCalculator();
  if(!isStorageLocked()) scheduleAutoSave();
}
function toggleZeroScoreStar(trigger){
  if(!trigger) return;
  setZeroScoreStarButton(trigger,!trigger.classList.contains('active'));
  commitZeroScoreChange();
}
function normalizeZeroHonorInputElement(el){
  if(!el || !el.classList?.contains('zero-honor-input') || el.tagName==='SELECT') return;
  el.value=normalizeZeroHonorValue(el.value).toUpperCase();
}
function setZeroScoreRowExpanded(header,expanded,exclusive=true){
  const row=header?.closest('.zero-calc-row');
  const details=row?.querySelector('.zero-calc-details');
  if(!details) return;
  if(expanded && exclusive){
    qs('.zero-rank-card')?.querySelectorAll('.zero-calc-row-head[aria-expanded="true"]').forEach(other=>{
      if(other!==header) setZeroScoreRowExpanded(other,false);
    });
  }
  header.setAttribute('aria-expanded',String(expanded));
  row.classList.toggle('is-expanded',expanded);
  const label=`${header.querySelector('.zero-calc-name strong')?.textContent || '승단'} 승단 점수 입력`;
  header.setAttribute('aria-label',`${label} ${expanded?'접기':'펼치기'}`);
  setAccordionContentExpanded(details,expanded);
}
function bindZeroScoreCalculator(){
  if(document.documentElement.dataset.zeroScoreCalcBound==='1') return;
  document.documentElement.dataset.zeroScoreCalcBound='1';
  const card=qs('.zero-rank-card');
  const benefitsHelp=$('zeroTitleBenefitsPopover');
  benefitsHelp?.addEventListener('click',event=>{
    const control=event.target.closest('[data-zero-benefits-step]');
    if(!control || control.disabled) return;
    event.preventDefault();
    stepZeroBenefitsPreview(Number(control.dataset.zeroBenefitsStep));
  });
  card?.addEventListener('click',event=>{
    const guideToggle=event.target.closest('[data-zero-guide-toggle]');
    const guideClose=event.target.closest('[data-zero-guide-close]');
    if(guideToggle || guideClose){
      const guide=$('zeroRankGuide');
      const toggle=guide?.querySelector('[data-zero-guide-toggle]');
      const content=$('zeroGuideContent');
      if(!guide || !toggle || !content) return;
      const expanded=!!guideToggle && toggle.getAttribute('aria-expanded')!=='true';
      guide.classList.toggle('is-expanded',expanded);
      toggle.setAttribute('aria-expanded',String(expanded));
      content.hidden=!expanded;
      if(guideClose) toggle.focus({preventScroll:true});
      return;
    }
    const header=event.target.closest('.zero-calc-row-head');
    if(!header || !card.contains(header)) return;
    setZeroScoreRowExpanded(header,header.getAttribute('aria-expanded')!=='true');
    // 마우스/터치 클릭 후 포커스 강조가 접힌 제목에 남지 않도록 정리합니다.
    // 키보드 클릭(detail=0)은 포커스를 유지해 접근성을 보존합니다.
    if(event.detail>0) header.blur();
  });
  const updateAndSave=(target,finalize=false)=>{
    if(!(target && target.closest && target.closest('.zero-score-calc'))) return;
    const penanceRow=target.closest('.zero-calc-row[data-row-type="penance"]');
    if(penanceRow && target.matches('.zero-calc-current,.zero-calc-target')){
      if(target.value===''){
        if(!finalize) return; // Allow replacing a number without saving an empty value.
        target.value='0';
      }
      const value=Number(target.value);
      target.value=String(Number.isFinite(value) ? Math.max(0,Math.min(20,Math.trunc(value))) : 0);
    }
    normalizeZeroHonorInputElement(target);
    commitZeroScoreChange();
  };
  document.addEventListener('input', e=>updateAndSave(e.target), true);
  document.addEventListener('change', e=>updateAndSave(e.target,true), true);
  document.addEventListener('focusout', e=>{
    const target=e.target;
    if(target?.matches?.('.zero-calc-row[data-row-type="penance"] .zero-calc-current,.zero-calc-row[data-row-type="penance"] .zero-calc-target') && target.value==='') updateAndSave(target,true);
  }, true);
}

/* ── 12 · 화면 이벤트 및 연결 ── */
let appEventsBound=false;
const ACTION_HANDLERS={
  optimizeSP,
  optimizeUtility,
  clearUtility:()=>requestConfirmAction('clearUtility','한 번 더 누르면 유틸 초기화', clearUtility),
  clearAll:()=>requestConfirmAction('clearAll','한 번 더 누르면 편의/보조 제외 공격 특성 초기화', clearAll),
  saveTraitPreset:(...args)=>window.DpsPreset.saveCurrent(...args),
  loadTraitPreset:(...args)=>window.DpsPreset.loadSelected(...args),
  updateTraitPreset:(...args)=>window.DpsPreset.updateCurrent(...args),
  deleteTraitPreset:(...args)=>window.DpsPreset.deleteCurrent(...args),
  resetAllTraitPresetState:(...args)=>window.DpsPreset.resetAll(...args),
  backupTraitPresets:(...args)=>window.DpsPreset.openBackup(...args),
  importTraitPresets:(...args)=>window.DpsPreset.openImport(...args),
  zeroScoreStar:(trigger)=>toggleZeroScoreStar(trigger),
  toggleFontScalePopover,
  decreaseFont:()=>changeFontScale(-DPS_CONFIG.ui.fontScaleStep),
  increaseFont:()=>changeFontScale(DPS_CONFIG.ui.fontScaleStep),
  resetFont:()=>applyFontScale(DPS_CONFIG.ui.fontScaleDefault),
  selectButton:(trigger)=>setSelectButton(trigger.closest('.seg-btns')?.dataset.target, trigger.dataset.value),
  donationBuff:(trigger)=>setDonationBuffType(trigger.dataset.value),
  traitAdjust:(trigger)=>{
    if(Date.now()<traitHoldSuppressClickUntil) return false;
    return adjustTraitBy(+trigger.dataset.row,+trigger.dataset.delta,1);
  },
  traitMax:(trigger)=>adjMax(+trigger.dataset.row),
  traitQuickAdjust:(trigger)=>adjustTraitBy(+trigger.dataset.row,1,+trigger.dataset.step),
  toggleTraitTier:(trigger)=>{ const tier=trigger.dataset.tier||''; setTraitTierExpanded(tier,!expandedTraitTiers.has(tier)); },
  masterTier:(trigger)=>masterTier(trigger.dataset.tier||''),
  resetTier:(trigger)=>{ const tier=trigger.dataset.tier||''; return requestConfirmAction(`resetTier:${tier}`, `한 번 더 누르면 ${tier} 초기화`, ()=>resetTier(tier)); }
};
/* 12-A · 사용자 조작 이벤트 */
function bindActionEvents(){
  document.addEventListener('click', e=>{
    const trigger=e.target.closest('[data-action]');
    if(!trigger) return;
    const action=trigger.getAttribute('data-action');
    const fn=ACTION_HANDLERS[action];
    if(!fn) return;
    e.preventDefault();
    fn(trigger, e);
  });
}
const REACTIVE_INPUT_EXCLUDED_IDS=new Set([
  'traitPresetName',
  'traitPresetSelect',
  'traitPresetImportFile',
  'traitPresetBackupName',
  'artifactDpsViewToggle'
]);
const RUNE_CHOICE_SYNC_IDS=new Set(['runeChoiceType','runeChoiceValue']);
const DEDICATED_DPS_BASE_UNIT_REACTIVE_SELECTOR=[
  '[data-dps-base-unit-slot]',
  '[data-dps-jewel-field]',
  '[data-dps-base-unit-extra-limit-break]',
  '[data-dps-base-unit-extra-jewel]',
  '[data-dps-base-unit-slot-jewel]',
  '[data-dps-base-unit-slot-limit-break]'
].join(',');
/* 12-B · 반응형 입력·상태 이벤트 */
function shouldHandleReactiveInput(target){
  if(isStorageLocked()) return false;
  if(!target || !target.id) return false;
  if(REACTIVE_INPUT_EXCLUDED_IDS.has(target.id)) return false;
  if(target.matches?.('[data-dps-base-unit-slot-enhance]')) return false;
  if(target.matches?.(DEDICATED_DPS_BASE_UNIT_REACTIVE_SELECTOR)) return false;
  if(target.classList && target.classList.contains('tv-input')) return false;
  return target.matches && target.matches('input, select, textarea');
}
function bindReactiveInputs(){
  document.addEventListener('click',event=>{
    const teamButton=event.target?.closest?.('[data-team-count]');
    if(teamButton){
      if(teamButton.disabled) return;
      const team=$('team');
      if(team && [...team.options].some(option=>option.value===teamButton.dataset.teamCount) && team.value!==teamButton.dataset.teamCount){
        team.value=teamButton.dataset.teamCount;
        team.dispatchEvent(new Event('change',{bubbles:true}));
      }
      return;
    }
    const button=event.target?.closest?.('[data-mode-choice]');
    if(!button || button.disabled) return;
    event.preventDefault();
    if(button.dataset.modeChoice==='battle'){
      const coop=$('coopMode');
      if(!coop || coop.value===(button.dataset.value==='coop'?'ON':'OFF')) return;
      if(coop.value==='OFF' && $('team')) $('team').dataset.personalTeamValue=vs('team');
      coop.value=button.dataset.value==='coop' ? 'ON' : 'OFF';
      coop.dispatchEvent(new Event('change',{bubbles:true}));
    }else if(button.dataset.modeChoice==='sp-bank'){
      const bank=$('spBankApply');
      if(!bank || bank.value===button.dataset.value) return;
      bank.value=button.dataset.value;
      bank.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  let raf=0;
  const schedule=(target)=>{
    if(!shouldHandleReactiveInput(target)) return;
    if(target.matches('.money-input')) formatMoneyInput(target);
    if(target.id==='spBankApply') syncSpBankApplyControl();
    if(target.id==='xp') normalizeXpInput();
    if(target.id==='round' || target.id==='skillRound' || target.id==='challengeTowerFloor' || target.id==='planetExplorationFloor') normalizeRoundInput(target.id);
    if(target.id==='skillMode') normalizeRoundInput('skillRound');
    if(target.id==='diff'){
      resetDifficultyDependentFields();
      syncArtifactDpsViewSwitch();
      syncErosionControlElements();
      syncPlanetExplorationRestrictedControls();
      renderDpsSanctuaryInfo();
    }
    if(RUNE_CHOICE_SYNC_IDS.has(target.id)) syncRuneChoice();
    if(ENCHANT_INPUT_ID_SET.has(target.id)) syncEnchantInputs();
    if(RUNE_OPTION_SELECT_ID_SET.has(target.id)) syncExclusiveRuneOptions();
    if(target.id==='soloMode' || target.id==='coopMode'){
      syncBattleMode(target.id,{defaultCoop:true});
    }
    if(target?.matches?.('[data-dps-base-unit-quantity-store],[data-dps-base-unit-slot-quantity]')){
      normalizeDpsBaseUnitQuantityInput(target);
      syncDpsBaseUnitSelectionFromQuantities(false);
    }
    if(target.id==='team'){
      syncTeamSelect({preserveCurrent:true});
    }
    if(TRAIT_LIMIT_INPUT_IDS.has(target.id) && String(target.value).replace(/,/g,'').trim()==='0') syncTraitLimitInputDisplay(target);
    if(target.id==='donationBuffType'){ INV[116]=donationInvestmentFromType(target.value); syncDonationBuffControl(); }
    if(target.matches('select')) syncSelectButtons();
    if(target.matches('.buff-choice-input')){
      if(DPS_UNIT_LINKED_BUFF_UNITS[target.id]) updateDpsUnitFromLinkedBuff(target);
      syncBuffChoiceButtons();
    }
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      commitAppUpdate();
    });
  };
  document.addEventListener('input', e=>schedule(e.target), true);
  document.addEventListener('change', e=>schedule(e.target), true);
}
function bindButtonPressFeedback(){
  const selector='button,.btn';
  document.addEventListener('pointerdown', e=>{
    const btn=e.target && e.target.closest ? e.target.closest(selector) : null;
    if(!btn || btn.disabled) return;
    btn.classList.add('is-pressed');
    setTimeout(()=>btn.classList.remove('is-pressed'), 180);
  }, true);
}
/* 월 전환 시 열린 화면·저장 상태까지 현재 행성 테마로 갱신한다. */
/* 12-C · 행성탐사 날짜·화면 이벤트 */
function bindPlanetExplorationCalendar(){
  let syncedDifficulty=currentPlanetExplorationDifficulty();
  const checkMonth=()=>{
    const current=currentPlanetExplorationDifficulty();
    if(current===syncedDifficulty) return;
    syncedDifficulty=current;
    const active=isPlanetExplorationDifficulty();
    syncDifficultyOptions();
    if(active){
      syncDifficultyTargetControls();
      syncPlanetExplorationRestrictedControls();
    }
    commitAppUpdate({save:false});
  };
  window.setInterval(checkMonth,30000);
  window.addEventListener('focus',checkMonth);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) checkMonth();});
}
function bindAppEvents(){
  if(appEventsBound) return;
  appEventsBound=true;
  [
    bindFontScaleViewportGuard, bindFontScalePopover, bindActionEvents, bindTraitHoldEvents, bindTraitInputEvents,
    bindIntegratedTabEvents, ()=>window.DpsPreset.bindEvents(), bindJewelImageEvents,
    bindZeroScoreCalculator, bindTraitLimitDisplayEvents, bindTraitLimitChoiceEvents, bindDpsBaseUnitControlEvents, bindDpsSanctuaryEvents, bindReactiveInputs,
    bindButtonPressFeedback, bindIndependentWindowButton, bindDamageBoardTabEvents, bindDpsCompareEvents, bindDamageBoardSwitchEvents, renderAppTitleVersion, bindPlanetExplorationCalendar
  ].forEach(fn=>fn());
}
/* ── 13 · 선택 목록 UI 및 동기화 ── */
// 일반 select는 계산·저장 이벤트의 원본으로 유지하고, 표시와 조작만 앱 내부 목록으로 대체합니다.
function initAppSelectDropdowns(){
  if(window.__dpsAppSelectDropdownsReady) return;
  window.__dpsAppSelectDropdownsReady=true;
  const nativeSelector='select:not([data-preview-board]):not(#bp-version):not(#traitPresetSelect):not(#traitPresetImportSharedSource):not(.hidden-field):not(.trait-limit-source):not(.trait-preset-native-select):not([hidden]):not([aria-hidden="true"])';
  const triggerClass='app-select-trigger';
  const menu=document.createElement('div');
  menu.className='app-select-menu';
  menu.id='appSelectMenu';
  menu.setAttribute('role','listbox');
  menu.setAttribute('aria-label','선택 항목');
  menu.hidden=true;
  document.body.appendChild(menu);
  let activeSelect=null;
  let activeButton=null;
  let scheduled=false;
  const buttons=new Map();
  const isSupported=select=>select?.matches?.(nativeSelector) && !select.closest('[data-trait-preset-custom-select]');
  const label=select=>select.getAttribute('aria-label') || (select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent.trim() : '') || select.closest('label')?.querySelector('span')?.textContent.trim() || '항목 선택';
  function optionsFor(select){
    return [...select.options].filter(option=>!option.hidden && !option.parentElement?.hidden);
  }
  function syncButton(select,button){
    if(!select.isConnected || !button.isConnected) return;
    const option=select.selectedOptions?.[0];
    button.querySelector('.app-select-button-value').textContent=option?.textContent.trim() || '선택 안함';
    button.disabled=select.disabled || !optionsFor(select).some(item=>!item.disabled && !item.parentElement?.disabled);
    button.setAttribute('aria-label',`${label(select)}: ${option?.textContent.trim() || '선택 안함'}`);
    if(activeSelect===select && (button.disabled || button.hidden)) closeMenu();
  }
  function enhance(select){
    if(!isSupported(select)) return;
    let button=buttons.get(select);
    if(button?.isConnected && button.previousElementSibling===select){ syncButton(select,button); return; }
    const computed=window.getComputedStyle(select);
    if(computed.display==='none' || computed.visibility==='hidden') return;
    button=document.createElement('button');
    button.type='button';
    button.className=triggerClass;
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls','appSelectMenu');
    button.innerHTML='<span class="app-select-button-value"></span><span class="app-select-button-chevron" aria-hidden="true"></span>';
    button.style.setProperty('--app-select-control-height',computed.height);
    button.style.setProperty('--app-select-control-font-size',computed.fontSize);
    button.style.setProperty('--app-select-control-font-family',computed.fontFamily);
    button.style.setProperty('--app-select-control-radius',computed.borderRadius);
    // 원본을 먼저 측정한 뒤 숨겨 기존 입력창의 배치·계산 연결을 유지합니다.
    select.insertAdjacentElement('afterend',button);
    select.classList.add('app-select-native-source');
    select.setAttribute('aria-hidden','true');
    select.tabIndex=-1;
    buttons.set(select,button);
    syncButton(select,button);
  }
  function closeMenu(restoreFocus=false){
    if(!activeSelect) return;
    const button=activeButton;
    activeSelect=null;
    activeButton=null;
    menu.hidden=true;
    menu.replaceChildren();
    if(button){
      button.classList.remove('is-open');
      button.setAttribute('aria-expanded','false');
      if(restoreFocus && button.isConnected) button.focus({preventScroll:true});
    }
  }
  function placeMenu(){
    if(!activeButton?.isConnected){closeMenu();return;}
    const rect=activeButton.getBoundingClientRect();
    const viewport=window.visualViewport;
    const viewTop=viewport ? viewport.offsetTop : 0;
    const viewHeight=viewport ? viewport.height : window.innerHeight;
    const viewLeft=viewport ? viewport.offsetLeft : 0;
    const viewWidth=viewport ? viewport.width : window.innerWidth;
    const padding=8;
    const below=Math.max(0,viewTop+viewHeight-rect.bottom-padding);
    const above=Math.max(0,rect.top-viewTop-padding);
    const openAbove=below<Math.min(190,above) && above>below;
    const room=Math.max(84,(openAbove?above:below)-7);
    const width=Math.min(viewWidth-padding*2,Math.max(rect.width,Math.min(210,viewWidth-padding*2)));
    const left=Math.max(viewLeft+padding,Math.min(rect.left,viewLeft+viewWidth-padding-width));
    menu.style.width=`${Math.round(width)}px`;
    menu.style.maxHeight=`${Math.max(72,Math.min(300,Math.floor(room)))}px`;
    menu.style.left=`${Math.round(left)}px`;
    menu.style.top=openAbove ? 'auto' : `${Math.round(rect.bottom+5)}px`;
    menu.style.bottom=openAbove ? `${Math.round(window.innerHeight-rect.top+5)}px` : 'auto';
    menu.classList.toggle('opens-up',openAbove);
  }
  function getItems(){ return [...menu.querySelectorAll('[data-app-select-value]')]; }
  function focusItem(item){ if(item){item.focus({preventScroll:true});item.scrollIntoView({block:'nearest'});} }
  function openMenu(select,button,focusList=false){
    if(!select || select.disabled || !button?.isConnected) return;
    if(activeSelect) closeMenu();
    syncButton(select,button);
    activeSelect=select;
    activeButton=button;
    button.classList.add('is-open');
    button.setAttribute('aria-expanded','true');
    menu.setAttribute('aria-label',label(select));
    menu.replaceChildren();
    [...select.children].forEach(node=>{
      if(node.tagName==='OPTGROUP'){
        if(node.hidden) return;
        const group=document.createElement('div');
        group.className='app-select-group-label';
        group.textContent=node.label;
        menu.appendChild(group);
        [...node.children].forEach(appendOption);
      }else if(node.tagName==='OPTION') appendOption(node);
    });
    function appendOption(option){
      if(option.hidden) return;
      const item=document.createElement('button');
      item.type='button';
      item.className='app-select-option';
      item.dataset.appSelectValue=option.value;
      item.setAttribute('role','option');
      item.setAttribute('aria-selected',String(select.value===option.value));
      item.disabled=option.disabled || option.parentElement?.disabled || false;
      if(select.value===option.value) item.classList.add('is-selected');
      const title=document.createElement('span');
      title.className='app-select-option-text';
      title.textContent=option.textContent.trim();
      item.append(title);
      menu.appendChild(item);
    }
    menu.hidden=false;
    placeMenu();
    if(focusList){focusItem(getItems().find(item=>item.classList.contains('is-selected')&&!item.disabled) || getItems().find(item=>!item.disabled));}
    else getItems().find(item=>item.classList.contains('is-selected'))?.scrollIntoView({block:'nearest'});
  }
  function selectItem(item){
    if(!activeSelect || !item || item.disabled) return;
    const select=activeSelect;
    const button=activeButton;
    const changed=select.value!==item.dataset.appSelectValue;
    select.value=item.dataset.appSelectValue;
    closeMenu(true);
    syncButton(select,button);
    if(changed){
      // 기존 코드가 사용하는 네이티브 change 경로를 반드시 한 번만 실행합니다.
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    requestSync();
  }
  function refresh(){
    scheduled=false;
    document.querySelectorAll(nativeSelector).forEach(select=>{
      if(select.classList.contains('app-select-native-source')){
        const button=buttons.get(select);
        if(button?.isConnected) syncButton(select,button);
      }else enhance(select);
    });
    for(const [select,button] of buttons){
      if(select.isConnected && button.isConnected) syncButton(select,button);
      if(!select.isConnected || !button.isConnected){
        if(select===activeSelect) closeMenu();
        buttons.delete(select);
      }
    }
  }
  function requestSync(){
    if(scheduled) return;
    scheduled=true;
    window.requestAnimationFrame(refresh);
  }
  document.addEventListener('click',event=>{
    const option=event.target.closest?.('.app-select-option');
    if(option?.closest('.app-select-menu')){selectItem(option);return;}
    const trigger=event.target.closest?.(`.${triggerClass}`);
    if(trigger){
      const select=trigger.previousElementSibling;
      if(activeButton===trigger) closeMenu();
      else openMenu(select,trigger);
      return;
    }
    const targetLabel=event.target.closest?.('label[for]');
    if(targetLabel){
      const select=document.getElementById(targetLabel.htmlFor);
      const button=buttons.get(select);
      if(button && !targetLabel.contains(button)){
        event.preventDefault();
        if(activeButton===button) closeMenu();
        else openMenu(select,button);
        return;
      }
    }
    if(activeSelect && !menu.contains(event.target)) closeMenu();
    requestSync();
  });
  // 유닛 상세 모달의 Escape 단축키보다 먼저 열린 목록만 닫습니다.
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape' && activeSelect){
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    }
  },true);
  document.addEventListener('keydown',event=>{
    const trigger=event.target.closest?.(`.${triggerClass}`);
    if(trigger && ['ArrowDown','ArrowUp','Home','End',' '].includes(event.key)){
      event.preventDefault();
      if(activeButton!==trigger) openMenu(trigger.previousElementSibling,trigger,true);
      return;
    }
    if(!activeSelect) return;
    if(event.key==='Escape'){
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if(!menu.contains(event.target)) return;
    const items=getItems().filter(item=>!item.disabled);
    const index=items.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      let next=index;
      if(event.key==='Home') next=0;
      else if(event.key==='End') next=items.length-1;
      else if(event.key==='ArrowDown') next=(index+1)%items.length;
      else next=(index-1+items.length)%items.length;
      focusItem(items[next]);
    }
    if(event.key==='Tab') closeMenu();
  });
  document.addEventListener('change',event=>{
    if(event.target.matches?.('select')) requestSync();
  });
  document.addEventListener('input',requestSync);
  document.addEventListener('focusin',event=>{
    if(activeSelect && !menu.contains(event.target) && event.target!==activeButton) closeMenu();
  });
  const observer=new MutationObserver(records=>{
    if(records.some(record=>{
      if(record.type==='attributes') return record.target.matches?.('select,option,optgroup');
      if(record.target.matches?.('select,optgroup')) return true;
      return [...record.addedNodes].some(node=>node.nodeType===1 && (node.matches?.('select') || node.querySelector?.('select')));
    })) requestSync();
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','selected','value']});
  window.addEventListener('resize',()=>{ if(activeSelect) placeMenu();requestSync(); },{passive:true});
  window.addEventListener('scroll',event=>{if(activeSelect && !menu.contains(event.target)) closeMenu();},{passive:true,capture:true});
  window.visualViewport?.addEventListener('resize',()=>{if(activeSelect) placeMenu();},{passive:true});
  // 프리셋 로드 등 직접 .value를 변경하는 기존 코드와 화면 표시를 동기화합니다.
  window.addEventListener('dps:preset-loaded',requestSync);
  refresh();
}

/* ── 14 · 앱 초기화 및 준비 상태 ── */
function initApp(){
  loadFontScale();
  renderZeroScoreCalculatorRows();
  bindAppEvents();
  initAppHeaderLayout();
  syncEnchantCodeFromInputs(true);
  syncSelectButtons();
  syncDonationBuffControl();
  syncBuffChoiceButtons();
  syncDpsBaseUnitControl();
  renderDpsSanctuaryInfo();
  syncExclusiveRuneOptions();
  updateZeroScoreCalculator();
  formatAllMoneyInputs();
  syncTraitLimitInputs();
  loadState();
  window.DpsPreset.init();
  initAppSelectDropdowns();
}
function markAppReady(){
  try{
    if(typeof window.dpsSyncResponsiveLayout === 'function') window.dpsSyncResponsiveLayout();
  }catch(error){ rememberAppIssue('warn','반응형 레이아웃 동기화', error); }
  if(typeof window.dpsMarkAppReady==='function'){
    window.dpsMarkAppReady();
    return;
  }
  document.documentElement.classList.remove('dps-booting');
  try{
    const boot=$('dpsBootScreen');
    if(boot) boot.setAttribute('aria-hidden','true');
  }catch(error){ rememberAppIssue('warn','부팅 화면 숨김', error); }
}
function markAppError(code, error){
  if(typeof window.dpsShowBootError==='function') window.dpsShowBootError(code, error);
  else{
    window.DPS_LAST_INIT_ERROR={code,error,time:Date.now()};
  }
}
window.dpsStartApp=function(){
  if(window.__dpsAppStarted) return;
  window.__dpsAppStarted=true;
  try{
    initApp();
    markAppReady();
  }catch(e){
    markAppError('B1001', e);
  }
};
