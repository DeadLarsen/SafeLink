// warning-phrase.js - JavaScript для warning-phrase.html
// Предупреждение о заблокированных поисковых фразах

class PhraseWarningPage {
    constructor() {
        this.blockedPhrase = '';
        this.originalSearch = '';
        this.searchEngine = '';
        this.category = 'general';
        this.countdown = 10;
        this.countdownInterval = null;
        
        this.debugLog('🚀 Phrase warning script starting...');
        this.init();
    }

    // Логирование с временными метками
    debugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(`[SafeLink Phrases] ${message}`);

        const debugDiv = document.getElementById('phraseDebug');
        if (debugDiv) {
            debugDiv.innerHTML += `${logEntry}<br>`;
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    }

    // Инициализация
    init() {
        this.debugLog('🔄 Starting phrase warning initialization...');
        try {
            this.parseUrlParams();
            this.updateInterface();
            this.loadStats();
            this.setupEventListeners();
            this.debugLog('✅ Phrase warning initialized successfully');
        } catch (error) {
            this.debugLog(`❌ Init error: ${error.message}`);
        }
    }

    // Парсинг параметров URL
    parseUrlParams() {
        this.debugLog('🔍 Parsing URL parameters...');
        const urlParams = new URLSearchParams(window.location.search);
        
        // Получаем и декодируем фразу
        this.blockedPhrase = urlParams.get('phrase') || 'неизвестная фраза';
        try {
            this.blockedPhrase = decodeURIComponent(this.blockedPhrase);
        } catch (e) {
            this.debugLog(`⚠️ Failed to decode phrase: ${e.message}`);
        }
        
        // Получаем и декодируем исходный поисковый URL
        this.originalSearch = urlParams.get('search') || '';
        if (this.originalSearch) {
            try {
                // Декодируем URL (может быть двойно закодирован)
                let decodedUrl = decodeURIComponent(this.originalSearch);
                
                // Проверяем, не нужно ли декодировать еще раз
                if (decodedUrl.includes('%')) {
                    try {
                        decodedUrl = decodeURIComponent(decodedUrl);
                        this.debugLog('📝 Applied double URL decoding');
                    } catch (e) {
                        this.debugLog('📝 Single URL decoding was sufficient');
                    }
                }
                
                this.originalSearch = decodedUrl;
                this.debugLog(`🔗 Decoded original search: ${this.originalSearch}`);
            } catch (error) {
                this.debugLog(`⚠️ URL decoding failed: ${error.message}`);
            }
        }
        
        this.debugLog(`🎯 Blocked phrase: ${this.blockedPhrase}`);
        this.debugLog(`🔗 Original search URL: ${this.originalSearch}`);
        
        // Извлекаем информацию о поисковой системе
        if (this.originalSearch) {
            try {
                const url = new URL(this.originalSearch);
                this.searchEngine = url.hostname;
                this.debugLog(`🌐 Search engine: ${this.searchEngine}`);
            } catch (error) {
                this.debugLog(`⚠️ Error parsing search URL: ${error.message}`);
                this.searchEngine = 'неизвестная';
            }
        }
    }

    // Обновление интерфейса
    updateInterface() {
        this.debugLog('🎨 Updating interface...');
        
        try {
            // Обновляем заблокированную фразу
            const phraseElement = document.getElementById('blockedPhrase');
            if (phraseElement) {
                phraseElement.textContent = this.blockedPhrase;
            }
            
            // Обновляем категорию
            const categoryElement = document.getElementById('phraseCategory');
            if (categoryElement) {
                categoryElement.textContent = this.getCategoryDisplayName(this.category);
            }
            
            // Обновляем информацию о поисковой системе
            const engineElement = document.getElementById('engineName');
            if (engineElement) {
                engineElement.textContent = this.getSearchEngineDisplayName(this.searchEngine);
            }
            
            // Обновляем оригинальный запрос
            const queryElement = document.getElementById('originalQuery');
            if (queryElement && this.originalSearch) {
                try {
                    const url = new URL(this.originalSearch);
                    const params = url.searchParams;
                    const query = this.extractQueryFromUrl(url);
                    queryElement.textContent = query || 'не удалось извлечь запрос';
                } catch (error) {
                    queryElement.textContent = 'ошибка извлечения запроса';
                }
            }
            
            // Обновляем текст причины
            this.updateReasonText();
            
            this.debugLog('✅ Interface updated successfully');
            
        } catch (error) {
            this.debugLog(`❌ Interface update error: ${error.message}`);
        }
    }

