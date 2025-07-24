// SafeLink Popup Script
class SafeLinkPopup {
  constructor() {
    this.currentTab = null;
    this.settings = {};
    this.init();
  }

  async init() {
    await this.getCurrentTab();
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;
  }

  async loadSettings() {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    this.settings = response;
  }

  setupEventListeners() {
    // Переключение защиты
    document.getElementById('toggleProtection').addEventListener('click', () => {
      this.toggleProtection();
    });

    // Разрешить сайт
    document.getElementById('allowSite').addEventListener('click', () => {
      this.allowCurrentSite();
    });

    // Пожаловаться на сайт
    document.getElementById('reportSite').addEventListener('click', () => {
      this.reportSite();
    });

    // Открыть настройки
    document.getElementById('openOptions').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Открыть помощь
    document.getElementById('openHelp').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://safelink-help.com' });
    });
  }

  async updateUI() {
    // Обновляем статус защиты
    const protectionStatus = document.getElementById('protectionStatus');
    const toggleBtn = document.getElementById('toggleProtection');
    const toggleText = document.getElementById('toggleText');

    if (this.settings.blockMode === 'disabled') {
      protectionStatus.classList.add('disabled');
      protectionStatus.querySelector('span').textContent = '🔴 Вся защита отключена';
      protectionStatus.querySelector('.status-indicator').classList.add('disabled');
      toggleBtn.classList.add('danger');
      toggleText.textContent = 'Включить защиту';
    } else {
      protectionStatus.classList.remove('disabled');
      protectionStatus.querySelector('span').textContent = '🛡️ Защита активна (сайты + фразы)';
      protectionStatus.querySelector('.status-indicator').classList.remove('disabled');
      toggleBtn.classList.remove('danger');
      toggleText.textContent = 'Отключить защиту';
    }

    // Проверяем текущий сайт
    await this.checkCurrentSite();

    // PRO секция удалена
  }

  async checkCurrentSite() {
    if (!this.currentTab || !this.currentTab.url) return;

    const siteStatus = document.getElementById('siteStatus');
    const siteUrl = document.getElementById('siteUrl');
    const allowBtn = document.getElementById('allowSite');

    try {
      const urlObj = new URL(this.currentTab.url);
      const domain = urlObj.hostname;
      
      siteUrl.textContent = domain;

      // Проверяем URL через background script
      const response = await chrome.runtime.sendMessage({
        action: 'checkUrl',
        url: this.currentTab.url
      });

      if (response.blocked && !response.allowed) {
        // Сайт заблокирован
        siteStatus.className = 'site-status blocked';
        siteStatus.querySelector('.status-icon').textContent = '⚠️';
        siteStatus.querySelector('.status-text').textContent = 'Заблокирован';
        allowBtn.style.display = 'block';
      } else if (response.allowed) {
        // Сайт в whitelist
        siteStatus.className = 'site-status safe';
        siteStatus.querySelector('.status-icon').textContent = '✓';
        siteStatus.querySelector('.status-text').textContent = 'Разрешен';
        allowBtn.style.display = 'none';
      } else {
        // Сайт безопасен
        siteStatus.className = 'site-status safe';
        siteStatus.querySelector('.status-icon').textContent = '✓';
        siteStatus.querySelector('.status-text').textContent = 'Безопасен';
        allowBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('Ошибка проверки сайта:', error);
      siteStatus.className = 'site-status warning';
      siteStatus.querySelector('.status-icon').textContent = '?';
      siteStatus.querySelector('.status-text').textContent = 'Неизвестно';
      siteUrl.textContent = 'Системная страница';
      allowBtn.style.display = 'none';
    }
  }

  async toggleProtection() {
    console.log('🔄 toggleProtection clicked - current settings:', this.settings);
    
    const isCurrentlyDisabled = this.settings.blockMode === 'disabled';
    const newMode = isCurrentlyDisabled ? 'warn' : 'disabled';
    
    // Обновляем ОБА режима защиты: сайты И фразы
    const newSettings = {
      blockMode: newMode,
      phraseBlockMode: newMode,
      markLinks: newMode !== 'disabled' // true если включена защита, false если выключена
    };
    
    console.log('📤 Popup sending updateSettings message:', newSettings);
    
    try {
      console.log('📤 Popup: Sending message to background...');
      const response = await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: newSettings
      });
      
      console.log('📥 Popup received response:', response);
      console.log('📥 Response type:', typeof response);
      console.log('📥 Response success:', response?.success);
      
      if (response && response.success) {
        this.settings.blockMode = newMode;
        this.settings.phraseBlockMode = newMode;
        this.settings.markLinks = newMode !== 'disabled';
        this.updateUI();
        console.log('✅ Popup: Settings updated successfully');
      } else {
        console.error('❌ Popup: Failed to update settings:', response);
        console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
      }
    } catch (error) {
      console.error('❌ Popup: Error sending updateSettings:', error);
      console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
    }

    // Показываем уведомление
    this.showNotification(
      newMode === 'disabled' 
        ? '🔴 Вся защита отключена (сайты + фразы)' 
        : '🟢 Вся защита включена (сайты + фразы)',
      newMode === 'disabled' ? 'warning' : 'success'
    );
  }

  async allowCurrentSite() {
    if (!this.currentTab || !this.currentTab.url) return;

    await chrome.runtime.sendMessage({
      action: 'allowSite',
      url: this.currentTab.url
    });

    // Обновляем UI
    this.updateUI();

    // Перезагружаем страницу если она была заблокирована
    if (this.currentTab.url.includes('chrome-extension://')) {
      const urlParams = new URLSearchParams(this.currentTab.url.split('?')[1]);
      const originalUrl = urlParams.get('url');
      if (originalUrl) {
        chrome.tabs.update(this.currentTab.id, { url: originalUrl });
      }
    }

    this.showNotification('Сайт добавлен в исключения', 'success');
  }

  reportSite() {
    if (!this.currentTab || !this.currentTab.url) return;

    try {
      const urlObj = new URL(this.currentTab.url);
      const domain = urlObj.hostname;
      
      // Открываем форму жалобы
      const reportUrl = `https://safelink-report.com?domain=${encodeURIComponent(domain)}`;
      chrome.tabs.create({ url: reportUrl });
      
      this.showNotification('Спасибо за сообщение!', 'success');
    } catch (error) {
      this.showNotification('Не удалось отправить жалобу', 'error');
    }
  }

  updateProSection() {
    const syncStatus = document.getElementById('syncStatus');
    const lastSync = document.getElementById('lastSync');

    if (this.settings.autoSync) {
      syncStatus.textContent = 'Синхронизация: активна';
    } else {
      syncStatus.textContent = 'Синхронизация: отключена';
    }

    if (this.settings.lastSync) {
      const date = new Date(this.settings.lastSync);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffHours < 1) {
        lastSync.textContent = 'Последнее обновление: только что';
      } else if (diffHours < 24) {
        lastSync.textContent = `Последнее обновление: ${diffHours} ч. назад`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        lastSync.textContent = `Последнее обновление: ${diffDays} д. назад`;
      }
    } else {
      lastSync.textContent = 'Обновление не выполнялось';
    }
  }

  showNotification(message, type = 'info') {
    // Создаем временное уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#f44336'};
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      animation: slideDown 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Обработчики для кнопок донатов
document.addEventListener('DOMContentLoaded', () => {
  new SafeLinkPopup();
  
  // Кнопка YooKassa
  document.getElementById('donateYookassa').addEventListener('click', () => {
    // TODO: Заменить на реальную ссылку YooKassa
    const yookassaUrl = 'https://yookassa.ru/donate/safelink'; // Заглушка
    chrome.tabs.create({ url: yookassaUrl });
  });

  // Кнопка Bitcoin
  document.getElementById('donateBitcoin').addEventListener('click', () => {
    // TODO: Заменить на реальный Bitcoin адрес
    const bitcoinAddress = 'bc1qexamplebitcoinaddress123456789'; // Заглушка
    
    // Копируем адрес в буфер обмена
    navigator.clipboard.writeText(bitcoinAddress).then(() => {
      // Показываем уведомление
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      notification.textContent = '₿ Bitcoin адрес скопирован!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 2000);
    }).catch(() => {
      // Fallback: показываем адрес в алерте
      alert(`Bitcoin адрес:\n${bitcoinAddress}`);
    });
  });
}); 