require('dotenv').config();
const { DB_SYNC } = process.env;
import { sequelizeConnection } from '../config';
import * as Sequelize from 'sequelize';

import { ServerVersion } from './serverVersion';
import { APIKey } from './apiKey';

let models: any = {};
let modelsLoaded = false;
const needs_db_sync = DB_SYNC === 'true';

const createModels = () => {
  if (modelsLoaded) return models;

  models['ServerVersion'] = ServerVersion;
  models['APIKey'] = APIKey;

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
