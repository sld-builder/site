/* 계산 엔진
 * - 공통 유틸·입력 정규화
 * - 난이도/적 데이터: 일반·도전의 탑·행성탐사 데이터 선택
 * - 부담 배율: 물량·체력·실드·라운드 시간 기반 표시 DPS 보정
 * - 룬/강화/상위옵션: 표기 스탯과 개인 버프 산출
 * - 스펙 보드/유닛 보드: 표시 DPS, 클리어 기준, 클리어 기대값 산출
 * - 자원/특성/프리셋: 투자 비용, 잔여 재화, 최적화 보조 계산
 */
/* ── 01 · 공통 계산 유틸 ── */
/* 협동전 경험치 컷: 기존 app.js 계산식(입력 SP × 0.8) 그대로 이동 */
function xpCutCoopBase(sp){return Math.max(0,sp)*0.8;}

/* 공통 계산 유틸 */
function hasOwn(obj,key){
  return !!obj && Object.prototype.hasOwnProperty.call(obj,key);
}
function dataText(value){
  return String(value??'').trim();
}
function dataNumber(value){
  const number=Number(String(value??'').replace(/,/g,'').trim());
  return Number.isFinite(number) ? number : null;
}
function parseJsonObject(value){
  if(value && typeof value==='object' && !Array.isArray(value)) return value;
  if(typeof value!=='string') return {};
  try{
    const parsed=JSON.parse(value || '{}');
    return parsed && typeof parsed==='object' && !Array.isArray(parsed) ? parsed : {};
  }catch{
    return {};
  }
}

const ROUND_INPUT_MIN=1;
const ROUND_INPUT_MAX=300;
const DPS_BATTLE_BASE_ROUND=300;
const DPS_TOWER_BASE_FLOOR=81;
const DPS_PLANET_BASE_FLOOR=91;
const DPS_BURDEN_MULTIPLIER_MIN=0.000001;
const TOWER_ROUND_TIME_BONUS_MAX=8;
const TOWER_FLOOR_INPUT_MIN=1;
const TOWER_FLOOR_INPUT_MAX=90;
const PLANET_EXPLORATION_FLOOR_INPUT_MIN=1;
const PLANET_EXPLORATION_FLOOR_INPUT_MAX=100;
function skillRoundMaximum(mode){
  if(mode==='tower') return TOWER_FLOOR_INPUT_MAX;
  if(mode==='planet') return PLANET_EXPLORATION_FLOOR_INPUT_MAX;
  return ROUND_INPUT_MAX;
}
function normalizedIntegerRange(value, min, max, fallback=min){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  const num=raw==='' ? NaN : Number(raw);
  const base=Number.isFinite(num) ? num : fallback;
  return Math.max(min, Math.min(max, Math.round(base)));
}
function normalizedRoundNumber(value, fallback=ROUND_INPUT_MIN){
  return normalizedIntegerRange(value, ROUND_INPUT_MIN, ROUND_INPUT_MAX, fallback);
}
function normalizedRoundString(value){ return String(normalizedRoundNumber(value)); }
function normalizedTowerFloorNumber(value, fallback=TOWER_FLOOR_INPUT_MIN){
  return normalizedIntegerRange(value, TOWER_FLOOR_INPUT_MIN, TOWER_FLOOR_INPUT_MAX, fallback);
}
function normalizedTowerFloorString(value){ return String(normalizedTowerFloorNumber(value)); }
function normalizedPlanetExplorationFloorNumber(value, fallback=PLANET_EXPLORATION_FLOOR_INPUT_MIN){
  return normalizedIntegerRange(value, PLANET_EXPLORATION_FLOOR_INPUT_MIN, PLANET_EXPLORATION_FLOOR_INPUT_MAX, fallback);
}
function normalizedPlanetExplorationFloorString(value){ return String(normalizedPlanetExplorationFloorNumber(value)); }
function normalizedShardNumber(value){
  return normalizedIntegerRange(value, 0, 9999, 0);
}
function shardValue(id){
  const el=$(id);
  return normalizedShardNumber(el ? el.value : 0);
}
const RUNE_CHOICE_TYPE_LABELS={
  ap:'마법공격력',
  ua:'유닛 가속',
  td:'총 데미지',
  harmony:'총 데미지 & 유닛 가속'
};
const RUNE_CHOICE_TYPE_ALIASES={
  ap:'ap', ua:'ua', td:'td', harmony:'harmony',
  'td&ua':'harmony','td＆ua':'harmony','총뎀가속':'harmony','총데미지&유닛가속':'harmony','총데미지＆유닛가속':'harmony'
};
function normalizeRuneChoiceType(value){
  const key=String(value??'').trim().replace(/\s+/g,'').toLowerCase();
  return RUNE_CHOICE_TYPE_ALIASES[key] || (RUNE_CHOICE_TYPE_LABELS[key] ? key : 'harmony');
}
function normalizeRuneChoiceValue(value){
  const n=Number(String(value??'0').replace(/,/g,'').trim());
  return Number.isFinite(n) ? n : 0;
}
function normalizeRuneChoiceValues(values={}){
  const out={...values};
  out.runeChoiceType=normalizeRuneChoiceType(out.runeChoiceType || 'harmony');
  out.runeChoiceValue=String(normalizeRuneChoiceValue(out.runeChoiceValue));
  return out;
}

const POWER_BLESS_ALL_OPTIONS=[0,20,30,40,60,90];
const COOP_PASSENGER_DEFENSE_REDUCE_OPTIONS=[0,15,25,50,60];
const EROSION_CONTROL_DEFAULTS={erosionStack:'500',jewelErosionRes:'30'};
const EROSION_CONTROL_IDS=new Set(Object.keys(EROSION_CONTROL_DEFAULTS));
const SOLO_PENANCE_MAX=20;
const COOP_PENANCE_MAX=13;
function normalizeOnOffValue(value, fallback='OFF'){
  const text=String(value??'').trim().toUpperCase();
  return text==='ON' ? 'ON' : text==='OFF' ? 'OFF' : fallback;
}
function normalizeCoopPassengerDefenseReduceValue(value){
  const n=Math.round(Number(String(value ?? '').replace(/,/g,'').trim()));
  return COOP_PASSENGER_DEFENSE_REDUCE_OPTIONS.includes(n) ? String(n) : '0';
}
function coopPassengerDefenseReduceValue(id){
  return Number(normalizeCoopPassengerDefenseReduceValue(vs(id)));
}
function normalizeTeamCountValue(value, fallback=1){
  const n=Math.round(Number(value));
  return String(Math.max(1, Math.min(3, Number.isFinite(n) ? n : fallback)));
}
function normalizePenanceValue(value, max=SOLO_PENANCE_MAX){
  return String(Math.max(0, Math.min(max, Math.round(+value || 0))));
}
function normalizePowerBlessRawValue(value){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  if(raw==='' || raw==='없음') return '0';
  const n=Math.max(0, Math.round(dataNumber(value) ?? (+raw || 0)));
  return POWER_BLESS_ALL_OPTIONS.includes(n) ? String(n) : '0';
}
function normalizeErosionControlValue(id, value){
  const fallback=EROSION_CONTROL_DEFAULTS[id] || '0';
  const raw=String(value ?? '').replace(/,/g,'').trim();
  const numeric=parseFloat(raw);
  if(!Number.isFinite(numeric)) return fallback;
  const rounded=Math.max(0, Math.round(numeric));
  if(id==='jewelErosionRes') return String(Math.min(100, rounded));
  return String(rounded);
}
function normalizeDecimalDisplayValue(value, digits=6){
  const text=String(value ?? '').replace(/,/g,'').trim();
  if(text==='') return '';
  const n=Number(text);
  if(!Number.isFinite(n)) return String(value ?? '');
  const fixed=n.toFixed(digits);
  return String(parseFloat(fixed));
}

