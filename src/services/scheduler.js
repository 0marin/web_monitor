const puppeteer = require('puppeteer');
const Monitor = require('../models/Monitor');
const { sendChangeNotification } = require('./telegramBot');
const logger = require('../utils/logger');

let browser = null;
const activeJobs = new Map();

const initializeScheduler = async () => {
  try {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      headless: 'new'
    });
    logger.info('Browser initialized successfully');
    
    // Загружаем все активные задачи мониторинга
    await loadActiveMonitors();
    
    // Запускаем периодическую проверку новых задач
    setInterval(loadActiveMonitors, 60000); // Проверка каждую минуту
  } catch (error) {
    logger.error('Failed to initialize scheduler:', error);
    throw error;
  }
};

const loadActiveMonitors = async () => {
  try {
    const monitors = await Monitor.find({ isActive: true });
    
    for (const monitor of monitors) {
      if (!activeJobs.has(monitor._id.toString())) {
        scheduleMonitor(monitor);
      }
    }
  } catch (error) {
    logger.error('Error loading active monitors:', error);
  }
};

const scheduleMonitor = (monitor) => {
  const jobId = setInterval(async () => {
    try {
      await checkWebsite(monitor);
    } catch (error) {
      logger.error(`Error checking website ${monitor.url}:`, error);
      monitor.errorCount += 1;
      monitor.lastError = {
        message: error.message,
        date: new Date()
      };
      await monitor.save();
    }
  }, monitor.interval * 1000);

  activeJobs.set(monitor._id.toString(), jobId);
  logger.info(`Scheduled monitor for ${monitor.url} with interval ${monitor.interval}s`);
};

const checkWebsite = async (monitor) => {
  const page = await browser.newPage();
  
  try {
    // Устанавливаем таймаут и размер страницы
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(30000);
    
    // Загружаем страницу
    await page.goto(monitor.url, { waitUntil: 'networkidle0' });
    
    // Ждем появления селектора
    await page.waitForSelector(monitor.selector);
    
    // Получаем содержимое элемента
    const content = await page.$eval(monitor.selector, el => el.innerText);
    
    // Если это первая проверка
    if (!monitor.lastContent) {
      monitor.lastContent = content;
      monitor.lastCheck = new Date();
      await monitor.save();
      return;
    }
    
    // Проверяем на изменения
    if (content !== monitor.lastContent) {
      // Отправляем уведомление
      await sendChangeNotification(
        monitor.telegramChatId,
        monitor,
        monitor.lastContent,
        content
      );
      
      // Обновляем данные в БД
      monitor.lastContent = content;
      monitor.errorCount = 0;
      monitor.lastError = null;
    }
    
    monitor.lastCheck = new Date();
    await monitor.save();
    
  } catch (error) {
    throw error;
  } finally {
    await page.close();
  }
};

const stopMonitor = (monitorId) => {
  const jobId = activeJobs.get(monitorId);
  if (jobId) {
    clearInterval(jobId);
    activeJobs.delete(monitorId);
    logger.info(`Stopped monitor ${monitorId}`);
  }
};

process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close();
  }
  activeJobs.forEach((jobId) => clearInterval(jobId));
  process.exit(0);
});

module.exports = {
  initializeScheduler,
  stopMonitor,
  checkWebsite
};

// Очистка ресурсов при остановке приложения
process.on('SIGINT', async () => {
  try {
    logger.info('Gracefully shutting down...');
    // Останавливаем все активные задачи
    for (const [monitorId, jobId] of activeJobs.entries()) {
      clearInterval(jobId);
      activeJobs.delete(monitorId);
    }
    // Закрываем браузер
    if (browser) {
      await browser.close();
    }
    logger.info('Cleanup completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during cleanup:', error);
    process.exit(1);
  }
});