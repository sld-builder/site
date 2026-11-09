/* 유닛 보드: 기존 app.js 07 · 08-A~D · 08-F 기능 섹션 직접 이전 */
/* ── 07 · 유닛 보드 상태·표시 ── */
function dpsBaseUnitFieldEntries(){
  const units=dpsBaseUnitList();
  const quantityEntries=units.filter(dpsBaseUnitHasQuantity).map(unit=>[
    dpsBaseUnitQuantityInputId(unit),
    {kind:'유닛 보드',name:`${unit.label || unit.id} 마리수`,save:true}
  ]);
  const settingEntries=units.flatMap(unit=>{
    const entries=[[dpsBaseUnitEnhanceInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 강화 기대값`,save:true}]];
    if(dpsBaseUnitSupportsAdvancedOptions(unit)) entries.push(
      [dpsBaseUnitLimitBreakInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 한계 돌파`,save:true}],
      [dpsBaseUnitJewelInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 전설·신화 쥬얼`,save:true}],
      [dpsBaseUnitVoidPowerInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 공허의 힘`,save:true}]
    );
    return entries;
  });
  return [...quantityEntries,...settingEntries];
}
Object.assign(FIELD_REGISTRY, Object.fromEntries(dpsBaseUnitFieldEntries()));
const DPS_BASE_UNIT_ENHANCE_IDS=new Set(dpsBaseUnitList().map(dpsBaseUnitEnhanceInputId));
const DPS_BASE_UNIT_ADVANCED_OPTION_UNITS=dpsBaseUnitList().filter(dpsBaseUnitSupportsAdvancedOptions);
const DPS_BASE_UNIT_LIMIT_BREAK_IDS=new Set(DPS_BASE_UNIT_ADVANCED_OPTION_UNITS.map(dpsBaseUnitLimitBreakInputId));
const DPS_BASE_UNIT_JEWEL_IDS=new Set(DPS_BASE_UNIT_ADVANCED_OPTION_UNITS.map(dpsBaseUnitJewelInputId));
const DPS_BASE_UNIT_VOID_POWER_IDS=new Set(DPS_BASE_UNIT_ADVANCED_OPTION_UNITS.map(dpsBaseUnitVoidPowerInputId));
const fieldEntriesByFlag=flag=>Object.entries(FIELD_REGISTRY).filter(([,field])=>field[flag]).map(([id])=>id);
const USER_STATE_VALUE_IDS=new Set(fieldEntriesByFlag('save'));
function normalizeDpsBaseUnitSlotExpansions(value){
  let source=value;
  if(typeof source==='string'){
    try{ source=JSON.parse(source || '[]'); }catch{ source=source.split('|'); }
  }
  if(!Array.isArray(source)) source=[];
  const valid=new Set(dpsBaseUnitList().filter(dpsBaseUnitAllowsSlotExpansion).map(unit=>unit.id));
  return source.map(id=>String(id || '').trim()).filter((id,index,list)=>valid.has(id) && list.indexOf(id)===index);
}
function serializeDpsBaseUnitSlotExpansions(value){
  return JSON.stringify(normalizeDpsBaseUnitSlotExpansions(value));
}
function dpsBaseUnitSlotExpansionIds(){
  return normalizeDpsBaseUnitSlotExpansions($('dpsBaseUnitSlotExpansions')?.value || '[]');
}
// 슬롯 확장은 수량 2마리부터 활성화되며 수량에 맞춰 2~5기 설정을 순차 표시합니다.
// 수량이 1마리로 고정된 유닛은 비활성화됩니다.
function dpsBaseUnitSlotExpansionAvailable(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return !!unit && dpsBaseUnitAllowsSlotExpansion(unit) && dpsBaseUnitHasQuantity(unit)
    && Number(dpsBaseUnitQuantityText(unit))>=2;
}
function dpsBaseUnitSlotExpanded(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return dpsBaseUnitSlotExpansionAvailable(unit) && dpsBaseUnitSlotExpansionIds().includes(unit.id);
}
function toggleDpsBaseUnitSlotExpansion(unitId){
  const unit=dpsBaseUnitById(unitId);
  const store=$('dpsBaseUnitSlotExpansions');
  if(!unit || !store || !dpsBaseUnitSlotExpansionAvailable(unit)) return false;
  const ids=dpsBaseUnitSlotExpansionIds();
  const index=ids.indexOf(unit.id);
  if(index>=0){
    ids.splice(index,1);
    dpsUnitExpandedCardIds.delete(unit.id);
  }else ids.push(unit.id);
  store.value=serializeDpsBaseUnitSlotExpansions(ids);
  syncDpsBaseUnitControl();
  return index<0;
}
const DPS_BASE_UNIT_SLOT_SEPARATOR='|';
function emptyDpsBaseUnitSlots(){
  return Array.from({length:dpsBaseUnitSelectionLimit()},()=> '');
}
function normalizeDpsBaseUnitSlotValues(value){
  const validIds=new Set(dpsBaseUnitList().map(unit=>unit.id));
  const source=Array.isArray(value) ? value : String(value ?? '').split(DPS_BASE_UNIT_SLOT_SEPARATOR);
  const slots=emptyDpsBaseUnitSlots();
  const used=new Set();
  for(let i=0;i<slots.length;i++){
    const id=String(source[i] ?? '').trim();
    if(!id || !validIds.has(id) || used.has(id)) continue;
    slots[i]=id;
    used.add(id);
  }
  return slots;
}
function serializeDpsBaseUnitSlots(slots){
  const normalized=normalizeDpsBaseUnitSlotValues(slots);
  return normalized.some(Boolean) ? normalized.join(DPS_BASE_UNIT_SLOT_SEPARATOR) : '';
}
function compactDpsBaseUnitSlots(ids){
  const slots=emptyDpsBaseUnitSlots();
  dpsBaseUnitSelectionIds(ids).slice(0,slots.length).forEach((id,index)=>{ slots[index]=id; });
  return slots;
}
function reconcileDpsBaseUnitSlots(currentSlots, selectedIds){
  const selected=dpsBaseUnitSelectionIds(selectedIds).slice(0,dpsBaseUnitSelectionLimit());
  const selectedSet=new Set(selected);
  const slots=normalizeDpsBaseUnitSlotValues(currentSlots).map(id=>selectedSet.has(id) ? id : '');
  selected.forEach(id=>{
    if(slots.includes(id)) return;
    const emptyIndex=slots.indexOf('');
    if(emptyIndex>=0) slots[emptyIndex]=id;
  });
  // 설정되지 않은 슬롯은 카드로 보이지 않으며 선택된 유닛만 앞에서부터 배치한다.
  return compactDpsBaseUnitSlots(slots.filter(Boolean));
}
function currentDpsBaseUnitSlots(){
  const raw=vs('dpsBaseUnitSlots');
  return raw ? normalizeDpsBaseUnitSlotValues(raw) : compactDpsBaseUnitSlots(vs('dpsBaseUnits'));
}
function sortedDpsBaseUnits(){
  const units=dpsBaseUnitList();
  const gradeOrder=dpsBaseUnitGradeOrder();
  const raceOrder=dpsBaseUnitRaceOrder();
  const orderIndex=(order,value)=>{ const index=order.indexOf(value); return index<0 ? order.length : index; };
  return units.slice().sort((a,b)=>
    orderIndex(gradeOrder,a.grade)-orderIndex(gradeOrder,b.grade) || orderIndex(raceOrder,a.raceGroup)-orderIndex(raceOrder,b.raceGroup) || units.indexOf(a)-units.indexOf(b)
  );
}
let dpsBaseUnitResultDisplayMap=new Map();
let dpsBaseUnitBoardBasePierce=10;
const DPS_BASE_UNIT_MAX_SPEED_EPSILON=0.000001;

function dpsBaseUnitResultHasMaxAttackSpeed(result){
  if(result?.isMaxAttackSpeed===true) return true;
  const cooldown=Number(result?.finalCooldown);
  const maxSpeedCooldown=Number(result?.maxSpeedCooldown);
  return Number.isFinite(cooldown) && Number.isFinite(maxSpeedCooldown) && maxSpeedCooldown>0 && cooldown<=maxSpeedCooldown+DPS_BASE_UNIT_MAX_SPEED_EPSILON;
}
function dpsBaseUnitDisplayLabel(unit){
  return dpsBaseUnitLabel(unit);
}
function dpsBaseUnitAllowedForCurrentPlanet(unitOrId){
  const unit=dpsBaseUnitById(unitOrId);
  if(!unit || !planetExplorationRestrictionsActive()) return true;
  if(typeof dpsBaseUnitPlanetCritDamageMultiplier!=='function') return true;
  return dpsBaseUnitPlanetCritDamageMultiplier(unit, vs('diff'))>0.1;
}
function filterDpsBaseUnitSlotsForCurrentPlanet(slots){
  const normalized=normalizeDpsBaseUnitSlotValues(slots);
  if(!planetExplorationRestrictionsActive()) return normalized;
  return normalized.map(id=>id && dpsBaseUnitAllowedForCurrentPlanet(id) ? id : '');
}
function filterDpsBaseUnitIdsForCurrentPlanet(ids){
  const normalized=dpsBaseUnitSelectionIds(ids);
  if(!planetExplorationRestrictionsActive()) return normalized;
  return normalized.filter(id=>dpsBaseUnitAllowedForCurrentPlanet(id));
}
function dpsBaseUnitCooldownText(value){
  const cooldown=Number(value);
  if(!Number.isFinite(cooldown) || cooldown<=0) return '';
  return cooldown.toLocaleString('ko-KR',{minimumFractionDigits:4,maximumFractionDigits:4});
}
function dpsBaseUnitFinalCooldownText(result){
  return dpsBaseUnitCooldownText(result?.finalCooldown);
}
function dpsBaseUnitMaxCooldownText(result){
  return dpsBaseUnitCooldownText(result?.maxSpeedCooldown);
}
function dpsBaseUnitSpeedDisplay(unit,result){
  const maximum=!!unit && !dpsBaseUnitIsArtifact(unit) && dpsBaseUnitResultHasMaxAttackSpeed(result);
  return {
    label:maximum ? '최대공속' : '공격속도',
    value:unit && !dpsBaseUnitIsArtifact(unit)
      ? ((maximum ? dpsBaseUnitMaxCooldownText(result) : dpsBaseUnitFinalCooldownText(result)) || '—') : '—',
    maximum
  };
}

