require('dotenv').config();
import { Sequelize } from 'sequelize-typescript';
import { APIKey } from '../models/apiKey';
import { ServerVersion } from '../models/serverVersion';
import { BalanceType } from '../models/Wallet/balanceType';
import { Uom } from '../models/Wallet/uom';
import { OwnerType } from '../models/Wallet/ownerType';
import { WalletType } from '../models/Wallet/walletType';
import { Wallet } from '../models/Wallet/wallet';
import { WalletTransaction } from '../models/Wallet/walletTransaction';
import { RegisteredService } from '../models/Wallet/registeredService';

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
      BalanceType,
      Uom,
      OwnerType,
      WalletType,
      Wallet,
      WalletTransaction,
      RegisteredService,
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
