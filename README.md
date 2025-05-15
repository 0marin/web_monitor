# Web Monitor

Система мониторинга изменений на веб-страницах с уведомлениями в Telegram.

## Возможности

- Мониторинг изменений определенных элементов на веб-страницах
- Настраиваемые интервалы проверки (от 1 минуты)
- Уведомления об изменениях через Telegram бот
- REST API для управления задачами мониторинга
- Детальная история изменений
- Гибкая настройка селекторов элементов

## Технический стек

- Node.js
- Express.js
- MongoDB
- Puppeteer
- Telegram Bot API

## Требования

- Node.js 14+
- MongoDB 4.4+
- Telegram бот (токен от @BotFather)

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/web-monitor.git
cd web-monitor
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл .env на основе .env.example:
```bash
cp .env.example .env
```

4. Настройте переменные окружения в файле .env:
- PORT - порт для запуска сервера
- MONGODB_URI - URI для подключения к MongoDB
- TELEGRAM_BOT_TOKEN - токен вашего Telegram бота
- NODE_ENV - окружение (development/production)

## Запуск

Для разработки:
```bash
npm run dev
```

Для продакшена:
```bash
npm start
```

## API Endpoints

### Получение списка задач мониторинга
```
GET /api/monitoring?chat_id=YOUR_CHAT_ID
```

### Создание новой задачи
```
POST /api/monitoring
Content-Type: application/json

{
  "url": "https://example.com",
  "selector": ".price-element",
  "interval": 300,
  "telegramChatId": "YOUR_CHAT_ID",
  "name": "Monitor Name"
}
```

### Обновление задачи
```
PATCH /api/monitoring/:id
Content-Type: application/json

{
  "interval": 600,
  "isActive": true
}
```

### Удаление задачи
```
DELETE /api/monitoring/:id
```

### Получение статистики
```
GET /api/monitoring/stats/:chat_id
```

## Telegram Bot Команды

- `/start` - Получить приветственное сообщение и ваш Chat ID
- `/status` - Просмотреть статус активных задач мониторинга

## Развертывание

Приложение можно развернуть на любом сервисе, поддерживающем Node.js:

1. Railway.app (рекомендуется):
   - Создайте новый проект
   - Подключите репозиторий
   - Настройте переменные окружения
   - Deployment произойдет автоматически

2. Heroku:
   - Создайте новый проект
   - Подключите репозиторий
   - Настройте переменные окружения
   - Добавьте buildpack nodejs

## Безопасность

- Все запросы к API должны включать корректный chat_id
- Используется rate limiting для предотвращения DoS атак
- Все входные данные валидируются
- Поддерживается HTTPS (при настройке reverse proxy)

## Логирование

Логи сохраняются в директории `logs`:
- `error.log` - только ошибки
- `combined.log` - все логи

В режиме разработки логи также выводятся в консоль.

## Ограничения

- Минимальный интервал проверки: 60 секунд
- Максимальное количество активных задач на один chat_id: не ограничено
- Размер лог-файлов: 5MB с ротацией (хранятся последние 5 файлов)

## Помощь в разработке

1. Форкните репозиторий
2. Создайте ветку для новой функциональности
3. Внесите изменения
4. Создайте Pull Request

## Лицензия

MIT