/* ── 02 · 입력·상태 ── */
/* 입력 상태 */
function normalizedStoredControlValue(id,dataKey,fallback,normalize){
  const element=$(id);
  return element ? normalize(element.value || element.dataset[dataKey] || fallback) : String(fallback);
}
function targetRoundStoredValue(){return normalizedStoredControlValue('round','roundValue',ROUND_INPUT_MIN,normalizedRoundString);}
function challengeTowerFloorStoredValue(){return normalizedStoredControlValue('challengeTowerFloor','challengeTowerFloorValue',TOWER_FLOOR_INPUT_MIN,normalizedTowerFloorString);}
function planetExplorationFloorStoredValue(){return normalizedStoredControlValue('planetExplorationFloor','planetExplorationFloorValue',PLANET_EXPLORATION_FLOOR_INPUT_MIN,normalizedPlanetExplorationFloorString);}
function effectiveTargetRound(){
  if(isTowerDifficulty()) return normalizedTowerFloorNumber(challengeTowerFloorStoredValue());
  if(isPlanetExplorationDifficulty()) return normalizedPlanetExplorationFloorNumber(planetExplorationFloorStoredValue());
  return normalizedRoundNumber(targetRoundStoredValue());
}
function effectiveXpValue(){return Math.max(1, v('xp'));}
function isCoopMode(){return normalizeOnOffValue(vs('coopMode'),'OFF')==='ON';}
function isCoopActive(diffName=vs('diff')){return isCoopMode() && isCoopAllowedDifficulty(diffName);}
function battleEnemyCountMultiplier(diffName=vs('diff')){return isCoopActive(diffName) ? effectiveTeamCount(diffName) : 1;}
function currentPenanceMax(){return isCoopActive() ? COOP_PENANCE_MAX : SOLO_PENANCE_MAX;}
function shouldIgnorePenanceForDifficulty(diffName=vs('diff')){
  const name=difficultyName(diffName);
  return name===TOWER_DIFFICULTY_NAME || isPlanetExplorationDifficulty(name) || name==='Deep Abyss';
}
function penanceStoredValue(){
  const el=$('penance');
  if(!el) return '0';
  return normalizePenanceValue(el.value || el.dataset.penanceValue || '0', SOLO_PENANCE_MAX);
}
function effectivePenanceValue(){
  return shouldIgnorePenanceForDifficulty() ? 0 : Number(normalizePenanceValue(penanceStoredValue(), currentPenanceMax()));
}
function effectivePowerBlessValue(value=vs('pbless')){
  return Number(normalizePowerBlessRawValue(value));
}
function erosionStoredValue(id){
  const el=$(id);
  if(!el) return EROSION_CONTROL_DEFAULTS[id] || '0';
  return normalizeErosionControlValue(id, el.value || el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
}

/* ── 03 · DPS 표시값 ── */
/* DPS표·스킬 표시값 */
const SANCTUARY_SKILL_DAMAGE_DATA=Object.freeze([
  ['어스퀘이크',0.0223,0.000066,10],
  ['포이즌미스트',0.0432,0.0001755,15],
  ['라이트닝스톰',0.517,0.0005,1],
  ['퓨리파이어',0.0198,0.000142,30],
  ['메테오 (1발)',0.259,0.00025,1]
]);
function calculateSkillDamageRows({ap=535,doubleSpace=1,round=1,mode='normal'}={}){
  const skillAp=Number.isFinite(Number(ap)) ? Number(ap) : 535;
  const doubleValue=Number.isFinite(Number(doubleSpace)) ? Number(doubleSpace) : 1;
  const modeValue=String(mode);
  const roundValue=normalizedIntegerRange(round,ROUND_INPUT_MIN,skillRoundMaximum(modeValue));
  const isTower=modeValue==='tower';
  const isPlanet=modeValue==='planet';
  // 행성탐사: 33R부터 감소(32R 기준). 감소 계수는 도전의 탑 값으로 임시 추정하며 실측 검증 전이다.
  // 83R 이후 고행 상승 중단은 별도 규칙이므로 스킬 피해 감소 계산에는 상한을 추가하지 않는다.
  const baseRound=isPlanet ? 32 : (isTower ? 30 : 100);
  const perRound=isPlanet ? 0.016601 : (isTower ? 0.016601 : 0.005);
  const penalty=Math.max(0,Math.min(0.99,(roundValue-baseRound)*perRound));
  return {
    ap:skillAp,
    doubleSpace:doubleValue,
    round:roundValue,
    penalty,
    items:SANCTUARY_SKILL_DAMAGE_DATA.map(([name,base,add,tick])=>({name,total:(base + add*skillAp*doubleValue) * tick * (1-penalty) * 100}))
  };
}

/* ── 04 · 인첸트 ── */
/* 인첸트 */
function currentEnchantStats(syncInputs=true){
  if(syncInputs) syncEnchantCodeFromInputs(false);
  const code=($('enchantCode')?.value||'999999').padEnd(6,'0').slice(0,6);
  return Array.from(code,char=>{
    const level=Math.max(0,Math.min(9,parseInt(char||'0',10)||0));
    return ENCHANT_TABLE[level];
  });
}

/* ── 05 · 특성 비용·재화 ── */
/* 특성 비용·재화 검증 */
const FIXED_STEP_AFTER_150={93:76000,94:76000,95:114000};
const STEP_COST_PREFIX=Object.freeze(Object.fromEntries(Object.entries(STEP_COST).map(([row,steps])=>{
  let total=0;
  return [row,Object.freeze([0,...steps.map(value=>(total+=Number(value)||0))])];
})));
function fixedStepAfter150(row){return FIXED_STEP_AFTER_150[row] || 0;}
function nextCost(row){
  const step=STEP_COST[row];
  const n=INV[row]||0;
  const mx=TMAX[row]||999;
  if(n>=mx) return Infinity;
  if(step) return Number.isFinite(step[n]) ? step[n] : Infinity;
  const p=COST[row];
  if(!p){
    if(RP_ROWS.has(row)) return nextRpCost(row);
    return Infinity;
  }
  const [a,d,mx2]=p;
  if(n>=mx2) return Infinity;
  const fixed=fixedStepAfter150(row);
  if(fixed && n>=150) return fixed;
  return n<400 ? a+n*d : a+400*d+(n-400)*(d/2);
}
function cumCost(row, investment=INV[row]||0){
  const n=Math.min(Math.max(0,Math.round(+investment||0)),TMAX[row]||999);
  const step=STEP_COST_PREFIX[row];
  if(step) return step[Math.min(n,step.length-1)] || 0;
  const p=COST[row];
  if(!p) return 0;
  const [a,d,mx]=p; const nn=Math.min(n,mx);
  if(nn<=0) return 0;
  const fixed=fixedStepAfter150(row);
  if(fixed && nn>150){
    const base=(150*(2*a+(149)*d))/2;
    return base + (nn-150)*fixed;
  }
  const e=Math.min(nn,400);
  let s=(e*(2*a+(e-1)*d))/2;
  if(nn>400){const ov=nn-400,x0=a+400*d;s+=(ov*(2*x0+(ov-1)*(d/2)))/2;}
  return s;
}

/* ── 06 · 난이도·적 데이터 ── */
/* 난이도·적 데이터 */
const TOWER_DIFFICULTY_NAME='도전의 탑';
const PLANET_EXPLORATION_STORAGE_NAME='행성탐사';
const PLANET_EXPLORATION_MONTHLY_DIFFICULTIES=Object.freeze(['행성탐사-코랄','행성탐사-아이어','행성탐사-제루스']);
const PLANET_EXPLORATION_DIFFICULTIES=new Set([PLANET_EXPLORATION_STORAGE_NAME,...PLANET_EXPLORATION_MONTHLY_DIFFICULTIES]);
// 한국시간 기준 1·4·7·10월 코랄, 2·5·8·11월 아이어, 3·6·9·12월 제루스.
function currentPlanetExplorationDifficulty(date=new Date()){
  const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',month:'numeric'}).format(date));
  return PLANET_EXPLORATION_MONTHLY_DIFFICULTIES[(month-1)%3];
}
const PLANET_EXPLORATION_REGION_BY_DIFFICULTY=Object.freeze({
  '행성탐사-코랄':'coral',
  '행성탐사-아이어':'aiur',
  '행성탐사-제루스':'xerus'
});
const ABYSS_DIFFICULTIES=new Set(['Abyss road','Deep Abyss']);
const COOP_DISABLED_DIFFICULTIES=new Set([TOWER_DIFFICULTY_NAME,...PLANET_EXPLORATION_DIFFICULTIES,...ABYSS_DIFFICULTIES]);
const SOLO_START_LOCK_DIFFICULTIES=new Set([TOWER_DIFFICULTY_NAME,...PLANET_EXPLORATION_DIFFICULTIES,'Deep Abyss']);
const BATTLE_DATA_MODES=Object.freeze({
  classic:{label:'클래식',unitTable:ENEMY_UNIT_TABLE,armorTable:ENEMY_ARMOR_TABLE,roundTimeTable:CLASSIC_ROUND_TIME_TABLE,maxRound:300,totalMode:'sum'},
  eternal:{label:'이터널',unitTable:ETERNAL_ENEMY_UNIT_TABLE,armorTable:ENEMY_ARMOR_TABLE,roundTimeTable:ETERNAL_ROUND_TIME_TABLE,maxRound:300,totalMode:'sum'},
  tower:{label:'클래식',unitTable:TOWER_UNIT_TABLE,armorTable:TOWER_ARMOR_TABLE,roundTimeTable:TOWER_TIME_TABLE,maxRound:90,totalMode:'current'},
  planet:{label:'행성탐사',unitTable:PLANET_UNIT_TABLE,armorTable:PLANET_ARMOR_TABLE,roundTimeTable:PLANET_TIME_TABLE,maxRound:100,totalMode:'current'}
});
const ROUND_FRUIT_PROFILES=Object.freeze([
  Object.freeze({key:'watermelon',label:'수박',enemyType:'거대',armorMultiplier:1,damageMultiplier:1}),
  Object.freeze({key:'pineapple',label:'파인애플',enemyType:'무속성',armorMultiplier:1,damageMultiplier:0.95}),
  Object.freeze({key:'pear',label:'배',enemyType:'중장갑',armorMultiplier:1,damageMultiplier:1}),
  Object.freeze({key:'strawberry',label:'딸기',enemyType:'경장갑',armorMultiplier:1,damageMultiplier:1}),
  Object.freeze({key:'grape',label:'포도',enemyType:'사이오닉',armorMultiplier:1.1,damageMultiplier:1})
]);
function enemyRoundFruitProfile(round){
  const index=((Math.round(Number(round)||0)%5)+5)%5;
  return ROUND_FRUIT_PROFILES[index] || ROUND_FRUIT_PROFILES[0];
}
function difficultyName(value=vs('diff')){return String(value || '').trim();}
function isDifficultyIn(value, set){return set.has(difficultyName(value));}
function isAbyssDifficulty(diffName=vs('diff')){return isDifficultyIn(diffName, ABYSS_DIFFICULTIES);}
function isPlanetExplorationDifficulty(diffName=vs('diff')){return isDifficultyIn(diffName, PLANET_EXPLORATION_DIFFICULTIES);}
function planetExplorationRegion(diffName=vs('diff')){
  const name=difficultyName(diffName);
  return PLANET_EXPLORATION_REGION_BY_DIFFICULTY[name===PLANET_EXPLORATION_STORAGE_NAME ? currentPlanetExplorationDifficulty() : name] || '';
}
function planetExplorationDisplayName(diffName=vs('diff')){
  const name=difficultyName(diffName);
  if(!isPlanetExplorationDifficulty(name)) return name;
  const active=name===PLANET_EXPLORATION_STORAGE_NAME ? currentPlanetExplorationDifficulty() : name;
  return `행성탐사 (${active.slice('행성탐사-'.length)})`;
}
function isCoopAllowedDifficulty(diffName=vs('diff')){return !isDifficultyIn(diffName, COOP_DISABLED_DIFFICULTIES);}
function isSoloStartDifficulty(diffName=vs('diff')){return isDifficultyIn(diffName, SOLO_START_LOCK_DIFFICULTIES);}
function abyssEffectiveStack(){
  if(!isAbyssDifficulty()) return 0;
  const round=Math.max(0, v('round'));
  const abyssRes=(INV[131]||0) * 3;
  const deepExtra=difficultyName()==='Deep Abyss' ? Math.floor(round/10)*5 : 0;
  return Math.max(0, round - abyssRes + deepExtra);
}
function abyssTdPenalty(){
  return abyssEffectiveStack() * 0.5;
}
function abyssSlowMultiplier(){
  return Math.pow(0.9875, abyssEffectiveStack());
}
function abyssAdPenalty(jewelResistance){
  if(!isAbyssDifficulty()) return 0;
  const base=difficultyName()==='Deep Abyss' ? 5 : 0.75;
  const stack=Math.max(0, v('erosionStack'));
  const override=Number(jewelResistance);
  const jewelRes=Math.max(0, Math.min(100, Number.isFinite(override) ? override : v('jewelErosionRes')));
  const traitRes=(INV[132]||0) * 0.025;
  return Math.max(0, base * stack * (1 - (jewelRes/100 + traitRes)));
}
function effectiveTeamCount(diffName=vs('diff')){
  const fallback=isCoopActive(diffName) ? 2 : 1;
  const selected=Number(normalizeTeamCountValue(v('team'), fallback)) || fallback;
  return isCoopActive(diffName) ? Math.max(2, selected) : selected;
}
function calculateTraitStatTotals(){
  const totals=Object.create(null);
  const abyss=isAbyssDifficulty();
  const teamMultiplier=isSoloStartDifficulty() ? 1 : effectiveTeamCount();
  TRAITS.forEach(t=>{
    const row=t[0];
    if(T_UA.has(row)) return;
    let rate=t[4]||0;
    if(abyss){
      if(row===133) rate=15;
      else if(row===134) rate=7.5;
      else if(row===135) rate=1.5;
    }
    let value=appliedTraitInvestment(row)*rate;
    if(t[5]==='team') value*=teamMultiplier;
    if(row===70||row===103||row===110) value=Math.round(value*10)/10;
    totals[t[3]]=(totals[t[3]]||0)+value;
  });
  return totals;
}
function uaProd(){
  const rates={99:0.24,111:0.08,136:(isAbyssDifficulty()?3:0.4)};
  let p=1;
  for(const [r,rate] of Object.entries(rates)){
    const n=appliedTraitInvestment(+r);
    if(n>0){
      let val=Math.pow(1+rate/100,n);
      if(+r===99||+r===111) val=Math.round(val*10000)/10000;
      p*=val;
    }
  }
  return p;
}
function dps0(hpRemain,enemyArmor,dr,pierce,dmgReduce){
  const armor=Math.max(0, Number.isFinite(enemyArmor)?enemyArmor:enemyRoundData(effectiveTargetRound()).armor);
  const hp=Math.max(0.01, Number.isFinite(hpRemain)?hpRemain:1);
  const dmg=Number.isFinite(dmgReduce)?dmgReduce:(DIFF[vs('diff')]||DIFF['The Final']).dmg;
  return (100/(100+armor*(1-dr/100)*(1-pierce/100))) / hp * (dmg/100);
}
function actualDrWithPierce(dr,pierce){
  return dr + (100-dr) * (pierce / 100);
}
const COOP_PASSENGER_TARGET_EFFECTS=Object.freeze({defenseReduce:0,pierce:0,hpReduce:0,shieldReduce:0});
function coopPassengerTargetEffects(player){
  return {
    defenseReduce:player===3 ? coopPassengerDefenseReduceValue('coopPassenger3Dr') : coopPassengerDefenseReduceValue('coopPassenger2Dr'),
    pierce:0,
    hpReduce:0,
    shieldReduce:0
  };
}
function coopPassengerTargetEffectsList(){
  if(!isCoopActive()) return [];
  const playerCount=battleEnemyCountMultiplier();
  const targets=[];
  for(let player=2; player<=playerCount; player++) targets.push(coopPassengerTargetEffects(player));
  return targets;
}
function enemyDurabilityRemain(enemyData, displayHR, displaySR){
  const hp=enemyData?.hp || 0;
  const shield=enemyData?.shield || 0;
  const total=Math.max(0, hp + shield);
  if(total<=0) return {remain:1,hpRatio:1,shieldRatio:0};
  const hpRatio=hp / total;
  const shieldRatio=shield / total;
  const remain=Math.max(0.01, hpRatio * (1 - displayHR / 100) + shieldRatio * (1 - displaySR / 100));
  return {remain,hpRatio,shieldRatio};
}
function targetDurabilityRemain(enemyData, targetEffects){
  return enemyDurabilityRemain(enemyData, targetEffects.hpReduce, targetEffects.shieldReduce);
}
/* 협동전 동승자별 내구도 계산은 스펙/유물 DPS에서 동일한 경로를 사용한다. */
function coopPassengerDurabilityTargets(enemyData){
  return coopPassengerTargetEffectsList().map(target=>({
    ...target,hpRemain:targetDurabilityRemain(enemyData,target).remain
  }));
}
function battleTargetDps0Average(ownTarget,passengerTargets,enemyArmor,dmgReduce){
  const playerCount=battleEnemyCountMultiplier();
  const ownDps0=dps0(ownTarget.hpRemain, enemyArmor, ownTarget.defenseReduce, ownTarget.pierce, dmgReduce);
  if(playerCount<=1) return ownDps0;

  const targets=Array.isArray(passengerTargets) ? passengerTargets : [passengerTargets];
  let totalDps0=ownDps0;
  for(let i=0;i<playerCount-1;i++){
    const target=targets[i] || COOP_PASSENGER_TARGET_EFFECTS;
    totalDps0+=dps0(target.hpRemain, enemyArmor, target.defenseReduce, target.pierce, dmgReduce);
  }
  return totalDps0 / playerCount;
}
function dps2(cri,mc,cd,md,mp,mcp,radiation=0){
  let a=cri;
  let d=md;
  let e=mp;
  let f=mcp;
  if(radiation===1 || radiation===true){
    a=a/2;
    d=0;
    e=0;
    f=0;
  }
  if(a>=300) return 1+cd/100+mc*cd*2/300+d/100*e/100*(1+f/100*cd/100+f/100*mc*cd*2/300);
  if(a>=100) return 1+cd/100+mc*a/300*cd*2/300+d/100*e/100*(1+f/100*cd/100+f/100*mc*a/300*cd*2/300);
  return 1+a/100*cd/100+mc*a/100*a/300*cd*2/300+d/100*e/100*(1+f/100*cd/100+f/100*mc*a/300*cd*2/300);
}
function lookupFloor(table, round){
  const r=Math.max(1,Math.round(+round||1));
  if(!Array.isArray(table) || !table.length) return undefined;
  let low=0,high=table.length-1,best=0;
  while(low<=high){
    const mid=(low+high)>>1;
    if(table[mid][0]<=r){best=mid;low=mid+1;}
    else high=mid-1;
  }
  return table[best];
}
function isTowerDifficulty(value=vs('diff')){return difficultyName(value)===TOWER_DIFFICULTY_NAME;}
function battleDataModeKeyForDifficulty(diffName=vs('diff')){
  if(isTowerDifficulty(diffName)) return 'tower';
  if(isPlanetExplorationDifficulty(diffName)) return 'planet';
  return isAbyssDifficulty(diffName) ? 'eternal' : 'classic';
}
function battleDataModeForDifficulty(diffName=vs('diff')){
  return BATTLE_DATA_MODES[battleDataModeKeyForDifficulty(diffName)] || BATTLE_DATA_MODES.classic;
}
function enemyDisplayModeLabel(diffName=vs('diff')){return battleDataModeForDifficulty(diffName).label;}
function normalizedBattleRound(round, mode, fallback=1, min=1){
  const max=Number.isFinite(mode?.maxRound) ? mode.maxRound : 300;
  return Math.max(min, Math.min(max, Math.round(+round || fallback)));
}
function tableRoundTime(table, round, fallback=60){
  const row=lookupFloor(table, round);
  const value=row ? Number(row[1]) : fallback;
  return Number.isFinite(value) && value>0 ? value : fallback;
}
function towerRoundTimeBonus(){
  const tdRp=Math.max(0, +INV[129] || 0);
  const pierceRp=Math.max(0, +INV[130] || 0);
  const bonus=Math.floor((tdRp + pierceRp) * 0.2);
  return Math.max(0, Math.min(TOWER_ROUND_TIME_BONUS_MAX, bonus));
}
function enemyRoundTimeBonus(diffName=vs('diff')){
  return isTowerDifficulty(diffName) ? towerRoundTimeBonus() : 0;
}
function enemyRoundTime(round, diffName=vs('diff')){
  const modeKey=battleDataModeKeyForDifficulty(diffName);
  const mode=battleDataModeForDifficulty(diffName);
  const r=normalizedBattleRound(round, mode);
  const base=tableRoundTime(mode.roundTimeTable, r);
  const eternalExtra=modeKey==='eternal' && r<=250 ? 13 : 0;
  const finalTime=base + eternalExtra + enemyRoundTimeBonus(diffName);
  return Math.max(1,Math.round(finalTime*10)/10);
}
const SPEED_MODE_MULTIPLIER=1.3;
function roundTimeToOneDecimal(value){
  return Math.round((Number(value)+Number.EPSILON)*10)/10;
}
function storedSpeedModeEnabled(inputId){
  return normalizeOnOffValue(vs(inputId),'OFF')==='ON';
}
function speedModeSupported(diffName=vs('diff')){
  return !isTowerDifficulty(diffName) && !isPlanetExplorationDifficulty(diffName);
}
function speedModeRoundTime(baseTime,enabled){
  const time=Number(baseTime);
  if(!Number.isFinite(time)) return time;
  return roundTimeToOneDecimal(enabled ? time/SPEED_MODE_MULTIPLIER : time);
}
function roundTimeAfterSpeedAndLoss(baseTime,speedEnabled,timeLoss=0){
  const speedAdjustedTime=speedModeRoundTime(baseTime,speedEnabled);
  const loss=Math.max(0,Number(timeLoss)||0);
  return {
    speedAdjustedTime,
    finalTime:Math.max(1,roundTimeToOneDecimal(speedAdjustedTime-loss)),
    timeLoss:loss
  };
}
function unifiedDpsSpeedModeEnabled(diffName=vs('diff')){
  return speedModeSupported(diffName) && (storedSpeedModeEnabled('specDpsSpeedMode') || storedSpeedModeEnabled('dpsBaseUnitSpeedMode'));
}
function specDpsRoundTimeParts(round,diffName=vs('diff')){
  const timeLoss=specDpsInvulnerabilityTimeLoss(diffName);
  return roundTimeAfterSpeedAndLoss(
    enemyRoundTime(round,diffName),
    unifiedDpsSpeedModeEnabled(diffName),
    timeLoss
  );
}
function specDpsRoundTime(round,diffName=vs('diff')){
  return specDpsRoundTimeParts(round,diffName).finalTime;
}
function specDpsRoundTimeDpsMultiplier(round,diffName=vs('diff')){
  const parts=specDpsRoundTimeParts(round,diffName);
  return parts.timeLoss>0 ? parts.speedAdjustedTime/parts.finalTime : 1;
}
function battleModeLabel(diffName=vs('diff')){return isCoopActive(diffName) ? '협동전' : '개인전';}
function dpsContextModeValues(diffName=vs('diff')){
  const players=isCoopActive(diffName) ? ` · ${effectiveTeamCount(diffName)}인` : '';
  const displayMode=(isTowerDifficulty(diffName) || isPlanetExplorationDifficulty(diffName)) ? '클래식' : enemyDisplayModeLabel(diffName);
  return {
    primary:unifiedDpsSpeedModeEnabled(diffName) ? '스피드' : '일반',
    secondary:`${battleModeLabel(diffName)} · ${displayMode}${players}`
  };
}
function enemyDataFromTables(mode, round, options={}){
  const r=Number(round) || 0;
  const armorRow=lookupFloor(mode.armorTable, r);
  const unitRow=lookupFloor(mode.unitTable, r);
  const fruit=enemyRoundFruitProfile(r);
  const baseArmor=armorRow && armorRow[0] <= r ? Number(armorRow[1]) || 0 : 0;
  const data={
    round:r,
    fruitKey:fruit.key,
    fruitLabel:fruit.label,
    enemyType:fruit.enemyType,
    armorBase:baseArmor,
    armor:baseArmor*fruit.armorMultiplier,
    damageMultiplier:fruit.damageMultiplier,
    count: unitRow ? unitRow[1] : 0,
    hp: unitRow ? unitRow[2] : 0,
    shield: unitRow ? unitRow[3] : 0
  };
  if(options.includeUnitRound) data.unitRound=unitRow ? unitRow[0] : r;
  return data;
}
function enemyRoundData(round, diffName=vs('diff')){
  const mode=battleDataModeForDifficulty(diffName);
  const r=normalizedBattleRound(round, mode, 0, 0);
  if(r<=0) return {round:0,fruitKey:'watermelon',fruitLabel:'수박',enemyType:'거대',armorBase:0,armor:0,damageMultiplier:1,unitRound:0,count:0,hp:0,shield:0};
  return enemyDataFromTables(mode, r, {includeUnitRound:true});
}

function enemyBurdenDurability(enemyData, displayHR, displaySR){
  const hpReduce=Math.max(0, Number(displayHR)||0) / 100;
  const shieldReduce=Math.max(0, Number(displaySR)||0) / 100;
  const hpRemain=Math.max(0, (enemyData?.hp || 0) * (1 - hpReduce));
  const shieldRemain=Math.max(0, (enemyData?.shield || 0) * (1 - shieldReduce));
  return Math.max(1, hpRemain + shieldRemain);
}
function burdenMultiplier(base, current){
  if(!Number.isFinite(base) || !Number.isFinite(current) || current<=0) return 1;
  return Math.min(1, Math.max(DPS_BURDEN_MULTIPLIER_MIN, base / current));
}
function battleBurdenScore(round, displayHR, displaySR, diffName=vs('diff'), countMultiplier=battleEnemyCountMultiplier(diffName)){
  const enemy=enemyRoundData(round, diffName);
  if(!enemy.count) return 1;
  const count=Math.max(1, (enemy.count || 0) * Math.max(1, Number(countMultiplier)||1));
  const time=Math.max(1, enemyRoundTime(enemy.round, diffName));
  return Math.max(1, count * enemyBurdenDurability(enemy, displayHR, displaySR) / time);
}
function battleDpsDisplayMultiplier(diffName, round, displayHR, displaySR){
  const base=battleBurdenScore(DPS_BATTLE_BASE_ROUND, displayHR, displaySR, diffName, 1);
  const current=battleBurdenScore(round, displayHR, displaySR, diffName, battleEnemyCountMultiplier(diffName));
  return burdenMultiplier(base, current);
}
function towerFloorEnemyData(floor){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  return enemyDataFromTables({armorTable:TOWER_ARMOR_TABLE,unitTable:TOWER_UNIT_TABLE}, r);
}
function planetFloorEnemyData(floor){
  const r=Math.max(1, Math.min(100, Math.round(+floor||1)));
  return enemyDataFromTables({armorTable:PLANET_ARMOR_TABLE,unitTable:PLANET_UNIT_TABLE}, r);
}
function contentFloorBurdenScore(enemy, diffName, displayHR, displaySR){
  if(!enemy?.count) return 1;
  const time=Math.max(1, enemyRoundTime(enemy.round, diffName));
  return Math.max(1, enemy.count * enemyBurdenDurability(enemy, displayHR, displaySR) / time);
}
function towerBurdenScore(floor, displayHR, displaySR){
  return contentFloorBurdenScore(towerFloorEnemyData(floor), TOWER_DIFFICULTY_NAME, displayHR, displaySR);
}
function towerDpsDisplayMultiplier(floor, displayHR, displaySR){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  if(r<=80) return 1;
  const base=towerBurdenScore(DPS_TOWER_BASE_FLOOR, displayHR, displaySR);
  const current=towerBurdenScore(r, displayHR, displaySR);
  return burdenMultiplier(base, current);
}
function planetBurdenScore(floor, diffName, displayHR, displaySR){
  return contentFloorBurdenScore(planetFloorEnemyData(floor), diffName, displayHR, displaySR);
}
function planetDpsDisplayMultiplier(floor, diffName, displayHR, displaySR){
  const r=Math.max(1, Math.min(100, Math.round(+floor||1)));
  if(r<=90) return 1;
  const base=planetBurdenScore(DPS_PLANET_BASE_FLOOR, diffName, displayHR, displaySR);
  const current=planetBurdenScore(r, diffName, displayHR, displaySR);
  return burdenMultiplier(base, current);
}
/* 행성탐사 표시 DPS/유닛 보드 기대값은 도전의 탑과 같은 부담 배율 흐름을 쓰되,
 * 기준 구간과 적 데이터는 행성탐사 고유값만 사용한다.
 */
function contentDpsDisplayMultiplier(diffName, round, displayHR, displaySR){
  const name=difficultyName(diffName);
  if(name===TOWER_DIFFICULTY_NAME) return towerDpsDisplayMultiplier(round, displayHR, displaySR);
  if(isPlanetExplorationDifficulty(name)) return planetDpsDisplayMultiplier(round, name, displayHR, displaySR);
  return battleDpsDisplayMultiplier(diffName, round, displayHR, displaySR);
}

/* ── 07 · 룬·강화 ── */
/* 룬·강화 */
function on(id){const el=$(id); return !!(el && el.checked);}
function clampInt(n,min,max){return Math.max(min,Math.min(max,Math.round(+n||0)));}
const OVER_ENHANCE_ALLOWED=new Set([0,3,5,6]);
function normalizeOverEnhanceValue(value){
  const n=clampInt(value,0,6);
  return OVER_ENHANCE_ALLOWED.has(n) ? n : 0;
}
function monthRuneCount(prefix, kind='plus'){
  const el=$(prefix + (kind==='normal' ? 'RuneNormal' : 'RunePlus'));
  return clampInt(el ? el.value : 0, 0, 6);
}
const RUNE_OPTION_SELECT_IDS=['opt10','opt15','transOpt'];
const RUNE_OPTION_SELECT_ID_SET=new Set(RUNE_OPTION_SELECT_IDS);
function uniqueRuneOptionCodes(){
  return Array.from(new Set(
    RUNE_OPTION_SELECT_IDS.map(id=>vs(id)).filter(code=>code && code!=='none')
  ));
}
function syncExclusiveRuneOptions(){
  const selects=RUNE_OPTION_SELECT_IDS.map(id=>$(id)).filter(Boolean);
  if(!selects.length) return;
  const used=new Set();
  selects.forEach(select=>{
    const code=select.value;
    if(code && code!=='none'){
      if(used.has(code)) select.value='none';
      else used.add(code);
    }
  });
  const selected=new Set(selects.map(select=>select.value).filter(code=>code && code!=='none'));
  selects.forEach(select=>{
    Array.from(select.options || []).forEach(option=>{
      const code=option.value;
      const blocked=code && code!=='none' && code!==select.value && selected.has(code);
      option.disabled=blocked;
      option.hidden=blocked;
    });
  });
}
const reinforceSuccessOddsCache=new Map();
function reinforceSuccessOdds(tries, basePower, isTheZero, upRev, upFRev){
  const count=clampInt(tries,0,999);
  const upP=basePower + (isTheZero ? 20 : 0) + upRev * 2;
  const failStep=4 + 2 * upFRev;
  const cacheKey=`${count}|${upP}|${failStep}`;
  const cached=reinforceSuccessOddsCache.get(cacheKey);
  if(cached) return cached;
  const streakChance=[];
  const failPrefix=[1];
  for(let i=0;i<=count;i++){
    streakChance[i]=1 - 70 / (upP + i * failStep);
    failPrefix[i+1]=failPrefix[i]*(1-streakChance[i]);
  }
  const upOdds=[];
  for(let i=0;i<=count;i++){
    if(i===0){ upOdds[i]=1; continue; }
    if(i===1){ upOdds[i]=streakChance[0]; continue; }
    let chance=upOdds[i-1] * streakChance[0];
    for(let j=1;j<=i-1;j++) chance += failPrefix[j] * streakChance[j] * upOdds[i-1-j];
    upOdds[i]=chance;
  }
  const result={count,streakChance,upOdds};
  reinforceSuccessOddsCache.set(cacheKey,result);
  return result;
}
function averageReinforceSuccessChance(odds){
  if(!odds || odds.count<=0) return 0;
  let sum=0;
  for(let i=1;i<=odds.count;i++) sum += odds.upOdds[i];
  return sum / odds.count;
}
/* 강화 확률 분포로 1,000회 표본의 예상 최소·최대값을 구한다 (난수 없음). */
const REINFORCE_MAX_VALUE=1000;
let reinforceRangeCache=null;
function reinforceExpectedRangeValue(odds, masterRate, doubleReinf, repairAdd, aprilPlus){
  const key=[odds.count,odds.streakChance[0],odds.streakChance[1],masterRate,doubleReinf,repairAdd,aprilPlus].join('|');
  if(reinforceRangeCache?.key===key) return reinforceRangeCache.value;
  const width=REINFORCE_MAX_VALUE+1;
  const lotto=Math.max(0,Math.min(1,doubleReinf*0.005));
  const increments=[30,60,repairAdd,repairAdd+10];
  let states=new Float64Array((odds.count+1)*width);
  states[Math.min(REINFORCE_MAX_VALUE,aprilPlus*10)]=1;
  for(let attempt=0;attempt<odds.count;attempt++){
    const next=new Float64Array(states.length);
    for(let streak=0;streak<=attempt;streak++){
      const success=odds.streakChance[streak];
      const rates=[success*(1-lotto),success*lotto,(1-success)*(1-masterRate),(1-success)*masterRate];
      for(let score=0;score<width;score++){
        const probability=states[streak*width+score];
        if(!probability) continue;
        for(let branch=0;branch<4;branch++){
          next[(branch<2?0:streak+1)*width+Math.min(REINFORCE_MAX_VALUE,score+increments[branch])]+=probability*rates[branch];
        }
      }
    }
    states=next;
  }
  let cumulative=0,minimum=0,maximum=0;
  for(let score=0;score<REINFORCE_MAX_VALUE;score++){
    for(let streak=0;streak<=odds.count;streak++) cumulative+=states[streak*width+score];
    const cdf=Math.max(0,Math.min(1,cumulative));
    minimum+=Math.pow(1-cdf,1000);
    maximum+=1-Math.pow(cdf,1000);
  }
  const value=Math.round(minimum+(maximum-minimum)*0.25);
  reinforceRangeCache={key,value};
  return value;
}
function currentReinforceInputs(){
  const repair=vs('repairEnhance');
  const master=vs('enhanceMaster');
  return {
    over:normalizeOverEnhanceValue(v('overEnhance')),
    masterRate:master==='ON+' ? 0.66 : (master==='ON' ? 0.5 : 0),
    repairAdd:repair==='ON+' ? 7 : (repair==='ON' ? 5 : 0),
    aprilNormal:monthRuneCount('apr','normal'),
    aprilPlus:monthRuneCount('apr','plus'),
    septemberNormal:monthRuneCount('sep','normal'),
    septemberPlus:monthRuneCount('sep','plus')
  };
}
function currentReinforceCount(inputs=currentReinforceInputs()){
  return 10 + (INV[58]||0) + inputs.over + inputs.aprilNormal + (hasRuneOption('reinf5')?5:0);
}
function unitEnhanceStats(){
  const inputs=currentReinforceInputs();
  const {masterRate,repairAdd,aprilPlus,septemberNormal,septemberPlus}=inputs;
  const count=currentReinforceCount(inputs);
  const upRev=INV[64]||0;
  const upFRev=INV[65]||0;
  const odds=reinforceSuccessOdds(count,100,true,upRev,upFRev);
  const chance=averageReinforceSuccessChance(odds);
  const value=reinforceExpectedRangeValue(odds,masterRate,INV[96]||0,repairAdd,aprilPlus);
  return {count,chance,value,septemberNormal,septemberPlus};
}
function upperOptionStats(){
  const flower1=on('flowerSkill1');
  const flower2=on('flowerSkill2');
  const flower3=on('flowerSkill3');
  const planetActive=isPlanetExplorationDifficulty();
  const prod={
    nova:on('prodNova'), teratron:on('prodTeratron'), amon:on('prodAmon'), adun:on('prodAdun'),
    kerrigan:on('prodKerrigan'), overmind:on('prodOvermind'), narud:on('prodNarud'), artifact:!planetActive && on('prodArtifact')
  };
  const coralShard=shardValue('coralShard');
  const aiurShard=shardValue('aiurShard');
  const xerusShard=shardValue('xerusShard');
  const prodHiddenAD = (prod.nova && coralShard>=250 ? 10 : 0) + (prod.teratron && coralShard>=400 ? 10 : 0)
                     + (prod.amon && aiurShard>=250 ? 10 : 0) + (prod.adun && aiurShard>=400 ? 10 : 0)
                     + (prod.kerrigan && xerusShard>=250 ? 10 : 0) + (prod.overmind && xerusShard>=400 ? 10 : 0);
  const prodAD = (prod.amon?30:0) + prodHiddenAD;
  const prodAS = (prod.nova?15:0) + (prod.narud?15:0);
  const prodCRI = (prod.teratron?10:0) + (prod.kerrigan?10:0) + (prod.artifact?20:0);
  const prodCD = (prod.adun?30:0) + (prod.overmind?30:0);
  return {
    ad: prodAD,
    as: prodAS,
    cri: prodCRI,
    cd: prodCD,
    td: 0,
    actualAd: flower1 ? 20 : 0,
    actualAs: flower2 ? 15 : 0,
    uaMul: 1,
    dps0Mul: flower3 ? 1.15 : 1
  };
}
const SYSTEM_COMMON_BUFFS=Object.freeze({
  dailyCouponCri:10,
  shareUser:Object.freeze({ad:10,as:10,cri:5}),
  uniqueUnit:Object.freeze({baseAd:30,septemberPlusAd:10,actualAp:20}),
  basePierce:10
});
function monthRuneCountFromValue(value){
  return clampInt(value,0,6);
}
function septemberNormalBoardQuantityBonus(value){
  return Math.max(0,Math.min(2,monthRuneCountFromValue(value)-4));
}
function septemberPlusUniqueAdBonus(value){
  return SYSTEM_COMMON_BUFFS.uniqueUnit.septemberPlusAd*monthRuneCountFromValue(value);
}
const DONATION_BUFF_TYPES=new Set(['sp','paid']);
const DONATION_BUFF_SP_COST=150000;
const EMPTY_DONATION_BUFF=Object.freeze({ad:0,as:0,cri:0});
function normalizeDonationBuffType(value){
  const key=String(value ?? '').trim().toLowerCase();
  return DONATION_BUFF_TYPES.has(key) ? key : 'none';
}
function donationInvestmentFromType(value){
  const type=normalizeDonationBuffType(value);
  return type==='sp' ? 1 : type==='paid' ? 2 : 0;
}
function donationTypeFromInvestment(value){
  return value===1 ? 'sp' : value===2 ? 'paid' : 'none';
}
function activeDonationBuffType(){
  return donationTypeFromInvestment(INV[116]);
}
function donationBuffStats(){
  return activeDonationBuffType()==='none' ? EMPTY_DONATION_BUFF : SYSTEM_COMMON_BUFFS.shareUser;
}
function donationBuffSpCost(){
  return activeDonationBuffType()==='sp' ? DONATION_BUFF_SP_COST : 0;
}
const UNIT_GRADE_AD={D:-10,C:-5,B:0,A:5,S:10,SS:20,SSS:30,X:40,XD:50,SXD:50,RXD:100};
const UNIT_GRADE_AS={D:0,C:0,B:0,A:0,S:0,SS:0,SSS:0,X:0,XD:0,SXD:25,RXD:30};
function activeUnitGrade(){return vs('unitGrade') || 'S';}
function xpInputStatBonus(){
  return effectiveXpValue() <= 10000 ? {ad:10, as:10, cri:5} : {ad:0, as:0, cri:0};
}
function unitADPrivateBonus(){
  const enh=unitEnhanceStats();
  const gradeAd=UNIT_GRADE_AD[activeUnitGrade()] ?? UNIT_GRADE_AD.S;
  const level=(v('unitLevel')||11)*5;
  const uniqueBuff=SYSTEM_COMMON_BUFFS.uniqueUnit.baseAd + septemberPlusUniqueAdBonus(enh.septemberPlus);
  return gradeAd + level + uniqueBuff + (enh.value||0) - abyssAdPenalty();
}
function personalUaDtMultiplier(){
  return 1.15;
}
function autoEpValue(){
  return Math.floor(effectiveXpValue()/100000) + Math.floor(Math.max(0, v('bxp'))/50000);
}
function syncAutoEP(){
  const ep=autoEpValue();
  const hidden=$('ep');
  if(hidden) hidden.value=String(ep);
  const view=$('autoEpView');
  if(view) view.textContent=big(ep);
  return ep;
}
function effectiveAdditionalStats(){
  return { ad:v('addAD'), as:v('addAS'), cd:v('addCD'), cri:v('addCRI'), ap:v('addAP'), td:v('addTD'), ua:v('addUA'), dr:0, sr:0, hr:0 };
}
function growthGraduationAttackBonus(){
  return effectiveXpValue()>=2000000 ? 20 : 0;
}

/* ── 08 · 유닛 보드 ── */
/* 유닛 보드 데이터·입력 정규화 */
const DPS_BASE_UNIT_STORAGE_SEPARATOR=',';
const DPS_BASE_UNIT_SETTING_PREFIXES=Object.freeze({
  enhance:'dpsEnhance',
  limitBreak:'dpsLimitBreak',
  jewel:'dpsJewel',
  voidPower:'dpsVoidPower'
});
const DPS_BASE_UNIT_ADVANCED_SETTING_KINDS=Object.freeze(['limitBreak','jewel','voidPower']);
function dpsDataArray(key,fallback=[]){
  const value=window.DPS_DATA?.[key];
  return Array.isArray(value) ? value : fallback;
}
function dpsBaseUnitList(){
  return dpsDataArray('DPS_BASE_UNITS');
}
function resolveDpsBaseUnit(unitOrId){
  if(unitOrId && typeof unitOrId==='object') return unitOrId;
  const id=String(unitOrId ?? '');
  return dpsBaseUnitList().find(unit=>String(unit.id)===id) || null;
}
function dpsBaseUnitById(id){
  return resolveDpsBaseUnit(id);
}
function dpsBaseUnitIsArtifact(unitOrId){
  return resolveDpsBaseUnit(unitOrId)?.kind==='artifact';
}
function dpsBaseUnitSupportsAdvancedOptions(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return !!unit && !dpsBaseUnitIsArtifact(unit);
}
function dpsBaseUnitCanUseEnhance(unitOrId,jewelName=null){
  const unit=resolveDpsBaseUnit(unitOrId);
  if(!unit) return false;
  if(!unit.enhanceRequiresTanzanite) return true;
  // 계산할 개별 기체는 탄자나이트를 장착한 경우에만 강화 기대값을 사용한다.
  if(jewelName!==null) return normalizeDpsJewelName(jewelName)==='탄자나이트';
  if(dpsBaseUnitJewelName(unit)==='탄자나이트') return true;
  const count=Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT,Math.max(0,dpsBaseUnitQuantity(unit)-1));
  return typeof dpsBaseUnitSlotExpanded==='function' && dpsBaseUnitSlotExpanded(unit)
    && dpsBaseUnitExtraSlotSettings(unit).slice(0,count).some(setting=>setting.legendaryMythicJewel==='탄자나이트');
}
function dpsBaseUnitCanUseLimitBreak(unitOrId){
  return dpsBaseUnitSupportsAdvancedOptions(unitOrId);
}
function dpsBaseUnitAllId(){
  return window.DPS_DATA?.DPS_BASE_UNIT_ALL_ID || 'all';
}
function dpsBaseUnitSelectionLimit(){
  return 10;
}
function dpsBaseUnitLabel(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return unit?.label || String(unitOrId || '');
}
function dpsBaseUnitGradeOrder(){
  return dpsDataArray('DPS_BASE_UNIT_GRADE_ORDER',['슈퍼히든','히든','레전드','헬']);
}
function dpsBaseUnitRaceOrder(){
  return dpsDataArray('DPS_BASE_UNIT_RACE_ORDER',['테바','테메','프바','프메','저그','중립','혼종']);
}
function dpsBaseUnitSettingSuffix(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return String(unit?.id || unitOrId || '').replace(/^prod/,'').replace(/[^A-Za-z0-9_-]/g,'');
}
function dpsBaseUnitQuantityInputId(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return unit?.quantityId || `dpsQty${dpsBaseUnitSettingSuffix(unit || unitOrId)}`;
}
function dpsBaseUnitSettingInputId(kind,unitOrId){
  const prefix=DPS_BASE_UNIT_SETTING_PREFIXES[kind];
  return prefix ? `${prefix}${dpsBaseUnitSettingSuffix(unitOrId)}` : '';
}
function dpsBaseUnitEnhanceInputId(unitOrId){return dpsBaseUnitSettingInputId('enhance',unitOrId);}
function dpsBaseUnitLimitBreakInputId(unitOrId){return dpsBaseUnitSettingInputId('limitBreak',unitOrId);}
function dpsBaseUnitJewelInputId(unitOrId){return dpsBaseUnitSettingInputId('jewel',unitOrId);}
function dpsBaseUnitVoidPowerInputId(unitOrId){return dpsBaseUnitSettingInputId('voidPower',unitOrId);}
function dpsBaseUnitHasQuantity(unitOrId){
  return !!resolveDpsBaseUnit(unitOrId)?.quantityEnabled;
}
function dpsBaseUnitQuantityIds(){
  return dpsBaseUnitList().filter(dpsBaseUnitHasQuantity).map(unit=>dpsBaseUnitQuantityInputId(unit));
}
function dpsBaseUnitSettingIds(){
  return dpsBaseUnitList().flatMap(unit=>[
    dpsBaseUnitEnhanceInputId(unit),
    ...(dpsBaseUnitSupportsAdvancedOptions(unit) ? DPS_BASE_UNIT_ADVANCED_SETTING_KINDS.map(kind=>dpsBaseUnitSettingInputId(kind,unit)) : [])
  ]);
}
function dpsJewelNames(){
  return Array.isArray(window.DPS_DATA?.DPS_JEWEL_NAMES) ? window.DPS_DATA.DPS_JEWEL_NAMES : [];
}
function normalizeJewelName(value,names){
  const name=String(value ?? '').trim();
  return names.includes(name) ? name : '';
}
function normalizeDpsJewelName(value){return normalizeJewelName(value,dpsJewelNames());}
const DPS_CHRYSOBERYL_NAME='크리소베릴';
const DPS_CHRYSOBERYL_FIXED_STATS=Object.freeze({ad:50,as:25,td:5,ua:10});
const DPS_CHRYSOBERYL_EMPTY_STATS=Object.freeze({ad:0,as:0,td:0,ua:0});
function dpsJewelIsChrysoberyl(name){return String(name || '')===DPS_CHRYSOBERYL_NAME;}
function dpsChrysoberylSettingIsFixed(setting){
  return ['ad','as','td','ua'].every(key=>Number(setting?.[key])===Number(DPS_CHRYSOBERYL_FIXED_STATS[key]));
}
function dpsChrysoberylSettingWithStats(setting,stats){
  return {...setting,ad:stats.ad,as:stats.as,td:stats.td,ua:stats.ua};
}
function normalizeDpsJewelOption(key,value,allowedValues=null){
  const options=allowedValues || window.DPS_DATA?.DPS_JEWEL_INPUT_OPTIONS?.[key];
  if(!Array.isArray(options) || !options.length) return key==='mythic' ? 'N' : 0;
  if(key==='mythic') return options.includes(String(value)) ? String(value) : 'N';
  const number=Number(value);
  return options.includes(number) ? number : Number(options[0]) || 0;
}
function normalizeDpsJewelSetting(value){
  const source=value && typeof value==='object' ? value : {};
  return {
    ad:normalizeDpsJewelOption('ad',source.ad),
    as:normalizeDpsJewelOption('as',source.as),
    td:normalizeDpsJewelOption('td',source.td),
    ua:normalizeDpsJewelOption('ua',source.ua),
    enhance:normalizeDpsJewelOption('enhance',source.enhance),
    mythic:normalizeDpsJewelOption('mythic',source.mythic)
  };
}
function normalizeDpsJewelSettingForName(name,value){
  const setting=normalizeDpsJewelSetting(value);
  if(name==='터쿼이즈' && setting.mythic==='Y'){
    setting.td=normalizeDpsJewelOption('td',value?.td,window.DPS_DATA?.DPS_JEWEL_INPUT_OPTIONS?.turquoiseMythicTd);
  }
  if(!dpsJewelIsChrysoberyl(name)) return setting;
  const stats=dpsChrysoberylSettingIsFixed(setting) ? DPS_CHRYSOBERYL_FIXED_STATS : DPS_CHRYSOBERYL_EMPTY_STATS;
  return dpsChrysoberylSettingWithStats(setting,stats);
}
function normalizeJewelSettings(value,names,normalizeSetting){
  const source=parseJsonObject(value);
  return Object.fromEntries(names.map(name=>[name,normalizeSetting(source[name],name)]));
}
function serializeJewelSettings(value,normalizeSettings){return JSON.stringify(normalizeSettings(value));}
function jewelSettingsObject(elementId,normalizeSettings){
  const element=typeof $==='function' ? $(elementId) : null;
  return normalizeSettings(element?.value || '{}');
}
function normalizeDpsJewelSettings(value){return normalizeJewelSettings(value,dpsJewelNames(),(raw,name)=>normalizeDpsJewelSettingForName(name,raw));}
function serializeDpsJewelSettings(value){return serializeJewelSettings(value,normalizeDpsJewelSettings);}
function dpsJewelSettingsObject(){return jewelSettingsObject('dpsJewelSettings',normalizeDpsJewelSettings);}
const DPS_EMPTY_JEWEL_STATS=Object.freeze({name:'',ad:0,as:0,td:0,ua:0,resist:0,enhance:0,enhanceFlat:0,mythic:'N'});
function dpsJewelFinalStats(name,settings=null){
  const jewelName=normalizeDpsJewelName(name);
  if(!jewelName) return DPS_EMPTY_JEWEL_STATS;
  const source=settings || dpsJewelSettingsObject();
  const input=normalizeDpsJewelSettingForName(jewelName,source?.[jewelName]);
  if(dpsJewelIsChrysoberyl(jewelName) && !dpsChrysoberylSettingIsFixed(input)){
    return {...DPS_EMPTY_JEWEL_STATS,name:jewelName,enhance:input.enhance,mythic:input.mythic};
  }
  const effectKey=input.mythic==='Y' ? 'mythic' : 'legendary';
  const effect=window.DPS_DATA?.DPS_JEWEL_EFFECTS?.[jewelName]?.[effectKey] || {};
  const enhanceTd=input.enhance*(jewelName==='올리빈' ? 6 : 2);
  return {
    name:jewelName,
    ad:input.ad+(Number(effect.ad)||0),
    as:input.as+(Number(effect.as)||0),
    td:input.td+(Number(effect.td)||0)+enhanceTd,
    ua:input.ua+(Number(effect.ua)||0),
    resist:30,
    enhance:input.enhance,
    enhanceFlat:Number(effect.enhanceFlat)||0,
    mythic:input.mythic
  };
}
const DPS_BASE_UNIT_EXTRA_SLOT_COUNT=4;
function dpsBaseUnitAllowsSlotExpansion(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return !!unit && !dpsBaseUnitIsArtifact(unit) && unit.grade!=='슈퍼히든';
}
function normalizeDpsBaseUnitExtraSlotSetting(value){
  const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  const limitBreak=Number(normalizeDpsBaseUnitLimitBreakValue(source.limitBreak ?? source.limit ?? 0))||0;
  const jewelName=normalizeDpsJewelName(source.legendaryMythicJewel ?? source.jewel ?? '');
  return {
    limitBreak,
    legendaryMythicJewel:jewelName
  };
}
function normalizeDpsBaseUnitExtraSettings(value){
  const source=parseJsonObject(value);
  const out={};
  Object.entries(source).forEach(([unitId,raw])=>{
    const unit=dpsBaseUnitById(unitId);
    if(!dpsBaseUnitAllowsSlotExpansion(unit)) return;
    const items=Array.isArray(raw) ? raw : (Array.isArray(raw?.slots) ? raw.slots : []);
    const slots=Array.from({length:DPS_BASE_UNIT_EXTRA_SLOT_COUNT},(_,index)=>normalizeDpsBaseUnitExtraSlotSetting(items[index],unit));
    if(slots.some(item=>item.limitBreak>0 || item.legendaryMythicJewel)) out[unit.id]=slots;
  });
  return out;
}
function serializeDpsBaseUnitExtraSettings(value){return JSON.stringify(normalizeDpsBaseUnitExtraSettings(value));}
function dpsBaseUnitExtraSettingsObject(){
  const el=typeof $==='function' ? $('dpsBaseUnitExtraSettings') : null;
  return normalizeDpsBaseUnitExtraSettings(el?.value || '{}');
}
function dpsBaseUnitExtraSlotSettings(unitOrId,settings=dpsBaseUnitExtraSettingsObject()){
  const unit=resolveDpsBaseUnit(unitOrId);
  const items=unit ? settings[unit.id] : null;
  return Array.from({length:DPS_BASE_UNIT_EXTRA_SLOT_COUNT},(_,index)=>normalizeDpsBaseUnitExtraSlotSetting(items?.[index],unit));
}
function dpsBaseUnitJewelName(unitOrId){
  if(!dpsBaseUnitSupportsAdvancedOptions(unitOrId)) return '';
  const el=typeof $==='function' ? $(dpsBaseUnitJewelInputId(unitOrId)) : null;
  return normalizeDpsJewelName(el?.value || '');
}
function dpsBaseUnitInstanceGroups(unitOrId,quantityOverride,jewelSettings=dpsJewelSettingsObject(),extraSettings=dpsBaseUnitExtraSettingsObject()){
  const unit=resolveDpsBaseUnit(unitOrId);
  if(!unit) return [];
  const quantity=Math.max(1,Number(quantityOverride)||dpsBaseUnitQuantity(unit)||1);
  const groups=[];
  const addGroup=(unitNumber,limitBreak,jewelName,count=1)=>{
    const name=normalizeDpsJewelName(jewelName);
    groups.push({
      count:Math.max(1,Number(count)||1),
      unitNumber,
      limitBreak:dpsBaseUnitCanUseLimitBreak(unit) ? Number(normalizeDpsBaseUnitLimitBreakValue(limitBreak))||0 : 0,
      name,
      stats:dpsJewelFinalStats(name,jewelSettings),
      type:name ? 'named' : 'none'
    });
  };
  addGroup(1,dpsBaseUnitLimitBreakValue(unit),dpsBaseUnitJewelName(unit));
  // 활성화된 슬롯 확장에 한해 2기부터 실제 수량(최대 5기)만 계산합니다.
  const extras=quantity>=2 && dpsBaseUnitHasQuantity(unit) && typeof dpsBaseUnitSlotExpanded==='function' && dpsBaseUnitSlotExpanded(unit)
    ? dpsBaseUnitExtraSlotSettings(unit,extraSettings) : [];
  const extraCount=Math.min(extras.length,Math.max(0,quantity-1));
  for(let index=0;index<extraCount;index++){
    const extra=extras[index];
    addGroup(index+2,extra.limitBreak,extra.legendaryMythicJewel);
  }
  const bareCount=Math.max(0,quantity-groups.length);
  if(bareCount>0) addGroup(groups.length+1,0,'',bareCount);
  // 토파즈는 장착한 1기와 같은 유닛의 다른 1기에 고유 옵션만 추가한다.
  // 상대 유닛이 다른 쥬얼을 장착해도 기존 능력치는 그대로 유지한다.
  const topazIndex=groups.findIndex(group=>group.name==='토파즈');
  if(quantity>=2 && topazIndex>=0){
    const holder=groups[topazIndex];
    const target=groups.find((_,index)=>index!==topazIndex);
    if(target){
      const effect=window.DPS_DATA?.DPS_JEWEL_EFFECTS?.['토파즈']?.[holder.stats.mythic==='Y' ? 'mythic' : 'legendary'] || {};
      target.stats={...target.stats,as:target.stats.as+(Number(effect.as)||0),td:target.stats.td+(Number(effect.td)||0)};
    }
  }
  return groups;
}
function dpsBaseUnitJewelStats(unitOrId,settings=null){
  return dpsJewelFinalStats(dpsBaseUnitJewelName(unitOrId),settings);
}
function dpsBaseUnitQuantityLimit(){
  const baseLimit=vs('coopMode')==='ON' ? 16 : 8;
  const septemberNormal=monthRuneCount('sep','normal');
  return baseLimit + septemberNormalBoardQuantityBonus(septemberNormal);
}
// 저장소는 현재 화면의 모드·룬과 무관하게 모든 유효 수량을 보존한다.
// 실제 게임 모드의 수량 제한은 상태 적용 후 화면 동기화 단계에서 적용한다.
function normalizeDpsBaseUnitQuantityStorageValue(value){
  const maximum=16+septemberNormalBoardQuantityBonus(6);
  return String(normalizedIntegerRange(value,0,maximum,0));
}
function normalizeDpsBaseUnitQuantityValue(value){
  const limit=dpsBaseUnitQuantityLimit();
  return String(Math.max(0, Math.min(limit, Math.round(Number(value) || 0))));
}
function normalizeDpsBaseUnitEnhanceValue(value, fallback=0){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  const parsed=raw==='' ? Number(fallback) : Number(raw);
  const clamped=Math.max(0, Math.min(1000, Number.isFinite(parsed) ? parsed : Number(fallback)||0));
  return String(Math.round(clamped*100)/100);
}
function normalizeDpsBaseUnitLimitBreakValue(value){return String(normalizedIntegerRange(value,0,6,0));}
function normalizeDpsBaseUnitVoidPowerValue(value){return normalizeOnOffValue(value,'OFF');}
function dpsBaseUnitVoidPowerLimit(){return 20;}
function dpsBaseUnitQuantity(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  if(!dpsBaseUnitHasQuantity(unit)) return 1;
  const el=typeof $==='function' ? $(dpsBaseUnitQuantityInputId(unit)) : null;
  return Number(normalizeDpsBaseUnitQuantityValue(el?.value ?? 0));
}
function dpsBaseUnitEnhanceValue(unitOrId,jewelName=null){
  if(!dpsBaseUnitCanUseEnhance(unitOrId,jewelName)) return 0;
  const el=typeof $==='function' ? $(dpsBaseUnitEnhanceInputId(unitOrId)) : null;
  return Number(normalizeDpsBaseUnitEnhanceValue(el?.value, 0));
}
function dpsBaseUnitLimitBreakValue(unitOrId){
  if(!dpsBaseUnitCanUseLimitBreak(unitOrId)) return 0;
  const el=typeof $==='function' ? $(dpsBaseUnitLimitBreakInputId(unitOrId)) : null;
  return Number(normalizeDpsBaseUnitLimitBreakValue(el?.value));
}
function dpsBaseUnitVoidPowerEnabledIds(){
  const selectedIds=dpsBaseUnitSelectionIds(dpsBaseUnitStorageValue());
  if(!selectedIds.includes('prodNarud')) return new Set();
  const enabled=new Set();
  let used=0;
  selectedIds.forEach(unitId=>{
    const unit=dpsBaseUnitById(unitId);
    const el=typeof $==='function' ? $(dpsBaseUnitVoidPowerInputId(unit)) : null;
    if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit) || unit.id==='prodNarud' || normalizeDpsBaseUnitVoidPowerValue(el?.value)!=='ON') return;
    const cost=dpsBaseUnitHasQuantity(unit) ? Math.max(0,dpsBaseUnitQuantity(unit)) : 1;
    if(used+cost>dpsBaseUnitVoidPowerLimit()) return;
    used+=cost;
    enabled.add(unit.id);
  });
  return enabled;
}
function dpsBaseUnitVoidPowerOn(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return !!unit && dpsBaseUnitSupportsAdvancedOptions(unit) && dpsBaseUnitVoidPowerEnabledIds().has(unit.id);
}
function dpsBaseUnitIdSet(){
  return new Set(dpsBaseUnitList().map(unit=>unit.id));
}
function normalizeDpsBaseUnitsValue(value){
  const allId=dpsBaseUnitAllId();
  const validIds=dpsBaseUnitIdSet();
  const limit=dpsBaseUnitSelectionLimit();
  const source=Array.isArray(value) ? value : String(value ?? '').split(DPS_BASE_UNIT_STORAGE_SEPARATOR);
  const ids=[];
  source.forEach(item=>{
    const id=String(item ?? '').trim();
    if(!id || ids.includes(id) || ids.length>=limit) return;
    if(id===allId){
      dpsBaseUnitList().filter(unit=>!dpsBaseUnitIsArtifact(unit)).slice(0,limit).forEach(unit=>{
        if(!ids.includes(unit.id)) ids.push(unit.id);
      });
      return;
    }
    if(validIds.has(id)) ids.push(id);
  });
  return ids.join(DPS_BASE_UNIT_STORAGE_SEPARATOR);
}
function dpsBaseUnitSelectionIds(value){
  const normalized=normalizeDpsBaseUnitsValue(value);
  return normalized ? normalized.split(DPS_BASE_UNIT_STORAGE_SEPARATOR).filter(Boolean) : [];
}
function dpsBaseUnitStorageValue(){
  const el=typeof $==='function' ? $('dpsBaseUnits') : null;
  return normalizeDpsBaseUnitsValue(el ? el.value : '');
}
function selectedDpsBaseUnits(value=dpsBaseUnitStorageValue()){
  const ids=dpsBaseUnitSelectionIds(value);
  const units=dpsBaseUnitList();
  if(ids.includes(dpsBaseUnitAllId())) return units.filter(unit=>!dpsBaseUnitIsArtifact(unit));
  const idSet=new Set(ids);
  return units.filter(unit=>idSet.has(unit.id));
}

