// SafeLink Background Script
class SafeLinkCore {
  constructor() {
    this.blockedSites = new Set();
    this.allowedSites = new Set();
    this.blockedPhrases = new Set();
    this.phraseCategories = {};
    this.ignoredSearchUrls = new Set(); // URLs которые пользователь решил продолжить
    this.searchEngines = new Set([
      'google.com', 'google.ru', 'yandex.ru', 'yandex.com', 
      'bing.com', 'mail.ru', 'rambler.ru', 'yahoo.com', 'duckduckgo.com'
    ]);
    this.settings = {
      blockMode: 'warn', // 'block', 'warn', 'disabled'
      phraseBlockMode: 'warn', // 'block', 'warn', 'disabled'
      phraseSensitivity: 'medium', // 'strict', 'medium', 'loose'
      markLinks: true // выделять опасные ссылки
    };
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadBlockedSites();
    this.setupEventListeners();
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(['safelink_settings']);
    if (result.safelink_settings) {
      console.log('📥 Loading settings from storage:', result.safelink_settings);
      this.settings = { ...this.settings, ...result.safelink_settings };
      console.log('⚙️ Settings loaded and merged:', this.settings);
    } else {
      console.log('⚙️ No saved settings found, using defaults:', this.settings);
    }
  }

  async saveSettings() {
    await chrome.storage.local.set({ safelink_settings: this.settings });
    console.log('💾 Settings saved to storage:', this.settings);
  }

