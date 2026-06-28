require('dotenv').config();
import { Sequelize } from 'sequelize-typescript';
import { APIKey } from '../models/apiKey';
import { ServerVersion } from '../models/serverVersion';

import { config } from '../../../config/index';

const dbConfig = config.db[config.nodeEnv];

export const sequelizeConnection = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    logging: false,
    // schema: 'core',
    models: [
      ServerVersion,
      APIKey,
      // Register new module models here.
    ],
    port: dbConfig.port,
    dialectOptions: {
      multipleStatements: true,
    },
    pool: {
      max: 300,
      idle: 30000,
      acquire: 60000,
    },
  },
);