function nonNegativeNumber(value){
  return Math.max(0, Number(value) || 0);
}
function totalDpsPierce(...values){
  return values.reduce((sum,value)=>sum + nonNegativeNumber(value), 0);
}
function dpsBaseUnitDehakaShardDpsMultiplier(unit){
  return unit?.id==='prodDehaka' && shardValue('xerusShard')>=1000 ? 1.25 : 1;
}
function dpsBaseUnitDehakaShardPierceBonus(unit){
  return unit?.id==='prodDehaka' && shardValue('xerusShard')>=3000 ? 10 : 0;
}
function dpsBaseUnitPierceBonus(unit){
  return nonNegativeNumber(unit?.armorPierceBonus)+dpsBaseUnitDehakaShardPierceBonus(unit);
}
const DPS_BASE_UNIT_RACE_SHARD_RULES=Object.freeze({
  '테란 바이오닉':Object.freeze({inputId:'coralShard',minimum:2500}),
  '테란 메카닉':Object.freeze({inputId:'coralShard',minimum:3000}),
  '플토 바이오닉':Object.freeze({inputId:'aiurShard',minimum:2500}),
  '플토 메카닉':Object.freeze({inputId:'aiurShard',minimum:3000}),
  '저그':Object.freeze({inputId:'xerusShard',minimum:2500}),
  '중립':Object.freeze({inputId:'xerusShard',minimum:3000})
});
function dpsBaseUnitSingleRaceUpgradeLevel(race){
  const normalizedRace=String(race||'').trim();
  const optionLevel=hasRuneOption('raceAll1') ? 1 : (vs('raceOpt')===normalizedRace ? 1 : 0);
  const shardRule=DPS_BASE_UNIT_RACE_SHARD_RULES[normalizedRace];
  const shardLevel=shardRule && shardValue(shardRule.inputId)>=shardRule.minimum ? 1 : 0;
  return optionLevel+shardLevel;
}
function dpsBaseUnitUpgradeLevel(unit){
  const races=String(unit?.upgradeRace||'').split('&').map(value=>value.trim()).filter(Boolean);
  return races.reduce((sum,race)=>sum+dpsBaseUnitSingleRaceUpgradeLevel(race),0);
}
function dpsBaseUnitWeaponAttack(unit){
  const tiers=Array.isArray(unit?.weaponAttackTiers) && unit.weaponAttackTiers.length
    ? unit.weaponAttackTiers
    : [nonNegativeNumber(unit?.weaponAttack)];
  const tierIndex=Math.max(0,Math.min(dpsBaseUnitUpgradeLevel(unit),tiers.length-1));
  let attack=nonNegativeNumber(tiers[tierIndex]);
  return attack;
}
/* 유닛 보드 전투 모드·적 방어 효과 */
const DPS_BASE_UNIT_ENEMY_BUFF_DIFFICULTIES=new Set(['Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final','Hall Of Fame','Abyss road','Deep Abyss','도전의 탑','행성탐사-코랄','행성탐사-아이어','행성탐사-제루스']);
const DPS_SPEC_FIXED_INVULNERABILITY_DIFFICULTIES=new Set(['Hall Of Fame','Abyss road','Deep Abyss']);
const DPS_SPEC_FIXED_INVULNERABILITY_TIME_LOSS=4;
const DPS_BASE_UNIT_INVULNERABILITY_TIME_LOSS=5;
function specDpsInvulnerabilityTimeLoss(diffName=vs('diff')){
  return DPS_SPEC_FIXED_INVULNERABILITY_DIFFICULTIES.has(difficultyName(diffName))
    ? DPS_SPEC_FIXED_INVULNERABILITY_TIME_LOSS : 0;
}
function dpsBaseUnitInvulnerabilityTimeLoss(diffName=vs('diff')){
  return DPS_BASE_UNIT_ENEMY_BUFF_DIFFICULTIES.has(difficultyName(diffName))
    ? DPS_BASE_UNIT_INVULNERABILITY_TIME_LOSS : 0;
}
function dpsBaseUnitRoundTime(round,diffName=vs('diff')){
  return roundTimeAfterSpeedAndLoss(
    enemyRoundTime(round,diffName),
    unifiedDpsSpeedModeEnabled(diffName),
    dpsBaseUnitInvulnerabilityTimeLoss(diffName)
  ).finalTime;
}
function dpsBaseUnitEnemyProtectionFactor(diffName=vs('diff')){
  if(!DPS_BASE_UNIT_ENEMY_BUFF_DIFFICULTIES.has(difficultyName(diffName))) return 1;
  const rawSuperShieldFactor=1-0.667*30/(30+35);
  const superShieldFactor=hasRuneOption('shieldImmune') ? 1 : Math.round(rawSuperShieldFactor*1000)/1000;
  const stealthFactor=0.999;
  return Math.max(0.000001,Math.min(superShieldFactor,stealthFactor));
}
function dpsBaseUnitExpectationMultiplier(diffName=vs('diff')){
  const fogMultiplier=on('flowerSkill3') ? 1.075 : 1;
  const modeMultiplier=battleDataModeKeyForDifficulty(diffName)==='eternal' ? 0.8 : 1;
  const contentMultiplier=(isTowerDifficulty(diffName) || isPlanetExplorationDifficulty(diffName)) ? 0.9 : 0.8;
  return fogMultiplier*modeMultiplier*contentMultiplier;
}
function dpsBaseUnitRequiredDurability(enemyData,displayHR,displaySR){
  const hp=Math.max(0,Number(enemyData?.hp)||0);
  const shield=Math.max(0,Number(enemyData?.shield)||0);
  const total=hp+shield;
  if(total<=0) return 1;
  const hpRatio=hp/total;
  const shieldRatio=shield/total;
  const weightedHpReduce=Math.max(0,Number(displayHR)||0)*hpRatio;
  const weightedShieldReduce=Math.max(0,Number(displaySR)||0)*shieldRatio;
  return Math.max(1,total*(1-(weightedHpReduce+weightedShieldReduce)/100));
}
function dpsBaseUnitRequiredEnemyCount(enemyData){
  return Math.max(0,Number(enemyData?.count)||0);
}
function dpsBaseUnitTargetProfiles({enemyData,defenseReduce,displayHR,displaySR,diffName=vs('diff')}){
  const count=dpsBaseUnitRequiredEnemyCount(enemyData,diffName);
  const profiles=[{
    player:1,
    count,
    defenseReduce:Number(defenseReduce)||0,
    hpReduce:Number(displayHR)||0,
    shieldReduce:Number(displaySR)||0
  }];
  const playerCount=battleEnemyCountMultiplier(diffName);
  for(let player=2; player<=playerCount; player++){
    profiles.push({
      player,
      count,
      defenseReduce:player===3 ? coopPassengerDefenseReduceValue('coopPassenger3Dr') : coopPassengerDefenseReduceValue('coopPassenger2Dr'),
      hpReduce:0,
      shieldReduce:0
    });
  }
  return profiles.map(profile=>({
    ...profile,
    durability:dpsBaseUnitRequiredDurability(enemyData,profile.hpReduce,profile.shieldReduce)
  }));
}
function dpsBaseUnitRequiredDps({enemyData,defenseReduce,dmgReduce,round,displayHR,displaySR,diffName=vs('diff')}){
  const clearTime=dpsBaseUnitRoundTime(round,diffName);
  const enemyArmor=Math.max(0,Number(enemyData?.armor)||0);
  const protectionFactor=dpsBaseUnitEnemyProtectionFactor(diffName);
  const profiles=dpsBaseUnitTargetProfiles({enemyData,defenseReduce,displayHR,displaySR,diffName});
  if(clearTime<=0 || protectionFactor<=0) return 0;
  const requiredWork=profiles.reduce((sum,profile)=>{
    if(profile.count<=0 || profile.durability<=0) return sum;
    const defenseMultiplier=dps0(1,enemyArmor,profile.defenseReduce,0,dmgReduce);
    if(defenseMultiplier<=0) return sum;
    return sum+(profile.count*profile.durability)/(defenseMultiplier*protectionFactor);
  },0);
  return requiredWork/clearTime;
}