    // Нормализация URL для сравнения
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Декодируем все параметры запроса
      urlObj.searchParams.forEach((value, key) => {
        try {
          const decodedValue = decodeURIComponent(value);
          urlObj.searchParams.set(key, decodedValue);
        } catch (e) {
          // Если декодирование не удалось, оставляем как есть
        }
      });
      const normalized = urlObj.toString();
      console.log('🔄 Background: URL normalized from:', url);
      console.log('🔄 Background: URL normalized to:', normalized);
      return normalized;
    } catch (error) {
      console.log('⚠️ Background: URL normalization failed, using original:', url);
      return url;
    }
  }

  // Добавить URL в игнорируемые (persistent)
  async addToIgnoredUrls(url) {
    try {
      console.log('🏃‍♂️ Background: Starting addToIgnoredUrls for:', url);
      
      // Нормализуем URL
      const normalizedUrl = this.normalizeUrl(url);
      
      // Добавляем в memory (и нормализованный, и оригинальный)
      this.ignoredSearchUrls.add(url);
      this.ignoredSearchUrls.add(normalizedUrl);
      console.log('🧠 Background: Added to memory cache (both URLs)');
      
      // Добавляем в storage с timestamp (нормализованный)
      const result = await chrome.storage.local.get(['safelink_ignored_urls']);
      const ignoredUrls = result.safelink_ignored_urls || {};
      console.log('📂 Background: Current ignored URLs count:', Object.keys(ignoredUrls).length);
      
      // Добавляем нормализованный URL с timestamp
      ignoredUrls[normalizedUrl] = Date.now();
      
      await chrome.storage.local.set({ safelink_ignored_urls: ignoredUrls });
      console.log('💾 Background: Saved normalized URL to persistent storage successfully');
      
      // Проверяем что сохранилось
      const verification = await chrome.storage.local.get(['safelink_ignored_urls']);
      const saved = verification.safelink_ignored_urls || {};
      if (saved[normalizedUrl]) {
        console.log('✅ Background: Verification passed - normalized URL found in storage');
      } else {
        console.log('❌ Background: Verification failed - normalized URL not found in storage!');
      }
      
      // Автоудаление через 60 секунд (увеличено)
      setTimeout(() => {
        this.removeFromIgnoredUrls(normalizedUrl).catch(error => {
          console.error('❌ Background: Auto-cleanup failed:', error);
        });
      }, 60000);
      
    } catch (error) {
      console.error('❌ Background: Failed to add ignored URL:', error);
      throw error; // Пробрасываем ошибку наверх
    }
  }

  // Удалить URL из игнорируемых
  async removeFromIgnoredUrls(url) {
    try {
      // Удаляем из memory
      this.ignoredSearchUrls.delete(url);
      
      // Удаляем из storage
      const result = await chrome.storage.local.get(['safelink_ignored_urls']);
      const ignoredUrls = result.safelink_ignored_urls || {};
      
      if (ignoredUrls[url]) {
        delete ignoredUrls[url];
        await chrome.storage.local.set({ safelink_ignored_urls: ignoredUrls });
        console.log('🔄 Background: Removed from ignored list:', url);
      }
    } catch (error) {
      console.error('❌ Background: Failed to remove ignored URL:', error);
    }
  }

  // Проверить, игнорируется ли URL
  async isUrlIgnored(url) {
    try {
      console.log('🔍 Background: Checking if URL is ignored:', url);
      
      // Нормализуем URL для проверки
      const normalizedUrl = this.normalizeUrl(url);
      
      // Проверяем memory первым делом (и оригинальный, и нормализованный)
      if (this.ignoredSearchUrls.has(url) || this.ignoredSearchUrls.has(normalizedUrl)) {
        console.log('✅ Background: Found in memory cache');
        return true;
      }
      
      // Проверяем persistent storage
      const result = await chrome.storage.local.get(['safelink_ignored_urls']);
      const ignoredUrls = result.safelink_ignored_urls || {};
      console.log('📂 Background: Checking storage, current ignored count:', Object.keys(ignoredUrls).length);
      
      // Логируем все URL в storage для отладки
      Object.keys(ignoredUrls).forEach(ignoredUrl => {
        console.log('📋 Background: Storage contains:', ignoredUrl);
      });
      
      // Проверяем нормализованный URL в storage
      if (ignoredUrls[normalizedUrl]) {
        const timestamp = ignoredUrls[normalizedUrl];
        const now = Date.now();
        const age = now - timestamp;
        
        console.log(`⏰ Background: Found normalized URL in storage, age: ${age}ms (limit: 60000ms)`);
        
        // Проверяем, не истек ли срок (60 секунд)
        if (age < 60000) {
          // Синхронизируем с memory
          this.ignoredSearchUrls.add(url);
          this.ignoredSearchUrls.add(normalizedUrl);
          console.log('✅ Background: URL is ignored (found normalized URL in storage)');
          return true;
        } else {
          // Удаляем просроченный
          console.log('🗑️ Background: Normalized URL expired, removing from ignored list');
          await this.removeFromIgnoredUrls(normalizedUrl);
          return false;
        }
      }
      
      console.log('❌ Background: Neither original nor normalized URL found in ignored list');
      return false;
    } catch (error) {
      console.error('❌ Background: Failed to check ignored URL:', error);
      return false;
    }
  }

  async loadBlockedSites() {
    try {
      // Загружаем локальный список сайтов
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
      
      // Загружаем заблокированные фразы
      await this.loadBlockedPhrases();
      
    } catch (error) {
      console.error('SafeLink: Ошибка загрузки списка сайтов:', error);
    }
  }

  async loadBlockedPhrases() {
    try {
      const response = await fetch(chrome.runtime.getURL('blocked-phrases.json'));
      const phrasesData = await response.json();
      
      this.blockedPhrases = new Set(phrasesData.all_phrases || []);
      this.phraseCategories = phrasesData.categories || {};
      
      // Обновляем список поисковых систем
      if (phrasesData.search_engines) {
        this.searchEngines = new Set(phrasesData.search_engines);
      }
      
      console.log(`SafeLink: Загружено ${this.blockedPhrases.size} заблокированных фраз`);
      console.log(`Категории: книги(${this.phraseCategories.books?.length || 0}), сайты(${this.phraseCategories.websites?.length || 0}), общие(${this.phraseCategories.general?.length || 0})`);
      
    } catch (error) {
      console.error('SafeLink: Ошибка загрузки списка фраз:', error);
    }
  }

  setupEventListeners() {
    // Перехватываем навигацию
    chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
      if (details.frameId === 0) { // Только главный фрейм
        try {
          await this.checkUrl(details.url, details.tabId);
        } catch (error) {
          console.error('❌ Background: checkUrl failed in webNavigation:', error);
        }
      }
    });

    // Примечание: Обработчик сообщений перенесен в глобальную область после инициализации класса
  }

  async checkUrl(url, tabId) {
    console.log('🛡️ checkUrl called with settings:', {
      blockMode: this.settings.blockMode,
      phraseBlockMode: this.settings.phraseBlockMode,
      url: url
    });
    console.log('🛡️ Full settings object:', this.settings);
    
    if (this.settings.blockMode === 'disabled' && this.settings.phraseBlockMode === 'disabled') {
      console.log('🔴 ALL PROTECTION DISABLED - skipping all checks');
      return;
    }

    // Проверяем, не находится ли URL в списке игнорируемых (пользователь нажал "Продолжить")
    const isIgnored = await this.isUrlIgnored(url);
    if (isIgnored) {
      console.log('✅ Background: URL is in ignored list, skipping checks:', url);
      return;
    }

    // Проверка заблокированных сайтов
    const urlCheck = this.isUrlBlocked(url);
    
    if (urlCheck.blocked && !urlCheck.allowed) {
      if (this.settings.blockMode === 'block') {
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('warning-extension.html') + '?url=' + encodeURIComponent(url)
        });
      } else if (this.settings.blockMode === 'warn') {
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('warning-extension.html') + '?url=' + encodeURIComponent(url)
        });
      }
      return;
    }

    // Проверка поисковых запросов на заблокированные фразы
    console.log('📝 Checking phrases with phraseBlockMode:', this.settings.phraseBlockMode);
    if (this.settings.phraseBlockMode !== 'disabled') {
      const phraseCheck = this.checkSearchQuery(url);
      console.log('📝 Phrase check result:', phraseCheck);
      
      if (phraseCheck.blocked) {
        if (this.settings.phraseBlockMode === 'block') {
          chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL('warning-phrase.html') + '?phrase=' + encodeURIComponent(phraseCheck.phrase) + '&search=' + encodeURIComponent(url)
          });
        } else if (this.settings.phraseBlockMode === 'warn') {
          chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL('warning-phrase.html') + '?phrase=' + encodeURIComponent(phraseCheck.phrase) + '&search=' + encodeURIComponent(url)
          });
        }
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

  // Получение статистики по фразам
  async getPhraseStats() {
    try {
      const result = await chrome.storage.local.get(['safelink_phrase_stats']);
      return result.safelink_phrase_stats || { blocked: 0, ignored: 0 };
    } catch (error) {
      console.error('SafeLink: Ошибка получения статистики фраз:', error);
      return { blocked: 0, ignored: 0 };
    }
  }

  // Временное разрешение сайта
  allowSiteTemporarily(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      this.allowedSites.add(domain);
      
      // Сохраняем в storage
      chrome.storage.local.get(['custom_allowed_sites'], (result) => {
        const allowedSites = result.custom_allowed_sites || [];
        if (!allowedSites.includes(domain)) {
          allowedSites.push(domain);
          chrome.storage.local.set({ custom_allowed_sites: allowedSites });
        }
      });
      
      console.log(`SafeLink: Сайт ${domain} временно разрешен`);
    } catch (error) {
      console.error('SafeLink: Ошибка разрешения сайта:', error);
    }
  }

  // Обновление настроек
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await chrome.storage.local.set({ safelink_settings: this.settings });
    console.log('SafeLink: Настройки обновлены:', this.settings);
    
    // Уведомляем все content-скрипты об изменении настроек
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: this.settings
          });
        } catch (error) {
          // Игнорируем ошибки для вкладок, где нет content-скрипта
        }
      }
      console.log('📢 Background: Настройки отправлены всем content-скриптам');
    } catch (error) {
      console.error('❌ Background: Ошибка уведомления content-скриптов:', error);
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

  // Проверка поискового запроса на заблокированные фразы
  checkSearchQuery(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Проверяем, является ли это поисковой системой
      const isSearchEngine = this.searchEngines.has(domain) || 
                            Array.from(this.searchEngines).some(engine => domain.includes(engine));
      
      if (!isSearchEngine) {
        return { blocked: false, reason: 'not_search_engine' };
      }
      
      // Извлекаем поисковый запрос из URL
      const searchQuery = this.extractSearchQuery(url, domain);
      
      if (!searchQuery) {
        return { blocked: false, reason: 'no_query' };
      }
      
      // Проверяем запрос на заблокированные фразы
      const phraseCheck = this.isPhraseBlocked(searchQuery);
      
      if (phraseCheck.blocked) {
        return {
          blocked: true,
          phrase: phraseCheck.phrase,
          category: phraseCheck.category,
          query: searchQuery,
          searchEngine: domain,
          reason: 'blocked_phrase'
        };
      }
      
      return { blocked: false, reason: 'phrase_allowed' };
      
    } catch (error) {
      console.error('SafeLink: Ошибка проверки поискового запроса:', error);
      return { blocked: false, reason: 'error' };
    }
  }

  // Извлечение поискового запроса из URL различных поисковых систем
  extractSearchQuery(url, domain) {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    // Параметры запроса для разных поисковых систем
    const queryParams = {
      'google.com': 'q',
      'google.ru': 'q',
      'yandex.ru': 'text',
      'yandex.com': 'text',
      'bing.com': 'q',
      'mail.ru': 'q',
      'rambler.ru': 'query',
      'yahoo.com': 'p',
      'duckduckgo.com': 'q'
    };
    
    // Определяем параметр запроса для данной поисковой системы
    let queryParam = 'q'; // по умолчанию
    for (const [engine, param] of Object.entries(queryParams)) {
      if (domain.includes(engine)) {
        queryParam = param;
        break;
      }
    }
    
    const query = params.get(queryParam);
    return query ? decodeURIComponent(query).toLowerCase().trim() : null;
  }

  // Проверка фразы на блокировку
  isPhraseBlocked(query) {
    if (!query || query.length < 3) {
      return { blocked: false, reason: 'too_short' };
    }
    
    const normalizedQuery = query.toLowerCase().trim();
    
    // Точное совпадение
    if (this.blockedPhrases.has(normalizedQuery)) {
      return {
        blocked: true,
        phrase: normalizedQuery,
        category: this.findPhraseCategory(normalizedQuery),
        matchType: 'exact'
      };
    }
    
    // Частичное совпадение (если включено)
    if (this.settings.phraseSensitivity !== 'strict') {
      for (const blockedPhrase of this.blockedPhrases) {
        if (blockedPhrase.length >= 4) {
          // Проверяем вхождение заблокированной фразы в запрос
          if (normalizedQuery.includes(blockedPhrase)) {
            return {
              blocked: true,
              phrase: blockedPhrase,
              category: this.findPhraseCategory(blockedPhrase),
              matchType: 'partial'
            };
          }
          
          // Если режим "loose", проверяем и обратное вхождение
          if (this.settings.phraseSensitivity === 'loose' && blockedPhrase.includes(normalizedQuery)) {
            return {
              blocked: true,
              phrase: blockedPhrase,
              category: this.findPhraseCategory(blockedPhrase),
              matchType: 'contained'
            };
          }
        }
      }
    }
    
    return { blocked: false, reason: 'not_found' };
  }

  // Поиск категории фразы
  findPhraseCategory(phrase) {
    for (const [category, phrases] of Object.entries(this.phraseCategories)) {
      if (phrases && phrases.includes(phrase)) {
        return category;
      }
    }
    return 'general';
  }
}

