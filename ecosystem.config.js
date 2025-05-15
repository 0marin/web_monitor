module.exports = {
  apps: [{
    name: 'web-monitor',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      TZ: 'Europe/Kiev'
    },
    error_file: 'logs/pm2/err.log',
    out_file: 'logs/pm2/out.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    log_type: 'json'
  }]
};