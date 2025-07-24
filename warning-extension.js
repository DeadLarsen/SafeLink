// warning-extension.js - JavaScript для warning-extension.html
// Предупреждение о заблокированных сайтах

class UrlWarningPage {
    constructor() {
        this.blockedUrl = '';
        this.init();
    }

    debugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(`[SafeLink URL] ${message}`);
        const debugDiv = document.getElementById('extensionDebug');
        if (debugDiv) {
            debugDiv.innerHTML += `${logEntry}<br>`;
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    }

    init() {
        this.debugLog('🔄 Initializing URL warning page...');
        try {
            this.parseUrlParams();
            this.updateInterface();
            this.setupEventListeners();
            this.debugLog('✅ URL warning initialized successfully.');
        } catch (error) {
            this.debugLog(`❌ Init error: ${error.message}`);
        }
    }

    parseUrlParams() {
        this.debugLog('🔍 Parsing URL parameters...');
        const urlParams = new URLSearchParams(window.location.search);
        this.blockedUrl = urlParams.get('url') || 'неизвестный URL';
        try {
            this.blockedUrl = decodeURIComponent(this.blockedUrl);
        } catch (e) {
            this.debugLog(`⚠️ Failed to decode URL: ${e.message}`);
        }
        this.debugLog(`🎯 Blocked URL: ${this.blockedUrl}`);
    }

    updateInterface() {
        this.debugLog('🎨 Updating interface...');
        const urlElement = document.getElementById('blockedUrl');
        if (urlElement) {
            urlElement.textContent = this.blockedUrl;
        }
    }

    setupEventListeners() {
        this.debugLog('🔧 Setting up event listeners...');
        
        document.getElementById('goBackBtn')?.addEventListener('click', () => {
            this.debugLog('👆 Back button clicked.');
            this.goBack();
        });

        document.getElementById('allowSiteBtn')?.addEventListener('click', () => {
            this.debugLog('👆 Allow site button clicked.');
            this.allowSite();
        });

        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.addEventListener('click', () => {
                this.debugLog('👆 Continue button clicked.');
                this.continueToUrl();
            });
        }
    }

    goBack() {
        this.debugLog('🔙 Executing go back...');
        this.updateStats('blocked');
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'https://www.google.com';
        }
    }

    allowSite() {
        this.debugLog(`✅ Allowing site: ${this.blockedUrl}`);
        this.updateStats('allowed');
        if (chrome && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'allowSite', url: this.blockedUrl }, () => {
                this.debugLog(`🚀 Redirecting to allowed site: ${this.blockedUrl}`);
                window.location.href = this.blockedUrl;
            });
        }
    }

    continueToUrl() {
        this.debugLog(`🚀 Continuing to URL: ${this.blockedUrl}`);
        this.updateStats('ignored');
        
        // Используем надежный метод с отправкой сообщения в background
        this.sendMessageRedirect(this.blockedUrl);
    }
    
    sendMessageRedirect(url) {
        this.debugLog(`🔄 Sending message to background for redirect to: ${url}`);
        
        try {
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'openUrl',
                    url: url
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        this.debugLog(`❌ Background message failed: ${chrome.runtime.lastError.message}`);
                        // Если фон не ответил, пробуем прямой переход
                        window.location.href = url;
                        return;
                    }
                    
                    if (response && response.success) {
                        this.debugLog('✅ Background script acknowledged. Redirecting...');
                        // Фон разрешил, теперь можно переходить
                        window.location.href = url;
                    } else {
                        this.debugLog(`❌ Background script response indicates failure: ${response?.error}`);
                        // Если фон ответил ошибкой, все равно пробуем перейти
                        window.location.href = url;
                    }
                });
            } else {
                this.debugLog('⚠️ Chrome runtime not available. Using direct redirect.');
                window.location.href = url;
            }
        } catch (error) {
            this.debugLog(`❌ Message sending failed: ${error.message}. Using direct redirect.`);
            window.location.href = url;
        }
    }

    updateStats(type) {
        // This can be expanded later if site-specific stats are needed
        this.debugLog(`📊 Updating stats for type: ${type}`);
        if (chrome && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'updateStats', type: type });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new UrlWarningPage();
}); 