const DPS_BASE_UNIT_LIMIT_BREAK_STATS=Object.freeze([
  Object.freeze({ad:0,ua:0,td:0}),Object.freeze({ad:50,ua:0,td:0}),Object.freeze({ad:100,ua:0,td:0}),
  Object.freeze({ad:175,ua:10,td:0}),Object.freeze({ad:300,ua:20,td:0}),Object.freeze({ad:500,ua:30,td:0}),
  Object.freeze({ad:500,ua:30,td:20})
]);
function dpsBaseUnitLimitBreakStats(unitOrId,explicitValue=null){
  const value=explicitValue===null ? dpsBaseUnitLimitBreakValue(unitOrId) : Number(normalizeDpsBaseUnitLimitBreakValue(explicitValue));
  return DPS_BASE_UNIT_LIMIT_BREAK_STATS[value] || DPS_BASE_UNIT_LIMIT_BREAK_STATS[0];
}
function dpsBaseUnitRaceCritBonus(unit, round){
  const table=window.DPS_DATA?.DPS_BASE_UNIT_RACE_CRIT_BONUS || {};
  const key=unit?.raceCritKey || unit?.raceGroup || '';
  const values=table[key];
  if(!Array.isArray(values) || !values.length) return 0;
  const index=((Math.round(Number(round)||0)%5)+5)%5;
  return Number(values[index]) || 0;
}
const DPS_BASE_UNIT_PLANET_REGION_TOKENS=Object.freeze({
  coral:Object.freeze(['테바','테메']),
  aiur:Object.freeze(['프바','프메','토바','토메']),
  xerus:Object.freeze(['저그','중립'])
});
function dpsBaseUnitRaceTokenText(unit){
  return [unit?.raceCritKey, unit?.raceGroup, unit?.upgradeRace].filter(Boolean).join(' ');
}
function dpsBaseUnitIsHybrid(unit){
  return unit?.raceGroup==='혼종' || String(unit?.upgradeRace||'').includes('&');
}
function dpsBaseUnitPlanetCritDamageMultiplier(unit, diffName=vs('diff')){
  const region=planetExplorationRegion(diffName);
  if(!region) return 1;
  const tokens=DPS_BASE_UNIT_PLANET_REGION_TOKENS[region] || [];
  const raceText=dpsBaseUnitRaceTokenText(unit);
  const matched=tokens.some(token=>raceText.includes(token));
  if(!matched) return 0.1;
  return dpsBaseUnitIsHybrid(unit) ? 1 : 1.25;
}
function dpsBaseUnitUniqueAdBonus(unit,enhanceStats=unitEnhanceStats()){
  if(unit?.productionUnit) return 0;
  return SYSTEM_COMMON_BUFFS.uniqueUnit.baseAd + septemberPlusUniqueAdBonus(enhanceStats.septemberPlus);
}
function dpsBaseUnitPrivateAd(unit, quantity, jewelStats=dpsBaseUnitJewelStats(unit), jewelName=dpsBaseUnitJewelName(unit), limitBreakValue=dpsBaseUnitLimitBreakValue(unit), enhanceStats=null){
  const limitBreak=dpsBaseUnitLimitBreakStats(unit,limitBreakValue);
  const enhance=dpsBaseUnitEnhanceValue(unit,jewelName)+(Number(jewelStats?.enhanceFlat)||0);
  const uniqueBuff=dpsBaseUnitUniqueAdBonus(unit,enhanceStats || undefined);
  const duplicatePenalty=Math.max(Math.max(1,Number(quantity)||1)-8,0)*10;
  const jewelStackAd=jewelName==='라피스' ? 200 : (jewelName==='헬리오도르' ? -200 : 0);
  return UNIT_GRADE_AD.S + 11*5 + uniqueBuff + limitBreak.ad + enhance + (Number(jewelStats?.ad)||0) + jewelStackAd
    + nonNegativeNumber(unit?.killCountAdBonus) - duplicatePenalty - abyssAdPenalty(jewelStats?.resist);
}
function dpsBaseUnitAttackRate(unit, context){
  const weaponSpeed=Number(unit?.weaponSpeed) || 0;
  const targetsPerAttack=Number(unit?.targetCount) || 0;
  const attackCount=Number(unit?.attackCount) || 0;
  if(weaponSpeed<=0 || targetsPerAttack<=0 || attackCount<=0){
    return {rate:0,cooldown:0,targetsPerAttack:0,maxSpeedCooldown:0,isMaxAttackSpeed:false};
  }
  const limitBreak=dpsBaseUnitLimitBreakStats(unit,context?.limitBreak ?? 0);
  const difficultySlow=Math.max(0.000001,1-(Number(context?.difficultyAs)||0)/100);
  const ua=Math.max(0.000001,Number(context?.ua)||1);
  const dt=Math.max(0.000001,Number(context?.dt)||1);
  const jewelStats=context?.jewelStats || dpsBaseUnitJewelStats(unit);
  const privateUa=(1+limitBreak.ua/100)*(1+(Number(jewelStats?.ua)||0)/100);
  const voidPowerEnabled=context && hasOwn(context,'voidPower') ? context.voidPower===true : dpsBaseUnitVoidPowerOn(unit);
  const voidPowerAs=voidPowerEnabled ? 50 : 0;
  const speedStat=(Number(context?.attackSpeed)||0)+(Number(jewelStats?.as)||0);
  const flowerAs=Number(context?.flowerAttackSpeed)||0;
  const uniqueSpeed=Math.max(0.000001,1+(Number(unit?.attackSpeedMultiplier)||0));
  const speedMultiplier=Math.max(0.000001,(1+(speedStat+flowerAs+voidPowerAs)/100)*difficultySlow*ua*dt*privateUa*uniqueSpeed);
  const speedModeMultiplier=unifiedDpsSpeedModeEnabled() ? SPEED_MODE_MULTIPLIER : 1;
  const adjustedCooldown=Math.round((weaponSpeed/(speedMultiplier*speedModeMultiplier))*10000)/10000;
  const asLimit=Math.max(0,Number(unit?.asLimit)||0);
  const configuredMaxCooldown=Math.max(0,Number(unit?.maxCooldown)||0);
  const limitMultiplier=Math.max(0.000001,difficultySlow*ua*dt*privateUa);
  const limitCooldown=asLimit>0 ? asLimit/limitMultiplier : 0;
  const maxSpeedCooldown=configuredMaxCooldown>0 ? configuredMaxCooldown : Math.max(0.0625,limitCooldown);
  const cooldown=Math.max(adjustedCooldown,maxSpeedCooldown);
  const isMaxAttackSpeed=adjustedCooldown<=maxSpeedCooldown+0.000001;
  const rate=attackCount/Math.max(0.000001,cooldown);
  return {rate,cooldown,targetsPerAttack,maxSpeedCooldown,isMaxAttackSpeed};
}
function dpsBaseUnitSingleDpsParts(unit,context,jewelStats,jewelName='',limitBreakValue=0){
  const limitBreak=dpsBaseUnitLimitBreakStats(unit,limitBreakValue);
  const unitEffectivePierce=totalDpsPierce(context.rpPierce,context.unitPierceBonus);
  const privateAd=dpsBaseUnitPrivateAd(unit,context.totalQuantity,jewelStats,jewelName,limitBreakValue,context.enhanceStats);
  const adTdMultiplier=(1+(context.globalAd+privateAd)/100)*((context.M11+limitBreak.td+(Number(jewelStats?.td)||0))/100);
  const raceCritBonus=dpsBaseUnitRaceCritBonus(unit,context.targetRound);
  const planetCritMultiplier=dpsBaseUnitPlanetCritDamageMultiplier(unit, context.diffName);
  const unitCd=context.M9*(1+raceCritBonus)*planetCritMultiplier;
  const critMultiplier=dps2(context.M8,context.M10,unitCd,context.M16,context.M17,context.M18,unit?.critFormula==='방사' ? 1 : 0);
  const attackRate=dpsBaseUnitAttackRate(unit,{attackSpeed:context.M7,flowerAttackSpeed:context.flowerAttackSpeed,difficultyAs:context.difficultyAs,ua:context.M13,dt:context.dt,jewelStats,limitBreak:limitBreakValue,voidPower:context.voidPower});
  const noPierceDps0=dps0(1,context.enemyArmor,context.M12,0,100);
  const pierceDps0=dps0(1,context.enemyArmor,context.M12,unitEffectivePierce,100);
  const armorPierceMultiplier=noPierceDps0>0 ? pierceDps0/noPierceDps0 : 1;
  const uniqueDpsMultiplier=(1+(Number(unit?.dpsMultiplier)||0))*dpsBaseUnitDehakaShardDpsMultiplier(unit);
  const singleTargetRawM19=context.weaponAttack*adTdMultiplier*critMultiplier*attackRate.rate*armorPierceMultiplier*uniqueDpsMultiplier;
  const rawM19=singleTargetRawM19*attackRate.targetsPerAttack;
  return {
    rawM19,singleTargetRawM19,AB3:armorPierceMultiplier,AB4:adTdMultiplier,AB5:critMultiplier,AB6:attackRate.rate,
    effectivePierce:unitEffectivePierce,raceCritBonus,planetCritMultiplier,finalCooldown:attackRate.cooldown,maxSpeedCooldown:attackRate.maxSpeedCooldown,
    isMaxAttackSpeed:attackRate.isMaxAttackSpeed,targetsPerAttack:attackRate.targetsPerAttack,
    jewelName,jewelStats,limitBreak:Number(normalizeDpsBaseUnitLimitBreakValue(limitBreakValue))||0
  };
}

