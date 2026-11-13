/**
 * YASHRAJ FRAMES – AI STUDIO
 * Pinterest-Style Interactive Engine
 * Vanilla JavaScript Architecture
 */

import QRCode from 'qrcode';
import { prompts as importedPrompts, CATEGORIES as importedCategories } from './prompts.js';

(function () {
  'use strict';

  // ==========================================================================
  // STORAGE & STATE
  // ==========================================================================
  const STORAGE_KEYS = {
    FAVORITES: 'yashraj_favorites',
    RECENT: 'yashraj_recently_used',
    DEFAULT_AI_APP: 'yashraj_default_ai_app',
    CLIENT_MODE: 'yashraj_client_mode',
    CUSTOM_STYLES: 'yashraj_custom_styles',
    SHOP_ORDERS: 'yashraj_shop_orders',
    SHOP_CONTACT: 'yashraj_shop_contact'
  };

  function cleanPromptForAi(text) {
    if (!text) return '';
    return String(text)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s*\[cite:\s*[\d,\s]+\]/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function truncateAtWord(text, maxLen) {
    const clean = cleanPromptForAi(text);
    if (clean.length <= maxLen) return clean;
    const sliced = clean.slice(0, maxLen);
    const lastSpace = sliced.lastIndexOf(' ');
    return (lastSpace > maxLen * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim();
  }

  function isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    const uaMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    const touchTablet = (navigator.maxTouchPoints || 0) > 1 && window.innerWidth < 1024;
    return uaMatch || touchTablet;
  }

  const AI_APPS = {
    chatgpt: {
      name: 'ChatGPT Web',
      getUrl: (p) => `https://chatgpt.com/?${new URLSearchParams({ q: cleanPromptForAi(p) }).toString()}`,
      action: 'url'
    },
    claude: {
      name: 'Claude Web',
      getUrl: (p) => `https://claude.ai/new?${new URLSearchParams({ q: cleanPromptForAi(p) }).toString()}`,
      action: 'url'
    },
    bing: {
      name: 'Bing Image Creator',
      getUrl: (p) => `https://www.bing.com/images/create?${new URLSearchParams({ q: truncateAtWord(p, 480) }).toString()}`,
      action: 'url'
    },
    grok: {
      name: 'Grok Web',
      getUrl: (p) => `https://grok.com/?${new URLSearchParams({ q: cleanPromptForAi(p) }).toString()}`,
      action: 'url'
    },
    perplexity: {
      name: 'Perplexity AI',
      getUrl: (p) => `https://www.perplexity.ai/search?${new URLSearchParams({ q: cleanPromptForAi(p) }).toString()}`,
      action: 'url'
    },
    copilot: {
      name: 'Microsoft Copilot',
      getUrl: (p) => `https://copilot.microsoft.com/?${new URLSearchParams({ q: cleanPromptForAi(p) }).toString()}`,
      action: 'url'
    },
    gemini: {
      name: 'Google Gemini Web',
      getUrl: (p) => `https://gemini.google.com/app?${new URLSearchParams({ prompt: cleanPromptForAi(p) }).toString()}`,
      clipboardOnlyNote: true,
      action: 'url'
    },
    midjourney: {
      name: 'Midjourney',
      getUrl: () => `https://www.midjourney.com/imagine`,
      action: 'url'
    },
    native_share: {
      name: 'Device App Share',
      action: 'share'
    }
  };

  const state = {
    currentView: 'home',
    selectedCategory: 'All',
    searchQuery: '',
    sortBy: 'recent',
    favorites: new Set(),
    recentIds: [],
    customStyles: [],
    shopOrders: [],
    ordersFilter: 'all',
    activeModalPin: null,
    activeTargetPin: null,
    defaultAiApp: null,
    isZoomed: false,
    savedSubTab: 'pins', // 'pins' or 'history'
    clientMode: false,
    isBeforeAfterActive: false,
    customizer: {
      subject: 'default',
      ratio: 'default',
      light: 'default',
      engine: 'default'
    },
    framing: {
      photoUrl: 'assets/prompts/01.jpeg',
      title: 'Royal Cinematic Heritage Portrait',
      category: 'Cinematic',
      activePinId: 1,
      moulding: 'gold',
      size: '16x24',
      aspect: '2:3',
      price: 1450,
      mount: 'offwhite',
      media: 'canvas',
      wall: 'studio-dark'
    }
  };

  const promptList = (Array.isArray(importedPrompts) && importedPrompts.length > 0)
    ? importedPrompts
    : ((typeof window !== 'undefined' && Array.isArray(window.prompts) && window.prompts.length > 0)
      ? window.prompts
      : ((typeof prompts !== 'undefined' && Array.isArray(prompts)) ? prompts : []));

  const categoriesList = (Array.isArray(importedCategories) && importedCategories.length > 0)
    ? importedCategories
    : ((typeof window !== 'undefined' && Array.isArray(window.CATEGORIES) && window.CATEGORIES.length > 0)
      ? window.CATEGORIES
      : ['All', 'Wedding', 'Portrait', 'Couple', 'Birthday', 'Baby Photography', 'Traditional', 'Royal', 'Cinematic', 'Restoration', 'Passport', 'Festival', 'Editorial Portrait', 'Other']);

  function getAllPrompts() {
    return [...state.customStyles, ...promptList];
  }

  // ==========================================================================
  // DOM REFERENCES
  // ==========================================================================
  const dom = {
    // Nav elements
    headerNavPills: document.querySelectorAll('.header-pill'),
    mobileNavItems: document.querySelectorAll('.mobile-nav-item'),
    viewSections: document.querySelectorAll('.view-section'),
    categoryChipsBar: document.getElementById('categoryChipsBar'),

    // Client Showroom Mode Elements
    btnToggleClientMode: document.getElementById('btnToggleClientMode'),
    lblClientModeText: document.getElementById('lblClientModeText'),
    clientModeBanner: document.getElementById('clientModeBanner'),
    btnExitClientMode: document.getElementById('btnExitClientMode'),
    modalClientShowroomCard: document.getElementById('modalClientShowroomCard'),
    btnClientTryFrame: document.getElementById('btnClientTryFrame'),

    // Search
    globalSearchInput: document.getElementById('globalSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),

    // Header Action Addons
    btnHeaderAddStyle: document.getElementById('btnHeaderAddStyle'),
    btnHeaderShopOrders: document.getElementById('btnHeaderShopOrders'),
    badgeOrdersCount: document.getElementById('badge-orders-count'),
    btnMobileToolsTrigger: document.getElementById('btnMobileToolsTrigger'),
    badgeMobileTools: document.getElementById('badge-mobile-tools'),

    // Mobile Studio Tools Bottom Sheet
    mobileToolsSheet: document.getElementById('mobileToolsSheet'),
    mobToolsCloseBtn: document.getElementById('mobToolsCloseBtn'),
    mobSheetDragClose: document.getElementById('mobSheetDragClose'),
    mobSheetAiTarget: document.getElementById('mobSheetAiTarget'),
    mobSheetAiLabel: document.getElementById('mobSheetAiLabel'),
    mobSheetShowroomMode: document.getElementById('mobSheetShowroomMode'),
    mobSheetShowroomBadge: document.getElementById('mobSheetShowroomBadge'),
    mobSheetShopOrders: document.getElementById('mobSheetShopOrders'),
    mobSheetOrdersCount: document.getElementById('mobSheetOrdersCount'),
    mobSheetAddStyle: document.getElementById('mobSheetAddStyle'),
    mobSheetHistory: document.getElementById('mobSheetHistory'),
    mobSheetRecentCount: document.getElementById('mobSheetRecentCount'),

    // Badges & Counters
    badgeRecentCount: document.getElementById('badge-recent-count'),
    badgeSavedCount: document.getElementById('badge-saved-count'),
    feedCountNumber: document.getElementById('feedCountNumber'),
    feedTitleHeading: document.getElementById('feedTitleHeading'),
    profileSavedCount: document.getElementById('profileSavedCount'),
    profileHistoryCount: document.getElementById('profileHistoryCount'),

    // AI Auto Take Elements
    btnHeaderAiTarget: document.getElementById('btnHeaderAiTarget'),
    lblHeaderAiTarget: document.getElementById('lblHeaderAiTarget'),
    aiAutoTakeModal: document.getElementById('aiAutoTakeModal'),
    aiLauncherCloseBtn: document.getElementById('aiLauncherCloseBtn'),
    aiLauncherPromptPreview: document.getElementById('aiLauncherPromptPreview'),
    chkRememberAiApp: document.getElementById('chkRememberAiApp'),
    aiDefaultStatusRow: document.getElementById('aiDefaultStatusRow'),
    lblCurrentDefaultApp: document.getElementById('lblCurrentDefaultApp'),
    btnResetDefaultAiApp: document.getElementById('btnResetDefaultAiApp'),
    btnTargetNativeShare: document.getElementById('btnTargetNativeShare'),

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
    btnModalViewInFrame: document.getElementById('btnModalViewInFrame'),
    btnModalAutoTake: document.getElementById('btnModalAutoTake'),
    btnModalCopyPrompt: document.getElementById('btnModalCopyPrompt'),
    btnModalCopyLabel: document.getElementById('btnModalCopyLabel'),
    btnMobModalFrame: document.getElementById('btnMobModalFrame'),
    btnMobModalAutoTake: document.getElementById('btnMobModalAutoTake'),
    btnMobModalCopyPrompt: document.getElementById('btnMobModalCopyPrompt'),
    lblMobModalCopy: document.getElementById('lblMobModalCopy'),
    modalPinTitle: document.getElementById('modalPinTitle'),
    modalCategoryBadge: document.getElementById('modalCategoryBadge'),
    modalPinDesc: document.getElementById('modalPinDesc'),
    modalTagsContainer: document.getElementById('modalTagsContainer'),
    modalPromptCard: document.getElementById('modalPromptCard'),
    modalPromptCounts: document.getElementById('modalPromptCounts'),
    modalPromptText: document.getElementById('modalPromptText'),

    // Before / After Elements in Modal
    btnModalBeforeAfterToggle: document.getElementById('btnModalBeforeAfterToggle'),
    lblModalBeforeAfter: document.getElementById('lblModalBeforeAfter'),
    modalBeforeAfterOverlay: document.getElementById('modalBeforeAfterOverlay'),
    modalBeforeClipped: document.getElementById('modalBeforeClipped'),
    modalBeforeImg: document.getElementById('modalBeforeImg'),
    modalSplitDivider: document.getElementById('modalSplitDivider'),

    // Customizer Elements
    pinPromptCustomizer: document.getElementById('pinPromptCustomizer'),

    // Framing Studio Elements
    fileCustomerPhotoInput: document.getElementById('fileCustomerPhotoInput'),
    btnUploadCustomerPhoto: document.getElementById('btnUploadCustomerPhoto'),
    btnPickPresetForFraming: document.getElementById('btnPickPresetForFraming'),
    btnChangeFramingPhoto: document.getElementById('btnChangeFramingPhoto'),
    wallPillsGroup: document.getElementById('wallPillsGroup'),
    btnDownloadFrameMockup: document.getElementById('btnDownloadFrameMockup'),
    btnExportFrameImage: document.getElementById('btnExportFrameImage'),
    framingWallSurface: document.getElementById('framingWallSurface'),
    framingArtworkContainer: document.getElementById('framingArtworkContainer'),
    framingMouldingBox: document.getElementById('framingMouldingBox'),
    framingMountBox: document.getElementById('framingMountBox'),
    framingDisplayImage: document.getElementById('framingDisplayImage'),
    lblFrameDimensionsText: document.getElementById('lblFrameDimensionsText'),
    lblFrameMouldingText: document.getElementById('lblFrameMouldingText'),
    framingSidebarThumb: document.getElementById('framingSidebarThumb'),
    framingSidebarTitle: document.getElementById('framingSidebarTitle'),
    framingSidebarCategory: document.getElementById('framingSidebarCategory'),
    lblCurrentMouldingBadge: document.getElementById('lblCurrentMouldingBadge'),
    mouldingSwatchesGrid: document.getElementById('mouldingSwatchesGrid'),
    lblCurrentSizeAspect: document.getElementById('lblCurrentSizeAspect'),
    frameSizesGrid: document.getElementById('frameSizesGrid'),
    mountOptionsRow: document.getElementById('mountOptionsRow'),
    mediaPillsRow: document.getElementById('mediaPillsRow'),
    lblSummaryPrice: document.getElementById('lblSummaryPrice'),
    btnOpenJobSlipModal: document.getElementById('btnOpenJobSlipModal'),
    btnFramingAiTake: document.getElementById('btnFramingAiTake'),
    lblFramingAiTakeText: document.getElementById('lblFramingAiTakeText'),

    // Job Slip Modal Elements
    shopJobSlipModal: document.getElementById('shopJobSlipModal'),
    jobSlipCloseBtn: document.getElementById('jobSlipCloseBtn'),
    lblSlipOrderNum: document.getElementById('lblSlipOrderNum'),
    lblSlipDate: document.getElementById('lblSlipDate'),
    txtCustomerName: document.getElementById('txtCustomerName'),
    txtCustomerPhone: document.getElementById('txtCustomerPhone'),
    txtSlipStyleName: document.getElementById('txtSlipStyleName'),
    txtSlipFrameDetails: document.getElementById('txtSlipFrameDetails'),
    numFramePrice: document.getElementById('numFramePrice'),
    numAdvancePaid: document.getElementById('numAdvancePaid'),
    numBalanceDue: document.getElementById('numBalanceDue'),
    txtDeliveryEstimate: document.getElementById('txtDeliveryEstimate'),
    txtSlipNotes: document.getElementById('txtSlipNotes'),
    txtShopPhone: document.getElementById('txtShopPhone'),
    txtShopEmail: document.getElementById('txtShopEmail'),
    txtShopHours: document.getElementById('txtShopHours'),
    txtShopAddress: document.getElementById('txtShopAddress'),
    jobSlipQrCanvas: document.getElementById('jobSlipQrCanvas'),
    btnPreviewDigitalReceipt: document.getElementById('btnPreviewDigitalReceipt'),
    btnCopySlipLink: document.getElementById('btnCopySlipLink'),
    lblCopySlipLink: document.getElementById('lblCopySlipLink'),
    btnDownloadSlipQr: document.getElementById('btnDownloadSlipQr'),
    slipWhatsAppPreviewText: document.getElementById('slipWhatsAppPreviewText'),
    btnSendWhatsAppSlip: document.getElementById('btnSendWhatsAppSlip'),
    btnCopyJobSlip: document.getElementById('btnCopyJobSlip'),
    lblCopyJobSlip: document.getElementById('lblCopyJobSlip'),
    btnPrintJobSlip: document.getElementById('btnPrintJobSlip'),

    // Client Digital Receipt & Contact Portal
    clientReceiptPortal: document.getElementById('clientReceiptPortal'),
    receiptPortalStatus: document.getElementById('receiptPortalStatus'),
    receiptPortalOrderNum: document.getElementById('receiptPortalOrderNum'),
    receiptPortalDate: document.getElementById('receiptPortalDate'),
    receiptPortalCustomer: document.getElementById('receiptPortalCustomer'),
    receiptPortalStyle: document.getElementById('receiptPortalStyle'),
    receiptPortalFrame: document.getElementById('receiptPortalFrame'),
    receiptPortalMedia: document.getElementById('receiptPortalMedia'),
    receiptPortalDelivery: document.getElementById('receiptPortalDelivery'),
    receiptPortalNotesRow: document.getElementById('receiptPortalNotesRow'),
    receiptPortalNotes: document.getElementById('receiptPortalNotes'),
    receiptPortalTotal: document.getElementById('receiptPortalTotal'),
    receiptPortalAdvance: document.getElementById('receiptPortalAdvance'),
    receiptPortalBalance: document.getElementById('receiptPortalBalance'),
    receiptPortalShopPhone: document.getElementById('receiptPortalShopPhone'),
    receiptPortalShopEmail: document.getElementById('receiptPortalShopEmail'),
    receiptPortalShopHours: document.getElementById('receiptPortalShopHours'),
    receiptPortalShopAddress: document.getElementById('receiptPortalShopAddress'),
    btnReceiptWhatsApp: document.getElementById('btnReceiptWhatsApp'),
    btnReceiptCall: document.getElementById('btnReceiptCall'),
    btnReceiptEmail: document.getElementById('btnReceiptEmail'),
    btnReceiptPrintCopy: document.getElementById('btnReceiptPrintCopy'),
    btnExitReceiptPortal: document.getElementById('btnExitReceiptPortal'),

    // Preset Picker Modal
    presetPickerModal: document.getElementById('presetPickerModal'),
    presetPickerCloseBtn: document.getElementById('presetPickerCloseBtn'),
    presetPickerSearchInput: document.getElementById('presetPickerSearchInput'),
    presetPickerGrid: document.getElementById('presetPickerGrid'),

    // Add Style Modal
    addStyleModal: document.getElementById('addStyleModal'),
    addStyleCloseBtn: document.getElementById('addStyleCloseBtn'),
    addStyleForm: document.getElementById('addStyleForm'),
    txtNewStyleTitle: document.getElementById('txtNewStyleTitle'),
    selNewStyleCategory: document.getElementById('selNewStyleCategory'),
    selNewStyleAspect: document.getElementById('selNewStyleAspect'),
    fileNewStyleImage: document.getElementById('fileNewStyleImage'),
    btnBrowseNewStyleImage: document.getElementById('btnBrowseNewStyleImage'),
    txtNewStyleImageUrl: document.getElementById('txtNewStyleImageUrl'),
    newStyleImagePreviewContainer: document.getElementById('newStyleImagePreviewContainer'),
    newStyleImagePreview: document.getElementById('newStyleImagePreview'),
    lblNewStyleFileName: document.getElementById('lblNewStyleFileName'),
    txtNewStylePrompt: document.getElementById('txtNewStylePrompt'),
    txtNewStyleDescription: document.getElementById('txtNewStyleDescription'),
    txtNewStyleTags: document.getElementById('txtNewStyleTags'),
    btnSaveCustomStyle: document.getElementById('btnSaveCustomStyle'),
    btnExportCustomStyles: document.getElementById('btnExportCustomStyles'),
    fileImportStylesJson: document.getElementById('fileImportStylesJson'),
    btnImportCustomStyles: document.getElementById('btnImportCustomStyles'),

    // Shop Orders Modal
    shopOrdersModal: document.getElementById('shopOrdersModal'),
    shopOrdersCloseBtn: document.getElementById('shopOrdersCloseBtn'),
    shopOrdersStatsSummary: document.getElementById('shopOrdersStatsSummary'),
    ordersFilterPills: document.getElementById('ordersFilterPills'),
    cntOrderAll: document.getElementById('cntOrderAll'),
    cntOrderProgress: document.getElementById('cntOrderProgress'),
    cntOrderReady: document.getElementById('cntOrderReady'),
    cntOrderDelivered: document.getElementById('cntOrderDelivered'),
    ordersEmptyState: document.getElementById('ordersEmptyState'),
    ordersListGrid: document.getElementById('ordersListGrid'),

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
      const defApp = localStorage.getItem(STORAGE_KEYS.DEFAULT_AI_APP);
      if (defApp) state.defaultAiApp = defApp;
      const cm = localStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (cm === 'true') {
        state.clientMode = true;
        document.body.classList.add('client-mode-active');
        if (dom.btnToggleClientMode) dom.btnToggleClientMode.classList.add('is-active');
        if (dom.lblClientModeText) dom.lblClientModeText.textContent = 'Exit Showroom';
        if (dom.clientModeBanner) dom.clientModeBanner.style.display = 'flex';
      }
      const cs = localStorage.getItem(STORAGE_KEYS.CUSTOM_STYLES);
      if (cs) state.customStyles = JSON.parse(cs);
      const so = localStorage.getItem(STORAGE_KEYS.SHOP_ORDERS);
      if (so) state.shopOrders = JSON.parse(so);
      updateOrdersBadge();
    } catch (e) {
      console.warn('LocalStorage error', e);
      state.favorites = new Set();
      state.recentIds = [];
      state.defaultAiApp = null;
      state.customStyles = [];
      state.shopOrders = [];
    }
  }

  function saveCustomStyles() {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_STYLES, JSON.stringify(state.customStyles));
    } catch (e) {
      console.warn('Unable to save custom styles', e);
    }
  }

  function saveShopOrders() {
    try {
      localStorage.setItem(STORAGE_KEYS.SHOP_ORDERS, JSON.stringify(state.shopOrders));
    } catch (e) {
      console.warn('Unable to save shop orders', e);
    }
    updateOrdersBadge();
  }

  function updateOrdersBadge() {
    const activeCount = state.shopOrders.filter(o => o.status === 'in-progress' || o.status === 'ready').length;
    const textVal = activeCount > 99 ? '99+' : activeCount;
    if (dom.badgeOrdersCount) {
      if (activeCount > 0) {
        dom.badgeOrdersCount.style.display = 'flex';
        dom.badgeOrdersCount.textContent = textVal;
      } else {
        dom.badgeOrdersCount.style.display = 'none';
      }
    }
    if (dom.badgeMobileTools) {
      if (activeCount > 0) {
        dom.badgeMobileTools.style.display = 'flex';
        dom.badgeMobileTools.textContent = textVal;
      } else {
        dom.badgeMobileTools.style.display = 'none';
      }
    }
    if (dom.mobSheetOrdersCount) {
      dom.mobSheetOrdersCount.textContent = activeCount;
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
  async function copyPromptToClipboard(promptText, pinId, notify = true) {
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
      if (notify) showToast('Prompt copied to clipboard!');
      return true;
    } catch (e) {
      console.error('Failed to copy', e);
      if (notify) showToast('Unable to copy to clipboard');
      return false;
    }
  }

  // ==========================================================================
  // AI AUTO TAKE ENGINE (Takes prompt directly to external AI App without copy-paste)
  // ==========================================================================
  function copyPromptSync(promptText, pinId) {
    const clean = cleanPromptForAi(promptText);
    let copied = false;
    try {
      const textarea = document.createElement('textarea');
      textarea.value = clean;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '1px';
      textarea.style.height = '1px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, clean.length);
      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (e) {
      // Ignore sync fallback error
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(clean).catch(() => {});
    }

    if (pinId) recordRecent(pinId);
    return copied;
  }

  function openExternalUrl(url) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function updateHeaderAiIndicator() {
    const labelText = (state.defaultAiApp && AI_APPS[state.defaultAiApp])
      ? `AI: ${AI_APPS[state.defaultAiApp].name.split(' ')[0]}`
      : 'AI: Auto';
    if (dom.lblHeaderAiTarget) {
      dom.lblHeaderAiTarget.textContent = labelText;
    }
    if (dom.mobSheetAiLabel) {
      dom.mobSheetAiLabel.textContent = (state.defaultAiApp && AI_APPS[state.defaultAiApp])
        ? `Default: ${AI_APPS[state.defaultAiApp].name}`
        : 'AI: Ask each time (Auto)';
    }
    if (state.defaultAiApp && AI_APPS[state.defaultAiApp]) {
      const app = AI_APPS[state.defaultAiApp];
      if (dom.aiDefaultStatusRow) dom.aiDefaultStatusRow.style.display = 'block';
      if (dom.lblCurrentDefaultApp) dom.lblCurrentDefaultApp.textContent = app.name;
      if (dom.chkRememberAiApp) dom.chkRememberAiApp.checked = true;
    } else {
      if (dom.aiDefaultStatusRow) dom.aiDefaultStatusRow.style.display = 'none';
      if (dom.chkRememberAiApp) dom.chkRememberAiApp.checked = false;
    }
  }

  function openAiLauncherModal(pin) {
    if (!pin) return;
    state.activeTargetPin = pin;
    if (dom.aiLauncherPromptPreview) {
      const cleanPrompt = cleanPromptForAi(pin.prompt).replace(/\s+/g, ' ');
      dom.aiLauncherPromptPreview.textContent = `"${cleanPrompt.slice(0, 160)}${cleanPrompt.length > 160 ? '...' : ''}"`;
    }
    if (dom.btnTargetNativeShare) {
      dom.btnTargetNativeShare.style.display = isMobileDevice() ? 'flex' : 'none';
    }
    updateHeaderAiIndicator();
    dom.aiAutoTakeModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeAiLauncherModal() {
    dom.aiAutoTakeModal.classList.remove('active');
    if (!state.activeModalPin) {
      document.body.style.overflow = '';
    }
  }

  function executeAiAutoTake(pin, targetKey) {
    if (!pin || !pin.prompt) return;
    const cleanPrompt = cleanPromptForAi(pin.prompt);

    // Synchronous clipboard copy BEFORE opening tab so browser user activation is preserved
    copyPromptSync(cleanPrompt, pin.id);

    const app = AI_APPS[targetKey] || AI_APPS.chatgpt;

    if (targetKey === 'native_share') {
      if (isMobileDevice() && navigator.share) {
        navigator.share({
          title: `${pin.title} - Yashraj Frames`,
          text: cleanPrompt
        }).then(() => {
          showToast('Sent prompt to your device apps!');
        }).catch(() => {
          openExternalUrl(AI_APPS.chatgpt.getUrl(cleanPrompt));
          showToast('Prompt copied! Opening ChatGPT Web...');
        });
        return;
      }
      openExternalUrl(AI_APPS.chatgpt.getUrl(cleanPrompt));
      showToast('Desktop detected — copied prompt & opening ChatGPT Web!');
      return;
    }

    if (app && app.action === 'url') {
      const url = app.getUrl(cleanPrompt);
      openExternalUrl(url);
      if (app.clipboardOnlyNote) {
        showToast('Prompt copied! Opening Gemini Web — press Ctrl+V (⌘V) to paste');
      } else {
        showToast(`Launching ${app.name} with prompt! (Also copied for Ctrl+V)`);
      }
    }
  }

  function handleAiAutoTake(pin) {
    if (!pin) return;
    state.activeTargetPin = pin;

    // Clear mobile-only default if user switched to desktop
    if (!isMobileDevice() && state.defaultAiApp === 'native_share') {
      state.defaultAiApp = null;
      localStorage.removeItem(STORAGE_KEYS.DEFAULT_AI_APP);
      updateHeaderAiIndicator();
    }

    // If user has a default AI app saved, launch immediately without extra clicks!
    if (state.defaultAiApp && AI_APPS[state.defaultAiApp]) {
      executeAiAutoTake(pin, state.defaultAiApp);
    } else {
      openAiLauncherModal(pin);
    }
  }

  // ==========================================================================
  // CLIENT SHOWROOM MODE ENGINE (For Walk-in Customers)
  // ==========================================================================
  function toggleClientMode(forceState) {
    state.clientMode = typeof forceState === 'boolean' ? forceState : !state.clientMode;
    
    if (state.clientMode) {
      document.body.classList.add('client-mode-active');
      if (dom.btnToggleClientMode) dom.btnToggleClientMode.classList.add('is-active');
      if (dom.lblClientModeText) dom.lblClientModeText.textContent = 'Exit Showroom';
      if (dom.clientModeBanner) dom.clientModeBanner.style.display = 'flex';
      localStorage.setItem(STORAGE_KEYS.CLIENT_MODE, 'true');
      showToast('Customer Showroom Mode Active (Prompts hidden for clients)');
    } else {
      document.body.classList.remove('client-mode-active');
      if (dom.btnToggleClientMode) dom.btnToggleClientMode.classList.remove('is-active');
      if (dom.lblClientModeText) dom.lblClientModeText.textContent = 'Showroom Mode';
      if (dom.clientModeBanner) dom.clientModeBanner.style.display = 'none';
      localStorage.setItem(STORAGE_KEYS.CLIENT_MODE, 'false');
      showToast('Studio Editor Mode Restored (Prompts visible)');
    }

    if (dom.mobSheetShowroomBadge) {
      dom.mobSheetShowroomBadge.textContent = state.clientMode ? 'Active' : 'Off';
      dom.mobSheetShowroomBadge.classList.toggle('is-active', state.clientMode);
    }

    // Refresh modal if currently open
    if (state.activeModalPin) {
      if (dom.modalPromptCard) dom.modalPromptCard.style.display = state.clientMode ? 'none' : 'block';
      if (dom.modalClientShowroomCard) dom.modalClientShowroomCard.style.display = state.clientMode ? 'block' : 'none';
    }
  }

  // ==========================================================================
  // VIRTUAL FRAMING STUDIO & WALL SIMULATOR ENGINE
  // ==========================================================================
  const MOULDING_NAMES = {
    gold: 'Royal Ornate Gold',
    teak: 'Classic Teak Wood',
    black: 'Gallery Matte Black',
    silver: 'Champagne Silver',
    acrylic: 'Floating Acrylic Glass',
    oak: 'Natural Scandinavian Oak'
  };

  const SIZE_NAMES = {
    '8x12': { label: '8" × 12"', desc: 'Table / Small Wall', aspect: '2:3', price: 450 },
    '12x18': { label: '12" × 18"', desc: 'Studio Standard', aspect: '2:3', price: 850 },
    '16x24': { label: '16" × 24"', desc: 'Living Room Classic', aspect: '2:3', price: 1450 },
    '20x30': { label: '20" × 30"', desc: 'Grand Royal Hall', aspect: '2:3', price: 2250 },
    '24x36': { label: '24" × 36"', desc: 'Wedding Masterpiece', aspect: '2:3', price: 3500 },
    '12x12': { label: '12" × 12"', desc: 'Square Gallery', aspect: '1:1', price: 650 }
  };

  function updateFramingStage() {
    if (!dom.framingWallSurface) return;

    // 1. Update Wall Environment
    dom.framingWallSurface.className = `framing-wall-surface wall-${state.framing.wall}`;
    if (dom.wallPillsGroup) {
      dom.wallPillsGroup.querySelectorAll('.wall-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-wall') === state.framing.wall);
      });
    }

    // 2. Update Image & Media
    if (dom.framingDisplayImage) {
      dom.framingDisplayImage.src = state.framing.photoUrl;
      dom.framingDisplayImage.alt = state.framing.title;
    }
    if (dom.framingSidebarThumb) dom.framingSidebarThumb.src = state.framing.photoUrl;
    if (dom.framingSidebarTitle) dom.framingSidebarTitle.textContent = state.framing.title;
    if (dom.framingSidebarCategory) dom.framingSidebarCategory.textContent = `${state.framing.category} · Preview`;

    // 3. Update Moulding
    if (dom.framingMouldingBox) {
      dom.framingMouldingBox.className = `physical-frame-moulding frame-moulding-${state.framing.moulding}`;
    }
    const mName = MOULDING_NAMES[state.framing.moulding] || 'Royal Ornate Gold';
    if (dom.lblFrameMouldingText) dom.lblFrameMouldingText.textContent = mName;
    if (dom.lblCurrentMouldingBadge) dom.lblCurrentMouldingBadge.textContent = mName;
    if (dom.mouldingSwatchesGrid) {
      dom.mouldingSwatchesGrid.querySelectorAll('.moulding-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-moulding') === state.framing.moulding);
      });
    }

    // 4. Update Mount / Passe-partout
    if (dom.framingMountBox) {
      dom.framingMountBox.className = `passepartout-mount mount-${state.framing.mount}`;
    }
    if (dom.mountOptionsRow) {
      dom.mountOptionsRow.querySelectorAll('.mount-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mount') === state.framing.mount);
      });
    }

    // 5. Update Frame Size & Aspect
    if (dom.framingArtworkContainer) {
      dom.framingArtworkContainer.setAttribute('data-size', state.framing.size);
    }
    const sizeInfo = SIZE_NAMES[state.framing.size] || SIZE_NAMES['16x24'];
    state.framing.price = sizeInfo.price;
    state.framing.aspect = sizeInfo.aspect;

    if (dom.lblFrameDimensionsText) {
      dom.lblFrameDimensionsText.textContent = `${sizeInfo.label} (Aspect ${sizeInfo.aspect})`;
    }
    if (dom.lblCurrentSizeAspect) {
      dom.lblCurrentSizeAspect.textContent = `${sizeInfo.label} (${sizeInfo.desc})`;
    }
    if (dom.frameSizesGrid) {
      dom.frameSizesGrid.querySelectorAll('.frame-size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-size') === state.framing.size);
      });
    }

    // 6. Update Media Pills
    if (dom.mediaPillsRow) {
      dom.mediaPillsRow.querySelectorAll('.media-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-media') === state.framing.media);
      });
    }

    // 7. Update Pricing Summary
    if (dom.lblSummaryPrice) {
      dom.lblSummaryPrice.textContent = `₹${state.framing.price.toLocaleString('en-IN')}`;
    }
    if (dom.lblFramingAiTakeText) {
      dom.lblFramingAiTakeText.textContent = `AI Auto Take (Synced to ${sizeInfo.label} / ${sizeInfo.aspect})`;
    }
  }

  function renderFramingStudio() {
    updateFramingStage();
  }

  function openFramingStudioWithPin(pin) {
    if (!pin) return;
    state.framing.photoUrl = pin.referenceImage || pin.thumbnail || 'assets/prompts/01.jpeg';
    state.framing.title = pin.title;
    state.framing.category = pin.category;
    state.framing.activePinId = pin.id;

    if (dom.pinDetailModal && dom.pinDetailModal.classList.contains('active')) {
      closePinModal();
    }

    switchView('framing');
    updateFramingStage();
    showToast(`Mounted "${pin.title}" in Framing Studio`);
  }

  function handleCustomerPhotoUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      state.framing.photoUrl = dataUrl;
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      state.framing.title = `${cleanName} (Customer Photo)`;
      state.framing.category = 'Customer Upload';
      state.framing.activePinId = null;

      updateFramingStage();
      showToast('Client photo mounted on wall!');
    };
    reader.readAsDataURL(file);
  }

  function handleFramingAiAutoTake() {
    const allPins = getAllPrompts();
    const pin = state.framing.activePinId
      ? allPins.find(p => p.id === state.framing.activePinId)
      : (allPins[0] || null);

    if (!pin) {
      showToast('Please select a studio style first');
      return;
    }

    const sizeInfo = SIZE_NAMES[state.framing.size] || SIZE_NAMES['16x24'];
    const printSpecAddition = ` --ar ${sizeInfo.aspect.replace(':', ':')} [Suitable for physical framing in ${sizeInfo.label} frame, 300 DPI high resolution fine-art print, leave 5% margin for frame moulding bevel]`;
    
    const tailoredPin = {
      ...pin,
      prompt: `${pin.prompt}\n\n${printSpecAddition}`
    };

    handleAiAutoTake(tailoredPin);
  }

  // ==========================================================================
  // SHOP CUSTOMER JOB SLIP, QR CODE & DIGITAL RECEIPT PORTAL
  // ==========================================================================
  const DEFAULT_SHOP_CONTACT = {
    phone: '',
    email: 'yashrajart1999@gmail.com',
    hours: 'Mon–Sat, 10:00 AM – 8:30 PM',
    address: 'Yashraj Frames Custom Framing & AI Photo Studio'
  };

  function getShopContactConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SHOP_CONTACT);
      if (raw) {
        return { ...DEFAULT_SHOP_CONTACT, ...JSON.parse(raw) };
      }
    } catch (e) {
      // ignore storage read error
    }
    return { ...DEFAULT_SHOP_CONTACT };
  }

  function saveShopContactConfigFromInputs() {
    const config = {
      phone: dom.txtShopPhone ? dom.txtShopPhone.value.trim() : '',
      email: (dom.txtShopEmail && dom.txtShopEmail.value.trim()) || DEFAULT_SHOP_CONTACT.email,
      hours: (dom.txtShopHours && dom.txtShopHours.value.trim()) || DEFAULT_SHOP_CONTACT.hours,
      address: (dom.txtShopAddress && dom.txtShopAddress.value.trim()) || DEFAULT_SHOP_CONTACT.address
    };
    try {
      localStorage.setItem(STORAGE_KEYS.SHOP_CONTACT, JSON.stringify(config));
    } catch (e) {
      // ignore storage write error
    }
    return config;
  }

  function encodeReceiptPayload(payloadObj) {
    const json = JSON.stringify(payloadObj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeReceiptPayload(token) {
    if (!token) return null;
    try {
      const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
      const binary = atob(base64 + pad);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  const MEDIA_LABELS = {
    canvas: 'Museum Fine Art Canvas',
    pearl: 'Ultra-HD Pearl Lustre',
    matte: 'Royal Matte Fine Art'
  };

  let activeSlipStatus = 'in-progress';
  let activeSlipDate = '';

  function generateOrderNumber() {
    const random = Math.floor(100 + Math.random() * 900);
    const yr = new Date().getFullYear();
    return `YF-${yr}-${random}`;
  }

  function buildCurrentSlipOrderData() {
    const custName = (dom.txtCustomerName && dom.txtCustomerName.value.trim()) || 'Valued Customer';
    const rawPhone = dom.txtCustomerPhone ? dom.txtCustomerPhone.value.trim() : '';
    const orderNum = (dom.lblSlipOrderNum && dom.lblSlipOrderNum.textContent.replace('Order ', '').replace('#', '').trim()) || generateOrderNumber();
    const styleName = (dom.txtSlipStyleName && dom.txtSlipStyleName.value.trim()) || state.framing.title;
    const frameDetails = (dom.txtSlipFrameDetails && dom.txtSlipFrameDetails.value.trim()) || '16" × 24" — Royal Ornate Gold';
    const mediaLabel = MEDIA_LABELS[state.framing.media] || 'Museum Fine Art Canvas';
    const price = Number(dom.numFramePrice ? dom.numFramePrice.value : state.framing.price) || 0;
    const advance = Number(dom.numAdvancePaid ? dom.numAdvancePaid.value : 0) || 0;
    const balance = Math.max(0, price - advance);
    const delivery = (dom.txtDeliveryEstimate && dom.txtDeliveryEstimate.value.trim()) || 'Tomorrow by 6:00 PM';
    const notes = (dom.txtSlipNotes && dom.txtSlipNotes.value.trim()) || '';
    const dateStr = activeSlipDate || (dom.lblSlipDate ? dom.lblSlipDate.textContent.trim() : '');
    const contact = saveShopContactConfigFromInputs();

    return {
      orderNum,
      date: dateStr,
      customerName: custName,
      customerPhone: rawPhone,
      styleName,
      frameDetails,
      mediaLabel,
      price,
      advance,
      balance,
      delivery,
      notes,
      status: activeSlipStatus || 'in-progress',
      contact
    };
  }

  function buildDigitalReceiptUrl(orderData) {
    const contact = orderData.contact || getShopContactConfig();
    const compact = {
      o: orderData.orderNum,
      d: orderData.date || new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      n: orderData.customerName,
      s: orderData.styleName,
      f: orderData.frameDetails,
      m: orderData.mediaLabel || 'Museum Fine Art Canvas',
      t: orderData.price,
      a: orderData.advance,
      b: orderData.balance,
      e: orderData.delivery,
      w: orderData.notes || '',
      st: orderData.status || 'in-progress',
      sp: contact.phone || '',
      se: contact.email || DEFAULT_SHOP_CONTACT.email,
      sh: contact.hours || DEFAULT_SHOP_CONTACT.hours,
      sa: contact.address || DEFAULT_SHOP_CONTACT.address
    };
    const token = encodeReceiptPayload(compact);
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return `${baseUrl}#receipt?d=${token}`;
  }

  function renderJobSlipQrCode() {
    if (!dom.jobSlipQrCanvas) return;
    const orderData = buildCurrentSlipOrderData();
    const receiptUrl = buildDigitalReceiptUrl(orderData);
    QRCode.toCanvas(dom.jobSlipQrCanvas, receiptUrl, {
      width: 152,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111215',
        light: '#FFFFFF'
      }
    }).catch((err) => {
      console.error('QR generation failed', err);
    });
  }

  function openJobSlipModal(prefillOrder = null) {
    if (!dom.shopJobSlipModal) return;

    const contact = getShopContactConfig();
    if (dom.txtShopPhone) dom.txtShopPhone.value = contact.phone || '';
    if (dom.txtShopEmail) dom.txtShopEmail.value = contact.email || DEFAULT_SHOP_CONTACT.email;
    if (dom.txtShopHours) dom.txtShopHours.value = contact.hours || DEFAULT_SHOP_CONTACT.hours;
    if (dom.txtShopAddress) dom.txtShopAddress.value = contact.address || DEFAULT_SHOP_CONTACT.address;

    if (prefillOrder) {
      activeSlipStatus = prefillOrder.status || 'in-progress';
      activeSlipDate = prefillOrder.date || new Date(prefillOrder.createdAt || Date.now()).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      if (dom.lblSlipOrderNum) dom.lblSlipOrderNum.textContent = `Order #${prefillOrder.orderNum}`;
      if (dom.lblSlipDate) dom.lblSlipDate.textContent = activeSlipDate;
      if (dom.txtCustomerName) dom.txtCustomerName.value = prefillOrder.customerName || '';
      if (dom.txtCustomerPhone) dom.txtCustomerPhone.value = prefillOrder.customerPhone || '';
      if (dom.txtSlipStyleName) dom.txtSlipStyleName.value = prefillOrder.styleName || '';
      if (dom.txtSlipFrameDetails) dom.txtSlipFrameDetails.value = prefillOrder.frameDetails || '';
      if (dom.numFramePrice) dom.numFramePrice.value = prefillOrder.price ?? 0;
      if (dom.numAdvancePaid) dom.numAdvancePaid.value = prefillOrder.advance ?? 0;
      if (dom.txtDeliveryEstimate) dom.txtDeliveryEstimate.value = prefillOrder.delivery || 'Tomorrow by 6:00 PM';
      if (dom.txtSlipNotes) dom.txtSlipNotes.value = prefillOrder.notes || '';
    } else {
      activeSlipStatus = 'in-progress';
      const orderId = generateOrderNumber();
      activeSlipDate = new Date().toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      if (dom.lblSlipOrderNum) dom.lblSlipOrderNum.textContent = `Order #${orderId}`;
      if (dom.lblSlipDate) dom.lblSlipDate.textContent = activeSlipDate;

      const sizeInfo = SIZE_NAMES[state.framing.size] || SIZE_NAMES['16x24'];
      const mouldingName = MOULDING_NAMES[state.framing.moulding] || 'Royal Ornate Gold';

      if (dom.txtSlipStyleName) dom.txtSlipStyleName.value = state.framing.title;
      if (dom.txtSlipFrameDetails) dom.txtSlipFrameDetails.value = `${sizeInfo.label} — ${mouldingName} (${state.framing.mount} mount)`;
      if (dom.numFramePrice) dom.numFramePrice.value = state.framing.price;
      if (dom.numAdvancePaid) dom.numAdvancePaid.value = Math.round(state.framing.price * 0.5);
    }

    updateJobSlipCalculations();

    dom.shopJobSlipModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeJobSlipModal() {
    if (!dom.shopJobSlipModal) return;
    dom.shopJobSlipModal.classList.remove('active');
    if (!state.activeModalPin) {
      document.body.style.overflow = '';
    }
  }

  function updateJobSlipCalculations() {
    const price = Number(dom.numFramePrice ? dom.numFramePrice.value : 0) || 0;
    const advance = Number(dom.numAdvancePaid ? dom.numAdvancePaid.value : 0) || 0;
    const balance = Math.max(0, price - advance);

    if (dom.numBalanceDue) dom.numBalanceDue.value = balance;

    if (dom.slipWhatsAppPreviewText) {
      dom.slipWhatsAppPreviewText.textContent = generateWhatsAppJobMessage();
    }
    renderJobSlipQrCode();
  }

  function generateWhatsAppJobMessage() {
    const data = buildCurrentSlipOrderData();
    const receiptUrl = buildDigitalReceiptUrl(data);
    const notes = data.notes || 'Standard fine art mounting';

    return `🖼️ *YASHRAJ FRAMES — JOB SLIP & ORDER CONFIRMATION*
----------------------------------------
*Order No:* #${data.orderNum}
*Customer:* ${data.customerName}
*Artwork Style:* ${data.styleName}
*Frame & Size:* ${data.frameDetails}
*Print Media:* ${data.mediaLabel}
----------------------------------------
*Total Frame Amount:* ₹${data.price}
*Advance Received:* ₹${data.advance}
*Balance on Delivery:* ₹${data.balance}
*Estimated Ready Time:* ${data.delivery}
*Workshop Notes:* ${notes}
----------------------------------------
📱 *Digital Receipt & Studio Contact:*
${receiptUrl}

📍 *Yashraj Frames Studio*
Thank you for trusting us with your precious memories!`;
  }

  function sendWhatsAppJobSlip() {
    saveCurrentJobSlipAsOrder();
    const rawPhone = dom.txtCustomerPhone ? dom.txtCustomerPhone.value.replace(/[^0-9]/g, '') : '';
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const message = encodeURIComponent(generateWhatsAppJobMessage());

    let waUrl = `https://wa.me/?text=${message}`;
    if (phone && phone.length >= 10) {
      waUrl = `https://wa.me/${phone}?text=${message}`;
    }

    openExternalUrl(waUrl);
    showToast('Opening WhatsApp with receipt & digital QR link!');
  }

  function copyJobSlipText() {
    saveCurrentJobSlipAsOrder();
    const text = generateWhatsAppJobMessage();
    copyPromptToClipboard(text, null, false);
    if (dom.lblCopyJobSlip) {
      dom.lblCopyJobSlip.textContent = 'Copied!';
      setTimeout(() => { dom.lblCopyJobSlip.textContent = 'Copy Slip'; }, 2000);
    }
    showToast('Job Slip copied to clipboard!');
  }

  function printJobSlip() {
    saveCurrentJobSlipAsOrder();
    window.print();
  }

  function saveCurrentJobSlipAsOrder() {
    const data = buildCurrentSlipOrderData();
    const existingIndex = state.shopOrders.findIndex(o => o.orderNum === data.orderNum);
    const orderData = {
      orderNum: data.orderNum,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      styleName: data.styleName,
      photoUrl: state.framing.photoUrl,
      frameDetails: data.frameDetails,
      mediaLabel: data.mediaLabel,
      price: data.price,
      advance: data.advance,
      balance: data.balance,
      delivery: data.delivery,
      notes: data.notes,
      status: activeSlipStatus || 'in-progress',
      date: data.date,
      contact: data.contact,
      createdAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      state.shopOrders[existingIndex] = { ...state.shopOrders[existingIndex], ...orderData };
    } else {
      state.shopOrders.unshift(orderData);
    }
    saveShopOrders();
    return orderData;
  }

  function downloadSlipQrPassPng() {
    const orderData = saveCurrentJobSlipAsOrder();
    const receiptUrl = buildDigitalReceiptUrl(orderData);
    const offscreenQr = document.createElement('canvas');

    QRCode.toCanvas(offscreenQr, receiptUrl, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#111215', light: '#FFFFFF' }
    }).then(() => {
      const card = document.createElement('canvas');
      card.width = 640;
      card.height = 820;
      const ctx = card.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#121318';
      ctx.fillRect(0, 0, card.width, card.height);

      ctx.strokeStyle = '#D6B879';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, card.width - 40, card.height - 40);

      ctx.fillStyle = '#D6B879';
      ctx.font = 'bold 28px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YASHRAJ FRAMES STUDIO', card.width / 2, 78);

      ctx.fillStyle = '#B0B0B0';
      ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Scan for Digital Order Receipt & Studio Contact', card.width / 2, 112);

      // White card behind QR
      const qrBoxSize = 460;
      const qrX = (card.width - qrBoxSize) / 2;
      const qrY = 148;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(qrX, qrY, qrBoxSize, qrBoxSize);
      ctx.drawImage(offscreenQr, qrX + 10, qrY + 10, qrBoxSize - 20, qrBoxSize - 20);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px "JetBrains Mono", monospace';
      ctx.fillText(`Order #${orderData.orderNum}`, card.width / 2, 668);

      ctx.fillStyle = '#D6B879';
      ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${orderData.customerName}  ·  Total ₹${orderData.price}`, card.width / 2, 708);

      ctx.fillStyle = '#9298A3';
      ctx.font = '400 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Ready Estimate: ${orderData.delivery}`, card.width / 2, 744);
      ctx.fillText(orderData.contact?.email || DEFAULT_SHOP_CONTACT.email, card.width / 2, 774);

      const dl = document.createElement('a');
      dl.href = card.toDataURL('image/png');
      dl.download = `YashrajFrames-${orderData.orderNum}-QR.png`;
      dl.click();
      showToast(`Saved QR pass for Order #${orderData.orderNum}`);
    }).catch((err) => {
      console.error('Failed exporting QR PNG', err);
      showToast('Unable to export QR image');
    });
  }

  function openClientReceiptPortal(orderData) {
    if (!dom.clientReceiptPortal || !orderData) return;

    const status = orderData.st || orderData.status || 'in-progress';
    const statusMap = {
      'in-progress': { text: 'In Workshop', cls: 'in-progress' },
      'ready': { text: 'Ready for Pickup', cls: 'ready' },
      'delivered': { text: 'Delivered & Paid', cls: 'delivered' }
    };
    const stInfo = statusMap[status] || statusMap['in-progress'];

    if (dom.receiptPortalStatus) {
      dom.receiptPortalStatus.textContent = stInfo.text;
      dom.receiptPortalStatus.className = `receipt-status-pill ${stInfo.cls}`;
    }

    const orderNum = String(orderData.o || orderData.orderNum || 'YF-2026').replace(/^#/, '');
    const customer = orderData.n || orderData.customerName || 'Valued Customer';
    const styleName = orderData.s || orderData.styleName || 'Custom Portrait Artwork';
    const frameDetails = orderData.f || orderData.frameDetails || 'Handcrafted Studio Frame';
    const media = orderData.m || orderData.mediaLabel || 'Museum Fine Art Canvas';
    const total = Number(orderData.t ?? orderData.price ?? 0);
    const advance = Number(orderData.a ?? orderData.advance ?? 0);
    const balance = Number(orderData.b ?? orderData.balance ?? Math.max(0, total - advance));
    const delivery = orderData.e || orderData.delivery || 'Tomorrow by 6:00 PM';
    const notes = orderData.w ?? orderData.notes ?? '';
    const dateStr = orderData.d || orderData.date || '';

    const contact = {
      phone: orderData.sp || orderData.contact?.phone || getShopContactConfig().phone || '',
      email: orderData.se || orderData.contact?.email || getShopContactConfig().email || DEFAULT_SHOP_CONTACT.email,
      hours: orderData.sh || orderData.contact?.hours || getShopContactConfig().hours || DEFAULT_SHOP_CONTACT.hours,
      address: orderData.sa || orderData.contact?.address || getShopContactConfig().address || DEFAULT_SHOP_CONTACT.address
    };

    if (dom.receiptPortalOrderNum) dom.receiptPortalOrderNum.textContent = `#${orderNum}`;
    if (dom.receiptPortalDate) dom.receiptPortalDate.textContent = dateStr || 'Verified Copy';
    if (dom.receiptPortalCustomer) dom.receiptPortalCustomer.textContent = customer;
    if (dom.receiptPortalStyle) dom.receiptPortalStyle.textContent = styleName;
    if (dom.receiptPortalFrame) dom.receiptPortalFrame.textContent = frameDetails;
    if (dom.receiptPortalMedia) dom.receiptPortalMedia.textContent = media;
    if (dom.receiptPortalDelivery) dom.receiptPortalDelivery.textContent = delivery;

    if (dom.receiptPortalNotesRow && dom.receiptPortalNotes) {
      if (notes && notes.trim().length > 0) {
        dom.receiptPortalNotesRow.style.display = 'flex';
        dom.receiptPortalNotes.textContent = notes;
      } else {
        dom.receiptPortalNotesRow.style.display = 'none';
      }
    }

    if (dom.receiptPortalTotal) dom.receiptPortalTotal.textContent = `₹${total.toLocaleString('en-IN')}`;
    if (dom.receiptPortalAdvance) dom.receiptPortalAdvance.textContent = `₹${advance.toLocaleString('en-IN')}`;
    if (dom.receiptPortalBalance) {
      dom.receiptPortalBalance.textContent = balance <= 0 ? '₹0 (Paid)' : `₹${balance.toLocaleString('en-IN')}`;
    }

    if (dom.receiptPortalShopPhone) {
      dom.receiptPortalShopPhone.textContent = contact.phone ? contact.phone : 'Message us via WhatsApp or Email below';
    }
    if (dom.receiptPortalShopEmail) dom.receiptPortalShopEmail.textContent = contact.email;
    if (dom.receiptPortalShopHours) dom.receiptPortalShopHours.textContent = contact.hours;
    if (dom.receiptPortalShopAddress) dom.receiptPortalShopAddress.textContent = contact.address;

    const cleanShopDigits = contact.phone.replace(/[^0-9]/g, '');
    const shopWaNumber = cleanShopDigits.length === 10 ? `91${cleanShopDigits}` : cleanShopDigits;
    const inquiryMsg = encodeURIComponent(`Hi Yashraj Frames Studio! Checking on my Order #${orderNum} (${customer} - ${frameDetails}).`);

    if (dom.btnReceiptWhatsApp) {
      dom.btnReceiptWhatsApp.href = shopWaNumber
        ? `https://wa.me/${shopWaNumber}?text=${inquiryMsg}`
        : `https://wa.me/?text=${inquiryMsg}`;
    }

    if (dom.btnReceiptCall) {
      if (cleanShopDigits.length >= 7) {
        dom.btnReceiptCall.style.display = 'inline-flex';
        dom.btnReceiptCall.href = `tel:${contact.phone.replace(/\s+/g, '')}`;
      } else {
        dom.btnReceiptCall.style.display = 'none';
      }
    }

    if (dom.btnReceiptEmail) {
      dom.btnReceiptEmail.href = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(`Order #${orderNum} — Yashraj Frames Inquiry`)}&body=${inquiryMsg}`;
    }

    closeJobSlipModal();
    document.body.classList.add('receipt-portal-active');
    dom.clientReceiptPortal.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closeClientReceiptPortal() {
    document.body.classList.remove('receipt-portal-active');
    if (dom.clientReceiptPortal) dom.clientReceiptPortal.style.display = 'none';
    if (window.location.hash.startsWith('#receipt')) {
      window.history.replaceState(null, '', '#home');
      switchView('home');
    }
  }

  function checkAndOpenReceiptFromUrl() {
    const hash = window.location.hash || '';
    let token = null;
    if (hash.startsWith('#receipt')) {
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        token = params.get('d') || params.get('slip');
      }
    } else if (window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      token = searchParams.get('slip') || searchParams.get('d');
    }

    if (!token) return false;
    const decoded = decodeReceiptPayload(token);
    if (!decoded) return false;

    // Sync local workshop status if scanned on the same device
    const orderKey = String(decoded.o || decoded.orderNum || '').replace(/^#/, '');
    const localMatch = state.shopOrders.find(o => o.orderNum === orderKey);
    if (localMatch) {
      decoded.st = localMatch.status || decoded.st;
      decoded.b = localMatch.balance ?? decoded.b;
    }

    openClientReceiptPortal(decoded);
    return true;
  }

  // ==========================================================================
  // REAL CANVAS PROOF EXPORTER (MOCKUP GENERATOR)
  // ==========================================================================
  function exportCanvasMockup(download = true) {
    showToast('Rendering high-resolution proof...');
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Wall Surface based on state.framing.wall
    const wallType = state.framing.wall || 'studio-dark';
    if (wallType === 'living-room') {
      const grad = ctx.createLinearGradient(0, 0, 0, 1200);
      grad.addColorStop(0, '#2D3748');
      grad.addColorStop(0.7, '#1A202C');
      grad.addColorStop(1, '#171923');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 1200);
    } else if (wallType === 'ivory') {
      const grad = ctx.createLinearGradient(0, 0, 0, 1200);
      grad.addColorStop(0, '#F5EDE0');
      grad.addColorStop(1, '#D8C7B0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 1200);
    } else if (wallType === 'brick') {
      ctx.fillStyle = '#221C19';
      ctx.fillRect(0, 0, 1600, 1200);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      for (let y = 0; y < 1200; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1600, y);
        ctx.stroke();
      }
    } else {
      const grad = ctx.createRadialGradient(800, 450, 100, 800, 450, 900);
      grad.addColorStop(0, '#1E222A');
      grad.addColorStop(1, '#08090B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 1200);
    }

    // 2. Spotlight glow
    const spot = ctx.createRadialGradient(800, 480, 50, 800, 480, 600);
    spot.addColorStop(0, 'rgba(255, 235, 190, 0.12)');
    spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, 1600, 1200);

    // 3. Compute Frame Size
    let fw = 520;
    let fh = 740;
    const size = state.framing.size || '16x24';
    if (size === '12x12' || size === '20x20') {
      fw = 620; fh = 620;
    } else if (size === '20x30' || size === '24x36') {
      fw = 540; fh = 780;
    } else if (size === '12x18') {
      fw = 500; fh = 720;
    } else if (size === '8x12') {
      fw = 460; fh = 660;
    }

    const fx = (1600 - fw) / 2;
    const fy = 160;

    // 4. Drop shadow on wall
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetX = 12;
    ctx.shadowOffsetY = 24;
    ctx.fillStyle = '#000000';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();

    // 5. Physical Frame Moulding
    const moulding = state.framing.moulding || 'gold';
    const borderWidth = 28;

    if (moulding === 'gold') {
      const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
      g.addColorStop(0, '#BF953F');
      g.addColorStop(0.25, '#FCF6BA');
      g.addColorStop(0.5, '#B38728');
      g.addColorStop(0.75, '#FBF5B7');
      g.addColorStop(1, '#AA771C');
      ctx.fillStyle = g;
    } else if (moulding === 'teak') {
      const g = ctx.createLinearGradient(fx, fy, fx, fy + fh);
      g.addColorStop(0, '#5C3826');
      g.addColorStop(0.5, '#3B2317');
      g.addColorStop(1, '#2E190E');
      ctx.fillStyle = g;
    } else if (moulding === 'silver') {
      const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
      g.addColorStop(0, '#C0C0C0');
      g.addColorStop(0.5, '#FFFFFF');
      g.addColorStop(1, '#8A8A8A');
      ctx.fillStyle = g;
    } else if (moulding === 'oak') {
      const g = ctx.createLinearGradient(fx, fy, fx, fy + fh);
      g.addColorStop(0, '#C19A6B');
      g.addColorStop(1, '#8B5A2B');
      ctx.fillStyle = g;
    } else if (moulding === 'acrylic') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    } else {
      ctx.fillStyle = '#111215';
    }
    ctx.fillRect(fx, fy, fw, fh);

    // Bevel highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + 2, fy + 2, fw - 4, fh - 4);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.strokeRect(fx + borderWidth - 2, fy + borderWidth - 2, fw - (borderWidth * 2) + 4, fh - (borderWidth * 2) + 4);

    // 6. Passe-partout Mount
    const mountType = state.framing.mount || 'offwhite';
    const mountMargin = mountType === 'none' ? 0 : 36;
    const mx = fx + borderWidth;
    const my = fy + borderWidth;
    const mw = fw - (borderWidth * 2);
    const mh = fh - (borderWidth * 2);

    if (mountMargin > 0) {
      if (mountType === 'white') ctx.fillStyle = '#F8FAFC';
      else if (mountType === 'charcoal') ctx.fillStyle = '#22252A';
      else ctx.fillStyle = '#F3EFE6';
      ctx.fillRect(mx, my, mw, mh);

      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(mx + mountMargin, my + mountMargin, mw - (mountMargin * 2), mh - (mountMargin * 2));
    }

    // 7. Draw Image
    const imgX = mx + mountMargin;
    const imgY = my + mountMargin;
    const imgW = mw - (mountMargin * 2);
    const imgH = mh - (mountMargin * 2);

    const finishCanvas = () => {
      // Glass reflection shine
      const glass = ctx.createLinearGradient(imgX, imgY, imgX + imgW, imgY + imgH);
      glass.addColorStop(0, 'rgba(255,255,255,0.12)');
      glass.addColorStop(0.35, 'rgba(255,255,255,0.03)');
      glass.addColorStop(1, 'rgba(0,0,0,0.08)');
      ctx.fillStyle = glass;
      ctx.fillRect(imgX, imgY, imgW, imgH);

      // Watermark banner at bottom of stage
      ctx.fillStyle = 'rgba(10, 12, 16, 0.92)';
      ctx.fillRect(0, 1080, 1600, 120);
      ctx.strokeStyle = 'rgba(214, 184, 121, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 1080);
      ctx.lineTo(1600, 1080);
      ctx.stroke();

      ctx.fillStyle = '#D6B879';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('YASHRAJ FRAMES · AI STUDIO', 80, 1135);

      const sizeLabel = SIZE_NAMES[state.framing.size]?.label || '16" × 24"';
      const mLabel = MOULDING_NAMES[state.framing.moulding] || 'Royal Gold';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'normal 18px sans-serif';
      ctx.fillText(`${state.framing.title} | ${sizeLabel} ${mLabel} Frame | Price: ₹${state.framing.price}`, 80, 1165);

      ctx.fillStyle = '#9298A3';
      ctx.font = 'normal 16px sans-serif';
      ctx.fillText('yashrajart1999@gmail.com · Client Proof Mockup', 1120, 1145);

      // Trigger download
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Yashraj_Frames_${state.framing.size}_${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Frame proof downloaded as PNG!');
      } catch (err) {
        showToast('Frame proof rendered!');
      }
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, imgX, imgY, imgW, imgH);
      finishCanvas();
    };
    img.onerror = () => {
      ctx.fillStyle = '#23272F';
      ctx.fillRect(imgX, imgY, imgW, imgH);
      ctx.fillStyle = '#D6B879';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.framing.title, imgX + (imgW / 2), imgY + (imgH / 2));
      ctx.textAlign = 'left';
      finishCanvas();
    };
    img.src = state.framing.photoUrl;
  }

  // ==========================================================================
  // PRESET STYLE PICKER (FOR FRAMING STUDIO)
  // ==========================================================================
  function openPresetPicker() {
    if (!dom.presetPickerModal) return;
    renderPresetPicker(getAllPrompts());
    if (dom.presetPickerSearchInput) dom.presetPickerSearchInput.value = '';
    dom.presetPickerModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closePresetPicker() {
    if (!dom.presetPickerModal) return;
    dom.presetPickerModal.classList.remove('active');
    if (!state.activeModalPin && (!dom.shopJobSlipModal || !dom.shopJobSlipModal.classList.contains('active'))) {
      document.body.style.overflow = '';
    }
  }

  function renderPresetPicker(pins) {
    if (!dom.presetPickerGrid) return;
    dom.presetPickerGrid.innerHTML = '';
    pins.forEach(pin => {
      const card = document.createElement('div');
      card.className = `picker-preset-card ${pin.id === state.framing.activePinId ? 'active' : ''}`;
      const imgSrc = pin.referenceImage || pin.image || pin.thumbnail || 'assets/prompts/royal-portrait.jpg';
      card.innerHTML = `
        <img class="picker-preset-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(pin.title)}" />
        <div class="picker-preset-info">
          <div class="picker-preset-name">${escapeHtml(pin.title)}</div>
          <div class="picker-preset-cat">${escapeHtml(pin.category)}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        openFramingStudioWithPin(pin);
        closePresetPicker();
      });
      dom.presetPickerGrid.appendChild(card);
    });
  }

  // ==========================================================================
  // ADD CUSTOM STYLE & JSON BACKUP
  // ==========================================================================
  function openAddStyleModal() {
    if (!dom.addStyleModal) return;
    if (dom.addStyleForm) dom.addStyleForm.reset();
    if (dom.newStyleImagePreviewContainer) dom.newStyleImagePreviewContainer.style.display = 'none';
    if (dom.newStyleImagePreview) dom.newStyleImagePreview.src = '';
    dom.addStyleModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeAddStyleModal() {
    if (!dom.addStyleModal) return;
    dom.addStyleModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function handleSaveCustomStyle() {
    const title = dom.txtNewStyleTitle ? dom.txtNewStyleTitle.value.trim() : '';
    const category = dom.selNewStyleCategory ? dom.selNewStyleCategory.value : 'Other';
    const prompt = dom.txtNewStylePrompt ? dom.txtNewStylePrompt.value.trim() : '';
    const desc = dom.txtNewStyleDescription ? dom.txtNewStyleDescription.value.trim() : '';
    const tagsRaw = dom.txtNewStyleTags ? dom.txtNewStyleTags.value.trim() : '';
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [category.toLowerCase()];

    let image = 'assets/prompts/01.jpeg';
    if (dom.newStyleImagePreview && dom.newStyleImagePreview.src && dom.newStyleImagePreview.src.startsWith('data:')) {
      image = dom.newStyleImagePreview.src;
    } else if (dom.txtNewStyleImageUrl && dom.txtNewStyleImageUrl.value.trim()) {
      image = dom.txtNewStyleImageUrl.value.trim();
    }

    if (!title) {
      showToast('Please enter a Style Name');
      return;
    }
    if (!prompt) {
      showToast('Please enter the AI prompt instructions');
      return;
    }

    const newStyle = {
      id: Date.now(),
      title,
      category,
      prompt,
      referenceImage: image,
      thumbnail: image,
      image,
      description: desc || `${category} style photography with studio lighting`,
      tags,
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    state.customStyles.unshift(newStyle);
    saveCustomStyles();
    closeAddStyleModal();
    renderFeed();
    showToast(`Saved "${title}" to studio library!`);
  }

  function exportCustomStylesJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.customStyles, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `yashraj_frames_custom_styles_${Date.now()}.json`);
    dlAnchorElem.click();
    showToast('Styles exported to JSON!');
  }

  function importCustomStylesJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          const existingIds = new Set(state.customStyles.map(s => s.id));
          imported.forEach(item => {
            if (!existingIds.has(item.id)) {
              state.customStyles.unshift(item);
            }
          });
          saveCustomStyles();
          renderFeed();
          closeAddStyleModal();
          showToast(`Imported ${imported.length} styles successfully!`);
        } else {
          showToast('Invalid backup file format');
        }
      } catch (err) {
        showToast('Error reading JSON backup file');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================================================
  // SHOP ORDERS TRACKER & WORKSHOP SLIPS CRM
  // ==========================================================================
  function openShopOrdersModal() {
    if (!dom.shopOrdersModal) return;
    renderShopOrders();
    dom.shopOrdersModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeShopOrdersModal() {
    if (!dom.shopOrdersModal) return;
    dom.shopOrdersModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderShopOrders() {
    if (!dom.ordersListGrid || !dom.ordersEmptyState) return;
    const filter = state.ordersFilter || 'all';

    const allCount = state.shopOrders.length;
    const progCount = state.shopOrders.filter(o => o.status === 'in-progress').length;
    const readyCount = state.shopOrders.filter(o => o.status === 'ready').length;
    const delivCount = state.shopOrders.filter(o => o.status === 'delivered').length;

    if (dom.cntOrderAll) dom.cntOrderAll.textContent = allCount;
    if (dom.cntOrderProgress) dom.cntOrderProgress.textContent = progCount;
    if (dom.cntOrderReady) dom.cntOrderReady.textContent = readyCount;
    if (dom.cntOrderDelivered) dom.cntOrderDelivered.textContent = delivCount;

    const pendingBalance = state.shopOrders.filter(o => o.status !== 'delivered').reduce((sum, o) => sum + (o.balance || 0), 0);
    if (dom.shopOrdersStatsSummary) {
      dom.shopOrdersStatsSummary.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--text-secondary); text-align: right;">
          <span>Active Orders: <strong>${progCount + readyCount}</strong></span> · 
          <span>Pending Balance: <strong style="color: var(--accent-gold);">₹${pendingBalance}</strong></span>
        </div>
      `;
    }

    const filtered = state.shopOrders.filter(o => {
      if (filter === 'all') return true;
      return o.status === filter;
    });

    if (filtered.length === 0) {
      dom.ordersEmptyState.style.display = 'flex';
      dom.ordersListGrid.style.display = 'none';
      return;
    }

    dom.ordersEmptyState.style.display = 'none';
    dom.ordersListGrid.style.display = 'grid';
    dom.ordersListGrid.innerHTML = '';

    filtered.forEach(order => {
      const card = document.createElement('div');
      card.className = 'order-card-item';
      
      const statusLabel = order.status === 'ready' 
        ? 'Ready for Pickup' 
        : (order.status === 'delivered' ? 'Delivered & Paid' : 'In Workshop');

      card.innerHTML = `
        <div class="order-item-left">
          <img class="order-item-thumb" src="${escapeHtml(order.photoUrl || 'assets/prompts/01.jpeg')}" alt="Thumb" />
          <div class="order-info-col">
            <h4>${escapeHtml(order.customerName)} (${escapeHtml(order.orderNum)})</h4>
            <div class="order-sub-meta">
              <span>📞 ${escapeHtml(order.customerPhone || 'Not provided')}</span> · 
              <span>🖼️ ${escapeHtml(order.frameDetails)}</span> · 
              <span>⏰ ${escapeHtml(order.delivery)}</span>
            </div>
            <div class="order-price-pill">
              Total: ₹${order.price} | Advance: ₹${order.advance} | Balance: ₹${order.balance}
            </div>
          </div>
        </div>
        <div class="order-item-right">
          <span class="order-status-badge ${order.status}">${statusLabel}</span>
          <button type="button" class="btn-order-action qr-order-btn" data-order="${order.orderNum}" title="Open QR Pass &amp; Digital Receipt">
            <svg style="width: 13px; height: 13px; display: inline-block; vertical-align: -2px; margin-right: 4px;"><use href="#icon-qr"></use></svg>
            QR Pass
          </button>
          ${order.status === 'in-progress' ? `
            <button type="button" class="btn-order-action mark-ready-btn" data-order="${order.orderNum}">Mark Ready</button>
          ` : ''}
          ${order.status === 'ready' ? `
            <button type="button" class="btn-order-action ready-wa wa-alert-btn" data-order="${order.orderNum}">
              <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: -2px; margin-right: 4px;"><use href="#icon-whatsapp"></use></svg>
              WhatsApp Ready Alert
            </button>
            <button type="button" class="btn-order-action mark-delivered-btn" data-order="${order.orderNum}">Mark Delivered</button>
          ` : ''}
          ${order.status === 'delivered' ? `
            <button type="button" class="btn-order-action reopen-order-btn" data-order="${order.orderNum}">Re-open</button>
          ` : ''}
        </div>
      `;

      dom.ordersListGrid.appendChild(card);
    });

    dom.ordersListGrid.querySelectorAll('.qr-order-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-order');
        const order = state.shopOrders.find(o => o.orderNum === num);
        if (order) {
          closeShopOrdersModal();
          openJobSlipModal(order);
        }
      });
    });

    dom.ordersListGrid.querySelectorAll('.mark-ready-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-order');
        updateOrderStatus(num, 'ready');
      });
    });

    dom.ordersListGrid.querySelectorAll('.mark-delivered-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-order');
        updateOrderStatus(num, 'delivered');
      });
    });

    dom.ordersListGrid.querySelectorAll('.reopen-order-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-order');
        updateOrderStatus(num, 'in-progress');
      });
    });

    dom.ordersListGrid.querySelectorAll('.wa-alert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-order');
        const order = state.shopOrders.find(o => o.orderNum === num);
        if (order) sendWhatsAppPickupAlert(order);
      });
    });
  }

  function updateOrderStatus(orderNum, newStatus) {
    const order = state.shopOrders.find(o => o.orderNum === orderNum);
    if (order) {
      order.status = newStatus;
      if (newStatus === 'delivered') {
        order.balance = 0;
      }
      saveShopOrders();
      renderShopOrders();
      showToast(`Order #${orderNum} marked as ${newStatus}!`);
    }
  }

  function sendWhatsAppPickupAlert(order) {
    const rawPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const msg = encodeURIComponent(`🎉 *YASHRAJ FRAMES — ORDER READY FOR PICKUP!*
----------------------------------------
Dear *${order.customerName}*,
Your custom handcrafted photo frame is now ready for collection!

*Order No:* ${order.orderNum}
*Artwork:* ${order.styleName}
*Frame Details:* ${order.frameDetails}
*Balance Due on Collection:* ₹${order.balance}
----------------------------------------
📍 *Yashraj Frames Studio*
Looking forward to welcoming you! Thank you.`);

    let waUrl = `https://wa.me/?text=${msg}`;
    if (phone && phone.length >= 10) {
      waUrl = `https://wa.me/${phone}?text=${msg}`;
    }
    openExternalUrl(waUrl);
    showToast('Sending WhatsApp Pickup Alert...');
  }

  // ==========================================================================
  // SMART PROMPT MIXER / CUSTOMIZER
  // ==========================================================================
  function getCustomizedPrompt(pin) {
    if (!pin) return '';
    let p = pin.prompt;
    const { subject, ratio, light, engine } = state.customizer;

    if (subject === 'bride-groom') {
      p = `[Subject Focus: Indian Bride & Groom couple in traditional wedding attire] ` + p;
    } else if (subject === 'solo-portrait') {
      p = `[Subject Focus: Close-up solo artistic portrait, intense eye contact] ` + p;
    } else if (subject === 'family') {
      p = `[Subject Focus: Indian royal family group portrait, heritage setting] ` + p;
    } else if (subject === 'baby') {
      p = `[Subject Focus: Adorable Indian baby photo shoot, cute props, soft pastel tones] ` + p;
    }

    if (light === 'sunset') {
      p += `\n[Lighting: Golden hour warm amber sunset backlighting, atmospheric volumetric dust motes]`;
    } else if (light === 'rembrandt') {
      p += `\n[Lighting: Rembrandt directional studio spotlight, cinematic chiaroscuro shadows]`;
    } else if (light === 'rim') {
      p += `\n[Lighting: High-contrast dramatic rim lighting highlighting silhouettes, dark moody background]`;
    } else if (light === 'candle') {
      p += `\n[Lighting: Warm flickering candlelight illumination, soft royal palace night mood]`;
    }

    if (ratio === '2:3') p += ` --ar 2:3`;
    else if (ratio === '1:1') p += ` --ar 1:1`;
    else if (ratio === '16:9') p += ` --ar 16:9`;
    else if (ratio === '3:4') p += ` --ar 3:4`;

    if (engine === 'mj6') p += ` --v 6.0 --style raw`;
    else if (engine === 'flux') p += ` [Optimized for Flux.1 Pro fine-grain photorealism]`;
    else if (engine === 'sdxl') p += ` [Optimized for SDXL, 8k masterpiece, photorealistic]`;

    return p;
  }

  function updateCustomizedPromptDisplay() {
    if (!state.activeModalPin) return;
    const customized = getCustomizedPrompt(state.activeModalPin);
    if (dom.modalPromptText) dom.modalPromptText.textContent = customized;
    if (dom.modalPromptCounts) {
      const words = customized.trim().split(/\s+/).filter(Boolean).length;
      dom.modalPromptCounts.textContent = `${words} words · ${customized.length} characters`;
    }
  }

  // ==========================================================================
  // INTERACTIVE BEFORE / AFTER SLIDER
  // ==========================================================================
  function toggleBeforeAfter() {
    state.isBeforeAfterActive = !state.isBeforeAfterActive;
    if (dom.modalBeforeAfterOverlay) {
      dom.modalBeforeAfterOverlay.classList.toggle('active', state.isBeforeAfterActive);
    }
    if (dom.lblModalBeforeAfter) {
      dom.lblModalBeforeAfter.textContent = state.isBeforeAfterActive ? 'Exit Split' : 'Before / After';
    }
    if (state.isBeforeAfterActive && state.activeModalPin && dom.modalBeforeImg) {
      const imgSrc = state.activeModalPin.referenceImage || state.activeModalPin.image || state.activeModalPin.thumbnail;
      dom.modalBeforeImg.src = imgSrc;
      setSplitPosition(50);
    }
  }

  function setSplitPosition(pct) {
    const clamped = Math.max(5, Math.min(95, pct));
    if (dom.modalBeforeClipped) dom.modalBeforeClipped.style.width = `${clamped}%`;
    if (dom.modalSplitDivider) dom.modalSplitDivider.style.left = `${clamped}%`;
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
    if (dom.mobSheetRecentCount) dom.mobSheetRecentCount.textContent = recCount;
  }

  // ==========================================================================
  // DATA QUERIES
  // ==========================================================================
  function getFilteredPins() {
    let list = getAllPrompts();

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
    return getAllPrompts().filter(p => state.favorites.has(p.id));
  }

  function getHistoryPins() {
    const all = getAllPrompts();
    const map = new Map(all.map(p => [p.id, p]));
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
        <!-- Touch-first Mobile Heart Overlay Button -->
        <button 
          type="button" 
          class="pin-mobile-fav-btn ${isFav ? 'is-fav' : ''}" 
          data-action="fav-pin" 
          data-id="${pin.id}" 
          aria-label="${isFav ? 'Remove from Saved' : 'Save to Favorites'}"
        >
          <svg style="width: 17px; height: 17px;"><use href="#icon-heart"></use></svg>
        </button>
        <div class="pin-hover-scrim">
          <!-- Top Right Signature Pinterest Pill Buttons: AI Auto Take & Copy -->
          <div class="pin-top-actions">
            <button type="button" class="btn-ai-autotake" data-action="ai-autotake" data-id="${pin.id}" title="Direct AI Auto Take — Open AI App with prompt ready">
              <svg style="width: 13px; height: 13px;"><use href="#icon-sparkles"></use></svg>
              <span>AI Auto Take</span>
            </button>
            <button type="button" class="btn-pinterest-save" data-action="copy-prompt" data-id="${pin.id}" title="Copy AI Prompt to Clipboard">
              <svg style="width: 13px; height: 13px;"><use href="#icon-copy"></use></svg>
              <span class="save-label">Copy</span>
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
                class="btn-pin-frame" 
                data-action="frame-pin" 
                data-id="${pin.id}" 
                title="Preview this artwork framed on the wall"
              >
                <svg style="width: 15px; height: 15px;"><use href="#icon-frame"></use></svg>
              </button>
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

      <!-- Mobile Touch Quick Actions Strip (Hidden on Desktop Hover Devices) -->
      <div class="pin-mobile-actions">
        <button type="button" class="mob-pin-btn mob-pin-ai" data-action="ai-autotake" data-id="${pin.id}">
          <svg style="width: 13px; height: 13px;"><use href="#icon-sparkles"></use></svg>
          <span>AI Take</span>
        </button>
        <button type="button" class="mob-pin-btn mob-pin-copy" data-action="copy-prompt" data-id="${pin.id}">
          <svg style="width: 13px; height: 13px;"><use href="#icon-copy"></use></svg>
          <span class="save-label">Copy</span>
        </button>
        <button type="button" class="mob-pin-btn mob-pin-frame" data-action="frame-pin" data-id="${pin.id}" aria-label="Preview Framed">
          <svg style="width: 14px; height: 14px;"><use href="#icon-frame"></use></svg>
        </button>
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
    const all = getAllPrompts();
    list.forEach(cat => {
      const catPins = all.filter(p => p.category.toLowerCase() === cat.toLowerCase());
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
    else if (viewName === 'framing') renderFramingStudio();
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
    const pin = getAllPrompts().find(p => p.id === Number(pinId));
    if (!pin) return;

    state.activeModalPin = pin;
    state.isZoomed = false;

    // Track in history
    recordRecent(pin.id);

    // Reset Smart Prompt Customizer
    state.customizer = { subject: 'default', ratio: 'default', light: 'default', engine: 'default' };
    if (dom.pinPromptCustomizer) {
      dom.pinPromptCustomizer.querySelectorAll('.cust-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-val') === 'default');
      });
    }

    // Reset Before / After state
    state.isBeforeAfterActive = false;
    if (dom.modalBeforeAfterOverlay) dom.modalBeforeAfterOverlay.classList.remove('active');
    if (dom.lblModalBeforeAfter) dom.lblModalBeforeAfter.textContent = 'Before / After';

    // Media
    const imgSrc = pin.referenceImage || pin.image || pin.thumbnail || 'assets/prompts/royal-portrait.jpg';
    dom.modalPinImage.src = imgSrc;
    dom.modalPinImage.alt = pin.title;
    dom.modalPinImage.classList.remove('zoomed');
    if (dom.modalBeforeImg) dom.modalBeforeImg.src = imgSrc;

    // Details
    dom.modalPinTitle.textContent = pin.title;
    dom.modalCategoryBadge.textContent = `${pin.category} · Studio Preset`;
    dom.modalPinDesc.textContent = pin.description;
    dom.modalPromptText.textContent = pin.prompt;

    const words = pin.prompt ? pin.prompt.trim().split(/\s+/).length : 0;
    const chars = pin.prompt ? pin.prompt.length : 0;
    dom.modalPromptCounts.textContent = `${words} words · ${chars} characters`;

    // Show/Hide prompt vs client showroom card based on mode
    if (dom.modalPromptCard) dom.modalPromptCard.style.display = state.clientMode ? 'none' : 'block';
    if (dom.modalClientShowroomCard) dom.modalClientShowroomCard.style.display = state.clientMode ? 'block' : 'none';

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
      // AI Auto Take button on hover
      const autoTakeBtn = e.target.closest('[data-action="ai-autotake"]');
      if (autoTakeBtn) {
        e.stopPropagation();
        const id = Number(autoTakeBtn.getAttribute('data-id'));
        const pin = getAllPrompts().find(p => p.id === id);
        if (pin) handleAiAutoTake(pin);
        return;
      }

      // Frame Preview button on hover
      const frameBtn = e.target.closest('[data-action="frame-pin"]');
      if (frameBtn) {
        e.stopPropagation();
        const id = Number(frameBtn.getAttribute('data-id'));
        const pin = getAllPrompts().find(p => p.id === id);
        if (pin) openFramingStudioWithPin(pin);
        return;
      }

      // AI Target choice click in launcher modal
      const targetBtn = e.target.closest('.ai-target-btn');
      if (targetBtn) {
        e.stopPropagation();
        const targetKey = targetBtn.getAttribute('data-target');
        if (dom.chkRememberAiApp && dom.chkRememberAiApp.checked) {
          state.defaultAiApp = targetKey;
          localStorage.setItem(STORAGE_KEYS.DEFAULT_AI_APP, targetKey);
          updateHeaderAiIndicator();
        }
        closeAiLauncherModal();
        if (state.activeTargetPin) {
          executeAiAutoTake(state.activeTargetPin, targetKey);
        }
        return;
      }

      // Copy Prompt button on hover
      const copyBtn = e.target.closest('[data-action="copy-prompt"]');
      if (copyBtn) {
        e.stopPropagation();
        const id = Number(copyBtn.getAttribute('data-id'));
        const pin = getAllPrompts().find(p => p.id === id);
        if (pin) {
          const ok = await copyPromptToClipboard(pin.prompt, pin.id);
          if (ok) {
            const lbl = copyBtn.querySelector('.save-label') || copyBtn;
            lbl.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              lbl.textContent = 'Copy';
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

    if (dom.btnModalViewInFrame) {
      dom.btnModalViewInFrame.addEventListener('click', () => {
        if (state.activeModalPin) openFramingStudioWithPin(state.activeModalPin);
      });
    }

    if (dom.btnClientTryFrame) {
      dom.btnClientTryFrame.addEventListener('click', () => {
        if (state.activeModalPin) openFramingStudioWithPin(state.activeModalPin);
      });
    }

    // Client Showroom Mode Toggle
    if (dom.btnToggleClientMode) {
      dom.btnToggleClientMode.addEventListener('click', () => toggleClientMode());
    }
    if (dom.btnExitClientMode) {
      dom.btnExitClientMode.addEventListener('click', () => toggleClientMode(false));
    }

    // Framing Studio Interactive Controls
    if (dom.btnUploadCustomerPhoto && dom.fileCustomerPhotoInput) {
      dom.btnUploadCustomerPhoto.addEventListener('click', () => dom.fileCustomerPhotoInput.click());
    }
    if (dom.btnChangeFramingPhoto && dom.fileCustomerPhotoInput) {
      dom.btnChangeFramingPhoto.addEventListener('click', () => dom.fileCustomerPhotoInput.click());
    }
    if (dom.fileCustomerPhotoInput) {
      dom.fileCustomerPhotoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleCustomerPhotoUpload(e.target.files[0]);
        }
      });
    }
    if (dom.btnPickPresetForFraming) {
      dom.btnPickPresetForFraming.addEventListener('click', () => switchView('home'));
    }
    if (dom.wallPillsGroup) {
      dom.wallPillsGroup.addEventListener('click', (e) => {
        const pill = e.target.closest('.wall-pill');
        if (!pill) return;
        state.framing.wall = pill.getAttribute('data-wall');
        updateFramingStage();
      });
    }
    if (dom.mouldingSwatchesGrid) {
      dom.mouldingSwatchesGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.moulding-swatch-btn');
        if (!btn) return;
        state.framing.moulding = btn.getAttribute('data-moulding');
        updateFramingStage();
      });
    }
    if (dom.frameSizesGrid) {
      dom.frameSizesGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.frame-size-btn');
        if (!btn) return;
        state.framing.size = btn.getAttribute('data-size');
        updateFramingStage();
      });
    }
    if (dom.mountOptionsRow) {
      dom.mountOptionsRow.addEventListener('click', (e) => {
        const btn = e.target.closest('.mount-option-btn');
        if (!btn) return;
        state.framing.mount = btn.getAttribute('data-mount');
        updateFramingStage();
      });
    }
    if (dom.mediaPillsRow) {
      dom.mediaPillsRow.addEventListener('click', (e) => {
        const btn = e.target.closest('.media-pill-btn');
        if (!btn) return;
        state.framing.media = btn.getAttribute('data-media');
        updateFramingStage();
      });
    }
    // Framing Studio Export & Mockup
    if (dom.btnDownloadFrameMockup) {
      dom.btnDownloadFrameMockup.addEventListener('click', () => exportCanvasMockup(true));
    }
    if (dom.btnExportFrameImage) {
      dom.btnExportFrameImage.addEventListener('click', () => exportCanvasMockup(false));
    }
    if (dom.btnPickPresetForFraming) {
      dom.btnPickPresetForFraming.addEventListener('click', openPresetPicker);
    }
    if (dom.btnFramingAiTake) {
      dom.btnFramingAiTake.addEventListener('click', handleFramingAiAutoTake);
    }
    if (dom.btnOpenJobSlipModal) {
      dom.btnOpenJobSlipModal.addEventListener('click', openJobSlipModal);
    }

    // Header Shop Actions
    if (dom.btnHeaderAddStyle) {
      dom.btnHeaderAddStyle.addEventListener('click', openAddStyleModal);
    }
    if (dom.btnHeaderShopOrders) {
      dom.btnHeaderShopOrders.addEventListener('click', openShopOrdersModal);
    }

    // Preset Picker Modal Handlers
    if (dom.presetPickerCloseBtn) {
      dom.presetPickerCloseBtn.addEventListener('click', closePresetPicker);
    }
    if (dom.presetPickerModal) {
      dom.presetPickerModal.addEventListener('click', (e) => {
        if (e.target === dom.presetPickerModal) closePresetPicker();
      });
    }
    if (dom.presetPickerSearchInput) {
      dom.presetPickerSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = getAllPrompts().filter(p => 
          p.title.toLowerCase().includes(q) || 
          p.category.toLowerCase().includes(q) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
        );
        renderPresetPicker(filtered);
      });
    }

    // Add Custom Style Modal Handlers
    if (dom.addStyleCloseBtn) {
      dom.addStyleCloseBtn.addEventListener('click', closeAddStyleModal);
    }
    if (dom.addStyleModal) {
      dom.addStyleModal.addEventListener('click', (e) => {
        if (e.target === dom.addStyleModal) closeAddStyleModal();
      });
    }
    if (dom.btnBrowseNewStyleImage && dom.fileNewStyleImage) {
      dom.btnBrowseNewStyleImage.addEventListener('click', () => dom.fileNewStyleImage.click());
    }
    if (dom.fileNewStyleImage) {
      dom.fileNewStyleImage.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (dom.newStyleImagePreview) dom.newStyleImagePreview.src = ev.target.result;
          if (dom.newStyleImagePreviewContainer) dom.newStyleImagePreviewContainer.style.display = 'flex';
          if (dom.lblNewStyleFileName) dom.lblNewStyleFileName.textContent = `${file.name} (Uploaded)`;
        };
        reader.readAsDataURL(file);
      });
    }
    if (dom.txtNewStyleImageUrl) {
      dom.txtNewStyleImageUrl.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          if (dom.newStyleImagePreview) dom.newStyleImagePreview.src = url;
          if (dom.newStyleImagePreviewContainer) dom.newStyleImagePreviewContainer.style.display = 'flex';
          if (dom.lblNewStyleFileName) dom.lblNewStyleFileName.textContent = 'Image URL linked';
        }
      });
    }
    if (dom.btnSaveCustomStyle) {
      dom.btnSaveCustomStyle.addEventListener('click', handleSaveCustomStyle);
    }
    if (dom.btnExportCustomStyles) {
      dom.btnExportCustomStyles.addEventListener('click', exportCustomStylesJson);
    }
    if (dom.btnImportCustomStyles && dom.fileImportStylesJson) {
      dom.btnImportCustomStyles.addEventListener('click', () => dom.fileImportStylesJson.click());
    }
    if (dom.fileImportStylesJson) {
      dom.fileImportStylesJson.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          importCustomStylesJson(e.target.files[0]);
        }
      });
    }

    // Shop Orders Modal Handlers
    if (dom.shopOrdersCloseBtn) {
      dom.shopOrdersCloseBtn.addEventListener('click', closeShopOrdersModal);
    }
    if (dom.shopOrdersModal) {
      dom.shopOrdersModal.addEventListener('click', (e) => {
        if (e.target === dom.shopOrdersModal) closeShopOrdersModal();
      });
    }
    if (dom.ordersFilterPills) {
      dom.ordersFilterPills.addEventListener('click', (e) => {
        const btn = e.target.closest('.orders-filter-btn');
        if (!btn) return;
        state.ordersFilter = btn.getAttribute('data-status');
        dom.ordersFilterPills.querySelectorAll('.orders-filter-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        renderShopOrders();
      });
    }

    // Before / After Split Slider Handlers
    if (dom.btnModalBeforeAfterToggle) {
      dom.btnModalBeforeAfterToggle.addEventListener('click', toggleBeforeAfter);
    }
    let isDraggingSplit = false;
    function handleSplitMove(clientX) {
      if (!dom.modalPinImgWrapper) return;
      const rect = dom.modalPinImgWrapper.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSplitPosition(pct);
    }
    if (dom.modalSplitDivider) {
      dom.modalSplitDivider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDraggingSplit = true;
      });
      dom.modalSplitDivider.addEventListener('touchstart', () => {
        isDraggingSplit = true;
      }, { passive: true });
    }
    window.addEventListener('mousemove', (e) => {
      if (isDraggingSplit) handleSplitMove(e.clientX);
    });
    window.addEventListener('touchmove', (e) => {
      if (isDraggingSplit && e.touches[0]) handleSplitMove(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('mouseup', () => {
      isDraggingSplit = false;
    });
    window.addEventListener('touchend', () => {
      isDraggingSplit = false;
    });

    // Smart Prompt Customizer Chips Handlers
    if (dom.pinPromptCustomizer) {
      dom.pinPromptCustomizer.addEventListener('click', (e) => {
        const chip = e.target.closest('.cust-chip');
        if (!chip) return;
        const row = chip.closest('.customizer-row');
        if (!row) return;
        row.querySelectorAll('.cust-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const type = chip.getAttribute('data-type');
        const val = chip.getAttribute('data-val');
        if (type && val) {
          state.customizer[type] = val;
          updateCustomizedPromptDisplay();
        }
      });
    }

    // Job Slip Modal Handlers
    if (dom.jobSlipCloseBtn) {
      dom.jobSlipCloseBtn.addEventListener('click', closeJobSlipModal);
    }
    if (dom.shopJobSlipModal) {
      dom.shopJobSlipModal.addEventListener('click', (e) => {
        if (e.target === dom.shopJobSlipModal) closeJobSlipModal();
      });
      dom.shopJobSlipModal.addEventListener('input', (e) => {
        if (e.target && e.target.matches('input, textarea, select')) {
          updateJobSlipCalculations();
        }
      });
    }
    if (dom.btnPreviewDigitalReceipt) {
      dom.btnPreviewDigitalReceipt.addEventListener('click', () => {
        const savedOrder = saveCurrentJobSlipAsOrder();
        const url = buildDigitalReceiptUrl(savedOrder);
        window.history.replaceState(null, '', url);
        openClientReceiptPortal(savedOrder);
      });
    }
    if (dom.btnCopySlipLink) {
      dom.btnCopySlipLink.addEventListener('click', () => {
        const savedOrder = saveCurrentJobSlipAsOrder();
        const url = buildDigitalReceiptUrl(savedOrder);
        copyPromptSync(url, null);
        if (dom.lblCopySlipLink) {
          dom.lblCopySlipLink.textContent = 'Copied!';
          setTimeout(() => { dom.lblCopySlipLink.textContent = 'Copy Link'; }, 2000);
        }
        showToast('Digital receipt & contact link copied!');
      });
    }
    if (dom.btnDownloadSlipQr) {
      dom.btnDownloadSlipQr.addEventListener('click', downloadSlipQrPassPng);
    }
    if (dom.btnExitReceiptPortal) {
      dom.btnExitReceiptPortal.addEventListener('click', closeClientReceiptPortal);
    }
    if (dom.btnReceiptPrintCopy) {
      dom.btnReceiptPrintCopy.addEventListener('click', () => window.print());
    }
    if (dom.btnSendWhatsAppSlip) {
      dom.btnSendWhatsAppSlip.addEventListener('click', sendWhatsAppJobSlip);
    }
    if (dom.btnCopyJobSlip) {
      dom.btnCopyJobSlip.addEventListener('click', copyJobSlipText);
    }
    if (dom.btnPrintJobSlip) {
      dom.btnPrintJobSlip.addEventListener('click', printJobSlip);
    }

    if (dom.btnModalAutoTake) {
      dom.btnModalAutoTake.addEventListener('click', () => {
        if (state.activeModalPin) {
          const tailored = {
            ...state.activeModalPin,
            prompt: getCustomizedPrompt(state.activeModalPin)
          };
          handleAiAutoTake(tailored);
        }
      });
    }

    if (dom.btnHeaderAiTarget) {
      dom.btnHeaderAiTarget.addEventListener('click', () => {
        openAiLauncherModal(state.activeModalPin || getAllPrompts()[0]);
      });
    }

    if (dom.aiLauncherCloseBtn) {
      dom.aiLauncherCloseBtn.addEventListener('click', closeAiLauncherModal);
    }

    if (dom.aiAutoTakeModal) {
      dom.aiAutoTakeModal.addEventListener('click', (e) => {
        if (e.target === dom.aiAutoTakeModal) closeAiLauncherModal();
      });
    }

    if (dom.btnResetDefaultAiApp) {
      dom.btnResetDefaultAiApp.addEventListener('click', () => {
        state.defaultAiApp = null;
        localStorage.removeItem(STORAGE_KEYS.DEFAULT_AI_APP);
        updateHeaderAiIndicator();
        showToast('Default AI app preference cleared');
      });
    }

    dom.btnModalCopyPrompt.addEventListener('click', async () => {
      if (!state.activeModalPin) return;
      const promptToCopy = getCustomizedPrompt(state.activeModalPin);
      const ok = await copyPromptToClipboard(promptToCopy, state.activeModalPin.id);
      if (ok) {
        dom.btnModalCopyLabel.textContent = 'Copied!';
        dom.btnModalCopyPrompt.classList.add('copied');
        if (dom.lblMobModalCopy) dom.lblMobModalCopy.textContent = 'Copied!';
        if (dom.btnMobModalCopyPrompt) dom.btnMobModalCopyPrompt.classList.add('copied');
        setTimeout(() => {
          dom.btnModalCopyLabel.textContent = 'Copy';
          dom.btnModalCopyPrompt.classList.remove('copied');
          if (dom.lblMobModalCopy) dom.lblMobModalCopy.textContent = 'Copy';
          if (dom.btnMobModalCopyPrompt) dom.btnMobModalCopyPrompt.classList.remove('copied');
        }, 2000);
      }
    });

    // Mobile Modal Sticky Dock Handlers
    if (dom.btnMobModalFrame && dom.btnModalViewInFrame) {
      dom.btnMobModalFrame.addEventListener('click', () => dom.btnModalViewInFrame.click());
    }
    if (dom.btnMobModalAutoTake && dom.btnModalAutoTake) {
      dom.btnMobModalAutoTake.addEventListener('click', () => dom.btnModalAutoTake.click());
    }
    if (dom.btnMobModalCopyPrompt && dom.btnModalCopyPrompt) {
      dom.btnMobModalCopyPrompt.addEventListener('click', () => dom.btnModalCopyPrompt.click());
    }

    // Mobile Studio Tools Bottom Sheet Handlers
    function openMobileToolsSheet() {
      if (!dom.mobileToolsSheet) return;
      updateHeaderAiIndicator();
      updateOrdersBadge();
      updateCounters();
      if (dom.mobSheetShowroomBadge) {
        dom.mobSheetShowroomBadge.textContent = state.clientMode ? 'Active' : 'Off';
        dom.mobSheetShowroomBadge.classList.toggle('is-active', state.clientMode);
      }
      dom.mobileToolsSheet.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeMobileToolsSheet() {
      if (!dom.mobileToolsSheet) return;
      dom.mobileToolsSheet.classList.remove('active');
      if (!state.activeModalPin) {
        document.body.style.overflow = '';
      }
    }

    if (dom.btnMobileToolsTrigger) {
      dom.btnMobileToolsTrigger.addEventListener('click', openMobileToolsSheet);
    }
    if (dom.mobToolsCloseBtn) {
      dom.mobToolsCloseBtn.addEventListener('click', closeMobileToolsSheet);
    }
    if (dom.mobSheetDragClose) {
      dom.mobSheetDragClose.addEventListener('click', closeMobileToolsSheet);
    }
    if (dom.mobileToolsSheet) {
      dom.mobileToolsSheet.addEventListener('click', (e) => {
        if (e.target === dom.mobileToolsSheet) closeMobileToolsSheet();
      });
    }
    if (dom.mobSheetAiTarget) {
      dom.mobSheetAiTarget.addEventListener('click', () => {
        closeMobileToolsSheet();
        openAiLauncherModal(state.activeModalPin || getAllPrompts()[0]);
      });
    }
    if (dom.mobSheetShowroomMode) {
      dom.mobSheetShowroomMode.addEventListener('click', () => {
        toggleClientMode();
        closeMobileToolsSheet();
      });
    }
    if (dom.mobSheetShopOrders) {
      dom.mobSheetShopOrders.addEventListener('click', () => {
        closeMobileToolsSheet();
        if (dom.btnHeaderShopOrders) dom.btnHeaderShopOrders.click();
      });
    }
    if (dom.mobSheetAddStyle) {
      dom.mobSheetAddStyle.addEventListener('click', () => {
        closeMobileToolsSheet();
        if (dom.btnHeaderAddStyle) dom.btnHeaderAddStyle.click();
      });
    }
    if (dom.mobSheetHistory) {
      dom.mobSheetHistory.addEventListener('click', () => {
        closeMobileToolsSheet();
        switchView('history');
      });
    }

    // 8. Lightbox Handlers
    dom.lightboxCloseBtn.addEventListener('click', closeLightbox);
    dom.fullscreenLightbox.addEventListener('click', (e) => {
      if (e.target === dom.fullscreenLightbox) closeLightbox();
    });

    // 9. Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.mobileToolsSheet && dom.mobileToolsSheet.classList.contains('active')) closeMobileToolsSheet();
        else if (dom.aiAutoTakeModal && dom.aiAutoTakeModal.classList.contains('active')) closeAiLauncherModal();
        else if (dom.presetPickerModal && dom.presetPickerModal.classList.contains('active')) closePresetPicker();
        else if (dom.addStyleModal && dom.addStyleModal.classList.contains('active')) closeAddStyleModal();
        else if (dom.shopOrdersModal && dom.shopOrdersModal.classList.contains('active')) closeShopOrdersModal();
        else if (dom.shopJobSlipModal && dom.shopJobSlipModal.classList.contains('active')) closeJobSlipModal();
        else if (dom.fullscreenLightbox.classList.contains('active')) closeLightbox();
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
      const hash = window.location.hash || '';
      if (hash.startsWith('#receipt')) {
        checkAndOpenReceiptFromUrl();
        return;
      }
      if (document.body.classList.contains('receipt-portal-active')) {
        document.body.classList.remove('receipt-portal-active');
        if (dom.clientReceiptPortal) dom.clientReceiptPortal.style.display = 'none';
      }
      const cleanHash = hash.replace('#', '');
      if (cleanHash && ['home', 'explore', 'boards', 'framing', 'saved', 'history'].includes(cleanHash)) {
        if (state.currentView !== cleanHash) switchView(cleanHash);
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
    updateHeaderAiIndicator();
    renderCategoryChips();
    setupEventListeners();

    if (checkAndOpenReceiptFromUrl()) {
      return;
    }

    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && ['home', 'explore', 'boards', 'framing', 'saved', 'history'].includes(initialHash)) {
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