    // Извлечение поискового запроса из URL
    extractQueryFromUrl(url) {
        const params = url.searchParams;
        const domain = url.hostname.toLowerCase();
        
        // Параметры для разных поисковых систем
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
        
        for (const [engine, param] of Object.entries(queryParams)) {
            if (domain.includes(engine)) {
                return params.get(param);
            }
        }
        
        return params.get('q') || params.get('query') || params.get('text');
    }

    // Получение отображаемого имени поисковой системы
    getSearchEngineDisplayName(engine) {
        const engines = {
            'google.com': 'Google',
            'google.ru': 'Google Россия',
            'yandex.ru': 'Яндекс',
            'yandex.com': 'Yandex',
            'bing.com': 'Bing',
            'mail.ru': 'Mail.ru',
            'rambler.ru': 'Rambler',
            'yahoo.com': 'Yahoo',
            'duckduckgo.com': 'DuckDuckGo'
        };
        
        return engines[engine] || engine || 'неизвестная';
    }

    // Получение отображаемого имени категории
    getCategoryDisplayName(category) {
        const categories = {
            'books': 'книги',
            'websites': 'сайты',
            'magazines': 'журналы',
            'videos': 'видео',
            'organizations': 'организации',
            'general': 'общая'
        };
        
        return categories[category] || 'общая';
    }

    // Обновление текста причины блокировки
    updateReasonText() {
        const reasonElement = document.getElementById('reasonText');
        if (!reasonElement) return;
        
        const categoryTexts = {
            'books': 'Данная книга или публикация содержится в федеральном списке экстремистских материалов.',
            'websites': 'Данный веб-сайт заблокирован по решению уполномоченных органов.',
            'magazines': 'Данное издание признано экстремистским материалом.',
            'videos': 'Данное видео содержание запрещено к распространению.',
            'organizations': 'Данная организация признана экстремистской или террористической.',
            'general': 'Данная фраза содержится в федеральном списке запрещенных материалов.'
        };
        
        reasonElement.textContent = categoryTexts[this.category] || categoryTexts['general'];
    }

    // Загрузка статистики
    async loadStats() {
        this.debugLog('📊 Loading statistics...');
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['safelink_phrase_stats']);
                const stats = result.safelink_phrase_stats || { blocked: 0, allowed: 0 };
                
                const countElement = document.getElementById('blockedCount');
                if (countElement) {
                    countElement.textContent = stats.blocked || 0;
                }
                
