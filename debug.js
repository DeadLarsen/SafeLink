// SafeLink Debug Tool Script
const log = document.getElementById('debug-log');

function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}\n`;
    log.textContent += logEntry;
    log.scrollTop = log.scrollHeight;
    console.log(`SafeLink Debug: ${message}`);
}

function clearLog() {
    log.textContent = '';
}

function testExtensionAPI() {
    addLog('Тестирование Chrome Extension API...');
    
    if (typeof chrome === 'undefined') {
        addLog('❌ Chrome API недоступен', 'error');
        return;
    }
    
    if (!chrome.runtime) {
        addLog('❌ chrome.runtime недоступен', 'error');
        return;
    }
    
    if (!chrome.runtime.id) {
        addLog('❌ chrome.runtime.id недоступен', 'error');
        return;
    }
    
    addLog(`✅ Chrome API доступен, ID: ${chrome.runtime.id}`, 'success');
}

function testBackgroundConnection() {
    addLog('Тестирование связи с Background Script...');
    
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        addLog('❌ chrome.runtime.sendMessage недоступен', 'error');
        return;
    }
    
    chrome.runtime.sendMessage({
        action: 'getSettings'
    }).then(response => {
        if (response) {
            addLog('✅ Связь с Background Script работает', 'success');
            addLog(`Настройки: ${JSON.stringify(response)}`, 'info');
        } else {
            addLog('⚠️ Background Script не отвечает', 'warning');
        }
    }).catch(error => {
        addLog(`❌ Ошибка связи с Background: ${error.message}`, 'error');
    });
}

function testLinkDetection() {
    addLog('Тестирование обнаружения ссылок...');
    
    const testLinks = document.querySelectorAll('.test-link');
    addLog(`Найдено ${testLinks.length} тестовых ссылок`, 'info');
    
    testLinks.forEach((link, index) => {
        const href = link.getAttribute('href');
        const hasWarning = link.querySelector('.safelink-warning');
        const hasStyles = link.style.border.includes('2px solid');
        
        addLog(`Ссылка ${index + 1} (${href}):`, 'info');
        addLog(`  - Предупреждение: ${hasWarning ? 'да' : 'нет'}`, 'info');
        addLog(`  - Стили SafeLink: ${hasStyles ? 'да' : 'нет'}`, 'info');
    });
}

function testContextInvalidated() {
    addLog('Тестирование Context Invalidated ошибки...');
    
    addLog('ℹ️ Этот тест покажет как обрабатываются ошибки контекста расширения', 'info');
    
    // Эмулируем context invalidated ошибку
    const fakeError = new Error('Extension context invalidated.');
    
    // Проверяем обработку ошибки
    if (fakeError.message.includes('Extension context invalidated')) {
        addLog('✅ Ошибка context invalidated корректно определена', 'success');
        addLog('💡 Инструкция для пользователя:', 'info');
        addLog('  1. Обновите страницу (Ctrl+F5)', 'info');
        addLog('  2. Если не помогло - перезагрузите расширение в chrome://extensions/', 'info');
        addLog('  3. Затем снова обновите страницу', 'info');
        
        // Показываем пример уведомления
        setTimeout(() => {
            addLog('🔄 Теперь будет показано демо-уведомление...', 'info');
            showDemoNotification();
        }, 2000);
    } else {
        addLog('❌ Ошибка не была корректно определена', 'error');
    }
}

function showDemoNotification() {
    // Создаем демо-уведомление (как в content.js)
    const notification = document.createElement('div');
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
          🔄 SafeLink требует обновления (ДЕМО)
        </div>
        <div style="margin-bottom: 8px;">
          Расширение было перезагружено. Обновите страницу для восстановления защиты.
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          Нажмите чтобы закрыть • Это демонстрация
        </div>
      </div>
    `;

    // Добавляем обработчик клика для закрытия
    notification.addEventListener('click', () => {
        notification.remove();
        addLog('📋 Демо-уведомление закрыто пользователем', 'info');
    });

    // Автоматически убираем через 8 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
            addLog('⏰ Демо-уведомление автоматически закрыто через 8 секунд', 'info');
        }
    }, 8000);

    document.body.appendChild(notification);
    addLog('📢 Демо-уведомление показано в правом верхнем углу', 'success');
}

function checkExtensionStatus() {
    const statusDiv = document.getElementById('extension-info');
    const sectionDiv = document.getElementById('extension-status');
    
    if (typeof chrome === 'undefined') {
        statusDiv.innerHTML = '❌ Chrome API недоступен';
        sectionDiv.className = 'debug-section status-error';
        return;
    }
    
    if (!chrome.runtime || !chrome.runtime.id) {
        statusDiv.innerHTML = '❌ Расширение не загружено';
        sectionDiv.className = 'debug-section status-error';
        return;
    }
    
    statusDiv.innerHTML = `✅ Расширение активно (ID: ${chrome.runtime.id})`;
    sectionDiv.className = 'debug-section status-ok';
}

function checkContentScript() {
    const statusDiv = document.getElementById('content-script-info');
    const sectionDiv = document.getElementById('content-script-status');
    
    // Проверяем наличие SafeLink стилей или элементов
    setTimeout(() => {
        const safeLinkElements = document.querySelectorAll('[data-safelink-blocked]');
        const safeLinkWarnings = document.querySelectorAll('.safelink-warning');
        
        if (safeLinkElements.length > 0 || safeLinkWarnings.length > 0) {
            statusDiv.innerHTML = `✅ Content Script работает (найдено ${safeLinkElements.length + safeLinkWarnings.length} элементов)`;
            sectionDiv.className = 'debug-section status-ok';
        } else {
            statusDiv.innerHTML = '⚠️ Content Script не обнаружен или не активен';
            sectionDiv.className = 'debug-section status-warning';
        }
    }, 2000);
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    addLog('SafeLink Debug Tool загружен');
    
    // Добавляем обработчики событий для кнопок
    document.getElementById('testAPIBtn').addEventListener('click', testExtensionAPI);
    document.getElementById('testBackgroundBtn').addEventListener('click', testBackgroundConnection);
    document.getElementById('testLinksBtn').addEventListener('click', testLinkDetection);
    document.getElementById('testContextBtn').addEventListener('click', testContextInvalidated);
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    
    checkExtensionStatus();
    checkContentScript();
    
    // Автоматические тесты через 1 секунду
    setTimeout(() => {
        testExtensionAPI();
        testBackgroundConnection();
    }, 1000);
});

// Слушаем ошибки
window.addEventListener('error', (event) => {
    addLog(`Ошибка JavaScript: ${event.error.message}`, 'error');
});

// Перехватываем console.log SafeLink
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    if (args[0] && args[0].toString().includes('SafeLink')) {
        addLog(args.join(' '), 'info');
    }
    originalLog.apply(console, args);
};

console.error = function(...args) {
    if (args[0] && args[0].toString().includes('SafeLink')) {
        addLog(args.join(' '), 'error');
    }
    originalError.apply(console, args);
};

console.warn = function(...args) {
    if (args[0] && args[0].toString().includes('SafeLink')) {
        addLog(args.join(' '), 'warning');
    }
    originalWarn.apply(console, args);
}; 