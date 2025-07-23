// SafeLink Background Script
class SafeLinkCore {
  constructor() {
    this.blockedSites = new Set();
    this.allowedSites = new Set();
    this.settings = {
      blockMode: 'warn', // 'block', 'warn', 'disabled'
      proVersion: false,
      lastSync: null,
      autoSync: true
    };
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadBlockedSites();
    this.setupEventListeners();
    
    // Проверяем PRO версию и синхронизируем при необходимости
    if (this.settings.proVersion && this.settings.autoSync) {
      this.scheduleSync();
    }
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(['safelink_settings']);
    if (result.safelink_settings) {
      this.settings = { ...this.settings, ...result.safelink_settings };
    }
  }

  async saveSettings() {
    await chrome.storage.local.set({ safelink_settings: this.settings });
  }

  async loadBlockedSites() {
    try {
      // Загружаем локальный список
      const response = await fetch(chrome.runtime.getURL('blocked-sites.json'));
      const localSites = await response.json();
      
      // Загружаем пользовательский список
      const result = await chrome.storage.local.get(['custom_blocked_sites', 'custom_allowed_sites']);
      
      this.blockedSites = new Set([
        ...localSites.blocked,
        ...(result.custom_blocked_sites || [])
      ]);
      
      this.allowedSites = new Set(result.custom_allowed_sites || []);
      
      console.log(`SafeLink: Загружено ${this.blockedSites.size} заблокированных сайтов`);
    } catch (error) {
      console.error('SafeLink: Ошибка загрузки списка сайтов:', error);
    }
  }

  setupEventListeners() {
    // Перехватываем навигацию
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0) { // Только главный фрейм
        this.checkUrl(details.url, details.tabId);
      }
    });

    // Обработка сообщений от content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'checkUrl':
          const result = this.isUrlBlocked(request.url);
          sendResponse(result);
          break;
        case 'allowSite':
          this.allowSiteTemporarily(request.url);
          sendResponse({ success: true });
          break;
        case 'getSettings':
          sendResponse(this.settings);
          break;
        case 'updateSettings':
          this.updateSettings(request.settings);
          sendResponse({ success: true });
          break;
      }
    });

    // Обновление badge
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.updateBadge(activeInfo.tabId);
    });
  }

  async checkUrl(url, tabId) {
    if (this.settings.blockMode === 'disabled') return;

    const urlCheck = this.isUrlBlocked(url);
    
    if (urlCheck.blocked && !urlCheck.allowed) {
      if (this.settings.blockMode === 'block') {
        // Блокируем полностью (временно используем warning-extension для отладки)
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('warning-extension.html') + '?url=' + encodeURIComponent(url)
        });
      } else if (this.settings.blockMode === 'warn') {
        // Показываем предупреждение (используем отладочную версию)
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('warning-extension.html') + '?url=' + encodeURIComponent(url)
        });
      }
    }
  }

  isUrlBlocked(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Проверяем allowed sites (приоритет)
      if (this.allowedSites.has(domain)) {
        return { blocked: false, allowed: true, reason: 'whitelisted' };
      }

      // Проверяем точное совпадение домена
      if (this.blockedSites.has(domain)) {
        return { blocked: true, allowed: false, reason: 'exact_match', domain };
      }

      // Проверяем поддомены
      const domainParts = domain.split('.');
      for (let i = 1; i < domainParts.length; i++) {
        const parentDomain = domainParts.slice(i).join('.');
        if (this.blockedSites.has(parentDomain)) {
          return { blocked: true, allowed: false, reason: 'subdomain', domain: parentDomain };
        }
      }

      return { blocked: false, allowed: false, reason: 'not_in_list' };
    } catch (error) {
      console.error('SafeLink: Ошибка проверки URL:', error);
      return { blocked: false, allowed: false, reason: 'error' };
    }
  }

  allowSiteTemporarily(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      this.allowedSites.add(domain);
      
      // Сохраняем в storage
      chrome.storage.local.get(['custom_allowed_sites'], (result) => {
        const allowedList = result.custom_allowed_sites || [];
        if (!allowedList.includes(domain)) {
          allowedList.push(domain);
          chrome.storage.local.set({ custom_allowed_sites: allowedList });
        }
      });
    } catch (error) {
      console.error('SafeLink: Ошибка добавления в whitelist:', error);
    }
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
    
    // Если включена PRO версия, запускаем синхронизацию
    if (newSettings.proVersion && newSettings.autoSync) {
      this.scheduleSync();
    }
  }

  async updateBadge(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const urlCheck = this.isUrlBlocked(tab.url);
        if (urlCheck.blocked && !urlCheck.allowed) {
          chrome.action.setBadgeText({ text: '!', tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#ff0000', tabId });
        } else {
          chrome.action.setBadgeText({ text: '', tabId });
        }
      }
    } catch (error) {
      // Игнорируем ошибки для системных вкладок
    }
  }

  // PRO функции
  scheduleSync() {
    // Синхронизация каждые 24 часа
    const now = Date.now();
    const lastSync = this.settings.lastSync || 0;
    const syncInterval = 24 * 60 * 60 * 1000; // 24 часа

    if (now - lastSync > syncInterval) {
      this.syncWithRegistry();
    }

    // Планируем следующую синхронизацию
    setTimeout(() => {
      this.scheduleSync();
    }, syncInterval);
  }

  async syncWithRegistry() {
    if (!this.settings.proVersion) return;

    try {
      console.log('SafeLink PRO: Начинаем синхронизацию с реестром...');
      
      // TODO: Здесь будет запрос к API реестра
      // const response = await fetch('https://api.safelink.com/registry/blocked-sites');
      // const data = await response.json();
      
      // Пока что эмулируем ответ
      const simulatedResponse = {
        blocked_sites: [
          'malicious-site.com',
          'phishing-example.net',
          'fake-bank.org'
        ],
        updated_at: new Date().toISOString()
      };

      // Обновляем список
      const result = await chrome.storage.local.get(['custom_blocked_sites']);
      const customBlocked = result.custom_blocked_sites || [];
      
      // Объединяем с пользовательским списком
      const newBlockedSites = [...new Set([...customBlocked, ...simulatedResponse.blocked_sites])];
      
      await chrome.storage.local.set({ 
        registry_blocked_sites: simulatedResponse.blocked_sites,
        registry_updated: simulatedResponse.updated_at
      });

      // Перезагружаем списки
      await this.loadBlockedSites();
      
      this.settings.lastSync = Date.now();
      await this.saveSettings();
      
      console.log('SafeLink PRO: Синхронизация завершена');
    } catch (error) {
      console.error('SafeLink PRO: Ошибка синхронизации:', error);
    }
  }
}

// Инициализируем SafeLink
const safeLinkCore = new SafeLinkCore(); 