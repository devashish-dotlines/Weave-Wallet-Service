import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import { v1Router } from './api/v1';
import { config, isProduction } from '../../config/index';
import { redisClient, initRedis } from '../redis';
import { ipWhitelist } from '../../core/infra/globalVars';

const app = express();
app.disable('x-powered-by');
const origin = {
  origin: isProduction ? 'https://whitelabel.com' : '*',
};

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(cors(origin));9
app.use(compression());
//app.use(helmet());
//app.use(morgan("combined"));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Expose-Headers', 'x-total-count');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,authorization');

  next();
});

// Request logger: prints every endpoint called, with status and duration.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(
      `[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });
  next();
});

app.use('/api', v1Router);
app.use('/media', express.static('media'));
app.use('/public/assets', express.static('public/assets'));

// New api versions can go here

// Global error handler (must be after all routes/middleware)
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);

    const status =
      err.status && Number.isInteger(err.status) ? err.status : 500;
    const message =
      status === 500 ? 'Internal server error' : err.message || 'Error';

    res.status(status).json({
      message,
    });
  },
);

app.listen(config.port, () => {
  console.log(`[App]: Server listening on ${config.port}`);
});

if (config.ipWhitelist.length > 0) {
  ipWhitelist.push(...config.ipWhitelist);
}

void initRedis();

export { app, redisClient };
