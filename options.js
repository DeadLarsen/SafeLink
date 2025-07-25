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
    await this.setupEventListeners();
    this.setupStorageListener();
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
        autoSync: true,
        autoUpdatePhrases: false
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

  async setupEventListeners() {
    // Настройки защиты
    this.setupProtectionSettings();
    
    // Управление списками
    this.setupListManagement();
    
    // Управление фразами
    this.setupPhrasesManagement();
    
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

  setupPhrasesManagement() {
    // Состояние для списка фраз
    this.phrasesListVisible = false;
    this.currentPage = 1;
    this.phrasesPerPage = 50;
    this.currentSearch = '';
    this.currentSort = 'alphabetical';
    
    // Переключение видимости списка фраз
    document.getElementById('togglePhrasesList').addEventListener('click', () => {
      this.togglePhrasesList();
    });
    
    // Поиск фраз
    document.getElementById('phrasesSearch').addEventListener('input', (e) => {
      this.currentSearch = e.target.value;
      this.currentPage = 1;
      this.debounceSearch();
    });
    
    // Сортировка фраз
    document.getElementById('phrasesSortBy').addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.currentPage = 1;
      this.loadPhrasesList();
    });
    
    // Пагинация
    document.getElementById('phrasesPrev').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadPhrasesList();
      }
    });
    
    document.getElementById('phrasesNext').addEventListener('click', () => {
      this.currentPage++;
      this.loadPhrasesList();
    });
    
    // Debounce для поиска
    this.searchTimeout = null;
    
    // Обновление фраз и CSV файла
    document.getElementById('updatePhrasesNew').addEventListener('click', async () => {
      const button = document.getElementById('updatePhrasesNew');
      const originalText = button.textContent;
      
      try {
        button.textContent = '🔄 Скачивание CSV...';
        button.disabled = true;
        
        // Сначала очищаем старые данные
        console.log('🗑️ Очищаем старые фразы...');
        await chrome.storage.local.remove(['safelink_minjust_phrases', 'safelink_minjust_timestamp']);
        
        // Обновляем информацию (покажет 0 фраз)
        await this.updatePhrasesInfo();
        
        button.textContent = '🔄 Обновление CSV и фраз...';
        
        // Обновляем CSV файл и загружаем новые фразы
        const response = await chrome.runtime.sendMessage({
          action: 'updatePhrasesAndCSV'
        });
        
        if (response && response.success) {
          this.showNotification(`✅ Успешно! CSV обновлен, загружено ${response.count} фраз`, 'success');
          await this.updatePhrasesInfo();
          await this.updateFileButtonText(); // Обновляем текст кнопки после обновления
          
          // Обновляем список фраз, если он открыт
          if (this.phrasesListVisible) {
            this.currentPage = 1;
            this.loadPhrasesList();
          }
        } else {
          this.showNotification(`❌ Ошибка: ${response?.error || 'Неизвестная ошибка'}`, 'error');
        }
      } catch (error) {
        console.error('Ошибка обновления фраз и CSV:', error);
        this.showNotification('❌ Ошибка обновления фраз и CSV', 'error');
      } finally {
        button.textContent = originalText;
        button.disabled = false;
      }
    });
    
    // Очистить кэш фраз
    document.getElementById('clearPhrasesCache').addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите очистить кэш фраз? Это приведет к повторной загрузке данных при следующем обновлении.')) {
        try {
          await chrome.storage.local.remove(['safelink_minjust_phrases', 'safelink_minjust_timestamp']);
          this.showNotification('🗑️ Кэш фраз очищен', 'success');
          await this.updatePhrasesInfo();
        } catch (error) {
          console.error('Ошибка очистки кэша:', error);
          this.showNotification('❌ Ошибка очистки кэша', 'error');
        }
      }
    });
    
    // Тест кодировки
    /*
    document.getElementById('testEncoding').addEventListener('click', async () => {
      const button = document.getElementById('testEncoding');
      const originalText = button.textContent;
      
      try {
        button.textContent = '🧪 Тестирование...';
        button.disabled = true;
        
        const response = await chrome.runtime.sendMessage({
          action: 'testCP1251Decoding'
        });
        
        if (response && response.success) {
          const message = `✅ Тест кодировки прошел успешно!\n\n` +
            `📊 Размер файла: ${response.sizeKB} KB\n` +
            `🔍 Искали фразу: "${response.testPhrase}"\n` +
            `${response.found ? '✅' : '❌'} Найдено: ${response.found ? 'Да' : 'Нет'}\n\n` +
            `📝 Образец декодированного текста:\n"${response.sample}"`;
          
          alert(message);
          
          if (response.found) {
            this.showNotification('🎉 Кодировка работает! Фраза найдена.', 'success');
          } else {
            this.showNotification('⚠️ Тестовая фраза не найдена', 'warning');
          }
        } else {
          this.showNotification(`❌ Ошибка теста: ${response?.error}`, 'error');
        }
      } catch (error) {
        console.error('Ошибка теста кодировки:', error);
        this.showNotification('❌ Ошибка теста кодировки', 'error');
      } finally {
        button.textContent = originalText;
        button.disabled = false;
      }
    });
    */
    
    // Полная очистка всех фраз
    document.getElementById('clearAllPhrases').addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите полностью очистить все загруженные фразы? Это действие нельзя отменить.')) {
        const button = document.getElementById('clearAllPhrases');
        const originalText = button.textContent;
        
        try {
          button.textContent = '🗑️ Очистка...';
          button.disabled = true;
          
          // Очищаем все данные, связанные с фразами
          await chrome.storage.local.remove([
            'safelink_minjust_phrases',
            'safelink_minjust_timestamp'
          ]);
          
          // Также очищаем фразы в background script
          const response = await chrome.runtime.sendMessage({
            action: 'clearAllPhrases'
          });
          
          if (response && response.success) {
            this.showNotification('🗑️ Все фразы успешно удалены', 'success');
          } else {
            this.showNotification('⚠️ Локальные данные очищены, но проверьте background script', 'warning');
          }
          
          // Обновляем информацию
          await this.updatePhrasesInfo();
          
          // Очищаем список фраз, если он открыт
          if (this.phrasesListVisible) {
            this.loadPhrasesList();
          }
          
        } catch (error) {
          console.error('Ошибка очистки фраз:', error);
          this.showNotification('❌ Ошибка очистки фраз', 'error');
        } finally {
          button.textContent = originalText;
          button.disabled = false;
        }
      }
    });
    
    // Загрузка фраз из локального файла
    document.getElementById('initPhrasesFromFile').addEventListener('click', async () => {
      const button = document.getElementById('initPhrasesFromFile');
      const originalText = button.textContent;
      
      try {
        button.textContent = '📁 Загрузка из файла...';
        button.disabled = true;
        
        // Сначала очищаем старые данные
        await chrome.storage.local.remove(['safelink_minjust_phrases', 'safelink_minjust_timestamp', 'safelink_initialized']);
        
        // Запрашиваем загрузку из локального файла
        const response = await chrome.runtime.sendMessage({
          action: 'loadPhrasesFromLocalFile'
        });
        
        if (response && response.success) {
          this.showNotification(`✅ Загружено ${response.count} фраз из локального файла`, 'success');
          await this.updatePhrasesInfo();
          await this.updateFileButtonText(); // Обновляем текст кнопки после загрузки
          
          // Обновляем список фраз, если он открыт
          if (this.phrasesListVisible) {
            this.currentPage = 1;
            this.loadPhrasesList();
          }
        } else {
          this.showNotification(`❌ Ошибка: ${response?.error || 'Неизвестная ошибка'}`, 'error');
        }
      } catch (error) {
        console.error('Ошибка загрузки из файла:', error);
        this.showNotification('❌ Ошибка загрузки из файла', 'error');
      } finally {
        button.textContent = originalText;
        button.disabled = false;
      }
    });
    
    // Загружаем информацию о фразах при инициализации
    this.updatePhrasesInfo();
    this.updateFileButtonText(); // Обновляем текст кнопки файла
  }

  async updatePhrasesInfo() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getPhrasesInfo'
      });
      
      if (response && response.success) {
        // Обновляем количество фраз
        document.getElementById('phrasesCount').textContent = response.phrasesCount || 0;
        
        // Обновляем дату последнего обновления
        const lastUpdateElement = document.getElementById('lastUpdate');
        const dataAgeElement = document.getElementById('dataAge');
        
        if (response.lastUpdate && response.lastUpdate > 0) {
          const lastUpdateDate = new Date(response.lastUpdate);
          lastUpdateElement.textContent = lastUpdateDate.toLocaleString('ru-RU');
          
          if (response.ageHours !== undefined) {
            if (response.ageHours < 1) {
              dataAgeElement.textContent = 'Менее часа';
            } else if (response.ageHours < 24) {
              dataAgeElement.textContent = `${response.ageHours} ч`;
            } else {
              const days = Math.floor(response.ageHours / 24);
              dataAgeElement.textContent = `${days} дн`;
            }
          } else {
            dataAgeElement.textContent = '-';
          }
        } else {
          lastUpdateElement.textContent = 'Никогда';
          dataAgeElement.textContent = '-';
        }
        
        // Обновляем состояние автообновления
        const autoUpdateToggle = document.getElementById('autoUpdatePhrases');
        if (autoUpdateToggle) {
          autoUpdateToggle.checked = response.autoUpdate || false;
        }
      } else {
        console.error('Ошибка получения информации о фразах:', response);
      }
    } catch (error) {
      console.error('Ошибка загрузки информации о фразах:', error);
    }
  }

  setupStorageListener() {
    // Слушаем изменения в chrome.storage.local
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        // Проверяем, изменились ли списки сайтов
        if (changes.custom_blocked_sites || changes.custom_allowed_sites) {
          console.log('📋 Options: Storage changed, updating site lists');
          
          // Обновляем локальные массивы
          if (changes.custom_blocked_sites) {
            this.blockedSites = changes.custom_blocked_sites.newValue || [];
            console.log('📋 Updated blocked sites:', this.blockedSites);
          }
          
          if (changes.custom_allowed_sites) {
            this.allowedSites = changes.custom_allowed_sites.newValue || [];
            console.log('📋 Updated allowed sites:', this.allowedSites);
          }
          
          // Обновляем UI
          this.updateSiteLists();
          
          // Показываем уведомление о том, что списки обновились
          if (changes.custom_blocked_sites && changes.custom_allowed_sites) {
            // Оба списка изменились - найдем что было добавлено в разрешенные
            const oldAllowed = changes.custom_allowed_sites.oldValue || [];
            const newAllowed = changes.custom_allowed_sites.newValue || [];
            const addedSites = newAllowed.filter(site => !oldAllowed.includes(site));
            
            if (addedSites.length > 0) {
              this.showNotification(`Сайт ${addedSites[0]} разрешен и удален из заблокированных`, 'success');
            } else {
              this.showNotification('Списки сайтов обновлены', 'info');
            }
          } else if (changes.custom_allowed_sites) {
            const oldValue = changes.custom_allowed_sites.oldValue || [];
            const newValue = changes.custom_allowed_sites.newValue || [];
            const addedSites = newValue.filter(site => !oldValue.includes(site));
            
            if (addedSites.length > 0) {
              this.showNotification(`Сайт ${addedSites[0]} добавлен в разрешенные`, 'success');
            } else {
              this.showNotification('Список разрешенных сайтов обновлен', 'info');
            }
          } else if (changes.custom_blocked_sites) {
            this.showNotification('Список заблокированных сайтов обновлен', 'info');
          }
        }
      }
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
    const toggles = [
      { id: 'markLinks', setting: 'markLinks' },
      { id: 'showNotifications', setting: 'showNotifications' },
      { id: 'autoSync', setting: 'autoSync' }
    ];
    toggles.forEach(toggle => {
      const element = document.getElementById(toggle.id);
      if (element) {
        element.checked = this.settings[toggle.setting] || false;
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
    
    // Уведомляем background script об изменении списков
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'reloadSiteLists'
      });
      console.log('🔄 Background script уведомлен об изменении списков:', response);
    } catch (error) {
      console.warn('⚠️ Не удалось уведомить background script:', error);
    }
  }

  async updateFileButtonText() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getLocalFileInfo'
      });
      
      if (response && response.success) {
        const button = document.getElementById('initPhrasesFromFile');
        if (button) {
          button.textContent = response.fileInfo.displayText;
          
          // Добавляем класс для стилизации в зависимости от типа файла
          button.classList.remove('btn-warning', 'btn-info');
          if (response.fileInfo.hasUpdatedFile) {
            button.classList.add('btn-info'); // Синий для обновленного
          } else {
            button.classList.add('btn-warning'); // Оранжевый для локального
          }
        }
      }
    } catch (error) {
      console.error('Ошибка обновления текста кнопки файла:', error);
    }
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

  togglePhrasesList() {
    const container = document.getElementById('phrasesListContainer');
    const button = document.getElementById('togglePhrasesList');
    
    this.phrasesListVisible = !this.phrasesListVisible;
    
    if (this.phrasesListVisible) {
      container.style.display = 'block';
      button.textContent = '📋 Скрыть фразы';
      this.loadPhrasesList();
    } else {
      container.style.display = 'none';
      button.textContent = '📋 Показать фразы';
    }
  }

  debounceSearch() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadPhrasesList();
    }, 300);
  }

  async loadPhrasesList() {
    const phrasesList = document.getElementById('phrasesList');
    const phrasesShown = document.getElementById('phrasesShown');
    const phrasesTotal = document.getElementById('phrasesTotal');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const prevBtn = document.getElementById('phrasesPrev');
    const nextBtn = document.getElementById('phrasesNext');
    
    try {
      // Показываем индикатор загрузки
      phrasesList.innerHTML = '<div class="phrases-loading">Загрузка фраз...</div>';
      
      const response = await chrome.runtime.sendMessage({
        action: 'getPhrasesList',
        page: this.currentPage,
        limit: this.phrasesPerPage,
        search: this.currentSearch,
        sortBy: this.currentSort
      });
      
      if (response && response.success) {
        this.renderPhrasesList(response.phrases);
        
        // Обновляем статистику
        phrasesShown.textContent = response.phrases.length;
        phrasesTotal.textContent = response.pagination.total;
        
        // Обновляем пагинацию
        currentPageEl.textContent = response.pagination.page;
        totalPagesEl.textContent = response.pagination.totalPages;
        
        prevBtn.disabled = !response.pagination.hasPrev;
        nextBtn.disabled = !response.pagination.hasNext;
        
        // Если страница выходит за границы, возвращаемся к первой
        if (response.pagination.page > response.pagination.totalPages && response.pagination.totalPages > 0) {
          this.currentPage = 1;
          this.loadPhrasesList();
          return;
        }
      } else {
        phrasesList.innerHTML = `<div class="phrases-loading">Ошибка загрузки: ${response?.error || 'Неизвестная ошибка'}</div>`;
      }
    } catch (error) {
      console.error('Ошибка загрузки списка фраз:', error);
      phrasesList.innerHTML = '<div class="phrases-loading">Ошибка загрузки фраз</div>';
    }
  }

  renderPhrasesList(phrases) {
    const phrasesList = document.getElementById('phrasesList');
    
    if (phrases.length === 0) {
      phrasesList.innerHTML = '<div class="phrases-loading">Фразы не найдены</div>';
      return;
    }
    
    const phrasesHtml = phrases.map(phrase => `
      <div class="phrase-item">
        <div class="phrase-text">${this.escapeHtml(phrase.text)}</div>
        <div class="phrase-meta">
          <span class="phrase-length">${phrase.length}</span>
          <span class="phrase-type">${phrase.type}</span>
        </div>
      </div>
    `).join('');
    
    phrasesList.innerHTML = phrasesHtml;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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