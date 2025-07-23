// SafeLink Content Script
class SafeLinkContent {
  constructor() {
    this.contextInvalidatedShown = false;
    this.extensionReady = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  init() {
    // Проверяем доступность Chrome API
    if (!this.isExtensionAvailable()) {
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        console.warn(`SafeLink: Chrome API недоступен, попытка ${this.retryCount}/${this.maxRetries}`);
        // Увеличиваем интервал с каждой попыткой
        const delay = 100 * this.retryCount;
        setTimeout(() => this.init(), delay);
        return;
      } else {
        console.error('SafeLink: Не удалось инициализировать расширение после нескольких попыток');
        return;
      }
    }

    this.extensionReady = true;
    this.retryCount = 0;

    // Проверяем все ссылки на странице при загрузке
    this.checkAllLinks();
    
    // Наблюдаем за изменениями DOM для новых ссылок
    this.observeDOM();
    
    // Перехватываем клики по ссылкам
    this.interceptClicks();
    
    console.log('SafeLink Content Script успешно инициализирован');
  }

  isExtensionAvailable() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  async checkAllLinks() {
    const links = document.querySelectorAll('a[href]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && this.isExternalLink(href)) {
        await this.checkAndMarkLink(link, href);
      }
    }
  }

  async checkAndMarkLink(linkElement, url) {
    try {
      // Проверяем доступность chrome.runtime
      if (!this.isExtensionAvailable()) {
        console.warn('SafeLink: Chrome runtime недоступен, пропускаем проверку ссылки');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'checkUrl',
        url: url
      });

      if (response && response.blocked && !response.allowed) {
        this.markDangerousLink(linkElement, response);
      }
    } catch (error) {
      // Проверяем тип ошибки
      if (this.isContextInvalidatedError(error)) {
        console.warn('SafeLink: Контекст расширения сброшен - требуется обновление страницы');
        this.showContextInvalidatedNotification();
        return;
      }
      
      console.error('SafeLink: Ошибка проверки ссылки:', error);
    }
  }

  isContextInvalidatedError(error) {
    return error && error.message && (
      error.message.includes('Extension context invalidated') ||
      error.message.includes('Could not establish connection') ||
      error.message.includes('The message port closed before a response was received')
    );
  }

  showContextInvalidatedNotification() {
    // Показываем уведомление только один раз
    if (this.contextInvalidatedShown) return;
    this.contextInvalidatedShown = true;

    // Создаем уведомление
    const notification = document.createElement('div');
    notification.id = 'safelink-context-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff6b6b;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 350px;
        cursor: pointer;
      ">
        <div style="font-weight: bold; margin-bottom: 8px;">
          🔄 SafeLink требует обновления
        </div>
        <div style="margin-bottom: 8px;">
          Расширение было перезагружено. Обновите страницу для восстановления защиты.
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          Нажмите чтобы закрыть
        </div>
      </div>
    `;

    // Добавляем обработчик клика для закрытия
    notification.addEventListener('click', () => {
      notification.remove();
    });

    // Автоматически убираем через 10 секунд
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);

    document.body.appendChild(notification);
  }

  markDangerousLink(linkElement, checkResult) {
    // Добавляем визуальные индикаторы опасной ссылки
    linkElement.style.cssText += `
      border: 2px solid #f44336 !important;
      background: rgba(244, 67, 54, 0.1) !important;
      border-radius: 3px !important;
      position: relative !important;
    `;

    // Добавляем иконку предупреждения
    const warningIcon = document.createElement('span');
    warningIcon.innerHTML = '⚠️';
    warningIcon.style.cssText = `
      margin-left: 4px;
      font-size: 12px;
      color: #f44336;
    `;
    
    if (!linkElement.querySelector('.safelink-warning')) {
      warningIcon.className = 'safelink-warning';
      linkElement.appendChild(warningIcon);
    }

    // Добавляем тултип с информацией
    linkElement.title = `⚠️ SafeLink: Потенциально опасная ссылка (${checkResult.reason})`;
    
    // Добавляем атрибут для идентификации
    linkElement.setAttribute('data-safelink-blocked', 'true');
    linkElement.setAttribute('data-safelink-reason', checkResult.reason);
  }

  interceptClicks() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('a[href]');
      
      if (target && target.hasAttribute('data-safelink-blocked')) {
        event.preventDefault();
        event.stopPropagation();
        
        this.showWarningModal(target.getAttribute('href'), target);
        return false;
      }
    }, true);
  }

  showWarningModal(url, linkElement) {
    // Создаем модальное окно предупреждения
    const modal = document.createElement('div');
    modal.className = 'safelink-modal';
    modal.innerHTML = `
      <div class="safelink-modal-overlay">
        <div class="safelink-modal-content">
          <div class="safelink-modal-header">
            <span class="safelink-warning-icon">⚠️</span>
            <h3>Предупреждение SafeLink</h3>
          </div>
          <div class="safelink-modal-body">
            <p>Этот сайт может быть опасным:</p>
            <div class="safelink-url">${this.truncateUrl(url)}</div>
            <p>Рекомендуем не переходить по этой ссылке. Если вы уверены в безопасности сайта, можете продолжить.</p>
          </div>
          <div class="safelink-modal-actions">
            <button class="safelink-btn safelink-btn-danger" id="safelink-continue">
              Всё равно перейти
            </button>
            <button class="safelink-btn safelink-btn-secondary" id="safelink-allow">
              Разрешить сайт
            </button>
            <button class="safelink-btn safelink-btn-primary" id="safelink-cancel">
              Отмена
            </button>
          </div>
        </div>
      </div>
    `;

    // Добавляем стили для модального окна
    const styles = document.createElement('style');
    styles.textContent = `
      .safelink-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .safelink-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .safelink-modal-content {
        background: white;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        max-height: 80%;
        overflow: auto;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      }
      
      .safelink-modal-header {
        padding: 20px 20px 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .safelink-warning-icon {
        font-size: 24px;
      }
      
      .safelink-modal-header h3 {
        margin: 0;
        color: #f44336;
        font-size: 18px;
      }
      
      .safelink-modal-body {
        padding: 20px;
      }
      
      .safelink-modal-body p {
        margin: 0 0 15px;
        color: #333;
        line-height: 1.5;
      }
      
      .safelink-url {
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        word-break: break-all;
        font-family: monospace;
        margin: 15px 0;
        color: #666;
      }
      
      .safelink-modal-actions {
        padding: 0 20px 20px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      
      .safelink-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        font-weight: 500;
        flex: 1;
        min-width: 100px;
      }
      
      .safelink-btn-primary {
        background: #1976d2;
        color: white;
      }
      
      .safelink-btn-secondary {
        background: #f5f5f5;
        color: #333;
      }
      
      .safelink-btn-danger {
        background: #f44336;
        color: white;
      }
      
      .safelink-btn:hover {
        opacity: 0.9;
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(modal);

    // Обработчики событий для кнопок
    modal.querySelector('#safelink-continue').addEventListener('click', () => {
      window.location.href = url;
    });

    modal.querySelector('#safelink-allow').addEventListener('click', async () => {
      try {
        // Проверяем доступность chrome.runtime
        if (this.isExtensionAvailable()) {
          await chrome.runtime.sendMessage({
            action: 'allowSite',
            url: url
          });
        } else {
          console.warn('SafeLink: Chrome runtime недоступен, не удалось добавить сайт в исключения');
        }
      } catch (error) {
        if (this.isContextInvalidatedError(error)) {
          console.warn('SafeLink: Контекст расширения сброшен');
          this.showContextInvalidatedNotification();
        } else {
          console.error('SafeLink: Ошибка при добавлении сайта в исключения:', error);
        }
      }
      
      // Убираем маркировку с ссылки
      this.unmarkLink(linkElement);
      modal.remove();
      styles.remove();
    });

    modal.querySelector('#safelink-cancel').addEventListener('click', () => {
      modal.remove();
      styles.remove();
    });

    // Закрытие по клику на overlay
    modal.querySelector('.safelink-modal-overlay').addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.safelink-modal-overlay')) {
        modal.remove();
        styles.remove();
      }
    });
  }

  unmarkLink(linkElement) {
    linkElement.style.border = '';
    linkElement.style.background = '';
    linkElement.removeAttribute('data-safelink-blocked');
    linkElement.removeAttribute('data-safelink-reason');
    linkElement.title = '';
    
    const warningIcon = linkElement.querySelector('.safelink-warning');
    if (warningIcon) {
      warningIcon.remove();
    }
  }

  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Проверяем новые ссылки
            const links = node.querySelectorAll ? Array.from(node.querySelectorAll('a[href]')) : [];
            if (node.tagName === 'A' && node.hasAttribute('href')) {
              links.push(node);
            }
            
            links.forEach(async (link) => {
              const href = link.getAttribute('href');
              if (href && this.isExternalLink(href)) {
                await this.checkAndMarkLink(link, href);
              }
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  isExternalLink(url) {
    try {
      // Пропускаем внутренние ссылки, mailto, tel и другие протоколы
      if (url.startsWith('#') || 
          url.startsWith('mailto:') || 
          url.startsWith('tel:') || 
          url.startsWith('javascript:')) {
        return false;
      }

      // Относительные URL считаем внутренними
      if (url.startsWith('/') && !url.startsWith('//')) {
        return false;
      }

      // Проверяем абсолютные URL
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        const urlObj = new URL(url, window.location.href);
        return urlObj.hostname !== window.location.hostname;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }
}

// Инициализируем SafeLink Content Script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SafeLinkContent();
  });
} else {
  new SafeLinkContent();
} 