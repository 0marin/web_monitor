const express = require('express');
const router = express.Router();
const Monitor = require('../models/Monitor');
const { stopMonitor } = require('../services/scheduler');
const logger = require('../utils/logger');

// Получить все задачи мониторинга для определенного chat_id
router.get('/', async (req, res) => {
  try {
    const { chat_id } = req.query;
    if (!chat_id) {
      return res.status(400).json({ error: 'chat_id parameter is required' });
    }

    const monitors = await Monitor.find({ telegramChatId: chat_id });
    res.json(monitors);
  } catch (error) {
    logger.error('Error fetching monitors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать новую задачу мониторинга
router.post('/', async (req, res) => {
  try {
    const { url, selector, interval, telegramChatId, name } = req.body;

    // Валидация входных данных
    if (!url || !selector || !telegramChatId || !name) {
      return res.status(400).json({ 
        error: 'url, selector, telegramChatId, and name are required' 
      });
    }

    // Проверка на существование похожей задачи
    const existingMonitor = await Monitor.findOne({
      url,
      selector,
      telegramChatId
    });

    if (existingMonitor) {
      return res.status(400).json({ 
        error: 'Monitor with these parameters already exists' 
      });
    }

    const monitor = new Monitor({
      url,
      selector,
      interval: interval || 300, // 5 минут по умолчанию
      telegramChatId,
      name
    });

    await monitor.save();
    res.status(201).json(monitor);
  } catch (error) {
    logger.error('Error creating monitor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить задачу мониторинга
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Запрещаем обновление определенных полей
    delete updates.lastCheck;
    delete updates.lastContent;
    delete updates.createdAt;
    
    const monitor = await Monitor.findById(id);
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    // Если меняется статус активности
    if (updates.isActive === false && monitor.isActive === true) {
      stopMonitor(monitor._id.toString());
    }

    Object.assign(monitor, updates);
    await monitor.save();

    res.json(monitor);
  } catch (error) {
    logger.error('Error updating monitor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить задачу мониторинга
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const monitor = await Monitor.findById(id);
    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    // Останавливаем задачу перед удалением
    stopMonitor(monitor._id.toString());
    
    await monitor.deleteOne();
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting monitor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить статистику мониторинга
router.get('/stats/:chat_id', async (req, res) => {
  try {
    const { chat_id } = req.params;
    
    const stats = await Monitor.aggregate([
      { $match: { telegramChatId: chat_id } },
      { $group: {
        _id: null,
        totalMonitors: { $sum: 1 },
        activeMonitors: { 
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        averageInterval: { $avg: '$interval' },
        totalErrors: { $sum: '$errorCount' }
      }}
    ]);

    if (stats.length === 0) {
      return res.json({
        totalMonitors: 0,
        activeMonitors: 0,
        averageInterval: 0,
        totalErrors: 0
      });
    }

    res.json(stats[0]);
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;