module.exports = {
  apps: [
    {
      name: "wbs-sync",
      script: "dist/cron.js",
      watch: false, // Disable watch in production
      instances: 1,
      exec_mode: "fork",

      // Environment configuration
      env: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
      },

      // Error handling and restart policy
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",

      // Logging configuration
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Process management
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,

      // Load environment variables
      env_file: ".env",
    },
  ],
};