function dpsBaseUnitPercentText(value){
  const num=Number(value);
  if(!Number.isFinite(num)) return '—';
  const fixed=Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
  return `${fixed}%`;
}
function dpsBaseUnitTruncatedCompactAmount(value,divisor,digits){
  const factor=10**digits;
  const amount=Math.trunc((value/divisor)*factor)/factor;
  return amount.toLocaleString('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:digits});
}
const DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS=Object.freeze({trillion:true,roundTenThousands:true});
function dpsBaseUnitNumberText(value,options={}){
  const number=Number(value);
  if(!Number.isFinite(number)) return '—';
  const sign=number<0 ? '-' : '';
  const absolute=Math.abs(number);
  const compact=(divisor,suffix,digits=2)=>`${sign}${dpsBaseUnitTruncatedCompactAmount(absolute,divisor,digits)}${suffix}`;
  if(options.trillion && absolute>=1000000000000) return compact(1000000000000,'조');
  if(absolute>=100000000) return compact(100000000,'억');
  if(absolute>=10000){
    if(options.compactTenThousands) return compact(10000,'만');
    const convert=options.roundTenThousands ? Math.round : Math.floor;
    return `${sign}${convert(absolute/10000).toLocaleString('ko-KR')}만`;
  }
  if(options.smallDecimals && absolute<1000) return `${sign}${absolute.toFixed(2)}`;
  return `${sign}${Math.round(absolute).toLocaleString('ko-KR')}`;
}
function dpsBaseUnitDpsText(item){
  return dpsBaseUnitNumberText(item?.M19,{smallDecimals:true});
}
function dpsBaseUnitAttackText(item){
  const value=Number(item?.weaponAttack);
  if(!Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:2});
}
function dpsBaseUnitSummaryMarkup(text){
  const value=String(text??'—');
  const match=value.match(/^(.*?)(조|억|만|%)$/);
  if(!match) return `<span class="dps-num-main">${value}</span>`;
  return `<span class="dps-num-main">${match[1]}<span class="dps-num-unit">${match[2]}</span></span>`;
}
function dpsBaseUnitAchievementPercent(value){
  const number=Math.max(0,Number(value));
  return Number.isFinite(number) ? Math.trunc(number) : null;
}
function dpsBaseUnitAchievementText(value){
  const percent=dpsBaseUnitAchievementPercent(value);
  return percent===null ? '—' : `${dpsBaseUnitNumberText(percent,{trillion:true})}%`;
}
function renderDpsBaseUnitSummary(s,hidden=false){
  const el=$('dpsBaseUnitSummary');
  if(!el) return;
  const info=s?.dpsBaseUnit;
  const results=Array.isArray(info?.results) ? info.results : [];
  const basePierce=Number(info?.basePierceBonus)||0;
  dpsBaseUnitBoardBasePierce=basePierce;
  const selectedResultEntries=(hidden ? [] : results).map(item=>[String(item?.unitId || ''),item]).filter(([id])=>id);
  dpsBaseUnitResultDisplayMap=new Map(selectedResultEntries);
  syncDpsBaseUnitControl();
  const requiredDps=Number(info?.requiredDps);
  if(hidden){
    el.hidden=true;
    el.innerHTML='';
    return;
  }
  const valid=Number.isFinite(requiredDps) && requiredDps>0;
  const expectedDps=Math.max(0,Number(info?.expectedDps)||0);
  const achievementRate=Math.max(0,Number(info?.achievementRate)||0);
  const rawPercent=valid ? dpsBaseUnitAchievementPercent(achievementRate) : null;
  const shownPercent=rawPercent===null ? '—' : dpsBaseUnitAchievementText(achievementRate);
  const contextHtml=`<div class="right-hero-context dps-base-unit-context" aria-label="유닛 보드 모드 및 난이도"><span class="unit-summary-label">모드 / 난이도</span><strong class="right-hero-compact-mode">${dpsBoardContextHtml()}</strong></div>`;
  const tower=isTowerDifficulty();
  const planet=isPlanetExplorationDifficulty();
  const currentStage=tower?`${challengeTowerFloorStoredValue()}층`:planet?`${planetExplorationFloorStoredValue()}층`:`${effectivePenanceValue()} 고행`;
  const currentRound=tower||planet?'':`${normalizedRoundNumber(targetRoundStoredValue())} 라운드`;
  const stageHtml=`<div class="unit-summary-stage"><span class="unit-summary-label">현재 ${tower||planet?'층':'고행 / 라운드'}</span><strong>${escapeHtml(currentStage)}</strong><small>${escapeHtml(currentRound||' ')}</small></div>`;
  const requiredHtml=`<div class="dps-base-unit-summary-item"><span class="dps-feature-heading"><span class="dps-lbl">클리어 기준</span></span><b class="dps-num">${dpsBaseUnitSummaryMarkup(valid ? dpsBaseUnitNumberText(requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS) : '—')}</b></div>`;
  const expectedHtml=`<div class="dps-base-unit-summary-item dps-base-unit-expected"><span class="dps-feature-heading"><span class="dps-lbl">클리어 기대값</span></span><b class="dps-num">${dpsBaseUnitSummaryMarkup(valid ? dpsBaseUnitNumberText(expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS) : '—')}</b></div>`;
  const achievementHtml=`<div class="unit-achievement" aria-label="클리어 달성률 ${escapeHtml(shownPercent)}"><div class="unit-achievement-label"><span>클리어 달성률</span></div><b class="dps-num unit-achievement-value">${escapeHtml(shownPercent)}</b></div>`;
  const specDpsLabel=($('dpsMainLabel')?.textContent || '스펙 DPS').trim();
  const specDpsValue=($('dpsVal')?.textContent || '—').trim();
  const specDpsHtml=`<div class="dps-base-unit-summary-item dps-base-unit-spec-dps"><span class="dps-feature-heading"><span class="dps-lbl">${escapeHtml(specDpsLabel)}</span></span><b class="dps-num">${escapeHtml(specDpsValue)}</b></div>`;
  el.innerHTML=`<div class="dps-base-unit-summary-row"><div class="dps-base-unit-top board-context-header">${contextHtml}${stageHtml}${specDpsHtml}</div><div class="dps-base-unit-results" aria-label="유닛 클리어 결과">${requiredHtml}${expectedHtml}${achievementHtml}</div></div>`;

  el.hidden=false;
}
function appendDpsBaseUnitStoreInput(store,id,value,dataName,unitId){
  if($(id)) return $(id);
  const input=document.createElement('input');
  input.type='hidden';
  input.id=id;
  input.value=String(value);
  input.setAttribute(dataName,unitId);
  store.appendChild(input);
  return input;
}
function ensureDpsBaseUnitStore(){
  const store=$('dpsBaseUnitQuantityStore');
  if(!store) return;
  dpsBaseUnitList().forEach(unit=>{
    if(dpsBaseUnitHasQuantity(unit)) appendDpsBaseUnitStoreInput(store,dpsBaseUnitQuantityInputId(unit),'0','data-dps-base-unit-quantity-store',unit.id);
    appendDpsBaseUnitStoreInput(store,dpsBaseUnitEnhanceInputId(unit),'0','data-dps-base-unit-enhance-store',unit.id);
    if(dpsBaseUnitSupportsAdvancedOptions(unit)){
      appendDpsBaseUnitStoreInput(store,dpsBaseUnitLimitBreakInputId(unit),'0','data-dps-base-unit-limit-break-store',unit.id);
      appendDpsBaseUnitStoreInput(store,dpsBaseUnitJewelInputId(unit),'','data-dps-base-unit-jewel-store',unit.id);
      appendDpsBaseUnitStoreInput(store,dpsBaseUnitVoidPowerInputId(unit),'OFF','data-dps-base-unit-void-power-store',unit.id);
    }
  });
}
const DPS_BASE_UNIT_INPUT_ID_RESOLVERS=Object.freeze({
  quantity:dpsBaseUnitQuantityInputId,
  enhance:dpsBaseUnitEnhanceInputId,
  limitBreak:dpsBaseUnitLimitBreakInputId,
  jewel:dpsBaseUnitJewelInputId,
  voidPower:dpsBaseUnitVoidPowerInputId
});
function dpsBaseUnitStoreInput(field,unit){
  ensureDpsBaseUnitStore();
  const inputId=DPS_BASE_UNIT_INPUT_ID_RESOLVERS[field];
  return inputId ? $(inputId(unit)) : null;
}
function dpsBaseUnitQuantityText(unit){
  return dpsBaseUnitHasQuantity(unit) ? normalizeDpsBaseUnitQuantityValue(dpsBaseUnitStoreInput('quantity',unit)?.value || 0) : '1';
}
function dpsBaseUnitQuantityControlHtml(unit, slotIndex, idPrefix='dpsBaseUnitSlotQty'){
  if(!unit) return '<span class="dps-base-unit-fixed-qty is-auto-value">—</span>';
  if(!dpsBaseUnitHasQuantity(unit)) return '<span class="dps-base-unit-fixed-qty is-auto-value">1</span>';
  const limit=dpsBaseUnitQuantityLimit();
  const value=normalizeDpsBaseUnitQuantityValue(dpsBaseUnitStoreInput('quantity',unit)?.value || 0);
  const increaseDisabled=Number(value)>=limit ? ' disabled aria-disabled="true"' : '';
  const label=escapeHtml(dpsBaseUnitLabel(unit.id));
  return `<div class="dps-base-unit-qty-control" data-dps-base-unit-qty-control="${escapeHtml(unit.id)}"><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="-1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 마리수 감소">−</button><input class="dps-base-unit-qty-input" id="${idPrefix}${slotIndex+1}" data-dps-base-unit-slot-quantity="${escapeHtml(unit.id)}" inputmode="numeric" type="text" min="0" max="${limit}" value="${escapeHtml(value)}" aria-label="${label} 마리수"/><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 마리수 증가"${increaseDisabled}>+</button></div>`;
}
/* ── 08 · 쥬얼·슬롯·유닛 상세 설정 ── */
/* 08-A · 쥬얼 이미지·효과·적용 관리 */
function getJewelImageSources(name){
  const jewelName=String(name||'').trim();
  const key=`jw/${jewelName}.png`;
  const localUrl=`./jw/${encodeURIComponent(jewelName)}.png`;
  return {
    src:window.dpsRemoteAssetUrl(key),
    fallback:window.dpsAssetUrl(localUrl)
  };
}
function handleJewelImageError(img){
  if(!img) return;
  const fallbackSrc=img.dataset?.fallbackSrc || '';
  if(fallbackSrc){
    img.dataset.fallbackSrc='';
    img.src=fallbackSrc;
    return;
  }
  const visual=img.closest('.jewel-card-visual');
  if(visual) visual.classList.add('is-missing');
  img.remove();
}
function bindJewelImageEvents(){
  document.addEventListener('error', e=>{
    const img=e.target?.closest?.('.jewel-card-visual img[data-jewel-image]');
    if(img) handleJewelImageError(img);
  }, true);
}
function renderJewelAbility(label, text){
  const value=String(text||'').trim();
  const isUnreleased=value==='미발견';
  return `
    <div class="jewel-ability ${isUnreleased?'is-unreleased':''}">
      <b><span class="jewel-ability-grade-icon" aria-hidden="true">${label==='신화'?'✦':'◆'}</span>${escapeHtml(label)}</b>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}
function dpsJewelOptionHtml(values,selected,suffix=''){
  return (Array.isArray(values) ? values : []).map(value=>`<option value="${escapeHtml(value)}"${String(value)===String(selected)?' selected':''}>${escapeHtml(value)}${suffix}</option>`).join('');
}
function dpsJewelAbilityTexts(name){
  const row=(window.DPS_DATA?.RAW_JEWEL_DATA || []).find(item=>String(item?.[0] || '')===String(name || '')) || [];
  return {legendary:String(row[1] || ''),mythic:String(row[2] || '')};
}
function dpsJewelFinalStatItemHtml(label,value,suffix='%'){
  return `<span class="dps-jewel-final-item"><em>${escapeHtml(label)}</em><b>${escapeHtml(value)}${escapeHtml(suffix)}</b></span>`;
}
function dpsJewelFinalStatsHtml(finalStats){
  return `<span class="dps-jewel-final-label">최종 능력치</span>
      ${dpsJewelFinalStatItemHtml('공격력',finalStats.ad)}
      ${dpsJewelFinalStatItemHtml('공격속도',finalStats.as)}
      ${dpsJewelFinalStatItemHtml('총 데미지',finalStats.td)}
      ${dpsJewelFinalStatItemHtml('가속',finalStats.ua)}`;
}
function dpsJewelFieldOptions(name,key,setting){
  const options=window.DPS_DATA?.DPS_JEWEL_INPUT_OPTIONS || {};
  if(typeof dpsJewelIsChrysoberyl==='function' && dpsJewelIsChrysoberyl(name) && ['ad','as','td','ua'].includes(key)){
    const fixed=Number(DPS_CHRYSOBERYL_FIXED_STATS?.[key]) || 0;
    return fixed ? [0,fixed] : [0];
  }
  if(name==='터쿼이즈' && setting?.mythic==='Y' && key==='td') return options.turquoiseMythicTd;
  return options[key] || [];
}
function dpsJewelConfigCardHtml(name,settings){
  const input=typeof normalizeDpsJewelSettingForName==='function' ? normalizeDpsJewelSettingForName(name,settings?.[name]) : normalizeDpsJewelSetting(settings?.[name]);
  const finalStats=dpsJewelFinalStats(name,settings);
  const field=(key,label)=>`<label class="dps-jewel-field" data-jewel-stat="${key}"><span>${label}</span><select data-dps-jewel-name="${escapeHtml(name)}" data-dps-jewel-field="${key}" aria-label="${escapeHtml(name)} ${label}">${dpsJewelOptionHtml(dpsJewelFieldOptions(name,key,input),input[key])}</select></label>`;
  const mythic=finalStats.mythic==='Y';
  const gradeClass=mythic?'is-mythic':'is-legendary';
  const gradeText=mythic?'신화':'전설';
  const initial=name ? name.charAt(0) : '?';
  const imageSources=getJewelImageSources(name);
  const fallbackAttr=imageSources.fallback && imageSources.fallback!==imageSources.src ? ` data-fallback-src="${escapeHtml(imageSources.fallback)}"` : '';
  const ability=dpsJewelAbilityTexts(name);
  return `<article class="dps-jewel-card${mythic?' is-mythic':''}${dpsJewelSettingIsActive(input,name)?'':' is-unconfigured'}" data-dps-jewel-card="${escapeHtml(name)}">
    <button type="button" class="dps-jewel-card-head" data-dps-jewel-toggle aria-expanded="false" aria-label="${escapeHtml(name)} 능력치 설정 펼치기">
      <div class="jewel-card-visual" aria-hidden="true">
        <img src="${escapeHtml(imageSources.src)}"${fallbackAttr} data-jewel-image="1" alt="" loading="lazy">
        <span>${escapeHtml(initial)}</span>
      </div>
      <div class="dps-jewel-title-block"><b class="${gradeClass}">${escapeHtml(gradeText)} ${escapeHtml(name)}</b></div>
      <span class="dps-jewel-expand-mark" aria-hidden="true">⌄</span>
    </button>
    <div class="dps-jewel-card-detail" hidden>
    <div class="jewel-ability-list dps-jewel-ability-list">
      ${renderJewelAbility('전설', ability.legendary)}
      ${renderJewelAbility('신화', ability.mythic)}
    </div>
    <div class="dps-jewel-settings-title">능력치 설정</div>
    <div class="dps-jewel-fields">${field('ad','공격력')}${field('as','공격속도')}${field('td','총 데미지')}${field('ua','가속')}${field('enhance','강화')}${field('mythic','신화 여부')}</div>
    <div class="dps-jewel-final" aria-label="${escapeHtml(name)} 최종 옵션">
      ${dpsJewelFinalStatsHtml(finalStats)}
    </div>
    </div>
  </article>`;
}
function refreshDpsJewelConfigCard(name,settings=null,focusKey=''){
  const grid=$('dpsJewelConfigGrid');
  if(!grid) return false;
  const card=[...grid.querySelectorAll('[data-dps-jewel-card]')].find(item=>String(item.getAttribute('data-dps-jewel-card') || '')===String(name || ''));
  if(!card) return false;
  const normalized=settings || dpsJewelSettingsObject();
  const input=typeof normalizeDpsJewelSettingForName==='function' ? normalizeDpsJewelSettingForName(name,normalized?.[name]) : normalizeDpsJewelSetting(normalized?.[name]);
  const finalStats=dpsJewelFinalStats(name,normalized);
  const mythic=finalStats.mythic==='Y';
  card.classList.toggle('is-mythic',mythic);
  card.classList.toggle('is-unconfigured',!dpsJewelSettingIsActive(input,name));
  const title=card.querySelector('.dps-jewel-title-block b');
  if(title){
    const titleText=`${mythic?'신화':'전설'} ${name}`;
    const titleClass=mythic?'is-mythic':'is-legendary';
    if(title.textContent!==titleText) title.textContent=titleText;
    if(title.className!==titleClass) title.className=titleClass;
  }
  const finalBox=card.querySelector('.dps-jewel-final');
  if(finalBox){
    const finalHtml=dpsJewelFinalStatsHtml(finalStats);
    if(finalBox.innerHTML!==finalHtml) finalBox.innerHTML=finalHtml;
  }
  ['ad','as','td','ua','enhance','mythic'].forEach(field=>{
    const control=card.querySelector(`[data-dps-jewel-field="${field}"]`);
    if(!control) return;
    const next=String(input[field] ?? '');
    if(field==='td'){
      const allowed=dpsJewelFieldOptions(name,field,input);
      const existing=[...control.options].map(option=>option.value);
      if(existing.length!==allowed.length || allowed.some((value,index)=>String(value)!==existing[index])){
        control.innerHTML=dpsJewelOptionHtml(allowed,input[field]);
      }
    }
    if(String(control.value)!==next) control.value=next;
  });
  if(focusKey){
    requestAnimationFrame(()=>card.querySelector(`[data-dps-jewel-field="${String(focusKey).replace(/"/g,'\\"')}"]`)?.focus({preventScroll:true}));
  }
  return true;
}
function updateDpsJewelConfig(select){
  const store=$('dpsJewelSettings');
  const name=normalizeDpsJewelName(select?.getAttribute?.('data-dps-jewel-name'));
  const key=String(select?.getAttribute?.('data-dps-jewel-field') || '');
  if(!store || !name || !['ad','as','td','ua','enhance','mythic'].includes(key)) return false;
  const before=serializeDpsJewelSettings(store.value || '{}');
  const settings=normalizeDpsJewelSettings(store.value || '{}');
  const current=normalizeDpsJewelSettingForName(name,settings[name]);
  const activeBefore=dpsJewelSettingIsActive(current,name);
  if(dpsJewelIsChrysoberyl(name) && ['ad','as','td','ua'].includes(key)){
    const fixed=Number(DPS_CHRYSOBERYL_FIXED_STATS?.[key]) || 0;
    const stats=Number(select.value)===fixed && fixed>0 ? DPS_CHRYSOBERYL_FIXED_STATS : DPS_CHRYSOBERYL_EMPTY_STATS;
    settings[name]=normalizeDpsJewelSettingForName(name,dpsChrysoberylSettingWithStats(current,stats));
  }else{
    settings[name]=normalizeDpsJewelSettingForName(name,{...settings[name],[key]:select.value});
  }
  const next=serializeDpsJewelSettings(settings);
  if(before===next){
    refreshDpsJewelConfigCard(name,settings,key);
    return false;
  }
  store.value=next;
  const activeAfter=dpsJewelSettingIsActive(settings[name],name);
  const selectionChanged=activeBefore!==activeAfter ? sanitizeDpsJewelSelections() : false;
  refreshDpsJewelConfigCard(name,settings,key);
  if(activeBefore!==activeAfter || selectionChanged) syncDpsBaseUnitControl({skipJewelConfig:true});
  markTraitPresetJewelSettingsPending();
  return true;
}
function renderDpsJewelConfigGrids(options={}){
  const grid=$('dpsJewelConfigGrid');
  const store=$('dpsJewelSettings');
  if(!grid || !store) return;
  const settings=normalizeDpsJewelSettings(store.value || '{}');
  const normalized=serializeDpsJewelSettings(settings);
  if(store.value!==normalized) store.value=normalized;
  const names=dpsJewelNames();
  const cards=[...grid.querySelectorAll('[data-dps-jewel-card]')];
  const sameCards=cards.length===names.length && cards.every((card,index)=>String(card.getAttribute('data-dps-jewel-card') || '')===String(names[index] || ''));
  if(options.force || !sameCards){
    grid.innerHTML=names.map(name=>dpsJewelConfigCardHtml(name,settings)).join('');
    return;
  }
  names.forEach(name=>refreshDpsJewelConfigCard(name,settings));
}
function dpsJewelSettingIsActive(value,name=''){
  const setting=typeof normalizeDpsJewelSettingForName==='function' ? normalizeDpsJewelSettingForName(name,value) : normalizeDpsJewelSetting(value);
  if(typeof dpsJewelIsChrysoberyl==='function' && dpsJewelIsChrysoberyl(name)) return dpsChrysoberylSettingIsFixed(setting);
  return ['ad','as','td','ua','enhance'].some(key=>Number(setting[key])>0) || setting.mythic==='Y';
}
function activeDpsJewelNames(settings=dpsJewelSettingsObject()){return dpsJewelNames().filter(name=>dpsJewelSettingIsActive(settings?.[name],name));}
function dpsBaseUnitJewelSelectionOrder(){
  return currentDpsBaseUnitSlots().filter(Boolean);
}
function dpsBaseUnitActiveExtraJewelCount(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  // 활성화된 슬롯 확장의 실제 유닛 수량만큼 쥬얼 슬롯을 예약합니다.
  if(!dpsBaseUnitAllowsSlotExpansion(unit) || !dpsBaseUnitSlotExpanded(unit)) return 0;
  return Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT,Math.max(0,Number(dpsBaseUnitQuantityText(unit))-1));
}
function dpsBaseUnitJewelOwnerKey(unitId,extraIndex=-1){
  return extraIndex>=0 ? `${unitId}:extra:${extraIndex}` : `${unitId}:primary`;
}
function setDpsBaseUnitExtraSettings(value){
  const store=$('dpsBaseUnitExtraSettings');
  const normalized=normalizeDpsBaseUnitExtraSettings(value);
  if(store) store.value=serializeDpsBaseUnitExtraSettings(normalized);
  return normalized;
}
function dpsLegendaryJewelActiveUsage(){
  const usage=new Map();
  const extras=dpsBaseUnitExtraSettingsObject();
  dpsBaseUnitJewelSelectionOrder().forEach(unitId=>{
    const primary=normalizeDpsJewelName(dpsBaseUnitStoreInput('jewel',unitId)?.value || '');
    if(primary && !usage.has(primary)) usage.set(primary,dpsBaseUnitJewelOwnerKey(unitId));
    (extras[unitId] || []).slice(0,dpsBaseUnitActiveExtraJewelCount(unitId)).forEach((item,index)=>{
      const name=normalizeDpsJewelName(item?.legendaryMythicJewel);
      if(name && !usage.has(name)) usage.set(name,dpsBaseUnitJewelOwnerKey(unitId,index));
    });
  });
  return usage;
}
function sanitizeDpsJewelSelections(){
  const activeLegendary=new Set(activeDpsJewelNames());
  const unitOrder=dpsBaseUnitJewelSelectionOrder();
  const extraSettings=dpsBaseUnitExtraSettingsObject();
  const usedLegendary=new Set();
  let changed=false;
  unitOrder.forEach(unitId=>{
    const input=dpsBaseUnitStoreInput('jewel',unitId);
    const primary=normalizeDpsJewelName(input?.value || '');
    if(primary){
      if(!activeLegendary.has(primary) || usedLegendary.has(primary)){
        input.value='';
        changed=true;
      }else usedLegendary.add(primary);
    }
    const items=extraSettings[unitId];
    if(!Array.isArray(items)) return;
    items.slice(0,dpsBaseUnitActiveExtraJewelCount(unitId)).forEach(item=>{
      const name=normalizeDpsJewelName(item.legendaryMythicJewel);
      if(!name) return;
      if(!activeLegendary.has(name) || usedLegendary.has(name)){
        item.legendaryMythicJewel='';
        changed=true;
      }else usedLegendary.add(name);
    });
  });
  if(changed) setDpsBaseUnitExtraSettings(extraSettings);
  return changed;
}
function sanitizeDpsBaseUnitBelowHellSettings(){
  let changed=false;
  dpsBaseUnitList().forEach(unit=>{
    const enhance=dpsBaseUnitStoreInput('enhance',unit);
    if(enhance && !dpsBaseUnitCanUseEnhance(unit) && normalizeDpsBaseUnitEnhanceValue(enhance.value,0)!=='0'){
      enhance.value='0';
      changed=true;
    }
    const limitBreak=dpsBaseUnitStoreInput('limitBreak',unit);
    if(limitBreak && !dpsBaseUnitCanUseLimitBreak(unit) && normalizeDpsBaseUnitLimitBreakValue(limitBreak.value)!=='0'){
      limitBreak.value='0';
      changed=true;
    }
    if(dpsBaseUnitHasQuantity(unit)){
      const quantity=dpsBaseUnitStoreInput('quantity',unit);
      const next=normalizeDpsBaseUnitQuantityValue(quantity?.value || 0);
      if(quantity && quantity.value!==next){
        quantity.value=next;
        changed=true;
      }
    }
  });
  const extraStore=$('dpsBaseUnitExtraSettings');
  if(extraStore){
    const normalized=serializeDpsBaseUnitExtraSettings(normalizeDpsBaseUnitExtraSettings(extraStore.value || '{}'));
    if(extraStore.value!==normalized){
      extraStore.value=normalized;
      changed=true;
    }
  }
  return changed;
}
function clearDpsJewelFromOtherAssignments(jewelName,ownerKey){
  const name=normalizeDpsJewelName(jewelName);
  if(!name) return;
  const extras=dpsBaseUnitExtraSettingsObject();
  dpsBaseUnitList().forEach(unit=>{
    const primary=dpsBaseUnitStoreInput('jewel',unit);
    if(dpsBaseUnitJewelOwnerKey(unit.id)!==ownerKey && normalizeDpsJewelName(primary?.value || '')===name) primary.value='';
    const items=extras[unit.id];
    if(!Array.isArray(items)) return;
    items.forEach((item,index)=>{
      if(dpsBaseUnitJewelOwnerKey(unit.id,index)!==ownerKey && normalizeDpsJewelName(item.legendaryMythicJewel)===name) item.legendaryMythicJewel='';
    });
  });
  setDpsBaseUnitExtraSettings(extras);
}
function dpsBaseUnitJewelOptionsHtml(selectedName,ownerKey,options={}){
  const usage=dpsLegendaryJewelActiveUsage();
  const excluded=new Set(Array.isArray(options.excludeNames) ? options.excludeNames.map(name=>normalizeDpsJewelName(name)).filter(Boolean) : []);
  const names=activeDpsJewelNames().filter(name=>{
    if(excluded.has(name) && name!==selectedName) return false;
    const owner=usage.get(name);
    return !owner || owner===ownerKey || name===selectedName;
  });
  const settings=dpsJewelSettingsObject();
  return `<option value="">없음</option>${names.map(name=>{
    const grade=dpsJewelFinalStats(name,settings).mythic==='Y' ? '신화' : '전설';
    return `<option value="${escapeHtml(name)}"${name===selectedName?' selected':''}>${escapeHtml(`${grade} ${name}`)}</option>`;
  }).join('')}`;
}
function dpsBaseUnitAdditionalSettingsHtml(unit){
  if(!dpsBaseUnitAllowsSlotExpansion(unit) || !dpsBaseUnitSlotExpanded(unit)) return '';
  const values=dpsBaseUnitExtraSlotSettings(unit).slice(0,dpsBaseUnitActiveExtraJewelCount(unit));
  const allowLimitBreak=dpsBaseUnitCanUseLimitBreak(unit);
  const fields=values.map((setting,index)=>{
    const unitNumber=index+2;
    const limitOptions=allowLimitBreak
      ? Array.from({length:7},(_,value)=>`<option value="${value}"${value===setting.limitBreak?' selected':''}>${value}</option>`).join('')
      : '<option value="0" selected>사용 불가</option>';
    const ownerKey=dpsBaseUnitJewelOwnerKey(unit.id,index);
    const jewelOptions=dpsBaseUnitJewelOptionsHtml(setting.legendaryMythicJewel,ownerKey);
    return `<div class="dps-base-unit-extra-slot"><span class="dps-base-unit-extra-slot-title">${unitNumber}기</span><label class="${allowLimitBreak?'':'is-disabled'}"><span>한계 돌파</span><select data-dps-base-unit-extra-limit-break="${escapeHtml(unit.id)}" data-dps-base-unit-extra-index="${index}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} ${unitNumber}기 한계 돌파${allowLimitBreak?'':' 사용 불가'}"${allowLimitBreak?'':' disabled'}>${limitOptions}</select></label><label><span>전설·신화 쥬얼</span><select data-dps-base-unit-extra-jewel="${escapeHtml(unit.id)}" data-dps-base-unit-extra-index="${index}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} ${unitNumber}기 전설·신화 쥬얼">${jewelOptions}</select></label></div>`;
  }).join('');
  return `<section class="dps-base-unit-extra-settings" data-dps-base-unit-extra-settings="${escapeHtml(unit.id)}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} 추가 유닛 쥬얼 및 한계 돌파 설정"><div class="dps-base-unit-extra-grid">${fields}</div></section>`;
}
function applyDpsBaseUnitJewelAssignment(jewelName,ownerKey,writeAssignment){
  const next=normalizeDpsJewelName(jewelName);
  if(next) clearDpsJewelFromOtherAssignments(next,ownerKey);
  if(typeof writeAssignment==='function') writeAssignment(next);
  sanitizeDpsJewelSelections();
  syncDpsBaseUnitControl();
  return next;
}
function updateDpsBaseUnitExtraSetting(select){
  const unitId=String(select?.getAttribute?.('data-dps-base-unit-extra-limit-break') || select?.getAttribute?.('data-dps-base-unit-extra-jewel') || '');
  const index=Math.max(0,Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT-1,Math.round(Number(select?.getAttribute?.('data-dps-base-unit-extra-index'))||0)));
  const unit=dpsBaseUnitById(unitId);
  if(!dpsBaseUnitAllowsSlotExpansion(unit)) return;
  const settings=dpsBaseUnitExtraSettingsObject();
  const items=Array.from({length:DPS_BASE_UNIT_EXTRA_SLOT_COUNT},(_,slotIndex)=>normalizeDpsBaseUnitExtraSlotSetting(settings[unitId]?.[slotIndex],unit));
  if(select.hasAttribute('data-dps-base-unit-extra-limit-break')){
    items[index].limitBreak=dpsBaseUnitCanUseLimitBreak(unit) ? Number(normalizeDpsBaseUnitLimitBreakValue(select.value))||0 : 0;
    settings[unitId]=items;
    setDpsBaseUnitExtraSettings(settings);
    syncDpsBaseUnitControl();
    return;
  }
  applyDpsBaseUnitJewelAssignment(select.value,dpsBaseUnitJewelOwnerKey(unitId,index),next=>{
    items[index].legendaryMythicJewel=next;
    settings[unitId]=items;
    setDpsBaseUnitExtraSettings(settings);
  });
}
function updateDpsBaseUnitJewelAssignment(select){
  const unitId=String(select?.getAttribute?.('data-dps-base-unit-slot-jewel') || '');
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return;
  applyDpsBaseUnitJewelAssignment(select.value,dpsBaseUnitJewelOwnerKey(unitId),next=>{
    const store=dpsBaseUnitStoreInput('jewel',unit);
    if(store) store.value=next;
  });
}
// 사용자가 먼저 선택한 확정 나루드 슬롯만 선행 조건으로 인정한다.
/* 08-B · 공허의 힘·나루드 제약 */
function dpsBaseUnitNarudReady(){
  const index=currentDpsBaseUnitSlots().indexOf('prodNarud');
  return index>=0 && dpsUnitSlotPending?.index!==index;
}
function dpsBaseUnitVoidPowerCost(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit)) return 0;
  return dpsBaseUnitHasQuantity(unit) ? Math.max(0,Number(dpsBaseUnitQuantityText(unit))||0) : 1;
}
function dpsBaseUnitVoidPowerUsage(excludedUnitId=''){
  const excluded=String(excludedUnitId || '');
  return currentDpsBaseUnitSlots().filter(Boolean).reduce((sum,unitId)=>{
    if(unitId===excluded || unitId==='prodNarud') return sum;
    const unit=dpsBaseUnitById(unitId);
    if(!dpsBaseUnitSupportsAdvancedOptions(unit)) return sum;
    const input=dpsBaseUnitStoreInput('voidPower',unit);
    return normalizeDpsBaseUnitVoidPowerValue(input?.value)==='ON' ? sum+dpsBaseUnitVoidPowerCost(unit) : sum;
  },0);
}
function enforceDpsBaseUnitVoidPowerQuantity(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  const input=dpsBaseUnitStoreInput('voidPower',unit);
  if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit) || normalizeDpsBaseUnitVoidPowerValue(input?.value)!=='ON') return false;
  if(dpsBaseUnitNarudReady() && unit.id!=='prodNarud' && dpsBaseUnitVoidPowerUsage(unit.id)+dpsBaseUnitVoidPowerCost(unit)<=dpsBaseUnitVoidPowerLimit()) return false;
  input.value='OFF';
  return true;
}
function sanitizeDpsBaseUnitVoidPowerAvailability(){
  const limit=dpsBaseUnitVoidPowerLimit();
  const narudReady=dpsBaseUnitNarudReady();
  let used=0;
  currentDpsBaseUnitSlots().filter(Boolean).forEach(unitId=>{
    const unit=dpsBaseUnitById(unitId);
    const input=dpsBaseUnitStoreInput('voidPower',unit);
    if(!dpsBaseUnitSupportsAdvancedOptions(unit) || !input || normalizeDpsBaseUnitVoidPowerValue(input.value)!=='ON') return;
    const cost=dpsBaseUnitVoidPowerCost(unit);
    if(!narudReady || unitId==='prodNarud' || used+cost>limit) input.value='OFF';
    else used+=cost;
  });
}

