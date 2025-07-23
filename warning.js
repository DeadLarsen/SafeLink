// SafeLink Warning Page Script
class WarningPage {
    constructor() {
        this.targetUrl = null;
        this.countdown = 10;
        this.countdownInterval = null;
        this.init();
    }

    init() {
        this.parseUrl();
        this.loadStats();
        this.setupEventListeners();
        this.startCountdown();
    }

    parseUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        this.targetUrl = urlParams.get('url');
        
        console.log('SafeLink Warning: Получен URL из параметров:', this.targetUrl);
        
        if (this.targetUrl) {
            document.getElementById('dangerUrl').textContent = this.targetUrl;
            this.analyzeUrl();
        } else {
            // Если URL не найден, используем тестовый URL для демонстрации
            this.targetUrl = 'https://malware-site.com/test';
            document.getElementById('dangerUrl').textContent = this.targetUrl + ' (тестовый URL)';
            console.warn('SafeLink Warning: URL не найден в параметрах, используется тестовый URL');
            
            // Добавляем уведомление о тестовом режиме
            this.showTestModeNotification();
            this.analyzeUrl();
        }
    }

    showTestModeNotification() {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                left: 10px;
                background: #ffc107;
                color: #000;
                padding: 10px 15px;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                max-width: 300px;
            ">
                <div style="font-weight: bold; margin-bottom: 5px;">
                    🧪 Тестовый режим
                </div>
                <div>
                    Страница открыта напрямую. Используется тестовый URL для демонстрации.
                </div>
            </div>
        `;

        // Автоматически убираем через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        document.body.appendChild(notification);
    }

    analyzeUrl() {
        const reasonsList = document.getElementById('reasonsList');
        const reasons = [];

        try {
            const url = new URL(this.targetUrl);
            const domain = url.hostname.toLowerCase();

            // Анализируем домен на подозрительные паттерны
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

            // Проверяем подозрительные TLD
            const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf'];
            if (suspiciousTlds.some(tld => domain.endsWith(tld))) {
                reasons.push('Использует подозрительную доменную зону');
            }

            if (reasons.length > 0) {
                reasonsList.innerHTML = reasons.map(reason => `<li>${reason}</li>`).join('');
            }
        } catch (error) {
            console.error('Ошибка анализа URL:', error);
        }
    }

    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['safelink_stats']);
            if (result.safelink_stats) {
                document.getElementById('blockedCount').textContent = result.safelink_stats.blocked || 0;
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('goBackBtn').addEventListener('click', () => {
            window.history.back();
        });

        document.getElementById('allowSiteBtn').addEventListener('click', () => {
            this.allowSite();
        });

        document.getElementById('continueBtn').addEventListener('click', () => {
            this.continueTo();
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.history.back();
            }
        });
    }

    startCountdown() {
        const countdownElement = document.getElementById('countdown');
        const continueBtn = document.getElementById('continueBtn');
        
        if (!countdownElement || !continueBtn) {
            console.error('SafeLink Warning: Элементы countdown или continueBtn не найдены');
            return;
        }
        
        continueBtn.disabled = true;
        console.log('SafeLink Warning: Начат обратный отсчет:', this.countdown, 'секунд');
        
        this.countdownInterval = setInterval(() => {
            this.countdown--;
            countdownElement.textContent = this.countdown;
            
            if (this.countdown <= 0) {
                clearInterval(this.countdownInterval);
                continueBtn.disabled = false;
                continueBtn.innerHTML = 'Всё равно перейти';
                console.log('SafeLink Warning: Обратный отсчет завершен, кнопка активирована');
            }
        }, 1000);
    }

    async allowSite() {
        if (!this.targetUrl) return;

        try {
            await chrome.runtime.sendMessage({
                action: 'allowSite',
                url: this.targetUrl
            });

            // Увеличиваем счетчик разрешенных сайтов
            const result = await chrome.storage.local.get(['safelink_stats']);
            const stats = result.safelink_stats || { blocked: 0, allowed: 0 };
            stats.allowed++;
            await chrome.storage.local.set({ safelink_stats: stats });

            // Переходим на сайт
            window.location.href = this.targetUrl;
        } catch (error) {
            console.error('Ошибка разрешения сайта:', error);
            alert('Не удалось разрешить сайт. Попробуйте еще раз.');
        }
    }

    async continueTo() {
        console.log('SafeLink Warning: Попытка перехода на URL:', this.targetUrl);
        
        if (!this.targetUrl) {
            console.error('SafeLink Warning: targetUrl не установлен!');
            alert('Ошибка: URL назначения не найден. Проверьте параметры страницы.');
            return;
        }

        try {
            // Если это тестовый URL, показываем предупреждение
            if (this.targetUrl.includes('malware-site.com/test')) {
                const proceed = confirm(
                    'Это демонстрационная страница.\n\n' +
                    'В реальной ситуации вы перейдете на: ' + this.targetUrl + '\n\n' +
                    'Продолжить демонстрацию?'
                );
                
                if (!proceed) {
                    console.log('SafeLink Warning: Пользователь отменил переход');
                    return;
                }
                
                // Для демонстрации перенаправляем на безопасную страницу
                window.location.href = 'https://www.google.com/search?q=SafeLink+demo+completed';
                return;
            }

            // Увеличиваем счетчик игнорированных предупреждений
            const result = await chrome.storage.local.get(['safelink_stats']);
            const stats = result.safelink_stats || { blocked: 0, allowed: 0, ignored: 0 };
            stats.ignored = (stats.ignored || 0) + 1;
            await chrome.storage.local.set({ safelink_stats: stats });

            console.log('SafeLink Warning: Переход на:', this.targetUrl);
            window.location.href = this.targetUrl;
        } catch (error) {
            console.error('SafeLink Warning: Ошибка перехода:', error);
            // В случае ошибки все равно пытаемся перейти
            window.location.href = this.targetUrl;
        }
    }
}

// Инициализируем страницу предупреждения
document.addEventListener('DOMContentLoaded', () => {
    new WarningPage();
}); 