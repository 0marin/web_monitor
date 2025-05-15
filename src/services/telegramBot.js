const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

let bot = null;

const setupTelegramBot = () => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not found in environment variables');
    }

    bot = new TelegramBot(token, { polling: true });
    setupCommandHandlers();
    logger.info('Telegram bot initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Telegram bot:', error);
    throw error;
  }
};

const setupCommandHandlers = () => {
  // Обработка команды /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await bot.sendMessage(chatId,
        'Добро пожаловать в Web Monitor Bot!\n\n' +
        'Доступные команды:\n' +
        '/start - Показать это сообщение\n' +
        '/status - Статус мониторинга\n' +
        '/pause - Приостановить все проверки\n' +
        '/resume - Возобновить проверки\n' +
        '/check_now - Проверить изменения сейчас\n\n' +
        'Ваш Chat ID: `' + chatId + '`\n' +
        'Используйте этот ID при настройке мониторинга в веб-интерфейсе.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  });

  // Обработка команды /pause
  bot.onText(/\/pause/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await bot.sendMessage(chatId, 
        'Добро пожаловать в Web Monitor Bot!\n\n' +
        'Этот бот будет отправлять вам уведомления об изменениях на отслеживаемых веб-страницах.\n\n' +
        'Ваш Chat ID: `' + chatId + '`\n' +
        'Используйте этот ID при настройке мониторинга в веб-интерфейсе.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  });

  // Обработка команды /pause
  bot.onText(/\/pause/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const Monitor = require('../models/Monitor');
      const { stopMonitor } = require('./scheduler');
      
      // Останавливаем все активные мониторы для этого чата
      const monitors = await Monitor.find({
        telegramChatId: chatId.toString(),
        isActive: true
      });

      for (const monitor of monitors) {
        stopMonitor(monitor._id.toString());
        monitor.isActive = false;
        monitor.pausedAt = new Date();
        await monitor.save();
      }

      await bot.sendMessage(chatId,
        `✅ Мониторинг приостановлен\n` +
        `Остановлено задач: ${monitors.length}\n` +
        `Используйте /resume для возобновления`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error pausing monitors:', error);
      await bot.sendMessage(chatId, '❌ Ошибка при остановке мониторинга');
    }
  });

  // Обработка команды /resume
  bot.onText(/\/resume/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const Monitor = require('../models/Monitor');
      
      // Находим все приостановленные мониторы
      const monitors = await Monitor.find({
        telegramChatId: chatId.toString(),
        isActive: false,
        pausedAt: { $exists: true }
      });

      for (const monitor of monitors) {
        monitor.isActive = true;
        // Сохраняем время последней проверки
        monitor.lastCheck = monitor.pausedAt;
        monitor.pausedAt = null;
        await monitor.save();
      }

      await bot.sendMessage(chatId,
        `✅ Мониторинг возобновлен\n` +
        `Запущено задач: ${monitors.length}\n` +
        `При следующей проверке будут учтены изменения во время паузы`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error resuming monitors:', error);
      await bot.sendMessage(chatId, '❌ Ошибка при возобновлении мониторинга');
    }
  });

  // Обработка команды /check_now
  bot.onText(/\/check_now/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const Monitor = require('../models/Monitor');
      const { checkWebsite } = require('./scheduler');
      
      const monitors = await Monitor.find({
        telegramChatId: chatId.toString(),
        isActive: true
      });

      if (monitors.length === 0) {
        await bot.sendMessage(chatId, 'У вас нет активных задач мониторинга');
        return;
      }

      await bot.sendMessage(chatId, `🔄 Проверяю ${monitors.length} сайтов...`);
      
      for (const monitor of monitors) {
        try {
          await checkWebsite(monitor);
        } catch (error) {
          logger.error(`Error checking website ${monitor.url}:`, error);
        }
      }

      await bot.sendMessage(chatId, '✅ Проверка завершена');
    } catch (error) {
      logger.error('Error in manual check:', error);
      await bot.sendMessage(chatId, '❌ Ошибка при выполнении проверки');
    }
  });

  // Обработка команды /status
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const Monitor = require('../models/Monitor');
      const activeMonitors = await Monitor.find({
        telegramChatId: chatId.toString()
      });

      const active = activeMonitors.filter(m => m.isActive).length;
      const paused = activeMonitors.filter(m => !m.isActive).length;

      await bot.sendMessage(chatId,
        `📊 Статус мониторинга:\n\n` +
        `Активных задач: ${active}\n` +
        `Приостановленных задач: ${paused}\n` +
        `Всего задач: ${activeMonitors.length}\n` +
        `Chat ID: ${chatId}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error sending status:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при получении статуса.');
    }
  });
};

const sendChangeNotification = async (chatId, monitorData, oldContent, newContent) => {
  if (!bot) {
    logger.error('Telegram bot not initialized');
    return;
  }

  try {
    const message = formatChangeNotification(monitorData, oldContent, newContent);
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    logger.info(`Change notification sent to chat ${chatId}`);
  } catch (error) {
    logger.error('Error sending change notification:', error);
    throw error;
  }
};

const formatChangeNotification = (monitorData, oldContent, newContent) => {
  const { url, name, selector } = monitorData;
  
  let message = `🔔 *Обнаружено изменение!*\n\n`;
  message += `*Сайт:* ${name}\n`;
  message += `*URL:* [Открыть](${url})\n`;
  
  if (monitorData.notifications.telegram.format === 'detailed') {
    message += `\n*Старое значение:*\n\`\`\`\n${truncateContent(oldContent)}\n\`\`\`\n`;
    message += `\n*Новое значение:*\n\`\`\`\n${truncateContent(newContent)}\n\`\`\``;
  } else {
    message += `\n*Статус:* Содержимое изменилось`;
  }
  
  return message;
};

const truncateContent = (content, maxLength = 500) => {
  if (!content) return 'Нет данных';
  content = content.trim();
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
};

module.exports = {
  setupTelegramBot,
  sendChangeNotification
};