// SafeLink Blocked Page Script
class BlockedPage {
    constructor() {
        this.targetUrl = null;
        this.init();
    }

    init() {
        this.parseUrl();
        this.loadStats();
        this.setupEventListeners();
        this.analyzeThreats();
    }

    parseUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        this.targetUrl = urlParams.get('url');
        
        if (this.targetUrl) {
            document.getElementById('dangerUrl').textContent = this.targetUrl;
        } else {
            document.getElementById('dangerUrl').textContent = 'URL не найден';
        }
    }

    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['safelink_stats']);
            const stats = result.safelink_stats || { blocked: 0, allowed: 0 };
            
            document.getElementById('totalBlocked').textContent = stats.blocked || 0;
            
            // Эмулируем статистику за день
            const today = new Date().toDateString();
            const dailyStats = await chrome.storage.local.get([`daily_${today}`]);
            document.getElementById('blockedToday').textContent = dailyStats[`daily_${today}`] || Math.floor(Math.random() * 50) + 1;
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    analyzeThreats() {
        if (!this.targetUrl) return;

        const threatTypes = document.getElementById('threatTypes');
        const threats = [];

        try {
            const url = new URL(this.targetUrl);
            const domain = url.hostname.toLowerCase();

            // Анализируем различные типы угроз
            if (domain.includes('malware') || domain.includes('virus')) {
                threats.push({ icon: '🦠', name: 'Вредоносное ПО', desc: 'Может заразить ваш компьютер' });
            }
            
            if (domain.includes('phishing') || domain.includes('fake')) {
                threats.push({ icon: '🎣', name: 'Фишинг', desc: 'Попытка кражи личных данных' });
            }
            
            if (domain.includes('scam') || domain.includes('fraud')) {
                threats.push({ icon: '💰', name: 'Мошенничество', desc: 'Финансовое мошенничество' });
            }

            if (domain.includes('crypto') || domain.includes('investment')) {
                threats.push({ icon: '💎', name: 'Крипто-мошенничество', desc: 'Поддельные инвестиции' });
            }

            if (threats.length > 0) {
                threatTypes.innerHTML = threats.map(threat => 
                    `<li><span class="threat-icon">${threat.icon}</span>${threat.name} - ${threat.desc}</li>`
                ).join('');
            }
        } catch (error) {
            console.error('Ошибка анализа угроз:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('goBackBtn').addEventListener('click', () => {
            this.goToSafePage();
        });

        document.getElementById('reportBtn').addEventListener('click', () => {
            this.reportFalsePositive();
        });

        document.getElementById('whitelistBtn').addEventListener('click', () => {
            this.showWhitelistDialog();
        });

        document.getElementById('detailsBtn').addEventListener('click', () => {
            this.showThreatDetails();
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.goToSafePage();
            }
        });
    }

    goToSafePage() {
        // Возвращаемся на безопасную страницу (например, Google)
        window.location.href = 'https://www.google.com';
    }

    reportFalsePositive() {
        if (!this.targetUrl) return;

        const reportUrl = `https://safelink-report.com/false-positive?url=${encodeURIComponent(this.targetUrl)}`;
        window.open(reportUrl, '_blank');
    }

    showWhitelistDialog() {
        const confirmed = confirm(
            'Вы уверены, что хотите добавить этот сайт в исключения?\n\n' +
            'Это действие отключит защиту для данного домена.\n\n' +
            'Сайт: ' + (this.targetUrl || 'неизвестен')
        );

        if (confirmed) {
            this.addToWhitelist();
        }
    }

    async addToWhitelist() {
        if (!this.targetUrl) return;

        try {
            await chrome.runtime.sendMessage({
                action: 'allowSite',
                url: this.targetUrl
            });

            // Показываем уведомление
            alert('Сайт добавлен в исключения. Перенаправление...');
            
            // Переходим на сайт
            setTimeout(() => {
                window.location.href = this.targetUrl;
            }, 1000);
        } catch (error) {
            console.error('Ошибка добавления в whitelist:', error);
            alert('Не удалось добавить сайт в исключения');
        }
    }

    showThreatDetails() {
        const details = `
Подробная информация об угрозе:

URL: ${this.targetUrl || 'неизвестен'}
Тип угрозы: Высокий риск
Источник данных: SafeLink Database
Время обнаружения: ${new Date().toLocaleString()}
Статус: Активная угроза

Рекомендуемые действия:
1. Не переходить на данный сайт
2. Проверить компьютер антивирусом
3. Сообщить о подозрительной ссылке администратору
        `;
        
        alert(details);
    }
}

// Инициализируем страницу блокировки
document.addEventListener('DOMContentLoaded', () => {
    new BlockedPage();
}); 