// 유닛 카드는 결과와 적용 설정을, 모달은 입력과 자동 계산 결과를 구분한다.
/* 08-C · 유닛 슬롯·확장 설정 UI */
function dpsBaseUnitCompactFieldsHtml(unit,slotIndex,readOnly=false){
  const result=unit ? dpsBaseUnitResultDisplayMap.get(String(unit.id || '')) || null : null;
  const attack=result ? dpsBaseUnitAttackText(result) : '—';
  const pierce=result ? dpsBaseUnitPercentText(result.effectivePierce) : (unit && dpsBaseUnitIsArtifact(unit) ? '0%' : '—');
  const dps=result ? dpsBaseUnitDpsText(result) : '—';
  const speed=dpsBaseUnitSpeedDisplay(unit,result);
  const unitId=unit ? escapeHtml(unit.id) : '';
  const label=unit ? escapeHtml(dpsBaseUnitLabel(unit)) : '미설정';
  const enhance=unit ? normalizeDpsBaseUnitEnhanceValue(dpsBaseUnitStoreInput('enhance',unit)?.value,0) : '—';
  const canUseEnhance=!!unit && dpsBaseUnitCanUseEnhance(unit);
  const canUseLimitBreak=!!unit && dpsBaseUnitCanUseLimitBreak(unit);
  const advanced=!!unit && dpsBaseUnitSupportsAdvancedOptions(unit);
  const limitBreak=canUseLimitBreak ? normalizeDpsBaseUnitLimitBreakValue(dpsBaseUnitStoreInput('limitBreak',unit)?.value) : '0';
  const jewelName=advanced ? normalizeDpsJewelName(dpsBaseUnitStoreInput('jewel',unit)?.value) : '';
  const voidPower=advanced && unit.id!=='prodNarud' ? normalizeDpsBaseUnitVoidPowerValue(dpsBaseUnitStoreInput('voidPower',unit)?.value) : 'OFF';
  const voidUsage=dpsBaseUnitVoidPowerUsage();
  const voidLimit=dpsBaseUnitVoidPowerLimit();
  const voidCanEnable=advanced && unit.id!=='prodNarud' && dpsBaseUnitNarudReady() && (voidPower==='ON' || voidUsage+dpsBaseUnitVoidPowerCost(unit)<=voidLimit);
  const metric=(title,value,extraClass='')=>`<div class="ub-metric ${extraClass}"><span>${escapeHtml(title)}</span><b>${escapeHtml(String(value))}</b></div>`;
  const dpsLabel=unit && dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS';
  const resultMetric=(title,value)=>`<div class="ub-result-metric"><span>${escapeHtml(title)}</span><b>${escapeHtml(value)}</b></div>`;
  const dpsSummary=readOnly
    ? `<div class="ub-dps"><span>${dpsLabel}</span><b>${escapeHtml(dps)}</b></div>`
    : `<div class="ub-dps ub-result-summary">${resultMetric(dpsLabel,dps)}${resultMetric('등급',unit?(unit.grade || '유닛'):'—')}</div>`;
  const automatic=`${dpsSummary}<div class="ub-metrics">${metric('공격력',attack)}${metric(speed.label,speed.value,speed.maximum?'is-max-speed':'')}${metric('방어력 관통',pierce)}</div>`;
  if(readOnly){
    const setting=(title,value,wide=false)=>`<div class="ub-setting${wide?' ub-wide':''}"><span>${escapeHtml(title)}</span><b>${escapeHtml(String(value))}</b></div>`;
    return `<div class="ub-card-data"><div class="ub-auto-label"><span class="ub-status-dot" aria-hidden="true"></span>자동 계산</div>${automatic}<div class="ub-applied"><span class="ub-section-label">적용 설정</span><div class="ub-settings-list">${setting('강화 기대값',canUseEnhance?enhance:'0')}${setting('마리수',dpsBaseUnitQuantityText(unit))}${setting('한계 돌파',canUseLimitBreak?limitBreak:'사용 불가')}${setting('공허의 힘',advanced && unit.id!=='prodNarud' ? (voidPower==='ON'?'ON':'OFF'):'사용 불가')}${setting('전설·신화 쥬얼',advanced?(jewelName||'없음'):'사용 불가',true)}</div></div></div>`;
  }
  const emptyOption=unit ? '사용 불가' : '유닛 선택 후 사용';
  const limitOptions=canUseLimitBreak
    ? Array.from({length:7},(_,value)=>`<option value="${value}"${String(value)===limitBreak?' selected':''}>${value}</option>`).join('')
    : `<option value="0" selected>${emptyOption}</option>`;
  const jewelOptions=advanced ? dpsBaseUnitJewelOptionsHtml(jewelName,dpsBaseUnitJewelOwnerKey(unit.id)) : `<option value="" selected>${emptyOption}</option>`;
  const enhanceControl=`<input class="dps-base-unit-setting-input" ${unit?`id="dpsBaseUnitSlotEnhance${slotIndex+1}" data-dps-base-unit-slot-enhance="${unitId}"`:''} type="text" inputmode="decimal" min="0" max="1000" value="${unit?escapeHtml(String(canUseEnhance?enhance:0)):''}" aria-label="${label} 강화 기대값"${canUseEnhance?'':' disabled'}/>`;
  const limitControl=`<select class="dps-base-unit-setting-select" ${unit?`id="dpsBaseUnitSlotLimitBreak${slotIndex+1}" data-dps-base-unit-slot-limit-break="${unitId}"`:''} aria-label="${label} 한계 돌파"${canUseLimitBreak?'':' disabled'}>${limitOptions}</select>`;
  const jewelControl=`<select class="dps-base-unit-setting-select" ${unit?`id="dpsBaseUnitSlotJewel${slotIndex+1}" data-dps-base-unit-slot-jewel="${unitId}"`:''} aria-label="${label} 전설·신화 쥬얼"${advanced?'':' disabled'}>${jewelOptions}</select>`;
  const quantityControl=`<div class="dps-base-unit-board-cell dps-base-unit-board-quantity">${dpsBaseUnitQuantityControlHtml(unit,slotIndex)}</div>`;
  const voidControl=`<button class="ui-choice-btn dps-base-unit-void-power-control${voidPower==='ON'?' is-active':''}" type="button" ${unit?`id="dpsBaseUnitSlotVoidPower${slotIndex+1}" data-dps-base-unit-void-power-toggle="${unitId}"`:''} aria-pressed="${voidPower==='ON'}" aria-label="${label} 공허의 힘 ${voidUsage} / ${voidLimit}"${voidCanEnable?'':' disabled'}><span>${voidPower==='ON'?'ON':'OFF'}</span><small>사용 ${voidUsage} / ${voidLimit}</small></button>`;
  const field=(title,control,wide=false)=>dpsBaseUnitFieldHtml(title,`ub-editor-field${wide?' ub-wide':''}`,control);
  return `<div class="ub-editor-layout"><div class="ub-editor-sections"><section class="ub-edit-section"><h3><span>01</span>기본 설정</h3><div class="ub-fields">${field('마리수',quantityControl)}${field('강화 기대값',enhanceControl)}</div></section><section class="ub-edit-section"><h3><span>02</span>추가 옵션</h3><div class="ub-fields">${field('한계 돌파',limitControl)}${field('공허의 힘',voidControl)}${field('전설·신화 쥬얼',jewelControl,true)}</div></section></div><section class="ub-live-result" aria-label="자동 계산 결과"><div class="ub-auto-label"><span class="ub-status-dot" aria-hidden="true"></span>자동 계산 결과</div>${automatic}<p>현재 빌드와 유닛 설정을 반영한 수치입니다.</p></section></div>`;

}
function dpsBaseUnitSlotExpansionButtonHtml(unit){
  if(!unit || !dpsBaseUnitAllowsSlotExpansion(unit)) return '';
  const available=dpsBaseUnitSlotExpansionAvailable(unit);
  const expanded=dpsBaseUnitSlotExpanded(unit);
  const reason=dpsBaseUnitHasQuantity(unit)?'수량 2마리 이상 필요':'수량 1마리 제한';
  const label=escapeHtml(dpsBaseUnitLabel(unit));
  return `<button class="ui-choice-btn dps-base-unit-option-btn dps-base-unit-slot-expansion-btn${expanded?' is-active':''}" data-dps-base-unit-slot-expansion-toggle="${escapeHtml(unit.id)}" type="button" aria-pressed="${expanded}" aria-expanded="${expanded}" aria-controls="dpsUnitAdditionalSettings" aria-label="${label} 슬롯 확장${available?'':` 불가, ${reason}`}"${available?'':' disabled'}>슬롯 확장 <span aria-hidden="true">${expanded?'ON':'OFF'}</span></button>`;
}
function dpsBaseUnitSettingsHtml(unit,slotIndex){
  const button=dpsBaseUnitSlotExpansionButtonHtml(unit);
  const expanded=!!unit && dpsBaseUnitSlotExpanded(unit);
  const expansion=button ? `<section class="ub-expansion-section" aria-label="추가 유닛 설정"><div class="ub-expansion-head"><div><h4>추가 유닛 설정</h4><p>${dpsBaseUnitSlotExpansionAvailable(unit)?'각 유닛의 쥬얼과 한계 돌파를 따로 설정합니다.':'마리수를 2 이상으로 설정하면 슬롯을 확장할 수 있습니다.'}</p></div>${button}</div><div id="dpsUnitAdditionalSettings"${expanded?'':' hidden'}>${dpsBaseUnitAdditionalSettingsHtml(unit)}</div></section>` : '';
  return dpsBaseUnitCompactFieldsHtml(unit,slotIndex)+expansion+(unit?'':'<p class="unit-slot-empty-guidance">위에서 유닛을 선택하면 모든 설정을 바로 사용할 수 있습니다.</p>');
}

