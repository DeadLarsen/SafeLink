// Скрипт для парсинга exportfsm.csv и извлечения ключевых фраз для блокировки поисков

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

class CSVPhraseParser {
  constructor() {
    this.blockedPhrases = new Set();
    this.stopWords = new Set([
      // Служебные слова, которые нужно исключить
      'и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'под', 'над', 'между', 'через',
      'за', 'без', 'из', 'при', 'про', 'о', 'об', 'что', 'как', 'где', 'когда',
      'который', 'которая', 'которое', 'которые', 'этот', 'эта', 'это', 'эти',
      'тот', 'та', 'то', 'те', 'такой', 'такая', 'такое', 'такие',
      
      // Юридические термины
      'решением', 'решение', 'суд', 'суда', 'судом', 'апелляционного', 'краевого',
      'областного', 'городского', 'районного', 'федерального', 'определением',
      'постановлением', 'приговором', 'определение', 'постановление', 'приговор',
      'признан', 'признана', 'признано', 'признаны', 'включен', 'включена', 
      'включено', 'включены', 'внесен', 'внесена', 'внесено', 'внесены',
      'запрещен', 'запрещена', 'запрещено', 'запрещены',
      
      // Издательские термины
      'номер', 'издательство', 'автор', 'авторы', 'серия', 'том', 'выпуск', 'страница',
      'издание', 'издания', 'книга', 'книги', 'статья', 'статьи', 'материал', 'материалы',
      'публикация', 'публикации', 'текст', 'тексты', 'содержание', 'содержащий',
      'издан', 'издана', 'издано', 'изданы', 'опубликован', 'опубликована',
      
      // Сокращения и знаки
      '№', 'стр.', 'изд.', 'ред.', 'год', 'см.', 'также', 'etc', 'и.о.', 'т.д.',
      'т.п.', 'т.к.', 'т.е.', 'др.', 'проч.', 'ул.', 'г.', 'обл.', 'р-н',
      
      // Даты и числа
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ]);
    
    this.categories = {
      books: new Set(),
      websites: new Set(), 
      magazines: new Set(),
      videos: new Set(),
      organizations: new Set(),
      general: new Set()
    };
  }

  // Парсинг CSV файла с учетом кодировки Windows-1251
  parseCSVFile(filePath) {
    try {
      console.log('📂 Чтение файла с кодировкой Windows-1251...');
      
      // Читаем файл как буфер и декодируем из Windows-1251
      const buffer = fs.readFileSync(filePath);
      const csvContent = iconv.decode(buffer, 'win1251');
      
      console.log('✅ Файл успешно декодирован из Windows-1251');
      console.log(`📄 Размер файла: ${buffer.length} байт`);
      
      const lines = csvContent.split('\n');
      console.log(`📊 Найдено ${lines.length} строк в CSV файле`);
      
      // Показываем пример первых строк для проверки кодировки
      console.log('\n🔍 Первые 3 строки для проверки кодировки:');
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const preview = lines[i].substring(0, 100);
        console.log(`   ${i + 1}: ${preview}${lines[i].length > 100 ? '...' : ''}`);
      }
      
      let processedCount = 0;
      let errorCount = 0;
      
      for (let i = 1; i < lines.length; i++) { // Пропускаем заголовок
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const parsed = this.parseCSVLine(line);
          if (parsed && parsed.description) {
            this.extractPhrasesFromDescription(parsed.description, parsed.id);
            processedCount++;
            
            // Показываем прогресс каждые 1000 записей
            if (processedCount % 1000 === 0) {
              console.log(`⏳ Обработано ${processedCount} записей...`);
            }
          }
        } catch (error) {
          errorCount++;
          if (errorCount <= 5) { // Показываем только первые 5 ошибок
            console.warn(`⚠️ Ошибка обработки строки ${i}: ${error.message}`);
          }
        }
      }
      
