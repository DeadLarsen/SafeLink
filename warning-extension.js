// warning-extension.js - JavaScript для warning-extension.html
// Исправляет CSP ошибку "Refused to execute inline script"

class ExtensionWarningPage {
    constructor() {
        this.targetUrl = null;
        this.countdown = 10;
        this.countdownInterval = null;
        
        this.debugLog('📋 ExtensionWarningPage constructor called');
        this.init();
    }

    // Логирование с временными метками
    debugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(`[SafeLink Extension] ${message}`);

        // Показываем в Extension Debug Log на странице
        const debugDiv = document.getElementById('extensionDebug');
        if (debugDiv) {
            debugDiv.innerHTML += `${logEntry}<br>`;
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    }

    // Инициализация компонента
    init() {
        this.debugLog('🔄 Starting initialization...');
        try {
            this.parseUrl();
            this.loadStats();
            this.attachEventListeners();
            this.startCountdown();
            this.debugLog('✅ Initialization completed successfully');
        } catch (error) {
            this.debugLog(`❌ Init error: ${error.message}`);
        }
    }

    // Парсинг URL
    parseUrl() {
        this.debugLog('🔍 Parsing URL parameters...');
        const urlParams = new URLSearchParams(window.location.search);
        this.targetUrl = urlParams.get('url');
        
        this.debugLog(`🎯 Target URL: ${this.targetUrl}`);
        
        if (this.targetUrl) {
            document.getElementById('dangerUrl').textContent = this.targetUrl;
            this.analyzeUrl();
            this.debugLog('✅ URL parsed from parameters');
        } else {
            this.targetUrl = 'https://example-dangerous-site.com/test';
            document.getElementById('dangerUrl').textContent = this.targetUrl + ' (fallback URL)';
            this.debugLog('⚠️ No URL parameter, using fallback');
        }
    }

    // Анализ URL на угрозы
    analyzeUrl() {
        this.debugLog('🔍 Analyzing URL for threats...');
        const reasonsList = document.getElementById('reasonsList');
        const reasons = [];

        try {
            const url = new URL(this.targetUrl);
            const domain = url.hostname.toLowerCase();

            if (domain.includes('phishing') || domain.includes('fake')) {
                reasons.push('Домен содержит подозрительные ключевые слова');
            }
            
            if (domain.includes('malware') || domain.includes('virus')) {
                reasons.push('Домен ассоциируется с вредоносным ПО');
            }
            
            if (domain.includes('scam') || domain.includes('fraud')) {
                reasons.push('Домен может быть связан с мошенничеством');
            }

            if (url.protocol === 'http:') {
                reasons.push('Сайт не использует безопасное соединение (HTTPS)');
            }

            if (reasons.length > 0) {
                reasonsList.innerHTML = reasons.map(reason => `<li>${reason}</li>`).join('');
                this.debugLog(`📝 Found ${reasons.length} threat indicators`);
            }
        } catch (error) {
            this.debugLog(`❌ URL analysis error: ${error.message}`);
        }
    }