function dpsBaseUnitSelectOptionsHtml(selectedId, selectedIds){
  const selectedSet=new Set(selectedIds.filter(Boolean));
  const planetRestricted=planetExplorationRestrictionsActive();
  const groups=new Map();
  sortedDpsBaseUnits().forEach(unit=>{
    // 행성탐사에서 사용할 수 없는 유닛은 선택 목록에 넣지 않는다.
    if(planetRestricted && !dpsBaseUnitAllowedForCurrentPlanet(unit)) return;
    const grade=unit.grade || '기타';
    if(!groups.has(grade)) groups.set(grade,[]);
    groups.get(grade).push(unit);
  });
  const groupHtml=[...groups.entries()].map(([grade,units])=>{
    const options=units.map(unit=>{
      const selected=unit.id===selectedId;
      const disabled=!selected && selectedSet.has(unit.id);
      const race=unit.raceGroup==='프바' ? '토바' : unit.raceGroup==='프메' ? '토메' : (unit.raceGroup || '');
      const label=race ? `[${race}] ${dpsBaseUnitDisplayLabel(unit)}` : dpsBaseUnitDisplayLabel(unit);
      return `<option value="${escapeHtml(unit.id)}"${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    return `<optgroup label="${escapeHtml(grade)}">${options}</optgroup>`;
  }).join('');
  return `<option value="">선택 안 함</option>${groupHtml}`;
}
function dpsBaseUnitFieldHtml(fieldLabel, fieldClass, content){
  return `<div class="dps-base-unit-field ${fieldClass}"><span class="dps-base-unit-field-label">${fieldLabel}</span>${content}</div>`;
}
function dpsBaseUnitSlotHtml(unitId, slotIndex, slots){
  const unit=dpsBaseUnitById(unitId);
  const selectControl=`<div class="dps-base-unit-select-wrap"><select class="dps-base-unit-select" id="dpsBaseUnitSlot${slotIndex+1}" data-dps-base-unit-slot="${slotIndex}" aria-label="슬롯 ${slotIndex+1} 유닛 선택">${dpsBaseUnitSelectOptionsHtml(unitId,slots)}</select></div>`;
  return `<article class="dps-base-unit-card right-unit-slot-card${unit?'':' is-empty'}" aria-label="유닛 슬롯 ${slotIndex+1}"><div class="dps-base-unit-entry ub-unit-picker" data-dps-base-unit-slot-row="${slotIndex}"><div class="ub-picker-heading"><span>유닛명</span></div>${selectControl}</div><div class="right-unit-slot-settings">${dpsBaseUnitSettingsHtml(unit,slotIndex)}</div></article>`;
}

let dpsUnitSelectedSlot=0;
let dpsUnitDetailOpen=false;
let dpsUnitSlotPending=null;
let dpsUnitSlotDraft=null;
function beginDpsUnitSlotDraft(){
  if(dpsUnitSlotDraft) return;
  ensureDpsBaseUnitStore();
  // 쥬얼 재배정, 공허의 힘에 따른 자동 유닛 추가까지 함께 취소한다.
  dpsUnitSlotDraft={
    fields:new Map([...USER_STATE_VALUE_IDS].map(id=>[id,$(id)?.value]).filter(([,value])=>value!==undefined)),
    checked:new Map([...USER_STATE_VALUE_IDS].map(id=>$(id)).filter(field=>field?.type==='checkbox').map(field=>[field.id,field.checked])),
    expandedCardIds:[...dpsUnitExpandedCardIds]
  };
  if(typeof cancelScheduledAutoSave==='function') cancelScheduledAutoSave();
}
function discardDpsUnitSlotDraft(){
  const draft=dpsUnitSlotDraft;
  if(!draft) return;
  if(typeof cancelScheduledAutoSave==='function') cancelScheduledAutoSave();
  draft.fields.forEach((value,id)=>{ const field=$(id); if(field) field.value=value; });
  draft.checked.forEach((checked,id)=>{ const field=$(id); if(field) field.checked=checked; });
  dpsUnitExpandedCardIds.clear();
  draft.expandedCardIds.forEach(id=>dpsUnitExpandedCardIds.add(id));
  dpsUnitSlotDraft=null;
}
function beginDpsUnitSlotAddition(index,initialUnitId=''){
  beginDpsUnitSlotDraft();
  dpsUnitSlotPending={index,previousSelectedSlot:dpsUnitSelectedSlot};
  dpsUnitSelectedSlot=index;
  dpsUnitDetailOpen=true;
  if(initialUnitId) changeDpsBaseUnitSlot(index,initialUnitId,{notify:false});
  else syncDpsBaseUnitControl({skipJewelConfig:true});
  // 비표시 원본 select 대신 화면에 생성된 실제 선택 버튼으로 포커스를 이동한다.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!dpsUnitDetailOpen || dpsUnitSlotPending?.index!==index) return;
    const button=$('dpsBaseUnitSlot'+(index+1))?.nextElementSibling;
    (button?.matches('.app-select-trigger') ? button : $('unitSlotModalClose'))?.focus({preventScroll:true});
  }));
}
function restorePendingDpsUnitSlot(){
  const pending=dpsUnitSlotPending;
  if(!pending) return;
  dpsUnitSlotPending=null;
  discardDpsUnitSlotDraft();
  dpsUnitSelectedSlot=pending.previousSelectedSlot;
}
function confirmDpsUnitSlotModal(){
  if(!dpsUnitDetailOpen) return;
  const index=dpsUnitSelectedSlot;
  // 유닛 미선택 상태는 슬롯 생성 확정으로 취급하지 않는다.
  if(dpsUnitSlotPending && !dpsBaseUnitById(currentDpsBaseUnitSlots()[index])) return;
  // 완료만 초안을 확정한다. 취소용 닫기 함수와 경로를 분리한다.
  dpsUnitSlotPending=null;
  dpsUnitSlotDraft=null;
  dpsUnitDetailOpen=false;
  syncDpsBaseUnitControl({skipJewelConfig:true});
  commitAppUpdate({recalculate:'now'});
  $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-list-select="${index}"]`)?.focus({preventScroll:true});
}
// 기존 유닛 배치값은 항상 10칸으로 보존하고, 화면에 표시할 슬롯 수만 따로 관리합니다.
function dpsUnitVisibleCount(slots){
  const input=$('dpsBaseUnitVisibleSlotCount');
  // 추가 중인 임시 슬롯은 확정 전까지 세지 않는다. 실제 선택된 유닛만 카드로 표시한다.
  const visible=slots.reduce((count,id,index)=>count+(id && index!==dpsUnitSlotPending?.index ? 1 : 0),0);
  if(input && input.value!==String(visible)) input.value=String(visible);
  return visible;
}
const dpsUnitExpandedCardIds=new Set();
function dpsUnitExpandedSettingsHtml(unit){
  if(!unit || !dpsBaseUnitSlotExpanded(unit)) return '';
  const opened=dpsUnitExpandedCardIds.has(unit.id);
  const extras=dpsBaseUnitExtraSlotSettings(unit).slice(0,dpsBaseUnitActiveExtraJewelCount(unit));
  const jewelSettings=dpsJewelSettingsObject();
  const rows=opened ? extras.map((setting,index)=>{
    const jewelName=setting.legendaryMythicJewel || '';
    const jewel=jewelName ? `${dpsJewelFinalStats(jewelName,jewelSettings).mythic==='Y'?'신화':'전설'} ${jewelName}` : '없음';
    return `<div class="ub-extra-card" role="listitem"><span class="ub-extra-number">${index+2}기</span><div class="ub-extra-jewel"><small>쥬얼</small><b>${escapeHtml(jewel)}</b></div><div class="ub-extra-break"><small>한계 돌파</small><b>${escapeHtml(String(setting.limitBreak ?? 0))}</b></div></div>`;
  }).join('') : '';
  const lastUnit=extras.length+1;
  const listId=`unit-expanded-settings-${escapeHtml(unit.id)}`;
  return `<div class="unit-slot-expansion"><button type="button" class="unit-slot-expansion-toggle" data-unit-slot-expansion-toggle="${escapeHtml(unit.id)}" aria-expanded="${opened}" aria-controls="${listId}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} 2~${lastUnit}기 설정 ${opened?'접기':'펼치기'}"><span class="ub-extra-heading">추가 유닛 <b>${extras.length}</b></span><span class="ub-extra-chevron" aria-hidden="true">${opened?'⌃':'⌄'}</span></button><div class="unit-slot-expansion-rows" id="${listId}" role="list" aria-label="추가 유닛별 설정"${opened?'':' hidden'}>${rows}</div></div>`;
}

function dpsBaseUnitSlotsHtml(slots){
  dpsUnitSelectedSlot=Math.max(0,Math.min(slots.length-1,dpsUnitSelectedSlot));
  const visibleCount=dpsUnitVisibleCount(slots);
  const basicRows=[];
  const jewelSettings=dpsJewelSettingsObject();
  const rows=slots.slice(0,visibleCount).map((unitId,index)=>{
    const unit=dpsBaseUnitById(unitId);
    const unitName=dpsBaseUnitDisplayLabel(unit);
    const quantity=unit ? (dpsBaseUnitHasQuantity(unit) ? dpsBaseUnitQuantityText(unit) : '1') : '—';
    if(unit){
      const advanced=dpsBaseUnitSupportsAdvancedOptions(unit);
      const limitBreak=advanced ? normalizeDpsBaseUnitLimitBreakValue(dpsBaseUnitStoreInput('limitBreak',unit)?.value) : '사용 불가';
      const jewelName=advanced ? dpsBaseUnitJewelName(unit) : '';
      const jewel=advanced ? (jewelName ? `${dpsJewelFinalStats(jewelName,jewelSettings).mythic==='Y'?'신화':'전설'} ${jewelName}` : '없음') : '사용 불가';
      basicRows.push(`<tr><th scope="row">${String(index+1).padStart(2,'0')}</th><td>${escapeHtml(unitName)}</td><td>${escapeHtml(quantity)}</td><td>${escapeHtml(limitBreak)}</td><td>${escapeHtml(jewel)}</td></tr>`);
    }
    const grade=String(unit.grade || '유닛');
    const race=String(unit.raceGroup || '').trim();
    const selected=index===dpsUnitSelectedSlot && dpsUnitDetailOpen;
    return `<article class="unit-slot-overview-card${selected?' is-selected':''}" aria-label="${index+1}번 유닛 슬롯">
      <div class="unit-slot-card-head"><div class="unit-slot-heading"><span class="unit-slot-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="ub-card-title"><span class="unit-slot-grade">${escapeHtml(grade)}</span>${race ? `<span class="unit-slot-grade">${escapeHtml(race)}</span>` : ''}<strong>${escapeHtml(unitName)}</strong></span></div><div class="unit-slot-card-actions"><button type="button" class="unit-list-remove" data-unit-list-remove="${index}" aria-label="${index+1}번 슬롯 삭제">×</button></div></div>
      <button type="button" class="unit-slot-card-main" data-unit-list-select="${index}" aria-label="${index+1}번 슬롯 상세 설정 열기" aria-haspopup="dialog" aria-expanded="${selected}" aria-controls="dpsUnitSlotModal">
        ${dpsBaseUnitCompactFieldsHtml(unit,index,true)}
        
      </button>
      ${dpsUnitExpandedSettingsHtml(unit)}</article>`;
  }).join('');
  const basicInfo=`<div class="unit-basic-summary"><table aria-label="설정된 유닛 기본정보"><colgroup><col class="unit-basic-number"><col class="unit-basic-name"><col class="unit-basic-quantity"><col class="unit-basic-limit-break"><col class="unit-basic-jewel"></colgroup><thead><tr><th scope="col">슬롯 번호</th><th scope="col">유닛명</th><th scope="col">마리수</th><th scope="col">한계 돌파</th><th scope="col">전설·신화 쥬얼</th></tr></thead><tbody>${basicRows.join('') || '<tr><td colspan="5" class="unit-basic-empty">유닛을 설정하면 기본정보가 표시됩니다.</td></tr>'}</tbody></table></div>`;
  const next=visibleCount<slots.length
    ? `<button class="unit-slot-add-card" type="button" data-unit-slot-add="${visibleCount}" aria-label="${visibleCount+1}번 유닛 슬롯 추가"><span class="unit-slot-add-symbol" aria-hidden="true">+</span><strong>유닛 추가</strong><small>${visibleCount+1}번 슬롯 · 최대 10개</small></button>` : '';
  return `<section class="unit-list-collection" aria-label="유닛 슬롯 관리"><header class="ub-collection-head"><h3>유닛 구성 <span>${visibleCount} / 10</span></h3><small>카드를 눌러 상세 설정</small></header>${basicInfo}<div class="unit-slot-cards-grid" aria-label="유닛 슬롯 카드 목록">${rows}${next}</div></section>`;
}

// 성소 정보: 버스 성소의 스킬 목록을 그대로 사용하며 유닛 보드·프리셋에서 같은 상태를 공유한다.
const DPS_SANCTUARY_SKILLS=Object.freeze(SANCTUARY_SKILL_DAMAGE_DATA.map(skill=>skill[0]));
const DPS_SANCTUARY_BLANK_SLOT=()=>({start:0,end:0,skill1:'',count1:0,skill2:'',count2:0});
/* 08-D · 성소 스킬·횟수·입력 상태 */
function normalizeDpsSanctuaryInfo(value){
  let source=value;
  if(typeof source==='string'){
    try{source=JSON.parse(source);}catch{source=null;}
  }
  if(!source || typeof source!=='object' || Array.isArray(source)) source={};
  const incoming=Array.isArray(source.slots) ? source.slots.slice(0,10) : [];
  const clamp=(value,max)=>Math.max(0,Math.min(max,Math.round(Number(value)||0)));
  const slots=incoming.map(raw=>{
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) raw={};
    const slot=DPS_SANCTUARY_BLANK_SLOT();
    slot.start=clamp(raw.start,300);
    slot.end=clamp(raw.end,300);
    slot.skill1=DPS_SANCTUARY_SKILLS.includes(raw.skill1) ? raw.skill1 : '';
    slot.count1=slot.skill1 ? Math.max(1,clamp(raw.count1,4)) : 0;
    // 두 스킬은 독립적으로 선택하되, 선택된 스킬은 반드시 1회 이상 사용한다.
    slot.skill2=DPS_SANCTUARY_SKILLS.includes(raw.skill2) ? raw.skill2 : '';
    slot.count2=slot.skill2 ? Math.max(1,clamp(raw.count2,4)) : 0;
    if(slot.count1+slot.count2>4){
      slot.count1=Math.min(slot.count1,slot.skill2 ? 3 : 4);
      slot.count2=4-slot.count1;
    }
    return slot;
  });
  return {slots};
}
function currentDpsSanctuaryInfo(){return normalizeDpsSanctuaryInfo($('dpsSanctuaryInfo')?.value || '');}
function dpsSanctuaryRoundLimit(){
  return isTowerDifficulty() ? 90 : isPlanetExplorationDifficulty() ? 100 : 300;
}
function dpsSanctuaryRangeLabels(){
  return (isTowerDifficulty() || isPlanetExplorationDifficulty())
    ? ['시작 층','종료 층'] : ['시작 라운드','종료 라운드'];
}
function dpsSanctuaryValidRows(info=currentDpsSanctuaryInfo()){
  const maximum=dpsSanctuaryRoundLimit();
  return normalizeDpsSanctuaryInfo(info).slots.flatMap((slot,index)=>{
    if(!(slot.start>0 && slot.end>=slot.start && slot.end<=maximum &&
      ((slot.skill1 && slot.count1>=1) || (slot.skill2 && slot.count2>=1)))) return [];
    return [{number:String(index+1).padStart(2,'0'),...slot,
      skill1:slot.skill1 && slot.count1>0 ? slot.skill1 : '',
      count1:slot.skill1 && slot.count1>0 ? slot.count1 : 0,
      skill2:slot.skill2 && slot.count2>0 ? slot.skill2 : '',
      count2:slot.skill2 && slot.count2>0 ? slot.count2 : 0}];
  });
}
function renderDpsSanctuarySummary(info=currentDpsSanctuaryInfo()){
  const summary=$('unitSanctuarySummary');
  if(!summary) return;
  const [startLabel,endLabel]=dpsSanctuaryRangeLabels();
  // 슬롯의 입력 상태를 그대로 보여준다. 기록 복사에 적용되는 유효성 판정과는 별개다.
  const rows=info.slots.flatMap((slot,index)=>{
    if(!(slot.start || slot.end || slot.skill1 || slot.skill2 || slot.count1 || slot.count2)) return [];
    return [`<tr><th scope="row">${String(index+1).padStart(2,'0')}</th>`+
      `<td>${slot.start}</td><td>${slot.end}</td>`+
      `<td>${slot.skill1 ? `${slot.skill1} ${slot.count1}회` : '선택 안함'}</td>`+
      `<td>${slot.skill2 ? `${slot.skill2} ${slot.count2}회` : '선택 안함'}</td></tr>`];
  });
  summary.innerHTML=`<table aria-label="설정된 성소 정보 기본정보"><thead><tr>`+
    `<th scope="col">슬롯 번호</th><th scope="col">${startLabel}</th><th scope="col">${endLabel}</th>`+
    `<th scope="col">1번 스킬 / 사용 횟수</th><th scope="col">2번 스킬 / 사용 횟수</th>`+
    `</tr></thead><tbody>${rows.join('')||'<tr><td colspan="5" class="unit-basic-empty">선택한 정보가 없습니다</td></tr>'}</tbody></table>`;
}
function renderDpsSanctuaryInfo(){
  const rows=$('unitSanctuaryRows');
  if(!rows) return;
  const info=currentDpsSanctuaryInfo();
  const maximum=dpsSanctuaryRoundLimit();
  const [startLabel,endLabel]=dpsSanctuaryRangeLabels();
  renderDpsSanctuarySummary(info);
  const options=selected=>`<option value="">선택 안함</option>${DPS_SANCTUARY_SKILLS.map(name=>`<option value="${name}"${name===selected?' selected':''}>${name}</option>`).join('')}`;
  const counts=(selected,max,hasSkill)=>{
    const first=hasSkill ? 1 : 0;
    const last=hasSkill ? max : 0;
    return Array.from({length:last-first+1},(_,i)=>{
      const n=first+i;
      return `<option value="${n}"${n===selected?' selected':''}>${n}회</option>`;
    }).join('');
  };
  const field=(index,name)=>`data-sanctuary-index="${index}" data-sanctuary-field="${name}"`;
  const box=(label,control)=>`<label class="unit-sanctuary-field"><span>${label}</span>${control}</label>`;
  rows.innerHTML=info.slots.map((slot,index)=>{
    const invalid=slot.start>0 && slot.end>0 && (slot.start>slot.end || slot.end>maximum);
    return `<article class="unit-sanctuary-card${invalid?' is-invalid':''}" aria-label="${index+1}번 성소 슬롯">`+
      `<header class="unit-sanctuary-card-head"><span class="unit-slot-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><strong>슬롯</strong><button type="button" class="unit-list-remove" data-sanctuary-remove="${index}" aria-label="${index+1}번 성소 슬롯 삭제">×</button></header>`+
      `<div class="unit-sanctuary-fields">`+
      box(startLabel,`<input aria-label="${index+1}번 ${startLabel}" type="number" min="0" max="${maximum}" inputmode="numeric" value="${slot.start}" ${field(index,'start')}>`)+
      box('1번 스킬',`<select aria-label="${index+1}번 1번 스킬" ${field(index,'skill1')}>${options(slot.skill1)}</select>`)+
      box('1번 사용 횟수',`<select aria-label="${index+1}번 1번 사용 횟수" ${field(index,'count1')}>${counts(slot.count1,4-slot.count2,!!slot.skill1)}</select>`)+
      box(endLabel,`<input aria-label="${index+1}번 ${endLabel}" type="number" min="0" max="${maximum}" inputmode="numeric" value="${slot.end}" ${field(index,'end')}>`)+
      box('2번 스킬',`<select aria-label="${index+1}번 2번 스킬" ${field(index,'skill2')}>${options(slot.skill2)}</select>`)+
      box('2번 사용 횟수',`<select aria-label="${index+1}번 2번 사용 횟수" ${field(index,'count2')}>${counts(slot.count2,4-slot.count1,!!slot.skill2)}</select>`)+
      `</div></article>`;
  }).join('');
  const counter=$('unitSanctuaryCount');
  if(counter) counter.textContent=`${info.slots.length} / 10`;
  const add=$('unitSanctuaryAdd');
  if(add){
    add.disabled=info.slots.length>=10;
    const label=add.querySelector('small');
    if(label) label.textContent=info.slots.length<10 ? `${info.slots.length+1}번 슬롯 · 최대 10개` : '최대 10개';
  }
}
function updateDpsSanctuaryField(control,render=true){
  const index=Number(control.dataset.sanctuaryIndex);
  const field=control.dataset.sanctuaryField;
  if(!Number.isInteger(index) || !['start','end','skill1','count1','skill2','count2'].includes(field)) return;
  const info=currentDpsSanctuaryInfo();
  if(!info.slots[index]) return;
  const slot=info.slots[index];
  if(field==='start' || field==='end'){
    slot[field]=Math.max(0,Math.min(dpsSanctuaryRoundLimit(),Math.round(Number(control.value)||0)));
  }else{
    const ownSkill=field.endsWith('1') ? 'skill1' : 'skill2';
    const ownCount=field.endsWith('1') ? 'count1' : 'count2';
    const otherCount=field.endsWith('1') ? 'count2' : 'count1';
    if(field.startsWith('skill')){
      slot[field]=DPS_SANCTUARY_SKILLS.includes(control.value) ? control.value : '';
      slot[ownCount]=slot[field] ? Math.max(1,slot[ownCount]) : 0;
    }else{
      slot[field]=slot[ownSkill] ? Math.max(1,Math.min(4,Math.round(Number(control.value)||1))) : 0;
    }
    // 방금 편집한 스킬·횟수를 우선 유지하며, 다른 스킬과의 총합을 4회로 제한한다.
    if(slot[ownCount]+slot[otherCount]>4) slot[otherCount]=Math.max(1,4-slot[ownCount]);
  }
  const store=$('dpsSanctuaryInfo');
  if(store) store.value=JSON.stringify(normalizeDpsSanctuaryInfo(info));
  renderDpsSanctuarySummary(normalizeDpsSanctuaryInfo(info));
  // 숫자 입력 중 테이블 전체를 재생성하면 다음 칸의 포커스·입력이 소실된다.
  if(control.tagName==='INPUT'){
    if(render) control.value=String(slot[field]);
    const limit=dpsSanctuaryRoundLimit();
    control.closest('.unit-sanctuary-card')?.classList.toggle('is-invalid',slot.start>0 && slot.end>0 && (slot.start>slot.end || slot.end>limit));
  }else if(render) renderDpsSanctuaryInfo();
  scheduleAutoSave();
}
function bindDpsSanctuaryEvents(){
  const guide=$('unitSanctuaryGuideDetails');
  if(guide){
    const trigger=guide.querySelector('summary');
    guide.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(guide.open)));
    document.addEventListener('pointerdown',event=>{
      if(guide.open && !guide.contains(event.target)) guide.open=false;
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape' && guide.open){
        guide.open=false;
        trigger.focus({preventScroll:true});
        event.stopPropagation();
      }
    });
  }
  $('unitSanctuaryAdd')?.addEventListener('click',()=>{
    const info=currentDpsSanctuaryInfo();
    if(info.slots.length>=10) return;
    info.slots.push(DPS_SANCTUARY_BLANK_SLOT());
    $('dpsSanctuaryInfo').value=JSON.stringify(info);
    renderDpsSanctuaryInfo();
    scheduleAutoSave();
  });
  $('unitSanctuaryRows')?.addEventListener('click',event=>{
    const remove=event.target?.closest?.('[data-sanctuary-remove]');
    if(!remove || remove.disabled) return;
    const info=currentDpsSanctuaryInfo();
    const index=Number(remove.dataset.sanctuaryRemove);
    if(!Number.isInteger(index) || index<0 || index>=info.slots.length) return;
    info.slots.splice(index,1);
    $('dpsSanctuaryInfo').value=JSON.stringify(info);
    renderDpsSanctuaryInfo();
    scheduleAutoSave();
  });
  $('unitSanctuaryReset')?.addEventListener('click',()=>{
    const info={slots:[]};
    $('dpsSanctuaryInfo').value=JSON.stringify(info);
    renderDpsSanctuaryInfo();
    scheduleAutoSave();
  });
  $('unitSanctuaryPanel')?.addEventListener('input',event=>{
    if(event.target?.matches?.('input[data-sanctuary-field]')) updateDpsSanctuaryField(event.target,false);
  });
  $('unitSanctuaryPanel')?.addEventListener('change',event=>{
    if(event.target?.matches?.('[data-sanctuary-field]')) updateDpsSanctuaryField(event.target);
  });
}