function dpsBaseUnitArtifactConfig(){
  return window.DPS_DATA?.ARTIFACT_DPS_CONFIG || {};
}
function dpsBaseUnitArtifactRaceUpgradeLevel(){
  const config=dpsBaseUnitArtifactConfig();
  const races=Array.isArray(config.upgradeRaces) ? config.upgradeRaces : ['테란 바이오닉','테란 메카닉','플토 바이오닉','플토 메카닉','저그','중립'];
  const base=Math.max(0,Number(config.baseRaceUpgradeLevel)||120);
  return base+races.reduce((sum,race)=>sum+dpsBaseUnitSingleRaceUpgradeLevel(race),0);
}
function dpsBaseUnitArtifactWeaponStats(displayAP){
  const config=dpsBaseUnitArtifactConfig();
  const baseWeaponAttack=Math.max(0,Number(config.baseWeaponAttack)||500);
  const apBonus=Math.floor(Math.max(0,Number(displayAP)||0)/10);
  const raceUpgradeLevel=dpsBaseUnitArtifactRaceUpgradeLevel();
  const raceUpgradeAttack=raceUpgradeLevel*Math.max(0,Number(config.raceUpgradeAttackPerLevel)||2.5);
  const enhance=dpsBaseUnitEnhanceValue(config.unitId || 'artifactUnit');
  const weaponAttack=baseWeaponAttack+apBonus+raceUpgradeAttack;
  return {baseWeaponAttack,apBonus,raceUpgradeLevel,raceUpgradeAttack,enhance,weaponAttack};
}
function dpsBaseUnitArtifactWaveTiming(context){
  const config=dpsBaseUnitArtifactConfig();
  const baseCooldown=Math.max(0.001,Number(config.baseWaveCooldown)||4);
  const minimumInterval=Math.max(0.001,Number(config.minimumWaveInterval)||0.001);
  const accelerationValue=Number(context?.M13);
  const uaMultiplier=Number.isFinite(accelerationValue) && accelerationValue>0 ? accelerationValue : 1;
  const difficultySlow=Math.max(0.000001,1-(Number(context?.difficultyAs)||0)/100);
  const dtMultiplier=Math.max(0.000001,Number(context?.dt)||1);
  const energyRegenMultiplier=Math.max(0.000001,Number(context?.artifactEnergyRegen)||artifactEnergyRegenMultiplier());
  const speedModeEnabled=context && Object.prototype.hasOwnProperty.call(context,'speedModeEnabled')
    ? !!context.speedModeEnabled
    : unifiedDpsSpeedModeEnabled(context?.diffName);
  const speedModeMultiplier=speedModeEnabled ? SPEED_MODE_MULTIPLIER : 1;
  const accelerationMultiplier=difficultySlow*uaMultiplier*dtMultiplier*energyRegenMultiplier*speedModeMultiplier;
  const interval=Math.max(minimumInterval,baseCooldown/Math.max(0.000001,accelerationMultiplier));
  const waveRate=1/interval;
  return {rate:waveRate,cooldown:interval,interval,waveCount:waveRate,baseCooldown,accelerationMultiplier};
}
function dpsBaseUnitArtifactTargetCount(){
  const config=dpsBaseUnitArtifactConfig();
  return Math.max(1,Math.round(Number(config.waveTargetCount)||60));
}
function dpsBaseUnitArtifactDpsParts(unit,context){
  const enhance=dpsBaseUnitEnhanceValue(unit);
  const adTdMultiplier=(1+((Number(context.globalAd)||0)+enhance)/100)*(Number(context.M11)||0)/100;
  const critMultiplier=dps2(context.M8,context.M10,context.M9,context.M16,context.M17,context.M18,1);
  const timing=dpsBaseUnitArtifactWaveTiming(context);
  const targetCount=dpsBaseUnitArtifactTargetCount();
  const perWaveDamage=context.weaponAttack*adTdMultiplier*critMultiplier;
  const rawM19=perWaveDamage*targetCount*timing.rate;
  return {
    rawM19,perWaveDamage,AB3:1,AB4:adTdMultiplier,AB5:critMultiplier,AB6:timing.rate,effectivePierce:0,
    raceCritBonus:0,finalCooldown:timing.interval,maxSpeedCooldown:timing.interval,isMaxAttackSpeed:false,jewelName:'',jewelStats:dpsJewelFinalStats(''),
    artifactWaveInterval:timing.interval,artifactWaveCount:timing.waveCount,artifactTargetCount:targetCount,
    artifactAcceleration:timing.accelerationMultiplier
  };
}


/* ── 09 · 스펙·유닛 계산 조립 ── */
/* 스펙 보드 / 유닛 보드 계산 결과 분리 */
function computeSpecBoardResult(context){
  const {
    diff,targetRound,upperStats,M4,M7,M8,M10,M9,M16,M17,M18,M11,M12_dr,M13,
    displayHR,displaySR,effectivePierce,enemyData,specEnemyDamageRate,dt
  }=context;
  const ownTargetEffects={
    defenseReduce:M12_dr,
    pierce:effectivePierce,
    hpReduce:displayHR,
    shieldReduce:displaySR
  };
  const ownDurability=targetDurabilityRemain(enemyData,ownTargetEffects);
  const passengerTargets=coopPassengerDurabilityTargets(enemyData);
  const hpRatio=ownDurability.hpRatio;
  const shieldRatio=ownDurability.shieldRatio;
  const hpRemain=ownDurability.remain;
  const M12=M12_dr;
  const actualM12=actualDrWithPierce(M12_dr,effectivePierce);
  const specEnemyArmor=Number(enemyData.armorBase)||0;
  const AB3=battleTargetDps0Average(
    {...ownTargetEffects,hpRemain},
    passengerTargets,
    specEnemyArmor,
    specEnemyDamageRate
  )*upperStats.dps0Mul;
  const AB4=(1+M4/100)*(M11/100);
  const AB5=dps2(M8,M10,M9,M16,M17,M18,0);
  const gradeAs=UNIT_GRADE_AS[activeUnitGrade()] ?? 0;
  const AB6=(1+(M7+upperStats.actualAs+gradeAs)/100)*(1-diff.as/100)*M13*dt*(unifiedDpsSpeedModeEnabled() ? SPEED_MODE_MULTIPLIER : 1);
  const roundTime=specDpsRoundTime(targetRound);
  const rawM19=AB3*AB4*AB5*AB6;
  const displayMultiplier=contentDpsDisplayMultiplier(vs('diff'),targetRound,displayHR,displaySR)*specDpsRoundTimeDpsMultiplier(targetRound,vs('diff'));
  const M19=rawM19*displayMultiplier;
  return {
    hpRatio,shieldRatio,M12,actualM12,AB3,AB4,AB5,AB6,
    roundTime,rawM19,displayMultiplier,M19
  };
}
function computeDpsBaseUnitBoardResult(context){
  const {
    displayAP,basePierceBonus,rpPierce,unitADBonus,upperStats,diff,targetRound,M4,M7,M8,M10,M9,M16,M17,M18,M11,M12_dr,M13,dt,
    enemyData,displayHR,displaySR,requiredEnemyDamageRate,roundTime,enhanceStats,unitListOverride=null
  }=context;
  const dpsBaseUnitSelection=dpsBaseUnitStorageValue();
  const dpsBaseUnits=Array.isArray(unitListOverride)
    ? unitListOverride.filter(unit=>unit && !dpsBaseUnitIsArtifact(unit))
    : selectedDpsBaseUnits(dpsBaseUnitSelection);
  const hasStandardUnits=dpsBaseUnits.some(unit=>!dpsBaseUnitIsArtifact(unit));
  const jewelSettings=hasStandardUnits ? dpsJewelSettingsObject() : null;
  const extraSettings=hasStandardUnits ? dpsBaseUnitExtraSettingsObject() : null;
  const voidPowerEnabledIds=hasStandardUnits ? dpsBaseUnitVoidPowerEnabledIds() : new Set();
  const dpsBaseUnitResults=dpsBaseUnits.map(unit=>{
    if(dpsBaseUnitIsArtifact(unit)){
      const artifactWeapon=dpsBaseUnitArtifactWeaponStats(displayAP);
      const unitContext={
        globalAd:M4,M11,M8,M10,M9,M16,M17,M18,M13,dt,difficultyAs:diff.as,roundTime,
        enemyData,diffName:vs('diff'),displayHR,displaySR,clearDefenseReduce:M12_dr,
        artifactEnergyRegen:artifactEnergyRegenMultiplier(),speedModeEnabled:unifiedDpsSpeedModeEnabled(vs('diff')),
        enemyArmor:enemyData.armor,M12:M12_dr,targetRound,weaponAttack:artifactWeapon.weaponAttack
      };
      const parts=dpsBaseUnitArtifactDpsParts(unit,unitContext);
      const unitTargetEffects={defenseReduce:M12_dr,pierce:0,hpReduce:displayHR,shieldReduce:displaySR};
      return {
        AB3:parts.AB3,AB4:parts.AB4,AB5:parts.AB5,AB6:parts.AB6,
        rawM19:parts.rawM19,M19:Math.round(parts.rawM19),baseRawM19:parts.rawM19,baseM19:Math.round(parts.rawM19),
        effectivePierce:0,unitPierceBonus:0,ownDurability:targetDurabilityRemain(enemyData,unitTargetEffects),
        actualM12:actualDrWithPierce(M12_dr,0),enhance:artifactWeapon.enhance,limitBreak:0,jewelName:'',
        jewelStats:DPS_EMPTY_JEWEL_STATS,jewelGroups:[],voidPower:false,raceCritBonus:0,
        finalCooldown:parts.finalCooldown,maxSpeedCooldown:parts.maxSpeedCooldown,isMaxAttackSpeed:parts.isMaxAttackSpeed,artifactAttackRate:parts.AB6,artifactWaveInterval:parts.artifactWaveInterval,
        artifactWaveCount:parts.artifactWaveCount,artifactTargetCount:parts.artifactTargetCount,
        artifactAcceleration:parts.artifactAcceleration,perWaveDamage:parts.perWaveDamage,
        unitId:unit.id,kind:'artifact',quantity:1,baseWeaponAttack:artifactWeapon.baseWeaponAttack,
        weaponAttack:artifactWeapon.weaponAttack,weaponUpgradeLevel:artifactWeapon.raceUpgradeLevel,
        artifactApBonus:artifactWeapon.apBonus,artifactRaceUpgradeAttack:artifactWeapon.raceUpgradeAttack,
        weaponSpeed:0,asLimit:0,targetCount:0,attackCount:0
      };
    }
    const baseWeaponAttack=nonNegativeNumber(unit.weaponAttack);
    const weaponAttack=dpsBaseUnitWeaponAttack(unit);
    const unitPierceBonus=totalDpsPierce(basePierceBonus,dpsBaseUnitPierceBonus(unit));
    const quantity=Math.max(1,dpsBaseUnitQuantity(unit));
    const quantityMultiplier=dpsBaseUnitHasQuantity(unit) ? quantity : 1;
    const unitMeta={
      unitId:unit.id,
      quantity:quantityMultiplier,
      baseWeaponAttack,
      weaponAttack,
      weaponUpgradeLevel:dpsBaseUnitUpgradeLevel(unit),
      weaponSpeed:Number(unit.weaponSpeed)||0,
      asLimit:Number(unit.asLimit)||0,
      targetCount:Number(unit.targetCount)||0,
      attackCount:Number(unit.attackCount)||0
    };
    const jewelName=dpsBaseUnitJewelName(unit);
    const primaryJewelStats=dpsJewelFinalStats(jewelName,jewelSettings);
    const groups=dpsBaseUnitInstanceGroups(unit,quantityMultiplier,jewelSettings,extraSettings);
    const unitContext={rpPierce,unitPierceBonus,totalQuantity:quantityMultiplier,globalAd:M4-unitADBonus,M11,M8,M10,M9,M16,M17,M18,M7,M13,dt,flowerAttackSpeed:upperStats.actualAs,difficultyAs:diff.as,diffName:vs('diff'),enemyArmor:enemyData.armor,M12:M12_dr,targetRound,weaponAttack,enhanceStats,voidPower:voidPowerEnabledIds.has(unit.id)};
    const groupResults=groups.map(group=>({...group,...dpsBaseUnitSingleDpsParts(unit,unitContext,group.stats,group.name,group.limitBreak)}));
    const unitRawM19=groupResults.reduce((sum,group)=>sum+group.rawM19*group.count,0);
    const unitSingleTargetRawM19=groupResults.reduce((sum,group)=>sum+group.singleTargetRawM19*group.count,0);
    const baseParts=dpsBaseUnitSingleDpsParts(unit,unitContext,DPS_EMPTY_JEWEL_STATS,'',0);
    const displayParts=groupResults[0] || baseParts;
    const unitTargetEffects={defenseReduce:M12_dr,pierce:baseParts.effectivePierce,hpReduce:displayHR,shieldReduce:displaySR};
    return {
      AB3:displayParts.AB3,
      AB4:displayParts.AB4,
      AB5:displayParts.AB5,
      AB6:displayParts.AB6,
      rawM19:unitRawM19,
      M19:Math.round(unitRawM19),
      singleTargetRawM19:unitSingleTargetRawM19,
      singleTargetM19:Math.round(unitSingleTargetRawM19),
      baseRawM19:baseParts.rawM19,
      baseM19:Math.round(baseParts.rawM19),
      baseSingleTargetRawM19:baseParts.singleTargetRawM19,
      baseSingleTargetM19:Math.round(baseParts.singleTargetRawM19),
      effectivePierce:baseParts.effectivePierce,
      unitPierceBonus,
      ownDurability:targetDurabilityRemain(enemyData,unitTargetEffects),
      actualM12:actualDrWithPierce(M12_dr,baseParts.effectivePierce),
      enhance:dpsBaseUnitEnhanceValue(unit,jewelName)+(Number(primaryJewelStats?.enhanceFlat)||0),
      limitBreak:dpsBaseUnitLimitBreakValue(unit),
      jewelName,
      jewelStats:primaryJewelStats,
      jewelGroups:groupResults.map(group=>({unitNumber:group.unitNumber,name:group.name,type:group.type,limitBreak:group.limitBreak,count:group.count,dps:Math.round(group.rawM19*group.count)})),
      voidPower:voidPowerEnabledIds.has(unit.id),
      raceCritBonus:displayParts.raceCritBonus,
      finalCooldown:displayParts.finalCooldown,
      maxSpeedCooldown:displayParts.maxSpeedCooldown,
      isMaxAttackSpeed:displayParts.isMaxAttackSpeed,
      attacksPerSecond:displayParts.AB6,
      targetsPerAttack:displayParts.targetsPerAttack,
      ...unitMeta
    };
  });
  const unitTotalDps=dpsBaseUnitResults.reduce((sum,item)=>sum+(Number(item?.M19)||0),0);
  const expectationMultiplier=dpsBaseUnitExpectationMultiplier(vs('diff'));
  const contentBurdenExpectationMultiplier=isPlanetExplorationDifficulty(vs('diff'))
    ? planetDpsDisplayMultiplier(targetRound,vs('diff'),displayHR,displaySR)
    : 1;
  const expectedDps=unitTotalDps*expectationMultiplier*contentBurdenExpectationMultiplier;
  const requiredDps=dpsBaseUnitRequiredDps({
    enemyData,
    defenseReduce:M12_dr,
    dmgReduce:requiredEnemyDamageRate,
    round:targetRound,
    displayHR,
    displaySR,
    diffName:vs('diff')
  });
  const achievementRate=requiredDps>0 ? expectedDps/requiredDps*100 : 0;
  const differenceDps=expectedDps-requiredDps;
  return {
    selection:dpsBaseUnitSelection,
    selectedIds:Array.isArray(unitListOverride) ? dpsBaseUnits.map(unit=>unit.id) : dpsBaseUnitSelectionIds(dpsBaseUnitSelection),
    basePierceBonus,
    rpPierce,
    isActive:dpsBaseUnitResults.length>0,
    isAll:Array.isArray(unitListOverride) ? false : dpsBaseUnitSelectionIds(dpsBaseUnitSelection).includes(dpsBaseUnitAllId()),
    totalDps:unitTotalDps,
    expectationMultiplier,
    planetBurdenExpectationMultiplier:contentBurdenExpectationMultiplier,
    expectedDps,
    requiredDps,
    achievementRate,
    differenceDps,
    results:dpsBaseUnitResults
  };
}

