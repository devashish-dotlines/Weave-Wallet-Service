require('dotenv').config();
const { DB_SYNC } = process.env;
import { sequelizeConnection } from '../config';
import * as Sequelize from 'sequelize';

import { ServerVersion } from './serverVersion';
import { APIKey } from './apiKey';
import { BalanceType } from './Wallet/balanceType';
import { BalanceTypeUom } from './Wallet/balanceTypeUom';
import { Uom } from './Wallet/uom';
import { OwnerType } from './Wallet/ownerType';
import { WalletType } from './Wallet/walletType';
import { Wallet } from './Wallet/wallet';
import { WalletTransaction } from './Wallet/walletTransaction';
import { RegisteredService } from './Wallet/registeredService';
import { UsageDimension } from './Wallet/usageDimension';
import { WalletUsageRestriction } from './Wallet/walletUsageRestriction';

let models: any = {};
let modelsLoaded = false;
const needs_db_sync = DB_SYNC === 'true';

const createModels = () => {
  if (modelsLoaded) return models;

  models['ServerVersion'] = ServerVersion;
  models['APIKey'] = APIKey;
  models['BalanceType'] = BalanceType;
  models['BalanceTypeUom'] = BalanceTypeUom;
  models['Uom'] = Uom;
  models['OwnerType'] = OwnerType;
  models['WalletType'] = WalletType;
  models['Wallet'] = Wallet;
  models['WalletTransaction'] = WalletTransaction;
  models['RegisteredService'] = RegisteredService;
  models['UsageDimension'] = UsageDimension;
  models['WalletUsageRestriction'] = WalletUsageRestriction;

  // Register new module models here, e.g.:
  // models['<ModelName>'] = <ModelName>;

  models['sequelize'] = sequelizeConnection;
  models['Sequelize'] = Sequelize;
  modelsLoaded = true;
  return models;
};
(async () => {
  if (needs_db_sync) {
    await sequelizeConnection.sync({ alter: true }).then((result) => {
      console.log('Database has been synced');
    });
  }
})();

export default createModels();
