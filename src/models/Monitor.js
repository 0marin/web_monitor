const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  selector: {
    type: String,
    required: true
  },
  interval: {
    type: Number,
    required: true,
    min: 60, // минимум 60 секунд
    default: 300 // 5 минут по умолчанию
  },
  lastCheck: {
    type: Date,
    default: null
  },
  lastContent: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  telegramChatId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  notifications: {
    telegram: {
      enabled: {
        type: Boolean,
        default: true
      },
      format: {
        type: String,
        enum: ['simple', 'detailed'],
        default: 'detailed'
      }
    }
  },
  errorCount: {
    type: Number,
    default: 0
  },
  lastError: {
    message: String,
    date: Date
  },
  pausedAt: {
    type: Date,
    default: null
  }
});

// Индексы для оптимизации запросов
monitorSchema.index({ url: 1, selector: 1 });
monitorSchema.index({ isActive: 1 });
monitorSchema.index({ lastCheck: 1 });

const Monitor = mongoose.model('Monitor', monitorSchema);

module.exports = Monitor;