/* 메인 스탯·DPS 조립 */
function buildStatsCoreRaw(options={}){
  const syncDerivedViews=options.syncDerived!==false;
  const autoEP=syncDerivedViews ? syncAutoEP() : autoEpValue();
  const penaltyContext=currentPenaltyContext();
  const {diff,targetRound,penanceLevel}=penaltyContext;
  const asc=ASC[vs('rAsc')]||ASC['없음'];
  const baseReinf=v('rReinf');
  const reinf=baseReinf + (hasRuneOption('reinf5')?5:0);
  const ascVlookup3=asc[1];
  const ascVlookup4=asc[2];
  const ascVlookup5=asc[3];
  const {ad:shareAD,as:shareAS,cri:shareCRI}=donationBuffStats();
  const dailyCouponCRI=SYSTEM_COMMON_BUFFS.dailyCouponCri;
  const xpStat=xpInputStatBonus();
  const traitStats=calculateTraitStatTotals();
  const enchantStats=currentEnchantStats(syncDerivedViews);
  const epUsedForBuff=resourceUsed('EP');
  const epBuff=Math.floor(Math.max(0, autoEP-epUsedForBuff)/20);
  const gradeCri=enchantStats[1].cri;
  const unitADBonus=unitADPrivateBonus();
  const optionStats=getRuneOptionStats();
  const specialRune=getSpecialRuneStats(optionStats);
  const upperStats=upperOptionStats();
  const transcendDR=optionStats.dr;
  const gradeTD=enchantStats[3].td;
  const cd50opt=optionStats.cd;
  const additionalStats=effectiveAdditionalStats();
  const rawDisplayAP = (traitStats.AP||0) + (optionStats.ap||0) + specialRune.ap + additionalStats.ap;
  const displayAP = cappedDisplayAp(rawDisplayAP);
  const AP9 = (traitStats.AD||0) + v('rAD') + optionStats.ad + upperStats.ad + ascVlookup3 + reinf + v('rModAD')
            + v('pbless') + shareAD + xpStat.ad + enchantStats[0].ad + epBuff
            + growthGraduationAttackBonus() + additionalStats.ad;
  const AP10 = -diff.ad;
  const M4 = AP9 + AP10 + unitADBonus + upperStats.actualAd;
  const M7_base = (traitStats.AS||0) + v('rAS') + upperStats.as + ascVlookup4 + reinf + shareAS + xpStat.as + v('rModAS') + additionalStats.as;
  const M7 = M7_base;
  const M8 = (traitStats.CRI||0) + v('rCRI') + v('rModCRI') + reinf + dailyCouponCRI + shareCRI + xpStat.cri + gradeCri + optionStats.cri + upperStats.cri + additionalStats.cri;
  const rawCD = 100 + (traitStats.CD||0) + v('rCD') + cd50opt + upperStats.cd + ascVlookup5 + additionalStats.cd + v('rModCD');
  const criOver300 = M8>=300 ? (M8>=400?5:Math.floor((M8-300)/20)) : 0;
  const M10 = (traitStats.MC||0) + (asc[5]||0) + criOver300 + optionStats.mc;
  const rawTD = (traitStats.TD||0) + specialRune.td + gradeTD + upperStats.td + (asc[6]||0) + optionStats.td + v('titleTdBonus') + additionalStats.td;
  const abyssTdReduction=abyssTdPenalty();
  const M12_dr = (traitStats.DR||0) + transcendDR + (asc[4]||0) + additionalStats.dr;
  const displayUA = uaProd() * optionStats.uaMul * upperStats.uaMul * enchantStats[2].ua * (1 + specialRune.ua/100) * (1 + additionalStats.ua/100);
  const abyssSlow=abyssSlowMultiplier();
  const M16=traitStats.MD||0, M17=20+(INV[101]||0)*0.2, M18=(INV[102]||0)*0.5;
  const enemyData=enemyRoundData(targetRound);
  const displaySR = (traitStats.SR||0) + enchantStats[4].sr + additionalStats.sr;
  const displayHR = enchantStats[5].hr + additionalStats.hr;
  const specBoardPierceBonus=typeof specBoardPierceValue==='function' ? specBoardPierceValue() : 0;
  const basePierceBonus=SYSTEM_COMMON_BUFFS.basePierce;
  const rpPierce = rpPierceBonus();
  const effectivePierce=totalDpsPierce(specBoardPierceBonus,rpPierce);
  const dt=personalUaDtMultiplier();
  return {
    diff,targetRound,penanceLevel,asc,rawDisplayAP,displayAP,AP9,M4,M7,M8,rawCD,M10,rawTD,
    abyssTdReduction,M12_dr,displayUA,abyssSlow,M16,M17,M18,enemyData,displaySR,displayHR,
    specBoardPierceBonus,basePierceBonus,rpPierce,effectivePierce,dt,autoEP,epBuff,isAbyss:isAbyssDifficulty(),upperStats,unitADBonus
  };
}
function computeStatsFromCoreRaw(core,options={}){
  const extendedResults=options.extended!==false;
  const penanceLevel=options.previewPenanceLevel ?? options.penanceLevel ?? core.penanceLevel;
  const {diff,M4,M7,M8,M10,M16,M17,M18,rawCD,rawTD}=core;
  const penCD=PEN_CD[penanceLevel];
  const penTD=PEN_TD[penanceLevel];
  const penDmg=PEN_DMG[penanceLevel];
  const penUA=PEN_UA[penanceLevel];
  const M9=core.rawCD * (1 - penCD/100);
  const tdReduce=penTD + core.abyssTdReduction;
  const actualTD=core.isAbyss ? 100 + core.rawTD - tdReduce : core.rawTD - tdReduce;
  const M11=core.isAbyss ? actualTD : 100 + actualTD;
  const M13=core.displayUA * (1 - penUA/100) * core.abyssSlow;
  const specEnemyDamageRate=core.diff.dmg*(1-penDmg/100);
  const requiredEnemyDamageRate=specEnemyDamageRate*(Number(core.enemyData.damageMultiplier)||1);
  const specBoard=computeSpecBoardResult({
    diff,targetRound:core.targetRound,upperStats:core.upperStats,M4,M7,M8,M10,M9,M16,M17,M18,M11,M12_dr:core.M12_dr,M13,
    displayHR:core.displayHR,displaySR:core.displaySR,effectivePierce:core.effectivePierce,enemyData:core.enemyData,specEnemyDamageRate,dt:core.dt
  });
  const {hpRatio,shieldRatio,M12,actualM12,roundTime,rawM19,displayMultiplier,M19}=specBoard;

  const enhanceStats=extendedResults ? unitEnhanceStats() : null;
  const dpsBaseUnit=extendedResults ? computeDpsBaseUnitBoardResult({
    displayAP:core.displayAP,basePierceBonus:core.basePierceBonus,rpPierce:core.rpPierce,unitADBonus:core.unitADBonus,upperStats:core.upperStats,diff:core.diff,targetRound:core.targetRound,M4:core.M4,M7:core.M7,M8:core.M8,M10:core.M10,M9,M16:core.M16,M17:core.M17,M18:core.M18,M11,M12_dr:core.M12_dr,M13,dt:core.dt,
    enemyData:core.enemyData,displayHR:core.displayHR,displaySR:core.displaySR,requiredEnemyDamageRate,roundTime,enhanceStats,
    unitListOverride:options.dpsBaseUnitListOverride || null
  }) : null;
  const resourceUsage=extendedResults ? resourceUsageSnapshot() : null;
  const spU=resourceUsage?.spU || 0;
  const spO=resourceUsage?.spO || 0;
  const epU=resourceUsage?.epU || 0;
  const rpU=resourceUsage?.rpU || 0;
  const soulU=resourceUsage?.soulU || 0;
  const displayAD = Math.ceil(core.AP9 * (1 + rawTD/100));
  const displayCD = rawCD;
  const actualCD = M9;
  const displayAPS = core.displayAP;
  const displayAPU = core.displayAP;
  const actualAPU = extendedResults
    ? core.rawDisplayAP + (enhanceStats.value || 0) + (on('flowerSkill1') ? 40 : 0) + SYSTEM_COMMON_BUFFS.uniqueUnit.actualAp + (v('unitLevel') || 11) * 5
    : null;
  const actualSR = core.displaySR * shieldRatio;
  const actualHR = core.displayHR * hpRatio;
  return {M4,M7,M8,M9,M10,M11,M12,actualM12,M13,M16,M17,M18,M19,rawM19,roundTime,displayMultiplier,rawCD,rawTD,diff,
          displayAD,displayCD,actualCD,displayAPS,displayAPU,actualAPU,displayUA:core.displayUA,displaySR:core.displaySR,displayHR:core.displayHR,actualSR,actualHR,
          spUsedTotal:spU+spO,spU,spO,epU,rpU,soulU,
          spBank:extendedResults ? effectiveSpBankBonus() : null,
          spBankApplied:extendedResults ? isSpBankApplied() : null,
          effectiveSP:extendedResults ? effectiveSP() : null,
          effectivePierce:core.effectivePierce,enemyData:core.enemyData,dpsBaseUnit,enhanceStats};
}
function computeStatsRaw(options={}){
  const core=options.previewCore || buildStatsCoreRaw(options);
  return computeStatsFromCoreRaw(core,options);
}
function computeLightweightStatsRaw(options={}){
  return computeStatsRaw({...options,extended:false,syncDerived:false});
}

