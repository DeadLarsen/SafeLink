// SafeLink Options Script
class SafeLinkOptions {
  constructor() {
    this.settings = {};
    this.blockedSites = [];
    this.allowedSites = [];
    this.stats = {};
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupNavigation();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadData() {
    try {
      // Загружаем настройки
      const settingsResult = await chrome.storage.local.get(['safelink_settings']);
      this.settings = settingsResult.safelink_settings || {
        blockMode: 'warn',
        proVersion: false,
        markLinks: true,
        showNotifications: true,
        collectStats: true,
        autoSync: true
      };

      // Загружаем списки сайтов
      const listsResult = await chrome.storage.local.get(['custom_blocked_sites', 'custom_allowed_sites']);
      this.blockedSites = listsResult.custom_blocked_sites || [];
      this.allowedSites = listsResult.custom_allowed_sites || [];

      // Загружаем статистику
      const statsResult = await chrome.storage.local.get(['safelink_stats']);
      this.stats = statsResult.safelink_stats || {
        blocked: 0,
        allowed: 0,
        installDate: Date.now()
      };
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        // Убираем активные классы
        navButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));
        
        // Добавляем активные классы
        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  }

  setupEventListeners() {
    // Настройки защиты
    this.setupProtectionSettings();
    
    // Управление списками
    this.setupListManagement();
    
    // PRO функции
    this.setupProFeatures();
    
    // Статистика
    this.setupStatistics();
  }

  setupProtectionSettings() {
    // Режим блокировки
    const blockModeRadios = document.querySelectorAll('input[name="blockMode"]');
    blockModeRadios.forEach(radio => {
      radio.addEventListener('change', async () => {
        if (radio.checked) {
          this.settings.blockMode = radio.value;
          await this.saveSettings();
          this.showNotification('Режим защиты изменен', 'success');
        }
      });
    });

    // Дополнительные настройки
    const toggles = [
      { id: 'markLinks', setting: 'markLinks' },
      { id: 'showNotifications', setting: 'showNotifications' },
      { id: 'collectStats', setting: 'collectStats' },
      { id: 'autoSync', setting: 'autoSync' }
    ];

    toggles.forEach(({ id, setting }) => {
      const toggle = document.getElementById(id);
      if (toggle) {
        toggle.addEventListener('change', async () => {
          this.settings[setting] = toggle.checked;
          await this.saveSettings();
          this.showNotification('Настройки сохранены', 'success');
        });
      }
    });
  }

