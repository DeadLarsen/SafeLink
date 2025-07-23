// test-phrases.js - Тестирование блокировки поисковых фраз

class PhraseTester {
    constructor() {
        this.blockedPhrases = ['тесто'];
        this.safePhrases = [
            'погода завтра',
            'рецепт борща',
            'как учить английский',
            'купить телефон',
            'новости спорта',
            'фильмы 2024',
            'программирование javascript',
            'путешествия по россии'
        ];
        
        this.searchEngines = {
            'google': 'https://www.google.com/search?q=',
            'yandex': 'https://yandex.ru/search/?text=',
            'bing': 'https://www.bing.com/search?q=',
            'mail': 'https://go.mail.ru/search?q='
        };
        
        this.init();
    }

    debugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(`[PhraseTester] ${message}`);

        const debugDiv = document.getElementById('debugLog');
        if (debugDiv) {
            debugDiv.innerHTML += `${logEntry}<br>`;
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    }

    async init() {
        this.debugLog('🚀 Initializing phrase tester...');
        
        try {
            await this.loadBlockedPhrases();
            this.renderTestPhrases();
            this.loadStats();
            this.setupEventListeners();
            
            this.debugLog('✅ Phrase tester initialized successfully');
        } catch (error) {
            this.debugLog(`❌ Initialization error: ${error.message}`);
        }
    }

    async loadBlockedPhrases() {
        this.debugLog('📥 Loading blocked phrases...');
        
        try {
            // Загружаем некоторые тестовые фразы из blocked-phrases.json
            const response = await fetch(chrome.runtime.getURL('blocked-phrases.json'));
            const data = await response.json();
            
            // Берем по несколько фраз из каждой категории для тестирования
            const testPhrases = [];
            
            if (data.categories) {
                Object.entries(data.categories).forEach(([category, phrases]) => {
                    if (phrases && phrases.length > 0) {
                        // Берем первые 3 фразы из каждой категории
                        testPhrases.push(...phrases.slice(0, 3).map(phrase => ({
                            text: phrase,
                            category: category
                        })));
                    }
                });
            }
            
            // Если ничего не найдено, используем тестовые данные
            if (testPhrases.length === 0) {
                this.blockedPhrases = [
                    { text: 'экстремистская организация', category: 'organizations' },
                    { text: 'запрещенная книга', category: 'books' },
                    { text: 'террористический сайт', category: 'websites' },
                    { text: 'националистический журнал', category: 'magazines' }
                ];
            } else {
                this.blockedPhrases = testPhrases.slice(0, 12); // Ограничиваем количество
            }
            
            this.debugLog(`📋 Loaded ${this.blockedPhrases.length} test phrases`);
            
        } catch (error) {
            this.debugLog(`⚠️ Error loading phrases: ${error.message}`);
            // Используем тестовые данные в случае ошибки
            this.blockedPhrases = [
                { text: 'тестовая запрещенная фраза', category: 'general' },
                { text: 'экстремистский материал', category: 'general' }
            ];
        }
    }

    renderTestPhrases() {
        this.debugLog('🎨 Rendering test phrases...');
        
        // Рендерим заблокированные фразы
        const blockedContainer = document.getElementById('blockedPhrases');
        if (blockedContainer) {
            blockedContainer.innerHTML = '';
            
            this.blockedPhrases.forEach((phrase, index) => {
                const phraseElement = document.createElement('div');
                phraseElement.className = 'phrase-item blocked';
                phraseElement.innerHTML = `
                    <div class="phrase-text">${phrase.text}</div>
                    <div class="phrase-category">${this.getCategoryDisplayName(phrase.category)}</div>
                `;
                phraseElement.onclick = () => this.testPhrase(phrase.text, true);
                blockedContainer.appendChild(phraseElement);
            });
        }
        
        // Рендерим безопасные фразы
        const safeContainer = document.getElementById('safePhrases');
        if (safeContainer) {
            safeContainer.innerHTML = '';
            
            this.safePhrases.forEach((phrase, index) => {
                const phraseElement = document.createElement('div');
                phraseElement.className = 'phrase-item';
                phraseElement.innerHTML = `
                    <div class="phrase-text">${phrase}</div>
                    <div class="phrase-category">безопасная</div>
                `;
                phraseElement.onclick = () => this.testPhrase(phrase, false);
                safeContainer.appendChild(phraseElement);
            });
        }
        
        this.debugLog('✅ Test phrases rendered');
    }

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

