// PM2 process definitions for the Wallet microservice.
//
// Two long-running processes, both from the compiled build/ output:
//   - wallet-http : Express REST API (build/index.js), listens on config.port (PORT, default 9044)
//   - wallet-grpc : inbound gRPC server (build/grpc.js), listens on GRPC_PORT
//
// Build first (`npm run build`), then: `pm2 start ecosystem.config.js`.
// .env is loaded by the app itself (dotenv) from the cwd, so keep it beside this file.

module.exports = {
  apps: [
    {
      name: 'wallet-api',
      script: 'build/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/wallet-http.error.log',
      out_file: 'logs/wallet-http.out.log',
      time: true,
    },
    {
      name: 'wallet-grpc',
      script: 'build/grpc.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/wallet-grpc.error.log',
      out_file: 'logs/wallet-grpc.out.log',
      time: true,
    },
  ],
};