let dpsUnitSlotModalSyncing=false;
/* 08-F · 유닛 상세 모달·수량·삭제 이벤트 */
function syncDpsUnitSlotModal(slots){
  // 입력 blur/change가 렌더링 도중 다시 호출되어 DOM을 이중 교체하지 않도록 보호
  if(dpsUnitSlotModalSyncing) return;
  dpsUnitSlotModalSyncing=true;
  try{
  const shell=$('dpsUnitSlotModal');
  const panel=$('dpsUnitSlotDetail');
  const title=$('dpsUnitSlotDetailTitle');
  if(!shell || !panel || !title) return;
  shell.hidden=!dpsUnitDetailOpen;
  shell.classList.toggle('is-open',dpsUnitDetailOpen);
  document.body.classList.toggle('unit-slot-modal-open',dpsUnitDetailOpen);
  if(!dpsUnitDetailOpen){
    if(panel.innerHTML) panel.replaceChildren();
    return;
  }
  title.textContent=`슬롯 ${dpsUnitSelectedSlot+1} 상세 설정`;
  const confirmButton=shell.querySelector('[data-unit-detail-confirm]');
  if(confirmButton){
    const missingUnit=!!dpsUnitSlotPending && !dpsBaseUnitById(slots[dpsUnitSelectedSlot]);
    confirmButton.disabled=missingUnit;
  }
  const card=dpsBaseUnitSlotHtml(slots[dpsUnitSelectedSlot],dpsUnitSelectedSlot,slots);
  if(panel.innerHTML!==card){
    const state=captureDpsBaseUnitViewState(panel);
    const scrollArea=shell.querySelector('.unit-slot-modal-scroll');
    const previousScroll=scrollArea?.scrollTop || 0;
    panel.innerHTML=card;
    restoreDpsBaseUnitViewState(panel,state);
    if(scrollArea) scrollArea.scrollTop=previousScroll;
  }
  }finally{ dpsUnitSlotModalSyncing=false; }
}
function closeDpsUnitSlotModal(){
  if(!dpsUnitDetailOpen) return;
  const pendingIndex=dpsUnitSlotPending?.index;
  if(dpsUnitSlotPending) restorePendingDpsUnitSlot();
  else discardDpsUnitSlotDraft();
  dpsUnitDetailOpen=false;
  syncDpsBaseUnitControl({skipJewelConfig:true});
  // 대기 중인 미리보기 계산도 취소하고 복원한 값으로 즉시 다시 계산한다.
  commitAppUpdate({recalculate:'now'});
  if(pendingIndex!==undefined){
    // 닫기/ESC/배경 클릭은 임시 입력을 모두 취소하고, 새 슬롯도 생성하지 않는다.
    requestAppUpdate({save:false});
    $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-slot-add="${pendingIndex}"]`)?.focus({preventScroll:true});
  }else{
    $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-list-select="${dpsUnitSelectedSlot}"]`)?.focus({preventScroll:true});
  }
}
function syncDpsBaseUnitQuantitiesForSelection(selectedIds){
  const selected=new Set(selectedIds || []);
  dpsBaseUnitList().forEach(unit=>{
    if(!dpsBaseUnitHasQuantity(unit)) return;
    const input=dpsBaseUnitStoreInput('quantity',unit);
    if(!input) return;
    const current=normalizeDpsBaseUnitQuantityValue(input.value || 0);
    const next=selected.has(unit.id) ? (Number(current)>0 ? current : '1') : '0';
    if(input.value!==next) input.value=next;
  });
}
function normalizeDpsBaseUnitQuantityInput(input){
  if(!input) return '0';
  const unitId=input.getAttribute?.('data-dps-base-unit-slot-quantity') || '';
  const next=normalizeDpsBaseUnitQuantityValue(input.value || 0);
  if(input.value!==next) input.value=next;
  if(unitId){
    const storeInput=dpsBaseUnitStoreInput('quantity',unitId);
    if(storeInput && storeInput.value!==next) storeInput.value=next;
    enforceDpsBaseUnitVoidPowerQuantity(unitId);
  }
  return next;
}
function normalizeAllDpsBaseUnitQuantityInputs(){
  ensureDpsBaseUnitStore();
  dpsBaseUnitList().forEach(unit=>{
    if(dpsBaseUnitHasQuantity(unit)) normalizeDpsBaseUnitQuantityInput(dpsBaseUnitStoreInput('quantity',unit));
  });
}
function setDpsBaseUnitQuantity(unitId, value){
  const unit=dpsBaseUnitById(unitId);
  if(!unit || !dpsBaseUnitHasQuantity(unit)) return '0';
  const input=dpsBaseUnitStoreInput('quantity',unit);
  if(!input) return '0';
  input.value=normalizeDpsBaseUnitQuantityValue(value);
  enforceDpsBaseUnitVoidPowerQuantity(unit);
  return input.value;
}
function syncDpsBaseUnitSelectionFromQuantities(notify=true){
  const fixedIds=dpsBaseUnitSelectionIds(vs('dpsBaseUnits')).filter(id=>!dpsBaseUnitHasQuantity(id));
  const quantityIds=dpsBaseUnitList()
    .filter(unit=>dpsBaseUnitHasQuantity(unit) && Number(dpsBaseUnitQuantityText(unit))>0)
    .map(unit=>unit.id);
  const ids=[...fixedIds, ...quantityIds].filter((id,index,list)=>list.indexOf(id)===index).slice(0,dpsBaseUnitSelectionLimit());
  setDpsBaseUnitStoredValue(ids, notify);
}
const DPS_BASE_UNIT_STORE_CONTROLS=Object.freeze({
  enhance:{attribute:'data-dps-base-unit-slot-enhance',storeField:'enhance',normalize:value=>normalizeDpsBaseUnitEnhanceValue(value,0),fallback:'0'},
  limitBreak:{attribute:'data-dps-base-unit-slot-limit-break',storeField:'limitBreak',normalize:normalizeDpsBaseUnitLimitBreakValue,fallback:'0'}
});
function syncDpsBaseUnitStoreControl(control, kind, options={}){
  const config=DPS_BASE_UNIT_STORE_CONTROLS[kind];
  const unitId=String(control?.getAttribute?.(config?.attribute || '') || '');
  const unit=dpsBaseUnitById(unitId);
  if(!config || !unit) return config?.fallback || '0';
  let next=config.normalize(control.value);
  if(kind==='enhance' && !dpsBaseUnitCanUseEnhance(unit)) next='0';
  if(kind==='limitBreak' && !dpsBaseUnitCanUseLimitBreak(unit)) next='0';
  const store=dpsBaseUnitStoreInput(config.storeField,unit);
  if(store) store.value=next;
  if(options.commit || control.value!==next) control.value=next;
  return next;
}
function syncDpsBaseUnitEnhanceControl(input,commit=false){
  return syncDpsBaseUnitStoreControl(input,'enhance',{commit});
}
function syncDpsBaseUnitLimitBreakControl(select){
  return syncDpsBaseUnitStoreControl(select,'limitBreak',{commit:true});
}
function toggleDpsBaseUnitVoidPower(unitId){
  const unit=dpsBaseUnitById(unitId);
  if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit) || unit.id==='prodNarud' || !dpsBaseUnitNarudReady()){
    const store=dpsBaseUnitStoreInput('voidPower',unit);
    if(store) store.value='OFF';
    sanitizeDpsBaseUnitVoidPowerAvailability();
    return 'OFF';
  }
  const store=dpsBaseUnitStoreInput('voidPower',unit);
  const current=normalizeDpsBaseUnitVoidPowerValue(store?.value);
  const next=current==='ON' ? 'OFF' : 'ON';
  if(next==='ON' && dpsBaseUnitVoidPowerUsage(unit.id)+dpsBaseUnitVoidPowerCost(unit)>dpsBaseUnitVoidPowerLimit()) return 'OFF';
  if(store) store.value=next;
  syncDpsBaseUnitControl();
  return next;
}
// 유닛형 선택 버프는 꽃가루와 달리 유닛 보드의 실제 선택 상태를 공유한다.
const DPS_UNIT_LINKED_BUFF_UNITS=Object.freeze({
  prodArtifact:'artifactUnit',
  prodNova:'prodNova',prodTeratron:'prodTeratron',prodAmon:'prodAmon',prodAdun:'prodAdun',
  prodKerrigan:'prodKerrigan',prodOvermind:'prodOvermind',prodNarud:'prodNarud'
});
function syncDpsUnitLinkedBuffs(slots){
  const selected=new Set(slots.filter(Boolean));
  Object.entries(DPS_UNIT_LINKED_BUFF_UNITS).forEach(([id,unitId])=>{
    const checkbox=$(id);
    if(checkbox) checkbox.checked=selected.has(unitId) && !(id==='prodArtifact' && planetExplorationRestrictionsActive());
  });
  syncBuffChoiceButtons();
}
function updateDpsUnitFromLinkedBuff(checkbox){
  const id=checkbox?.id;
  const unitId=DPS_UNIT_LINKED_BUFF_UNITS[id];
  if(!unitId) return;
  const slots=currentDpsBaseUnitSlots();
  const existing=slots.indexOf(unitId);
  if(checkbox.checked && existing<0){
    const unit=dpsBaseUnitById(unitId);
    if(!unit || checkbox.disabled || (id==='prodArtifact' && planetExplorationRestrictionsActive()) || !dpsBaseUnitAllowedForCurrentPlanet(unit)){
      showToast('현재 모드에서는 해당 유닛을 선택할 수 없습니다.','warn');
    }else{
      const index=slots.indexOf('');
      if(index<0){
        showToast('유닛 보드의 슬롯 10개가 모두 사용 중입니다.','warn');
      }else{
        changeDpsBaseUnitSlot(index,unitId,{notify:false});
        return;
      }
    }
  }else if(!checkbox.checked && existing>=0){
    removeDpsBaseUnitSlot(existing,{confirmed:true});
    return;
  }
  syncDpsUnitLinkedBuffs(slots);
}
function writeDpsBaseUnitSelection(input,slotInput,slots){
  const selectedIds=slots.filter(Boolean);
  const normalized=normalizeDpsBaseUnitsValue(selectedIds);
  input.value=normalized;
  slotInput.value=serializeDpsBaseUnitSlots(slots);
  syncDpsBaseUnitQuantitiesForSelection(selectedIds);
  syncDpsUnitLinkedBuffs(slots);
  return normalized;
}
function setDpsBaseUnitStoredValue(value, notify=true, options={}){
  const input=$('dpsBaseUnits');
  const slotInput=$('dpsBaseUnitSlots');
  if(!input || !slotInput) return;
  const initialIds=dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue(value));
  const selectedIds=filterDpsBaseUnitIdsForCurrentPlanet(initialIds).slice(0,dpsBaseUnitSelectionLimit());
  const requestedSlots=options.slots ? normalizeDpsBaseUnitSlotValues(options.slots) : currentDpsBaseUnitSlots();
  const slots=reconcileDpsBaseUnitSlots(filterDpsBaseUnitSlotsForCurrentPlanet(requestedSlots),selectedIds);
  writeDpsBaseUnitSelection(input,slotInput,slots);
  syncDpsBaseUnitControl();
  if(notify){
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
}
function resetDpsBaseUnitSlotSettings(unitId){
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return;
  const defaults={quantity:'0',enhance:'0',limitBreak:'0',jewel:'',voidPower:'OFF'};
  Object.entries(defaults).forEach(([field,value])=>{
    const store=dpsBaseUnitStoreInput(field,unit);
    if(store) store.value=value;
  });
  const extras=dpsBaseUnitExtraSettingsObject();
  if(Object.prototype.hasOwnProperty.call(extras,unit.id)){
    delete extras[unit.id];
    setDpsBaseUnitExtraSettings(extras);
  }
  const expansions=$('dpsBaseUnitSlotExpansions');
  if(expansions) expansions.value=serializeDpsBaseUnitSlotExpansions(dpsBaseUnitSlotExpansionIds().filter(id=>id!==unit.id));
}
let dpsUnitSlotPendingRemove=null;
function showDpsUnitSlotRemoveDialog(index,unitId){
  const dialog=$('dpsUnitSlotRemoveDialog');
  if(!dialog || typeof dialog.showModal!=='function') return false;
  const unit=dpsBaseUnitById(unitId);
  dpsUnitSlotPendingRemove={index,unitId};
  const title=$('dpsUnitSlotRemoveTitle');
  const description=$('dpsUnitSlotRemoveDescription');
  if(title) title.textContent=`${index+1}번 슬롯 삭제`;
  if(description) description.textContent=`${unit ? dpsBaseUnitDisplayLabel(unit) : '선택된 유닛'} 및 해당 슬롯의 설정값이 초기화됩니다. 삭제하시겠습니까?`;
  if(!dialog.open) dialog.showModal();
  dialog.querySelector('[data-unit-slot-remove-cancel]')?.focus({preventScroll:true});
  return true;
}
function closeDpsUnitSlotRemoveDialog(){
  const dialog=$('dpsUnitSlotRemoveDialog');
  if(dialog?.open) dialog.close();
  dpsUnitSlotPendingRemove=null;
}
function removeDpsBaseUnitSlot(slotIndex,{confirmed=false}={}){
  const slots=currentDpsBaseUnitSlots();
  const index=Number(slotIndex);
  const visible=dpsUnitVisibleCount(slots);
  if(!Number.isInteger(index) || index<0 || index>=visible) return false;
  const removedUnit=slots[index];
  if(removedUnit && !confirmed){
    showDpsUnitSlotRemoveDialog(index,removedUnit);
    return false;
  }
  slots.splice(index,1);
  slots.push('');
  const count=$('dpsBaseUnitVisibleSlotCount');
  if(count) count.value=String(Math.max(0,visible-1));
  if(dpsUnitSelectedSlot>index) dpsUnitSelectedSlot--;
  if(removedUnit && !slots.includes(removedUnit)){
    dpsUnitExpandedCardIds.delete(removedUnit);
    resetDpsBaseUnitSlotSettings(removedUnit);
  }
  if(dpsUnitDetailOpen && dpsUnitSelectedSlot===index) dpsUnitDetailOpen=false;
  setDpsBaseUnitStoredValue(slots.filter(Boolean),false,{slots});
  return true;
}
function changeDpsBaseUnitSlot(slotIndex, unitId, options={}){
  const index=Math.max(0,Math.min(dpsBaseUnitSelectionLimit()-1,Number(slotIndex)||0));
  const slots=currentDpsBaseUnitSlots();
  const previous=slots[index];
  const requestedUnit=dpsBaseUnitById(unitId);
  const next=requestedUnit && dpsBaseUnitAllowedForCurrentPlanet(requestedUnit) ? String(unitId) : '';
  if(next){
    const duplicateIndex=slots.indexOf(next);
    if(duplicateIndex>=0 && duplicateIndex!==index) slots[duplicateIndex]='';
  }
  slots[index]=next;
  if(previous && previous!==next && !slots.includes(previous)){
    dpsUnitExpandedCardIds.delete(previous);
    if(dpsBaseUnitHasQuantity(previous)) setDpsBaseUnitQuantity(previous,0);
  }
  if(next && previous!==next) applyDpsBaseUnitAddDefaults(next);
  if(next && dpsBaseUnitHasQuantity(next)) setDpsBaseUnitQuantity(next,Math.max(1,Number(dpsBaseUnitQuantityText(next))||1));
  setDpsBaseUnitStoredValue(slots.filter(Boolean),options.notify!==false,{slots});
}
function captureDpsBaseUnitViewState(stack){
  if(!stack) return {focus:null};
  const active=stack.contains(document.activeElement) ? document.activeElement : null;
  let focus=active?.id ? {type:'id',id:active.id,start:active.selectionStart,end:active.selectionEnd} : null;
  if(active?.hasAttribute('data-dps-base-unit-extra-limit-break') || active?.hasAttribute('data-dps-base-unit-extra-jewel')){
    focus={
      type:active.hasAttribute('data-dps-base-unit-extra-limit-break') ? 'extra-limit' : 'extra-jewel',
      unitId:String(active.getAttribute(active.hasAttribute('data-dps-base-unit-extra-limit-break') ? 'data-dps-base-unit-extra-limit-break' : 'data-dps-base-unit-extra-jewel') || ''),
      index:String(active.getAttribute('data-dps-base-unit-extra-index') || '0')
    };
  }else if(active?.hasAttribute('data-dps-base-unit-slot-jewel')){
    focus={type:'named',unitId:String(active.getAttribute('data-dps-base-unit-slot-jewel') || '')};
  }
  return {focus};
}
function restoreDpsBaseUnitViewState(stack,state){
  const focus=state?.focus;
  if(!stack || !focus) return;
  if(focus.type==='id'){
    const target=document.getElementById(focus.id);
    if(target && stack.contains(target)){
      target.focus({preventScroll:true});
      if(typeof focus.start==='number' && target.setSelectionRange) target.setSelectionRange(focus.start,focus.end);
    }
    return;
  }
  let selector='[data-dps-base-unit-slot-jewel]';
  let unitAttribute='data-dps-base-unit-slot-jewel';
  if(focus.type==='extra-limit'){
    selector='[data-dps-base-unit-extra-limit-break]';
    unitAttribute='data-dps-base-unit-extra-limit-break';
  }else if(focus.type==='extra-jewel'){
    selector='[data-dps-base-unit-extra-jewel]';
    unitAttribute='data-dps-base-unit-extra-jewel';
  }
  const target=[...stack.querySelectorAll(selector)].find(element=>{
    if(String(element.getAttribute(unitAttribute) || '')!==focus.unitId) return false;
    return focus.type==='named' || String(element.getAttribute('data-dps-base-unit-extra-index') || '0')===focus.index;
  });
  if(target) target.focus({preventScroll:true});
}
function syncDpsBaseUnitControl(options={}){
  ensureDpsBaseUnitStore();
  sanitizeDpsJewelSelections();
  sanitizeDpsBaseUnitBelowHellSettings();
  if(!options.skipJewelConfig) renderDpsJewelConfigGrids();
  const input=$('dpsBaseUnits');
  const slotInput=$('dpsBaseUnitSlots');
  if(!input || !slotInput) return;
  const selectedIds=filterDpsBaseUnitIdsForCurrentPlanet(dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue(input.value || '')));
  sanitizeDpsBaseUnitVoidPowerAvailability();
  const rawSlots=String(slotInput.value || '');
  let slots=filterDpsBaseUnitSlotsForCurrentPlanet(rawSlots ? normalizeDpsBaseUnitSlotValues(rawSlots) : compactDpsBaseUnitSlots(selectedIds));
  const slotIds=slots.filter(Boolean);
  // 선택 목록이 같더라도 중간에 빈 슬롯이 남은 구버전 값은 카드 표시 전에 압축한다.
  const sameSelection=slotIds.length===selectedIds.length && slotIds.every((id,index)=>id===selectedIds[index] && slots[index]===id);
  if(!sameSelection) slots=reconcileDpsBaseUnitSlots(slots,selectedIds);
  writeDpsBaseUnitSelection(input,slotInput,slots);
  normalizeAllDpsBaseUnitQuantityInputs();
  const stack=$('dpsBaseUnitSlotStack');
  if(stack){
    const html=dpsBaseUnitSlotsHtml(slots);
    if(stack.innerHTML!==html) stack.innerHTML=html;
  }
  syncDpsUnitSlotModal(slots);
}
function adjustDpsBaseUnitQuantity(unitId, delta, options={}){
  const unit=dpsBaseUnitById(unitId);
  if(!unit || !dpsBaseUnitHasQuantity(unit)) return;
  const current=Number(dpsBaseUnitQuantityText(unit)) || 0;
  setDpsBaseUnitQuantity(unitId, current + Number(delta || 0));
  syncDpsBaseUnitSelectionFromQuantities(options.notify!==false);
}
function dpsBaseUnitDefaultEnhanceValue(unitOrId){
  const unit=dpsBaseUnitById(unitOrId);
  if(!unit) return '0';
  return dpsBaseUnitCanUseEnhance(unit) ? '500' : '0';
}
function applyDpsBaseUnitAddDefaults(unitId){
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return false;
  const enhance=dpsBaseUnitStoreInput('enhance',unit);
  if(enhance) enhance.value=dpsBaseUnitDefaultEnhanceValue(unit);
  return true;
}

