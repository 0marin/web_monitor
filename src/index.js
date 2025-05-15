const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const monitoringRoutes = require('./routes/monitoring');
const { setupTelegramBot } = require('./services/telegramBot');
const { initializeScheduler } = require('./services/scheduler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ?
    process.env.ALLOWED_ORIGINS.split(',') :
    '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400 // 24 часа
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Endpoint для страницы выбора селектора
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'selector.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  logger.info('Connected to MongoDB');
  
  // Start the server
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    
    // Initialize services
    setupTelegramBot();
    initializeScheduler();
  });
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});