    // Загрузка статистики
    async loadStats() {
        this.debugLog('📊 Loading statistics...');
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['safelink_stats']);
                if (result.safelink_stats) {
                    document.getElementById('blockedCount').textContent = result.safelink_stats.blocked || 0;
                    this.debugLog(`📈 Loaded stats: ${result.safelink_stats.blocked || 0} blocked`);
                }
            } else {
                this.debugLog('⚠️ Chrome storage not available');
                document.getElementById('blockedCount').textContent = '42';
            }
        } catch (error) {
            this.debugLog(`❌ Stats loading error: ${error.message}`);
        }
    }

    // Установка обработчиков событий
    attachEventListeners() {
        try {
            // Кнопка "Назад"
            const goBackBtn = document.getElementById('goBackBtn');
            if (goBackBtn) {
                goBackBtn.addEventListener('click', (e) => {
                    this.debugLog('👆 Back button clicked');
                    e.preventDefault();
                    this.goBack();
                });
                this.debugLog('✅ Back button listener attached');
            } else {
                this.debugLog('❌ Back button not found');
            }

            // Кнопка "Разрешить сайт"
            const allowSiteBtn = document.getElementById('allowSiteBtn');
            if (allowSiteBtn) {
                allowSiteBtn.addEventListener('click', (e) => {
                    this.debugLog('👆 Allow button clicked');
                    e.preventDefault();
                    this.allowSite();
                });
                this.debugLog('✅ Allow button listener attached');
            } else {
                this.debugLog('❌ Allow button not found');
            }

            // Кнопка "Продолжить"
            const continueBtn = document.getElementById('continueBtn');
            if (continueBtn) {
                continueBtn.addEventListener('click', (e) => {
                    this.debugLog('👆 Continue button clicked');
                    e.preventDefault();
                    this.continueTo();
                });
                this.debugLog('✅ Continue button listener attached');
            } else {
                this.debugLog('❌ Continue button not found');
            }

            // Клавиатурные сокращения
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.debugLog('⌨️ Escape key pressed');
                    this.goBack();
                }
            });
            this.debugLog('⌨️ Keyboard shortcuts set up');

        } catch (error) {
            this.debugLog(`❌ Event listeners error: ${error.message}`);
        }
    }

    // Обратный отсчет
    startCountdown() {
        this.debugLog('⏰ Starting countdown...');
        const countdownElement = document.getElementById('countdown');
        const continueBtn = document.getElementById('continueBtn');
        
        if (!countdownElement || !continueBtn) {
            this.debugLog('❌ Countdown elements not found');
            return;
        }
        
        continueBtn.disabled = true;
        this.debugLog(`⏰ Countdown: ${this.countdown} seconds`);
        
        this.countdownInterval = setInterval(() => {
            this.countdown--;
            countdownElement.textContent = this.countdown;
            
            if (this.countdown <= 0) {
                clearInterval(this.countdownInterval);
                continueBtn.disabled = false;
                continueBtn.innerHTML = 'Всё равно перейти';
                this.debugLog('✅ Countdown finished, button enabled');
            }
        }, 1000);
    }

    // Возврат назад
    goBack() {
        this.debugLog('🔙 Executing go back...');
        try {
            // Обновляем статистику
            this.updateStats('blocked');
            
            // Пробуем разные методы возврата
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

    // Разрешить сайт
    async allowSite() {
        this.debugLog('✅ Allowing site...');
        if (!this.targetUrl) {
            this.debugLog('❌ No target URL to allow');
            return;
        }

        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                this.debugLog('📤 Sending allowSite message to background');
                await chrome.runtime.sendMessage({
                    action: 'allowSite',
                    url: this.targetUrl
                });
                this.debugLog('✅ Allow message sent successfully');
            } else {
                this.debugLog('⚠️ Chrome runtime not available');
            }

            this.debugLog(`🔗 Redirecting to: ${this.targetUrl}`);
            window.location.href = this.targetUrl;
        } catch (error) {
            this.debugLog(`❌ Allow site error: ${error.message}`);
            // Все равно пытаемся перейти
            window.location.href = this.targetUrl;
        }
    }

    // Обновление статистики
    async updateStats(type) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['safelink_stats']);
                const stats = result.safelink_stats || { blocked: 0, allowed: 0, ignored: 0 };
                stats[type] = (stats[type] || 0) + 1;
                await chrome.storage.local.set({ safelink_stats: stats });
                this.debugLog(`📊 Stats updated: ${type}`);
            }
        } catch (error) {
            this.debugLog(`⚠️ Stats update failed: ${error.message}`);
        }
    }

    // Продолжить к целевому сайту
    async continueTo() {
        this.debugLog(`🚀 Continue to: ${this.targetUrl}`);
        
        if (!this.targetUrl) {
            this.debugLog('❌ No target URL');
            alert('Error: No target URL found');
            return;
        }

        try {
            // Показываем подтверждение
            const proceed = confirm(
                `Вы уверены что хотите перейти на:\n\n${this.targetUrl}\n\nЭтот сайт может быть опасным!`
            );
            
            if (!proceed) {
                this.debugLog('🚫 User cancelled navigation');
                return;
            }

            // Обновляем статистику
            await this.updateStats('ignored');

            this.debugLog(`🔗 Attempting navigation to: ${this.targetUrl}`);
            
            // Пробуем разные методы навигации чтобы избежать "canceled" статуса
            try {
                // Метод 1: Direct window.location replacement
                this.debugLog('📍 Method 1: window.location.replace()');
                window.location.replace(this.targetUrl);
            } catch (replaceError) {
                this.debugLog(`❌ Replace failed: ${replaceError.message}`);
                
                try {
                    // Метод 2: Используем chrome.tabs API если доступно
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                        this.debugLog('📍 Method 2: chrome.tabs.update()');
                        chrome.tabs.getCurrent((tab) => {
                            chrome.tabs.update(tab.id, { url: this.targetUrl });
                        });
                        return;
                    }
                } catch (tabsError) {
                    this.debugLog(`❌ Tabs API failed: ${tabsError.message}`);
                }
                
                try {
                    // Метод 3: Открываем в новой вкладке как fallback
                    this.debugLog('📍 Method 3: window.open()');
                    window.open(this.targetUrl, '_blank');
                    // Закрываем текущую вкладку
                    setTimeout(() => window.close(), 1000);
                } catch (openError) {
                    this.debugLog(`❌ Window.open failed: ${openError.message}`);
                    
                    // Метод 4: Последняя попытка - стандартный href
                    this.debugLog('📍 Method 4: window.location.href (last resort)');
                    window.location.href = this.targetUrl;
                }
            }
            
        } catch (error) {
            this.debugLog(`❌ Continue error: ${error.message}`);
            // Экстренный fallback
            try {
                window.location.href = this.targetUrl;
            } catch (fallbackError) {
                this.debugLog(`❌ Emergency fallback failed: ${fallbackError.message}`);
                alert(`Не удалось перейти на сайт: ${this.targetUrl}\nПопробуйте открыть его вручную.`);
            }
        }
    }
}

// Extension-specific debugging function (global)
function debugLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const debugDiv = document.getElementById('extensionDebug');
    if (debugDiv) {
        debugDiv.innerHTML += `[${timestamp}] ${message}<br>`;
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
    console.log(`[SafeLink Extension] ${message}`);
}

debugLog('🚀 Extension warning script starting...');
debugLog(`📍 Location: ${window.location.href}`);
debugLog(`🔧 Chrome available: ${typeof chrome !== 'undefined'}`);
debugLog(`📦 Runtime available: ${typeof chrome !== 'undefined' && !!chrome.runtime}`);

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        debugLog('🌟 DOM loaded, creating ExtensionWarningPage');
        window.extensionWarningPage = new ExtensionWarningPage();
    });
} else {
    debugLog('🌟 DOM already ready, creating ExtensionWarningPage');
    window.extensionWarningPage = new ExtensionWarningPage();
}

// Обработка ошибок
window.addEventListener('error', (event) => {
    debugLog(`💥 JavaScript error: ${event.error.message}`);
});

debugLog('📄 Extension warning script loaded'); 