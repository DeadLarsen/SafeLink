// SafeLink Test Page Script
let dynamicLinkCounter = 0;

function addDangerousLink() {
    const container = document.getElementById('dynamic-content');
    const link = document.createElement('a');
    link.href = `https://scam-site-${++dynamicLinkCounter}.com`;
    link.className = 'test-link dangerous-link';
    link.textContent = `🚨 Динамическая опасная ссылка ${dynamicLinkCounter}: scam-site-${dynamicLinkCounter}.com`;
    link.style.display = 'block';
    container.appendChild(link);
}

function addSafeLink() {
    const container = document.getElementById('dynamic-content');
    const link = document.createElement('a');
    link.href = `https://safe-site-${++dynamicLinkCounter}.com`;
    link.className = 'test-link safe-link';
    link.textContent = `✅ Динамическая безопасная ссылка ${dynamicLinkCounter}: safe-site-${dynamicLinkCounter}.com`;
    link.style.display = 'block';
    container.appendChild(link);
}

function clearDynamicContent() {
    const container = document.getElementById('dynamic-content');
    const links = container.querySelectorAll('a');
    links.forEach(link => link.remove());
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Лог для отладки
    console.log('SafeLink тестовая страница загружена');
    
    // Добавляем обработчики событий для кнопок
    document.getElementById('addDangerousBtn').addEventListener('click', addDangerousLink);
    document.getElementById('addSafeBtn').addEventListener('click', addSafeLink);
    document.getElementById('clearBtn').addEventListener('click', clearDynamicContent);
    
    console.log('DOM загружен, SafeLink должен начать работу');
    
    // Проверяем через 2 секунды, были ли применены стили SafeLink
    setTimeout(() => {
        const dangerousLinks = document.querySelectorAll('.dangerous-link');
        console.log(`Найдено ${dangerousLinks.length} опасных ссылок для проверки`);
        
        dangerousLinks.forEach((link, index) => {
            const hasWarning = link.querySelector('.safelink-warning');
            const hasStyles = link.style.border.includes('2px solid');
            console.log(`Ссылка ${index + 1}: предупреждение=${!!hasWarning}, стили=${hasStyles}`);
        });
    }, 2000);
}); 