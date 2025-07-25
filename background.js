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
      blockMode: 'warn', // 'warn', 'disabled'
      phraseBlockMode: 'warn', // 'warn', 'disabled'
      phraseSensitivity: 'medium', // 'strict', 'medium', 'loose'
      markLinks: true, // выделять опасные ссылки
      autoUpdatePhrases: false, // автообновление фраз с Минюста (отключено)
      lastPhraseUpdate: 0 // timestamp последнего обновления
    };
    
    // Ограничение частоты запросов к API Минюста (5 секунд)
    this.minJustRequestDelay = 5000;
    this.lastMinJustRequest = 0;
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
      // Сначала загружаем локальные фразы как fallback
      let phrasesData = {};
      try {
        const response = await fetch(chrome.runtime.getURL('blocked-phrases.json'));
        phrasesData = await response.json();
        console.log('📁 SafeLink: Локальные фразы загружены как fallback');
      } catch (error) {
        console.warn('⚠️ SafeLink: Не удалось загрузить локальные фразы:', error);
      }
      
      // Пытаемся загрузить обновленные фразы с Минюста
      if (this.settings.autoUpdatePhrases) {
        const updatedPhrases = await this.loadPhrasesFromMinJust();
        if (updatedPhrases && updatedPhrases.size > 0) {
          console.log('🌐 SafeLink: Используем обновленные фразы с Минюста');
          this.blockedPhrases = updatedPhrases;
        } else {
          console.log('📁 SafeLink: Используем локальные фразы');
          this.blockedPhrases = new Set(phrasesData.all_phrases || []);
        }
      } else {
        console.log('📁 SafeLink: Автообновление отключено, используем локальные фразы');
        this.blockedPhrases = new Set(phrasesData.all_phrases || []);
      }
      
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
      if (this.settings.blockMode !== 'disabled') {
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
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('warning-phrase.html') + '?phrase=' + encodeURIComponent(phraseCheck.phrase) + '&search=' + encodeURIComponent(url)
        });
        return;
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

  async loadPhrasesFromMinJust() {
    try {
      // Проверяем ограничение частоты запросов (не чаще чем раз в 5 секунд)
      const now = Date.now();
      if (now - this.lastMinJustRequest < this.minJustRequestDelay) {
        console.log(`⏰ SafeLink: Пропускаем запрос к Минюсту (осталось ${Math.ceil((this.minJustRequestDelay - (now - this.lastMinJustRequest)) / 1000)}с)`);
        return this.getCachedPhrases();
      }
      
      // Проверяем кэш (обновляем не чаще раза в день)
      const cacheKey = 'safelink_minjust_phrases';
      const cacheTimestampKey = 'safelink_minjust_timestamp';
      const cached = await chrome.storage.local.get([cacheKey, cacheTimestampKey]);
      
      const cacheAge = now - (cached[cacheTimestampKey] || 0);
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      if (cached[cacheKey] && cacheAge < oneDayMs) {
        console.log(`💾 SafeLink: Используем кэшированные фразы (возраст: ${Math.round(cacheAge / (60 * 60 * 1000))}ч)`);
        return new Set(cached[cacheKey]);
      }
      
      console.log('🌐 SafeLink: Загружаем свежие фразы с minjust.gov.ru...');
      this.lastMinJustRequest = now;
      
      // Загружаем CSV с сайта Минюста
      const response = await fetch('https://minjust.gov.ru/uploaded/files/exportfsm.csv', {
        method: 'GET',
        headers: {
          'User-Agent': 'SafeLink Browser Extension',
          'Accept': 'text/csv,text/plain,*/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Получаем данные как ArrayBuffer для правильной обработки кодировки
      const arrayBuffer = await response.arrayBuffer();
      console.log(`📋 SafeLink: Получен CSV размером ${Math.round(arrayBuffer.byteLength / 1024)}KB`);
      
      // Декодируем Windows-1251 (CP1251) в UTF-8
      const csvText = this.decodeWindows1251(arrayBuffer);
      console.log(`🔤 SafeLink: Декодирован текст в UTF-8, первые 200 символов: "${csvText.substring(0, 200)}..."`);
      
             // Парсим CSV и извлекаем фразы
       const newPhrases = await this.parseMinJustCSV(csvText);
       
       if (newPhrases.size > 0) {
         // Объединяем с существующими фразами, избегая дубликатов
         const existingPhrases = cached[cacheKey] || [];
         const existingSet = new Set(existingPhrases);
         
         let addedCount = 0;
         newPhrases.forEach(phrase => {
           if (!existingSet.has(phrase)) {
             existingSet.add(phrase);
             addedCount++;
           }
         });
         
         const finalPhrases = Array.from(existingSet);
         
         // Сохраняем в кэш
         await chrome.storage.local.set({
           [cacheKey]: finalPhrases,
           [cacheTimestampKey]: now
         });
         
         // Обновляем timestamp последнего обновления
         this.settings.lastPhraseUpdate = now;
         await this.saveSettings();
         
                 console.log(`✅ SafeLink: Обработано ${newPhrases.size} новых фраз, добавлено ${addedCount} уникальных, итого в базе ${finalPhrases.length}`);
        return new Set(finalPhrases);
       } else {
         throw new Error('Не удалось извлечь фразы из CSV');
       }
      
    } catch (error) {
      console.error('❌ SafeLink: Ошибка загрузки фраз с Минюста:', error);
      return this.getCachedPhrases();
    }
  }

  async getCachedPhrases() {
    try {
      const cached = await chrome.storage.local.get(['safelink_minjust_phrases']);
      if (cached.safelink_minjust_phrases) {
        console.log('💾 SafeLink: Используем кэшированные фразы после ошибки');
        return new Set(cached.safelink_minjust_phrases);
      }
    } catch (error) {
      console.error('❌ SafeLink: Ошибка загрузки кэшированных фраз:', error);
    }
    return null;
  }

  async parseMinJustCSV(csvText) {
    try {
      console.log('🔍 SafeLink: Начинаем парсинг CSV Минюста...');
      const phrases = new Set();
      
      // Нормализуем переносы строк и разбиваем на строки
      const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalizedText.split('\n');
      console.log(`📋 SafeLink: Всего строк в CSV: ${lines.length}`);
      
      // Находим все записи, начинающиеся с номера
      const records = [];
      let currentRecord = '';
      let recordId = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Проверяем, начинается ли строка с номера записи
        const recordMatch = line.match(/^(\d+);"(.*)$/);
        
        if (recordMatch) {
          // Сохраняем предыдущую запись, если она была
          if (currentRecord && recordId) {
            records.push({ id: recordId, content: currentRecord });
          }
          
          // Начинаем новую запись
          recordId = recordMatch[1];
          currentRecord = recordMatch[2];
        } else {
          // Это продолжение текущей записи
          if (currentRecord) {
            currentRecord += ' ' + line;
          }
        }
      }
      
      // Добавляем последнюю запись
      if (currentRecord && recordId) {
        records.push({ id: recordId, content: currentRecord });
      }
      
      console.log(`📋 SafeLink: Найдено записей: ${records.length}`);
      
      let processed = 0;
      let extracted = 0;
      let validRecords = 0;
      
      for (const record of records) {
        processed++;
        
        if (processed % 1000 === 0) {
          console.log(`🔄 SafeLink: Обработано ${processed}/${records.length} записей, валидных: ${validRecords}, извлечено фраз: ${extracted}`);
        }
        
        try {
          let material = record.content;
          
          // Убираем завершающую кавычку и точку с запятой
          material = material.replace(/";?\s*$/, '');
          
          if (material && material.length > 0) {
            validRecords++;
            
            // Извлекаем только фразы в кавычках из описания материала
            const materialPhrases = this.extractKeyPhrases(material);
            
            materialPhrases.forEach(phrase => {
              if (phrase.length >= 3 && phrase.length <= 200) {
                phrases.add(phrase);
                extracted++;
              }
            });
            
            // Логируем первые несколько записей для отладки
            if (processed <= 5) {
              console.log(`📝 Запись ${record.id}: найдено фраз в кавычках: ${materialPhrases.length}`);
              if (materialPhrases.length > 0) {
                console.log(`   Фразы: ${materialPhrases.join(', ')}`);
              }
            }
          }
        } catch (recordError) {
          console.warn(`⚠️ SafeLink: Ошибка обработки записи ${record.id}:`, recordError.message);
        }
      }
      
      console.log(`✅ SafeLink: Парсинг завершен!`);
      console.log(`📊 Обработано записей: ${processed}`);
      console.log(`📊 Валидных записей: ${validRecords}`);
      console.log(`📊 Извлечено фраз: ${extracted}`);
      console.log(`📊 Уникальных фраз: ${phrases.size}`);
      
      return phrases;
      
    } catch (error) {
      console.error('❌ SafeLink: Ошибка парсинга CSV:', error);
      return new Set();
    }
  }

  parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
      i++;
    }
    
    fields.push(current); // Добавляем последнее поле
    return fields;
  }

  extractKeyPhrases(text) {
    if (!text || typeof text !== 'string') return [];
    
    const phrases = [];
    
    // Извлекаем только фразы в кавычках "" и «»
    const allQuotedMatches = [
      ...(text.match(/"([^"]+)"/g) || []),
      ...(text.match(/«([^»]+)»/g) || [])
    ];
    
    allQuotedMatches.forEach(match => {
      // Очищаем от кавычек
      const phrase = match.replace(/[""«»]/g, '').trim();
      
      // Фильтруем по длине и проверяем что это не служебное слово
      if (phrase.length >= 3 && phrase.length <= 200 && !this.isStopWord(phrase)) {
        phrases.push(phrase.toLowerCase());
      }
    });
    
    return [...new Set(phrases)]; // Убираем дубликаты
  }

  isStopWord(phrase) {
    const stopWords = [
      // Основные предлоги и союзы
      'и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'при', 'за', 'под', 'над', 'о', 'об', 'к', 'у',
      'из', 'без', 'через', 'между', 'среди', 'около', 'возле', 'против', 'вместо', 'кроме',
      'или', 'но', 'а', 'да', 'же', 'ли', 'бы', 'ни', 'не', 'то', 'так', 'уже', 'еще', 'тоже',
      // Местоимения
      'что', 'как', 'где', 'когда', 'почему', 'который', 'которая', 'которое', 'которые',
      'это', 'тот', 'та', 'то', 'те', 'свой', 'своя', 'свое', 'свои', 'мой', 'моя', 'мое', 'мои',
      'его', 'её', 'их', 'наш', 'наша', 'наше', 'наши', 'ваш', 'ваша', 'ваше', 'ваши',
      // Юридические термины (часто встречающиеся в документах)
      'номер', 'пункт', 'статья', 'часть', 'раздел', 'глава', 'абзац', 'подпункт', 'п', 'ст',
      'российской', 'федерации', 'рф', 'кодекс', 'закон', 'указ', 'постановление', 'решение',
      // Английские стоп-слова
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      // Очень короткие слова (1-2 символа)
      'до', 'на', 'по', 'за', 'из', 'от', 'об', 'со', 'во', 'ко'
    ];
    
    const lowerPhrase = phrase.toLowerCase().trim();
    
    // Проверяем точное совпадение
    if (stopWords.includes(lowerPhrase)) {
      return true;
    }
    
    // Исключаем очень короткие фразы (менее 3 символов)
    if (lowerPhrase.length < 3) {
      return true;
    }
    
    // Исключаем фразы состоящие только из цифр и специальных символов
    if (/^[\d\s\-№«»"".,;:!?()]+$/.test(lowerPhrase)) {
      return true;
    }
    
    return false;
  }

  isNumber(phrase) {
    return /^\d+$/.test(phrase) || /^\d+[\.,]\d+$/.test(phrase);
  }

  decodeWindows1251(arrayBuffer) {
    try {
      // Таблица соответствия Windows-1251 (CP1251) символов
      // Позиции 128-255 содержат кириллицу и специальные символы
      const cp1251Table = [
        0x0402, 0x0403, 0x201A, 0x0453, 0x201E, 0x2026, 0x2020, 0x2021, // 128-135
        0x20AC, 0x2030, 0x0409, 0x2039, 0x040A, 0x040C, 0x040B, 0x040F, // 136-143
        0x0452, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, // 144-151
        0x0098, 0x2122, 0x0459, 0x203A, 0x045A, 0x045C, 0x045B, 0x045F, // 152-159
        0x00A0, 0x040E, 0x045E, 0x0408, 0x00A4, 0x0490, 0x00A6, 0x00A7, // 160-167
        0x0401, 0x00A9, 0x0404, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x0407, // 168-175
        0x00B0, 0x00B1, 0x0406, 0x0456, 0x0491, 0x00B5, 0x00B6, 0x00B7, // 176-183
        0x0451, 0x2116, 0x0454, 0x00BB, 0x0458, 0x0405, 0x0455, 0x0457, // 184-191
        0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417, // 192-199 (А-З)
        0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E, 0x041F, // 200-207 (И-П)
        0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427, // 208-215 (Р-Ч)
        0x0428, 0x0429, 0x042A, 0x042B, 0x042C, 0x042D, 0x042E, 0x042F, // 216-223 (Ш-Я)
        0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437, // 224-231 (а-з)
        0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E, 0x043F, // 232-239 (и-п)
        0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447, // 240-247 (р-ч)
        0x0448, 0x0449, 0x044A, 0x044B, 0x044C, 0x044D, 0x044E, 0x044F  // 248-255 (ш-я)
      ];
      
      const uint8Array = new Uint8Array(arrayBuffer);
      let result = '';
      
      for (let i = 0; i < uint8Array.length; i++) {
        const byte = uint8Array[i];
        
        if (byte < 128) {
          // ASCII символы (0-127) остаются без изменений
          result += String.fromCharCode(byte);
        } else {
          // Символы 128-255 декодируем по таблице CP1251
          const unicodeCodePoint = cp1251Table[byte - 128];
          result += String.fromCharCode(unicodeCodePoint);
        }
      }
      
      console.log(`🔤 SafeLink: Декодировано ${uint8Array.length} байт из CP1251 в UTF-8`);
      return result;
      
    } catch (error) {
      console.error('❌ SafeLink: Ошибка декодирования CP1251:', error);
      // Fallback - пытаемся декодировать как UTF-8
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(arrayBuffer);
    }
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

        case 'reloadSiteLists':
          console.log('🔄 Background: reloadSiteLists received');
          try {
            await safeLinkCore.loadBlockedSites();
            console.log(`✅ Списки перезагружены: ${safeLinkCore.blockedSites.size} заблокированных, ${safeLinkCore.allowedSites.size} разрешенных`);
            sendResponse({ 
              success: true, 
              blockedCount: safeLinkCore.blockedSites.size,
              allowedCount: safeLinkCore.allowedSites.size
            });
          } catch (error) {
            console.error('❌ Background: reloadSiteLists failed:', error);
            sendResponse({ success: false, error: error.message });
          }
                    break;
          
        case 'clearAllPhrases':
          console.log('🗑️ Background: clearAllPhrases received');
          try {
            // Очищаем фразы в памяти
            safeLinkCore.blockedPhrases = new Set();
            
            // Очищаем из storage
            await chrome.storage.local.remove([
              'safelink_minjust_phrases',
              'safelink_minjust_timestamp'
            ]);
            
            console.log('✅ Все фразы очищены из памяти и storage');
            sendResponse({ 
              success: true, 
              message: 'Все фразы успешно удалены'
            });
          } catch (error) {
            console.error('❌ Background: clearAllPhrases failed:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
 
        case 'allowSite':
        if (request.url) {
          try {
            const domain = new URL(request.url).hostname;
            
            // Добавляем в разрешенные
            safeLinkCore.allowedSites.add(domain);
            
            // Удаляем из заблокированных (если есть в пользовательском списке)
            const result = await chrome.storage.local.get(['custom_blocked_sites', 'custom_allowed_sites']);
            let customBlocked = result.custom_blocked_sites || [];
            let customAllowed = result.custom_allowed_sites || [];
            
            // Удаляем домен из пользовательского списка заблокированных
            const originalLength = customBlocked.length;
            customBlocked = customBlocked.filter(site => site !== domain);
            
            // Добавляем в пользовательский список разрешенных (если еще нет)
            if (!customAllowed.includes(domain)) {
              customAllowed.push(domain);
            }
            
            // Сохраняем обновленные списки
            await chrome.storage.local.set({
              custom_blocked_sites: customBlocked,
              custom_allowed_sites: customAllowed
            });
            
            // Обновляем Set в памяти
            safeLinkCore.blockedSites.delete(domain);
            
            console.log(`✅ Сайт ${domain} перемещен из заблокированных в разрешенные`);
            if (originalLength !== customBlocked.length) {
              console.log(`📝 Удален из пользовательского списка заблокированных`);
            }
            
            sendResponse({ success: true });
          } catch (error) {
            console.error('❌ Ошибка разрешения сайта:', error);
            sendResponse({ success: false, error: error.message });
          }
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

      case 'updatePhrasesFromMinJust':
        console.log('🔄 Manual phrases update requested');
        try {
          // Сбрасываем timestamp последнего запроса для принудительного обновления
          safeLinkCore.lastMinJustRequest = 0;
          const phrases = await safeLinkCore.loadPhrasesFromMinJust();
          if (phrases && phrases.size > 0) {
            safeLinkCore.blockedPhrases = phrases;
            sendResponse({ 
              success: true, 
              count: phrases.size,
              message: `Обновление завершено! Загружено ${phrases.size} фраз из федерального списка Минюста РФ.`
            });
          } else {
            sendResponse({ success: false, error: 'Не удалось загрузить фразы' });
          }
        } catch (error) {
          console.error('❌ Manual phrases update failed:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'getPhrasesInfo':
        try {
          const cached = await chrome.storage.local.get(['safelink_minjust_timestamp']);
          const lastUpdate = cached.safelink_minjust_timestamp || 0;
          const age = lastUpdate > 0 ? Date.now() - lastUpdate : 0;
          
          sendResponse({
            success: true,
            phrasesCount: safeLinkCore.blockedPhrases.size,
            lastUpdate: lastUpdate,
            ageHours: Math.round(age / (60 * 60 * 1000)),
            autoUpdate: safeLinkCore.settings.autoUpdatePhrases
          });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'testCP1251Decoding':
        try {
          // Тестируем декодирование на локальном файле (если доступен)
          console.log('🧪 Testing CP1251 decoding...');
          const testResponse = await fetch('https://minjust.gov.ru/uploaded/files/exportfsm.csv');
          if (testResponse.ok) {
            const arrayBuffer = await testResponse.arrayBuffer();
            const decoded = safeLinkCore.decodeWindows1251(arrayBuffer);
            
            // Ищем тестовую фразу
            const testPhrase = 'Церберы свободы';
            const found = decoded.toLowerCase().includes(testPhrase.toLowerCase());
            
            const sample = decoded.substring(0, 500);
            sendResponse({
              success: true,
              testPhrase: testPhrase,
              found: found,
              sample: sample,
              sizeKB: Math.round(arrayBuffer.byteLength / 1024)
            });
          } else {
            sendResponse({ success: false, error: `HTTP ${testResponse.status}` });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'getPhrasesList':
        try {
          const phrasesArray = Array.from(safeLinkCore.blockedPhrases);
          const page = request.page || 1;
          const limit = request.limit || 50;
          const searchTerm = request.search || '';
          const sortBy = request.sortBy || 'alphabetical';
          
          // Фильтрация по поисковому запросу
          let filteredPhrases = phrasesArray;
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filteredPhrases = phrasesArray.filter(phrase => 
              phrase.toLowerCase().includes(searchLower)
            );
          }
          
          // Сортировка
          switch (sortBy) {
            case 'alphabetical':
              filteredPhrases.sort((a, b) => a.localeCompare(b, 'ru'));
              break;
            case 'length':
              filteredPhrases.sort((a, b) => a.length - b.length);
              break;
            case 'recent':
              // Для "recent" оставляем порядок как есть (последние добавленные)
              break;
          }
          
          // Пагинация
          const startIndex = (page - 1) * limit;
          const endIndex = startIndex + limit;
          const paginatedPhrases = filteredPhrases.slice(startIndex, endIndex);
          
          // Добавляем метаданные к фразам
          const phrasesWithMeta = paginatedPhrases.map(phrase => ({
            text: phrase,
            length: phrase.length,
            words: phrase.split(' ').length,
            type: phrase.split(' ').length === 1 ? 'слово' : 'фраза'
          }));
          
          sendResponse({
            success: true,
            phrases: phrasesWithMeta,
            pagination: {
              page: page,
              limit: limit,
              total: filteredPhrases.length,
              totalPages: Math.ceil(filteredPhrases.length / limit),
              hasNext: endIndex < filteredPhrases.length,
              hasPrev: page > 1
            },
            filter: {
              search: searchTerm,
              sortBy: sortBy
            }
          });
        } catch (error) {
          console.error('Error getting phrases list:', error);
          sendResponse({ success: false, error: error.message });
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

// Слушаем изменения в chrome.storage для автоматической перезагрузки списков
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Если изменились списки сайтов - перезагружаем их
    if (changes.custom_blocked_sites || changes.custom_allowed_sites) {
      console.log('🔄 Background: Обнаружены изменения в списках сайтов, перезагружаем...');
      safeLinkCore.loadBlockedSites().then(() => {
        console.log(`✅ Background: Списки автоматически перезагружены: ${safeLinkCore.blockedSites.size} заблокированных, ${safeLinkCore.allowedSites.size} разрешенных`);
      }).catch(error => {
        console.error('❌ Background: Ошибка автоматической перезагрузки списков:', error);
      });
    }
    
    // Если изменились настройки - обновляем их
    if (changes.safelink_settings) {
      console.log('⚙️ Background: Обнаружены изменения в настройках');
      safeLinkCore.loadSettings().then(() => {
        console.log('✅ Background: Настройки автоматически перезагружены');
      }).catch(error => {
        console.error('❌ Background: Ошибка перезагрузки настроек:', error);
      });
    }
  }
}); 