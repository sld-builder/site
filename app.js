(() => {

    /* ==========================================================================
       01. 공통 설정 및 정책
       ========================================================================== */

    const USER_CONFIG = window.NEXUS_USER_CONFIG || {};
    const clean = (s) => s ? String(s).replace(/\s+/g, '').toLowerCase() : '';
    const getUserConfigMap = (map) => Object.fromEntries(Object.entries(map || {}).map(([name, value]) => [clean(name), value]));
    const getUserConfigIds = (names) => new Set((Array.isArray(names) ? names : []).map(clean));
    const SELECTION_CONFIG = USER_CONFIG["검색·선택 설정"] || {};
    const SYSTEM_CONFIG = {
        policy: {
            maxUnitCapacity: 16,
            oneTimeMinGrade: "슈퍼히든",
            hiddenGroupMinGrade: "히든",
            minGradeForHiddenboard: "레어",
            hideCompletedExcludeGroups: ["최종 목표"],
            restoreAllBtn: {
                idBtn: "btnRestoreAll",
                idLabel: "btnRestoreAllLabel",
                labelDefault: "전체 초기화",
                labelDone: "초기화됨 ✓",
                classDone: "reset-btn-done"
            }
        },
        grades: {
            order: ["기초", "매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "고유히든", "슈퍼히든"],
            colors: {
                "기초": "var(--grade-basic)", "매직": "var(--grade-magic)", "레어": "var(--grade-rare)", "에픽": "var(--grade-epic)", "유니크": "var(--grade-unique)",
                "헬": "var(--grade-hell)", "레전드": "var(--grade-legend)", "히든": "var(--grade-hidden)", "고유히든": "var(--grade-unique-hidden)", "슈퍼히든": "var(--grade-super)",
                "스킬사용": "var(--grade-skill-use)"
            }
        },
        tabs: [
            { key: "테바", name: "테바" }, { key: "테메", name: "테메" },
            { key: "토바", name: "토바" }, { key: "토메", name: "토메" },
            { key: "저그중립", name: "저그중립" }, { key: "혼종", name: "혼종" }
        ],
        essence: {
            mapping: { "테바": "코랄", "테메": "코랄", "토바": "아이어", "토메": "아이어", "저그중립": "제루스", "혼종": "혼종" }
        },
        sorting: { order: { "아몬": 100, "나루드": 97 } },
        groupDefs: [
            { id: 'group-target',       pid: 'grid-target',       title: '최종 목표', resetLevel: 5, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '최종 복구' },
            { id: 'group-special',      pid: 'grid-special',      title: '직속 재료', resetLevel: 4, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '직속 복구' },
            { id: 'group-upper-hidden', pid: 'grid-upper-hidden', title: '히든 재료', resetLevel: 3, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '히든 복구' },
            { id: 'group-basic-hidden', pid: 'grid-basic-hidden', title: '기본 재료', resetLevel: 2, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '기본 복구' }
        ],
        costboardAtoms: [
            "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴",
            "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥",
            "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라",
            "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타", "메시브"
        ],
        costboardSlots: [
            { atoms: ["전쟁광"] },
            { atoms: ["스파르타중대"] },
            { atoms: ["암흑광전사"] },
            { atoms: ["암흑파수기"] },
            { atoms: ["원시바퀴"] },
            { atoms: ["저격수"] },
            { atoms: ["코브라"] },
            { atoms: ["암흑고위기사"] },
            { atoms: ["암흑추적자"] },
            { atoms: ["변종가시지옥"] },
            { atoms: ["망치경호대"] },
            { atoms: ["공성파괴단"] },
            { atoms: ["암흑집정관"] },
            { atoms: ["암흑불멸자"] },
            { atoms: ["원시히드라"] },
            { atoms: ["갓오타", "메시브"] },
            { atoms: ["땅거미지뢰"] },
            { atoms: ["자동포탑"] },
            { atoms: ["우르사돈수"] },
            { atoms: ["우르사돈암"] }
        ],
        storageKeys: window.NEXUS_STORAGE_KEYS || {
            saveData: "nexusSaveData",
            favorites: "nexusFavorites",
            fontScale: "nexusFontScaleV2"
        },
        search: { minGradeForSearch: "레전드" }
    };

    const IGNORE_PARSE_RECIPES = ["미발견", "없음", ""];
    const isConditionOnlyRecipe = (item) => item.id === "데하카의오른팔";
    const ATOM_HASH = Object.fromEntries(SYSTEM_CONFIG.costboardAtoms.map(a => [clean(a), a]));
    const CLEAN_TOOLS_MAP = Object.fromEntries(Object.entries(getUserConfigMap(USER_CONFIG["도구유닛"]))
        .filter(([, tools]) => Array.isArray(tools))
        .map(([id, tools]) => [id, tools.map(clean)]));
    const CLEAN_RESTRICTED_IDS = getUserConfigIds(SELECTION_CONFIG["검색제외"]);
    const CLEAN_UNITBOARD_VISIBLE_EXCEPTION_IDS = getUserConfigIds(USER_CONFIG["도감표시추가"]);
    const CLEAN_EXCLUDE_ESSENCE_UNITS = getUserConfigIds(USER_CONFIG["정수계산제외"]);
    // 자동 완료 그룹의 재료 판정은 사용자 수동 설정이 아닌 내부 규칙이다.
    const AUTO_COST_SLOT_RAWS = ['갓오타', '메시브', '자동포탑'];
    const AUTO_COST_SLOT_SET = new Set(AUTO_COST_SLOT_RAWS.map(clean));
    const SPECIAL_RENDER_LIST = AUTO_COST_SLOT_RAWS.map(raw => ({ id: clean(raw), raw, batch: raw === '자동포탑' ? 5 : 1 }));
    const AUTO_RECIPE_REQUIREMENT_SET = new Set(['갓오타', '메시브'].map(clean));
    const AUTO_COST_RAW_MAP = Object.fromEntries(AUTO_COST_SLOT_RAWS.map(id => [clean(id), id]));
    // 이전 버전 저장 데이터의 재료 완료값을 정규화하기 위한 호환 목록.
    const LEGACY_COMPLETION_ATOMS = [
        "죽음의머리", "검은망치", "광전사석상", "교란기", "라바사우르스",
        "악령", "ARES", "정화자사도", "선동자", "브루탈리스크",
        "짐레이너", "대천사", "제라툴", "거신", "케리건",
        "스투코프", "오딘", "혼종파멸자", "분노수호자", "혼종약탈자"
    ];
    const LEGACY_COMPLETION_RAW_MAP = Object.fromEntries(LEGACY_COMPLETION_ATOMS.map(atom => [clean(atom), atom]));
    // 재료보드의 확장 20종은 기존 저장 데이터와 같은 정규화 목록을 사용한다.
    const INVENBOARD_EXPANSION_ATOMS = LEGACY_COMPLETION_ATOMS;

    const LEGACY_COMPLETION_ATOM_ID_SET = new Set(LEGACY_COMPLETION_ATOMS.map(clean));
    const HELPER_ID = clean('도우미');
    const VOID_RAY_ATOM = '공허포격기';
    const VOID_RAY_ID = clean(VOID_RAY_ATOM);
    const isAutoRecipeRequirementSatisfied = (id) =>
        AUTO_RECIPE_REQUIREMENT_SET.has(id) ||
        ((_currentViewMode === 'hiddenboard' || _currentViewMode === 'invenboard') && id === HELPER_ID);
    const INVENBOARD_EXPANSION_ATOM_ID_SET = LEGACY_COMPLETION_ATOM_ID_SET;
    const COSTBOARD_ATOM_ID_SET = new Set(SYSTEM_CONFIG.costboardAtoms.map(clean));
    const INVENBOARD_SLOT_SET = new Set([...COSTBOARD_ATOM_ID_SET, ...AUTO_COST_SLOT_SET, HELPER_ID, VOID_RAY_ID]);
    const ALL_INVENBOARD_SLOT_SET = new Set([...INVENBOARD_SLOT_SET, ...INVENBOARD_EXPANSION_ATOM_ID_SET]);
    const CLEAN_INVENBOARD_INSTANT_COMPLETE = getUserConfigIds(USER_CONFIG["재료보드즉시완료"]);
    const COSTBOARD_COMPLETION_ID_SET = new Set([...SYSTEM_CONFIG.costboardAtoms.map(clean), ...AUTO_COST_SLOT_SET, ...LEGACY_COMPLETION_ATOM_ID_SET, HELPER_ID, VOID_RAY_ID]);
    const CLEAN_ONE_TIME_UNITS = getUserConfigIds(SELECTION_CONFIG["1회선택"]);
    const CLEAN_UNIT_QTY_CAPS = Object.fromEntries(Object.entries(getUserConfigMap(SELECTION_CONFIG["최대수량"]))
        .map(([id, cap]) => [id, parseInt(cap, 10)])
        .filter(([, cap]) => Number.isFinite(cap) && cap > 0));
    const AUTO_COMPLETE_IDS = [...AUTO_COST_SLOT_SET];
    const CLEAN_SPECIAL_CONDITIONS = getUserConfigMap(USER_CONFIG["특수조건"]);
    const CLEAN_UNIT_CONDITIONS = getUserConfigMap(USER_CONFIG["유닛정보"]);
    const COSTBOARD_SLOT_DEFS = (Array.isArray(SYSTEM_CONFIG.costboardSlots) && SYSTEM_CONFIG.costboardSlots.length
        ? SYSTEM_CONFIG.costboardSlots
        : (SYSTEM_CONFIG.costboardAtoms || []).map(atom => ({ atoms: [atom] })))
        .map(slot => ({
            atoms: (Array.isArray(slot?.atoms) ? slot.atoms : [slot?.atom]).filter(Boolean)
        }))
        .filter(slot => slot.atoms.length > 0);
    // 갓오타·메시브는 원가 계산에만 유지하고, 기본 표시 슬롯에는 공허 포격기를 배치한다.
    const COSTBOARD_DISPLAY_SLOT_DEFS = COSTBOARD_SLOT_DEFS.map(slot =>
        slot.atoms.length === 2 && slot.atoms.every(atom => ['갓오타', '메시브'].includes(atom))
            ? { atoms: [VOID_RAY_ATOM] }
            : slot
    );
    const INVENBOARD_EXPANSION_SLOT_DEFS = INVENBOARD_EXPANSION_ATOMS.map(atom => ({ atoms: [atom] }));
    const GROUP_DEFS = SYSTEM_CONFIG.groupDefs;
    const titleToGridId = Object.fromEntries(GROUP_DEFS.map(g => [g.title, g.pid]));
    const FAVORITES_KEY = SYSTEM_CONFIG.storageKeys?.favorites || 'nexusFavorites';
    /* 내부 안전장치·조작 정책 */
    const APP_INTERNAL = {
        maxLoopQueue: 1000,
        maxAutoCompletePasses: 64,
        hapticDuration: 15,
        searchFailFeedbackDelay: 1500,
        completeLockDelay: 300,
        appVersionDisplayMs: 1500,
        titleMainDisplayMs: 5000,
        titleCreatorDisplayMs: 3000,
        titleTransitionMs: 180,
        accelInterval: 80,
        accelMinInterval: 20,
        accelDecreaseStep: 5,
        accelStepUnit: 6,
        accelShiftMultiplier: 5,
        holdStartDelay: 400,
        mouseAfterTouchDelay: 500,
        fontHoldStartDelay: 600,
        fontHoldRepeatDelay: 300,
        fontScaleMin: 0.8,
        fontScaleMax: 2.0,
        fontScaleStep: 0.05,
        restoreAllResetDelay: 1500,
        restoreAllPendingDelay: 2000
    };

    /* ==========================================================================
       02. 공통 유틸리티
       ========================================================================== */

    /* DOM·등급·검색 공통 유틸 */
    const getEl = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));

    const triggerHaptic = () => navigator.vibrate?.(APP_INTERNAL.hapticDuration);
    const virtualUnitIds = new Set(AUTO_COMPLETE_IDS);
    const isToolRequirement = (parent, child) => CLEAN_TOOLS_MAP[parent]?.includes(child);
    const getToolNeed = (parent) => CLEAN_TOOLS_MAP[parent] || [];
    const isRestrictedUnit = (id) => CLEAN_RESTRICTED_IDS.has(id);
    const getGradeIndex = (grade) => GRADE_INDEX_MAP.has(grade) ? GRADE_INDEX_MAP.get(grade) : -99;
    const isInvenboardInstantCompleteUnit = (uid) => CLEAN_INVENBOARD_INSTANT_COMPLETE.has(clean(uid));
    const getInvenboardAtomGrade = (atom) => AUTO_COST_SLOT_SET.has(clean(atom)) ? '스킬사용' : (unitMap.get(clean(atom))?.grade || '');
    const renderInvenboardGradeTag = (atom) => {
        const grade = getInvenboardAtomGrade(atom);
        return grade ? `<span class="invenboard-grade gtag grade-${grade}">${escapeHtml(grade)}</span>` : '';
    };
    const getInvenboardAtomNameStyle = (atom) => {
        const color = SYSTEM_CONFIG.grades.colors[getInvenboardAtomGrade(atom)];
        return color ? ` style="color:${color};"` : '';
    };

    const isOneTime = (u) => u && (CLEAN_ONE_TIME_UNITS.has(u.id) || getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.oneTimeMinGrade || "슈퍼히든"));
    const getUnitNameStyle = (unit) => {
        const color = SYSTEM_CONFIG.grades.colors[unit?.grade];
        return color ? `style="color:${color};"` : '';
    };
    const calculateTotalCostScore = (u) => u?.parsedCost?.reduce((sum, pc) => sum + (pc.qty || 0), 0) || 0;
    const compareUnitForDisplay = (a, b) =>
        (isOneTime(b) ? 1 : 0) - (isOneTime(a) ? 1 : 0) ||
        getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
        (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
        calculateTotalCostScore(b) - calculateTotalCostScore(a) ||
        (a.name || '').localeCompare(b.name || '');
    const compareUnitByHiddenboardPriority = (a, b) =>
        getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
        (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
        a.name.localeCompare(b.name);
    const compareUnitByGradeName = (a, b) =>
        getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
        a.name.localeCompare(b.name);
    const getUnitsFromIds = (ids) => Array.from(ids).map(uid => unitMap.get(uid)).filter(Boolean);
    const getUnitsFromMap = (map) => getUnitsFromIds(map.keys()).sort(compareUnitForDisplay);
    /* ==========================================================================
       03. 데이터·상태·캐시·저장
       ========================================================================== */
    const unitMap = new Map(), activeUnits = new Map(), pausedUnits = new Map(), completedUnits = new Map(), depCache = new Map();
    const completedTargets = new Map(), _invenboardAutoCompletedUnits = new Map(), _invenboardManualInputs = new Map(), _unitNativeLevels = new Map(), _unitRestoreLevels = new Map();
    const _selectionResetRetainedCompleted = new Map();
    let _actionFeedbackTimer = null;
    const _depVisiting = new Set();
    const GRADE_INDEX_MAP = new Map(SYSTEM_CONFIG.grades.order.map((grade, index) => [grade, index]));
    const _boardRequirementsCache = new Map(), _costboardTotalsCache = new Map(), _directInvenboardAtomNeedCache = new Map(), _unitEssencePartsCache = new Map();
    const _hiddenboardSlotElsByUid = new Map(), _unitCardElsByUid = new Map(), _favoriteBtnElsByUid = new Map(), _dirtyUnitCardIds = new Set();
    let _unitboardDomIndexed = false, _lastUnitboardQtyByUid = new Map();

    /* 선택·완료·화면 상태 */
    const _favorites = new Set((() => {
        try {
            const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch { return []; }
    })());
    let _unitboardCollection = null;
    let _activeTabIdx = 0, _currentViewMode = 'unitboard', _currentHighlight = null, _hideCompleted = false;
    let _invenboardInputMode = 'auto', _isInvenboardSlotsExpanded = false, _isInvenboardRendered = false;
    let _highlightGroupState = null;
    let _cartTab = 'active', _isTabContentInitialized = false, _isHiddenboardRendered = false;
    let repeatTimer = null, repeatDelayTimer = null, _lastInteractionTime = 0, _currentAccelInterval = APP_INTERNAL.accelInterval, _touchHoldCount = 0, _smartChangePointerCardUid = null;
    let updateTimer = null, _completeLock = new Set(), _presetUsed = new Map(), _restoreAllCooldown = false;
    let _restoreAllPendingTimer = null;
    let _lastCalcResult = null;
    let _fontRepeatTimer = null, _fontRepeatDelayTimer = null, _swipeTimer = null;
    let _titleRotationTimer = null, _titleTransitionTimer = null, _titleVersionTimer = null;
    let _isSwiping = false;
    let _presetTab = '일반 프리셋';
    let _fontScale = 1.0;
    const IS_STANDALONE_BUILD = new URLSearchParams(window.location.search).get('nexusStandalone') === 'build';
    let _buildStandaloneWindow = null;

    /* 선택 상태·수량 관리 */
    const getUnitQtyLimit = (uid) => {
        const u = unitMap.get(uid);
        if (!u) return 0;
        const customCap = CLEAN_UNIT_QTY_CAPS[clean(uid)] || 0;
        if (customCap > 0) return customCap;
        return isOneTime(u) ? 1 : SYSTEM_CONFIG.policy.maxUnitCapacity;
    };
    const normalizeUnitQty = (uid, qty) => {
        const n = parseInt(qty, 10);
        if (!Number.isFinite(n) || n <= 0) return 0;
        const limit = getUnitQtyLimit(uid);
        return limit > 0 ? Math.min(n, limit) : 0;
    };
    const setPositiveMapValue = (map, uid, qty) => {
        const normalized = normalizeUnitQty(uid, qty);
        if (normalized > 0) map.set(uid, normalized);
    };
    const CART_TABS = ['active', 'paused', 'done'];
    const isValidCartTab = (tab) => CART_TABS.includes(tab);
    const setCartTab = (tab) => { _cartTab = isValidCartTab(tab) ? tab : 'active'; };
    const setActiveUnitQty = (uid, qty, { add = false } = {}) => {
        const unit = unitMap.get(uid);
        if (!unit || isRestrictedUnit(uid)) return false;
        const limit = getUnitQtyLimit(uid);
        const completedTargetQty = Math.max(0, parseInt(completedTargets.get(uid), 10) || 0);
        const requestedQty = parseInt(qty, 10) || 1;
        const maxActiveQty = Math.max(0, limit - completedTargetQty);
        const baseQty = add ? (activeUnits.get(uid) || 0) : 0;
        const nextQty = Math.min(normalizeUnitQty(uid, baseQty + requestedQty), maxActiveQty);
        if (nextQty <= 0) return false;
        activeUnits.set(uid, nextQty);
        pausedUnits.delete(uid);
        return true;
    };
    /* 상태 정규화·데이터 캐시 */
    const makeMapSignature = (map) => [...(map instanceof Map ? map : new Map(map || [])).entries()]
        .map(([uid, qty]) => [uid, Math.max(0, parseInt(qty, 10) || 0)]).filter(([, qty]) => qty > 0)
        .sort(([a], [b]) => String(a).localeCompare(String(b))).map(([uid, qty]) => `${uid}:${qty}`).join('|');
    const makeObjectSignature = (obj, keys) => (keys || Object.keys(obj || {})).map(key => `${key}:${Math.max(0, parseInt(obj?.[key], 10) || 0)}`).join('|');
    const limitCacheSize = (cache, maxSize) => { while (cache.size > maxSize) cache.delete(cache.keys().next().value); };
    const cloneTotals = (totals) => ({ targetMap: { ...totals.targetMap }, completedMap: { ...totals.completedMap }, remainingMap: { ...totals.remainingMap } });

    function writeRuntimeStateEntry(map, rawUid, rawQty, { allowAutoCost = false, keepCompletedQty = false } = {}) {
        const uid = normalizeSavedId(rawUid);
        const qty = parseInt(rawQty, 10);
        if (!Number.isFinite(qty) || qty <= 0) return false;
        if (unitMap.has(uid)) {
            if (keepCompletedQty) map.set(uid, qty);
            else setPositiveMapValue(map, uid, qty);
            return true;
        }
        if (allowAutoCost && COSTBOARD_COMPLETION_ID_SET.has(uid)) {
            map.set(uid, qty);
            return true;
        }
        return false;
    }

    // 재료보드 저장 상태 복원·정규화
    function addInvenboardAutoCompletedUnit(uid, qty) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0 || !unitMap.has(uid)) return;
        _invenboardAutoCompletedUnits.set(uid, Math.max(0, _invenboardAutoCompletedUnits.get(uid) || 0) + amount);
    }

    function pruneInvenboardAutoCompletedUnits() {
        for (const [uid, rawQty] of [..._invenboardAutoCompletedUnits.entries()]) {
            const trackedQty = Math.max(0, parseInt(rawQty, 10) || 0);
            const completedQty = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
            const nextQty = Math.min(trackedQty, completedQty);
            if (nextQty > 0 && unitMap.has(uid) && !activeUnits.has(uid) && !completedTargets.has(uid)) {
                _invenboardAutoCompletedUnits.set(uid, nextQty);
            } else {
                _invenboardAutoCompletedUnits.delete(uid);
            }
        }
    }

    function pruneInvenboardManualInputs() {
        let changed = false;
        for (const [rawId, rawQty] of [..._invenboardManualInputs.entries()]) {
            _invenboardManualInputs.delete(rawId);
            const id = normalizeSavedId(rawId);
            const qty = Math.max(0, parseInt(rawQty, 10) || 0);
            if (!id || !ALL_INVENBOARD_SLOT_SET.has(id) || qty <= 0) {
                changed = true;
                continue;
            }
            _invenboardManualInputs.set(id, qty);
            if (id !== rawId || qty !== rawQty) changed = true;
        }
        return changed;
    }

    function clearInvenboardManualInputs(ids = ALL_INVENBOARD_SLOT_SET) {
        let changed = false;
        ids.forEach(id => {
            if (_invenboardManualInputs.delete(id)) changed = true;
        });
        return changed;
    }

    function resetInvenboardAutoCompletedUnits() {
        let changed = false;
        for (const [uid, qty] of [..._invenboardAutoCompletedUnits.entries()]) {
            if (!completedUnits.has(uid)) {
                _invenboardAutoCompletedUnits.delete(uid);
                continue;
            }
            subtractCompletedUnitQty(uid, qty);
            changed = true;
        }
        pruneInvenboardAutoCompletedUnits();
        return changed;
    }

    function initializeCacheEngine() {
        depCache.clear();
        _boardRequirementsCache.clear(); _costboardTotalsCache.clear(); _directInvenboardAtomNeedCache.clear(); _unitEssencePartsCache.clear();
        unitMap.forEach(u => {
            u.parsedCost = [];
            if (u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
                u.cost.replace(/\//g, '+').split('+').forEach(p => {
                    const m = p.match(/(.+?)\[(\d+)\]/);
                    let cName = clean(m ? m[1].trim() : p.trim()), qty = m ? parseInt(m[2], 10) : 1;
                    let key = cName;
                    const spKey = AUTO_COMPLETE_IDS.find(k => k === cName || cName.includes(k));
                    if (spKey) key = spKey;
                    else key = ATOM_HASH[cName] || cName;
                    u.parsedCost.push({ key, qty });
                });
            }
            u.parsedRecipe = [];
            if (u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe) && !isConditionOnlyRecipe(u)) {
                splitRecipe(u.recipe).forEach(p => {
                    const m = parseRecipePart(p);
                    if (m) u.parsedRecipe.push({ id: clean(m[1]), qty: m[3] ? parseInt(m[3], 10) : 1, cond: m[2] || '' });
                });
            }
        });
    }


    function sanitizeRuntimeState() {
        const normalizeMap = (map, options = {}) => {
            for (const [rawUid, rawQty] of [...map.entries()]) {
                map.delete(rawUid);
                writeRuntimeStateEntry(map, rawUid, rawQty, options);
            }
        };
        normalizeMap(activeUnits);
        normalizeMap(pausedUnits);
        normalizeMap(completedTargets);
        normalizeMap(completedUnits, { allowAutoCost: true, keepCompletedQty: true });
        pruneSelectionResetRetainedCompleted();
        pruneInvenboardAutoCompletedUnits();
        pruneInvenboardManualInputs();
        activeUnits.forEach((_, uid) => pausedUnits.delete(uid));
        completedTargets.forEach((_, uid) => {
            activeUnits.delete(uid);
            pausedUnits.delete(uid);
        });
        if (!isValidCartTab(_cartTab)) _cartTab = 'active';
    }

    const getInvenboardTrackedTargets = (source = activeUnits) => {
        const tracked = new Map(source instanceof Map ? source : []);
        if (source === activeUnits) completedTargets.forEach((qty, uid) => {
            const amount = Math.max(0, parseInt(qty, 10) || 0);
            if (amount > 0) tracked.set(uid, (tracked.get(uid) || 0) + amount);
        });
        return tracked;
    };
    const UNIT_ID_ALIASES = Object.freeze({ '테사다르': '태사다르', '케이다란초석': '케이다린초석' });
    const normalizeSavedId = (id) => {
        const normalized = typeof id === 'string' ? clean(id) : '';
        return UNIT_ID_ALIASES[normalized] || normalized;
    };

    /* 저장·검색·명령 */
    function hydrateSavedUnitMap(entries, targetMap, options = {}) {
        if (!Array.isArray(entries)) return;
        entries.forEach(entry => {
            if (!Array.isArray(entry) || entry.length < 2) return;
            writeRuntimeStateEntry(targetMap, entry[0], entry[1], options);
        });
    }

    function getPersistedStatePayload() {
        return {
            active: [...activeUnits],
            paused: [...pausedUnits],
            completed: [...completedUnits],
            selectionResetRetainedCompleted: [..._selectionResetRetainedCompleted],
            completedTargets: [...completedTargets],
            invenboardAutoCompleted: [..._invenboardAutoCompletedUnits],
            invenboardManualInputs: [..._invenboardManualInputs],
            cartTab: _cartTab,
            presetUsed: [..._presetUsed],
            hideCompleted: _hideCompleted
        };
    }

    function loadNexusState() {
        try {
            const data = localStorage.getItem(SYSTEM_CONFIG.storageKeys.saveData);
            if (!data) return;
            const state = JSON.parse(data);
            if (!state || typeof state !== 'object') return;

            activeUnits.clear();
            pausedUnits.clear();
            completedUnits.clear();
            _selectionResetRetainedCompleted.clear();
            completedTargets.clear();
            _invenboardAutoCompletedUnits.clear();
            _invenboardManualInputs.clear();
            _presetUsed.clear();

            hydrateSavedUnitMap(state.active, activeUnits);
            hydrateSavedUnitMap(state.paused, pausedUnits);
            hydrateSavedUnitMap(state.completed, completedUnits, { allowAutoCost: true, keepCompletedQty: true });
            hydrateSavedUnitMap(state.selectionResetRetainedCompleted, _selectionResetRetainedCompleted, { allowAutoCost: true, keepCompletedQty: true });
            hydrateSavedUnitMap(state.completedTargets, completedTargets);
            hydrateSavedUnitMap(state.invenboardAutoCompleted, _invenboardAutoCompletedUnits, { keepCompletedQty: true });
            if (Array.isArray(state.invenboardManualInputs)) {
                state.invenboardManualInputs.forEach(entry => {
                    if (!Array.isArray(entry) || entry.length < 2) return;
                    const id = normalizeSavedId(entry[0]), qty = parseInt(entry[1], 10);
                    if (ALL_INVENBOARD_SLOT_SET.has(id) && Number.isFinite(qty) && qty > 0) _invenboardManualInputs.set(id, qty);
                });
            }
            _cartTab = isValidCartTab(state.cartTab) ? state.cartTab : 'active';
            if (Array.isArray(state.presetUsed)) {
                state.presetUsed.forEach(entry => {
                    if (!Array.isArray(entry) || entry.length < 2) return;
                    const idx = parseInt(entry[0], 10);
                    if (Number.isInteger(idx) && PRESETS[idx]) _presetUsed.set(idx, !!entry[1]);
                });
            }
            _hideCompleted = !!state.hideCompleted;

            sanitizeRuntimeState();
        } catch {
            activeUnits.clear();
            pausedUnits.clear();
            completedUnits.clear();
            _selectionResetRetainedCompleted.clear();
            completedTargets.clear();
            _invenboardAutoCompletedUnits.clear();
            _invenboardManualInputs.clear();
            _presetUsed.clear();
        }
    }

    function saveNexusState() {
        try {
            sanitizeRuntimeState();
            localStorage.setItem(SYSTEM_CONFIG.storageKeys.saveData, JSON.stringify(getPersistedStatePayload()));
        } catch {}
    }

    function saveFavorites() {
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([..._favorites].sort())); }
        catch {}
    }

    function pruneFavorites() {
        let changed = false;
        [..._favorites].forEach(rawId => {
            const id = normalizeSavedId(rawId);
            if (id !== rawId || !unitMap.has(id)) {
                _favorites.delete(rawId);
                if (unitMap.has(id)) _favorites.add(id);
                changed = true;
            }
        });
        if (changed) saveFavorites();
    }

    /* 상태 변경·화면 동기화 */
    function debouncedUpdateAllPanels() {
        if (updateTimer) cancelAnimationFrame(updateTimer);
        updateTimer = requestAnimationFrame(() => {
            let calcResult = calculateBoardRequirements();
            let costboardTotals = _currentViewMode === 'invenboard' ? calculateInvenboardCostboardTotals() : calculateCostboardAtomTotals();
            if (clampCompletedUnits(calcResult, costboardTotals)) {
                calcResult = calculateBoardRequirements();
                costboardTotals = _currentViewMode === 'invenboard' ? calculateInvenboardCostboardTotals() : calculateCostboardAtomTotals();
            }
            _lastCalcResult = calcResult;
            updateCostboard(costboardTotals, calcResult);
            updateTabsUI();
            updateTabContentUI();
            updateBoardPanel(calcResult, _currentViewMode === 'invenboard' ? costboardTotals : null);
            updateCartUI();
            updatePresetBtns();
            // 독립 창은 원본 저장 데이터를 읽기만 하며 덮어쓰지 않는다.
            if (!IS_STANDALONE_BUILD) saveNexusState();
        });
    }

    function commitNexusStateChange({ clearHighlight = false } = {}) {
        if (clearHighlight) toggleHighlight(null);
        triggerHaptic();
        debouncedUpdateAllPanels();
    }

    /* ==========================================================================
       04. 검색 및 프리셋
       ========================================================================== */
    const FINAL_GOAL_PRESET_GROUP = '최종목표 프리셋';
    const PRESETS = [
        { label: '불나아', group: '일반 프리셋', command: '불새케리건/나루드/아몬' },
        { label: '불나비', group: '일반 프리셋', command: '불새케리건/나루드/비밀작전노바' },
        { label: '불아비', group: '일반 프리셋', command: '불새케리건/아몬/비밀작전노바' },
        { label: '땅굴*8', group: '일반 프리셋', command: '땅굴파괴자*8' }
    ];
    const FIXED_PRESET_COUNT = PRESETS.length;
    const finalGoalPresetIds = new Set();

    /* 최종목표 조건을 적용하되, 종족별로는 같은 종족 내 상위 조합만 제외한다.
       타 종족의 재료로 쓰이는 목표는 종족별 프리셋에 유지하고 통합에서는 제외한다(유물 포함). */
    function initializeFinalGoalPresets() {
        const usedAsIngredient = new Set();
        const usedByGroup = new Map();
        unitMap.forEach(unit => {
            const group = SYSTEM_CONFIG.essence.mapping[unit.category];
            if (group && !usedByGroup.has(group)) usedByGroup.set(group, new Set());
            unit.parsedRecipe.forEach(part => {
                usedAsIngredient.add(part.id);
                if (group) usedByGroup.get(group).add(part.id);
            });
        });
        const grades = { '슈퍼히든': 0, '고유히든': 1, '히든': 2 };
        const candidates = [...unitMap.values()]
            .filter(unit => Object.hasOwn(grades, unit.grade))
            .sort((a, b) => grades[a.grade] - grades[b.grade] || a.name.localeCompare(b.name, 'ko'));

        finalGoalPresetIds.clear();
        PRESETS.length = FIXED_PRESET_COUNT;
        ['코랄', '아이어', '제루스', '혼종'].forEach(name => {
            const units = candidates.filter(unit => SYSTEM_CONFIG.essence.mapping[unit.category] === name
                && !usedByGroup.get(name)?.has(unit.id));
            units.forEach(unit => finalGoalPresetIds.add(unit.id));
            PRESETS.push({ label: `${name} ${units.length}종`, group: FINAL_GOAL_PRESET_GROUP, command: units.map(unit => unit.name).join('/') });
        });
        const combined = candidates.filter(unit => !usedAsIngredient.has(unit.id));
        PRESETS.push({ label: `통합 ${combined.length}종`, group: FINAL_GOAL_PRESET_GROUP, command: combined.map(unit => unit.name).join('/'), combined: true });
    }

    const applySearchFeedback = (input, message) => {
        if (!input) return;
        const originalPlaceholder = input.placeholder;
        input.value = '';
        input.classList.add('search-input-error');
        input.placeholder = message;
        setTimeout(() => {
            input.placeholder = originalPlaceholder;
            input.classList.remove('search-input-error');
        }, APP_INTERNAL.searchFailFeedbackDelay);
    };

    function setupSearchEngine() {
        const inp = getEl('unitSearchInput');
        const list = getEl('unitSearchSuggestions');
        if (!inp || !list) return;

        const searchableUnits = [...unitMap.values()].filter(unit =>
            isUnitboardVisibleUnit(unit) && !isRestrictedUnit(unit.id)
        );
        let activeIndex = -1;

        function closeSuggestions() {
            list.hidden = true;
            activeIndex = -1;
            inp.setAttribute('aria-expanded', 'false');
            inp.removeAttribute('aria-activedescendant');
        }

        function renderSuggestions() {
            closeSuggestions();
            const command = inp.value.slice(inp.value.lastIndexOf('/') + 1);
            const [unitName] = command.split('*', 1);
            const query = normalizeSavedId(unitName);
            if (!query) return;
            const matches = searchableUnits.filter(unit => unit.id.includes(query));
            matches.sort((a, b) => a.id.indexOf(query) - b.id.indexOf(query) || a.id.length - b.id.length);
            list.replaceChildren(...matches.slice(0, 8).map((unit, index) => {
                const option = document.createElement('div');
                option.id = `unit-search-option-${index}`;
                option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', 'false');
                option.textContent = unit.name;
                return option;
            }));
            if (!list.children.length) return;
            list.hidden = false;
            inp.setAttribute('aria-expanded', 'true');
        }

        function selectSuggestion(option) {
            const commandStart = inp.value.lastIndexOf('/') + 1;
            const quantityStart = inp.value.indexOf('*', commandStart);
            const quantity = quantityStart < 0 ? '' : inp.value.slice(quantityStart);
            inp.value = inp.value.slice(0, commandStart) + option.textContent + quantity;
            closeSuggestions();
        }

        function runSearch() {
            processCommand(inp.value);
            closeSuggestions();
            inp.blur();
        }

        getEl('btnRunUnitSearch')?.addEventListener('click', runSearch);
        inp.addEventListener('input', renderSuggestions);
        inp.addEventListener('blur', closeSuggestions);
        list.addEventListener('pointerdown', e => e.preventDefault());
        list.addEventListener('click', e => {
            const option = e.target.closest('[role="option"]');
            if (option) selectSuggestion(option);
        });
        inp.addEventListener('keydown', e => {
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === 'Escape' && !list.hidden) {
                e.stopPropagation();
                closeSuggestions();
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (list.hidden) renderSuggestions();
                if (list.hidden) return;
                e.preventDefault();
                list.children[activeIndex]?.setAttribute('aria-selected', 'false');
                const last = list.children.length - 1;
                activeIndex = e.key === 'ArrowDown' ? Math.min(last, activeIndex + 1)
                    : activeIndex < 0 ? last : Math.max(0, activeIndex - 1);
                const option = list.children[activeIndex];
                option.setAttribute('aria-selected', 'true');
                inp.setAttribute('aria-activedescendant', option.id);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!list.hidden && activeIndex >= 0) {
                    selectSuggestion(list.children[activeIndex]);
                    return;
                }
                runSearch();
            }
        });
    }

    function findUnitFlexible(rawName) {
        let cleaned = normalizeSavedId(rawName);
        if (!cleaned) return null;
        let best = null, bestScore = -1;
        for (let [id, u] of unitMap) {
            if (!isUnitboardVisibleUnit(u)) continue;
            if (id === cleaned) return u;
            if (id.includes(cleaned)) {
                const score = 100 - id.indexOf(cleaned) * 10 - (id.length - cleaned.length);
                if (score > bestScore) { bestScore = score; best = u; }
            }
        }
        return best;
    }

    function processCommand(val, fromPreset = false, preventStack = false) {
        if (!val.trim()) return;
        let successCount = 0, restrictedCount = 0;
        val.split('/').filter(c => c.trim()).forEach(cmd => {
            let parts = cmd.split('*'), targetName = parts[0].trim();
            if (!targetName) return;
            let qtyRaw = parseInt(parts[1], 10);
            let qty = (isNaN(qtyRaw) || qtyRaw < 1) ? 1 : Math.min(qtyRaw, SYSTEM_CONFIG.policy.maxUnitCapacity);
            const match = findUnitFlexible(targetName);
            if (match) {
                if (isRestrictedUnit(match.id)) { restrictedCount++; return; }
                if (fromPreset && preventStack && activeUnits.has(match.id)) { successCount++; return; }
                setActiveUnitQty(match.id, qty, { add: true });
                successCount++;
            }
        });
        if (successCount > 0) {
            debouncedUpdateAllPanels();
            const searchInp = getEl('unitSearchInput');
            if (searchInp) searchInp.value = '';
            if (_currentViewMode !== 'unitboard') switchLayout('unitboard');
        } else {
            applySearchFeedback(getEl('unitSearchInput'), restrictedCount > 0 ? '선택제한 유닛입니다.' : '유닛을 찾을 수 없습니다.');
        }
    }

    function getPresetCommandTargets(preset) {
        const targets = new Map();
        if (!preset?.command) return targets;
        String(preset.command).split('/').filter(c => c.trim()).forEach(cmd => {
            const parts = cmd.split('*'), targetName = parts[0].trim();
            if (!targetName) return;
            const match = findUnitFlexible(targetName);
            if (!match || isRestrictedUnit(match.id)) return;
            const qtyRaw = parseInt(parts[1], 10);
            const qty = normalizeUnitQty(match.id, Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1);
            if (qty <= 0) return;
            const nextQty = (targets.get(match.id) || 0) + qty;
            targets.set(match.id, normalizeUnitQty(match.id, nextQty));
        });
        return targets;
    }

    const isFinalGoalPreset = (preset) => preset?.group === FINAL_GOAL_PRESET_GROUP;
    const isTargetCoveredByHigherTarget = (uid, targets) => {
        for (const higherUid of targets) {
            if (higherUid !== uid && getDependencies(higherUid).has(uid)) return true;
        }
        return false;
    };
    function filterTopLevelFinalGoalTargets(targetMap) {
        if (!(targetMap instanceof Map) || targetMap.size === 0) return false;
        const targetIds = finalGoalPresetIds;
        const targets = [...targetMap.keys()].filter(uid => targetIds.has(uid) && unitMap.has(uid));
        const removeIds = targets.filter(uid => isTargetCoveredByHigherTarget(uid, targets));
        removeIds.forEach(uid => targetMap.delete(uid));
        return removeIds.length > 0;
    }
    function applyFinalGoalPresetTopLevelFilter() {
        const activeChanged = filterTopLevelFinalGoalTargets(activeUnits);
        const pausedChanged = filterTopLevelFinalGoalTargets(pausedUnits);
        return activeChanged || pausedChanged;
    }

    function getCartPresetUnitQty(uid) {
        return Math.max(0, activeUnits.get(uid) || 0) + Math.max(0, pausedUnits.get(uid) || 0) + Math.max(0, completedTargets.get(uid) || 0);
    }

    function isPresetActiveInCart(preset) {
        const targets = getPresetCommandTargets(preset);
        if (targets.size === 0) return false;
        const cartTargetIds = new Set([...activeUnits.keys(), ...pausedUnits.keys(), ...completedTargets.keys()].filter(uid => unitMap.has(uid)));
        for (const [uid, qty] of targets.entries()) {
            if (getCartPresetUnitQty(uid) >= qty) continue;
            if (!isFinalGoalPreset(preset) || !isTargetCoveredByHigherTarget(uid, cartTargetIds)) return false;
        }
        return true;
    }

    function syncPresetUsageState() {
        let changed = false;
        PRESETS.forEach((preset, idx) => {
            const used = isPresetActiveInCart(preset);
            if (used) {
                if (!_presetUsed.get(idx)) {
                    _presetUsed.set(idx, true);
                    changed = true;
                }
            } else if (_presetUsed.delete(idx)) {
                changed = true;
            }
        });
        return changed;
    }
    function renderPresetButtons() {
        const tabBar = getEl('presetInlineTabBar'), btnList = getEl('presetInlineBtnList'), wrap = getEl('presetInlineWrap');
        if (!tabBar || !btnList || !wrap) return;
        if (!PRESETS.length) { wrap.hidden = true; return; }

        const groups = [...new Set(PRESETS.filter(p => !(p.hidden === true || p.hidden === '비활성')).map(p => p.group || '일반 프리셋'))];
        if (!groups.includes(_presetTab)) _presetTab = groups[0];

        tabBar.style.display = groups.length > 1 ? 'flex' : 'none';
        tabBar.innerHTML = groups.map(g => `<button type="button" class="preset-inline-tab-btn${g === _presetTab ? ' active' : ''}" data-action="switchPresetTab" data-tab="${g}" aria-pressed="${g === _presetTab}">${g.replace(/ 프리셋$/, '')}</button>`).join('');

        btnList.innerHTML = PRESETS.map((p, i) => {
            const isHidden = p.hidden === true || p.hidden === '비활성';
            if (isHidden || (p.group || '일반 프리셋') !== _presetTab) return '';
            return `<button type="button" class="btn-gohaeng${p.combined ? ' preset-is-combined' : ''}" data-action="runPreset" data-preset-idx="${i}"><span>${p.label}</span></button>`;
        }).join('');

        updatePresetBtns();
    }

    function updatePresetBtns() {
        syncPresetUsageState();
        PRESETS.forEach((p, i) => {
            const btn = document.querySelector(`[data-action="runPreset"][data-preset-idx="${i}"]`), used = _presetUsed.get(i);
            if (btn) { btn.disabled = !!used; btn.classList.toggle('gohaeng-used', !!used); btn.removeAttribute('title'); }
        });
    }

    /* ==========================================================================
       05. 조합·필요 재료 계산 엔진
       ========================================================================== */

    /* 조합 사유·등급 공통 표시 정보 */
    const TOOL_REASON_LABEL_HTML = '<span class="tool-badge">[도구]</span>';
    const REASON_GRADE_ORDER = ["슈퍼히든", "고유히든", "히든", "레전드", "헬", "유니크", "에픽", "레어", "매직", "기초"];
    const REASON_GRADE_RANK = new Map(REASON_GRADE_ORDER.map((grade, index) => [grade, index]));
    const DEFAULT_REASON_TAG_CLASS = 'tag-reason-default';
    const getReasonGradeRank = (grade) => REASON_GRADE_RANK.get(grade) ?? REASON_GRADE_ORDER.length;
    const getReasonTagClassByGrade = (grade) => SYSTEM_CONFIG.grades.order.includes(grade) ? `tag-grade-${grade}` : DEFAULT_REASON_TAG_CLASS;
    const getHiddenboardReasonMeta = (parentUid) => {
        const parentUnit = unitMap.get(parentUid);
        const grade = parentUnit?.grade || '';
        const name = parentUnit?.name || parentUid || '';
        return { name, grade, gradeRank: getReasonGradeRank(grade), tagClass: getReasonTagClassByGrade(grade) };
    };
    const createHiddenboardReasonInfo = (parentUid, centerHtml, { cond = '', depth = 1, reqQty = 1 } = {}) => {
        const reasonMeta = getHiddenboardReasonMeta(parentUid);
        const center = centerHtml(reasonMeta.name);
        return {
            text: center,
            cond,
            depth,
            parentUid,
            reqQty,
            tagClass: reasonMeta.tagClass,
            reasonGrade: reasonMeta.grade,
            reasonGradeRank: reasonMeta.gradeRank,
            reasonCenterHtml: center
        };
    };
    const createMaterialReasonInfo = (parentUid, options = {}) => createHiddenboardReasonInfo(parentUid, name => escapeHtml(name), options);
    const createToolReasonInfo = (parentUid, options = {}) => createHiddenboardReasonInfo(parentUid, name => `${escapeHtml(name)} ${TOOL_REASON_LABEL_HTML}`, options);


    function splitRecipe(recipeStr) {
        let parts = [], current = '', depth = 0;
        for (let char of recipeStr) {
            if (char === '(' || char === '[') depth++;
            else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
            if (char === '+' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
            else current += char;
        }
        if (current.trim()) parts.push(current.trim());
        if (depth > 0 && parts.length === 1 && recipeStr.includes('+')) return recipeStr.split('+').map(s => s.trim()).filter(Boolean);
        return parts;
    }

    const parseRecipePart = (part) => part.match(/^([^\(\[]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?$/);

    /* 조합식 표시 생성 */
    const formatConditionText = (raw) => String(raw || '').split(',').map(part => part.trim()).filter(Boolean).join(' · ');
    function renderStackedRecipeRow(name, conditions, qty = null, color = '', grade = '') {
        const style = color ? ` style="color:${color};"` : '';
        const quantity = qty === null ? '' : `<span class="badge-qty">· ${qty}개</span>`;
        const lines = conditions.map(text => text.trim()).filter(Boolean).map(text => `<span class="badge-cond">${escapeHtml(text)}</span>`).join('');
        const gradeBadge = grade ? `<span class="d-reason-grade">${escapeHtml(grade)}</span>` : '';
        return `<div class="recipe-badge recipe-badge-stacked ${getReasonTagClassByGrade(grade)}"${style}><span class="recipe-badge-identity">${gradeBadge}<span class="recipe-badge-name">${escapeHtml(name)}</span></span><div class="recipe-badge-main"><div class="recipe-badge-conditions">${lines}</div>${quantity}</div></div>`;
    }
    function formatRecipe(item, multi = 1, useHiddenboardRows = false) {
        if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div class="recipe-empty-msg">정보 없음</div>`;
        let foundSpecialIds = [];
        let partsHtml = splitRecipe(item.recipe).map(p => {
            const m = parseRecipePart(p);
            if (m) {
                const unitId = clean(m[1].trim()), u = unitMap.get(unitId);
                let condHtml = '';
                if (CLEAN_SPECIAL_CONDITIONS[unitId]) {
                    condHtml = `<span class="badge-special-cond">특수조건</span>`;
                    if (!foundSpecialIds.includes(unitId)) foundSpecialIds.push(unitId);
                } else if (m[2]) condHtml = `<span class="badge-cond">${escapeHtml(formatConditionText(m[2]))}</span>`;
                const isTool = isToolRequirement(item.id, unitId);
                const qtyNum = isTool ? 1 : (m[3] ? parseInt(m[3], 10) : 1) * multi;
                const color = u ? SYSTEM_CONFIG.grades.colors[u.grade] : 'var(--text)';
                const toolHtml = isTool ? `<span class="tool-badge">[도구]</span>` : '';
                const grade = u?.grade || '';
                const gradeClass = getReasonTagClassByGrade(grade);
                const gradeBadge = `<span class="d-reason-grade">${escapeHtml(grade || '재료')}</span>`;
                if ((item.id === '데하카고치' || isConditionOnlyRecipe(item)) && m[2] && !CLEAN_SPECIAL_CONDITIONS[unitId]) {
                    const conditions = m[2].split(',').map(text => text.trim().replace(/^100R↓저그업20$/, '100R 이하 저그업 20').replace(/↓(?=\S)/g, '↓ ').replace(/([가-힣])(?=\d)/g, '$1 '));
                    return renderStackedRecipeRow(m[1].trim(), conditions, qtyNum, color, grade);
                }
                if (useHiddenboardRows) {
                    return `<div class="d-recipe-row ${gradeClass}">${gradeBadge}<span class="d-reason-main">${escapeHtml(m[1].trim())}${toolHtml}${condHtml}</span><span class="d-reason-qty">· ${qtyNum}개</span></div>`;
                }
                return `<div class="recipe-badge ${gradeClass}" style="color:${color};">${grade ? gradeBadge : ''}<span class="recipe-badge-name">${escapeHtml(m[1].trim())}</span>${toolHtml}<span class="badge-qty-wrap">${condHtml}<span class="badge-qty">· ${qtyNum}개</span></span></div>`;
            }
            return `<div class="recipe-token-muted">${p}</div>`;
        }).join('');
        const specialCondInlineHtml = foundSpecialIds.length > 0 ? `<div class="tsc-wrap">${foundSpecialIds.map(uid => `<div class="tsc-item">${CLEAN_SPECIAL_CONDITIONS[uid]}</div>`).join('')}</div>` : '';
        return `<div class="recipe-vertical">${partsHtml}</div>${specialCondInlineHtml}`;
    }


    /* 계산 엔진 및 패널 갱신 */
    function calcEssenceRecursiveFast(uid, counts, visited) {
        if (visited.has(uid)) return;
        visited.add(uid);
        const u = unitMap.get(uid); if (!u) return;
        const hiddenGradeIdx = getGradeIndex(SYSTEM_CONFIG.policy.hiddenGroupMinGrade || "히든");
        if (!CLEAN_EXCLUDE_ESSENCE_UNITS.has(uid) && getGradeIndex(u.grade) >= hiddenGradeIdx) {
            const tEssence = SYSTEM_CONFIG.essence.mapping[u.category];
            if (tEssence && counts[tEssence] !== undefined) counts[tEssence]++;
        }
        u.parsedRecipe?.forEach(pr => pr.id && calcEssenceRecursiveFast(pr.id, counts, visited));
    }

    function getEssenceCount(sourceMap) {
        let counts = {};
        Object.values(SYSTEM_CONFIG.essence.mapping).forEach(v => counts[v] = 0);
        let visited = new Set();
        try { sourceMap.forEach((qty, uid) => uid && qty > 0 && calcEssenceRecursiveFast(uid, counts, visited)); }
        catch {}
        Object.keys(counts).forEach(k => { if (isNaN(counts[k]) || counts[k] < 0) counts[k] = 0; });
        return counts;
    }

    function calculateBoardRequirements() {
        const cacheKey = `${makeMapSignature(activeUnits)}::${makeMapSignature(completedUnits)}`;
        if (_boardRequirementsCache.has(cacheKey)) return _boardRequirementsCache.get(cacheKey);
        let reqMap = new Map(), baseMap = new Map(), reasonMap = new Map();
        let autoCostReq = {}, baseAutoCostReq = {}, autoCostReason = {};
        AUTO_COST_SLOT_RAWS.forEach(k => { autoCostReq[clean(k)] = 0; baseAutoCostReq[clean(k)] = 0; autoCostReason[clean(k)] = new Map(); });

        let mergedActive = new Set();
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedActive.add(pr.id)));

        const baseDeficits = new Map(), deficits = new Map(), processedBase = new Map(), processedDeficit = new Map(), queue = [], inQueue = new Set();
        const enqueue = (uid) => { if (uid && !inQueue.has(uid)) { queue.push(uid); inQueue.add(uid); } };
        const addNeed = (map, uid, qty) => {
            if (!uid || qty <= 0) return;
            const prev = map.get(uid) || 0;
            let next = prev + qty;
            if (isOneTime(unitMap.get(uid))) next = Math.min(next, 1);
            if (next > prev) { map.set(uid, next); enqueue(uid); }
        };
        activeUnits.forEach((qty, uid) => {
            const amount = isOneTime(unitMap.get(uid)) ? 1 : qty;
            if (amount > 0) { baseDeficits.set(uid, amount); deficits.set(uid, amount); enqueue(uid); }
        });

        for (let head = 0, loopCount = 0; head < queue.length && ++loopCount <= APP_INTERNAL.maxLoopQueue; head++) {
            const uid = queue[head]; inQueue.delete(uid);
            if (!unitMap.has(uid) && !virtualUnitIds.has(uid)) continue;
            const unit = unitMap.get(uid), tools = getToolNeed(uid);
            const baseNeed = baseDeficits.get(uid) || 0, prevBase = processedBase.get(uid) || 0, baseDelta = baseNeed - prevBase;
            if (baseDelta > 0) {
                processedBase.set(uid, baseNeed);
                if (prevBase <= 0) tools.forEach(tid => addNeed(baseDeficits, tid, 1));
                unit?.parsedRecipe?.forEach(c => c.id && !isToolRequirement(uid, c.id) && (unitMap.has(c.id) || virtualUnitIds.has(c.id)) && addNeed(baseDeficits, c.id, baseDelta * c.qty));
            }
            const rawDeficit = deficits.get(uid) || 0;
            const effectiveDeficit = rawDeficit - Math.min(mergedActive.has(uid) ? 0 : (completedUnits.get(uid) || 0), rawDeficit);
            const prevDeficit = processedDeficit.get(uid) || 0, deficitDelta = effectiveDeficit - prevDeficit;
            if (deficitDelta > 0) {
                processedDeficit.set(uid, effectiveDeficit);
                if (prevDeficit <= 0) tools.forEach(tid => addNeed(deficits, tid, 1));
                unit?.parsedRecipe?.forEach(c => c.id && !isToolRequirement(uid, c.id) && (unitMap.has(c.id) || virtualUnitIds.has(c.id)) && addNeed(deficits, c.id, deficitDelta * c.qty));
            }
        }

        baseDeficits.forEach((val, k) => val > 0 && baseMap.set(k, val));
        deficits.forEach((val, k) => val > 0 && reqMap.set(k, Math.max(0, val - (completedUnits.get(k) || 0))));

        const updateAutoCosts = (map, reqObj) => map.forEach((needed, uid) => unitMap.get(uid)?.parsedCost?.forEach(pc => {
            if (AUTO_COST_SLOT_SET.has(pc.key)) reqObj[pc.key] += pc.qty * needed;
        }));
        updateAutoCosts(baseDeficits, baseAutoCostReq);
        updateAutoCosts(deficits, autoCostReq);
        AUTO_COST_SLOT_RAWS.forEach(k => { const id = clean(k); autoCostReq[id] = Math.max(0, autoCostReq[id] - (completedUnits.get(id) || 0)); });

        let rootTracking = new Map();
        baseDeficits.forEach((_, uid) => rootTracking.set(uid, new Map()));
        baseDeficits.forEach((needed, uid) => {
            if (needed <= 0) return;
            const uData = unitMap.get(uid); if (!uData) return;
            getToolNeed(uid).forEach(toolId => {
                let cRoots = rootTracking.get(toolId) || new Map(), isDirTarget = activeUnits.has(uid);
                cRoots.set(`TOOL_${uid}`, createToolReasonInfo(uid, { depth: isDirTarget ? 1 : 2, reqQty: 1 }));
                rootTracking.set(toolId, cRoots);
            });
            uData.parsedRecipe?.forEach(child => {
                if (!child.id || isToolRequirement(uid, child.id) || (!unitMap.has(child.id) && !virtualUnitIds.has(child.id))) return;
                let cRoots = rootTracking.get(child.id) || new Map(), isDirTarget = activeUnits.has(uid);
                cRoots.set(`MAT_${uid}`, createMaterialReasonInfo(uid, { cond: child.cond, depth: isDirTarget ? 1 : 2, reqQty: child.qty }));
                rootTracking.set(child.id, cRoots);
            });
            uData.parsedCost?.forEach(pc => {
                if (AUTO_COST_SLOT_SET.has(pc.key) && (deficits.get(uid) || 0) > 0) {
                    let isDirTarget = activeUnits.has(uid);
                    autoCostReason[pc.key].set(`AUTO_${uid}`, createMaterialReasonInfo(uid, { depth: isDirTarget ? 1 : 2, reqQty: pc.qty }));
                }
            });
        });

        rootTracking.forEach((rMap, cId) => {
            const finalMap = new Map(rMap);
            if (activeUnits.has(cId)) finalMap.set('TARGET_' + cId, { text: GROUP_DEFS.find(g => g.pid === 'grid-target')?.title || '', cond: '', depth: 0 });
            reasonMap.set(cId, finalMap);
        });

        const result = { reqMap, baseMap, reasonMap, autoCostReq, baseAutoCostReq, autoCostReason };
        _boardRequirementsCache.set(cacheKey, result); limitCacheSize(_boardRequirementsCache, 8);
        return result;
    }

    function getDependencies(uid) {
        if (depCache.has(uid)) return depCache.get(uid);
        if (_depVisiting.has(uid)) return new Set([uid]);
        _depVisiting.add(uid);
        let deps = new Set([uid]);
        try {
            const u = unitMap.get(uid);
            if (u) {
                u.parsedRecipe?.forEach(child => child.id && getDependencies(child.id).forEach(d => deps.add(d)));
                u.parsedCost?.forEach(pc => AUTO_COST_SLOT_SET.has(pc.key) && deps.add(pc.key));
            }
            depCache.set(uid, deps);
        } finally {
            _depVisiting.delete(uid);
        }
        return deps;
    }

    /* ==========================================================================
       06. 완료·복구·초기화
       ========================================================================== */

    // 선택 초기화로 보존한 진행도는 필요량 재계산이나 새로고침으로 지우지 않는다.
    function pruneSelectionResetRetainedCompleted() {
        for (const [uid, qty] of _selectionResetRetainedCompleted) {
            const remaining = Math.min(Math.max(0, parseInt(qty, 10) || 0), Math.max(0, completedUnits.get(uid) || 0));
            if (remaining > 0) _selectionResetRetainedCompleted.set(uid, remaining);
            else _selectionResetRetainedCompleted.delete(uid);
        }
    }

    function clampCompletedUnits(calcResult, costboardTotals = null) {
        pruneSelectionResetRetainedCompleted();
        const { baseMap, baseAutoCostReq } = calcResult || calculateBoardRequirements();
        const resolvedCostboardTotals = costboardTotals || (_currentViewMode === 'invenboard' ? calculateInvenboardCostboardTotals() : calculateCostboardAtomTotals());
        let changed = false;
        for (let [uid, rawQty] of [...completedUnits.entries()]) {
            const compQty = parseInt(rawQty, 10);
            const isCostboardAtom = COSTBOARD_COMPLETION_ID_SET.has(uid);
            const isUnitSlot = unitMap.has(uid);
            if (!Number.isFinite(compQty) || compQty <= 0 || (!isUnitSlot && !isCostboardAtom)) {
                completedUnits.delete(uid);
                changed = true;
                continue;
            }
            if (activeUnits.has(uid)) {
                let maxAllow = Math.max(baseMap.get(uid) || activeUnits.get(uid) || 1, _selectionResetRetainedCompleted.get(uid) || 0);
                if (compQty > maxAllow) { completedUnits.set(uid, maxAllow); changed = true; }
                continue;
            }
            let maxAllow = isUnitSlot ? (baseMap.get(uid) || 0) : (resolvedCostboardTotals.targetMap[getCostboardAtomRawName(uid)] || baseAutoCostReq[uid] || 0);
            maxAllow = Math.max(maxAllow, _selectionResetRetainedCompleted.get(uid) || 0);
            if (compQty > maxAllow) {
                if (maxAllow <= 0) completedUnits.delete(uid);
                else completedUnits.set(uid, maxAllow);
                changed = true;
            }
        }
        return changed;
    }

    /* 완료·복구·초기화 */
    function showActionFeedback(message) {
        const status = getEl('boardActionStatus');
        if (!status) return;
        clearTimeout(_actionFeedbackTimer);
        status.textContent = message;
        status.classList.add('is-visible');
        _actionFeedbackTimer = setTimeout(() => {
            status.classList.remove('is-visible');
            status.textContent = '';
        }, 2400);
    }

    function getGroupRestoreIds(level) {
        const ids = new Set();
        if (level >= 5) {
            [completedTargets, completedUnits].forEach(map => {
                map.forEach((qty, uid) => { if (qty > 0) ids.add(uid); });
            });
        } else {
            completedUnits.forEach((qty, uid) => {
                const restoreLevel = _unitRestoreLevels.get(uid) || 0;
                if (qty > 0 && !activeUnits.has(uid) && restoreLevel > 0 && restoreLevel <= level) ids.add(uid);
            });
        }
        return ids;
    }

    function getGroupRestoreDescription(level) {
        if (level >= 5) return '완료된 목표를 선택 목록으로 돌리고, 모든 재료의 완료·보유량을 초기화합니다. 보류 목록은 유지합니다.';
        if (level >= 4) return '직속·히든·기본 재료의 완료 상태를 함께 복구합니다. 목표와 보류 목록은 유지합니다.';
        if (level >= 3) return '히든·기본 재료의 완료 상태를 함께 복구합니다. 목표와 보류 목록은 유지합니다.';
        return '기본 재료의 완료 상태만 복구합니다. 목표와 보류 목록은 유지합니다.';
    }

    function updateGroupRestoreButtons() {
        document.querySelectorAll('.grp-title-actions [data-action="resetGroup"]').forEach(btn => {
            const level = parseInt(btn.dataset.level, 10), count = getGroupRestoreIds(level).size;
            const description = getGroupRestoreDescription(level);
            btn.disabled = count === 0;
            btn.title = `${description} · ${count > 0 ? `복구 대상 ${count}종` : '복구할 항목 없음'}`;
        });
    }

    function subtractCompletedUnitQty(uid, qty) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0) return;
        const current = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
        const next = Math.max(0, current - amount);
        if (next > 0) completedUnits.set(uid, next);
        else completedUnits.delete(uid);
    }

    function deleteCompletedRecipe(uid, multiplier) {
        const u = unitMap.get(uid); if (!u) return;
        const amount = Math.max(0, parseInt(multiplier, 10) || 0);
        if (amount <= 0) return;
        u.parsedRecipe?.forEach(child => {
            if (!child.id || ((_currentViewMode === 'hiddenboard' || _currentViewMode === 'invenboard') && child.id === HELPER_ID)) return;
            const perUnitNeed = isToolRequirement(uid, child.id) ? 1 : child.qty;
            subtractCompletedUnitQty(child.id, perUnitNeed * amount);
        });
    }

    function removeActiveUnitState(uid, qty = activeUnits.get(uid) || 1) {
        activeUnits.delete(uid);
        deleteCompletedRecipe(uid, qty || 1);
        completedUnits.delete(uid);
        _invenboardAutoCompletedUnits.delete(uid);
    }

    function resetInvenboardOwnedForUnit(uid, qty) {
        const source = new Map([[uid, normalizeUnitQty(uid, qty) || 1]]);
        const { targetMap } = calculateInvenboardCostboardTotals(new Map(), { activeSource: source, rawCompleted: true });
        getInvenboardAtoms().forEach(atom => {
            const amount = Math.max(0, parseInt(targetMap[atom], 10) || 0);
            if (amount > 0) subtractCompletedUnitQty(clean(atom), amount);
        });
    }

    function releaseCompletedTarget(uid, { restoreToActive = false } = {}) {
        if (!completedTargets.has(uid) || !unitMap.has(uid)) return false;
        const qty = completedTargets.get(uid) || 1;
        completedTargets.delete(uid);
        if (_currentViewMode === 'invenboard') resetInvenboardOwnedForUnit(uid, qty);
        else deleteCompletedRecipe(uid, qty);
        completedUnits.delete(uid);
        _invenboardAutoCompletedUnits.delete(uid);
        if (restoreToActive) setActiveUnitQty(uid, qty);
        return true;
    }

    function restoreCompletedTarget(uid) {
        return releaseCompletedTarget(uid, { restoreToActive: true });
    }

    function removeCompletedTarget(uid) {
        return releaseCompletedTarget(uid);
    }

    function completeUnit(uid, amount) {
        if (_completeLock.has(uid)) return;
        _completeLock.add(uid);
        const cWrapEl = document.getElementById(`craft-wrap-${uid}`);
        const lockBtns = cWrapEl ? Array.from(cWrapEl.querySelectorAll('button')) : [];
        lockBtns.forEach(b => b.disabled = true);
        try {
            const { reqMap, baseMap, autoCostReq } = calculateBoardRequirements();
            const isTarget = activeUnits.has(uid);
            const isAutoCost = AUTO_COST_SLOT_SET.has(uid);
            let isMergedSlot = false;
            if (isTarget && !isAutoCost) {
                activeUnits.forEach((_, activeId) => {
                    if (activeId !== uid && unitMap.get(activeId)?.parsedRecipe?.some(pr => pr.id === uid)) isMergedSlot = true;
                });
            }
            const isPureTarget = isTarget && !isMergedSlot && !isAutoCost;
            let reqVal = 0;
            if (isPureTarget) reqVal = Math.max(0, (activeUnits.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else if (isAutoCost) reqVal = autoCostReq[uid] || 0;
            else if (isTarget && isMergedSlot) reqVal = Math.max(0, (baseMap.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else reqVal = reqMap.get(uid) || 0;

            const requestedQty = amount !== undefined ? parseInt(amount, 10) : reqVal;
            const processQty = requestedQty === 10 && reqVal < 10 ? 0 : Math.min(requestedQty, reqVal);
            if (processQty > 0) {
                const prevCompleted = completedUnits.get(uid) || 0;
                deleteCompletedRecipe(uid, processQty);
                const newComp = Math.max(prevCompleted, completedUnits.get(uid) || 0) + processQty;
                completedUnits.set(uid, newComp);

                if (isPureTarget) {
                    if (newComp >= (activeUnits.get(uid) || 1)) {
                        completedTargets.set(uid, activeUnits.get(uid) || 1);
                        activeUnits.delete(uid);
                        completedUnits.delete(uid);
                    }
                } else if (isTarget && isMergedSlot) {
                    const totalQty = baseMap.get(uid) || 1;
                    if (newComp >= totalQty) {
                        const activeQty = activeUnits.get(uid) || 1;
                        const matQty = totalQty - activeQty;
                        completedTargets.set(uid, activeQty);
                        activeUnits.delete(uid);
                        if (matQty > 0) completedUnits.set(uid, matQty);
                        else completedUnits.delete(uid);
                    }
                }
                completeHiddenboardRecipeUnitsIfReady();
                commitNexusStateChange({ clearHighlight: true });
            } else {
                lockBtns.forEach(b => b.disabled = false);
            }
        } catch {
            lockBtns.forEach(b => b.disabled = false);
        } finally {
            setTimeout(() => { _completeLock.delete(uid); }, APP_INTERNAL.completeLockDelay);
        }
    }

    function restoreUnit(uid) {
        if (!restoreCompletedTarget(uid)) return;
        commitNexusStateChange();
    }

    function restoreAllCompleted() {
        if (_restoreAllCooldown) return;
        const cfg = SYSTEM_CONFIG.policy.restoreAllBtn;
        const btn = getEl(cfg.idBtn), label = getEl(cfg.idLabel);

        if (_restoreAllPendingTimer) {
            clearTimeout(_restoreAllPendingTimer);
            _restoreAllPendingTimer = null;
            if (label) label.textContent = cfg.labelDefault;
            if (btn) { btn.classList.remove('reset-btn-pending'); btn.disabled = false; btn.title = '전체 선택·보류·완료 내역 초기화 · 2초 내 다시 누르면 취소'; }
            const state = getEl('btnRestoreAllState');
            if (state) state.textContent = '↺';
            return;
        }

        if (label) label.textContent = '초기화 대기';
        const state = getEl('btnRestoreAllState');
        if (state) state.textContent = '취소';
        if (btn) { btn.classList.add('reset-btn-pending'); btn.title = '2초 후 전체 초기화 · 지금 다시 누르면 취소'; }

        _restoreAllPendingTimer = setTimeout(() => {
            _restoreAllPendingTimer = null;
            activeUnits.clear(); pausedUnits.clear(); completedUnits.clear(); _selectionResetRetainedCompleted.clear(); completedTargets.clear(); _invenboardAutoCompletedUnits.clear(); _invenboardManualInputs.clear();
            _presetUsed.clear(); updatePresetBtns(); commitNexusStateChange();
            if (!btn || !label) return;
            _restoreAllCooldown = true;
            btn.classList.remove('reset-btn-pending');
            label.textContent = cfg.labelDone; btn.classList.add(cfg.classDone); btn.disabled = true;
            if (state) state.textContent = '완료';
            btn.title = '전체 내역이 초기화되었습니다';
            setTimeout(() => {
                label.textContent = cfg.labelDefault; btn.classList.remove(cfg.classDone); btn.disabled = false; _restoreAllCooldown = false;
                if (state) state.textContent = '↺';
                btn.title = '전체 선택·보류·완료 내역 초기화 · 2초 내 다시 누르면 취소';
            }, APP_INTERNAL.restoreAllResetDelay);
        }, APP_INTERNAL.restoreAllPendingDelay);
    }

    function resetCompletedMaterialsByLevel(level) {
        getGroupRestoreIds(level).forEach(uid => {
            completedUnits.delete(uid);
            _invenboardAutoCompletedUnits.delete(uid);
            _invenboardManualInputs.delete(uid);
            _selectionResetRetainedCompleted.delete(uid);
        });
    }

    function resetGroupCompleted(level) {
        const ids = getGroupRestoreIds(level);
        if (ids.size === 0) return;
        if (level >= 5) {
            const targetEntries = Array.from(completedTargets.entries());
            completedTargets.clear();
            targetEntries.forEach(([uid, qty]) => {
                setActiveUnitQty(uid, (activeUnits.get(uid) || 0) + qty);
            });
            completedUnits.clear();
            _selectionResetRetainedCompleted.clear();
            _invenboardAutoCompletedUnits.clear();
            _invenboardManualInputs.clear();
            _presetUsed.clear(); updatePresetBtns();
        } else {
            resetCompletedMaterialsByLevel(level);
        }
        const label = GROUP_DEFS.find(group => group.resetLevel === level)?.resetLabel || '완료 복구';
        showActionFeedback(`${label} · ${ids.size}종 복구됨 ✓`);
        commitNexusStateChange({ clearHighlight: true });
    }

    function resetUnitboard() {
        if (activeUnits.size === 0) return;
        const count = activeUnits.size;
        completedUnits.forEach((qty, uid) => {
            if (qty > 0) _selectionResetRetainedCompleted.set(uid, qty);
        });
        activeUnits.clear();
        showActionFeedback(`${count}종 선택 해제됨 · 보류·완료·재료 유지 ✓`);
        commitNexusStateChange({ clearHighlight: true });
    }

    /* ==========================================================================
       07. 필요 재료·원가 계산
       ========================================================================== */


    const getCostboardAtomRawName = (uid) => ATOM_HASH[uid] || LEGACY_COMPLETION_RAW_MAP[uid] || AUTO_COST_RAW_MAP[uid] || uid;
    const getCostboardDisplayName = (atom) => clean(atom) === VOID_RAY_ID ? '공허포격기' : atom;
    const getCostboardSlotToneClass = (atoms) => atoms.some(atom => AUTO_COST_SLOT_SET.has(clean(atom))) ? 'is-skill-slot' : 'is-magic-slot';
    /* 코스트보드 */
    function renderBoardSlots(boardId, atoms, slotTemplate) {
        const board = getEl(boardId);
        if (!board) return;
        board.innerHTML = atoms.map(slotTemplate).join('');
    }

    function renderCostboardAtoms() {
        const buildSlotClassName = (atoms) => `costboard-slot ${getCostboardSlotToneClass(atoms)}`;
        const renderCostboardSlot = (slot) => {
            const atoms = slot.atoms || [];
            if (atoms.length === 1) {
                const atom = atoms[0];
                return `<div class="${buildSlotClassName(atoms)}" id="vslot-${clean(atom)}"><div class="costboard-val"></div><div class="costboard-name" id="name-${clean(atom)}">${escapeHtml(getCostboardDisplayName(atom))}</div></div>`;
            }
            const splitItems = atoms.map(atom => `
                <div class="costboard-split-item" id="vslot-${clean(atom)}">
                    <div class="costboard-val"></div>
                    <div class="costboard-name" id="name-${clean(atom)}">${escapeHtml(getCostboardDisplayName(atom))}</div>
                </div>
            `).join('<div class="costboard-split-divider" aria-hidden="true"></div>');
            return `<div class="${buildSlotClassName(atoms)} is-split-slot" data-slot-atoms="${atoms.map(clean).join(',')}">${splitItems}</div>`;
        };
        renderBoardSlots('costboardGrid', COSTBOARD_DISPLAY_SLOT_DEFS, renderCostboardSlot);
    }

    function calculateCostboardAtomTotals(completedSource = completedUnits, atomList = SYSTEM_CONFIG.costboardAtoms, options = {}) {
        const costboardAtoms = (Array.isArray(atomList) && atomList.length ? atomList : SYSTEM_CONFIG.costboardAtoms).filter(Boolean);
        const activeSource = options.activeSource instanceof Map ? options.activeSource : activeUnits;
        const cacheKey = [costboardAtoms.join(''), options.preferRecipeAtoms ? 1 : 0, options.targetMap ? makeObjectSignature(options.targetMap, costboardAtoms) : makeMapSignature(activeSource), makeMapSignature(completedSource)].join('::');
        if (_costboardTotalsCache.has(cacheKey)) return cloneTotals(_costboardTotalsCache.get(cacheKey));

        const costboardAtomSet = new Set(costboardAtoms), targetMap = {}, completedMap = {}, remainingMap = {};
        costboardAtoms.forEach(atom => { targetMap[atom] = completedMap[atom] = remainingMap[atom] = 0; });
        const addCostboardAtom = (rawName, qty, map) => {
            const normalizedRawName = getCostboardAtomRawName(clean(rawName));
            if (!costboardAtomSet.has(normalizedRawName)) return false;
            map[normalizedRawName] = (map[normalizedRawName] || 0) + qty;
            return true;
        };
        const flattenUnitToAtoms = (uid, qty, map, path) => {
            if (qty <= 0 || path.has(uid)) return;
            path.add(uid);
            try {
                if (addCostboardAtom(getCostboardAtomRawName(uid), qty, map)) return;
                const u = unitMap.get(uid); if (!u) return;
                const flattenRecipe = () => u.parsedRecipe?.forEach(child => child.id && (isToolRequirement(uid, child.id) ? flattenUnitToAtoms(child.id, 1, map, path) : flattenUnitToAtoms(child.id, child.qty * qty, map, path)));
                const flattenCost = () => { u.parsedCost?.forEach(pc => !addCostboardAtom(getCostboardAtomRawName(pc.key), pc.qty * qty, map) && flattenUnitToAtoms(pc.key, pc.qty * qty, map, path)); getToolNeed(uid).forEach(toolId => flattenUnitToAtoms(toolId, 1, map, path)); };
                if (options.preferRecipeAtoms) { if (u.parsedRecipe?.length) return flattenRecipe(); flattenCost(); }
                else { if (u.parsedCost?.length) return flattenCost(); flattenRecipe(); }
            } finally { path.delete(uid); }
        };

        if (options.targetMap) costboardAtoms.forEach(atom => targetMap[atom] = Math.max(0, parseInt(options.targetMap[atom], 10) || 0));
        else activeSource.forEach((count, uid) => count > 0 && flattenUnitToAtoms(uid, count, targetMap, new Set()));
        (completedSource instanceof Map ? completedSource : new Map(completedSource || [])).forEach((count, uid) => count > 0 && flattenUnitToAtoms(uid, count, completedMap, new Set()));
        costboardAtoms.forEach(atom => remainingMap[atom] = Math.max(0, (targetMap[atom] || 0) - (completedMap[atom] || 0)));
        const result = { targetMap, completedMap, remainingMap };
        _costboardTotalsCache.set(cacheKey, cloneTotals(result)); limitCacheSize(_costboardTotalsCache, 24);
        return result;
    }

    function updateCostboard(costboardTotals = null, boardRequirements = null) {
        const { remainingMap } = costboardTotals || calculateCostboardAtomTotals();
        const voidRemaining = Math.max(0, (boardRequirements || calculateBoardRequirements()).reqMap.get(VOID_RAY_ID) || 0);

        COSTBOARD_DISPLAY_SLOT_DEFS.flatMap(slot => slot.atoms).forEach(atom => {
            const container = getEl(`vslot-${clean(atom)}`), valueEl = container?.querySelector('.costboard-val'), nameEl = container?.querySelector('.costboard-name');
            if (!container || !valueEl || !nameEl) return;

            const remainQty = clean(atom) === VOID_RAY_ID ? voidRemaining : (remainingMap[atom] || 0);
            const splitParent = container.closest('.costboard-slot.is-split-slot');
            const isSplitItem = !!splitParent;
            if (remainQty > 0) {
                if (valueEl.innerText !== String(remainQty)) valueEl.innerText = String(remainQty);
                nameEl.style.display = 'block';
                container.classList.add('active');
                if (isSplitItem) return;
            } else {
                const emptyValue = clean(atom) === VOID_RAY_ID ? '-' : '';
                if (valueEl.textContent !== emptyValue) valueEl.textContent = emptyValue;
                nameEl.style.display = 'block';
                container.classList.remove('active');
            }
        });

        document.querySelectorAll('.costboard-slot.is-split-slot').forEach(slot => {
            slot.classList.toggle('has-active', !!slot.querySelector('.costboard-split-item.active'));
        });
    }

    /* ==========================================================================
       08. 히든 보드
       ========================================================================== */


    /* 히든보드 */
    const BASIC_HIDDENBOARD_GRADES = new Set(["레어", "에픽", "유니크", "헬", "레전드"]);
    const isBasicHiddenboardGrade = (grade) => BASIC_HIDDENBOARD_GRADES.has(grade);

    function renderHiddenboard() {
        if (_isHiddenboardRendered) return;
        const boardEl = getEl('boardContent');
        if (!boardEl) return;
        boardEl.classList.remove('invenboard-mode');
        _isInvenboardRendered = false;

        const renderHiddenboardSlot = (id, n, g) => {
            const unit = unitMap.get(id);
            const essenceText = getUnitUnitboardEssenceText(unit);
            const noticeHtml = getUnitCardNotesHtml(unit);
            return `<div class="hiddenboard-slot" id="d-slot-wrap-${id}" data-uid="${id}" data-detail-view="usage"><div class="d-slot-main"><div class="d-name"><div class="d-grade-row"><div class="d-grade-left"><span class="gtag grade-${g}">${g}</span><span class="d-final-goal-tag" hidden>최종목표</span></div><button type="button" class="d-target-badge" data-action="toggleHighlight" data-uid="${id}" aria-label="${n} 목표추적" aria-pressed="false" title="직속부터 기초 재료까지 목표추적" hidden>목표추적</button></div><div class="d-name-line"><span class="d-name-inline">${n}${CLEAN_SPECIAL_CONDITIONS[id]?`<span class="badge-special-cond recipe-cond-offset">특수조건</span>`:''}</span></div>${noticeHtml}${essenceText}</div></div><div id="d-cond-${id}" class="d-cond-inline"></div><div class="d-detail-wrap"><div class="d-detail-tabs" role="group" aria-label="${n} 표시 정보"><button type="button" class="d-detail-tab is-active" data-action="switchHiddenboardDetail" data-uid="${id}" data-detail-view="usage" aria-pressed="true" aria-controls="d-reason-${id}">사용처</button><button type="button" class="d-detail-tab" data-action="switchHiddenboardDetail" data-uid="${id}" data-detail-view="recipe" aria-pressed="false" aria-controls="d-recipe-${id}">조합법</button></div><div class="d-detail-panels"><div class="d-reason-wrap" id="d-reason-${id}" aria-hidden="false"></div><div class="d-recipe-wrap" id="d-recipe-${id}" aria-hidden="true" inert></div></div></div><div class="d-goal-recipe-wrap" id="d-goal-recipe-${id}"></div><div id="craft-wrap-${id}" class="craft-wrap"></div></div>`;
        };
        const getGrp = (id, pid, title, resetLevel=0, isCol=false, alwaysShow=false, alwaysOpen=false, resetLabel='완료복구') => `
            <div class="hiddenboard-group" id="${id}" style="${alwaysShow ? '' : 'display:none;'}" ${alwaysShow ? 'data-always-show="true"' : ''} ${alwaysOpen ? 'data-always-open="true"' : ''}>
                <div class="hiddenboard-group-title" data-action="toggleGroup" data-grid-id="${pid}">
                    <div class="grp-title-main">
                        <span class="grp-toggle-icon" style="transform:${isCol?'rotate(-90deg)':'rotate(0deg)'};">▼</span>
                        <span>${title}</span>
                        ${resetLevel > 0 ? `<span class="grp-count-badge" id="grp-count-${pid}"></span>` : ''}
                    </div>
                    <div class="grp-title-actions" id="${id}-actions">
                        ${resetLevel > 0 ? `<button type="button" class="btn-text-link" data-action="resetGroup" data-level="${resetLevel}" title="${getGroupRestoreDescription(resetLevel)}" disabled><span>${resetLabel}</span><span class="action-icon" aria-hidden="true">↺</span></button>` : ''}
                    </div>
                </div>
                <div class="hiddenboard-grid" id="${pid}" ${isCol?'style="display:none;"':''}></div>
            </div>`;

        const allUnits = Array.from(unitMap.values());
        const unitSlots = allUnits.filter(u => getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.minGradeForHiddenboard) && !AUTO_COST_SLOT_SET.has(u.id)).map(u => renderHiddenboardSlot(u.id, u.name, u.grade)).join('');

        const _exIds = new Set((SYSTEM_CONFIG.policy.hideCompletedExcludeGroups || []).map(t => titleToGridId[t]).filter(Boolean));

        returnHiddenboardControlsToHeader();
        boardEl.innerHTML = `<div id="hiddenboard-empty-msg" class="empty-msg"></div><div id="hiddenboard-slot-pool" class="hiddenboard-slot-pool">${unitSlots}</div>` + GROUP_DEFS.map(g => getGrp(g.id, g.pid, g.title, g.resetLevel, g.isCol, g.alwaysShow, g.alwaysOpen, g.resetLabel)).join('');
        boardEl.dataset.excludeGridIds = JSON.stringify([..._exIds]);
        _hiddenboardSlotElsByUid.clear();
        boardEl.querySelectorAll('.hiddenboard-slot[data-uid]').forEach(el => _hiddenboardSlotElsByUid.set(el.dataset.uid, el));
        _isHiddenboardRendered = true;
        placeHiddenboardControls();
    }

    function getHiddenboardRecipeQuantity(id, calcResult) {
        const unit = unitMap.get(id);
        const { reqMap, baseMap } = calcResult || _lastCalcResult || calculateBoardRequirements();
        const requested = activeUnits.has(id)
            ? (baseMap.get(id) || activeUnits.get(id) || 0)
            : (reqMap.get(id) || 0);
        const multi = isOneTime(unit) ? 1 : Math.max(requested, 1);
        const qtyLimit = getUnitQtyLimit(id);
        const hasSpecialLimit = isOneTime(unit) || !!CLEAN_UNIT_QTY_CAPS[id];
        const countLabel = hasSpecialLimit
            ? (multi === qtyLimit ? `${qtyLimit}개 제한` : `${multi}개 기준 · 최대 ${qtyLimit}개 제한`)
            : `${multi}개 기준`;
        return { multi, countLabel };
    }

    function renderHiddenboardRecipe(slotEl, calcResult) {
        const id = slotEl.dataset.uid;
        const unit = unitMap.get(id);
        if (!unit) return;
        const isGoal = slotEl.classList.contains('is-final-goal');
        const recipeEl = slotEl.querySelector(isGoal ? '.d-goal-recipe-wrap' : '.d-recipe-wrap');
        if (!recipeEl) return;
        const { multi, countLabel } = getHiddenboardRecipeQuantity(id, calcResult);
        const renderKey = `${multi}:${countLabel}`;
        if (recipeEl._renderKey === renderKey) return;
        if (isGoal) {
            recipeEl.innerHTML = `<div class="uc-recipe-area"><span class="recipe-label">조합 조건<span class="d-recipe-count">${escapeHtml(countLabel)}</span></span>${formatRecipe(unit, multi)}</div>`;
        } else {
            recipeEl.innerHTML = `<div class="d-detail-title" style="color:${SYSTEM_CONFIG.grades.colors[unit.grade]}"><span>${escapeHtml(unit.name)} 조합법</span><span class="d-recipe-count">(${escapeHtml(countLabel)})</span></div><div class="d-recipe-content">${formatRecipe(unit, multi, true)}</div>`;
        }
        recipeEl._renderKey = renderKey;
    }

    function switchHiddenboardDetail(id, view, calcResult = null) {
        const slotEl = _hiddenboardSlotElsByUid.get(id);
        if (!slotEl || slotEl.classList.contains('is-final-goal')) return;
        const activeView = view === 'recipe' ? 'recipe' : 'usage';
        slotEl.dataset.detailView = activeView;
        slotEl.querySelectorAll('.d-detail-tab').forEach(tab => {
            const selected = tab.dataset.detailView === activeView;
            tab.classList.toggle('is-active', selected);
            tab.setAttribute('aria-pressed', String(selected));
        });
        // 두 영역 모두 레이아웃에 참여시키고 비활성 영역만 가려 카드 높이를 유지합니다.
        // 클릭할 수 있는 사용처 태그는 선택된 탭에서만 활성화합니다.
        for (const [panel, selected] of [
            [slotEl.querySelector('.d-reason-wrap'), activeView === 'usage'],
            [slotEl.querySelector('.d-recipe-wrap'), activeView === 'recipe']
        ]) {
            if (!panel) continue;
            panel.setAttribute('aria-hidden', String(!selected));
            panel.inert = !selected;
        }
        renderHiddenboardRecipe(slotEl, calcResult);
    }

    function returnHiddenboardControlsToHeader() {
        const actions = getEl('hiddenboardGlobalActions') || document.querySelector('.hiddenboard-ph-btns');
        const mobileHost = getEl('boardMobileHeader');
        if (!actions || !mobileHost) return;
        if (actions.parentElement !== mobileHost) mobileHost.appendChild(actions);
        actions.classList.remove('hiddenboard-actions-in-group');
        actions.classList.add('hiddenboard-actions-in-header');
    }

    function placeHiddenboardControls() {
        const actions = getEl('hiddenboardGlobalActions') || document.querySelector('.hiddenboard-ph-btns');
        const mobileHost = getEl('boardMobileHeader');
        const desktopHost = getEl('group-target-actions');
        if (!actions || !mobileHost) return;
        const useMobileHeader = window.matchMedia('(max-width: 767px)').matches || !desktopHost;
        if (useMobileHeader) {
            if (actions.parentElement !== mobileHost) mobileHost.appendChild(actions);
            actions.classList.remove('hiddenboard-actions-in-group');
            actions.classList.add('hiddenboard-actions-in-header');
        } else {
            if (actions.parentElement !== desktopHost) desktopHost.insertBefore(actions, desktopHost.firstChild);
            actions.classList.remove('hiddenboard-actions-in-header');
            actions.classList.add('hiddenboard-actions-in-group');
        }
    }

    function wrapHiddenboardGridPages(grid, pageSize, onlyVisible = false) {
        if (!grid) return;
        const items = Array.from(grid.children).filter(el =>
            el.classList.contains('hiddenboard-slot') && (!onlyVisible || el.style.display !== 'none')
        );
        if (items.length === 0) return;
        const size = Math.max(1, pageSize || items.length);
        const frag = document.createDocumentFragment();
        for (let i = 0; i < items.length; i += size) {
            const page = document.createElement('div');
            page.className = 'hiddenboard-page';
            items.slice(i, i + size).forEach(el => page.appendChild(el));
            frag.appendChild(page);
        }
        grid.appendChild(frag);
    }

    // 조합 진행도 차감을 적용한 사용처 수량: 화면 표시 전용 계산.
    function getHiddenboardReasonDisplayEntries(slotId, rMap, reqMap) {
        const getReasonParentNeed = (info) => {
            if (!info?.parentUid) return 0;
            return Math.max(0, reqMap.get(info.parentUid) || 0);
        };
        const getReasonBaseQty = (rId, info) => {
            if (!info || info.depth === 0 || !info.reqQty) return 0;
            const parentNeed = getReasonParentNeed(info);
            if (parentNeed <= 0) return 0;
            return rId.startsWith('TOOL_') ? 1 : (info.reqQty || 1) * parentNeed;
        };
        if (!rMap) return [];
        const entries = [...rMap.entries()].map(([rId, info], index) => ({
            rId,
            info,
            index,
            baseQty: getReasonBaseQty(rId, info),
            displayQty: info?.depth === 0 ? 0 : getReasonBaseQty(rId, info)
        }));
        let remainingCompleted = Math.max(0, completedUnits.get(slotId) || 0);
        entries
            .filter(entry => entry.baseQty > 0)
            .sort((a, b) => a.baseQty - b.baseQty || a.index - b.index)
            .forEach(entry => {
                if (remainingCompleted <= 0) return;
                const consumed = Math.min(entry.displayQty, remainingCompleted);
                entry.displayQty -= consumed;
                remainingCompleted -= consumed;
            });
        return entries
            .filter(entry => entry.info?.depth === 0 || entry.displayQty > 0)
            .map(entry => [entry.rId, { ...entry.info, displayQty: entry.displayQty, _reasonOrder: entry.index }]);
    }

    // 카드 사용처·조합 조건 표시는 재료 배치/완료 상태 변경과 분리한다.
    function renderHiddenboardSlotReasons({ id, slotEl, needed, isTarget, isMergedSlot, reasonMap, getCachedReasonEntries, targetHighlight, highlightDeps }) {
        const getReasonTagClass = (info) => info?.tagClass || DEFAULT_REASON_TAG_CLASS;
        const isSplitReason = (info) => info?.depth !== 0 && !!info?.reasonCenterHtml;
        const renderReasonTagContent = (info) => {
            if (!isSplitReason(info)) return info.text;
            return [
                `<span class="d-reason-grade">${escapeHtml(info.reasonGrade || '')}</span>`,
                `<span class="d-reason-main">${info.reasonCenterHtml}</span>`,
                `<span class="d-reason-qty">×${info.displayQty}</span>`
            ].join('');
        };
        
        const rCon = slotEl.querySelector(`#d-reason-${id}`);
        if (rCon) {
            const rMap = reasonMap.get(id);
            if (rMap && rMap.size > 0 && needed > 0) {
                let allEntries = getCachedReasonEntries(id, rMap).filter(([, info]) => info.depth !== 0);
                if (isTarget && !isMergedSlot) allEntries = [];
                if (_currentHighlight) {
                    const filtered = allEntries.filter(([, i]) =>
                        i.parentUid === targetHighlight ||
                        (highlightDeps && highlightDeps.has(i.parentUid))
                    );
                    if (filtered.length > 0) allEntries = filtered;
                }
                if (allEntries.length > 0) {
                    const sorted = allEntries.sort((a, b) =>
                        (a[1].depth || 0) - (b[1].depth || 0) ||
                        (a[1].reasonGradeRank ?? REASON_GRADE_ORDER.length) - (b[1].reasonGradeRank ?? REASON_GRADE_ORDER.length) ||
                        (a[1]._reasonOrder || 0) - (b[1]._reasonOrder || 0)
                    );
                    rCon.classList.toggle('is-target-only', sorted.every(([, info]) => info.depth === 0));
                    const unit = unitMap.get(id);
                    const titleColor = SYSTEM_CONFIG.grades.colors[unit?.grade] || 'var(--accent)';
                    const usageTitle = `<div class="d-detail-title" style="color:${titleColor}"><span>${escapeHtml(unit?.name || id)} 사용처</span><span class="d-recipe-count">(클릭 시 목표추적)</span></div>`;
                    rCon.innerHTML = usageTitle + sorted.map(([rId, info]) => {
                        const splitTagClass = isSplitReason(info) ? ' is-split-reason' : '';
                        return `<button type="button" class="d-reason-tag ${getReasonTagClass(info)}${splitTagClass}" data-action="toggleHighlight" data-uid="${rId.replace(/^(TARGET_|MAT_|TOOL_|AUTO_)/,'')}">${renderReasonTagContent(info)}</button>`;
                    }).join('');
                } else {
                    rCon.classList.remove('is-target-only');
                    rCon.innerHTML = '';
                }
            } else {
                rCon.classList.remove('is-target-only');
                rCon.innerHTML = '';
            }
        }

        const cEl = slotEl.querySelector(`#d-cond-${id}`);
        if (cEl) {
            let rMap = reasonMap.get(id);
            const condMap = new Map();

            if (rMap) {
                getCachedReasonEntries(id, rMap).forEach(([, info]) => {
                    if (!info.cond || info.displayQty <= 0) return;
                    if (_currentHighlight) {
                        const pUid = info.parentUid;
                        if (pUid !== targetHighlight && (!highlightDeps || !highlightDeps.has(pUid))) return;
                    }
                    const cleanCond = formatConditionText(info.cond);
                    if (!cleanCond) return;
                    condMap.set(cleanCond, (condMap.get(cleanCond) || 0) + info.displayQty);
                });
            }

            if (condMap.size > 0) {
                cEl.style.display = 'flex';
                cEl.innerHTML = '<span class="recipe-label">조합 조건</span>' +
                    Array.from(condMap, ([condStr, qty]) => `<div class="d-condition-row"><span class="d-cond-text">${escapeHtml(condStr)}</span><span class="d-cond-qty">${qty}개</span></div>`).join('');
            } else {
                cEl.style.display = 'none';
                cEl.innerHTML = '';
            }
        }
    }

    // 루트 목표로부터의 조합 깊이는 히든보드 배치에만 사용한다.
    function getHiddenboardDepths(mergedSlots) {
        const exactDepths = new Map();
        let queue = [];
        activeUnits.forEach((_, uid) => {
            if (!mergedSlots.has(uid)) {
                exactDepths.set(uid, 0);
                queue.push(uid);
            }
        });
        if (queue.length === 0) {
            activeUnits.forEach((_, uid) => {
                exactDepths.set(uid, 0);
                queue.push(uid);
            });
        }
        let curDepth = 0;
        while(queue.length > 0 && curDepth < 30) {
            let nextQueue = [];
            curDepth++;
            for (let uid of queue) {
                const u = unitMap.get(uid);
                if (!u) continue;
                u.parsedRecipe?.forEach(pr => {
                    if (pr.id && !exactDepths.has(pr.id)) {
                        exactDepths.set(pr.id, curDepth);
                        nextQueue.push(pr.id);
                    }
                });
                getToolNeed(uid).forEach(toolId => {
                    if (toolId && !exactDepths.has(toolId)) {
                        exactDepths.set(toolId, curDepth);
                        nextQueue.push(toolId);
                    }
                });
                u.parsedCost?.forEach(pc => {
                    if (AUTO_COST_SLOT_SET.has(pc.key) && !exactDepths.has(pc.key)) {
                        exactDepths.set(pc.key, curDepth);
                        nextQueue.push(pc.key);
                    }
                });
            }
            queue = nextQueue;
        }

        return exactDepths;
    }

    function sortHiddenboardGrids(grids) {
        [grids.target, grids.special, grids.upperHidden, grids.basicHidden].forEach(grid => {
            if (!grid) return;
            const children = Array.from(grid.children);
            children.sort((a, b) => {
                const uidA = a.dataset.uid || a.id.replace('d-slot-wrap-','');
                const uidB = b.dataset.uid || b.id.replace('d-slot-wrap-','');
                const uA = unitMap.get(uidA);
                const uB = unitMap.get(uidB);
                if (grid === grids.upperHidden) {
                    const levelDiff = (_unitNativeLevels.get(uidB) || 1) - (_unitNativeLevels.get(uidA) || 1);
                    if (levelDiff !== 0) return levelDiff;
                }
                return getGradeIndex(uB?.grade) - getGradeIndex(uA?.grade) ||
                       (SYSTEM_CONFIG.sorting.order[uB?.name]||0) - (SYSTEM_CONFIG.sorting.order[uA?.name]||0) ||
                       (uA?.name || uidA).localeCompare(uB?.name || uidB);
            });
            children.forEach(el => grid.appendChild(el));
        });
    }

    function updateHiddenboardGroupVisibility(grids, targetHighlight, excludeGridIds) {
        Object.values(grids).forEach(g => {
            if (!g) return;
            const grp = g.closest('.hiddenboard-group'), icon = grp?.querySelector('.grp-toggle-icon');
            if (!grp) return;
            
            const slots = Array.from(g.querySelectorAll('.hiddenboard-slot'));
            const visibleSlots = slots.filter(el => el.style.display !== 'none');

            if (targetHighlight) {
                grp.style.display = visibleSlots.length > 0 ? 'block' : 'none';
                if (visibleSlots.length > 0) {
                    grp.classList.remove('collapsed');
                    g.style.display = 'grid';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                }
            } else if (visibleSlots.length === 0 && grp.dataset.alwaysShow !== 'true') {
                grp.style.display = 'block';
                g.style.display = 'none'; grp.classList.add('collapsed'); if (icon) icon.style.transform = 'rotate(-90deg)';
            }
            else {
                grp.style.display = 'block';
                if (visibleSlots.length > 0 && grp.dataset.alwaysOpen === 'true') {
                    grp.classList.remove('collapsed'); g.style.display = 'grid'; if (icon) icon.style.transform = 'rotate(0deg)';
                }
            }

            const badge = getEl(`grp-count-${g.id}`);
            if (!badge) return;
            const countBase = excludeGridIds.includes(g.id) ? slots : visibleSlots;
            const total = countBase.length;
            const done = countBase.filter(el => el.classList.contains('is-completed')).length;
            badge.textContent = total > 0 ? `${done} / ${total}` : '';
        });
    }

    function restoreHiddenboardGroupState(targetHighlight) {
        if (!targetHighlight && _highlightGroupState) {
            _highlightGroupState.forEach((state, groupId) => {
                const grp = getEl(groupId), grid = grp?.querySelector('.hiddenboard-grid');
                if (!grp || !grid) return;
                grp.classList.toggle('collapsed', state.collapsed);
                grid.style.display = state.gridDisplay;
                const icon = grp.querySelector('.grp-toggle-icon');
                if (icon) icon.style.transform = state.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            });
            _highlightGroupState = null;
        }
    }

    function updateHiddenboard(calcResult) {
        if (!_isHiddenboardRendered) return;
        const { reqMap, baseMap, reasonMap } = calcResult || calculateBoardRequirements();
        const mergedSlots = new Set();

        const targetHighlight = _currentHighlight || null;
        const highlightDeps = targetHighlight ? getDependencies(targetHighlight) : null;
        getEl('boardContent')?.classList.toggle('highlight-mode', !!targetHighlight);
        
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedSlots.add(pr.id)));
        const directMaterials = new Set();
        activeUnits.forEach((_, uid) => { if (mergedSlots.has(uid)) return; unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && !activeUnits.has(pr.id) && directMaterials.add(pr.id)); });
        const excludeGridIds = (() => { try { return JSON.parse(getEl('boardContent')?.dataset.excludeGridIds || '[]'); } catch { return []; } })();
        const pool = getEl('hiddenboard-slot-pool');
        
        const grids = {
            target: getEl('grid-target'),
            special: getEl('grid-special'),
            upperHidden: getEl('grid-upper-hidden'),
            basicHidden: getEl('grid-basic-hidden')
        };
        const restoreLevelsByGridId = {
            'grid-basic-hidden': 2,
            'grid-upper-hidden': 3,
            'grid-special': 4,
            'grid-target': 5
        };
        _unitRestoreLevels.clear();

        const exactDepths = getHiddenboardDepths(mergedSlots);

        _hiddenboardSlotElsByUid.forEach(el => {
            el.style.display = 'none'; el.classList.remove('is-visible','has-target','is-completed','highlighted-tree');
            if (pool && el.parentElement !== pool) pool.appendChild(el);
        });
        getEl('boardContent')?.querySelectorAll('.hiddenboard-page').forEach(el => el.remove());
        const gridFragments = new Map(Object.values(grids).filter(Boolean).map(grid => [grid, document.createDocumentFragment()]));
        const reasonEntriesCache = new Map();
        const getCachedReasonEntries = (slotId, rMap) => {
            if (!reasonEntriesCache.has(slotId)) reasonEntriesCache.set(slotId, getHiddenboardReasonDisplayEntries(slotId, rMap, reqMap));
            return reasonEntriesCache.get(slotId);
        };

        const visibleMaterialIds = new Set([...baseMap.keys(), ...reqMap.keys()]);

        const processSlot = (id) => {
            const slotEl = _hiddenboardSlotElsByUid.get(id); if (!slotEl) return null;
            
            const isAutoCost = AUTO_COST_SLOT_SET.has(id);
            if (isAutoCost) return null;
            
            const isTarget = activeUnits.has(id);
            const isCompletedTarget = !isTarget && !isAutoCost && completedTargets.has(id);
            const isMergedSlot = isTarget && !isAutoCost && mergedSlots.has(id);
            
            let needed = reqMap.get(id) || 0;
            if (isMergedSlot) needed = Math.max(0, (baseMap.get(id)||0) - (completedUnits.get(id)||0));
            else if (isTarget && !isAutoCost) needed = Math.max(0, (activeUnits.get(id)||1) - (completedUnits.get(id)||0));
            if (isCompletedTarget) needed = 0;
            
            const baseNeeded = isTarget ? (isMergedSlot ? (baseMap.get(id)||0) : (activeUnits.get(id)||1)) :
                             isCompletedTarget ? (completedTargets.get(id)||1) :
                             (baseMap.get(id)||0);

            if (!baseNeeded && !isTarget && !isCompletedTarget) return null;

            renderHiddenboardSlotReasons({
                id, slotEl, needed, isTarget, isMergedSlot, reasonMap,
                getCachedReasonEntries, targetHighlight, highlightDeps
            });

            const isCompleted = needed === 0;
            slotEl.classList.toggle('has-target', !isCompleted);
            slotEl.classList.toggle('is-completed', isCompleted);

            let tGrid = null;

            const uGrade = unitMap.get(id)?.grade;
            const isHiddenGroup = getGradeIndex(uGrade) >= getGradeIndex(SYSTEM_CONFIG.policy.hiddenGroupMinGrade || "히든");
            const depthInTree = exactDepths.has(id) ? exactDepths.get(id) : 99;
            
            const nativeLevel = isHiddenGroup ? (depthInTree <= 2 ? 3 : 2) : 1;
            _unitNativeLevels.set(id, nativeLevel);
            
            let upgradedGrid = null;
            
            if (isCompletedTarget) upgradedGrid = grids.target;
            else if (isMergedSlot) upgradedGrid = grids.special;
            else if (isTarget) upgradedGrid = grids.target;
            else if (directMaterials.has(id)) upgradedGrid = grids.special;
            else {
                const rVals = reasonMap.get(id);
                if (rVals) {
                    for (const i of rVals.values()) {
                        if (i.depth === 1) { upgradedGrid = grids.special; break; }
                    }
                }
            }
            
            let nativeGrid = null;
            if (isHiddenGroup) nativeGrid = grids.upperHidden;
            else if (isBasicHiddenboardGrade(uGrade)) nativeGrid = grids.basicHidden;
            tGrid = upgradedGrid || nativeGrid;
            if (!tGrid) return null;

            const isFinalGoal = tGrid === grids.target;
            slotEl.classList.toggle('is-final-goal', isFinalGoal);
            if (isFinalGoal) renderHiddenboardRecipe(slotEl, calcResult);
            else switchHiddenboardDetail(id, slotEl.dataset.detailView, calcResult);
            const cWrap = slotEl.querySelector(`#craft-wrap-${id}`);
            if (cWrap) {
                if (!isCompleted) {
                    const tenDisabled = needed >= 10 ? '' : ' disabled';
                    const qtyButtons = isFinalGoal ? '' : `<button type="button" class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="1"><span class="batch-plus" aria-hidden="true">+</span>1개</button><button type="button" class="pc-btn" data-action="addComplete" data-uid="${id}" data-batch="10"${tenDisabled}><span class="batch-plus" aria-hidden="true">+</span>10개</button>`;
                    cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">${needed}</span><span class="req-label">개</span></div><div class="craft-wrap-right">${qtyButtons}<button type="button" class="btn-complete" data-action="completeUnit" data-uid="${id}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4 10-10"/></svg>완료</button></div>`;
                } else cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">0</span><span class="req-label">개</span></div><div class="craft-wrap-right"><span class="complete-done-label">완료됨</span></div>`;
            }

            const targetBadge = slotEl.querySelector('.d-target-badge');
            if (targetBadge) {
                const isTracking = isFinalGoal && targetHighlight === id;
                slotEl.querySelector('.d-final-goal-tag').hidden = !isFinalGoal;
                targetBadge.hidden = !isFinalGoal;
                targetBadge.classList.toggle('is-tracking', isTracking);
                targetBadge.setAttribute('aria-pressed', String(isTracking));
                targetBadge.textContent = isTracking ? '추적 해제' : '목표추적';
                targetBadge.title = isTracking ? '목표 재료 추적 해제' : '직속 재료부터 기초 재료까지 목표추적';
            }

            const gridId = tGrid?.id || '';
            _unitRestoreLevels.set(id, restoreLevelsByGridId[gridId] || 0);
            const keepCompletedVisible = excludeGridIds.includes(gridId);
            const hideT = (_hideCompleted && isCompleted && !keepCompletedVisible) ||
                (!!highlightDeps && !highlightDeps.has(id));
            if (tGrid) {
                if (!hideT) {
                    slotEl.classList.add('is-visible');
                } else {
                    slotEl.classList.remove('is-visible');
                }
                slotEl.style.display = hideT ? 'none' : 'flex';
                (gridFragments.get(tGrid) || tGrid).appendChild(slotEl);
            }

            
            return tGrid;
        };

        getUnitsFromIds(activeUnits.keys()).sort(compareUnitByHiddenboardPriority).forEach(u => processSlot(u.id));
        getUnitsFromIds(completedTargets.keys()).sort(compareUnitByGradeName).forEach(u => processSlot(u.id));

        getUnitsFromIds(Array.from(visibleMaterialIds)
            .filter(uid => !AUTO_COST_SLOT_SET.has(uid) && !activeUnits.has(uid) && !completedTargets.has(uid)))
            .sort(compareUnitByHiddenboardPriority)
            .forEach(u => processSlot(u.id));

        gridFragments.forEach((frag, grid) => { if (frag.childNodes.length > 0) grid.appendChild(frag); });

        sortHiddenboardGrids(grids);

        Object.values(grids).forEach(g => wrapHiddenboardGridPages(g, 6, !!targetHighlight));

        updateHiddenboardGroupVisibility(grids, targetHighlight, excludeGridIds);

        restoreHiddenboardGroupState(targetHighlight);

        _hiddenboardSlotElsByUid.forEach((el, cleanId) => {
            el.classList.toggle('highlighted-tree', !!_currentHighlight && highlightDeps?.has(cleanId));
        });
        updateGroupRestoreButtons();
    }

    /* ==========================================================================
       09. 재료보드·히든보드 자동 완료
       ========================================================================== */

    /* 재료보드 입력·보유량·완료 처리 */

    function getInvenboardAtoms() {
        const coreAtoms = [...SYSTEM_CONFIG.costboardAtoms, VOID_RAY_ATOM];
        return _isInvenboardSlotsExpanded ? [...coreAtoms, ...INVENBOARD_EXPANSION_ATOMS] : coreAtoms;
    }

    function countRecipeUnitInTree(uid, soughtId) {
        const walk = (node) => (node.id === soughtId && !node.tool ? node.qty : 0) +
            node.children.reduce((sum, child) => sum + walk(child), 0);
        return walk(buildGenealogyTree(uid).root);
    }

    function getVoidRayTargetQty(activeSource = activeUnits) {
        let count = 0;
        activeSource.forEach((qty, uid) => {
            if (qty > 0) count += countRecipeUnitInTree(uid, VOID_RAY_ID) * qty;
        });
        return count;
    }

    function getInvenboardCalculationAtoms() {
        const atoms = getInvenboardAtoms();
        // 핵심 모드의 기존 매직 원가 환산은 변경하지 않고 공허 포격기를 별도 집계한다.
        return _isInvenboardSlotsExpanded ? atoms : atoms.filter(atom => atom !== VOID_RAY_ATOM);
    }

    function getInvenboardAtomTargetMap(activeSource, preferRecipeAtoms) {
        const targetMap = calculateCostboardAtomTotals(new Map(), getInvenboardCalculationAtoms(), { activeSource, preferRecipeAtoms }).targetMap;
        if (!_isInvenboardSlotsExpanded) targetMap[VOID_RAY_ATOM] = getVoidRayTargetQty(activeSource);
        return targetMap;
    }

    function getInvenboardSlotDefs() {
        if (!_isInvenboardSlotsExpanded) return COSTBOARD_DISPLAY_SLOT_DEFS;
        const bottomSlotIds = new Set(["땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", VOID_RAY_ATOM].map(clean));
        const isBottomSlot = (slot) => (slot.atoms || []).some(atom => bottomSlotIds.has(clean(atom)));
        const upperSlots = COSTBOARD_DISPLAY_SLOT_DEFS.filter(slot => !isBottomSlot(slot));
        const bottomSlots = COSTBOARD_DISPLAY_SLOT_DEFS.filter(isBottomSlot);
        return [...upperSlots, ...INVENBOARD_EXPANSION_SLOT_DEFS, ...bottomSlots];
    }

    function getInvenboardSlotIdSet() {
        return _isInvenboardSlotsExpanded ? ALL_INVENBOARD_SLOT_SET : INVENBOARD_SLOT_SET;
    }

    function getInvenboardInputStep(id) {
        const cleanId = normalizeSavedId(id);
        const special = SPECIAL_RENDER_LIST.find(entry => entry.id === cleanId);
        return Math.max(1, parseInt(special?.batch, 10) || 1);
    }

    function normalizeInvenboardAmount(qty, maxQty) {
        const parsed = parseInt(qty, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        const limit = Math.max(0, parseInt(maxQty, 10) || 0);
        if (limit <= 0) return 0;
        return Math.min(parsed, limit);
    }

    function getEffectiveInvenboardCompletedSource(completedSource = completedUnits, activeSource = getInvenboardTrackedTargets(), targetMap = null) {
        const effective = new Map(completedSource instanceof Map ? completedSource : new Map(completedSource || []));
        const targetSource = activeSource instanceof Map ? activeSource : getInvenboardTrackedTargets();
        const atomTargetMap = targetMap || getInvenboardAtomTargetMap(targetSource, _isInvenboardSlotsExpanded);
        ALL_INVENBOARD_SLOT_SET.forEach(id => {
            if (!effective.has(id)) return;
            const rawQty = Math.max(0, parseInt(effective.get(id), 10) || 0);
            const maxQty = Math.max(0, parseInt(atomTargetMap[getCostboardAtomRawName(id)], 10) || 0);
            const nextQty = Math.min(rawQty, maxQty);
            if (nextQty > 0) effective.set(id, nextQty);
            else effective.delete(id);
        });
        return effective;
    }

    function calculateInvenboardCostboardTotals(completedSource = completedUnits, options = {}) {
        const activeSource = options.activeSource instanceof Map ? options.activeSource : getInvenboardTrackedTargets();
        const preferRecipeAtoms = _isInvenboardSlotsExpanded;
        const targetMap = options.targetMap || getInvenboardAtomTargetMap(activeSource, preferRecipeAtoms);
        const effectiveCompleted = options.rawCompleted === true ? completedSource : getEffectiveInvenboardCompletedSource(completedSource, activeSource, targetMap);
        const totals = calculateCostboardAtomTotals(effectiveCompleted, getInvenboardCalculationAtoms(), { ...options, activeSource, preferRecipeAtoms, targetMap });
        if (!preferRecipeAtoms) {
            const target = Math.max(0, targetMap[VOID_RAY_ATOM] || 0);
            const completed = Math.min(target, Math.max(0, parseInt(effectiveCompleted.get(VOID_RAY_ID), 10) || 0));
            totals.targetMap[VOID_RAY_ATOM] = target;
            totals.completedMap[VOID_RAY_ATOM] = completed;
            totals.remainingMap[VOID_RAY_ATOM] = Math.max(0, target - completed);
        }
        return totals;
    }

    function updateInvenboardSlotModeButton() {
        const btn = getEl('invenboardSlotModeBtn');
        if (!btn) return;
        btn.innerHTML = `<span>${_isInvenboardSlotsExpanded ? '핵심재료 전환' : '전체재료 전환'}</span><span class="board-action-icon" aria-hidden="true">▦</span>`;
        btn.setAttribute('aria-pressed', String(_isInvenboardSlotsExpanded));
        btn.title = _isInvenboardSlotsExpanded ? '현재 전체 재료 표시 · 핵심재료로 전환' : '현재 핵심재료 표시 · 전체재료로 전환';
        btn.classList.toggle('is-expanded', _isInvenboardSlotsExpanded);
    }

    function toggleInvenboardSlotMode() {
        if (_currentViewMode !== 'invenboard') return;
        _isInvenboardSlotsExpanded = !_isInvenboardSlotsExpanded;
        _isInvenboardRendered = false;
        const boardEl = getEl('boardContent');
        if (boardEl) boardEl.innerHTML = '';
        commitNexusStateChange();
    }

    function ensureInvenboardHeaderActions() {
        const mobileHost = getEl('invenboardActionsHost');
        if (!mobileHost) return null;
        let actions = getEl('invenboardHeaderActions');
        if (!actions) {
            actions = document.createElement('div');
            actions.id = 'invenboardHeaderActions';
            actions.className = 'invenboard-actions invenboard-header-actions';
            actions.innerHTML = `<button type="button" class="pc-btn invenboard-complete-all" id="invenboardCompleteAllBtn" data-action="completeAllInvenboardUnits"><span>전체완료</span><span class="board-action-icon" aria-hidden="true">✓</span></button>
                <button type="button" class="pc-btn invenboard-reset" data-action="resetInvenboardAmounts" title="재료 보유량 초기화"><span>보유량 초기화</span><span class="board-action-icon" aria-hidden="true">↺</span></button>
                <button type="button" class="pc-btn invenboard-mode-input" id="invenboardInputModeBtn" data-action="toggleInvenboardInputMode">수동입력 전환</button>
                <button type="button" class="pc-btn invenboard-slot-toggle" id="invenboardSlotModeBtn" data-action="toggleInvenboardSlotMode">전체재료 전환</button>`;
        }
        if (actions.parentElement !== mobileHost) mobileHost.appendChild(actions);
        updateInvenboardSlotModeButton();
        return actions;
    }

    function renderInvenboard() {
        if (_isInvenboardRendered) return;
        const boardEl = getEl('boardContent');
        if (!boardEl) return;
        _isHiddenboardRendered = false;
        returnHiddenboardControlsToHeader();
        boardEl.classList.remove('highlight-mode');
        boardEl.classList.add('invenboard-mode');

        const renderCostItem = (atom) => {
            const id = clean(atom);
            const safeName = escapeHtml(getCostboardDisplayName(atom));
            const inputStep = getInvenboardInputStep(id);
            return `<div class="invenboard-item" id="invenboard-${id}" data-inven-id="${id}">
                <div class="invenboard-main">
                    ${renderInvenboardGradeTag(atom)}
                    <span class="invenboard-name"${getInvenboardAtomNameStyle(atom)}>${safeName}</span>
                    <button type="button" class="invenboard-tap" data-action="invenboardAdd" data-inven-id="${id}" data-delta="${inputStep}" aria-label="${safeName} ${inputStep}보유">
                        <span class="invenboard-count" id="inven-owned-${id}">-</span>
                    </button>
                    <div class="invenboard-manual-value">
                        <input type="number" class="invenboard-input" id="inven-input-${id}" data-inven-id="${id}" min="0" step="1" inputmode="numeric" pattern="[0-9]*" aria-label="${safeName} 보유량">
                    </div>
                    <span class="invenboard-qty-caption" aria-hidden="true">보유량</span>
                </div>
                <div class="invenboard-controls">
                    <button type="button" class="pc-btn invenboard-plus" data-action="invenboardAdd" data-inven-id="${id}" data-delta="${inputStep}" aria-label="${safeName} ${inputStep}개 보유 추가">+${inputStep}</button>
                    <button type="button" class="pc-btn invenboard-plus invenboard-plus10" data-action="invenboardAdd" data-inven-id="${id}" data-delta="10" aria-label="${safeName} 10개 보유 추가">+10</button>
                </div>
            </div>`;
        };
        const renderCostSlot = ({ atoms }) => {
            const atomList = atoms.filter(Boolean);
            const slotIds = atomList.map(clean).join(',');
            const slotClass = `invenboard-slot ${getCostboardSlotToneClass(atomList)}`;
            const tone = SYSTEM_CONFIG.grades.colors[getInvenboardAtomGrade(atomList[0])] || '#efd3a4';
            const slotTone = ` style="--card-tone:${tone}"`;
            if (atomList.length === 1) return `<div class="${slotClass}"${slotTone} data-slot-atoms="${slotIds}">${renderCostItem(atomList[0])}</div>`;
            return `<div class="${slotClass} is-split-slot"${slotTone} data-slot-atoms="${slotIds}">${atomList.map(renderCostItem).join('<div class="invenboard-split-divider" aria-hidden="true"></div>')}</div>`;
        };

        boardEl.innerHTML = `<section class="invenboard-workspace" aria-label="재료 보드">
            <header class="invenboard-workspace-heading" aria-label="재료 보드 작업 도구">
                <h2 class="invenboard-workspace-title">재료 보드</h2>
                <div id="invenboardActionsHost" class="invenboard-actions-host"></div>
            </header>
            <div class="invenboard-workspace-body">
                <div id="invenboardEmpty" class="empty-msg"></div>
                <div class="invenboard-grid" id="invenboardGrid">${getInvenboardSlotDefs().map(renderCostSlot).join('')}</div>
            </div>
        </section>`;
        ensureInvenboardHeaderActions();
        _isInvenboardRendered = true;
    }

    function getInvenboardMaxQty(id, totals = calculateInvenboardCostboardTotals()) {
        if (!getInvenboardSlotIdSet().has(id)) return 0;
        if (id === VOID_RAY_ID) return Math.max(0, totals.targetMap[VOID_RAY_ATOM] || 0);
        return Math.max(0, totals.targetMap[getCostboardAtomRawName(id)] || 0);
    }

    function getDirectInvenboardAtomNeed(uid, qty = 1) {
        const amount = Math.max(1, parseInt(qty, 10) || 1);
        const cacheKey = `${_isInvenboardSlotsExpanded ? 'expanded' : 'core'}:${uid}:${amount}`;
        if (_directInvenboardAtomNeedCache.has(cacheKey)) return new Map(_directInvenboardAtomNeedCache.get(cacheKey));
        const { targetMap } = calculateInvenboardCostboardTotals(new Map(), { activeSource: new Map([[uid, amount]]), rawCompleted: true });
        const need = new Map(getInvenboardAtoms().map(atom => [clean(atom), Math.max(0, targetMap[atom] || 0)]).filter(([, n]) => n > 0));
        _directInvenboardAtomNeedCache.set(cacheKey, need); limitCacheSize(_directInvenboardAtomNeedCache, 512);
        return new Map(need);
    }

    function getInvenboardOwnedAtomMap({ directOnly = false } = {}) {
        const available = new Map();
        if (!directOnly) {
            const totals = calculateInvenboardCostboardTotals();
            getInvenboardAtoms().forEach(atom => {
                const qty = Math.max(0, parseInt(totals.completedMap[atom], 10) || 0);
                if (qty > 0) available.set(clean(atom), qty);
            });
            return available;
        }

        const effectiveCompleted = getEffectiveInvenboardCompletedSource(completedUnits);
        getInvenboardAtoms().forEach(atom => {
            const id = clean(atom);
            const qty = Math.max(0, parseInt(effectiveCompleted.get(id), 10) || 0);
            if (qty > 0) available.set(id, qty);
        });
        return available;
    }

    function getCompletedRecipeProgress(uid, qty) {
        const unit = unitMap.get(uid);
        if (!unit?.parsedRecipe?.length) return { hasRecipe: false, hasAnyCompleted: false, hasEnoughCompleted: false };
        let hasAnyCompleted = false;
        const hasEnoughCompleted = unit.parsedRecipe.every(child => {
            if (!child.id || isAutoRecipeRequirementSatisfied(child.id)) return true;
            const needQty = (isToolRequirement(uid, child.id) ? 1 : child.qty) * qty;
            const completedQty = Math.max(0, parseInt(completedUnits.get(child.id), 10) || 0);
            if (completedQty > 0) hasAnyCompleted = true;
            return completedQty >= needQty;
        });
        return { hasRecipe: true, hasAnyCompleted, hasEnoughCompleted };
    }

    function getInvenboardMaterialCompletionCandidates(baseMap) {
        const depths = getBoardDependencyDepths();
        return [...baseMap.entries()]
            .filter(([uid, qty]) =>
                qty > 0 &&
                unitMap.has(uid) &&
                !activeUnits.has(uid) &&
                !completedTargets.has(uid) &&
                !ALL_INVENBOARD_SLOT_SET.has(uid) &&
                (depths.get(uid) || 0) > 0
            )
            .map(([uid, qty]) => ({
                unit: unitMap.get(uid),
                qty,
                depth: depths.get(uid) || 0
            }))
            .sort((a, b) =>
                b.depth - a.depth ||
                getGradeIndex(a.unit.grade) - getGradeIndex(b.unit.grade) ||
                a.unit.name.localeCompare(b.unit.name)
            );
    }

    function getDirectInvenboardReadyQty(uid, maxQty, available = getInvenboardOwnedAtomMap({ directOnly: true })) {
        const limit = Math.max(0, parseInt(maxQty, 10) || 0);
        if (limit <= 0) return 0;
        const perUnitNeed = getDirectInvenboardAtomNeed(uid, 1);
        if (perUnitNeed.size === 0) return 0;
        let readyQty = limit;
        perUnitNeed.forEach((amount, id) => {
            if (AUTO_RECIPE_REQUIREMENT_SET.has(id)) return;
            const need = Math.max(1, parseInt(amount, 10) || 1);
            readyQty = Math.min(readyQty, Math.floor((available.get(id) || 0) / need));
        });
        return Math.max(0, readyQty);
    }

    function consumeAvailableInvenboardAtoms(available, uid, qty) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0) return;
        getDirectInvenboardAtomNeed(uid, 1).forEach((needQty, id) => {
            if (AUTO_RECIPE_REQUIREMENT_SET.has(id)) return;
            const usedQty = Math.max(0, parseInt(needQty, 10) || 0) * amount;
            const remain = Math.max(0, (available.get(id) || 0) - usedQty);
            if (remain > 0) available.set(id, remain);
            else available.delete(id);
        });
    }

    function completeInvenboardMaterialUnitsIfReady() {
        const candidates = getInvenboardMaterialCompletionCandidates(calculateBoardRequirements().baseMap);
        if (!candidates.length) return false;
        let changed = false;
        const available = getInvenboardOwnedAtomMap({ directOnly: true });

        for (const { unit, qty: requiredQty } of candidates) {
            const uid = unit.id;
            const currentCompleted = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
            const remainingQty = Math.max(0, requiredQty - currentCompleted);
            if (remainingQty <= 0) continue;

            if (isInvenboardInstantCompleteUnit(uid)) {
                addCompletedMaterialUnit(uid, remainingQty, { trackInvenboard: true });
                changed = true;
                continue;
            }

            const recipeReadyQty = getCompletedRecipeReadyQty(uid, remainingQty);
            if (recipeReadyQty > 0) {
                deleteCompletedRecipe(uid, recipeReadyQty);
                addCompletedMaterialUnit(uid, recipeReadyQty, { trackInvenboard: true });
                changed = true;
                continue;
            }

            const recipeProgress = getCompletedRecipeProgress(uid, 1);
            if (recipeProgress.hasAnyCompleted) continue;
            const directReadyQty = getDirectInvenboardReadyQty(uid, remainingQty, available);
            if (directReadyQty <= 0) continue;
            resetInvenboardOwnedForUnit(uid, directReadyQty);
            consumeAvailableInvenboardAtoms(available, uid, directReadyQty);
            addCompletedMaterialUnit(uid, directReadyQty, { trackInvenboard: true });
            changed = true;
        }
        return changed;
    }

    function completeInvenboardTargetsIfReady() {
        if (_currentViewMode !== 'invenboard' || activeUnits.size === 0) return false;

        let changed = completeInvenboardMaterialUnitsIfReady();
        const available = getInvenboardOwnedAtomMap({ directOnly: true });
        const targets = getUnitsFromMap(activeUnits);
        targets.forEach(unit => {
            const uid = unit.id;
            if (!activeUnits.has(uid)) return;
            const activeQty = activeUnits.get(uid) || 1;
            const recipeReadyQty = getCompletedRecipeReadyQty(uid, activeQty);
            const directReadyQty = getDirectInvenboardReadyQty(uid, activeQty, available);
            const hasAutoCompletedCostOnly = unit.parsedCost?.length && unit.parsedCost.every(pc => AUTO_COST_SLOT_SET.has(pc.key) && !COSTBOARD_ATOM_ID_SET.has(pc.key));
            const completeInstantly = isInvenboardInstantCompleteUnit(uid);
            const completeWithRecipe = recipeReadyQty >= activeQty;
            const completeWithDirectAtoms = completeInstantly || (!getCompletedRecipeProgress(uid, 1).hasAnyCompleted && (directReadyQty >= activeQty || (hasAutoCompletedCostOnly && getDirectInvenboardAtomNeed(uid, 1).size === 0)));
            if (!completeWithRecipe && !completeWithDirectAtoms) return;

            if (completeWithRecipe) {
                deleteCompletedRecipe(uid, activeQty);
            } else if (!completeInstantly) {
                resetInvenboardOwnedForUnit(uid, activeQty);
                consumeAvailableInvenboardAtoms(available, uid, activeQty);
            }
            completedTargets.set(uid, activeQty);
            activeUnits.delete(uid);
            pausedUnits.delete(uid);
            completedUnits.delete(uid);
            _invenboardAutoCompletedUnits.delete(uid);
            changed = true;
        });

        if (!changed) return false;
        _currentHighlight = null;
        return true;
    }

    function setInvenboardAmount(id, qty, options = {}) {
        const cleanId = normalizeSavedId(id);
        if (!getInvenboardSlotIdSet().has(cleanId)) return;
        const totals = calculateInvenboardCostboardTotals();
        const maxQty = getInvenboardMaxQty(cleanId, totals);
        const rawQty = normalizeInvenboardAmount(qty, Number.MAX_SAFE_INTEGER);
        const nextQty = normalizeInvenboardAmount(rawQty, maxQty);
        if (nextQty > 0) completedUnits.set(cleanId, nextQty);
        else completedUnits.delete(cleanId);
        if (options.preserveOverflow && rawQty > nextQty && maxQty > 0) _invenboardManualInputs.set(cleanId, rawQty);
        else _invenboardManualInputs.delete(cleanId);
        completeInvenboardTargetsIfReady();
        commitNexusStateChange();
    }

    function changeInvenboardAmount(id, delta) {
        const cleanId = normalizeSavedId(id);
        if (!getInvenboardSlotIdSet().has(cleanId)) return;
        const currentQty = completedUnits.get(cleanId) || 0;
        setInvenboardAmount(cleanId, currentQty + (parseInt(delta, 10) || 0));
    }

    function toggleInvenboardInputMode() {
        _invenboardInputMode = _invenboardInputMode === 'manual' ? 'auto' : 'manual';
        updateInvenboard();
    }

    function resetInvenboardAmounts() {
        let changed = false;
        ALL_INVENBOARD_SLOT_SET.forEach(id => {
            if (completedUnits.has(id)) {
                completedUnits.delete(id);
                changed = true;
            }
        });

        if (resetInvenboardAutoCompletedUnits()) changed = true;
        if (clearInvenboardManualInputs()) changed = true;

        const completedTargetEntries = Array.from(completedTargets.entries());
        if (completedTargetEntries.length > 0) {
            completedTargets.clear();
            completedTargetEntries.forEach(([uid, qty]) => {
                if (!unitMap.has(uid)) return;
                const restoreQty = qty || 1;
                completedUnits.delete(uid);
                setActiveUnitQty(uid, restoreQty);
            });
            changed = true;
        }

        if (!changed) return;
        commitNexusStateChange({ clearHighlight: true });
    }

    function completeAllInvenboardUnits() {
        if (_currentViewMode !== 'invenboard' || activeUnits.size === 0) return;
        const totals = calculateInvenboardCostboardTotals();
        ALL_INVENBOARD_SLOT_SET.forEach(id => completedUnits.delete(id));
        clearInvenboardManualInputs();
        getInvenboardAtoms().forEach(atom => {
            const qty = Math.max(0, parseInt(totals.targetMap[atom], 10) || 0);
            if (qty > 0) completedUnits.set(clean(atom), qty);
        });
        const voidQty = getInvenboardMaxQty(VOID_RAY_ID, totals);
        if (voidQty > 0) completedUnits.set(VOID_RAY_ID, voidQty);
        const targets = Array.from(activeUnits.entries()).filter(([uid]) => unitMap.has(uid));
        if (targets.length === 0) return;
        targets.forEach(([uid, qty]) => {
            completedTargets.set(uid, normalizeUnitQty(uid, qty) || 1);
            activeUnits.delete(uid);
            pausedUnits.delete(uid);
        });
        commitNexusStateChange({ clearHighlight: true });
    }

    function updateInvenboard(costboardTotals = null) {
        if (!_isInvenboardRendered) return;
        const boardEl = getEl('boardContent');
        if (!boardEl) return;
        boardEl.classList.add('invenboard-mode');
        const totals = costboardTotals || calculateInvenboardCostboardTotals();
        const isManual = _invenboardInputMode === 'manual';

        getInvenboardAtoms().forEach(atom => {
            const id = clean(atom);
            const needQty = Math.max(0, totals.targetMap[atom] || 0);
            const directRawQty = Math.max(0, parseInt(completedUnits.get(id), 10) || 0);
            const directOwnedQty = Math.min(directRawQty, needQty);
            const manualInputQty = Math.max(0, parseInt(_invenboardManualInputs.get(id), 10) || 0);
            const shownInputQty = Math.max(manualInputQty, directRawQty);
            const ownedQty = Math.max(directOwnedQty, Math.max(0, parseInt(totals.completedMap[atom], 10) || 0));
            const isDisabled = needQty <= 0 && ownedQty <= 0;
            const isOverLimit = isManual && needQty > 0 && shownInputQty > needQty;
            const remainQty = Math.max(0, needQty - Math.min(ownedQty, needQty));
            const item = getEl(`invenboard-${id}`);
            if (!item) return;
            item.classList.toggle('active', !isDisabled);
            item.classList.toggle('is-disabled', isDisabled);
            item.classList.toggle('is-completed', ownedQty > 0 && remainQty === 0);
            item.classList.toggle('is-manual', isManual);
            item.classList.toggle('is-over-limit', isOverLimit);

            const countEl = getEl(`inven-owned-${id}`);
            const input = getEl(`inven-input-${id}`);
            const tapBtn = item.querySelector('.invenboard-tap');
            const plusBtns = item.querySelectorAll('.invenboard-plus');
            const plus10 = item.querySelector('.invenboard-plus10');

            if (countEl) {
                countEl.textContent = isDisabled ? '-' : String(ownedQty);
            }
            if (input) {
                const displayQty = isManual ? shownInputQty : ownedQty;
                if (isDisabled || document.activeElement !== input) input.value = isDisabled ? '' : String(displayQty);
                input.placeholder = isDisabled ? '-' : '';
                input.max = String(Math.max(0, needQty));
                input.readOnly = !isManual || needQty <= 0;
                input.disabled = !isManual || isDisabled;
                input.tabIndex = isManual && needQty > 0 ? 0 : -1;
                input.classList.toggle('is-over-limit', isOverLimit);
                input.title = isOverLimit ? `필요량 ${needQty} 초과: 계산에는 ${needQty}까지만 반영됩니다.` : '';
                input.setAttribute('aria-invalid', isOverLimit ? 'true' : 'false');
            }
            if (tapBtn) tapBtn.disabled = isManual || needQty <= 0 || remainQty <= 0;
            plusBtns.forEach(btn => { btn.disabled = needQty <= 0 || remainQty <= 0; });
            if (plus10) plus10.disabled = needQty <= 0 || remainQty < 10;
        });

        document.querySelectorAll('.invenboard-slot').forEach(slot => {
            const hasActive = !!slot.querySelector('.invenboard-item.active');
            slot.classList.toggle('active', hasActive);
            slot.classList.toggle('has-active', hasActive);
        });

        const modeBtn = getEl('invenboardInputModeBtn');
        if (modeBtn) {
            modeBtn.innerHTML = `<span>${isManual ? '자동입력 전환' : '수동입력 전환'}</span><span class="board-action-icon" aria-hidden="true">⇄</span>`;
            modeBtn.setAttribute('aria-pressed', String(isManual));
            modeBtn.title = isManual ? '현재 수동입력 · 자동입력으로 전환' : '현재 자동입력 · 수동입력으로 전환';
            modeBtn.classList.toggle('is-manual', isManual);
        }
        updateInvenboardSlotModeButton();
        const completeAllBtn = getEl('invenboardCompleteAllBtn');
        if (completeAllBtn) completeAllBtn.disabled = activeUnits.size === 0;
        const empty = getEl('invenboardEmpty');
        if (empty) {
            const isEmpty = activeUnits.size === 0 && completedTargets.size === 0;
            empty.style.display = isEmpty ? 'block' : 'none';
            if (isEmpty) empty.innerHTML = `<div class="empty-msg-enhanced"><div class="empty-main">유닛도감에서 유닛을 선택하세요</div></div>`;
        }
    }


    function getBoardDependencyDepths(source = activeUnits) {
        const depths = new Map();
        const visit = (uid, depth, path = new Set()) => {
            if (!uid || path.has(uid)) return;
            if ((depths.get(uid) || -1) < depth) depths.set(uid, depth);
            const unit = unitMap.get(uid);
            if (!unit) return;
            path.add(uid);
            unit.parsedRecipe?.forEach(child => child.id && visit(child.id, depth + 1, path));
            getToolNeed(uid).forEach(toolId => visit(toolId, depth + 1, path));
            path.delete(uid);
        };
        (source instanceof Map ? source : activeUnits).forEach((_, uid) => visit(uid, 0));
        return depths;
    }

    function addCompletedMaterialUnit(uid, qty, { trackInvenboard = false } = {}) {
        const amount = Math.max(0, parseInt(qty, 10) || 0);
        if (amount <= 0) return;
        completedUnits.set(uid, Math.max(0, completedUnits.get(uid) || 0) + amount);
        if (trackInvenboard) addInvenboardAutoCompletedUnit(uid, amount);
    }


    function getCompletedRecipeReadyQty(uid, maxQty = 1) {
        const unit = unitMap.get(uid);
        const limit = Math.max(0, parseInt(maxQty, 10) || 0);
        if (limit <= 0 || !unit?.parsedRecipe?.length) return 0;

        let readyQty = limit;
        let hasRequirement = false;
        unit.parsedRecipe.forEach(child => {
            if (!child.id) return;
            hasRequirement = true;
            if (isAutoRecipeRequirementSatisfied(child.id)) return;
            const perUnitNeed = Math.max(1, parseInt(isToolRequirement(uid, child.id) ? 1 : child.qty, 10) || 1);
            const completedQty = Math.max(0, parseInt(completedUnits.get(child.id), 10) || 0);
            readyQty = Math.min(readyQty, Math.floor(completedQty / perUnitNeed));
        });
        return hasRequirement ? Math.max(0, readyQty) : 0;
    }

    function getHiddenboardRecipeCompletionCandidates(baseMap) {
        const depths = getBoardDependencyDepths();
        const candidates = new Map();

        const addCandidate = (uid, qty) => {
            const requiredQty = Math.max(0, parseInt(qty, 10) || 0);
            if (requiredQty <= 0 || !unitMap.has(uid) || completedTargets.has(uid)) return;
            const depth = depths.has(uid) ? depths.get(uid) : (activeUnits.has(uid) ? 0 : -1);
            if (depth < 0) return;
            candidates.set(uid, { unit: unitMap.get(uid), qty: requiredQty, depth });
        };

        baseMap.forEach((qty, uid) => addCandidate(uid, qty));
        activeUnits.forEach((qty, uid) => addCandidate(uid, qty));

        return [...candidates.values()].sort((a, b) =>
            b.depth - a.depth ||
            getGradeIndex(a.unit.grade) - getGradeIndex(b.unit.grade) ||
            a.unit.name.localeCompare(b.unit.name)
        );
    }

    function completeHiddenboardRecipeUnitsIfReady() {
        if (_currentViewMode !== 'hiddenboard' || activeUnits.size === 0) return false;

        let changed = false;
        for (let pass = 0; pass < APP_INTERNAL.maxAutoCompletePasses && activeUnits.size > 0; pass++) {
            const activeSizeBefore = activeUnits.size;
            const { baseMap } = calculateBoardRequirements();
            const candidates = getHiddenboardRecipeCompletionCandidates(baseMap);
            let completedThisPass = false;

            for (const { unit, qty: requiredQty } of candidates) {
                const uid = unit.id;
                const currentCompleted = Math.max(0, parseInt(completedUnits.get(uid), 10) || 0);
                const targetQty = activeUnits.has(uid) ? (activeUnits.get(uid) || 1) : requiredQty;
                const remainingQty = Math.max(0, targetQty - currentCompleted);
                if (remainingQty <= 0) continue;

                const readyQty = getCompletedRecipeReadyQty(uid, remainingQty);
                if (readyQty <= 0) continue;

                deleteCompletedRecipe(uid, readyQty);
                if (activeUnits.has(uid)) {
                    const activeQty = activeUnits.get(uid) || 1;
                    const nextCompleted = currentCompleted + readyQty;
                    if (nextCompleted >= activeQty) {
                        completedTargets.set(uid, activeQty);
                        activeUnits.delete(uid);
                        pausedUnits.delete(uid);
                        completedUnits.delete(uid);
                                    } else {
                        completedUnits.set(uid, nextCompleted);
                    }
                } else {
                    addCompletedMaterialUnit(uid, readyQty);
                }

                completedThisPass = changed = true;
                if (activeUnits.size !== activeSizeBefore) break;
            }

            if (!completedThisPass || activeUnits.size === activeSizeBefore) break;
        }

        if (!changed) return false;
        _currentHighlight = null;
        return true;
    }

    /* ==========================================================================
       10. 유닛 도감·즐겨찾기
       ========================================================================== */


    const getUnitboardMinGradeIndex = () => getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
    const isUnitboardVisibleException = (id) => CLEAN_UNITBOARD_VISIBLE_EXCEPTION_IDS.has(clean(id));
    const isUnitboardVisibleUnit = (u) => !!u && (getGradeIndex(u.grade) >= getUnitboardMinGradeIndex() || isUnitboardVisibleException(u.id));
    const isSelectableUnitboardUnit = (u) => isUnitboardVisibleUnit(u) && !isRestrictedUnit(u.id);
    function renderTabs() {
        const t = getEl('unitboardTabs');
        if (!t) return;
        const collections = [['favorites', '즐겨찾기', '☆']];
        t.innerHTML = collections.map(([key, label, icon]) => `<button type="button" id="tab-btn-${key}" role="tab" aria-controls="cat-group-${key}" aria-selected="false" class="tab-btn collection-tab" data-action="showUnitCollection" data-collection="${key}"><span aria-hidden="true">${icon}</span><span>${label}</span><span id="${key}Count" class="collection-count">0</span></button>`).join('') +
            SYSTEM_CONFIG.tabs.map((c, i) => `<button type="button" id="tab-btn-${i}" role="tab" aria-controls="cat-group-${c.key}" aria-selected="false" class="tab-btn" data-action="selectTab" data-tab-idx="${i}"><span>${c.name}</span></button>`).join('');
        updateTabsUI();
    }
    function updateTabsUI() {
        const aCats = new Set([...activeUnits.keys()].map(id => unitMap.get(id)?.category).filter(Boolean));
        SYSTEM_CONFIG.tabs.forEach((c, i) => {
            const btn = getEl(`tab-btn-${i}`), isActive = !_unitboardCollection && i === _activeTabIdx;
            if (!btn) return;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
            btn.classList.toggle('has-active', aCats.has(c.key));
        });
        ['favorites'].forEach(key => {
            const items = getUnitboardCollectionItems(key), tab = getEl(`tab-btn-${key}`), count = getEl(`${key}Count`);
            if (tab) {
                tab.classList.toggle('active', _unitboardCollection === key);
                tab.setAttribute('aria-selected', String(_unitboardCollection === key));
                tab.classList.toggle('has-active', items.some(item => activeUnits.has(item.id)));
            }
            if (count) count.textContent = String(items.length);
        });
        const resetSelectionBtn = getEl('btnResetSelection');
        if (resetSelectionBtn) resetSelectionBtn.disabled = activeUnits.size === 0;
        const currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
        const visibleItems = _unitboardCollection ? getUnitboardCollectionItems(_unitboardCollection) : getUnitboardVisibleItems().filter(u => u.category === currentTab?.key);
        const categoryTitle = getEl('archiveCategoryTitle'), archiveCount = getEl('archiveCount'), selectAllBtn = getEl('btnSelectAllTab');
        if (categoryTitle) categoryTitle.textContent = _unitboardCollection === 'favorites' ? '즐겨찾기' : currentTab?.name || '';
        if (archiveCount) archiveCount.textContent = `${visibleItems.length} UNITS`;
        if (selectAllBtn) {
            const selectable = visibleItems.filter(isSelectableUnitboardUnit);
            selectAllBtn.disabled = selectable.length === 0;
            const allSelected = selectable.length > 0 && selectable.every(item => activeUnits.has(item.id));
            selectAllBtn.innerHTML = allSelected
                ? '<span class="btn-select-all-clear-label">전체 선택 해제</span><span class="action-icon btn-select-all-clear-label" aria-hidden="true">−</span>'
                : '<span>전체 선택</span><span class="action-icon" aria-hidden="true">+</span>';
        }
    }
    function starBtnHtml(id) {
        const isFav = _favorites.has(id), name = unitMap.get(id)?.name || id;
        return `<button type="button" class="uc-fav-btn${isFav ? ' is-fav' : ''}" data-action="toggleFavorite" data-uid="${id}" aria-pressed="${isFav}" aria-label="${escapeHtml(name)} 즐겨찾기 ${isFav ? '해제' : '추가'}">${isFav ? '★' : '☆'}</button>`;
    }
    function buildCardControl(item, prefix, isRestricted, isOT) {
        const selection = `<span class="uc-selection-state"><span class="selection-check" aria-hidden="true">✓</span><span class="selection-status-label">목표 선택</span></span>`;
        const control = !isOT && !isRestricted
            ? `<div class="smart-stepper" id="stepper-${prefix}${item.id}"><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="-1" aria-label="${item.name} 감소">−</button><div class="ss-val" id="val-unit-${prefix}${item.id}" aria-live="polite">−</div><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="1" aria-label="${item.name} 추가">+</button></div>`
            : `<span class="uc-limit">${isRestricted ? '직접 선택 제한' : '최대 1개'}</span>`;
        return `<div class="uc-ctrl-area">${selection}${control}</div>`;
    }

    function getUnitEssenceParts(item) {
        if (!item?.id) return [];
        if (_unitEssencePartsCache.has(item.id)) return _unitEssencePartsCache.get(item.id);
        const counts = getEssenceCount(new Map([[item.id, 1]]));
        const hybrid = Math.max(0, counts['혼종'] || 0);
        const parts = [
            ['coral', '코랄', Math.max(0, (counts['코랄'] || 0) + hybrid)],
            ['aiur', '아이어', Math.max(0, (counts['아이어'] || 0) + hybrid)],
            ['zerus', '제루스', Math.max(0, (counts['제루스'] || 0) + hybrid)]
        ].filter(([, , value]) => value > 0);
        _unitEssencePartsCache.set(item.id, parts);
        return parts;
    }

    function getUnitUnitboardEssenceText(item) {
        const parts = getUnitEssenceParts(item);
        if (!parts.length) return '';
        return `<div class="uc-essence-summary" aria-label="${item.name} 정수정보">${parts.map(([id, name, value]) => `<span class="uc-essence-chip uc-essence-${id}"><span>${name}</span><span class="uc-essence-value">${value}</span></span>`).join('')}</div>`;
    }

    function getUnitCardNotesHtml(item) {
        const notes = [];
        if (isRestrictedUnit(item.id)) {
            const parents = Array.from(unitMap.values()).filter(parent => parent.parsedRecipe?.some(ingredient => ingredient.id === item.id));
            const parentNames = parents.length ? parents.map(parent => parent.name).join('·') : '상위 유닛';
            notes.push(`${parentNames} 조합에 자동 포함 · 직접 선택 불가`);
        }
        const condition = CLEAN_UNIT_CONDITIONS[item.id];
        if (condition) notes.push(condition);
        return notes.length ? `<div class="uc-notes">${notes.map(note => `<div class="uc-note"><span>${escapeHtml(note)}</span></div>`).join('')}</div>` : '';
    }

    function buildCard(item, prefix = '') {
        const isRestricted = isRestrictedUnit(item.id), isOT = isOneTime(item);
        const essenceText = getUnitUnitboardEssenceText(item);
        const noticeHtml = getUnitCardNotesHtml(item);
        const recipeHtml = formatRecipe(item);
        return `<article id="card-${prefix}${item.id}" class="unit-card${isRestricted ? ' is-excluded' : ''}" data-grade="${item.grade}" data-action="toggleUnit" data-uid="${item.id}" tabindex="0" role="group" aria-label="${item.name} ${isRestricted ? '선택 제한' : '목표 선택'}">` +
            `<div class="uc-card-inner"><div class="uc-head">` +
            `<div class="uc-meta-row"><span class="gtag grade-${item.grade}">${item.grade}</span>${isRestricted ? '<span class="badge-excluded"><svg class="badge-excluded-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>선택제한</span>' : ''}${starBtnHtml(item.id)}</div>` +
            `<h3 class="uc-name-row">${item.name}</h3>` +
            noticeHtml +
            `${essenceText ? `<div>${essenceText}</div>` : ''}</div>` +
            `<div class="uc-recipe-area"><span class="recipe-label">조합 조건</span>${recipeHtml}</div>` +
            `${buildCardControl(item, prefix, isRestricted, isOT)}</div></article>`;
    }

    function buildPagerPages(htmlItems, pageSize, pageClass) {
        if (!Array.isArray(htmlItems) || htmlItems.length === 0) return '';
        const size = Math.max(1, pageSize || htmlItems.length);
        let html = '';
        for (let i = 0; i < htmlItems.length; i += size) {
            html += `<div class="${pageClass}">${htmlItems.slice(i, i + size).join('')}</div>`;
        }
        return html;
    }

    function getUnitboardSort(a, b) {
        return (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
            (isOneTime(a) ? -1 : isOneTime(b) ? 1 : 0) ||
            getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
            calculateTotalCostScore(b) - calculateTotalCostScore(a) ||
            a.name.localeCompare(b.name);
    }

    function getUnitboardVisibleItems() {
        return Array.from(unitMap.values()).filter(isUnitboardVisibleUnit);
    }

    function getUnitboardCollectionItems(collection) {
        return collection === 'favorites' ? getUnitboardVisibleItems().filter(u => _favorites.has(u.id)).sort(getUnitboardSort) : [];
    }
    function buildUnitboardCollection(collection) {
        const items = getUnitboardCollectionItems(collection);
        if (items.length === 0) {
            return `<div class="collection-empty"><span aria-hidden="true">☆</span><h3>자주 쓰는 유닛을 모아두세요</h3><p>카드의 별을 누르면 여기에 모입니다.<br>원래 도감의 위치와 선택 상태는 그대로 유지됩니다.</p><button type="button" class="ctrl-btn" data-action="selectTab" data-tab-idx="${_activeTabIdx}">유닛도감 둘러보기</button></div>`;
        }
        return `<p class="collection-guide">모든 분류의 즐겨찾기를 한곳에서 확인하세요. 별을 다시 누르면 해제됩니다.</p><div class="unitboard-fav-grid">${buildPagerPages(items.map(item => buildCard(item, 'fav-')), 2, 'unitboard-page unitboard-fav-page')}</div>`;
    }
    function initAllTabContents() {
        const tc = getEl('tabContent');
        if (!tc) return;
        const categories = SYSTEM_CONFIG.tabs.map(cat => {
            const items = getUnitboardVisibleItems().filter(u => u.category === cat.key).sort(getUnitboardSort);
            if (cat.key === '저그중립') {
                const rightArmIndex = items.findIndex(u => u.id === '데하카의오른팔');
                const cocoonIndex = items.findIndex(u => u.id === '데하카고치');
                if (rightArmIndex >= 0 && cocoonIndex >= 0) {
                    const [rightArm] = items.splice(rightArmIndex, 1);
                    items.splice(items.findIndex(u => u.id === '데하카고치'), 0, rightArm);
                }
            }
            const bodyHtml = items.length
                ? buildPagerPages(items.map(item => buildCard(item)), 6, 'unitboard-page unitboard-category-page')
                : '<div class="unitboard-empty-msg">표시할 유닛이 없습니다.</div>';
            return `<div id="cat-group-${cat.key}" class="cat-group" role="tabpanel" aria-labelledby="tab-btn-${SYSTEM_CONFIG.tabs.indexOf(cat)}"><div class="unitboard-category-grid">${bodyHtml}</div></div>`;
        }).join('');
        tc.innerHTML = ['favorites'].map(key => `<div id="cat-group-${key}" class="cat-group" role="tabpanel" aria-labelledby="tab-btn-${key}">${buildUnitboardCollection(key)}</div>`).join('') + categories;
        _isTabContentInitialized = true;
        indexUnitboardDom();
    }
    function indexUnitboardDom() {
        _unitCardElsByUid.clear(); _favoriteBtnElsByUid.clear();
        document.querySelectorAll('.unit-card[data-uid]').forEach(card => {
            const uid = card.dataset.uid;
            if (!_unitCardElsByUid.has(uid)) _unitCardElsByUid.set(uid, []);
            _unitCardElsByUid.get(uid).push(card); _dirtyUnitCardIds.add(uid);
        });
        document.querySelectorAll('.uc-fav-btn[data-uid]').forEach(btn => {
            const uid = btn.dataset.uid;
            if (!_favoriteBtnElsByUid.has(uid)) _favoriteBtnElsByUid.set(uid, []);
            _favoriteBtnElsByUid.get(uid).push(btn);
        });
        _unitboardDomIndexed = true;
    }

    function renderCurrentTabContent() {
        if (!_isTabContentInitialized) initAllTabContents();
        ['favorites'].forEach(key => getEl(`cat-group-${key}`)?.classList.toggle('is-visible', _unitboardCollection === key));
        SYSTEM_CONFIG.tabs.forEach((c, i) => getEl(`cat-group-${c.key}`)?.classList.toggle('is-visible', !_unitboardCollection && i === _activeTabIdx));
        updateTabContentUI();
    }
    function updateTabContentUI() {
        if (!_unitboardDomIndexed) indexUnitboardDom();
        const dirtyIds = new Set(_dirtyUnitCardIds);
        _lastUnitboardQtyByUid.forEach((_, uid) => dirtyIds.add(uid));
        activeUnits.forEach((_, uid) => dirtyIds.add(uid));
        completedTargets.forEach((_, uid) => dirtyIds.add(uid));

        dirtyIds.forEach(uid => {
            const item = unitMap.get(uid), isActive = activeUnits.has(uid), isFav = _favorites.has(uid);
            (_unitCardElsByUid.get(uid) || []).forEach(card => {
                if (!item) return;
                if (!isOneTime(item)) {
                    const nv = isActive ? String(activeUnits.get(uid)) : '-';
                    card.querySelectorAll('.ss-val').forEach(v => { if (v.innerText !== nv) v.innerText = nv; });
                    card.querySelectorAll('.smart-stepper button').forEach(b => { b.disabled = !isActive; });
                }
                card.style.display = 'flex';
                card.classList.toggle('active', isActive);
                card.setAttribute('aria-label', `${item.name} · ${isActive ? '선택됨' : '목표 선택'}`);
                const status = card.querySelector('.selection-status-label');
                if (status) status.textContent = isRestrictedUnit(uid) ? '선택 제한' : isActive ? '선택됨' : '목표 선택';
            });
            (_favoriteBtnElsByUid.get(uid) || []).forEach(btn => {
                btn.classList.toggle('is-fav', isFav);
                btn.textContent = isFav ? '★' : '☆';
                btn.setAttribute('aria-pressed', String(isFav));
                btn.setAttribute('aria-label', `${item?.name || uid} 즐겨찾기 ${isFav ? '해제' : '추가'}`);
                btn.removeAttribute('title');
            });
        });
        _lastUnitboardQtyByUid = new Map([...activeUnits, ...completedTargets]);
        _dirtyUnitCardIds.clear();
    }

    function toggleFavorite(id, event) {
        event?.stopPropagation();
        const unit = unitMap.get(id);
        if (!unit) return;
        const wasFavorite = _favorites.has(id), content = getEl('tabContent');
        const scrollTop = content?.scrollTop || 0;
        const scrollLeft = getEl('cat-group-favorites')?.querySelector('.unitboard-fav-grid')?.scrollLeft || 0;
        if (wasFavorite) _favorites.delete(id); else _favorites.add(id);
        saveFavorites();
        triggerHaptic();
        const favoritePanel = getEl('cat-group-favorites');
        if (favoritePanel) favoritePanel.innerHTML = buildUnitboardCollection('favorites');
        _unitboardDomIndexed = false;
        indexUnitboardDom();
        renderCurrentTabContent();
        updateTabsUI();
        if (content) content.scrollTop = scrollTop;
        const pager = favoritePanel?.querySelector('.unitboard-fav-grid');
        if (pager) pager.scrollLeft = Math.min(scrollLeft, Math.max(0, pager.scrollWidth - pager.clientWidth));
        if (_unitboardCollection === 'favorites' && event?.detail === 0) getEl('tab-btn-favorites')?.focus({ preventScroll: true });
    }

    function toggleUnitSelection(id, forceQty) {
        if (!unitMap.has(id) || isRestrictedUnit(id)) return;
        if (activeUnits.has(id)) activeUnits.delete(id);
        else setActiveUnitQty(id, forceQty || pausedUnits.get(id) || 1);
        debouncedUpdateAllPanels();
    }

    function setUnitQty(id, val) {
        if (!unitMap.has(id) || isRestrictedUnit(id) || isOneTime(unitMap.get(id))) return;
        if (val <= 0) {
            if (activeUnits.delete(id)) debouncedUpdateAllPanels();
            return;
        }
        if (setActiveUnitQty(id, val)) debouncedUpdateAllPanels();
    }

    function toggleSelectAllTab() {
        const currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
        const visible = _unitboardCollection ? getUnitboardCollectionItems(_unitboardCollection) : getUnitboardVisibleItems().filter(u => u.category === currentTab?.key);
        const items = visible.filter(isSelectableUnitboardUnit);
        if (!items.length) return;
        if (items.every(item => activeUnits.has(item.id))) items.forEach(item => activeUnits.delete(item.id));
        else items.forEach(item => !activeUnits.has(item.id) && setActiveUnitQty(item.id, pausedUnits.get(item.id) || 1));
        commitNexusStateChange();
    }
    function selectTab(idx) {
        hideRecipeTooltip();
        _unitboardCollection = null;
        _activeTabIdx = Math.max(0, Math.min(parseInt(idx, 10) || 0, SYSTEM_CONFIG.tabs.length - 1));
        updateTabsUI();
        renderCurrentTabContent();
    }

    /* ==========================================================================
       11. 나의 조합·독립 창
       ========================================================================== */


    /* 나의 조합 · 필요 재료 독립 창: 원본 탭에 의존하지 않는 자체 페이지 */
    function updateBuildWindowButton() {
        const button = getEl('btnBuildStandalone');
        if (button && !IS_STANDALONE_BUILD) {
            button.classList.toggle('is-active', Boolean(_buildStandaloneWindow && !_buildStandaloneWindow.closed));
        }
    }

    function openBuildIndependentWindow() {
        // 클릭 이벤트에서 주소가 있는 새 창을 직접 열어 독립 실행한다.
        if (_buildStandaloneWindow && !_buildStandaloneWindow.closed) {
            _buildStandaloneWindow.focus();
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set('nexusStandalone', 'build');
        url.searchParams.delete('fresh');
        url.searchParams.delete('__nexus_check');
        _buildStandaloneWindow = window.open(url.href, 'nexusBuildStandalone',
            'popup=yes,width=420,height=540,resizable=yes,scrollbars=yes');
        if (!_buildStandaloneWindow) {
            window.alert('독립 창이 차단되었습니다. 브라우저의 팝업 허용 설정을 확인해 주세요.');
            return;
        }
        updateBuildWindowButton();
        _buildStandaloneWindow.focus();
    }

    function setupBuildStandaloneWindow() {
        if (!IS_STANDALONE_BUILD) return;
        document.title = '나의 조합 · 필요 재료 | 개복디 넥서스';
        const button = getEl('btnBuildStandalone');
        if (button) {
            const closeHost = document.querySelector('.inspector-window-controls');
            if (closeHost) closeHost.appendChild(button);
            button.classList.remove('gh-tool-btn');
            button.classList.add('inspector-standalone-btn');
            button.dataset.action = 'closeBuildStandaloneWindow';
            button.setAttribute('aria-label', '독립 창 닫기');
            button.title = '독립 창 닫기';
        }
        // 원본 탭의 저장값 변경을 자체 엔진으로 다시 계산한다.
        window.addEventListener('storage', event => {
            if (event.key === SYSTEM_CONFIG.storageKeys.saveData) {
                loadNexusState();
                debouncedUpdateAllPanels();
            } else if (event.key === SYSTEM_CONFIG.storageKeys.fontScale) {
                loadFontScale();
            }
        });
    }

    /* 장바구니 */
    function pauseCartUnit(uid) {
        if (!activeUnits.has(uid) || !unitMap.has(uid)) return;
        const qty = activeUnits.get(uid) || 1;
        activeUnits.delete(uid);
        setPositiveMapValue(pausedUnits, uid, qty);
        commitNexusStateChange();
    }

    function discardActiveCartUnit(uid) {
        if (!activeUnits.has(uid)) return;
        removeActiveUnitState(uid);
        commitNexusStateChange();
    }

    function discardPausedCartUnit(uid) {
        if (!pausedUnits.has(uid)) return;
        pausedUnits.delete(uid);
        commitNexusStateChange();
    }

    function discardCompletedCartUnit(uid) {
        if (!removeCompletedTarget(uid)) return;
        commitNexusStateChange();
    }

    function pauseAllActiveUnits() {
        if (activeUnits.size === 0) return;
        const entries = Array.from(activeUnits.entries()).filter(([uid]) => unitMap.has(uid));
        activeUnits.clear();
        entries.forEach(([uid, qty]) => setPositiveMapValue(pausedUnits, uid, qty));
        commitNexusStateChange({ clearHighlight: true });
    }

    function clearCartItems() {
        let changed = false;

        if (_cartTab === 'active') {
            const entries = Array.from(activeUnits.entries());
            if (entries.length === 0) return;
            entries.forEach(([uid, qty]) => removeActiveUnitState(uid, qty));
            changed = true;
        } else if (_cartTab === 'paused') {
            if (pausedUnits.size === 0) return;
            pausedUnits.clear();
            changed = true;
        } else {
            const entries = Array.from(completedTargets.keys());
            if (entries.length === 0) return;
            entries.forEach(uid => { if (removeCompletedTarget(uid)) changed = true; });
        }

        if (!changed) return;
        commitNexusStateChange({ clearHighlight: true });
    }

    function restorePausedUnit(uid) {
        if (!pausedUnits.has(uid) || !unitMap.has(uid)) return;
        const qty = pausedUnits.get(uid) || 1;
        pausedUnits.delete(uid);
        setActiveUnitQty(uid, qty);
        commitNexusStateChange();
    }

    function restoreAllPausedUnits() {
        if (pausedUnits.size === 0) return;
        const entries = Array.from(pausedUnits.entries()).filter(([uid]) => unitMap.has(uid));
        pausedUnits.clear();
        entries.forEach(([uid, qty]) => setActiveUnitQty(uid, qty));
        commitNexusStateChange();
    }

    function restoreAllCompletedUnits() {
        if (completedTargets.size === 0) return;
        const entries = Array.from(completedTargets.keys());
        let changed = false;
        entries.forEach(uid => { if (restoreCompletedTarget(uid)) changed = true; });
        if (!changed) return;
        commitNexusStateChange();
    }

    function getCartTabDefinitions() {
        return [
            { key: 'active', label: '선택', count: activeUnits.size, countClass: '' },
            { key: 'paused', label: '보류', count: pausedUnits.size, countClass: 'paused' },
            { key: 'done', label: '완료', count: completedTargets.size, countClass: 'done' }
        ];
    }

    function getCurrentCartUnitMap() {
        if (_cartTab === 'paused') return pausedUnits;
        if (_cartTab === 'done') return completedTargets;
        return activeUnits;
    }

    function getCartEssenceTotals(sourceMap) {
        const totals = { coral: 0, aiur: 0, zerus: 0 };
        sourceMap?.forEach((rawQty, uid) => {
            const unit = unitMap.get(uid);
            if (!unit) return;
            const qty = Math.max(1, parseInt(rawQty, 10) || 1);
            getUnitEssenceParts(unit).forEach(([partId, , value]) => {
                if (Object.prototype.hasOwnProperty.call(totals, partId)) totals[partId] += value * qty;
            });
        });
        return totals;
    }

    function renderCartEssenceSummary() {
        const summaryEl = getEl('cartEssenceSummary');
        if (!summaryEl) return;
        const totals = getCartEssenceTotals(getCurrentCartUnitMap());
        const parts = [
            ['coral', '코랄', totals.coral],
            ['aiur', '아이어', totals.aiur],
            ['zerus', '제루스', totals.zerus]
        ];
        summaryEl.innerHTML = `<div class="cart-essence-title"><span>정수 합계</span></div><div class="cart-essence-chips">${parts.map(([id, name, value]) => `<span class="cart-essence-chip cart-essence-${id}"><span class="cart-essence-label">${name}</span><span class="cart-essence-value">${value}</span></span>`).join('')}</div>`;
    }

    function renderCartPanel(tabBarId, listAreaId, prefix) {
        const cartListArea = getEl(listAreaId); if (!cartListArea) return;
        const tabBar = getEl(tabBarId);
        if (tabBar) {
            tabBar.innerHTML = getCartTabDefinitions().map(tab => `<button type="button" class="cart-tab-btn ${_cartTab === tab.key ? 'active' : ''}" data-action="switchCartTab" data-tab="${tab.key}">${tab.label} <span class="cart-tab-cnt ${tab.countClass}">${tab.count}</span></button>`).join('');
        }

        if (_cartTab === 'active') {
            const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn" data-action="pauseAllActiveUnits" ${activeUnits.size === 0 ? 'disabled' : ''}>전체 보류</button><button type="button" class="cart-tab-action-btn" data-action="clearCartItems" ${activeUnits.size === 0 ? 'disabled' : ''}>전체 제거</button></div>`;
            if (activeUnits.size === 0) {
                const subText = pausedUnits.size > 0 ? '보류 탭에서 복구하면 다시 계산에 포함됩니다.' : '목표 유닛을 선택하면 여기에 표시됩니다.';
                cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">선택된 유닛이 없습니다.<br><span class="cart-empty-sub">${subText}</span></div>`;
                return;
            }
            const items = getUnitsFromMap(activeUnits);
            cartListArea.innerHTML = actionHtml + items.map(item => {
                const qty = activeUnits.get(item.id) || 1;
                const qtyHtml = !isOneTime(item) ? `<div class="cart-item-stepper"><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="-1">-</button><span class="ci-val" id="${prefix}-val-${item.id}">${qty}</span><button type="button" data-action="smartChange" data-uid="${item.id}" data-delta="1">+</button></div>` : `<span class="ci-onetime">×${qty}</span>`;
                return `<div class="cart-item" id="${prefix}-${item.id}"><div class="cart-unit-info"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name" ${getUnitNameStyle(item)}>${item.name}</span></div>${qtyHtml}<button type="button" class="cart-item-pause-btn" data-action="pauseCartItem" data-uid="${item.id}">보류</button><button type="button" class="cart-item-del" data-action="removeActiveUnit" data-uid="${item.id}">제거</button></div>`;
            }).join('');
            return;
        }

        if (_cartTab === 'paused') {
            const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn" data-action="restoreAllPausedUnits" ${pausedUnits.size === 0 ? 'disabled' : ''}>보류 복구</button><button type="button" class="cart-tab-action-btn" data-action="clearCartItems" ${pausedUnits.size === 0 ? 'disabled' : ''}>전체 제거</button></div>`;
            if (pausedUnits.size === 0) {
                cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">보류된 유닛이 없습니다.<br><span class="cart-empty-sub">선택 탭의 보류 버튼을 누르면 이곳으로 이동됩니다.</span></div>`;
                return;
            }
            cartListArea.innerHTML = actionHtml + getUnitsFromMap(pausedUnits).map(item => `<div class="cart-item cart-item-paused" id="${prefix}p-${item.id}"><div class="cart-unit-info"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name" ${getUnitNameStyle(item)}>${item.name}</span></div>${!isOneTime(item) ? `<span class="ci-onetime">×${pausedUnits.get(item.id) || 1}</span>` : ''}<button type="button" class="cart-done-restore-hint" data-action="restorePausedUnit" data-uid="${item.id}">복구</button><button type="button" class="cart-item-del" data-action="removePausedUnit" data-uid="${item.id}">제거</button></div>`).join('');
            return;
        }

        const actionHtml = `<div class="cart-tab-action-row"><button type="button" class="cart-tab-action-btn" data-action="restoreAllCompletedUnits" ${completedTargets.size === 0 ? 'disabled' : ''}>완료 복구</button><button type="button" class="cart-tab-action-btn" data-action="clearCartItems" ${completedTargets.size === 0 ? 'disabled' : ''}>전체 제거</button></div>`;
        if (completedTargets.size === 0) {
            cartListArea.innerHTML = `${actionHtml}<div class="cart-empty-msg">완료된 유닛이 없습니다.<br><span class="cart-empty-sub">목표 완료 시 이곳으로 이동됩니다.</span></div>`;
            return;
        }
        cartListArea.innerHTML = actionHtml + getUnitsFromMap(completedTargets).map(item => `<div class="cart-item cart-item-done" id="${prefix}d-${item.id}"><div class="cart-unit-info"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name done-name" ${getUnitNameStyle(item)}>${item.name}</span></div><span class="ci-onetime">×${completedTargets.get(item.id) || 1}</span><button type="button" class="cart-done-restore-hint" data-action="restoreUnit" data-uid="${item.id}">복구</button><button type="button" class="cart-item-del" data-action="removeCompletedUnit" data-uid="${item.id}">제거</button></div>`).join('');
    }

    function updateCartUI() {
        renderCartEssenceSummary();
        renderCartPanel('cartTabBar', 'cartListArea', 'ci');
    }

    /* ==========================================================================
       12. 유닛족보·화면 전환·보드 조정
       ========================================================================== */

    /* 유닛 족보: 최종 목표의 원본 조합식으로부터 분기별 재료 경로를 구성한다. */
    let genealogySelectedTargetId = '';

    function getGenealogyTargets() {
        const used = new Set();
        unitMap.forEach(unit => unit.parsedRecipe.forEach(part => used.add(part.id)));
        const excluded = getUserConfigIds(USER_CONFIG["족보 제외 목표"] || ['유물']);
        const presetOrder = [...finalGoalPresetIds];
        const ranks = { '슈퍼히든': 0, '고유히든': 1, '히든': 2 };
        return [...unitMap.values()]
            .filter(unit => Object.hasOwn(ranks, unit.grade) && !used.has(unit.id) && !excluded.has(unit.id))
            .sort((a, b) => ranks[a.grade] - ranks[b.grade] ||
                (presetOrder.indexOf(a.id) < 0 ? Infinity : presetOrder.indexOf(a.id)) -
                (presetOrder.indexOf(b.id) < 0 ? Infinity : presetOrder.indexOf(b.id)) ||
                a.name.localeCompare(b.name, 'ko'));
    }

    function buildGenealogyTree(targetId) {
        const types = new Set();
        let maximumDepth = 0;
        function branch(id, required, part = null, parentId = '', ancestors = new Set(), depth = 0) {
            const unit = unitMap.get(id), tool = !!(parentId && isToolRequirement(parentId, id));
            const qty = tool ? 1 : required;
            const cycle = ancestors.has(id);
            types.add(id);
            maximumDepth = Math.max(maximumDepth, depth);
            const terminal = !unit || cycle || isConditionOnlyRecipe(unit) || !unit.parsedRecipe.length;
            const nextAncestors = new Set(ancestors);
            nextAncestors.add(id);
            const children = terminal ? [] : unit.parsedRecipe.map(child =>
                branch(child.id, qty * child.qty, child, id, nextAncestors, depth + 1));
            return { id, unit, qty, tool, parentId, part, cycle, depth, children };
        }
        const root = branch(targetId, 1);
        return { root, typeCount: types.size, maximumDepth };
    }

    function renderGenealogyTreeNode(node) {
        const unit = node.unit, hasChildren = node.children.length > 0;
        const grade = unit?.grade || '재료';
        const identity = `<span class="gtag grade-${escapeHtml(grade)}">${escapeHtml(grade)}</span><span class="genealogy-tree-name" ${getUnitNameStyle(unit)}>${escapeHtml(unit?.name || node.id)}</span>`;
        const info = [
            !node.tool && node.part?.cond ? formatConditionText(node.part.cond) : '',
            CLEAN_UNIT_CONDITIONS[node.id] || '',
            CLEAN_SPECIAL_CONDITIONS[node.id] ? '특수 조건' : '',
            node.cycle ? '순환 데이터 · 경로 탐색 중지' : '',
            unit && isConditionOnlyRecipe(unit) ? '특수 조건형 유닛 · 별도 제작 재료 없음' : ''
        ].filter(Boolean);
        const notes = info.map(value => `<span class="genealogy-tree-condition">${escapeHtml(value)}</span>`).join('');
        // 도구 유닛은 일반 소모 재료가 아니므로 해당 조합 가지 안에서만 용도를 밝힌다.
        const toolReason = node.tool ? (CLEAN_UNIT_CONDITIONS[node.parentId]?.replace(/\s*\[도구\]/g, '') ||
            (node.part?.cond ? formatConditionText(node.part.cond) : `${unitMap.get(node.parentId)?.name || '상위 유닛'} 조합용`)) : '';
        const toolNote = node.tool ? `<span class="genealogy-tree-tool-note"><strong>보조 도구</strong><span>${escapeHtml(toolReason)}</span><small>1기 보유 · 비소모</small></span>` : '';
        const header = `<span class="genealogy-tree-heading">${identity}${node.depth ? `<strong class="genealogy-tree-qty">×${node.qty}</strong>` : ''}</span>${notes || toolNote ? `<span class="genealogy-tree-notes">${notes}${toolNote}</span>` : ''}`;
        const attrs = `data-genealogy-id="${escapeHtml(node.id)}" data-genealogy-depth="${node.depth}"`;
        if (!hasChildren) return `<li class="genealogy-tree-entry" ${attrs}><div class="genealogy-tree-leaf">${header}</div></li>`;
        return `<li class="genealogy-tree-entry" ${attrs}><details class="genealogy-tree-node"${node.depth === 0 ? ' open' : ''}><summary>${header}</summary><ul class="genealogy-tree-children">${node.children.map(child => renderGenealogyTreeNode(child)).join('')}</ul></details></li>`;
    }

    function renderGenealogyCosts(target, tree) {
        // 매직 원가는 기존 계산을 유지하고, 공허 포격기는 레시피 경로에서 별도 집계한다.
        const totals = calculateCostboardAtomTotals(new Map(), SYSTEM_CONFIG.costboardAtoms, {
            activeSource: new Map([[target.id, 1]]), preferRecipeAtoms: false
        }).targetMap;
        const countVoid = (node) => (node.id === VOID_RAY_ID && !node.tool ? node.qty : 0) +
            node.children.reduce((sum, child) => sum + countVoid(child), 0);
        totals[VOID_RAY_ATOM] = countVoid(tree.root);
        const slots = COSTBOARD_DISPLAY_SLOT_DEFS.map(slot => {
            const atoms = slot.atoms;
            const active = atoms.some(atom => totals[atom] > 0);
            const classes = `costboard-slot ${getCostboardSlotToneClass(atoms)}${active ? ' active' : ''}`;
            if (atoms.length === 1) {
                const atom = atoms[0], qty = totals[atom] || 0;
                return `<div class="${classes}"><div class="costboard-val">${qty || ''}</div><div class="costboard-name">${escapeHtml(getCostboardDisplayName(atom))}</div></div>`;
            }
            return `<div class="${classes} is-split-slot">${atoms.map(atom => {
                const qty = totals[atom] || 0;
                return `<div class="costboard-split-item${qty ? ' active' : ''}"><div class="costboard-val">${qty || ''}</div><div class="costboard-name">${escapeHtml(getCostboardDisplayName(atom))}</div></div>`;
            }).join('<div class="costboard-split-divider" aria-hidden="true"></div>')}</div>`;
        });
        while (slots.length < 25) slots.push('<div class="costboard-slot genealogy-cost-spacer" aria-hidden="true"></div>');
        return `<section class="genealogy-cost"><h4>필요 재료</h4><div class="genealogy-cost-grid costboard-grid">${slots.join('')}</div></section>`;
    }

    function renderGenealogyConditions(target) {
        if (!target.parsedRecipe.length || isConditionOnlyRecipe(target)) return '';
        const rows = target.parsedRecipe.map(part => {
            const unit = unitMap.get(part.id), qty = isToolRequirement(target.id, part.id) ? 1 : part.qty;
            const conditions = [part.cond ? formatConditionText(part.cond) : '', CLEAN_UNIT_CONDITIONS[part.id] || '', isToolRequirement(target.id, part.id) ? '도구 · 미소모' : ''].filter(Boolean);
            return `<button type="button" class="genealogy-condition-item" data-genealogy-jump="${escapeHtml(part.id)}" aria-label="${escapeHtml(unit?.name || part.id)} 족보 위치로 이동">
                <span class="gtag grade-${escapeHtml(unit?.grade || '재료')}">${escapeHtml(unit?.grade || '재료')}</span>
                <span class="genealogy-condition-main"><span class="genealogy-condition-name" ${getUnitNameStyle(unit)}>${escapeHtml(unit?.name || part.id)}</span>${conditions.length ? `<span class="genealogy-condition-detail">${escapeHtml(conditions.join(' · '))}</span>` : ''}</span>
                <strong class="genealogy-condition-qty">×${qty}</strong>
            </button>`;
        }).join('');
        return `<section class="genealogy-conditions uc-recipe-area" aria-label="조합 조건"><div class="genealogy-section-heading"><span class="recipe-label">조합 조건 <span class="genealogy-condition-count">${target.parsedRecipe.length}종</span></span><small>유닛명을 누르면 족보의 해당 경로로 이동합니다.</small></div><div class="genealogy-condition-list recipe-vertical">${rows}</div></section>`;
    }

    function renderGenealogy() {
        const graph = getEl('genealogyGraph'), info = getEl('genealogyInfo');
        const target = unitMap.get(genealogySelectedTargetId);
        if (!graph || !info) return;
        const hasTarget = Boolean(target);
        ['genealogyExpandAll', 'genealogyCollapseAll', 'genealogyGoBase', 'genealogyGoGoal'].forEach(id => {
            getEl(id).disabled = !hasTarget;
        });
        if (!hasTarget) {
            info.innerHTML = '<div class="genealogy-empty-state"><p>선택한 유닛이 없습니다.</p><span>왼쪽 최종 목표 목록에서 유닛을 선택하세요.</span></div>';
            graph.innerHTML = '<div class="genealogy-empty-state"><p>유닛 족보</p><span>유닛을 선택하면 조합 경로가 표시됩니다.</span></div>';
            return;
        }
        try {
            const tree = buildGenealogyTree(target.id);
            info.innerHTML = `<section class="genealogy-target-overview" data-grade="${escapeHtml(target.grade)}">
                <div class="genealogy-target-overview-top"><div class="genealogy-target-profile"><div class="uc-meta-row"><span class="gtag grade-${escapeHtml(target.grade)}">${escapeHtml(target.grade)}</span></div><h3 ${getUnitNameStyle(target)}>${escapeHtml(target.name)}</h3>${getUnitUnitboardEssenceText(target)}${getUnitCardNotesHtml(target)}<p>완성 1개 기준 · ${tree.typeCount}종 · 최대 ${tree.maximumDepth}단계${isOneTime(target) ? ' · 보유 제한 1개' : ''}</p>${renderGenealogyConditions(target)}</div>
                ${renderGenealogyCosts(target, tree)}</div></section>`;
            graph.innerHTML = `<div class="genealogy-tree-wrap"><ul class="genealogy-tree-root">${renderGenealogyTreeNode(tree.root)}</ul></div>`;
        } catch {
            info.innerHTML = '';
            graph.innerHTML = `<p class="genealogy-error">유닛 족보를 표시할 수 없습니다. 유닛 데이터를 확인해 주세요.</p>`;
        }
    }

    let genealogySetupComplete = false;
    let desktopBoardsPreviously = false;
    let invenboardTabNode = null, genealogyTabNode = null, genealogyPanelNode = null;
    const isDesktopBoardSupported = () => window.matchMedia('(min-width:1025px) and (min-aspect-ratio:11/10) and (hover:hover) and (pointer:fine)').matches
        && !document.documentElement.classList.contains('nexus-standalone-build');

    function syncDesktopBoardElements() {
        if (!isDesktopBoardSupported()) {
            if (_currentViewMode === 'genealogy' || _currentViewMode === 'invenboard') switchLayout('unitboard');
            invenboardTabNode?.remove();
            genealogyTabNode?.remove();
            genealogyPanelNode?.remove();
            const boardEl = getEl('boardContent');
            if (boardEl?.classList.contains('invenboard-mode')) {
                boardEl.replaceChildren();
                boardEl.classList.remove('invenboard-mode');
                _isInvenboardRendered = false;
            }
            return false;
        }
        if (!invenboardTabNode) invenboardTabNode = getEl('invenboardNavTemplate')?.content.firstElementChild.cloneNode(true);
        if (!genealogyTabNode) genealogyTabNode = getEl('genealogyNavTemplate')?.content.firstElementChild.cloneNode(true);
        if (!genealogyPanelNode) genealogyPanelNode = getEl('genealogyPanelTemplate')?.content.firstElementChild.cloneNode(true);
        if (invenboardTabNode && !invenboardTabNode.isConnected) getEl('btnViewHiddenboard')?.after(invenboardTabNode);
        if (genealogyTabNode && !genealogyTabNode.isConnected) invenboardTabNode?.after(genealogyTabNode);
        if (genealogyPanelNode && !genealogyPanelNode.isConnected) getEl('mainLayout')?.append(genealogyPanelNode);
        return true;
    }

    function setupGenealogy() {
        if (genealogySetupComplete || !isDesktopBoardSupported()) return;
        genealogySetupComplete = true;
        const targets = getGenealogyTargets();
        const list = getEl('genealogyTargetList');
        const filters = getEl('genealogyPanel').querySelector('.genealogy-grade-filters');
        const graph = getEl('genealogyGraph'), info = getEl('genealogyInfo'), scroll = getEl('genealogyScroll');
        const grades = ['슈퍼히든', '고유히든', '히든'];
        const races = ['테바', '테메', '토바', '토메', '저그중립', '혼종'];
        let gradeFilter = 'all';

        function renderTargetList() {
            const matches = targets.filter(unit => gradeFilter === 'all' || unit.grade === gradeFilter);
            getEl('genealogyTargetCount').textContent = `${matches.length}/${targets.length}종`;
            list.innerHTML = matches.length ? grades.map(grade => {
                const byGrade = races.flatMap(race => matches.filter(unit => unit.grade === grade && unit.category === race));
                if (!byGrade.length) return '';
                const heading = gradeFilter === 'all' ? `<h3 class="genealogy-list-grade">${grade} <span>${byGrade.length}종</span></h3>` : '';
                return `${heading}${byGrade.map(unit => `
                    <button type="button" class="genealogy-target-item" data-genealogy-target="${escapeHtml(unit.id)}" aria-pressed="${genealogySelectedTargetId === unit.id}">
                        <span class="gtag genealogy-race-badge">${escapeHtml(unit.category)}</span>
                        <span class="gtag grade-${escapeHtml(unit.grade)}">${escapeHtml(unit.grade)}</span>
                        <span class="genealogy-target-name" ${getUnitNameStyle(unit)}>${escapeHtml(unit.name)}</span>
                    </button>`).join('')}`;
            }).join('') : '<p class="genealogy-option-empty">조건에 맞는 유닛이 없습니다.</p>';
        }
        function chooseTarget(id) {
            if (!targets.some(unit => unit.id === id)) return;
            genealogySelectedTargetId = id;
            renderTargetList();
            renderGenealogy();
            scroll.scrollTop = 0;
            getEl('genealogyDetailScroll').scrollTop = 0;
        }
        genealogySelectedTargetId = ''; // 최초 진입 시 유닛 자동 선택 없음.
        renderTargetList();
        list.addEventListener('click', event => {
            const item = event.target.closest('[data-genealogy-target]');
            if (item) chooseTarget(item.dataset.genealogyTarget);
        });
        filters.addEventListener('click', event => {
            const button = event.target.closest('[data-genealogy-grade]');
            if (!button) return;
            gradeFilter = button.dataset.genealogyGrade;
            filters.querySelectorAll('[data-genealogy-grade]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
            renderTargetList();
        });
        info.addEventListener('click', event => {
            const button = event.target.closest('[data-genealogy-jump]');
            if (!button) return;
            const uid = button.dataset.genealogyJump;
            const entries = [...graph.querySelectorAll('.genealogy-tree-entry[data-genealogy-id]')];
            const entry = entries.find(item => item.dataset.genealogyId === uid);
            if (!entry) return;
            graph.querySelectorAll('.genealogy-tree-entry.is-genealogy-focus').forEach(item => item.classList.remove('is-genealogy-focus'));
            let ancestor = entry.parentElement.closest('.genealogy-tree-entry');
            while (ancestor) {
                const branch = ancestor.querySelector(':scope > .genealogy-tree-node');
                if (branch) branch.open = true;
                ancestor = ancestor.parentElement.closest('.genealogy-tree-entry');
            }
            const current = entry.querySelector(':scope > .genealogy-tree-node');
            if (current) current.open = true;
            entry.classList.add('is-genealogy-focus');
            const heading = entry.querySelector(':scope > .genealogy-tree-node > summary, :scope > .genealogy-tree-leaf');
            heading?.scrollIntoView({ block: 'center', behavior: 'instant' });
            heading?.focus?.({ preventScroll: true });
        });
        getEl('genealogyExpandAll').addEventListener('click', () => {
            graph.querySelectorAll('.genealogy-tree-node').forEach(node => { node.open = true; });
        });
        getEl('genealogyCollapseAll').addEventListener('click', () => {
            graph.querySelectorAll('.genealogy-tree-node').forEach(node => { node.open = false; });
        });
        function jumpToGenealogyEdge(towardBase) {
            if (towardBase) {
                graph.querySelectorAll('.genealogy-tree-node').forEach(node => { node.open = true; });
                scroll.scrollTop = scroll.scrollHeight;
            } else {
                scroll.scrollTop = 0;
            }
        }
        getEl('genealogyGoBase').addEventListener('click', () => jumpToGenealogyEdge(true));
        getEl('genealogyGoGoal').addEventListener('click', () => jumpToGenealogyEdge(false));
    }





    const getNexusVersion = () => window.APP_VERSION || window.NEXUS_BUILD_VERSION || '';
    const NEXUS_TITLE_TEXT = Object.freeze({
        main: { value: '개복디 넥서스' },
        creator: { label: '제작자', value: '회장 | 3-S2-1-2461127' }
    });
    const getNexusTitleViewMeta = mode => {
        if (mode === 'version') {
            return { label: '버전정보', value: getNexusVersion() };
        }
        return NEXUS_TITLE_TEXT[mode] || NEXUS_TITLE_TEXT.main;
    };
    const buildNexusTitleHtml = (mode, { label, value }) => {
        if (mode === 'main') {
            return `<span class="gh-title-mainline">${escapeHtml(value)}</span>`;
        }
        return `<span class="gh-title-stack">
            <span class="gh-title-label">${escapeHtml(label)}</span>
            <span class="gh-title-main">${escapeHtml(value)}</span>
        </span>`;
    };
    const clearNexusTitleRotationTimers = () => {
        clearTimeout(_titleRotationTimer);
        clearTimeout(_titleTransitionTimer);
        _titleRotationTimer = null;
        _titleTransitionTimer = null;
    };
    const renderNexusTitleView = mode => {
        const title = getEl('ghTitleText');
        if (!title) return;
        const meta = getNexusTitleViewMeta(mode);
        const text = meta.label ? `${meta.label} ${meta.value}` : meta.value;
        title.dataset.titleView = mode;
        title.classList.toggle('is-version-view', mode === 'version');
        title.innerHTML = buildNexusTitleHtml(mode, meta);
        title.setAttribute('aria-label', `${text} · 앱 버전 보기`);
    };
    const scheduleNexusTitleRotation = mode => {
        const delay = mode === 'creator' ? APP_INTERNAL.titleCreatorDisplayMs : APP_INTERNAL.titleMainDisplayMs;
        _titleRotationTimer = setTimeout(() => {
            const title = getEl('ghTitleText');
            if (!title) return;
            title.classList.add('is-transitioning');
            _titleTransitionTimer = setTimeout(() => {
                const nextMode = mode === 'creator' ? 'main' : 'creator';
                renderNexusTitleView(nextMode);
                title.classList.remove('is-transitioning');
                scheduleNexusTitleRotation(nextMode);
            }, APP_INTERNAL.titleTransitionMs);
        }, delay);
    };
    const restartNexusTitleRotation = () => {
        const title = getEl('ghTitleText');
        if (!title) return;
        clearNexusTitleRotationTimers();
        title.classList.remove('is-transitioning');
        renderNexusTitleView('main');
        scheduleNexusTitleRotation('main');
    };
    const showNexusAppVersion = () => {
        const title = getEl('ghTitleText');
        const version = getNexusVersion();
        if (!title || !version) return;
        clearNexusTitleRotationTimers();
        title.classList.remove('is-transitioning');
        renderNexusTitleView('version');
        clearTimeout(_titleVersionTimer);
        _titleVersionTimer = setTimeout(() => {
            _titleVersionTimer = null;
            restartNexusTitleRotation();
        }, APP_INTERNAL.appVersionDisplayMs);
    };
    function updateBoardHeader() {
        const hiddenboardActions = getEl('hiddenboardGlobalActions');
        if (hiddenboardActions) hiddenboardActions.hidden = _currentViewMode !== 'hiddenboard';
    }


    function updateBoardPanel(calcResult, invenboardTotals = null) {
        updateBoardHeader();
        let autoCompleted = false;
        if (_currentViewMode === 'invenboard') {
            if (!_isInvenboardRendered) renderInvenboard();
            if (!_isInvenboardRendered) return autoCompleted;
            if (completeInvenboardMaterialUnitsIfReady() || completeInvenboardTargetsIfReady()) {
                calcResult = calculateBoardRequirements();
                invenboardTotals = calculateInvenboardCostboardTotals();
                autoCompleted = true;
            }
            updateInvenboard(invenboardTotals || calculateInvenboardCostboardTotals());
            return autoCompleted;
        }
        if (_currentViewMode === 'hiddenboard') {
            if (!_isHiddenboardRendered) renderHiddenboard();
            if (!_isHiddenboardRendered) return autoCompleted;
            if (completeHiddenboardRecipeUnitsIfReady()) {
                calcResult = calculateBoardRequirements();
                autoCompleted = true;
            }
            updateHiddenboard(calcResult || _lastCalcResult || calculateBoardRequirements());
            updateEmptyMsg();
            return autoCompleted;
        }
        return autoCompleted;
    }

    function refreshPanelsAfterBoardAutoComplete() {
        const calcResult = calculateBoardRequirements();
        _lastCalcResult = calcResult;
        updateCostboard(calculateCostboardAtomTotals());
        updateTabsUI();
        updateTabContentUI();
        updateCartUI();
        updatePresetBtns();
        saveNexusState();
    }

    function ensureActiveBoardRendered(calcResult) {
        return updateBoardPanel(calcResult || _lastCalcResult || calculateBoardRequirements());
    }

    function updateEmptyMsg() {
        const msg = getEl('hiddenboard-empty-msg');
        if (!msg) return;
        const isEmpty = activeUnits.size === 0 && completedTargets.size === 0;
        if (isEmpty) {
            msg.style.display = 'block';
            msg.innerHTML = `<div class="empty-msg-enhanced"><div class="empty-main">유닛도감에서 유닛을 선택하세요</div></div>`;
        } else {
            msg.style.display = 'none';
        }
    }

    function updateHideCompletedBtn() {
        const btn = getEl('btnHideCompleted'), label = getEl('btnHideCompletedLabel');
        if (!btn || !label) return;
        label.textContent = '완료 숨기기';
        const state = getEl('btnHideCompletedState');
        if (state) state.textContent = _hideCompleted ? 'ON' : 'OFF';
        btn.setAttribute('aria-pressed', String(_hideCompleted));
        btn.title = _hideCompleted ? '완료된 재료를 숨기고 있습니다 · 누르면 표시' : '완료된 재료를 표시하고 있습니다 · 누르면 숨김';
        btn.classList.toggle('hide-completed-active', _hideCompleted);
    }

    function toggleHighlight(uid, event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const board = getEl('boardContent'); if (!board) return;

        if (!uid || _currentHighlight === uid) {
            _currentHighlight = null;
            board.classList.remove('highlight-mode');
        } else {
            if (!_currentHighlight) {
                // 추적 종료 시 사용자가 접어둔 카테고리 상태를 되돌립니다.
                _highlightGroupState = new Map(Array.from(board.querySelectorAll('.hiddenboard-group'), grp => [
                    grp.id, {
                        collapsed: grp.classList.contains('collapsed'),
                        gridDisplay: grp.querySelector('.hiddenboard-grid')?.style.display || ''
                    }
                ]));
            }
            _currentHighlight = uid;
            board.classList.add('highlight-mode');
        }
        
        debouncedUpdateAllPanels();
    }

    /* 화면 전환 */
    function setupInitialView() {
        desktopBoardsPreviously = syncDesktopBoardElements();
        if (desktopBoardsPreviously) setupGenealogy();
        switchLayout('unitboard');
    }

    function switchLayout(mode) {
        hideRecipeTooltip();
        const layout = getEl('mainLayout');
        if (!layout) return;
        const nextMode = (mode === 'genealogy' || mode === 'invenboard') && !isDesktopBoardSupported()
            ? 'unitboard'
            : ['unitboard', 'hiddenboard', 'invenboard', 'genealogy'].includes(mode) ? mode : 'unitboard';
        _currentViewMode = nextMode;
        const viewMeta = {
            unitboard: ['유닛도감', 'UNIT ARCHIVE', '목표를 고르세요. 완성까지 필요한 모든 조합을 연결합니다.'],
            hiddenboard: ['히든보드', 'COMBINATION BOARD', '목표부터 기본 재료까지, 조합의 흐름을 한눈에 확인하세요.'],
            invenboard: ['재료 보드', 'MATERIAL INVENTORY', '보유 재료와 완성 진행도를 관리합니다.'],
            genealogy: ['유닛 족보', 'UNIT GENEALOGY', '최종 목표 1개에서 기초 재료까지 조합 경로를 추적합니다.']
        }[nextMode];
        const title = getEl('workspaceTitle'), breadcrumb = getEl('workspaceBreadcrumb'), description = getEl('workspaceDescription');
        if (title) title.innerHTML = `${viewMeta[0]}<span class="heading-dot">.</span>`;
        if (breadcrumb) breadcrumb.textContent = viewMeta[1];
        if (description) description.textContent = viewMeta[2];
        layout.classList.remove('view-unitboard', 'view-hiddenboard', 'view-invenboard', 'view-genealogy');
        const genealogyPanel = getEl('genealogyPanel');
        if (genealogyPanel) genealogyPanel.hidden = nextMode !== 'genealogy';
        layout.classList.add(`view-${nextMode}`);

        const buttons = {
            unitboard: getEl('btnViewUnitboard'),
            hiddenboard: getEl('btnViewHiddenboard'),
            invenboard: getEl('btnViewInvenboard'),
            genealogy: getEl('btnViewGenealogy')
        };
        Object.entries(buttons).forEach(([key, btn]) => {
            if (!btn) return;
            btn.classList.toggle('active', key === nextMode);
            if (key === nextMode) btn.setAttribute('aria-current', 'page');
            else btn.removeAttribute('aria-current');
        });

        if (nextMode === 'genealogy') renderGenealogy();
        const autoCompleted = (nextMode === 'hiddenboard' || nextMode === 'invenboard')
            ? ensureActiveBoardRendered(_lastCalcResult)
            : false;
        updateBoardHeader();
        if (autoCompleted) refreshPanelsAfterBoardAutoComplete();
    }

    /* ==========================================================================
       13. 이벤트·입력·반응형
       ========================================================================== */

    function startSmartChange(id, delta, event) {
        if (event) {
            if (event.type === 'touchstart' || event.type === 'pointerdown') {
                _lastInteractionTime = Date.now();
            } else if (event.type === 'mousedown' && Date.now() - _lastInteractionTime < APP_INTERNAL.mouseAfterTouchDelay) {
                if (event.cancelable) event.preventDefault();
                event.stopPropagation?.();
                return;
            }
        }
        stopSmartChange();
        triggerHaptic();
        _touchHoldCount = 0;
        const runSmartStep = () => {
            const multiplier = event?.shiftKey ? APP_INTERNAL.accelShiftMultiplier : Math.floor(++_touchHoldCount / APP_INTERNAL.accelStepUnit) + 1;
            const accelDelta = delta * multiplier;
            const current = activeUnits.get(id) || 0;
            if (current === 0 && accelDelta > 0) toggleUnitSelection(id, accelDelta);
            else setUnitQty(id, current + accelDelta);
        };
        const scheduleSmartRepeat = () => {
            triggerHaptic();
            runSmartStep();
            _currentAccelInterval = Math.max(APP_INTERNAL.accelMinInterval, _currentAccelInterval - APP_INTERNAL.accelDecreaseStep);
            repeatTimer = setTimeout(scheduleSmartRepeat, _currentAccelInterval);
        };
        runSmartStep();
        _currentAccelInterval = APP_INTERNAL.accelInterval;
        repeatDelayTimer = setTimeout(scheduleSmartRepeat, APP_INTERNAL.holdStartDelay);
    }

    function stopSmartChange() {
        clearTimeout(repeatDelayTimer);
        clearTimeout(repeatTimer);
        repeatDelayTimer = null;
        repeatTimer = null;
        _touchHoldCount = 0;
    }

    function startFontHold(delta) {
        stopFontHold();
        const action = () => setFontScale(_fontScale + delta);
        action();
        _fontRepeatDelayTimer = setTimeout(() => {
            const loop = () => { action(); _fontRepeatTimer = setTimeout(loop, APP_INTERNAL.fontHoldRepeatDelay); };
            loop();
        }, APP_INTERNAL.fontHoldStartDelay);
    }

    function stopFontHold() {
        clearTimeout(_fontRepeatDelayTimer);
        clearTimeout(_fontRepeatTimer);
        _fontRepeatDelayTimer = null;
        _fontRepeatTimer = null;
    }

    function setFontScale(scale) {
        if (!Number.isFinite(scale)) return;
        _fontScale = Math.max(APP_INTERNAL.fontScaleMin, Math.min(APP_INTERNAL.fontScaleMax, scale));
        document.documentElement.style.setProperty('--fs-scale', _fontScale);
        const label = getEl('fontSizeLabel');
        if (label) label.innerText = `${Math.round(_fontScale * 100)}%`;
        try { localStorage.setItem(SYSTEM_CONFIG.storageKeys.fontScale, String(_fontScale)); } catch {}
    }

    function loadFontScale() {
        try { const saved = localStorage.getItem(SYSTEM_CONFIG.storageKeys.fontScale); if (saved) setFontScale(parseFloat(saved)); } catch {}
    }

    function closeFontSizePopup(restoreFocus = false) {
        const popup = getEl('fontSizePopup');
        if (!popup || popup.hidden) return;
        popup.hidden = true;
        getEl('btnFontSizePopup')?.setAttribute('aria-expanded', 'false');
        if (restoreFocus) getEl('btnFontSizePopup')?.focus();
    }

    function toggleFontSizePopup() {
        const popup = getEl('fontSizePopup');
        const trigger = getEl('btnFontSizePopup');
        if (!popup || !trigger) return;
        popup.hidden = !popup.hidden;
        trigger.setAttribute('aria-expanded', String(!popup.hidden));
    }

    function hideRecipeTooltip() {
        const tt = getEl('recipeTooltip');
        tt?.classList.remove('active');
    }

    /* 이벤트 바인딩 */
    ['pointerup','pointercancel','touchend','touchcancel','mouseup','contextmenu'].forEach(evt => { document.addEventListener(evt, stopSmartChange); document.addEventListener(evt, stopFontHold); });
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopSmartChange();
            stopFontHold();
        }
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.gh-fontsize-ctrl')) closeFontSizePopup();
        const pointerCardUid = _smartChangePointerCardUid;
        _smartChangePointerCardUid = null;
        const card = e.target.closest('.unit-card[data-action="toggleUnit"]');
        if ((pointerCardUid && card?.dataset.uid === pointerCardUid) || e.target.closest('.unit-card .uc-ctrl-area')) return;
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) {
            const invenInput = e.target?.closest?.('.invenboard-input[data-inven-id]');
            if (invenInput && !invenInput.readOnly && !invenInput.disabled) invenInput.select();
            if (_currentHighlight) toggleHighlight(null);
            if (getEl('recipeTooltip')?.classList.contains('active') && !e.target.closest('#recipeTooltip')) hideRecipeTooltip();
            return;
        }

        const action = actionEl.dataset.action, uid = actionEl.dataset.uid;
        switch (action) {
            case 'switchMainView': switchLayout(actionEl.dataset.view); break;
            case 'invenboardAdd':
                    if (_invenboardInputMode === 'manual' && e.target?.closest?.('.invenboard-input')) break;
                    e.stopPropagation(); changeInvenboardAmount(actionEl.dataset.invenId, parseInt(actionEl.dataset.delta || '1', 10)); break;
            case 'toggleInvenboardInputMode': e.stopPropagation(); toggleInvenboardInputMode(); break;
            case 'resetInvenboardAmounts': e.stopPropagation(); resetInvenboardAmounts(); break;
            case 'completeAllInvenboardUnits': e.stopPropagation(); completeAllInvenboardUnits(); break;
            case 'toggleInvenboardSlotMode': e.stopPropagation(); toggleInvenboardSlotMode(); break;
            case 'runPreset':
                const idx = parseInt(actionEl.dataset.presetIdx, 10), preset = PRESETS[idx];
                if (preset && !_presetUsed.get(idx)) {
                    processCommand(preset.command, true, preset.preventStack === true);
                    if (isFinalGoalPreset(preset) && applyFinalGoalPresetTopLevelFilter()) debouncedUpdateAllPanels();
                    _presetUsed.set(idx, true);
                    updatePresetBtns();
                }
                break;
            case 'showAppVersion': showNexusAppVersion(); break;
            case 'openBuildIndependentWindow': openBuildIndependentWindow(); break;
            case 'closeBuildStandaloneWindow': window.close(); break;
            case 'toggleFontSizePopup': toggleFontSizePopup(); break;
            case 'increaseFont': if (e.detail === 0) setFontScale(_fontScale + APP_INTERNAL.fontScaleStep); break;
            case 'decreaseFont': if (e.detail === 0) setFontScale(_fontScale - APP_INTERNAL.fontScaleStep); break;
            case 'switchPresetTab': _presetTab = actionEl.dataset.tab; renderPresetButtons(); break;
            case 'toggleHideCompleted':
                _hideCompleted = !_hideCompleted;
                updateHideCompletedBtn();
                debouncedUpdateAllPanels();
                break;
            case 'restoreAllCompleted': restoreAllCompleted(); break;
            case 'resetUnitboard': resetUnitboard(); break;
            case 'selectTab': selectTab(parseInt(actionEl.dataset.tabIdx, 10)); break;
            case 'showUnitCollection':
                hideRecipeTooltip();
                _unitboardCollection = actionEl.dataset.collection === 'favorites' ? 'favorites' : null;
                updateTabsUI();
                renderCurrentTabContent();
                break;
            case 'toggleSelectAllTab': toggleSelectAllTab(); break;
            case 'pauseCartItem': e.stopPropagation(); if (uid) pauseCartUnit(uid); break;
            case 'removeActiveUnit': e.stopPropagation(); if (uid) discardActiveCartUnit(uid); break;
            case 'removePausedUnit': e.stopPropagation(); if (uid) discardPausedCartUnit(uid); break;
            case 'removeCompletedUnit': e.stopPropagation(); if (uid) discardCompletedCartUnit(uid); break;
            case 'pauseAllActiveUnits': e.stopPropagation(); pauseAllActiveUnits(); break;
            case 'restoreAllPausedUnits': e.stopPropagation(); restoreAllPausedUnits(); break;
            case 'restoreAllCompletedUnits': e.stopPropagation(); restoreAllCompletedUnits(); break;
            case 'clearCartItems': e.stopPropagation(); clearCartItems(); break;
            case 'toggleFavorite': toggleFavorite(uid, e); break;
            case 'smartChange':
                // 포인터는 누르고 있기 동작을 사용하고, 키보드 클릭은 한 번만 변경합니다.
                if (e.detail === 0) { startSmartChange(uid, parseInt(actionEl.dataset.delta, 10), e); stopSmartChange(); }
                break;
            case 'toggleUnit': toggleUnitSelection(uid, 1); break;
            case 'toggleHighlight': toggleHighlight(uid, e); break;
            case 'switchHiddenboardDetail': e.stopPropagation(); switchHiddenboardDetail(uid, actionEl.dataset.detailView); break;
            case 'toggleGroup':
                const grp = actionEl.closest('.hiddenboard-group'), gridEl = getEl(actionEl.dataset.gridId), icon = actionEl.querySelector('.grp-toggle-icon');
                if (grp) {
                    if (grp.classList.contains('collapsed') || (gridEl && gridEl.style.display === 'none')) { grp.classList.remove('collapsed'); if (gridEl) gridEl.style.display = 'grid'; if (icon) icon.style.transform = 'rotate(0deg)'; }
                    else { grp.classList.add('collapsed'); if (gridEl) gridEl.style.display = 'none'; if (icon) icon.style.transform = 'rotate(-90deg)'; }
                }
                break;
            case 'addComplete': e.stopPropagation(); completeUnit(uid, parseInt(actionEl.dataset.batch || 1, 10)); break;
            case 'completeUnit': e.stopPropagation(); completeUnit(uid); break;
            case 'switchCartTab': setCartTab(actionEl.dataset.tab || 'active'); updateCartUI(); break;
            case 'restoreUnit': e.stopPropagation(); restoreUnit(uid); break;
            case 'restorePausedUnit': e.stopPropagation(); restorePausedUnit(uid); break;
            case 'resetGroup': e.stopPropagation(); resetGroupCompleted(parseInt(actionEl.dataset.level, 10)); break;
            case 'hideRecipeTooltip': e.stopPropagation(); hideRecipeTooltip(); break;
        }
    });

    document.addEventListener('input', e => {
        const input = e.target?.closest?.('.invenboard-input[data-inven-id]');
        if (!input || _invenboardInputMode !== 'manual') return;
        setInvenboardAmount(input.dataset.invenId, input.value, { preserveOverflow: true });
    });
    document.addEventListener('focusin', e => {
        const input = e.target?.closest?.('.invenboard-input[data-inven-id]');
        if (input && !input.readOnly && !input.disabled) setTimeout(() => input.select(), 0);
    });

    document.addEventListener('pointerdown', e => {
        _smartChangePointerCardUid = null;
        const actionEl = e.target.closest('[data-action="smartChange"]');
        if (actionEl) {
            _smartChangePointerCardUid = actionEl.closest('.unit-card')?.dataset.uid || null;
            e.stopPropagation();
            startSmartChange(actionEl.dataset.uid, parseInt(actionEl.dataset.delta, 10), e);
            return;
        }
        if (e.target.closest('[data-action="increaseFont"]')) { e.preventDefault(); startFontHold(APP_INTERNAL.fontScaleStep); return; }
        if (e.target.closest('[data-action="decreaseFont"]')) { e.preventDefault(); startFontHold(-(APP_INTERNAL.fontScaleStep)); return; }
    });
    document.addEventListener('keydown', e => {
        if (e.target?.matches?.('#unitboardTabs [role="tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const tabs = Array.from(getEl('unitboardTabs').querySelectorAll('[role="tab"]'));
            const index = tabs.indexOf(e.target);
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            tabs[next].click();
            tabs[next].focus({ preventScroll: true });
            return;
        }
        if ((e.key === 'Enter' || e.key === ' ') && e.target?.matches?.('.unit-card[data-action="toggleUnit"]')) {
            e.preventDefault();
            toggleUnitSelection(e.target.dataset.uid, 1);
            return;
        }
        if ((e.key === 'Enter' || e.key === ' ') && e.target?.closest?.('[data-action="showAppVersion"]')) {
            e.preventDefault();
            e.target.closest('[data-action="showAppVersion"]').click();
            return;
        }
        if (e.key === 'Escape') {
            closeFontSizePopup(true);
            if (_currentHighlight) toggleHighlight(null);
            hideRecipeTooltip();
            const searchInp = getEl('unitSearchInput');
            if (document.activeElement === searchInp) searchInp?.blur();
        }
    });
    function updatePivotColumns() {
        const { width, height } = window.screen;
        const pixelRatio = window.devicePixelRatio || 1;
        const isPortraitDesktop = width < height && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
        const pixelWidth = width * pixelRatio;
        const pixelHeight = height * pixelRatio;
        const columns = isPortraitDesktop && pixelWidth >= 2159 && pixelHeight >= 3839 ? '4'
            : isPortraitDesktop && pixelWidth >= 1439 && pixelHeight >= 2559 ? '3' : '';
        document.documentElement.dataset.pivotColumns = columns;
    }
    const handleViewportChange = () => {
        const desktop = syncDesktopBoardElements();
        if (desktop !== desktopBoardsPreviously) {
            desktopBoardsPreviously = desktop;
            if (desktop) setupGenealogy();
        }
        updatePivotColumns();
        hideRecipeTooltip();
        closeFontSizePopup();
        placeHiddenboardControls();
        updateBoardHeader();
    };
    window.addEventListener('orientationchange', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('focus', updateBuildWindowButton);
    window.addEventListener('focus', updatePivotColumns);

    /* 화면 스와이프 이벤트 */
    function bindSwipeEvents() {
        const sArea = getEl('tabContent');
        if (sArea) {
            let sX = 0, sY = 0, sPager = null;
            const getSwipePager = target => {
                const favPager = target?.closest?.('.unitboard-fav-grid');
                if (favPager) return { el: favPager, type: 'favorite' };
                const categoryPager = target?.closest?.('.unitboard-category-grid');
                return categoryPager ? { el: categoryPager, type: 'category' } : null;
            };
            const canPagerMove = (pagerState, dX) => {
                const pager = pagerState?.el;
                if (!pager) return false;
                const max = Math.max(0, pager.scrollWidth - pager.clientWidth);
                if (max <= 2) return false;
                const start = Math.max(0, Math.min(pagerState.scrollLeft, max));
                if (dX < 0) return start < max - 2;
                if (dX > 0) return start > 2;
                return false;
            };
            sArea.addEventListener('touchstart', e => {
                const touch = e.changedTouches[0];
                sX = touch.screenX; sY = touch.screenY;
                const pager = getSwipePager(e.target);
                sPager = pager ? { ...pager, scrollLeft: pager.el.scrollLeft } : null;
            }, { passive: true });
            sArea.addEventListener('touchend', e => {
                if (_isSwiping || _unitboardCollection) return;
                let dX = e.changedTouches[0].screenX - sX, dY = e.changedTouches[0].screenY - sY;
                if (Math.abs(dX) > 70 && Math.abs(dY) < 50) {
                    if (sPager?.type === 'favorite') { sPager = null; return; }
                    if (sPager?.type === 'category' && canPagerMove(sPager, dX)) { sPager = null; return; }
                    _isSwiping = true;
                    if (dX > 0 && _activeTabIdx > 0) selectTab(_activeTabIdx - 1);
                    else if (dX < 0 && _activeTabIdx < SYSTEM_CONFIG.tabs.length - 1) selectTab(_activeTabIdx + 1);
                    if (_swipeTimer) clearTimeout(_swipeTimer);
                    _swipeTimer = setTimeout(() => _isSwiping = false, 300);
                }
                sPager = null;
            }, { passive: true });
        }
        const dBoard = getEl('colRightPanel');
        if (dBoard) {
            let dX0 = 0, dY0 = 0, dPager = false;
            dBoard.addEventListener('touchstart', e => {
                dX0 = e.changedTouches[0].screenX;
                dY0 = e.changedTouches[0].screenY;
                dPager = !!e.target?.closest?.('.hiddenboard-grid');
            }, { passive: true });
            dBoard.addEventListener('touchend', e => {
                const dx = e.changedTouches[0].screenX - dX0, dy = e.changedTouches[0].screenY - dY0;
                if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
                    if (dPager) { dPager = false; return; }
                    if (dx > 0) switchLayout('unitboard'); else switchLayout('hiddenboard');
                }
                dPager = false;
            }, { passive: true });
        }
    }

    /* ==========================================================================
       14. 앱 초기화
       ========================================================================== */

    /* 부팅 상태 전달 */
    const markNexusAppReady = () => {
        if (typeof window.nexusMarkAppReady === 'function') {
            window.nexusMarkAppReady();
            return;
        }
        try { document.documentElement.classList.remove('nexus-booting', 'nexus-boot-error'); } catch {}
    };
    const markNexusAppError = (code, error) => {
        if (typeof window.nexusShowBootError === 'function') {
            window.nexusShowBootError(code, error);
            return;
        }
        try { window.NEXUS_LAST_INIT_ERROR = { code, error, time: Date.now() }; } catch {}
        try { alert("초기화 중 치명적인 오류가 발생했습니다.\n\n" + (error?.stack || error)); } catch {}
    };
    /* 앱 초기화 */
    function startNexusApp(){
        try {
            document.documentElement.lang = 'ko';
            updatePivotColumns();
            if (typeof UNIT_DATABASE === 'undefined' || !Array.isArray(UNIT_DATABASE)) { markNexusAppError("N1003", new Error("UNIT_DATABASE load failed")); return; }
            UNIT_DATABASE.forEach(kArr => {
                const id = clean(kArr[0]);
                unitMap.set(id, { id, name: kArr[0], grade: kArr[1] || SYSTEM_CONFIG.grades.order[0], category: kArr[2] || SYSTEM_CONFIG.tabs[0].key, recipe: kArr[3], cost: kArr[4] });
            });
            pruneFavorites();

            initializeCacheEngine();
            initializeFinalGoalPresets();
            loadNexusState();
            loadFontScale();
            setupBuildStandaloneWindow();
            renderCostboardAtoms();
            renderTabs();
            selectTab(0);
            debouncedUpdateAllPanels();
            setupSearchEngine();
            setupInitialView();
            renderPresetButtons();
            restartNexusTitleRotation();
            updateHideCompletedBtn();
            requestAnimationFrame(() => {
                debouncedUpdateAllPanels();
            });
            bindSwipeEvents();
            markNexusAppReady();
        } catch (err) {
            markNexusAppError("N1001", err);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startNexusApp, { once: true });
    else startNexusApp();
})();