    async loadStats() {
        this.debugLog('📊 Loading statistics...');
        
        try {
            let stats = { blocked: 0, ignored: 0 };
            
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                try {
                    stats = await chrome.runtime.sendMessage({ action: 'getPhraseStats' });
                } catch (error) {
                    this.debugLog(`⚠️ Failed to get stats from background: ${error.message}`);
                    // Пытаемся получить напрямую из storage
                    const result = await chrome.storage.local.get(['safelink_phrase_stats']);
                    stats = result.safelink_phrase_stats || { blocked: 0, ignored: 0 };
                }
            }
            
            // Рендерим статистику
            this.renderStats(stats);
            
        } catch (error) {
            this.debugLog(`❌ Error loading stats: ${error.message}`);
            this.renderStats({ blocked: 0, ignored: 0 });
        }
    }

    renderStats(stats) {
        const statsContainer = document.getElementById('statsGrid');
        if (!statsContainer) return;
        
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.blocked || 0}</div>
                <div class="stat-label">Заблокировано запросов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.ignored || 0}</div>
                <div class="stat-label">Пропущено запросов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.blockedPhrases.length}</div>
                <div class="stat-label">Тестовых фраз</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.safePhrases.length}</div>
                <div class="stat-label">Безопасных фраз</div>
            </div>
        `;
    }

    setupEventListeners() {
        this.debugLog('🔧 Setting up event listeners...');
        
        // Обработчик для ручного ввода
        const manualInput = document.getElementById('manualQuery');
        if (manualInput) {
            manualInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.testManualSearch();
                }
            });
        }
        
        // Делаем функцию доступной глобально
        window.testManualSearch = () => this.testManualSearch();
        
        this.debugLog('✅ Event listeners set up');
    }

    async testPhrase(phrase, shouldBeBlocked) {
        this.debugLog(`🧪 Testing phrase: "${phrase}" (should be ${shouldBeBlocked ? 'blocked' : 'safe'})`);
        
        try {
            // Проверяем фразу через background script
            let isBlocked = false;
            
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                try {
                    const result = await chrome.runtime.sendMessage({
                        action: 'checkPhrase',
                        phrase: phrase
                    });
                    isBlocked = result.blocked;
                    this.debugLog(`📋 Background check result: ${isBlocked ? 'blocked' : 'allowed'}`);
                } catch (error) {
                    this.debugLog(`⚠️ Background check failed: ${error.message}`);
                }
            }
            
            // Формируем поисковый URL
            const engine = document.getElementById('engineSelect')?.value || 'google';
            const searchUrl = this.searchEngines[engine] + encodeURIComponent(phrase);
            
            if (isBlocked && shouldBeBlocked) {
                this.debugLog(`✅ Correct: Phrase correctly blocked`);
                this.showAlert(`✅ Фраза "${phrase}" корректно заблокирована`, 'success');
            } else if (!isBlocked && !shouldBeBlocked) {
                this.debugLog(`✅ Correct: Phrase correctly allowed`);
                this.showAlert(`✅ Фраза "${phrase}" корректно разрешена`, 'success');
                // Переходим к поиску
                window.open(searchUrl, '_blank');
            } else if (isBlocked && !shouldBeBlocked) {
                this.debugLog(`❌ False positive: Safe phrase was blocked`);
                this.showAlert(`❌ Ложное срабатывание: безопасная фраза "${phrase}" была заблокирована`, 'warning');
            } else {
                this.debugLog(`❌ False negative: Blocked phrase was allowed`);
                this.showAlert(`❌ Пропуск: заблокированная фраза "${phrase}" была разрешена`, 'warning');
                // Все равно переходим, чтобы увидеть что происходит
                window.open(searchUrl, '_blank');
            }
            
        } catch (error) {
            this.debugLog(`❌ Test error: ${error.message}`);
            this.showAlert(`❌ Ошибка тестирования: ${error.message}`, 'warning');
        }
    }

    testManualSearch() {
        const queryInput = document.getElementById('manualQuery');
        const engineSelect = document.getElementById('engineSelect');
        
        if (!queryInput || !engineSelect) {
            this.debugLog('❌ Input elements not found');
            return;
        }
        
        const query = queryInput.value.trim();
        const engine = engineSelect.value;
        
        if (!query) {
            this.showAlert('⚠️ Введите поисковый запрос', 'warning');
            return;
        }
        
        this.debugLog(`🔍 Manual search test: "${query}" on ${engine}`);
        
        // Тестируем как потенциально заблокированную фразу
        this.testPhrase(query, null); // null означает что мы не знаем должна ли быть заблокирована
    }

    showAlert(message, type = 'info') {
        // Создаем временный alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.textContent = message;
        
        // Вставляем в начало контейнера
        const container = document.querySelector('.container');
        const firstSection = container.querySelector('.test-section');
        container.insertBefore(alertDiv, firstSection);
        
        // Убираем через 5 секунд
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Инициализация при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🌟 DOM loaded, creating PhraseTester');
        window.phraseTester = new PhraseTester();
    });
} else {
    console.log('🌟 DOM already ready, creating PhraseTester');
    window.phraseTester = new PhraseTester();
}

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error(`💥 JavaScript error: ${event.error.message}`);
}); 