  setupListManagement() {
    // Добавление заблокированного сайта
    document.getElementById('addBlockedSite').addEventListener('click', () => {
      this.addSiteToList('blocked');
    });

    // Добавление разрешенного сайта
    document.getElementById('addAllowedSite').addEventListener('click', () => {
      this.addSiteToList('allowed');
    });

    // Импорт/экспорт списков
    document.getElementById('exportLists').addEventListener('click', () => {
      this.exportLists();
    });

    document.getElementById('importLists').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importLists(e.target.files[0]);
    });

    // Сброс списков
    document.getElementById('resetLists').addEventListener('click', () => {
      this.resetLists();
    });

    // Enter для добавления сайтов
    document.getElementById('newBlockedSite').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addSiteToList('blocked');
      }
    });

    document.getElementById('newAllowedSite').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addSiteToList('allowed');
      }
    });
  }

  setupProFeatures() {
    // Активация PRO
    document.getElementById('activatePro').addEventListener('click', () => {
      this.activateProVersion();
    });

    // Деактивация PRO
    const deactivateBtn = document.getElementById('deactivatePro');
    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', () => {
        this.deactivateProVersion();
      });
    }

    // Ручная синхронизация
    const manualSyncBtn = document.getElementById('manualSync');
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener('click', () => {
        this.manualSync();
      });
    }
  }

  setupStatistics() {
    // Экспорт статистики
    document.getElementById('exportStats').addEventListener('click', () => {
      this.exportStatistics();
    });

    // Очистка статистики
    document.getElementById('clearStats').addEventListener('click', () => {
      this.clearStatistics();
    });
  }

  async updateUI() {
    // Обновляем настройки защиты
    this.updateProtectionUI();
    
    // Обновляем списки сайтов
    this.updateSiteLists();
    
    // Обновляем PRO секцию
    this.updateProSection();
    
    // Обновляем статистику
    this.updateStatistics();
  }

  updateProtectionUI() {
    // Режим блокировки
    const blockModeRadio = document.querySelector(`input[name="blockMode"][value="${this.settings.blockMode}"]`);
    if (blockModeRadio) {
      blockModeRadio.checked = true;
    }

    // Переключатели
    const toggles = ['markLinks', 'showNotifications', 'collectStats', 'autoSync'];
    toggles.forEach(toggle => {
      const element = document.getElementById(toggle);
      if (element) {
        element.checked = this.settings[toggle] || false;
      }
    });
  }

  updateSiteLists() {
    // Заблокированные сайты
    const blockedList = document.getElementById('blockedSitesList');
    blockedList.innerHTML = '';
    
    this.blockedSites.forEach((site, index) => {
      const li = this.createSiteListItem(site, 'blocked', index);
      blockedList.appendChild(li);
    });

    // Разрешенные сайты
    const allowedList = document.getElementById('allowedSitesList');
    allowedList.innerHTML = '';
    
    this.allowedSites.forEach((site, index) => {
      const li = this.createSiteListItem(site, 'allowed', index);
      allowedList.appendChild(li);
    });
  }

  createSiteListItem(site, type, index) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="site-info">
        <div class="site-domain">${site}</div>
        <div class="site-category">${type === 'blocked' ? 'Заблокирован' : 'Разрешен'}</div>
      </div>
      <div class="site-actions">
        <button class="action-btn delete" data-type="${type}" data-index="${index}">
          Удалить
        </button>
      </div>
    `;
    
    // Добавляем обработчик события для кнопки удаления
    const deleteBtn = li.querySelector('.action-btn.delete');
    deleteBtn.addEventListener('click', () => {
      this.removeSiteFromList(type, index);
    });
    
    return li;
  }

  updateProSection() {
    const proStatus = document.getElementById('proStatus');
    const proSettings = document.getElementById('proSettings');
    const activationForm = document.getElementById('activationForm');
    const deactivationForm = document.getElementById('deactivationForm');

    if (this.settings.proVersion) {
      proStatus.innerHTML = `
        <span class="status-indicator active"></span>
        <span class="status-text">Активирована</span>
      `;
      proSettings.style.display = 'block';
      activationForm.style.display = 'none';
      deactivationForm.style.display = 'block';

      // Обновляем информацию о синхронизации
      this.updateSyncInfo();
    } else {
      proStatus.innerHTML = `
        <span class="status-indicator"></span>
        <span class="status-text">Не активирована</span>
      `;
      proSettings.style.display = 'none';
      activationForm.style.display = 'block';
      deactivationForm.style.display = 'none';
    }
  }

  updateSyncInfo() {
    const lastSyncElement = document.getElementById('lastSync');
    if (this.settings.lastSync) {
      const date = new Date(this.settings.lastSync);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffHours < 1) {
        lastSyncElement.textContent = 'Только что';
      } else if (diffHours < 24) {
        lastSyncElement.textContent = `${diffHours} ч. назад`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        lastSyncElement.textContent = `${diffDays} д. назад`;
      }
    } else {
      lastSyncElement.textContent = 'Никогда';
    }
  }

  updateStatistics() {
    document.getElementById('totalBlocked').textContent = this.stats.blocked || 0;
    document.getElementById('totalAllowed').textContent = this.stats.allowed || 0;
    
    // Дни активности
    const installDate = new Date(this.stats.installDate || Date.now());
    const now = new Date();
    const daysActive = Math.floor((now - installDate) / (1000 * 60 * 60 * 24));
    document.getElementById('daysActive').textContent = Math.max(1, daysActive);

    // История защиты
    this.updateProtectionHistory();
  }

  updateProtectionHistory() {
    const historyContainer = document.getElementById('protectionHistory');
    
    // Имитируем историю активности
    const mockHistory = [
      { date: new Date(), action: 'Заблокирован malware-site.com', type: 'blocked' },
      { date: new Date(Date.now() - 3600000), action: 'Разрешен example.com', type: 'allowed' },
      { date: new Date(Date.now() - 7200000), action: 'Заблокирован phishing-bank.net', type: 'blocked' }
    ];

    historyContainer.innerHTML = mockHistory.map(item => `
      <div class="history-item" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef;">
        <span>${item.action}</span>
        <span style="color: #666; font-size: 12px;">${item.date.toLocaleTimeString()}</span>
      </div>
    `).join('');
  }

  async addSiteToList(type) {
    const inputId = type === 'blocked' ? 'newBlockedSite' : 'newAllowedSite';
    const input = document.getElementById(inputId);
    const domain = input.value.trim().toLowerCase();

    if (!domain) {
      this.showNotification('Введите домен', 'error');
      return;
    }

    if (!this.isValidDomain(domain)) {
      this.showNotification('Неверный формат домена', 'error');
      return;
    }

    const list = type === 'blocked' ? this.blockedSites : this.allowedSites;
    
    if (list.includes(domain)) {
      this.showNotification('Домен уже в списке', 'warning');
      return;
    }

    list.push(domain);
    await this.saveLists();
    this.updateSiteLists();
    input.value = '';
    
    this.showNotification(`Домен добавлен в ${type === 'blocked' ? 'черный' : 'белый'} список`, 'success');
  }

  async removeSiteFromList(type, index) {
    const list = type === 'blocked' ? this.blockedSites : this.allowedSites;
    const domain = list[index];
    
    if (confirm(`Удалить ${domain} из списка?`)) {
      list.splice(index, 1);
      await this.saveLists();
      this.updateSiteLists();
      this.showNotification('Домен удален из списка', 'success');
    }
  }

  isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }

  exportLists() {
    const data = {
      blocked: this.blockedSites,
      allowed: this.allowedSites,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `safelink-lists-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    this.showNotification('Списки экспортированы', 'success');
  }

  async importLists(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.blocked && Array.isArray(data.blocked)) {
        this.blockedSites = [...new Set([...this.blockedSites, ...data.blocked])];
      }

      if (data.allowed && Array.isArray(data.allowed)) {
        this.allowedSites = [...new Set([...this.allowedSites, ...data.allowed])];
      }

      await this.saveLists();
      this.updateSiteLists();
      this.showNotification('Списки импортированы', 'success');
    } catch (error) {
      console.error('Ошибка импорта:', error);
      this.showNotification('Ошибка импорта файла', 'error');
    }
  }

  async resetLists() {
    if (confirm('Вы уверены, что хотите сбросить все списки? Это действие нельзя отменить.')) {
      this.blockedSites = [];
      this.allowedSites = [];
      await this.saveLists();
      this.updateSiteLists();
      this.showNotification('Списки сброшены', 'success');
    }
  }

  async activateProVersion() {
    const licenseKey = document.getElementById('licenseKey').value.trim();
    
    if (!licenseKey) {
      this.showNotification('Введите лицензионный ключ', 'error');
      return;
    }

    // Имитируем проверку лицензии
    if (licenseKey === 'SAFELINK-PRO-2024' || licenseKey.startsWith('SL-')) {
      this.settings.proVersion = true;
      this.settings.licenseKey = licenseKey;
      await this.saveSettings();
      this.updateProSection();
      this.showNotification('PRO версия активирована!', 'success');
    } else {
      this.showNotification('Неверный лицензионный ключ', 'error');
    }
  }

  async deactivateProVersion() {
    if (confirm('Вы уверены, что хотите деактивировать PRO версию?')) {
      this.settings.proVersion = false;
      delete this.settings.licenseKey;
      await this.saveSettings();
      this.updateProSection();
      this.showNotification('PRO версия деактивирована', 'warning');
    }
  }

  async manualSync() {
    if (!this.settings.proVersion) return;

    const button = document.getElementById('manualSync');
    const originalText = button.textContent;
    button.textContent = '🔄 Синхронизация...';
    button.disabled = true;

    try {
      // Имитируем синхронизацию
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.settings.lastSync = Date.now();
      await this.saveSettings();
      this.updateSyncInfo();
      
      this.showNotification('Синхронизация завершена', 'success');
    } catch (error) {
      this.showNotification('Ошибка синхронизации', 'error');
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  }

  exportStatistics() {
    const data = {
      stats: this.stats,
      settings: this.settings,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `safelink-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    this.showNotification('Статистика экспортирована', 'success');
  }

  async clearStatistics() {
    if (confirm('Вы уверены, что хотите очистить всю статистику?')) {
      this.stats = {
        blocked: 0,
        allowed: 0,
        installDate: Date.now()
      };
      await chrome.storage.local.set({ safelink_stats: this.stats });
      this.updateStatistics();
      this.showNotification('Статистика очищена', 'success');
    }
  }

  async saveSettings() {
    await chrome.storage.local.set({ safelink_settings: this.settings });
    
    // Уведомляем background script об изменениях
    chrome.runtime.sendMessage({
      action: 'updateSettings',
      settings: this.settings
    });
  }

  async saveLists() {
    await chrome.storage.local.set({
      custom_blocked_sites: this.blockedSites,
      custom_allowed_sites: this.allowedSites
    });
  }

  showNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : type === 'error' ? '#dc3545' : '#17a2b8'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
}

// Глобальная переменная для доступа из HTML
let safeLinkOptions;

// Инициализируем когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
  safeLinkOptions = new SafeLinkOptions();
});

// Добавляем CSS для анимаций уведомлений
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style); 