function bindDpsBaseUnitControlEvents(){
  if(document.documentElement.dataset.dpsBaseUnitControlBound==='1') return;
  document.documentElement.dataset.dpsBaseUnitControlBound='1';
  document.addEventListener('keydown', e=>{
    if(!dpsUnitDetailOpen) return;
    const shell=$('dpsUnitSlotModal');
    if(!shell || shell.hidden) return;
    if(e.key==='Escape'){
      e.preventDefault();
      e.stopPropagation();
      closeDpsUnitSlotModal();
    }else if(e.key==='Tab'){
      const controls=[...shell.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
      if(!controls.length) return;
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey && (document.activeElement===first || !shell.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey && (document.activeElement===last || !shell.contains(document.activeElement))){e.preventDefault();first.focus();}
    }
  },true);
  document.addEventListener('click', e=>{
    const cancelSlotRemoval=e.target?.closest?.('[data-unit-slot-remove-cancel]');
    if(cancelSlotRemoval?.closest?.('#dpsUnitSlotRemoveDialog')){
      e.preventDefault();
      closeDpsUnitSlotRemoveDialog();
      return;
    }
    const confirmSlotRemoval=e.target?.closest?.('[data-unit-slot-remove-confirm]');
    if(confirmSlotRemoval?.closest?.('#dpsUnitSlotRemoveDialog')){
      e.preventDefault();
      const pending=dpsUnitSlotPendingRemove;
      closeDpsUnitSlotRemoveDialog();
      // Stale dialog safety: never delete a different unit if the slot changed meanwhile.
      if(pending && currentDpsBaseUnitSlots()[pending.index]===pending.unitId
        && removeDpsBaseUnitSlot(pending.index,{confirmed:true})) commitAppUpdate();
      return;
    }
    const addSlot=e.target?.closest?.('[data-unit-slot-add]');
    if(addSlot?.closest?.('#dpsBaseUnitSlotStack')){
      e.preventDefault();
      const currentSlots=currentDpsBaseUnitSlots();
      const current=dpsUnitVisibleCount(currentSlots);
      const requested=Number(addSlot.dataset.unitSlotAdd);
      if(requested===current && current<10 && !dpsUnitSlotPending){
        beginDpsUnitSlotAddition(current);
      }
      return;
    }
    const removeButton=e.target?.closest?.('[data-unit-list-remove]');
    if(removeButton?.closest?.('#dpsBaseUnitSlotStack')){
      e.preventDefault();
      if(removeDpsBaseUnitSlot(removeButton.getAttribute('data-unit-list-remove'))) commitAppUpdate();
      return;
    }
    const expansionToggle=e.target?.closest?.('[data-unit-slot-expansion-toggle]');
    if(expansionToggle?.closest?.('#dpsBaseUnitSlotStack')){
      e.preventDefault();
      const unitId=expansionToggle.getAttribute('data-unit-slot-expansion-toggle');
      if(dpsUnitExpandedCardIds.has(unitId)) dpsUnitExpandedCardIds.delete(unitId);
      else dpsUnitExpandedCardIds.add(unitId);
      syncDpsBaseUnitControl({skipJewelConfig:true});
      $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-slot-expansion-toggle="${unitId}"]`)?.focus({preventScroll:true});
      return;
    }
    const unitRow=e.target?.closest?.('[data-unit-list-select]');
    if(unitRow?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      const index=Number(unitRow.dataset.unitListSelect)||0;
      beginDpsUnitSlotDraft();
      dpsUnitSelectedSlot=index;
      dpsUnitDetailOpen=true;
      syncDpsBaseUnitControl({skipJewelConfig:true});
      $('unitSlotModalClose')?.focus({preventScroll:true});
      return;
    }
    const confirmDetail=e.target?.closest?.('[data-unit-detail-confirm]');
    if(confirmDetail?.closest?.('#dpsUnitSlotModal')){
      e.preventDefault();
      confirmDpsUnitSlotModal();
      return;
    }
    const closeDetail=e.target?.closest?.('[data-unit-detail-close],[data-unit-detail-backdrop]');
    if(closeDetail?.closest?.('#dpsUnitSlotModal')){
      e.preventDefault();
      closeDpsUnitSlotModal();
      return;
    }
    const qtyBtn=e.target?.closest?.('[data-dps-base-unit-qty-delta]');
    if(qtyBtn?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      adjustDpsBaseUnitQuantity(qtyBtn.getAttribute('data-dps-base-unit-id') || '', qtyBtn.getAttribute('data-dps-base-unit-qty-delta'),{notify:false});
      commitAppUpdate();
      return;
    }
    const voidToggle=e.target?.closest?.('[data-dps-base-unit-void-power-toggle]');
    if(voidToggle?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      const unitId=voidToggle.getAttribute('data-dps-base-unit-void-power-toggle') || '';
      toggleDpsBaseUnitVoidPower(unitId);
      commitAppUpdate();
      return;
    }
    const slotExpansion=e.target?.closest?.('[data-dps-base-unit-slot-expansion-toggle]');
    if(!slotExpansion?.closest?.('[data-dps-base-unit-control]')) return;
    e.preventDefault();
    toggleDpsBaseUnitSlotExpansion(slotExpansion.getAttribute('data-dps-base-unit-slot-expansion-toggle') || '');
    scheduleAutoSave();
  }, true);
  document.addEventListener('input', e=>{
    const input=e.target?.closest?.('[data-dps-base-unit-slot-enhance]');
    if(!input?.closest?.('[data-dps-base-unit-control]')) return;
    syncDpsBaseUnitEnhanceControl(input,false);
  }, true);
  document.addEventListener('change', e=>{
    const select=e.target?.closest?.('[data-dps-base-unit-slot]');
    if(select?.closest?.('[data-dps-base-unit-control]')){
      dpsUnitSelectedSlot=Number(select.getAttribute('data-dps-base-unit-slot'))||0;
      changeDpsBaseUnitSlot(dpsUnitSelectedSlot,select.value,{notify:false});
      commitAppUpdate();
      return;
    }
    const enhance=e.target?.closest?.('[data-dps-base-unit-slot-enhance]');
    if(enhance?.closest?.('[data-dps-base-unit-control]')){
      syncDpsBaseUnitEnhanceControl(enhance,true);
      commitAppUpdate();
      return;
    }
    const jewelConfig=e.target?.closest?.('[data-dps-jewel-field]');
    if(jewelConfig?.closest?.('[data-dps-jewel-config]')){
      if(updateDpsJewelConfig(jewelConfig)) commitAppUpdate();
      return;
    }
    const extraSetting=e.target?.closest?.('[data-dps-base-unit-extra-limit-break],[data-dps-base-unit-extra-jewel]');
    if(extraSetting?.closest?.('[data-dps-base-unit-control]')){
      updateDpsBaseUnitExtraSetting(extraSetting);
      commitAppUpdate();
      return;
    }
    const unitJewel=e.target?.closest?.('[data-dps-base-unit-slot-jewel]');
    if(unitJewel?.closest?.('[data-dps-base-unit-control]')){
      updateDpsBaseUnitJewelAssignment(unitJewel);
      commitAppUpdate();
      return;
    }
    const limitBreak=e.target?.closest?.('[data-dps-base-unit-slot-limit-break]');
    if(limitBreak?.closest?.('[data-dps-base-unit-control]')){
      syncDpsBaseUnitLimitBreakControl(limitBreak);
      commitAppUpdate();
    }
  }, true);
}

