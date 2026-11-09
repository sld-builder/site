/* 반응형 레이아웃
 * - 뷰포트 상태 클래스 관리
 * - 모바일/태블릿/세로 화면 전환 보조
 */
(() => {
  'use strict';
  const MODES=['is-pc-landscape','is-pc-portrait','is-tablet','is-mobile','is-portrait-view','is-mobile-device','is-tablet-device','is-narrow-mobile','is-tabbed'];
  // 독립 창은 자체 페이지이므로 원본 모바일 탭 재배치를 적용하지 않는다.
  if(window.DPS_STANDALONE_VIEW){
    const init=()=>{
      for(const el of [document.body,document.documentElement]){
        el.classList.remove(...MODES);
        el.classList.add('is-pc-landscape');
      }
      window.__dpsResponsiveLayoutReady=true;
      window.dpsMarkResponsiveLayoutReady?.();
    };
    window.dpsSyncResponsiveLayout=init;
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
    else init();
    return;
  }

  /* ── 01 · 반응형 상태·측정·복원 ── */
  /* 반응형 상태·측정 헬퍼 */
  const TABBED_PAGES = [
    { key: 'basic', label: '기본 정보', selectors: ['.col-left'] },
    { key: 'trait', label: '특성 관리', selectors: ['.trait-board-panel'] },
    { key: 'specUnit', label: '분석 보드', selectors: ['.stat-dps-card'] }
  ];
  const state = {
    tabs: null,
    pages: [],
    restore: new Map(),
    raf: 0,
    arrangedTabbed: false,
    layoutWidth: 0,
    layoutPortrait: null,
    activeIndex: 0,
    activeKey: null,
    resumeRaf: 0,
    initialized: false,
    traitScrollObserver: null,
    traitScrollRaf: 0,
    touchScrolling: false,
    viewportUpdatePending: false
  };
  /* 접힘 애니메이션·회전·제스처 후 변동된 특성 목록의 스크롤 경계를 보정한다.
   * 모바일/태블릿 특성 탭에만 적용하고 다른 페이지의 스크롤은 유지한다. */
  function clampTraitScroll() {
    if (!document.body.classList.contains('is-tabbed')) return;
    const page = state.pages.find(item => item.key === 'trait')?.el;
    if (!page || page.hidden || !page.classList.contains('active')) return;
    const maximum = Math.max(0, page.scrollHeight - page.clientHeight);
    if (page.scrollTop > maximum + 1) page.scrollTop = maximum;
  }
  function scheduleTraitScrollClamp() {
    if (state.traitScrollRaf) return;
    state.traitScrollRaf = requestAnimationFrame(() => {
      state.traitScrollRaf = 0;
      clampTraitScroll();
    });
  }
  function observeTraitScrollArea() {
    state.traitScrollObserver?.disconnect();
    state.traitScrollObserver = null;
    const panel = state.pages.find(item => item.key === 'trait')?.el.querySelector('.trait-board-panel');
    if (!panel || typeof ResizeObserver === 'undefined') return;
    state.traitScrollObserver = new ResizeObserver(scheduleTraitScrollClamp);
    state.traitScrollObserver.observe(panel);
  }
  /* ── 02 · 뷰포트 판정·오프셋 ── */
  /* 뷰포트 판정 */
  function getViewportSize() {
    const root = document.documentElement;
    return {
      w: root.clientWidth || window.innerWidth || 0,
      h: root.clientHeight || window.innerHeight || 0
    };
  }
  function getMode() {
    const { w, h } = getViewportSize();
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    const portrait = h > w;
    if (shortSide <= 600) return 'is-mobile';
    if (shortSide <= 1024 && longSide <= 1366) return 'is-tablet';
    if (portrait) return 'is-pc-portrait';
    return 'is-pc-landscape';
  }
  function updateMobileOffsets() {
    const header = document.querySelector('.hdr');
    const tabs = document.querySelector('.mobile-section-tabs');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
    const { w, h } = getViewportSize();
    document.documentElement.style.setProperty('--mobile-vw', `${w}px`);
    document.documentElement.style.setProperty('--mobile-header-h', `${headerHeight}px`);
    document.documentElement.style.setProperty('--mobile-tabs-h', `${tabsHeight}px`);
    const visualHeight = window.visualViewport?.height;
    const focused = document.activeElement;
    const isEditing = focused && (focused.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName));
    // Browser toolbar animations must not repeatedly resize the active scroll viewport.
    // Only shrink it for an actually focused editor with a visible on-screen keyboard.
    const keyboardVisible = isEditing && Number.isFinite(visualHeight) && visualHeight > 0 && h - visualHeight > 160;
    const usableHeight = keyboardVisible ? Math.min(h, Math.round(visualHeight)) : h;
    document.documentElement.style.setProperty('--mobile-vh', `${usableHeight}px`);
    scheduleTraitScrollClamp();
  }
  function applyMode() {
    const mode = getMode();
    const { w, h } = getViewportSize();
    const shortSide = Math.min(w, h);
    const direction = h > w ? 'is-portrait-view' : '';
    const deviceClass = mode === 'is-mobile' ? 'is-mobile-device' : (mode === 'is-tablet' ? 'is-tablet-device' : '');
    const widthClass = mode === 'is-mobile' && shortSide <= 430 ? 'is-narrow-mobile' : '';
    const classes=[mode];
    if (mode === 'is-mobile' || mode === 'is-tablet' || mode === 'is-pc-portrait') classes.push('is-tabbed');
    if (direction) classes.push(direction);
    if (deviceClass) classes.push(deviceClass);
    if (widthClass) classes.push(widthClass);
    for(const el of [document.body,document.documentElement]){
      el.classList.remove(...MODES);
      el.classList.add(...classes);
    }
    state.layoutWidth = w;
    state.layoutPortrait = h > w;
    syncTabbedLayout();
    const basicTopTab = state.tabs?.querySelector('#mobileTab-basic .mobile-tab-label');
    if (basicTopTab) basicTopTab.textContent = mode === 'is-mobile' || mode === 'is-tablet' ? '기본 설정' : '기본 정보';
    updateMobileOffsets();
  }
  /* ── 03 · 탭 레이아웃·복원 ── */
  /* 탭 레이아웃 */
  function rememberPosition(el) {
    if (!el || state.restore.has(el)) return;
    const marker = document.createComment(`mobile-restore:${el.className || el.tagName}`);
    el.parentNode.insertBefore(marker, el);
    state.restore.set(el, marker);
  }
  function getOrCreatePage(key) {
    let page = document.querySelector(`.mobile-page[data-mobile-page="${key}"]`);
    if (!page) {
      page = document.createElement('div');
      page.className = `mobile-page mobile-page-${key}`;
      page.dataset.mobilePage = key;
    }
    page.id = `mobilePage-${key}`;
    page.setAttribute('role', 'tabpanel');
    page.setAttribute('tabindex', '0');
    return page;
  }
  function getPageIndexByKey(key) {
    if (!key) return -1;
    return state.pages.findIndex(page => page.key === key);
  }
  function buildTabs(colWork, pages) {
    if (!state.tabs) {
      state.tabs = document.createElement('div');
      state.tabs.className = 'mobile-section-tabs';
      state.tabs.setAttribute('aria-label', '화면 전환');
      colWork.parentNode.insertBefore(state.tabs, colWork);
      state.tabs.addEventListener('keydown', handleTabKeydown);
    }
    state.tabs.textContent = '';
    const pageRow = document.createElement('div');
    pageRow.className = 'mobile-section-page-row';
    pageRow.setAttribute('role', 'tablist');
    pageRow.setAttribute('aria-label', '화면 전환');
    pages.forEach((page, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `mobileTab-${page.key}`;
      btn.className = ['mobile-section-tab', 'mobile-section-page-tab', page.toneClass].filter(Boolean).join(' ');
      const glyph = page.key === 'basic' ? '▤' : page.key === 'trait' ? '✦' : '▥';
      btn.innerHTML = `<span class="mobile-tab-glyph" aria-hidden="true">${glyph}</span><span class="mobile-tab-label">${page.label}</span>`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', page.el.id);
      btn.tabIndex = -1;
      page.el.setAttribute('aria-labelledby', btn.id);
      btn.addEventListener('click', () => showTabbedPage(idx, true));
      pageRow.appendChild(btn);
    });
    state.tabs.append(pageRow);
  }
  function handleTabKeydown(event) {
    const tabs = Array.from(state.tabs?.querySelectorAll('.mobile-section-page-tab') || []);
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    showTabbedPage(nextIndex, false);
    tabs[nextIndex]?.focus();
  }
  function setActiveTab(activeIndex) {
    const nextIndex = Math.max(0, Math.min(state.pages.length - 1, activeIndex));
    state.activeIndex = nextIndex;
    state.activeKey = state.pages[nextIndex]?.key || state.activeKey;
    if (state.tabs) {
      state.tabs.querySelectorAll('.mobile-section-page-tab').forEach((btn, idx) => {
        const active = idx === nextIndex;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
      });
    }
    state.pages.forEach((page, idx) => {
      const active = idx === nextIndex;
      page.el.classList.toggle('active', active);
      page.el.hidden = !active;
      page.el.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }
  function showTabbedPage(index, resetPageScroll = false) {
    if (!state.pages.length) return;
    const nextIndex = Math.max(0, Math.min(state.pages.length - 1, index));
    setActiveTab(nextIndex);
    if (resetPageScroll) state.pages[nextIndex].el.scrollTop = 0;
    updateMobileOffsets();
    scheduleTraitScrollClamp();
  }
  function arrangeTabbed(colWork) {
    const pages = [];
    const keepKey = state.activeKey || state.pages[state.activeIndex]?.key || 'basic';
    TABBED_PAGES.forEach((config) => {
      const elements = config.selectors.map(selector => document.querySelector(selector)).filter(Boolean);
      if (!elements.length) return;
      const page = getOrCreatePage(config.key);
      page.textContent = '';
      page.dataset.mobileLabel = config.label;
      elements.forEach((el) => {
        rememberPosition(el);
        page.appendChild(el);
      });
      colWork.appendChild(page);
      pages.push({ ...config, el: page });
    });
    state.pages = pages;
    observeTraitScrollArea();
    buildTabs(colWork, pages);
    colWork.classList.add('is-mobile-arranged');
    state.arrangedTabbed = true;
    const keepIndex = getPageIndexByKey(keepKey);
    showTabbedPage(keepIndex >= 0 ? keepIndex : state.activeIndex);
  }
  function restoreDesktop() {
    if (!state.arrangedTabbed) return;
    state.traitScrollObserver?.disconnect();
    state.traitScrollObserver = null;
    if (state.traitScrollRaf) cancelAnimationFrame(state.traitScrollRaf);
    state.traitScrollRaf = 0;
    state.restore.forEach((marker, el) => {
      if (marker.parentNode) marker.parentNode.insertBefore(el, marker.nextSibling);
    });
    Array.from(document.querySelectorAll('.mobile-page')).forEach(page => page.remove());
    if (state.tabs) state.tabs.remove();
    document.querySelector('.col-work')?.classList.remove('is-mobile-arranged');
    state.tabs = null;
    state.pages = [];
    state.arrangedTabbed = false;
  }
  function syncTabbedLayout() {
    const colWork = document.querySelector('.col-work');
    if (!colWork) return;
    if (document.body.classList.contains('is-tabbed')) {
      if (!state.arrangedTabbed) arrangeTabbed(colWork);
      else {
        showTabbedPage(getPageIndexByKey(state.activeKey));
      }
    } else {
      restoreDesktop();
    }
  }

  function isTextInput(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes((el.type || '').toLowerCase());
  }
  function bindInputAutoSelect() {
    if (document.documentElement.dataset.inputAutoSelectBound === '1') return;
    document.documentElement.dataset.inputAutoSelectBound = '1';
    document.addEventListener('focusin', (event) => {
      const el = event.target;
      if (!isTextInput(el)) return;
      requestAnimationFrame(() => {
        if(typeof el.select==='function') el.select();
      });
    });
  }
  /* ── 04 · 이벤트·초기화 ── */
  /* 갱신·초기화 */
  function scheduleApply() {
    if (state.touchScrolling) {
      state.viewportUpdatePending = true;
      return;
    }
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      const { w, h } = getViewportSize();
      const portrait = h > w;
      const widthChanged = Math.abs(w - state.layoutWidth) > 1;
      const orientationChanged = state.layoutPortrait !== portrait;
      if (widthChanged || orientationChanged) applyMode();
      else updateMobileOffsets();
    });
  }
  function scheduleResumeApply() {
    if (state.resumeRaf) return;
    state.resumeRaf = requestAnimationFrame(() => {
      state.resumeRaf = 0;
      applyMode();
    });
  }
  function markResponsiveReady() {
    window.__dpsResponsiveLayoutReady = true;
    if (typeof window.dpsMarkResponsiveLayoutReady === 'function') {
      window.dpsMarkResponsiveLayoutReady();
    }
  }

  function initializeResponsiveLayout() {
    if (state.initialized) {
      markResponsiveReady();
      return;
    }
    state.initialized = true;
    applyMode();
    bindInputAutoSelect();
    markResponsiveReady();
  }
  function syncResponsiveLayout() {
    if (!state.initialized) {
      initializeResponsiveLayout();
      return;
    }
    applyMode();
    markResponsiveReady();
  }
  window.dpsSyncResponsiveLayout = syncResponsiveLayout;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeResponsiveLayout, { once: true });
  } else {
    initializeResponsiveLayout();
  }
  // Let the browser own native touch momentum; viewport mutations resume after release.
  document.addEventListener('touchstart', () => { state.touchScrolling = true; }, { passive: true });
  const finishTouch = () => {
    state.touchScrolling = false;
    if (state.viewportUpdatePending) {
      state.viewportUpdatePending = false;
      scheduleApply();
    }
  };
  document.addEventListener('touchend', finishTouch, { passive: true });
  document.addEventListener('touchcancel', finishTouch, { passive: true });
  window.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('orientationchange', scheduleApply, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('pageshow', scheduleResumeApply, { passive: true });
  window.addEventListener('focus', scheduleResumeApply, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleResumeApply();
  }, { passive: true });
  window.addEventListener('load', updateMobileOffsets, { once: true });
})();