      console.log(`\n✅ Парсинг завершен:`);
      console.log(`   📊 Обработано записей: ${processedCount}`);
      console.log(`   ❌ Ошибок обработки: ${errorCount}`);
      console.log(`   🔤 Извлечено уникальных фраз: ${this.blockedPhrases.size}`);
      
    } catch (error) {
      console.error('❌ Ошибка чтения CSV файла:', error);
      if (error.code === 'ENOENT') {
        console.error('💡 Убедитесь что файл exportfsm.csv находится в текущей папке');
      }
    }
  }

  // Парсинг одной строки CSV (учитывая кавычки и запятые внутри, кириллица)
  parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      // Обрабатываем различные типы кавычек (включая типографские)
      if ((char === '"' || char === '"' || char === '"' || char === '«' || char === '»') && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        // Не добавляем кавычку в контент
      } else if ((char === quoteChar || 
                 (quoteChar === '«' && char === '»') || 
                 (quoteChar === '"' && (char === '"' || char === '"'))) && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        // Не добавляем кавычку в контент
      } else if (char === ';' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) {
      fields.push(current.trim());
    }
    
    if (fields.length >= 2) {
      return {
        id: fields[0],
        description: this.cleanText(fields[1]),
        date: fields[2] || ''
      };
    }
    
    return null;
  }

  // Очистка текста от лишних символов
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/[""«»]/g, '"')  // Нормализуем кавычки
      .replace(/['']/g, "'")    // Нормализуем апострофы
      .replace(/\s+/g, ' ')     // Убираем лишние пробелы
      .replace(/[\r\n]+/g, ' ') // Убираем переносы строк
      .trim();
  }

  // Извлечение фраз из описания материала
  extractPhrasesFromDescription(description, id) {
    if (!description || description.length < 3) return;
    
    // Очистка от лишних символов и нормализация
    let cleanDesc = description
      .replace(/[""«»]/g, '"')
      .replace(/['']/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    // Извлекаем названия в кавычках (книги, статьи, фильмы)
    const quotedMatches = cleanDesc.match(/"([^"]+)"/g);
    if (quotedMatches) {
      quotedMatches.forEach(match => {
        const phrase = match.replace(/"/g, '').trim();
        if (this.isValidPhrase(phrase)) {
          this.addPhrase(phrase, this.categorizePhrase(phrase, cleanDesc));
        }
      });
    }
    
    // Извлекаем URL и доменные имена
    const urlMatches = cleanDesc.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,})/g);
    if (urlMatches) {
      urlMatches.forEach(url => {
        const cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
        this.addPhrase(cleanUrl, 'websites');
      });
    }
    
    // Извлекаем названия книг, статей и других материалов
    const bookPatterns = [
      /книга[и\s]*[""]([^""]+)[""]?/gi,
      /статья[и\s]*[""]([^""]+)[""]?/gi,
      /брошюра[и\s]*[""]([^""]+)[""]?/gi,
      /учебник[и\s]*[""]([^""]+)[""]?/gi
    ];
    
    bookPatterns.forEach(pattern => {
      const matches = cleanDesc.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const book = match.replace(/^(книга|статья|брошюра|учебник)[и\s]*/i, '').replace(/[""\s]/g, '').trim();
          if (this.isValidPhrase(book)) {
            this.addPhrase(book, 'books');
          }
        });
      }
    });
    
    // Извлекаем названия журналов и газет
    const magazinePatterns = [
      /журнал[и\s]*[""]([^""]+)[""]?/gi,
      /газета[и\s]*[""]([^""]+)[""]?/gi,
      /издание[и\s]*[""]([^""]+)[""]?/gi,
      /бюллетень[и\s]*[""]([^""]+)[""]?/gi
    ];
    
    magazinePatterns.forEach(pattern => {
      const matches = cleanDesc.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const magazine = match.replace(/^(журнал|газета|издание|бюллетень)[и\s]*/i, '').replace(/[""\s]/g, '').trim();
          if (this.isValidPhrase(magazine)) {
            this.addPhrase(magazine, 'magazines');
          }
        });
      }
    });
    
    // Извлекаем названия организаций и движений
    const orgPatterns = [
      /организация[и\s]*[""]([^""]+)[""]?/gi,
      /движение[и\s]*[""]([^""]+)[""]?/gi,
      /партия[и\s]*[""]([^""]+)[""]?/gi,
      /группа[и\s]*[""]([^""]+)[""]?/gi
    ];
    
    orgPatterns.forEach(pattern => {
      const matches = cleanDesc.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const org = match.replace(/^(организация|движение|партия|группа)[и\s]*/i, '').replace(/[""\s]/g, '').trim();
          if (this.isValidPhrase(org)) {
            this.addPhrase(org, 'organizations');
          }
        });
      }
    });
    
    // Извлекаем ключевые слова из оставшегося текста
    this.extractKeywordsFromText(cleanDesc);
    
    // Извлекаем автора и другие значимые данные
    this.extractSpecificTerms(cleanDesc);
  }

  // Извлечение специфических терминов (авторы, названия)
  extractSpecificTerms(text) {
    // Извлечение авторов
    const authorPatterns = [
      /автор[ы]?\s*[-–]\s*([А-Я][а-я]+\s+[А-Я]\.[А-Я]\.)/gi,
      /([А-Я][а-я]+\s+[А-Я]\.[А-Я]\.)/g
    ];
    
    authorPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const author = match.replace(/^автор[ы]?\s*[-–]\s*/i, '').trim();
          if (this.isValidPhrase(author) && author.length > 5) {
            this.addPhrase(author, 'general');
          }
        });
      }
    });
    
    // Извлечение названий без кавычек (часто встречаются)
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i+1]} ${words[i+2]}`.toLowerCase().trim();
      
      // Проверяем что это не техническая информация
      if (this.isValidPhrase(phrase) && 
          !/\d{2}\.\d{2}\.\d{4}/.test(phrase) && // не дата
          !/№\s*\d+/.test(phrase) && // не номер
          !/решением|определением|постановлением/.test(phrase)) {
        this.addPhrase(phrase, 'general');
      }
    }
  }

  // Извлечение ключевых слов из текста с учетом кириллицы 
  extractKeywordsFromText(text) {
    // Удаляем технические части (суды, даты, номера дел)
    let cleanText = text
      .replace(/\([^)]*решением[^)]*\)/gi, '')
      .replace(/\([^)]*определением[^)]*\)/gi, '')
      .replace(/\([^)]*постановлением[^)]*\)/gi, '')
      .replace(/решением\s+[^.]+\./gi, '')
      .replace(/определением\s+[^.]+\./gi, '')
      .replace(/\d{2}\.\d{2}\.\d{4}/g, '') // даты
      .replace(/№\s*\d+/g, '') // номера
      .replace(/[.,;:()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Разбиваем на слова и фразы
    const words = cleanText.split(/\s+/);
    
    // Извлекаем значимые слова (длиной от 4 символов, кириллица)
    for (const word of words) {
      const cleanWord = word.toLowerCase().trim();
      if (cleanWord.length >= 4 && 
          !this.stopWords.has(cleanWord) && 
          /^[а-яё\-]+$/i.test(cleanWord) &&  // Разрешаем дефисы в словах
          !/(решение|определение|постановление|суд|определение|признан|включен|внесен)/i.test(cleanWord)) {
        this.addPhrase(cleanWord, 'general');
      }
    }
    
    // Извлекаем биграммы (пары слов) и триграммы (тройки слов)
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i].toLowerCase().trim();
      const word2 = words[i + 1].toLowerCase().trim();
      
      if (word1.length >= 3 && word2.length >= 3 && 
          !this.stopWords.has(word1) && !this.stopWords.has(word2) &&
          /^[а-яё\-]+$/i.test(word1) && /^[а-яё\-]+$/i.test(word2) &&
          !/(решение|определение|постановление|суд)/i.test(`${word1} ${word2}`)) {
        const bigram = `${word1} ${word2}`;
        this.addPhrase(bigram, 'general');
        
        // Триграммы для более точного контекста
        if (i < words.length - 2) {
          const word3 = words[i + 2].toLowerCase().trim();
          if (word3.length >= 3 && !this.stopWords.has(word3) && 
              /^[а-яё\-]+$/i.test(word3)) {
            const trigram = `${word1} ${word2} ${word3}`;
            if (trigram.length <= 50) { // Ограничиваем длину
              this.addPhrase(trigram, 'general');
            }
          }
        }
      }
    }
  }

  // Проверка валидности фразы
  isValidPhrase(phrase) {
    if (!phrase || phrase.length < 3 || phrase.length > 100) return false;
    
    // Исключаем чисто цифровые значения
    if (/^\d+$/.test(phrase)) return false;
    
    // Исключаем технические термины
    const technicalTerms = ['решением', 'определением', 'постановлением', 'приговором', 'судом'];
    if (technicalTerms.some(term => phrase.toLowerCase().includes(term))) return false;
    
    // Должна содержать хотя бы одну букву
    if (!/[а-яёa-z]/i.test(phrase)) return false;
    
    return true;
  }

  // Категоризация фразы
  categorizePhrase(phrase, context) {
    const lowerPhrase = phrase.toLowerCase();
    const lowerContext = context.toLowerCase();
    
    if (lowerContext.includes('книга') || lowerContext.includes('автор') || lowerContext.includes('издательство')) {
      return 'books';
    }
    
    if (lowerContext.includes('сайт') || lowerContext.includes('http') || lowerContext.includes('www') || phrase.includes('.')) {
      return 'websites';
    }
    
    if (lowerContext.includes('журнал') || lowerContext.includes('газета') || lowerContext.includes('издание')) {
      return 'magazines';
    }
    
    if (lowerContext.includes('видео') || lowerContext.includes('фильм') || lowerContext.includes('dvd')) {
      return 'videos';
    }
    
    if (lowerContext.includes('организация') || lowerContext.includes('движение') || lowerContext.includes('партия')) {
      return 'organizations';
    }
    
    return 'general';
  }

  // Добавление фразы в соответствующую категорию
  addPhrase(phrase, category) {
    const cleanPhrase = phrase.trim().toLowerCase();
    if (this.isValidPhrase(cleanPhrase)) {
      this.blockedPhrases.add(cleanPhrase);
      if (this.categories[category]) {
        this.categories[category].add(cleanPhrase);
      }
    }
  }

  // Создание JSON файла с заблокированными фразами
  generateBlockedPhrasesJSON() {
    const result = {
      version: "1.0.0",
      updated: new Date().toISOString(),
      total_phrases: this.blockedPhrases.size,
      categories: {
        books: Array.from(this.categories.books),
        websites: Array.from(this.categories.websites),
        magazines: Array.from(this.categories.magazines),
        videos: Array.from(this.categories.videos),
        organizations: Array.from(this.categories.organizations),
        general: Array.from(this.categories.general)
      },
      all_phrases: Array.from(this.blockedPhrases).sort(),
      settings: {
        case_sensitive: false,
        partial_match: true,
        min_length: 3,
        enabled: true
      },
      search_engines: [
        "google.com",
        "google.ru", 
        "yandex.ru",
        "yandex.com",
        "bing.com",
        "mail.ru",
        "rambler.ru",
        "yahoo.com",
        "duckduckgo.com"
      ]
    };
    
    return result;
  }

  // Сохранение результата в файл
  saveToFile(outputPath) {
    const data = this.generateBlockedPhrasesJSON();
    
    try {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`\n✅ Результат сохранен в: ${outputPath}`);
      console.log(`📊 Статистика:`);
      console.log(`   Всего фраз: ${data.total_phrases}`);
      console.log(`   Книги: ${data.categories.books.length}`);
      console.log(`   Сайты: ${data.categories.websites.length}`);
      console.log(`   Журналы: ${data.categories.magazines.length}`);
      console.log(`   Видео: ${data.categories.videos.length}`);
      console.log(`   Организации: ${data.categories.organizations.length}`);
      console.log(`   Общие: ${data.categories.general.length}`);
      
      // Показываем примеры фраз
      console.log(`\n📝 Примеры извлеченных фраз:`);
      if (data.categories.books.length > 0) {
        console.log(`   Книги: ${data.categories.books.slice(0, 3).join(', ')}...`);
      }
      if (data.categories.websites.length > 0) {
        console.log(`   Сайты: ${data.categories.websites.slice(0, 3).join(', ')}...`);
      }
      if (data.categories.organizations.length > 0) {
        console.log(`   Организации: ${data.categories.organizations.slice(0, 3).join(', ')}...`);
      }
      
    } catch (error) {
      console.error('❌ Ошибка сохранения файла:', error);
    }
  }
}

// Запуск парсинга
if (require.main === module) {
  const parser = new CSVPhraseParser();
  const csvPath = path.join(__dirname, 'exportfsm.csv');
  const outputPath = path.join(__dirname, 'blocked-phrases.json');
  
  console.log('🚀 Запуск парсинга CSV файла...');
  console.log(`📁 Входной файл: ${csvPath}`);
  console.log(`📁 Выходной файл: ${outputPath}`);
  
  parser.parseCSVFile(csvPath);
  parser.saveToFile(outputPath);
  
  console.log('\n✨ Парсинг завершен!');
}

module.exports = CSVPhraseParser; 