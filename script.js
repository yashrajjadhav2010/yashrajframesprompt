/**
 * YASHRAJ FRAMES – AI STUDIO
 * Pinterest-Style Interactive Engine
 * Vanilla JavaScript Architecture
 */

(function () {
  'use strict';

  // ==========================================================================
  // STORAGE & STATE
  // ==========================================================================
  const STORAGE_KEYS = {
    FAVORITES: 'yashraj_favorites',
    RECENT: 'yashraj_recently_used'
  };

  const state = {
    currentView: 'home',
    selectedCategory: 'All',
    searchQuery: '',
    sortBy: 'recent',
    favorites: new Set(),
    recentIds: [],
    activeModalPin: null,
    isZoomed: false,
    savedSubTab: 'pins' // 'pins' or 'history'
  };

  const promptList = (typeof prompts !== 'undefined' && Array.isArray(prompts)) ? prompts : [];
  const categoriesList = (typeof CATEGORIES !== 'undefined' && Array.isArray(CATEGORIES)) 
    ? CATEGORIES 
    : ['All', 'Wedding', 'Portrait', 'Couple', 'Birthday', 'Baby Photography', 'Traditional', 'Royal', 'Cinematic', 'Restoration', 'Passport', 'Festival', 'Other'];

  // ==========================================================================
  // DOM REFERENCES
  // ==========================================================================
  const dom = {
    // Nav elements
    headerNavPills: document.querySelectorAll('.header-pill'),
    mobileNavItems: document.querySelectorAll('.mobile-nav-item'),
    viewSections: document.querySelectorAll('.view-section'),
    categoryChipsBar: document.getElementById('categoryChipsBar'),

    // Search
    globalSearchInput: document.getElementById('globalSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),

    // Badges & Counters
    badgeRecentCount: document.getElementById('badge-recent-count'),
    badgeSavedCount: document.getElementById('badge-saved-count'),
    feedCountNumber: document.getElementById('feedCountNumber'),
    feedTitleHeading: document.getElementById('feedTitleHeading'),
    profileSavedCount: document.getElementById('profileSavedCount'),
    profileHistoryCount: document.getElementById('profileHistoryCount'),

    // Masonry Grids
    homePinsMasonry: document.getElementById('homePinsMasonry'),
    boardsGridContainer: document.getElementById('boardsGridContainer'),
    savedPinsMasonry: document.getElementById('savedPinsMasonry'),
    historyPinsMasonry: document.getElementById('historyPinsMasonry'),

    // Saved Sub-Tabs
    tabSavedPins: document.getElementById('tabSavedPins'),
    tabSavedHistory: document.getElementById('tabSavedHistory'),
    btnClearHistory: document.getElementById('btnClearHistory'),

    // Pin Detail Modal
    pinDetailModal: document.getElementById('pinDetailModal'),
    modalBackBtn: document.getElementById('modalBackBtn'),
    modalPinImgWrapper: document.getElementById('modalPinImgWrapper'),
    modalPinImage: document.getElementById('modalPinImage'),
    btnModalZoom: document.getElementById('btnModalZoom'),
    btnModalLightbox: document.getElementById('btnModalLightbox'),
    btnModalFav: document.getElementById('btnModalFav'),
    btnModalShare: document.getElementById('btnModalShare'),
    btnModalCopyPrompt: document.getElementById('btnModalCopyPrompt'),
    btnModalCopyLabel: document.getElementById('btnModalCopyLabel'),
    modalPinTitle: document.getElementById('modalPinTitle'),
    modalCategoryBadge: document.getElementById('modalCategoryBadge'),
    modalPinDesc: document.getElementById('modalPinDesc'),
    modalTagsContainer: document.getElementById('modalTagsContainer'),
    modalPromptCounts: document.getElementById('modalPromptCounts'),
    modalPromptText: document.getElementById('modalPromptText'),

    // Lightbox
    fullscreenLightbox: document.getElementById('fullscreenLightbox'),
    lightboxCloseBtn: document.getElementById('lightboxCloseBtn'),
    lightboxImg: document.getElementById('lightboxImg'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================================================
  // STORAGE MANAGEMENT
  // ==========================================================================
  function loadStorage() {
    try {
      const favs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (favs) state.favorites = new Set(JSON.parse(favs));
      const rec = localStorage.getItem(STORAGE_KEYS.RECENT);
      if (rec) state.recentIds = JSON.parse(rec);
    } catch (e) {
      console.warn('LocalStorage error', e);
      state.favorites = new Set();
      state.recentIds = [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(state.favorites)));
    } catch (e) {
      console.warn('Unable to save favorites', e);
    }
    updateCounters();
  }

  function saveRecent() {
    try {
      localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(state.recentIds));
    } catch (e) {
      console.warn('Unable to save recent list', e);
    }
    updateCounters();
  }

  function recordRecent(pinId) {
    const id = Number(pinId);
    state.recentIds = state.recentIds.filter(item => item !== id);
    state.recentIds.unshift(id);
    if (state.recentIds.length > 40) state.recentIds.pop();
    saveRecent();
  }

  function toggleFavorite(pinId) {
    const id = Number(pinId);
    let isFav = false;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast('Removed from Saved Pins');
      isFav = false;
    } else {
      state.favorites.add(id);
      showToast('Saved to your Pins collection!');
      isFav = true;
    }
    saveFavorites();
    refreshCurrentView();
    return isFav;
  }

  // ==========================================================================
  // TOAST NOTIFICATIONS (Pinterest Pill Style)
  // ==========================================================================
  function showToast(message) {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg><use href="#icon-pin"></use></svg>
      <span>${escapeHtml(message)}</span>
    `;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => toast.remove(), 200);
    }, 2200);
  }

  // ==========================================================================
  // CLIPBOARD COPY
  // ==========================================================================
  async function copyPromptToClipboard(promptText, pinId) {
    if (!promptText) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = promptText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      if (pinId) recordRecent(pinId);
      showToast('Prompt copied to clipboard!');
      return true;
    } catch (e) {
      console.error('Failed to copy', e);
      showToast('Unable to copy to clipboard');
      return false;
    }
  }

  // ==========================================================================
  // NAVIGATION & VIEW SWITCHING
  // ==========================================================================
  function switchView(viewName) {
    // Normalise view names
    let normalized = viewName;
    if (normalized === 'explore') normalized = 'home';
    state.currentView = normalized;

    // Header pills
    dom.headerNavPills.forEach(pill => {
      const v = pill.getAttribute('data-view');
      if (v === normalized || (normalized === 'home' && v === 'home')) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    // Mobile nav
    dom.mobileNavItems.forEach(item => {
      const v = item.getAttribute('data-view');
      if (v === normalized) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Sections
    dom.viewSections.forEach(section => {
      if (section.id === `view-${normalized}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render targeted view
    renderView(normalized);

    // Update URL hash
    if (window.location.hash !== `#${normalized}`) {
      window.history.replaceState(null, '', `#${normalized}`);
    }
  }

  function updateCounters() {
    const favCount = state.favorites.size;
    const recCount = state.recentIds.length;

    if (dom.badgeSavedCount) {
      dom.badgeSavedCount.textContent = favCount;
      dom.badgeSavedCount.style.display = favCount > 0 ? 'flex' : 'none';
    }
    if (dom.badgeRecentCount) {
      dom.badgeRecentCount.textContent = recCount;
      dom.badgeRecentCount.style.display = recCount > 0 ? 'flex' : 'none';
    }
    if (dom.profileSavedCount) dom.profileSavedCount.textContent = favCount;
    if (dom.profileHistoryCount) dom.profileHistoryCount.textContent = recCount;
  }

  // ==========================================================================
  // DATA QUERIES
  // ==========================================================================
  function getFilteredPins() {
    let list = [...promptList];

    // Filter by Category
    if (state.selectedCategory && state.selectedCategory !== 'All') {
      list = list.filter(p => p.category.toLowerCase() === state.selectedCategory.toLowerCase());
    }

    // Filter by Search
    if (state.searchQuery && state.searchQuery.trim().length > 0) {
      const q = state.searchQuery.trim().toLowerCase();
      list = list.filter(p => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const catMatch = p.category.toLowerCase().includes(q);
        const descMatch = p.description.toLowerCase().includes(q);
        const tagsMatch = p.tags && p.tags.some(t => t.toLowerCase().includes(q));
        const promptMatch = p.prompt && p.prompt.toLowerCase().includes(q);
        return titleMatch || catMatch || descMatch || tagsMatch || promptMatch;
      });
    }

    return list;
  }

  function getSavedPins() {
    return promptList.filter(p => state.favorites.has(p.id));
  }

  function getHistoryPins() {
    const map = new Map(promptList.map(p => [p.id, p]));
    const list = [];
    state.recentIds.forEach(id => {
      if (map.has(id)) list.push(map.get(id));
    });
    return list;
  }

  // ==========================================================================
  // PINTEREST PIN CARD COMPONENT
  // ==========================================================================
  function createPinCard(pin) {
    const isFav = state.favorites.has(pin.id);
    const card = document.createElement('article');
    card.className = 'pin-card';
    card.setAttribute('data-pin-id', pin.id);

    const imgSrc = pin.thumbnail || pin.referenceImage || 'assets/prompts/royal-portrait.jpg';

    card.innerHTML = `
      <div class="pin-media-container" data-action="view-pin" data-id="${pin.id}">
        <img 
          class="pin-image" 
          src="${escapeHtml(imgSrc)}" 
          alt="${escapeHtml(pin.title)}" 
          loading="lazy" 
          referrerPolicy="no-referrer"
          onerror="this.onerror=null; this.src='assets/prompts/royal-portrait.jpg';"
        />
        <div class="pin-hover-scrim">
          <!-- Top Right Signature Pinterest Pill Button -->
          <div class="pin-top-actions">
            <button type="button" class="btn-pinterest-save" data-action="copy-prompt" data-id="${pin.id}" title="Copy AI Prompt to Clipboard">
              <svg style="width: 14px; height: 14px;"><use href="#icon-copy"></use></svg>
              <span class="save-label">Copy Prompt</span>
            </button>
          </div>

          <!-- Bottom Action Buttons on Hover -->
          <div class="pin-bottom-actions">
            <button type="button" class="pin-quick-pill" data-action="view-pin" data-id="${pin.id}">
              <span>View Style</span>
            </button>
            <div class="pin-round-actions-group">
              <button 
                type="button" 
                class="pin-circle-btn ${isFav ? 'is-fav' : ''}" 
                data-action="fav-pin" 
                data-id="${pin.id}" 
                title="${isFav ? 'Remove from Saved' : 'Save to Favorites'}"
              >
                <svg style="width: 16px; height: 16px;"><use href="#icon-heart"></use></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Below-Image Clean Title & Author Row -->
      <div class="pin-info-row" data-action="view-pin" data-id="${pin.id}">
        <h3 class="pin-title-text">${escapeHtml(pin.title)}</h3>
        <div class="pin-author-row">
          <div class="pin-author-avatar">YF</div>
          <span class="pin-author-name">${escapeHtml(pin.category)} · Studio Preset</span>
        </div>
      </div>
    `;

    return card;
  }

  function createEmptyPinState(title, message) {
    const div = document.createElement('div');
    div.className = 'pinterest-empty-state';
    div.style.gridColumn = '1 / -1';
    div.style.columnSpan = 'all';
    div.innerHTML = `
      <div class="empty-state-bubble">
        <svg style="width: 32px; height: 32px;"><use href="#icon-pin"></use></svg>
      </div>
      <h2 class="empty-state-title">${escapeHtml(title)}</h2>
      <p class="empty-state-desc">${escapeHtml(message)}</p>
      <button class="header-pill active" id="btnResetFilters" style="padding: 12px 24px;">
        Browse All Prompts
      </button>
    `;
    return div;
  }

  // ==========================================================================
  // RENDER VIEWS
  // ==========================================================================
  function renderCategoryChips() {
    if (!dom.categoryChipsBar) return;
    dom.categoryChipsBar.innerHTML = '';

    categoriesList.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `pinterest-chip ${cat === state.selectedCategory ? 'active' : ''}`;
      chip.setAttribute('data-category', cat);
      chip.textContent = cat;
      dom.categoryChipsBar.appendChild(chip);
    });
  }

  function renderHomeFeed() {
    if (!dom.homePinsMasonry) return;
    dom.homePinsMasonry.innerHTML = '';

    const pins = getFilteredPins();

    if (dom.feedCountNumber) dom.feedCountNumber.textContent = pins.length;
    if (dom.feedTitleHeading) {
      if (state.searchQuery) {
        dom.feedTitleHeading.textContent = `Results for "${state.searchQuery}"`;
      } else if (state.selectedCategory !== 'All') {
        dom.feedTitleHeading.textContent = `${state.selectedCategory} Styles`;
      } else {
        dom.feedTitleHeading.textContent = 'Explore Prompts & Styles';
      }
    }

    if (pins.length === 0) {
      dom.homePinsMasonry.appendChild(
        createEmptyPinState('No matching pins found', 'Try adjusting your search terms or selecting a different category.')
      );
    } else {
      pins.forEach(pin => {
        dom.homePinsMasonry.appendChild(createPinCard(pin));
      });
    }
  }

  function renderBoardsView() {
    if (!dom.boardsGridContainer) return;
    dom.boardsGridContainer.innerHTML = '';

    const list = categoriesList.filter(c => c !== 'All');
    list.forEach(cat => {
      const catPins = promptList.filter(p => p.category.toLowerCase() === cat.toLowerCase());
      const count = catPins.length;
      
      const mainImg = catPins[0] 
        ? (catPins[0].thumbnail || catPins[0].referenceImage) 
        : 'assets/prompts/royal-portrait.jpg';
      const sub1 = catPins[1] 
        ? (catPins[1].thumbnail || catPins[1].referenceImage) 
        : mainImg;
      const sub2 = catPins[2] 
        ? (catPins[2].thumbnail || catPins[2].referenceImage) 
        : sub1;

      const boardCard = document.createElement('div');
      boardCard.className = 'board-card';
      boardCard.setAttribute('data-board-category', cat);

      boardCard.innerHTML = `
        <div class="board-collage-cover">
          <img class="board-main-thumb" src="${escapeHtml(mainImg)}" alt="${escapeHtml(cat)}" loading="lazy" referrerPolicy="no-referrer" />
          <div class="board-sub-thumbs">
            <img class="board-sub-thumb" src="${escapeHtml(sub1)}" alt="" loading="lazy" referrerPolicy="no-referrer" />
            <img class="board-sub-thumb" src="${escapeHtml(sub2)}" alt="" loading="lazy" referrerPolicy="no-referrer" />
          </div>
        </div>
        <div class="board-meta">
          <h3 class="board-title">${escapeHtml(cat)}</h3>
          <div class="board-stats">${count} Pin${count === 1 ? '' : 's'} · Verified Preset</div>
        </div>
      `;

      dom.boardsGridContainer.appendChild(boardCard);
    });
  }

  function renderSavedView() {
    if (!dom.savedPinsMasonry) return;
    dom.savedPinsMasonry.innerHTML = '';

    if (state.savedSubTab === 'history') {
      const historyPins = getHistoryPins();
      if (historyPins.length === 0) {
        dom.savedPinsMasonry.appendChild(
          createEmptyPinState('No history yet', 'Pins you inspect or copy will automatically appear here.')
        );
      } else {
        historyPins.forEach(pin => {
          dom.savedPinsMasonry.appendChild(createPinCard(pin));
        });
      }
    } else {
      const savedPins = getSavedPins();
      if (savedPins.length === 0) {
        dom.savedPinsMasonry.appendChild(
          createEmptyPinState('Nothing saved yet', 'Click the heart icon on any style pin to save your favorite editing presets.')
        );
      } else {
        savedPins.forEach(pin => {
          dom.savedPinsMasonry.appendChild(createPinCard(pin));
        });
      }
    }
  }

  function renderHistoryView() {
    if (!dom.historyPinsMasonry) return;
    dom.historyPinsMasonry.innerHTML = '';

    const historyPins = getHistoryPins();
    if (dom.btnClearHistory) {
      dom.btnClearHistory.style.display = historyPins.length > 0 ? 'inline-flex' : 'none';
    }

    if (historyPins.length === 0) {
      dom.historyPinsMasonry.appendChild(
        createEmptyPinState('No recent activity', 'Copied or opened editing styles will appear in this history feed.')
      );
    } else {
      historyPins.forEach(pin => {
        dom.historyPinsMasonry.appendChild(createPinCard(pin));
      });
    }
  }

  function renderView(viewName) {
    if (viewName === 'home') renderHomeFeed();
    else if (viewName === 'boards') renderBoardsView();
    else if (viewName === 'saved') renderSavedView();
    else if (viewName === 'history') renderHistoryView();
    updateCounters();
  }

  function refreshCurrentView() {
    renderView(state.currentView);
  }

  // ==========================================================================
  // PINTEREST 2-COLUMN PIN DETAIL MODAL
  // ==========================================================================
  function openPinModal(pinId) {
    const pin = promptList.find(p => p.id === Number(pinId));
    if (!pin) return;

    state.activeModalPin = pin;
    state.isZoomed = false;

    // Track in history
    recordRecent(pin.id);

    // Media
    const imgSrc = pin.referenceImage || pin.thumbnail || 'assets/prompts/royal-portrait.jpg';
    dom.modalPinImage.src = imgSrc;
    dom.modalPinImage.alt = pin.title;
    dom.modalPinImage.classList.remove('zoomed');

    // Details
    dom.modalPinTitle.textContent = pin.title;
    dom.modalCategoryBadge.textContent = `${pin.category} · Studio Preset`;
    dom.modalPinDesc.textContent = pin.description;
    dom.modalPromptText.textContent = pin.prompt;

    const words = pin.prompt ? pin.prompt.trim().split(/\s+/).length : 0;
    const chars = pin.prompt ? pin.prompt.length : 0;
    dom.modalPromptCounts.textContent = `${words} words · ${chars} characters`;

    // Tags
    dom.modalTagsContainer.innerHTML = '';
    if (pin.tags && Array.isArray(pin.tags)) {
      pin.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'modal-tag-pill';
        span.textContent = `#${tag}`;
        span.addEventListener('click', () => {
          closePinModal();
          state.searchQuery = tag;
          if (dom.globalSearchInput) dom.globalSearchInput.value = tag;
          switchView('home');
        });
        dom.modalTagsContainer.appendChild(span);
      });
    }

    // Favorite state
    updateModalFavState();

    // Reset Copy Label
    dom.btnModalCopyLabel.textContent = 'Copy Prompt';
    dom.btnModalCopyPrompt.classList.remove('copied');

    // Show modal
    dom.pinDetailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closePinModal() {
    dom.pinDetailModal.classList.remove('active');
    document.body.style.overflow = '';
    state.activeModalPin = null;
    state.isZoomed = false;
    dom.modalPinImage.classList.remove('zoomed');
  }

  function toggleModalZoom() {
    state.isZoomed = !state.isZoomed;
    if (state.isZoomed) {
      dom.modalPinImage.classList.add('zoomed');
      dom.btnModalZoom.innerHTML = '<svg style="width: 13px; height: 13px; display: inline-block; vertical-align: -2px; margin-right: 4px;"><use href="#icon-zoom-in"></use></svg>Reset';
    } else {
      dom.modalPinImage.classList.remove('zoomed');
      dom.btnModalZoom.innerHTML = '<svg style="width: 13px; height: 13px; display: inline-block; vertical-align: -2px; margin-right: 4px;"><use href="#icon-zoom-in"></use></svg>Zoom';
    }
  }

  function updateModalFavState() {
    if (!state.activeModalPin) return;
    const isFav = state.favorites.has(state.activeModalPin.id);
    if (isFav) {
      dom.btnModalFav.classList.add('is-fav');
    } else {
      dom.btnModalFav.classList.remove('is-fav');
    }
  }

  // ==========================================================================
  // FULLSCREEN LIGHTBOX
  // ==========================================================================
  function openLightbox(imgSrc) {
    dom.lightboxImg.src = imgSrc;
    dom.fullscreenLightbox.classList.add('active');
  }

  function closeLightbox() {
    dom.fullscreenLightbox.classList.remove('active');
  }

  // ==========================================================================
  // EVENT LISTENERS & DELEGATION
  // ==========================================================================
  function setupEventListeners() {
    // 1. Navigation Pill Clicks
    dom.headerNavPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const v = pill.getAttribute('data-view');
        if (v) switchView(v);
      });
    });

    dom.mobileNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const v = item.getAttribute('data-view');
        if (v) switchView(v);
      });
    });

    // Brand Monogram Click
    const brandBtn = document.querySelector('.brand-monogram-btn');
    if (brandBtn) {
      brandBtn.addEventListener('click', (e) => {
        e.preventDefault();
        state.selectedCategory = 'All';
        state.searchQuery = '';
        if (dom.globalSearchInput) dom.globalSearchInput.value = '';
        renderCategoryChips();
        switchView('home');
      });
    }

    // Top Right Icon Buttons
    const btnHeaderSaved = document.getElementById('btnHeaderSaved');
    if (btnHeaderSaved) {
      btnHeaderSaved.addEventListener('click', () => switchView('saved'));
    }
    const btnHeaderHistory = document.getElementById('btnHeaderHistory');
    if (btnHeaderHistory) {
      btnHeaderHistory.addEventListener('click', () => switchView('history'));
    }

    // Profile Avatar
    const profileAvatar = document.querySelector('.user-profile-avatar');
    if (profileAvatar) {
      profileAvatar.addEventListener('click', () => switchView('saved'));
    }

    // 2. Pinterest Category Chips Bar
    if (dom.categoryChipsBar) {
      dom.categoryChipsBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.pinterest-chip');
        if (!chip) return;
        const cat = chip.getAttribute('data-category');
        state.selectedCategory = cat;

        // Update active chip UI
        dom.categoryChipsBar.querySelectorAll('.pinterest-chip').forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-category') === cat);
        });

        if (state.currentView !== 'home') switchView('home');
        else renderHomeFeed();
      });
    }

    // 3. Global Search Input
    if (dom.globalSearchInput) {
      dom.globalSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        state.searchQuery = val;
        dom.searchClearBtn.style.display = val.trim().length > 0 ? 'flex' : 'none';

        if (state.currentView !== 'home') switchView('home');
        else renderHomeFeed();
      });
    }

    if (dom.searchClearBtn) {
      dom.searchClearBtn.addEventListener('click', () => {
        state.searchQuery = '';
        dom.globalSearchInput.value = '';
        dom.searchClearBtn.style.display = 'none';
        dom.globalSearchInput.focus();
        renderHomeFeed();
      });
    }

    // 4. Saved View Sub-tabs (Saved Pins vs History)
    if (dom.tabSavedPins && dom.tabSavedHistory) {
      dom.tabSavedPins.addEventListener('click', () => {
        state.savedSubTab = 'pins';
        dom.tabSavedPins.classList.add('active');
        dom.tabSavedHistory.classList.remove('active');
        renderSavedView();
      });

      dom.tabSavedHistory.addEventListener('click', () => {
        state.savedSubTab = 'history';
        dom.tabSavedHistory.classList.add('active');
        dom.tabSavedPins.classList.remove('active');
        renderSavedView();
      });
    }

    // 5. Clear History Button
    if (dom.btnClearHistory) {
      dom.btnClearHistory.addEventListener('click', () => {
        if (confirm('Clear your prompt activity history?')) {
          state.recentIds = [];
          saveRecent();
          renderHistoryView();
          showToast('History cleared');
        }
      });
    }

    // 6. Global Delegated Click Handler for Pins & Boards
    document.addEventListener('click', async (e) => {
      // Copy Prompt button on hover
      const copyBtn = e.target.closest('[data-action="copy-prompt"]');
      if (copyBtn) {
        e.stopPropagation();
        const id = Number(copyBtn.getAttribute('data-id'));
        const pin = promptList.find(p => p.id === id);
        if (pin) {
          const ok = await copyPromptToClipboard(pin.prompt, pin.id);
          if (ok) {
            const lbl = copyBtn.querySelector('.save-label') || copyBtn;
            lbl.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              lbl.textContent = 'Copy Prompt';
              copyBtn.classList.remove('copied');
            }, 2000);
          }
        }
        return;
      }

      // Favorite button on pin
      const favBtn = e.target.closest('[data-action="fav-pin"]');
      if (favBtn) {
        e.stopPropagation();
        const id = favBtn.getAttribute('data-id');
        toggleFavorite(id);
        return;
      }

      // View Pin Modal click
      const viewTrigger = e.target.closest('[data-action="view-pin"]');
      if (viewTrigger) {
        e.stopPropagation();
        const id = viewTrigger.getAttribute('data-id');
        openPinModal(id);
        return;
      }

      // Board card click
      const boardCard = e.target.closest('[data-board-category]');
      if (boardCard) {
        const cat = boardCard.getAttribute('data-board-category');
        state.selectedCategory = cat;
        renderCategoryChips();
        switchView('home');
        return;
      }

      // Reset filters button in empty state
      if (e.target.id === 'btnResetFilters' || e.target.closest('#btnResetFilters')) {
        state.selectedCategory = 'All';
        state.searchQuery = '';
        if (dom.globalSearchInput) dom.globalSearchInput.value = '';
        if (dom.searchClearBtn) dom.searchClearBtn.style.display = 'none';
        renderCategoryChips();
        renderHomeFeed();
        return;
      }
    });

    // 7. Modal Handlers
    dom.modalBackBtn.addEventListener('click', closePinModal);
    dom.pinDetailModal.addEventListener('click', (e) => {
      if (e.target === dom.pinDetailModal) closePinModal();
    });

    dom.modalPinImgWrapper.addEventListener('click', toggleModalZoom);
    dom.btnModalZoom.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleModalZoom();
    });

    dom.btnModalLightbox.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.activeModalPin) {
        const src = state.activeModalPin.referenceImage || state.activeModalPin.thumbnail;
        openLightbox(src);
      }
    });

    dom.btnModalFav.addEventListener('click', () => {
      if (!state.activeModalPin) return;
      toggleFavorite(state.activeModalPin.id);
      updateModalFavState();
    });

    dom.btnModalShare.addEventListener('click', async () => {
      if (!state.activeModalPin) return;
      showToast('Pin link ready to share');
    });

    dom.btnModalCopyPrompt.addEventListener('click', async () => {
      if (!state.activeModalPin) return;
      const ok = await copyPromptToClipboard(state.activeModalPin.prompt, state.activeModalPin.id);
      if (ok) {
        dom.btnModalCopyLabel.textContent = 'Copied!';
        dom.btnModalCopyPrompt.classList.add('copied');
        setTimeout(() => {
          dom.btnModalCopyLabel.textContent = 'Copy Prompt';
          dom.btnModalCopyPrompt.classList.remove('copied');
        }, 2000);
      }
    });

    // 8. Lightbox Handlers
    dom.lightboxCloseBtn.addEventListener('click', closeLightbox);
    dom.fullscreenLightbox.addEventListener('click', (e) => {
      if (e.target === dom.fullscreenLightbox) closeLightbox();
    });

    // 9. Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.fullscreenLightbox.classList.contains('active')) closeLightbox();
        else if (dom.pinDetailModal.classList.contains('active')) closePinModal();
      }

      if (e.key === '/' && document.activeElement !== dom.globalSearchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        dom.globalSearchInput.focus();
        dom.globalSearchInput.select();
      }
    });

    // 10. Hash Routing
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['home', 'explore', 'boards', 'saved', 'history'].includes(hash)) {
        if (state.currentView !== hash) switchView(hash);
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // INITIALIZE APP
  // ==========================================================================
  function init() {
    loadStorage();
    renderCategoryChips();
    setupEventListeners();

    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && ['home', 'explore', 'boards', 'saved', 'history'].includes(initialHash)) {
      switchView(initialHash);
    } else {
      switchView('home');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
