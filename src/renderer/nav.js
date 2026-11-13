/* arc.Studio — navigation.
   Two levels, both generated from ARC_CATALOG (catalog.js):
   • the toolbar lists the categories; each opens a dropdown menu with its tools (future tools are marked "Em breve");
   • below it, a quick-switch strip lists the available tools of the current category.
   Views (<section id="<tool>-view">) are only shown for tools whose status is 'ready'. */
(function navigation() {
  'use strict';

  const catalog = globalThis.ARC_CATALOG || [];
  const $ = (selector, root = document) => root.querySelector(selector);

  const categoryNav = $('#nav-categories');
  const menu = $('#nav-menu');
  const strip = $('#tool-strip');
  const crumb = $('#tool-crumb');
  const title = $('#tool-title');
  const description = $('#tool-desc');
  if (!categoryNav || !menu || !strip) return;

  const state = { tool: '', category: '', menuCategory: '' };
  const readyTools = (category) => category.tools.filter((tool) => tool.status === 'ready');
  const escapeText = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const icon = (name, className = 'i i-sm') => `<svg class="${className}" aria-hidden="true"><use href="#i-${escapeText(name)}"/></svg>`;

  function locate(toolId) {
    for (const category of catalog) {
      const tool = category.tools.find((candidate) => candidate.id === toolId);
      if (tool) return { category, tool };
    }
    return null;
  }

  /* ───────── Category bar ───────── */
  function renderCategories() {
    categoryNav.innerHTML = '<span class="seg-thumb" aria-hidden="true"></span>' + catalog.map((category) => {
      const ready = readyTools(category).length;
      const hint = ready ? `${category.label} — ${ready} ${ready === 1 ? 'ferramenta' : 'ferramentas'}` : `${category.label} — em breve`;
      return `<button type="button" class="cat-tab seg-item" id="cat-${category.id}" data-category="${category.id}" aria-haspopup="menu" aria-expanded="false" aria-controls="nav-menu" title="${escapeText(hint)}">`
        + `${icon(category.icon)}<span>${escapeText(category.label)}</span>${icon('chevron', 'i i-xs chevron')}</button>`;
    }).join('');
  }

  function markCurrentCategory() {
    for (const button of categoryNav.querySelectorAll('.cat-tab')) {
      const current = button.dataset.category === state.category;
      button.classList.toggle('active', current);
      button.tabIndex = current ? 0 : -1;
      button.toggleAttribute('aria-current', current);
    }
  }

  /* ───────── Dropdown menu ───────── */
  function menuItems() {
    return [...menu.querySelectorAll('[role="menuitem"]')];
  }

  function renderMenu(category) {
    const ready = readyTools(category).length;
    const note = ready
      ? `${ready} de ${category.tools.length} disponíveis`
      : 'Ferramentas em desenvolvimento';
    menu.setAttribute('aria-label', category.label);
    menu.innerHTML = `<div class="menu-head"><strong>${escapeText(category.label)}</strong><span>${escapeText(note)}</span></div>`
      + category.tools.map((tool) => {
        const soon = tool.status !== 'ready';
        const current = tool.id === state.tool;
        return `<button type="button" role="menuitem" class="menu-item${soon ? ' soon' : ''}${current ? ' current' : ''}" data-tool="${tool.id}" tabindex="-1"`
          + `${soon ? ' aria-disabled="true"' : ''}${current ? ' aria-current="page"' : ''}>`
          + `<span class="menu-icon">${icon(tool.icon)}</span>`
          + `<span class="menu-copy"><strong>${escapeText(tool.label)}</strong><small>${escapeText(tool.summary || '')}</small></span>`
          + (soon ? '<span class="chip chip-soon">Em breve</span>' : current ? icon('check', 'i i-sm menu-check') : '')
          + '</button>';
      }).join('');
  }

  function openMenu(categoryId, { focusFirst = false } = {}) {
    const category = catalog.find((candidate) => candidate.id === categoryId);
    const trigger = $(`#cat-${categoryId}`, categoryNav);
    if (!category || !trigger) return;
    if (state.menuCategory === categoryId && !menu.classList.contains('hidden')) return;
    closeMenu();
    state.menuCategory = categoryId;
    renderMenu(category);
    trigger.setAttribute('aria-expanded', 'true');
    menu.classList.remove('hidden');
    const box = trigger.getBoundingClientRect();
    const width = menu.offsetWidth;
    menu.style.left = `${Math.max(12, Math.min(box.left, window.innerWidth - width - 12))}px`;
    menu.style.top = `${Math.round(box.bottom + 8)}px`;
    menu.classList.remove('opening'); void menu.offsetWidth; menu.classList.add('opening');
    if (focusFirst) (menu.querySelector('.menu-item.current') || menuItems()[0])?.focus();
  }

  function closeMenu({ restoreFocus = false } = {}) {
    if (menu.classList.contains('hidden')) return;
    const trigger = $(`#cat-${state.menuCategory}`, categoryNav);
    menu.classList.add('hidden');
    for (const button of categoryNav.querySelectorAll('[aria-expanded="true"]')) button.setAttribute('aria-expanded', 'false');
    state.menuCategory = '';
    if (restoreFocus) trigger?.focus();
  }

  categoryNav.addEventListener('click', (event) => {
    const button = event.target.closest('.cat-tab');
    if (!button) return;
    if (state.menuCategory === button.dataset.category && !menu.classList.contains('hidden')) closeMenu();
    else openMenu(button.dataset.category, { focusFirst: event.detail === 0 });
  });

  // Once a menu is open, hovering another category switches to it (like a desktop menu bar).
  categoryNav.addEventListener('pointerover', (event) => {
    const button = event.target.closest('.cat-tab');
    if (button && !menu.classList.contains('hidden') && state.menuCategory !== button.dataset.category) openMenu(button.dataset.category);
  });

  categoryNav.addEventListener('keydown', (event) => {
    const buttons = [...categoryNav.querySelectorAll('.cat-tab')];
    const index = buttons.indexOf(event.target.closest('.cat-tab'));
    if (index < 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      for (const button of buttons) button.tabIndex = button === buttons[next] ? 0 : -1;
      buttons[next].focus();
      if (!menu.classList.contains('hidden')) openMenu(buttons[next].dataset.category);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu(buttons[index].dataset.category, { focusFirst: true });
    } else if (event.key === 'Escape') {
      closeMenu({ restoreFocus: true });
    }
  });

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('.menu-item');
    if (!item || item.getAttribute('aria-disabled') === 'true') return;
    show(item.dataset.tool);
    closeMenu({ restoreFocus: true });
  });

  menu.addEventListener('keydown', (event) => {
    const items = menuItems();
    const index = items.indexOf(document.activeElement);
    const move = (to) => { event.preventDefault(); items[(to + items.length) % items.length]?.focus(); };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index <= 0 ? -1 : index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(-1);
    else if (event.key === 'Escape') { event.preventDefault(); closeMenu({ restoreFocus: true }); }
    else if (event.key === 'Tab') closeMenu();
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      // Move to the neighbouring category without leaving the menu.
      const buttons = [...categoryNav.querySelectorAll('.cat-tab')];
      const at = buttons.findIndex((button) => button.dataset.category === state.menuCategory);
      const next = buttons[(at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
      event.preventDefault();
      openMenu(next.dataset.category, { focusFirst: true });
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (menu.classList.contains('hidden')) return;
    if (menu.contains(event.target) || categoryNav.contains(event.target)) return;
    closeMenu();
  }, true);
  window.addEventListener('blur', () => closeMenu());
  window.addEventListener('resize', () => closeMenu());

  /* ───────── Quick-switch strip (tools of the current category) ───────── */
  function renderStrip() {
    const category = catalog.find((candidate) => candidate.id === state.category);
    const tools = category ? readyTools(category) : [];
    strip.classList.toggle('hidden', tools.length < 2);
    strip.setAttribute('aria-label', category ? `Ferramentas de ${category.label}` : 'Ferramentas');
    strip.innerHTML = '<span class="seg-thumb" aria-hidden="true"></span>' + tools.map((tool) => {
      const active = tool.id === state.tool;
      return `<button type="button" class="tool-tab seg-item${active ? ' active' : ''}" role="tab" id="tab-${tool.id}" data-tool="${tool.id}" aria-selected="${active}" aria-controls="${tool.id}-view" tabindex="${active ? 0 : -1}" title="${escapeText(`${tool.label} — ${tool.summary || ''}`)}">`
        + `${icon(tool.icon)}<span>${escapeText(tool.label)}</span></button>`;
    }).join('');
    if (typeof window.syncSeg === 'function') window.syncSeg(strip);
  }

  strip.addEventListener('click', (event) => {
    const tab = event.target.closest('.tool-tab');
    if (tab) show(tab.dataset.tool);
  });

  strip.addEventListener('keydown', (event) => {
    const tabs = [...strip.querySelectorAll('.tool-tab')];
    const index = tabs.indexOf(event.target.closest('.tool-tab'));
    if (index < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
    strip.querySelectorAll('.tool-tab')[next]?.focus();
  });

  /* ───────── Showing a tool ───────── */
  function show(toolId, { animate = true } = {}) {
    const found = locate(toolId);
    if (!found || found.tool.status !== 'ready') return false;
    const { category, tool } = found;
    if (state.tool === tool.id) return true;
    const categoryChanged = state.category !== category.id;
    state.tool = tool.id;
    state.category = category.id;

    for (const view of document.querySelectorAll('.tool-view')) {
      const visible = view.id === `${tool.id}-view`;
      view.classList.toggle('hidden', !visible);
      view.classList.remove('entering');
      if (visible && animate) { void view.offsetWidth; view.classList.add('entering'); }
    }

    crumb.textContent = category.label;
    title.textContent = tool.title || tool.label;
    description.textContent = tool.description || '';
    markCurrentCategory();
    // The sliding thumb must follow programmatic changes too (menu picks, restored tool), not only clicks on the bar.
    requestAnimationFrame(() => { if (typeof window.syncSeg === 'function') window.syncSeg(categoryNav); });

    if (categoryChanged) {
      renderStrip();
    } else {
      for (const tab of strip.querySelectorAll('.tool-tab')) {
        const active = tab.dataset.tool === tool.id;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      }
    }
    document.dispatchEvent(new CustomEvent('arc:toolchange', { detail: { tool: tool.id, category: category.id } }));
    return true;
  }

  // Ctrl/Cmd + 1…9 jump to the Nth available tool of the current category.
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const index = Number(event.key) - 1;
    const category = catalog.find((candidate) => candidate.id === state.category);
    const tool = category && Number.isInteger(index) && index >= 0 ? readyTools(category)[index] : null;
    if (tool) { event.preventDefault(); show(tool.id); }
  });

  renderCategories();
  window.ArcNav = {
    show,
    current: () => state.tool,
    category: () => state.category,
    closeMenu,
    catalog
  };
  const first = catalog.flatMap(readyTools)[0];
  if (first) show(first.id, { animate: false });
}());