                this.debugLog(`📈 Loaded phrase stats: ${stats.blocked} blocked`);
            } else {
                this.debugLog('⚠️ Chrome storage not available');
                const countElement = document.getElementById('blockedCount');
                if (countElement) {
                    countElement.textContent = '42';
                }
            }
        } catch (error) {
            this.debugLog(`❌ Stats loading error: ${error.message}`);
        }
    }

    // Установка обработчиков событий
    setupEventListeners() {
        this.debugLog('🔧 Setting up event listeners...');
        
        // Кнопка "Назад"
        const goBackBtn = document.getElementById('goBackBtn');
        if (goBackBtn) {
            goBackBtn.addEventListener('click', (e) => {
                this.debugLog('👆 Back button clicked');
                e.preventDefault();
                this.goBack();
            });
            this.debugLog('✅ Back button listener attached');
        }

        // Кнопка "Изменить запрос"
        const modifyBtn = document.getElementById('modifySearchBtn');
        if (modifyBtn) {
            modifyBtn.addEventListener('click', (e) => {
                this.debugLog('👆 Modify search button clicked');
                e.preventDefault();
                this.modifySearch();
            });
            this.debugLog('✅ Modify button listener attached');
        }

        // Кнопка "Продолжить"
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.disabled = false; // Кнопка активна сразу
            continueBtn.addEventListener('click', (e) => {
                this.debugLog('👆 Continue button clicked');
                e.preventDefault();
                this.continueSearch();
            });
            this.debugLog('✅ Continue button listener attached');
        }

        // Клавиатурные сокращения
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.debugLog('⌨️ Escape key pressed');
                this.goBack();
            }
        });
        this.debugLog('⌨️ Keyboard shortcuts set up');
    }

    // Возврат назад
    goBack() {
        this.debugLog('🔙 Executing go back...');
        try {
            this.updateStats('blocked');
            
            if (window.history.length > 1) {
                this.debugLog('📝 Using history.back()');
                window.history.back();
            } else {
                this.debugLog('📝 No history, redirecting to safe page');
                window.location.href = 'https://www.google.com';
            }
        } catch (error) {
            this.debugLog(`❌ Go back error: ${error.message}`);
            window.location.href = 'https://www.google.com';
        }
    }

    // Изменение поискового запроса
    modifySearch() {
        this.debugLog('✏️ Modifying search query...');
        
        const newQuery = prompt(
            `Введите новый поисковый запрос вместо "${this.blockedPhrase}":`,
            ''
        );
        
        if (newQuery && newQuery.trim()) {
            this.debugLog(`📝 New query: ${newQuery}`);
            
            try {
                // Формируем URL для нового поиска
                let searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(newQuery.trim());
                
                // Пытаемся использовать ту же поисковую систему
                if (this.originalSearch) {
                    const originalUrl = new URL(this.originalSearch);
                    const domain = originalUrl.hostname;
                    
                    if (domain.includes('yandex')) {
                        searchUrl = `https://yandex.ru/search/?text=${encodeURIComponent(newQuery.trim())}`;
                    } else if (domain.includes('mail.ru')) {
                        searchUrl = `https://go.mail.ru/search?q=${encodeURIComponent(newQuery.trim())}`;
                    } else if (domain.includes('bing')) {
                        searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(newQuery.trim())}`;
                    }
                }
                
                this.debugLog(`🔗 Redirecting to: ${searchUrl}`);
                window.location.href = searchUrl;
                
            } catch (error) {
                this.debugLog(`❌ Modify search error: ${error.message}`);
                // Fallback to Google
                window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(newQuery.trim());
            }
        } else {
            this.debugLog('🚫 User cancelled or entered empty query');
        }
    }

    // Продолжение поиска
    async continueSearch() {
        this.debugLog('🚀 Continuing original search...');
        
        const proceed = confirm(
            `Вы уверены что хотите продолжить поиск по фразе "${this.blockedPhrase}"?\n\nЭтот материал может быть запрещен законодательством РФ.`
        );
        
        if (!proceed) {
            this.debugLog('🚫 User cancelled search continuation');
            return;
        }
        
        try {
            this.updateStats('ignored');
            
            if (this.originalSearch) {
                this.debugLog(`🔗 Original search URL: ${this.originalSearch}`);
                
                // Декодируем URL если он закодирован
                let targetUrl = this.originalSearch;
                try {
                    targetUrl = decodeURIComponent(this.originalSearch);
                    this.debugLog(`🔗 Decoded URL: ${targetUrl}`);
                } catch (e) {
                    this.debugLog(`⚠️ URL decode failed, using original: ${e.message}`);
                }
                
                this.debugLog(`🎯 Final target URL: ${targetUrl}`);
                
                // Сразу используем background script - самый надежный метод
                this.debugLog('📤 Using background script for reliable redirect...');
                this.fallbackRedirect(targetUrl);
            } else {
                this.debugLog('❌ No original search URL available');
                alert('Не удалось восстановить оригинальный поисковый запрос');
            }
            
        } catch (error) {
            this.debugLog(`❌ Continue search error: ${error.message}`);
            alert('Произошла ошибка при переходе к поиску');
        }
    }

    // Fallback метод для перехода
    fallbackRedirect(url) {
        this.debugLog(`🔄 Primary redirect method to: ${url}`);
        
        // Сначала пробуем послать сообщение background script (ОСНОВНОЙ МЕТОД)
        try {
            this.debugLog('📤 Sending message to background script...');
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'openUrl',
                    url: url
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        this.debugLog(`❌ Background message failed: ${chrome.runtime.lastError.message}`);
                        this.tryDirectRedirect(url);
                                         } else if (response && response.success && response.redirect) {
                        this.debugLog(`✅ Background script added URL to ignored list successfully`);
                        
                        // Показываем уведомление что переходим
                        const notification = document.createElement('div');
                        notification.style.cssText = `
                            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                            background: #4CAF50; color: white; padding: 15px 25px;
                            border-radius: 8px; z-index: 10000; font-weight: bold;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        `;
                        notification.textContent = '✅ Переход разрешен! Перенаправляем...';
                        document.body.appendChild(notification);
                        
                        // Перенаправляем эту же вкладку на Google
                        this.debugLog('🔄 Warning: Redirecting this tab to Google');
                        setTimeout(() => {
                            window.location.href = url;
                        }, 500);
                        
                        return; // ВАЖНО: не продолжаем выполнение
                    } else {
                        this.debugLog('❌ Background script response indicates failure');
                        this.tryDirectRedirect(url);
                    }
                });
                
                // Устанавливаем таймаут на случай если background script не ответит
                setTimeout(() => {
                    this.debugLog('⏰ Background script timeout, redirecting same tab');
                    // Простое перенаправление в той же вкладке
                    window.location.href = url;
                }, 2000);
                
                return; // Ждем ответа от background script
            }
        } catch (error) {
            this.debugLog(`❌ Message to background failed: ${error.message}`);
        }
        
        // Если background script не доступен, пробуем прямые методы
        this.tryDirectRedirect(url);
    }
    
    // Прямые методы перехода (ТОЛЬКО В ТОЙ ЖЕ ВКЛАДКЕ)
    tryDirectRedirect(url) {
        this.debugLog(`🔄 Trying direct redirect to: ${url} (same tab only)`);
        
        try {
            // Метод 1: Изменение location текущего окна
            this.debugLog('🔄 Method 1: window.location...');
            window.location.href = url;
            return;
        } catch (e) {
            this.debugLog(`❌ window.location failed: ${e.message}`);
        }
        
        try {
            // Метод 2: Через top window
            this.debugLog('🔄 Method 2: window.top.location...');
            if (window.top && window.top !== window) {
                window.top.location.href = url;
                return;
            }
        } catch (e) {
            this.debugLog(`❌ window.top.location failed: ${e.message}`);
        }
        
        // Последний шанс - ручное копирование (НЕ СОЗДАЕМ НОВУЮ ВКЛАДКУ!)
        this.debugLog('🚨 All redirect methods failed, showing manual copy dialog');
        const copyText = `Автоматический переход не удался.\nСкопируйте и вставьте эту ссылку в адресную строку:\n\n${url}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                alert(copyText + '\n\n✅ Ссылка скопирована в буфер обмена');
            }).catch(() => {
                alert(copyText);
            });
        } else {
            alert(copyText);
        }
    }

    // Обновление статистики
    async updateStats(type) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['safelink_phrase_stats']);
                const stats = result.safelink_phrase_stats || { blocked: 0, ignored: 0 };
                stats[type] = (stats[type] || 0) + 1;
                await chrome.storage.local.set({ safelink_phrase_stats: stats });
                this.debugLog(`📊 Phrase stats updated: ${type}`);
            }
        } catch (error) {
            this.debugLog(`⚠️ Stats update failed: ${error.message}`);
        }
    }
}

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🌟 DOM loaded, creating PhraseWarningPage');
        window.phraseWarningPage = new PhraseWarningPage();
    });
} else {
    console.log('🌟 DOM already ready, creating PhraseWarningPage');
    window.phraseWarningPage = new PhraseWarningPage();
}

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error(`💥 JavaScript error: ${event.error.message}`);
}); 