// Обработчик сообщений от popup и content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background получил сообщение:', request);

  (async () => {
    try {
      switch (request.action) {
        case 'getSettings':
          sendResponse(safeLinkCore.settings);
          break;

        case 'updateSettings':
          console.log('📨 Background: updateSettings received:', request);
          if (request.settings) {
            try {
              await safeLinkCore.updateSettings(request.settings);
              sendResponse({ success: true });
            } catch (error) {
              console.error('❌ Background: updateSettings failed:', error);
              sendResponse({ success: false, error: error.message });
            }
          } else {
            console.log('❌ No settings provided in request');
            sendResponse({ success: false, error: 'No settings provided' });
          }
          break;

      case 'allowSite':
        if (request.url) {
          const domain = new URL(request.url).hostname;
          safeLinkCore.allowedSites.add(domain);
          await safeLinkCore.saveSettings(); // Changed from saveAllowedSites to saveSettings
          console.log('✅ Сайт добавлен в исключения:', domain);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No URL provided' });
        }
        break;

      case 'openUrl':
        if (request.url) {
          // Добавляем URL в список игнорируемых
          const normalizedUrl = safeLinkCore.normalizeUrl(request.url);
          safeLinkCore.ignoredSearchUrls.add(normalizedUrl);
          await safeLinkCore.saveSettings(); // Changed from saveIgnoredUrls to saveSettings
          
          console.log('🔗 Background: Opening URL:', request.url);
          
          // Не создаем новую вкладку, только подтверждаем
          sendResponse({ success: true, tabCreated: false });
        } else {
          sendResponse({ success: false, error: 'No URL provided' });
        }
        break;

      case 'checkUrl':
        if (request.url) {
          console.log('🔍 Content script checking URL:', request.url);
          const result = safeLinkCore.isUrlBlocked(request.url);
          console.log('🔍 URL check result:', result);
          sendResponse(result);
        } else {
          sendResponse({ blocked: false, error: 'No URL provided' });
        }
        break;

      case 'checkPhrase':
        if (request.phrase) {
          console.log('📝 Content script checking phrase:', request.phrase);
          const result = safeLinkCore.isPhraseBlocked(request.phrase);
          console.log('📝 Phrase check result:', result);
          sendResponse(result);
        } else {
          sendResponse({ blocked: false, error: 'No phrase provided' });
        }
        break;

      default:
        console.warn('⚠️ Неизвестное действие:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('❌ Ошибка обработки сообщения:', error);
    sendResponse({ success: false, error: error.message });
  }
  })(); // Закрываем IIFE

  return true; // Указываем, что ответ будет асинхронным
});

// Инициализируем SafeLink
const safeLinkCore = new SafeLinkCore(); 