/* ── 10 · 유물 DPS 및 미리보기 ── */
/* 유물 DPS */
function floorPenaltyLevelForDifficulty(diffName, targetRound){
  const name=difficultyName(diffName);
  const floor=Math.max(0, Math.round(Number(targetRound)||0));
  if(name===TOWER_DIFFICULTY_NAME) return floor>=65 ? Math.floor((floor-63)/2) : 0;
  if(isPlanetExplorationDifficulty(name)) return Math.max(0, Math.min(9, Math.floor((floor-59)/2)));
  return v('penance');
}
function currentPenaltyContext(){
  const diffName=vs('diff');
  const diff=DIFF[diffName]||DIFF['The Final'];
  const targetRound=effectiveTargetRound();
  const penaltyLevel=floorPenaltyLevelForDifficulty(diffName, targetRound);
  const penanceLevel=Math.max(0,Math.min(penaltyLevel,currentPenanceMax()));
  return {diff,targetRound,penanceLevel,penDmg:PEN_DMG[penanceLevel]||0};
}
function artifactEnergyRegenMultiplier(){
  const config=window.DPS_DATA?.ARTIFACT_DPS_CONFIG || {};
  const row=Number(config.energyRegenTraitRow || 79);
  const rate=Number(config.energyRegenRate || 2.5);
  return 1 + ((INV[row]||0) * rate) / 100;
}
function calculateArtifactDpsRaw(stats=computeLightweightStatsRaw()){
  const ctx=currentPenaltyContext();
  const enemyData=stats.enemyData || enemyRoundData(ctx.targetRound);
  const ownTarget={defenseReduce:stats.M12||0,pierce:0,hpReduce:stats.displayHR||0,shieldReduce:stats.displaySR||0};
  const ownDurability=targetDurabilityRemain(enemyData, ownTarget);
  const passengerTargets=coopPassengerDurabilityTargets(enemyData);
  const dmgReduce=ctx.diff.dmg * (1 - ctx.penDmg / 100) * (Number(enemyData.damageMultiplier)||1);
  const dps0Part=battleTargetDps0Average(
    {...ownTarget, hpRemain:ownDurability.remain},
    passengerTargets,
    enemyData.armor,
    dmgReduce
  );
  const playerCount=battleEnemyCountMultiplier();
  const flowerMultiplier=on('flowerSkill3') ? 1.15 : 1;
  const adTdMultiplier=(1 + (stats.M4||0) / 100) * ((stats.M11||0) / 100);
  const critMultiplier=dps2(stats.M8||0, stats.M10||0, stats.M9||0, stats.M16||0, stats.M17||0, stats.M18||0, 1);
  const speedModeMultiplier=unifiedDpsSpeedModeEnabled() ? SPEED_MODE_MULTIPLIER : 1;
  const uaMultiplier=(1 - (stats.diff?.as||0) / 100) * (stats.M13||0) * artifactEnergyRegenMultiplier() * personalUaDtMultiplier() * speedModeMultiplier;
  const displayMultiplier=contentDpsDisplayMultiplier(vs('diff'), ctx.targetRound, stats.displayHR||0, stats.displaySR||0);
  const rawArtifactDps=dps0Part * flowerMultiplier * adTdMultiplier * critMultiplier * uaMultiplier;
  const roundTimeParts=specDpsRoundTimeParts(ctx.targetRound);
  const timeLossMultiplier=specDpsRoundTimeDpsMultiplier(ctx.targetRound,vs('diff'));
  const roundTime=roundTimeParts.finalTime;
  const artifactDps=rawArtifactDps * displayMultiplier * timeLossMultiplier;
  return {
    dps:Number.isFinite(artifactDps) ? artifactDps : 0,
    rawDps:Number.isFinite(rawArtifactDps) ? rawArtifactDps : 0,
    roundTime,
    dps0:dps0Part,
    flowerMultiplier,
    adTdMultiplier,
    critMultiplier,
    uaMultiplier,
    displayMultiplier,
    playerCount,
    enemyData,
    penanceLevel:ctx.penanceLevel,
    round:ctx.targetRound
  };
}
/* 계산 미리보기 상태 */
const ARTIFACT_DPS_PREVIEW_IDS=['diff','penance','round','challengeTowerFloor','planetExplorationFloor','soloMode','coopMode','coopPassenger2Dr','coopPassenger3Dr','team','prodArtifact','pbless',...EROSION_CONTROL_IDS];
function applyPreviewPenanceState(penEl, penanceLevel, battleMode, signaturePrefix){
  if(!penEl) return;
  const maxForPreview=battleMode==='coop' ? COOP_DPS_TABLE_PENANCE_MAX : DPS_TABLE_PENANCE_MAX;
  const normalizedPenance=normalizePenanceValue(penanceLevel, maxForPreview);
  setSelectOptions(penEl, Array.from({length:SOLO_PENANCE_MAX+1}, (_,value)=>({
    value,
    label:penanceOptionLabel(value),
    selected:String(value)===normalizedPenance
  })));
  penEl.dataset.penanceMax=`${signaturePrefix}:${SOLO_PENANCE_MAX}`;
  penEl.value=normalizedPenance;
  penEl.dataset.penanceValue=normalizedPenance;
}
function applyPreviewRoundState(round, roundEl, towerFloorEl, planetFloorEl){
  if(roundEl){
    const normalizedRound=normalizedRoundString(round);
    roundEl.value=normalizedRound;
    roundEl.dataset.roundValue=normalizedRound;
  }
  if(towerFloorEl){
    const normalizedTowerFloor=normalizedTowerFloorString(round);
    towerFloorEl.value=normalizedTowerFloor;
    towerFloorEl.dataset.challengeTowerFloorValue=normalizedTowerFloor;
  }
  if(planetFloorEl){
    const normalizedPlanetFloor=normalizedPlanetExplorationFloorString(round);
    planetFloorEl.value=normalizedPlanetFloor;
    planetFloorEl.dataset.planetExplorationFloorValue=normalizedPlanetFloor;
  }
}
function normalizePreviewTeamCount(value, battleMode='solo'){
  const fallback=battleMode==='coop' ? 2 : 1;
  const normalized=normalizeTeamCountValue(value, fallback);
  return battleMode==='coop' && normalized==='1' ? '2' : normalized;
}
function applyPreviewBattleModeState({battleMode, teamCount, soloEl, coopEl, teamEl, signaturePrefix}){
  const coopActive=battleMode==='coop';
  if(soloEl) soloEl.value=coopActive ? 'OFF' : 'ON';
  if(coopEl){
    setSelectOptions(coopEl, [{value:'OFF',label:'OFF',selected:!coopActive},{value:'ON',label:'ON',selected:coopActive}]);
    coopEl.dataset.optionSignature=`${signaturePrefix}:coop-mode-toggle`;
    coopEl.value=coopActive ? 'ON' : 'OFF';
  }
  if(teamEl){
    setSelectOptions(teamEl,[1,2,3].map(value=>({value,label:String(value)})));
    teamEl.value=normalizePreviewTeamCount(teamCount,battleMode);
  }
}
function syncErosionControlElements(){
  EROSION_CONTROL_IDS.forEach(id=>{
    const el=$(id);
    if(!el) return;
    const stored=normalizeErosionControlValue(id, el.value || el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
    el.type='text';
    el.inputMode='numeric';
    el.value=stored;
    el.dataset.erosionValue=stored;
  });
}
function previewControlElements(){
  return {
    diffEl:$('diff'),
    penEl:$('penance'),
    roundEl:$('round'),
    towerFloorEl:$('challengeTowerFloor'),
    planetFloorEl:$('planetExplorationFloor'),
    soloEl:$('soloMode'),
    coopEl:$('coopMode'),
    teamEl:$('team')
  };
}
function prepareDpsPreviewControls(diffName, penanceLevel, round, options={}, signaturePrefix='preview'){
  const controls=previewControlElements();
  const battleMode=options.battleMode==='coop' ? 'coop' : 'solo';
  const teamCount=normalizePreviewTeamCount(options.teamCount, battleMode);
  if(controls.diffEl){
    // Preview uses a cloned SELECT; the visible mode may hide this difficulty.
    setSelectOptions(controls.diffEl,[{value:diffName,label:diffName,selected:true}]);
    controls.diffEl.value=diffName;
  }
  applyPreviewPenanceState(controls.penEl, penanceLevel, battleMode, signaturePrefix);
  applyPreviewRoundState(round, controls.roundEl, controls.towerFloorEl, controls.planetFloorEl);
  syncErosionControlElements();
  applyPreviewBattleModeState({
    battleMode,
    teamCount,
    soloEl:controls.soloEl,
    coopEl:controls.coopEl,
    teamEl:controls.teamEl,
    signaturePrefix
  });
  return controls;
}
function withPreparedDpsPreview(elementIds,diffName,penanceLevel,round,options,signaturePrefix,artifact,callback){
  return withCalculationElementOverrides(elementIds,()=>{
    prepareDpsPreviewControls(diffName,penanceLevel,round,options,signaturePrefix);
    if(artifact){
      const artifactEl=$('prodArtifact');
      if(artifactEl) artifactEl.checked=true;
    }
    return callback();
  });
}
function calculateDpsPreviewCore(diffName,round,options={},artifact=false){
  const elementIds=artifact ? ARTIFACT_DPS_PREVIEW_IDS : DPS_PREVIEW_IDS;
  const signaturePrefix=artifact ? 'artifact' : 'preview';
  return withPreparedDpsPreview(elementIds,diffName,0,round,options,signaturePrefix,artifact,()=>
    buildStatsCoreRaw({extended:false,syncDerived:false})
  );
}
function calculateDpsPreviewValue(diffName,penanceLevel,round,options={},artifact=false){
  const elementIds=artifact ? ARTIFACT_DPS_PREVIEW_IDS : DPS_PREVIEW_IDS;
  const signaturePrefix=artifact ? 'artifact' : 'preview';
  return withPreparedDpsPreview(elementIds,diffName,penanceLevel,round,options,signaturePrefix,artifact,()=>{
    const previewPenanceLevel=shouldIgnorePenanceForDifficulty(diffName) ? undefined : penanceLevel;
    const stats=computeLightweightStatsRaw({previewCore:options.previewCore,previewPenanceLevel});
    return artifact
      ? {...calculateArtifactDpsRaw(stats),baseDps:Number.isFinite(stats.M19) ? stats.M19 : 0}
      : (Number.isFinite(stats.M19) ? stats.M19 : 0);
  });
}
function calculateArtifactDpsPreview(diffName, penanceLevel, round, options={}){
  try{
    return calculateDpsPreviewValue(diffName,penanceLevel,round,options,true);
  }catch(e){
    rememberAppIssue('error','[artifact DPS preview failed]', e);
    return {dps:0,baseDps:0,error:e};
  }
}
function hasRuneOption(code){
  return uniqueRuneOptionCodes().includes(code);
}
function getRuneOptionStats(){
  const stats={ad:0,ap:0,cri:0,cd:0,dr:0,mc:0,td:0,tdRuneMul:1,uaMul:1};
  uniqueRuneOptionCodes().forEach(code=>{
    if(code==='ad15') stats.ad+=15;
    else if(code==='cri22') stats.cri+=22;
    else if(code==='cd50') stats.cd+=50;
    else if(code==='dr25') stats.dr+=25;
    else if(code==='mc3') stats.mc+=3;
    else if(code==='ua15') stats.uaMul*=1.15;
    else if(code==='td10') stats.td+=10;
    else if(code==='tdUa'){ stats.td+=10; stats.uaMul*=1.10; }
    else if(code==='ap30') stats.ap+=30;
    else if(code==='td2') stats.tdRuneMul*=2;
  });
  return stats;
}
function getSpecialRuneStats(optionStats={tdRuneMul:1}){
  const harmony=v('rHarmony');
  const tdRuneMul=optionStats.tdRuneMul || 1;
  return { ap:v('rAP'), td:(v('rTD') + harmony) * tdRuneMul, ua:v('rUA') + harmony };
}
function maximumDisplayAp(){
  const finalRuneApBonus=vs('runeChoiceType')==='ap' ? Math.min(45,Math.max(0,v('runeChoiceValue'))) : 0;
  return 535+finalRuneApBonus;
}
function cappedDisplayAp(rawValue){
  return Math.min(maximumDisplayAp(),Math.max(0,Number(rawValue)||0));
}
function rpCost(row,n){
  n=Math.max(0,Math.min(TMAX[row]||999,Math.round(n||0)));
  if(row===125 || row===126 || row===127){
    if(n<=12) return n;
    if(n<=24) return 12+2*(n-12);
    if(n<=36) return 36+3*(n-24);
    return 72+4*(n-36);
  }
  if(row===128){
    if(n<=12) return n;
    if(n<=24) return 12+2*(n-12);
    return 36+3*(n-24);
  }
  if(row===129 || row===130){
    if(n<=9) return n*2;
    return 20+4*(n-10);
  }
  return n;
}
function nextRpCost(row){
  const n=INV[row]||0;
  if(n>=TMAX[row]) return Infinity;
  return rpCost(row,n+1)-rpCost(row,n);
}
function isUtilitySpTrait(trait){
  return ['유틸','경험치','AP','각성석'].includes(trait[3]);
}
const RESOURCE_TRAIT_ROWS=Object.freeze({
  SP:Object.freeze(TRAITS.filter(t=>SP_ROWS.has(t[0])).map(t=>t[0])),
  EP:Object.freeze(TRAITS.filter(t=>EP_ROWS.has(t[0])).map(t=>t[0])),
  RP:Object.freeze(TRAITS.filter(t=>RP_ROWS.has(t[0])).map(t=>t[0])),
  SOUL:Object.freeze(TRAITS.filter(t=>SOUL_ROWS.has(t[0])).map(t=>t[0]))
});

const SP_UTILITY_TRAIT_ROWS=Object.freeze(TRAITS.filter(t=>SP_ROWS.has(t[0]) && isUtilitySpTrait(t)).map(t=>t[0]));

const SP_OFFENSE_TRAIT_ROWS=Object.freeze(TRAITS.filter(t=>SP_ROWS.has(t[0]) && !isUtilitySpTrait(t)).map(t=>t[0]));

function sumTraitRowCosts(rows, costFn=cumCost){
  let total=0;
  for(const row of rows || []) total+=costFn(row);
  return total;
}
function resourceUsed(kind){
  const rows=RESOURCE_TRAIT_ROWS[kind] || [];
  return kind==='RP' ? sumTraitRowCosts(rows,row=>rpCost(row,INV[row]||0)) : sumTraitRowCosts(rows);
}

function resourceUsageSnapshot(){
  const spU=sumTraitRowCosts(SP_UTILITY_TRAIT_ROWS);
  const spO=sumTraitRowCosts(SP_OFFENSE_TRAIT_ROWS);
  return {spU,spO,epU:resourceUsed('EP'),rpU:resourceUsed('RP'),soulU:resourceUsed('SOUL')};
}
function resourceKindForRow(row){return SP_ROWS.has(row)?'SP':EP_ROWS.has(row)?'EP':RP_ROWS.has(row)?'RP':SOUL_ROWS.has(row)?'SOUL':null;}
function resourceOwn(kind){return kind==='SP'?effectiveSP():kind==='EP'?v('ep'):kind==='RP'?v('rp'):kind==='SOUL'?v('soul'):Infinity;}
function resourceCostAtInvestment(kind,row,investment){
  return kind==='RP' ? rpCost(row,investment) : cumCost(row,investment);
}
function maximumAffordableInvestment(kind,row,current,budget){
  let low=0,high=Math.max(0,current),best=0;
  while(low<=high){
    const mid=Math.floor((low+high)/2);
    if(resourceCostAtInvestment(kind,row,mid)<=budget){
      best=mid;
      low=mid+1;
    }else{
      high=mid-1;
    }
  }
  return best;
}
function setRowToAffordableValue(row,wanted){
  const old=INV[row]||0;
  const mx=TMAX[row]||999;
  let val=Math.max(0,Math.min(mx,Math.round(+wanted||0)));
  INV[row]=val;
  const kind=resourceKindForRow(row);
  if(kind && val>old){
    const own=resourceOwn(kind);
    const otherCost=resourceUsed(kind)-resourceCostAtInvestment(kind,row,val);
    val=Math.max(old,maximumAffordableInvestment(kind,row,val,Math.max(0,own-otherCost)));
    INV[row]=val;
  }
  return val;
}
function fillRowToBudget(row){
  if(row===116) return false;
  const current=INV[row]||0;
  const maximum=TMAX[row]||999;
  if(current>=maximum) return false;
  const kind=resourceKindForRow(row);
  if(!kind){
    INV[row]=maximum;
    return true;
  }
  const otherCost=resourceUsed(kind)-resourceCostAtInvestment(kind,row,current);
  const next=Math.max(current,maximumAffordableInvestment(kind,row,maximum,Math.max(0,resourceOwn(kind)-otherCost)));
  INV[row]=next;
  return next>current;
}
function normalizeSpBankApplyValue(value){
  if(typeof value==='boolean') return value ? '반영' : '미반영';
  const raw=String(value ?? '').trim();
  const upper=raw.toUpperCase();
  return (raw==='반영' || raw==='적용' || upper==='ON' || upper==='TRUE' || upper==='1' || upper==='YES') ? '반영' : '미반영';
}
function isSpBankApplied(){
  const select=(typeof $==='function' ? $('spBankApply') : (typeof document!=='undefined' ? document.getElementById('spBankApply') : null));
  return select ? normalizeSpBankApplyValue(select.value)==='반영' : false;
}
function spBankRawBonus(){
  const bankLevel=Math.max(0, Math.round(+(INV[SP_BANK_TRAIT_ROW]||0)));
  const appliedRound=Math.min(Math.max(0, effectiveTargetRound()), 290);
  const ticks=Math.floor(appliedRound/10);
  return bankLevel * 1000 * ticks;
}
function effectiveSpBankBonus(){
  return isSpBankApplied() ? spBankRawBonus() : 0;
}
function syncSpBankDisplay(){
  const select=$('spBankApply');
  if(!select) return;
  const state=isSpBankApplied() ? '반영' : '미반영';
  if(select.value!==state) select.value=state;
}
function effectiveSP(){
  return Math.max(0, v('sp') + effectiveSpBankBonus() - donationBuffSpCost());
}
function rpPierceBonus(){return Math.max(0, Math.min(20, INV[130]||0));}
let allowedRowsByTierCacheTarget='';
let allowedRowsByTierCache=new Set();
function allowedRowsByTier(){
  const target=vs('optTier')||'루키';
  if(target===allowedRowsByTierCacheTarget) return allowedRowsByTierCache;
  const idx=OPTIMIZATION_TIERS.indexOf(target);
  allowedRowsByTierCacheTarget=target;
  allowedRowsByTierCache=new Set(TRAITS.filter(t=>OPTIMIZATION_TIERS.indexOf(t[2])>=0 && OPTIMIZATION_TIERS.indexOf(t[2])<=idx).map(t=>t[0]));
  return allowedRowsByTierCache;
}
function fmt(n,d=1){return n==null||isNaN(n)?'—':parseFloat(n.toFixed(d)).toLocaleString('ko-KR');}
function big(n){
  n=Number(n);
  if(!Number.isFinite(n)) return '—';
  n=Math.round(n||0);
  return Math.abs(n)>=1e8 ? (n/1e8).toFixed(2)+'억' : Math.abs(n)>=1e4 ? (n/1e4).toFixed(1)+'만' : n.toLocaleString('ko-KR');
}
function fullNumber(n){
  n=Number(n);
  return Number.isFinite(n) ? Math.round(n||0).toLocaleString('ko-KR') : '—';
}
function shouldHideDpsForRound(){
  const raw=String($('round')?.value ?? '').replace(/,/g,'').trim();
  return raw==='0' || Number(raw)===0;
}
function normalizedSkillRoundNumber(value,mode=vs('skillMode')){
  return normalizedIntegerRange(value,ROUND_INPUT_MIN,skillRoundMaximum(mode));
}
function normalizedSkillRoundString(value,mode=vs('skillMode')){
  return String(normalizedSkillRoundNumber(value,mode));
}
function normalizeRoundInput(id='round'){
  const el=$(id);
  if(!el) return false;
  if(id==='round'){
    const next=normalizedRoundString(el.value || el.dataset.roundValue || ROUND_INPUT_MIN);
    el.dataset.roundValue=next;
    if(String(el.value)!==next){ el.value=next; return true; }
    return false;
  }
  if(id==='challengeTowerFloor'){
    const next=normalizedTowerFloorString(el.value || el.dataset.challengeTowerFloorValue || TOWER_FLOOR_INPUT_MIN);
    el.dataset.challengeTowerFloorValue=next;
    if(String(el.value)!==next){ el.value=next; return true; }
    return false;
  }
  if(id==='planetExplorationFloor'){
    const next=normalizedPlanetExplorationFloorString(el.value || el.dataset.planetExplorationFloorValue || PLANET_EXPLORATION_FLOOR_INPUT_MIN);
    el.dataset.planetExplorationFloorValue=next;
    if(String(el.value)!==next){ el.value=next; return true; }
    return false;
  }
  if(id==='skillRound') el.max=String(skillRoundMaximum(vs('skillMode')));
  const next=id==='skillRound'?normalizedSkillRoundString(el.value):normalizedRoundString(el.value);
  if(String(el.value)!==next){
    el.value=next;
    return true;
  }
  return false;
}
function normalizeRoundInputs(){
  const a=normalizeRoundInput('round');
  const b=normalizeRoundInput('skillRound');
  const c=normalizeRoundInput('challengeTowerFloor');
  const d=normalizeRoundInput('planetExplorationFloor');
  return a || b || c || d;
}
function syncDifficultyTargetControls(){
  const roundEl=$('round');
  const towerEl=$('challengeTowerFloor');
  const planetEl=$('planetExplorationFloor');
  if(roundEl){
    const stored=normalizedRoundString(roundEl.value || roundEl.dataset.roundValue || ROUND_INPUT_MIN);
    roundEl.value=stored;
    roundEl.dataset.roundValue=stored;
  }
  if(towerEl){
    const stored=normalizedTowerFloorString(towerEl.value || towerEl.dataset.challengeTowerFloorValue || TOWER_FLOOR_INPUT_MIN);
    towerEl.value=stored;
    towerEl.dataset.challengeTowerFloorValue=stored;
  }
  if(planetEl){
    const stored=normalizedPlanetExplorationFloorString(planetEl.value || planetEl.dataset.planetExplorationFloorValue || PLANET_EXPLORATION_FLOOR_INPUT_MIN);
    planetEl.value=stored;
    planetEl.dataset.planetExplorationFloorValue=stored;
  }
}
function resetDifficultyDependentFields(){
  syncBattleMode('coopMode');
  syncDifficultyTargetControls();
  return false;
}
function selectedControlText(el){
  if(!el) return '—';
  if(el.tagName==='SELECT'){
    const option=el.selectedOptions && el.selectedOptions[0];
    return String((option?.textContent || el.value || '—')).trim() || '—';
  }
  return String(el.value ?? '—').trim() || '—';
}
function getDpsContextValues(){
  const diff=isPlanetExplorationDifficulty() ? planetExplorationDisplayName() : selectedControlText($('diff'));
  const penValue=effectivePenanceValue();
  const roundInt=normalizedRoundNumber(targetRoundStoredValue());
  const floorInt=normalizedTowerFloorNumber(challengeTowerFloorStoredValue());
  const planetFloorInt=normalizedPlanetExplorationFloorNumber(planetExplorationFloorStoredValue());
  const towerActive=isTowerDifficulty();
  const planetActive=isPlanetExplorationDifficulty();
  const mode=dpsContextModeValues();
  const difficultyDetail=towerActive
    ? `${floorInt}층`
    : planetActive
      ? `${planetFloorInt}층`
      : `${penValue} 고행 · ${roundInt} 라운드`;
  return {modePrimary:`${mode.primary} · ${mode.secondary}`,modeSecondary:'',diff:`${diff} · ${difficultyDetail}`,difficultyDetail:''};
}
function updateDpsContextSummary(){
  const ctx=getDpsContextValues();
  setTextMap({
    dpsContextMode:ctx.modePrimary,
    dpsContextModeDetail:ctx.modeSecondary,
    dpsContextDiff:ctx.diff,
    dpsContextDiffDetail:ctx.difficultyDetail
  });
}

/* DPS표 미리보기 */
const DPS_PREVIEW_IDS=['diff','penance','round','challengeTowerFloor','planetExplorationFloor','soloMode','coopMode','team','pbless',...EROSION_CONTROL_IDS];
function computeDpsPreview(diffName, penanceLevel, round, options={}){
  try{
    return calculateDpsPreviewValue(diffName,penanceLevel,round,options,false);
  }catch(e){
    rememberAppIssue('error','[DPS table preview failed]', e);
    return 0;
  }
}

/* ── 11 · 특성 투자 최적화 ── */
/* 특성 계산 및 투자 효율 평가 */
const STAT_KO={
  AD:'공격력', AS:'공격속도', AP:'마법공격력', CRI:'크리 확률', CD:'크리 데미지',
  MC:'다중 크리티컬', TD:'총 데미지', DR:'방어력 감소', PIERCE:'방어력 관통', UA:'유닛 가속',
  SR:'실드 감소', HR:'체력 감소', MD:'멀티 타겟', MP:'멀티 확률', MCP:'멀티 크리 확률',
  RA:'강화 관련', 특수:'상시 적용', 유틸:'편의/보조', 경험치:'경험치 보너스', 각성석:'각성석 보너스'
};
function statKo(type){return STAT_KO[type] || type;}
function traitEffectText(row,type,rate){return !rate ? statKo(type) : `${statKo(type)} +${rate}${T_UA.has(row)?'%':''}`;}
const TRAIT_OPT_NORMAL_ROWS={
  SP:new Set([42,43,44,46,52,53,54,58,60,61,62,68,70,71,77,79,84,85,86,92,93,94,95,96,99,100,101,102,103,104,108,109,110,111,115]),
  EP:new Set([117,118,119,120,121,122]),
  RP:new Set([125,126,127,129,130]),
  SOUL:new Set([131,132,133,134,135,136,137])
};
const TRAIT_BY_ROW=new Map(TRAITS.map(t=>[t[0],t]));
function traitByRow(row){return TRAIT_BY_ROW.get(+row) || null;}
function traitName(row){return traitByRow(row)?.[1] || `행 ${row}`;}
const TRAIT_LIMIT_CONFIG=[
  {id:'traitLimitAS',key:'AS',name:'공격속도',value:s=>s.M7},
  {id:'traitLimitCRI',key:'CRI',name:'크리 확률',value:s=>s.M8}
];
const TRAIT_LIMIT_DEFAULTS={
  traitLimitAD:'0', traitLimitAS:'0', traitLimitCRI:'0', traitLimitCD:'0', traitLimitMultiTarget:'OFF', traitLimitInfinite:'OFF'
};
const TRAIT_LIMIT_INPUT_IDS=new Set(TRAIT_LIMIT_CONFIG.map(item=>item.id));
const TRAIT_LIMIT_MULTI_TYPES=new Set(['MD','MP','MCP']);
const TRAIT_LIMIT_UNLIMITED_TEXT='제한없음';
function normalizeTraitLimitStorageValue(value){
  const text=String(value ?? '').replace(/,/g,'').trim();
  if(text==='' || text==='0' || text===TRAIT_LIMIT_UNLIMITED_TEXT || text==='∞' || /^inf(inity)?$/i.test(text)) return '0';
  const n=Number(text);
  if(!Number.isFinite(n) || n<=0) return '0';
  return String(n);
}
function traitLimitDisplayText(value){
  const normalized=normalizeTraitLimitStorageValue(value);
  return normalized==='0' ? TRAIT_LIMIT_UNLIMITED_TEXT : normalized;
}
function syncTraitLimitInputDisplay(el){
  if(!el || !TRAIT_LIMIT_INPUT_IDS.has(el.id)) return;
  const display=traitLimitDisplayText(el.value);
  if(el.value!==display) el.value=display;
  el.classList.toggle('trait-limit-unlimited', display===TRAIT_LIMIT_UNLIMITED_TEXT);
}
function syncTraitLimitInputs(){
  TRAIT_LIMIT_INPUT_IDS.forEach(id=>syncTraitLimitInputDisplay($(id)));
}
function bindTraitLimitDisplayEvents(){
  document.addEventListener('focusin', e=>prepareTraitLimitInputForEdit(e.target), true);
  document.addEventListener('focusout', e=>{
    if(e.target && TRAIT_LIMIT_INPUT_IDS.has(e.target.id)){
      syncTraitLimitInputDisplay(e.target);
      commitAppUpdate();
    }
  }, true);
}
function prepareTraitLimitInputForEdit(el){
  if(!el || !TRAIT_LIMIT_INPUT_IDS.has(el.id)) return;
  if(String(el.value).trim()===TRAIT_LIMIT_UNLIMITED_TEXT){
    el.value='';
    el.classList.remove('trait-limit-unlimited');
  }
}
function traitLimitSwitchOn(id){
  const el=$(id);
  const fallback=hasOwn(TRAIT_LIMIT_DEFAULTS,id) ? TRAIT_LIMIT_DEFAULTS[id] : 'ON';
  const value=String((el ? el.value : fallback) ?? fallback).trim().toUpperCase();
  return value!=='OFF' && value!=='0' && value!=='FALSE' && value!=='비활성화';
}
function traitLimitAllowsTrait(t){
  if(!Array.isArray(t)) return true;
  const tier=String(t[2] ?? '');
  const type=String(t[3] ?? '');
  if(TRAIT_LIMIT_MULTI_TYPES.has(type) && !traitLimitSwitchOn('traitLimitMultiTarget')) return false;
  if(tier==='무한∞' && !traitLimitSwitchOn('traitLimitInfinite')) return false;
  return true;
}
function traitLimitStatsOk(stats){
  if(!stats) return true;
  for(const item of TRAIT_LIMIT_CONFIG){
    if(traitV1IsArtifactMode() && item.key==='AS') continue;
    const limit=Number(normalizeTraitLimitStorageValue(vs(item.id)));
    if(!Number.isFinite(limit) || limit<=0) continue;
    const current=Number(item.value(stats));
    if(!Number.isFinite(current)) return false;
    if(current>limit+1e-9) return false;
  }
  return true;
}
const TRAIT_RESOURCE_INFO=Object.freeze({
  SP:Object.freeze({kind:'SP'}),
  EP:Object.freeze({kind:'EP'}),
  RP:Object.freeze({kind:'RP'}),
  SOUL:Object.freeze({kind:'SOUL'})
});
function traitOptimizationResourceInfo(row){
  if(SP_ROWS.has(row)) return TRAIT_RESOURCE_INFO.SP;
  if(EP_ROWS.has(row)) return TRAIT_RESOURCE_INFO.EP;
  if(RP_ROWS.has(row)) return TRAIT_RESOURCE_INFO.RP;
  if(SOUL_ROWS.has(row)) return TRAIT_RESOURCE_INFO.SOUL;
  return null;
}
function restoreTraitInvestment(row, savedValue){
  if(savedValue===undefined) delete INV[row];
  else INV[row]=savedValue;
}
function withTemporaryTraitInvestments(changes, callback){
  const saved=new Map();
  const normalized=[];
  changes.forEach(([row,delta])=>{
    row=+row;
    delta=+delta || 0;
    if(!Number.isFinite(row) || !Number.isFinite(delta) || delta===0) return;
    if(!saved.has(row)) saved.set(row, INV[row]);
    normalized.push([row,delta]);
  });
  try{
    normalized.forEach(([row,delta])=>{ INV[row]=(INV[row]||0)+delta; });
    return callback();
  }finally{
    saved.forEach((value,row)=>restoreTraitInvestment(row,value));
  }
}
function traitOptimizationDeltaCost(row, add){
  row=+row;
  add=Math.max(0, Math.round(+add||0));
  const n=INV[row]||0;
  if(add<=0) return 0;
  if(n+add>(TMAX[row]||999)) return Infinity;
  if(RP_ROWS.has(row)) return rpCost(row,n+add)-rpCost(row,n);
  const total=cumCost(row,n+add)-cumCost(row,n);
  return Number.isFinite(total) && total>0 ? total : Infinity;
}
function traitV1AllowedInMode(t){
  return !traitV1IsArtifactMode() || (t?.[3]!=='AS' && t?.[3]!=='PIERCE');
}
function isTraitOptimizationTarget(t){
  const row=t?.[0];
  if(!traitLimitAllowsTrait(t) || !traitV1AllowedInMode(t)) return false;
  const info=traitOptimizationResourceInfo(row);
  if(!info) return false;
  const normalSet=TRAIT_OPT_NORMAL_ROWS[info.kind];
  if(!normalSet || !normalSet.has(row)) return false;
  if(!allowedRowsByTier().has(row)) return false;
  return true;
}
/* VBA V1 효율표: 한 번 투자했을 때의 DPS 증가/다음 투자비용으로 순위를 정한다.
 * SP 400만 초과 시의 5회 투자는 대상을 선택한 뒤에만 적용한다. */
const TRAIT_V1_TARGET_ROWS=Object.freeze({
  SP:Object.freeze([42,43,46,52,53,58,60,61,68,70,71,77,84,85,86,92,93,94,95,96,99,100,101,102,103,104,108,109,110,111,115,44,54,62,79]),
  EP:Object.freeze([117,118,119,120,121,122]),
  RP:Object.freeze([125,126,127,129,130]),
  SOUL:Object.freeze([131,132,133,134,135,136,137])
});
const TRAIT_OPTIMIZATION_HARD_STEP_LIMIT=10000;
function traitV1IsArtifactMode(){
  return typeof isArtifactDpsViewEnabled==='function' && isArtifactDpsViewEnabled();
}
function traitV1TargetRows(kind){
  const artifact=traitV1IsArtifactMode();
  return (TRAIT_V1_TARGET_ROWS[kind]||[]).filter(row=>{
    if(kind==='SP' && [44,54,62,79].includes(row) && !artifact) return false;
    return isTraitOptimizationTarget(traitByRow(row));
  });
}
function traitV1DpsValue(stats){
  return traitV1IsArtifactMode() ? calculateArtifactDpsRaw(stats).dps : stats.M19;
}
function evaluateTraitV1Changes(base,kind,remaining,changes,label,scoreCost=null){
  if(!changes?.length) return null;
  let cost=0;
  for(const [row,add] of changes){
    if(traitOptimizationResourceInfo(row)?.kind!==kind) return null;
    const nextCost=traitOptimizationDeltaCost(row,add);
    if(!Number.isFinite(nextCost) || nextCost<=0) return null;
    cost+=nextCost;
  }
  if(cost>remaining) return null;
  const stats=withTemporaryTraitInvestments(changes,computeLightweightStatsRaw);
  if(!traitLimitStatsOk(stats)) return null;
  const gain=traitV1DpsValue(stats)-traitV1DpsValue(base);
  if(!Number.isFinite(gain) || gain<=0) return null;
  const divisor=scoreCost===null ? cost : scoreCost;
  if(!Number.isFinite(divisor) || divisor<=0 || divisor>remaining) return null;
  return {kind,changes,cost,score:gain/divisor,label};
}
function traitV1CritCandidate(base,kind,remaining,row,rate){
  const t=traitByRow(row);
  if(!t || !isTraitOptimizationTarget(t) || base.M8<300) return null;
  const remainder=((base.M8%20)+20)%20;
  const points=remainder===0 ? 20 : 20-remainder;
  const add=Math.ceil(points/rate);
  if(add<=0 || (INV[row]||0)+add>(TMAX[row]||999)) return null;
  return evaluateTraitV1Changes(base,kind,remaining,[[row,add]],`초과 크리티컬 ${row}`);
}
function traitV1MultiTargetCandidate(base,remaining){
  if(!traitLimitSwitchOn('traitLimitMultiTarget')) return null;
  const changes=[[100,100],[101,70],[102,80]];
  if(changes.some(([row,add])=>!isTraitOptimizationTarget(traitByRow(row)) || (INV[row]||0)+add>(TMAX[row]||999))) return null;
  if(changes.reduce((sum,[row])=>sum+(INV[row]||0),0)>50) return null;
  // VBA H218: 현재 투자치에서의 증가비가 아닌, 목표 투자치의 누적비용으로 평가.
  const fullCost=changes.reduce((sum,[row,add])=>sum+cumCost(row,(INV[row]||0)+add),0);
  return evaluateTraitV1Changes(base,'SP',remaining,changes,'멀티 타겟 분기점',fullCost);
}
function traitV1BestCandidate(kind,remaining){
  const base=computeLightweightStatsRaw();
  let best=null;
  function consider(candidate){
    // VBA MAX(H181:H218)과 첫 번째 동점 우선 선택을 그대로 유지한다.
    if(candidate && (!best || candidate.score>best.score)) best=candidate;
  }
  for(const row of traitV1TargetRows(kind)){
    if((INV[row]||0)>=(TMAX[row]||999)) continue;
    consider(evaluateTraitV1Changes(base,kind,remaining,[[row,1]],traitName(row)));
  }
  if(kind==='SP'){
    consider(traitV1CritCandidate(base,kind,remaining,95,0.5));
    consider(traitV1MultiTargetCandidate(base,remaining));
  }else if(kind==='EP'){
    consider(traitV1CritCandidate(base,kind,remaining,119,1));
  }else if(kind==='RP'){
    consider(traitV1CritCandidate(base,kind,remaining,127,2));
  }
  return best;
}
function traitV1ApplyCandidate(candidate,kind,remaining){
  if(!candidate) return false;
  let changes=candidate.changes;
  if(kind==='SP' && changes.length===1 && !candidate.label.startsWith('초과 크리티컬')){
    const row=changes[0][0];
    if(![77,104].includes(row) && remaining>4000000){
      // VBA V1: 최고 효율을 1회 투자 기준으로 선택한 뒤, 최대 5회 투자한다.
      // 웹에서는 추가 4회의 비용까지 재화 범위 안으로 제한하여 초과 투자를 방지한다.
      let add=Math.min(5,(TMAX[row]||999)-(INV[row]||0));
      while(add>1 && traitOptimizationDeltaCost(row,add)>remaining) add--;
      changes=[[row,add]];
    }
  }
  let cost=0;
  for(const [row,add] of changes){
    const deltaCost=traitOptimizationDeltaCost(row,add);
    if(!Number.isFinite(deltaCost) || deltaCost<=0) return false;
    cost+=deltaCost;
  }
  if(cost>remaining) return false;
  const next=withTemporaryTraitInvestments(changes,computeLightweightStatsRaw);
  if(!traitLimitStatsOk(next)){
    // 다회 투자에 한해 최대 허용 투자 수로 축소한다.
    if(changes.length!==1 || changes[0][1]<=1) return false;
    const row=changes[0][0];
    for(let add=changes[0][1]-1;add>=1;add--){
      const smaller=[[row,add]];
      const smallerCost=traitOptimizationDeltaCost(row,add);
      if(smallerCost<=remaining && traitLimitStatsOk(withTemporaryTraitInvestments(smaller,computeLightweightStatsRaw))){
        changes=smaller;
        break;
      }
    }
    if(changes[0][1]>1 && !traitLimitStatsOk(withTemporaryTraitInvestments(changes,computeLightweightStatsRaw))) return false;
  }
  for(const [row,add] of changes) INV[row]=(INV[row]||0)+add;
  return true;
}
function createTraitOptimizationGuard(){return {steps:0,aborted:false,reason:''};}
function traitOptimizationGuardCanContinue(guard){
  if(guard.aborted) return false;
  if(guard.steps>=TRAIT_OPTIMIZATION_HARD_STEP_LIMIT){
    guard.aborted=true;
    guard.reason='step-limit';
    return false;
  }
  return true;
}
function traitV1TryCorrection(row,quantity){
  const t=traitByRow(row);
  if(!t || !isTraitOptimizationTarget(t)) return false;
  const kind=traitOptimizationResourceInfo(row)?.kind;
  if(!kind) return false;
  const remaining=resourceOwn(kind)-resourceUsed(kind);
  const available=Math.max(0,(TMAX[row]||999)-(INV[row]||0));
  let add=Math.min(quantity,available);
  while(add>0 && traitOptimizationDeltaCost(row,add)>remaining) add--;
  if(!add) return false;
  const next=withTemporaryTraitInvestments([[row,add]],computeLightweightStatsRaw);
  if(!traitLimitStatsOk(next)) return false;
  INV[row]=(INV[row]||0)+add;
  return true;
}
function traitV1RestoreNegativeStats(guard){
  // VBA Stat_Induce: 음수 AD/TD인 극한 난이도에서 일반 효율 산출 전에 양수로 복구.
  // 기존 웹의 투자 제한, 종료 구간, 재화 잔액은 지키며 유틸 특성은 건드리지 않는다.
  let stats=computeLightweightStatsRaw();
  if(stats.M4>0 && stats.M11>0) return;
  traitV1TryCorrection(42,5);
  traitV1TryCorrection(52,15);
  for(let i=0;i<50 && traitOptimizationGuardCanContinue(guard);i++){
    stats=computeLightweightStatsRaw();
    let changed=false;
    if(stats.M4<=0){
      for(const [row,add] of [[60,25],[84,9],[93,4],[96,5],[108,3],[117,2],[125,2],[132,2],[133,2]]){
        // VBA의 강화/침식 보정은 현재 웹의 기존 특성 투자 제한 범위 내에서만 수행.
        if(row===132 || row===96) continue;
        changed=traitV1TryCorrection(row,add)||changed;
      }
    }
    if(stats.M11<=0){
      for(const [row,add] of [[92,5],[129,1],[131,2],[135,2]]){
        if(row===131) continue;
        changed=traitV1TryCorrection(row,add)||changed;
      }
    }
    if(!changed) break;
    guard.steps++;
  }
}
/* VBA Pre_Invest: V1 최적화 시작 전에 조건을 만족하는 항목만 선투자한다.
 * 웹에서는 기본 자동 실행하며 기존 투자, 선택 종료 구간, 투자 제한 및 재화 한도를 보존한다. */
function traitV1PreInvestSet(row,wanted){
  const t=traitByRow(row);
  if(!t || !allowedRowsByTier().has(row) || !traitLimitAllowsTrait(t) || !traitV1AllowedInMode(t)) return false;
  if((INV[row]||0)>=wanted) return false;
  const kind=traitOptimizationResourceInfo(row)?.kind;
  if(!kind) return false;
  const current=INV[row]||0;
  const otherCost=resourceUsed(kind)-resourceCostAtInvestment(kind,row,current);
  const affordable=maximumAffordableInvestment(kind,row,wanted,Math.max(0,resourceOwn(kind)-otherCost));
  if(affordable<wanted) return false;
  const changes=[[row,wanted-current]];
  if(!traitLimitStatsOk(withTemporaryTraitInvestments(changes,computeLightweightStatsRaw))) return false;
  INV[row]=wanted;
  return true;
}
function traitV1PreInvest(){
  // 엑셀의 SP 사전 투자 ON 상태에 해당: 현재 미투자 공격 특성만 대상.
  // 먼저 최대 투자, 남은 SP가 투자 비용 30배 이하면 1/3 투자로 축소한다.
  for(const t of TRAITS){
    const [row,,,type]=t;
    if(row<42 || row>107 || (INV[row]||0)!==0) continue;
    if(['유틸','경험치','AP','각성석'].includes(type) || !isTraitOptimizationTarget(t)) continue;
    const max=TMAX[row]||0;
    const candidates=[max,Math.floor(max/3)];
    for(const count of candidates){
      if(count<=0 || !traitV1PreInvestSet(row,count)) continue;
      const remaining=resourceOwn('SP')-resourceUsed('SP');
      if(remaining>cumCost(row,count)*30) break;
      INV[row]=0;
    }
  }
  // VBA EP: 잔여 1145 이상일 때 6개 공격 특성을 먼저 마스터한다.
  // 보유 EP 1250 이상일 때만 편의/보조 2개를 함께 투자한다.
  if(resourceOwn('EP')-resourceUsed('EP')>=1145){
    if(resourceOwn('EP')>=1250){
      traitV1PreInvestSet(123,10);
      traitV1PreInvestSet(124,2);
    }
    for(const [row,count] of [[117,25],[118,25],[119,20],[120,20],[121,2],[122,1]]){
      traitV1PreInvestSet(row,count);
    }
  }
  // VBA 혼: 보유 혼 4980 이상일 때 선투자.
  // 선택 모드와 무관하게 심연·침식 내성도 기존 선투자 범위에 포함한다.
  if(resourceOwn('SOUL')>=4980){
    for(const [row,count] of [[131,10],[132,10],[133,12],[134,12],[135,12],[136,12],[137,10],[138,10]]){
      traitV1PreInvestSet(row,count);
    }
  }
}
function traitV1RunResource(kind,guard){
  if(!traitV1TargetRows(kind).length) return;
  while(traitOptimizationGuardCanContinue(guard)){
    const remaining=resourceOwn(kind)-resourceUsed(kind);
    if(remaining<=0) break;
    const best=traitV1BestCandidate(kind,remaining);
    if(!traitV1ApplyCandidate(best,kind,remaining)) break;
    guard.steps++;
  }
}
function optimizeSP(){
  const before=Object.fromEntries(Object.entries(INV));
  const guard=createTraitOptimizationGuard();
  try{
    // VBA Optimize_V1: SP를 끝까지 최적화한 후 EP → RP → 혼으로 진행.
    // 무한 SP도 H207:H211처럼 동일한 SP 효율 후보로 취급한다.
    traitV1PreInvest();
    traitV1RestoreNegativeStats(guard);
    for(const kind of ['SP','EP','RP','SOUL']){
      if(guard.aborted) break;
      traitV1RunResource(kind,guard);
    }
    if(guard.aborted) showToast('최적화 계산을 안전하게 중단했습니다. 투자 범위를 줄여 다시 시도해 주세요.','warn');
    commitAppUpdate({recalculate:'now'});
    return !guard.aborted;
  }catch(error){
    Object.keys(INV).forEach(row=>{INV[row]=before[row] ?? 0;});
    rememberAppIssue('error','특성 최적화 계산',error);
    showToast('특성 최적화 계산 중 오류가 발생해 변경사항을 되돌렸습니다.','err');
    commitAppUpdate({recalculate:'now'});
    return false;
  }
}

/* 기존 프리셋 recommendations 필드와의 읽기·쓰기 호환성만 유지 */
const traitRecommendationCredits=new Map();
const traitRecommendationObserved=new Map();
function synchronizeTraitRecommendationCredits(){
  for(const t of TRAITS){
    const row=t[0], current=INV[row]||0, previous=traitRecommendationObserved.get(row);
    if(previous!==undefined && current<previous){
      const credit=traitRecommendationCredits.get(row)||0;
      const reduced=Math.min(credit,previous-current);
      if(reduced>0){
        if(credit>reduced) traitRecommendationCredits.set(row,credit-reduced);
        else traitRecommendationCredits.delete(row);
      }
    }
    traitRecommendationObserved.set(row,current);
  }
}
function traitRecommendationSaveState(){
  synchronizeTraitRecommendationCredits();
  return {version:1,credits:Object.fromEntries(traitRecommendationCredits),observed:Object.fromEntries(traitRecommendationObserved)};
}
function restoreTraitRecommendationSaveState(state){
  traitRecommendationCredits.clear();
  traitRecommendationObserved.clear();
  if(state?.version===1 && state.credits && state.observed){
    for(const t of TRAITS){
      const row=t[0], current=INV[row]||0;
      const observed=+state.observed[row];
      const credit=+state.credits[row]||0;
      if(observed===current && Number.isInteger(credit) && credit>0 && credit<=current){
        traitRecommendationCredits.set(row,credit);
      }
    }
  }
  synchronizeTraitRecommendationCredits();
}
/* ── 12 · 승단 계산 ── */
/* 더제로 승단 */
function zeroScoreNumber(value, min, max){
  const n=Number(value);
  if(!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function zeroRangeScore(value, start, maxValue, pointForStep){
  let sum=0;
  const max=zeroScoreNumber(value,0,maxValue);
  for(let i=start;i<=max;i++) sum+=pointForStep(i) || 0;
  return sum;
}
function zeroPenanceScore(level){
  return zeroRangeScore(level,1,20,i=>i<=13 ? 1 : (i<=16 ? 2 : (i===17 ? 3 : 7)));
}
const ZERO_HONOR_STAGES=[{key:'b', point:2},{key:'a', point:4},{key:'s', point:6},{key:'x', point:8},{key:'xd', point:10}];
function zeroHonorScore(stage){
  const found=ZERO_HONOR_STAGES.find(item=>item.key===normalizeZeroHonorValue(stage));
  return found ? found.point : 0;
}
function zeroTowerScore(floor){
  return zeroRangeScore(floor,41,90,i=>i<=60 ? 1 : (i<=70 ? 2 : 3));
}
function zeroHonorTowerScore(floor){
  const f=Math.max(0,Math.min(90,Math.floor(Number(floor)||0)));
  let score=0;
  if(f>=50) score+=Math.floor((Math.min(f,68)-48)/2);
  if(f>=70) score+=Math.min(f,79)-69;
  if(f>=80) score+=(Math.min(f,90)-79)*2;
  return score;
}
function normalizeZeroHonorValue(value){
  const text=dataText(value).toLowerCase().replace(/명예/g,'').trim();
  if(ZERO_HONOR_STAGES.some(item=>item.key===text)) return text;
  const first=text.charAt(0);
  if(['b','a','s','x'].includes(first)) return first;
  if(['없음','none','off','n','0','-',''].includes(text)) return '0';
  return '0';
}
function firstOwnedValue(row, keys, fallback, mapper=value=>value){
  if(!row || typeof row!=='object') return fallback;
  for(const key of keys){
    if(hasOwn(row,key)) return mapper(row[key]);
  }
  return fallback;
}
const ZERO_SCORE_VALUE_FIELDS=Object.freeze({
  current:['current','현재 일반'],
  target:['target','목표 일반'],
  currentHonor:['currentHonor','현재 명예'],
  targetHonor:['targetHonor','목표 명예'],
  honorCurrent:['honorCurrent','현재 명예탑'],
  honorTarget:['honorTarget','목표 명예탑']
});
function zeroScoreValue(row, field, fallback, mapper=value=>value){
  return firstOwnedValue(row, ZERO_SCORE_VALUE_FIELDS[field] || [field], fallback, mapper);
}
function zeroScoreFieldValue(row, kind){
  return zeroScoreValue(row,kind,undefined);
}
function zeroScoreHonorValue(row, kind){
  return zeroScoreValue(row,kind==='current' ? 'currentHonor' : 'targetHonor','0',normalizeZeroHonorValue);
}
function zeroScoreTowerHonorValue(row, kind){
  return zeroScoreValue(row,kind==='current' ? 'honorCurrent' : 'honorTarget',
    row?.type==='honorTower' ? zeroScoreFieldValue(row,kind) : undefined);
}
function zeroScoreDelta(currentScore,targetScore){
  return Math.max(0,targetScore-currentScore);
}
function zeroScorePair(row, scorer, kind='base'){
  const currentValue=kind==='towerHonor' ? zeroScoreTowerHonorValue(row,'current') : zeroScoreFieldValue(row,'current');
  const targetValue=kind==='towerHonor' ? zeroScoreTowerHonorValue(row,'target') : zeroScoreFieldValue(row,'target');
  const currentScore=scorer(currentValue);
  const targetScore=scorer(targetValue);
  return {currentScore,targetScore,score:zeroScoreDelta(currentScore,targetScore)};
}
function zeroScoreRowCalculation(row){
  const type=row?.type || 'penance';
  if(type==='penance'){
    const penance=zeroScorePair({
      current:zeroScoreNumber(zeroScoreFieldValue(row,'current'),0,20),
      target:zeroScoreNumber(zeroScoreFieldValue(row,'target'),0,20)
    },zeroPenanceScore);
    const honor=zeroScorePair({
      current:zeroScoreHonorValue(row,'current'),
      target:zeroScoreHonorValue(row,'target')
    },zeroHonorScore);
    const star=row.star ? 2 : 0;
    return {
      currentScore:penance.currentScore+honor.currentScore+star,
      targetScore:penance.targetScore+honor.targetScore,
      score:penance.score+honor.score
    };
  }
  const calculator=ZERO_SCORE_ROW_CALCULATORS[type];
  return calculator ? calculator(row) : {currentScore:0,targetScore:0,score:0};
}
const ZERO_SCORE_ROW_CALCULATORS=Object.freeze({
  tower:row=>zeroScorePair(row,zeroTowerScore),
  honorTower:row=>zeroScorePair(row,zeroHonorTowerScore),
  towerCombo:row=>{
    const tower=zeroScorePair(row,zeroTowerScore);
    const honor=zeroScorePair(row,zeroHonorTowerScore,'towerHonor');
    return {
      currentScore:tower.currentScore+honor.currentScore,
      targetScore:tower.targetScore+honor.targetScore,
      score:tower.score+honor.score
    };
  }
});
const ZERO_TOWER_COMBO_EMPTY_FIELDS=Object.freeze({star:false,currentHonor:'0',targetHonor:'0'});
function makeZeroPenanceState(row={}){
  return {
    type:'penance',
    current:String(zeroScoreNumber(zeroScoreFieldValue(row,'current'),0,20)),
    target:String(zeroScoreNumber(zeroScoreFieldValue(row,'target'),0,20)),
    star:!!row.star,
    currentHonor:zeroScoreHonorValue(row,'current'),
    targetHonor:zeroScoreHonorValue(row,'target')
  };
}
function makeZeroTowerComboState(base={}, honor=base){
  return {
    type:'towerCombo',
    current:String(zeroScoreNumber(zeroScoreFieldValue(base,'current'),0,90)),
    target:String(zeroScoreNumber(zeroScoreFieldValue(base,'target'),0,90)),
    honorCurrent:String(zeroScoreNumber(zeroScoreTowerHonorValue(honor,'current'),0,90)),
    honorTarget:String(zeroScoreNumber(zeroScoreTowerHonorValue(honor,'target'),0,90)),
    ...ZERO_TOWER_COMBO_EMPTY_FIELDS
  };
}
function zeroTowerComboFromRows(rows, index=14){
  const list=Array.isArray(rows) ? rows : [];
  const base=list[index] || {};
  if(base.type==='towerCombo') return makeZeroTowerComboState(base);
  const honor=base.type==='honorTower' ? base : (list[index+1] || {});
  return makeZeroTowerComboState(base,honor);
}
function normalizeZeroScoreState(zeroScore){
  const sourceRows=Array.isArray(zeroScore?.rows) ? zeroScore.rows : [];
  // 구형 화면에서 안내(★) 행까지 입력으로 저장한 16행 데이터는 안내만 제외한다.
  // 정상 15행 프리셋은 기존 순서를 변경하지 않는다.
  const hasLegacyInfoRow=sourceRows.length===ZERO_PENANCE_ROWS.length+2
    && sourceRows[ZERO_PENANCE_ROWS.length]?.type==='penance'
    && sourceRows[ZERO_PENANCE_ROWS.length+1]?.type==='towerCombo';
  const inputRows=hasLegacyInfoRow ? sourceRows.slice(1) : sourceRows;
  const rows=ZERO_PENANCE_ROWS.map((_,index)=>makeZeroPenanceState(inputRows[index] || {}));
  rows.push(zeroTowerComboFromRows(inputRows));
  return {rows};
}
