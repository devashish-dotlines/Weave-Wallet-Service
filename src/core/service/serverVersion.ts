// import { sequelizeConnection } from "../../infra/sequelize/config/config";
import { sequelizeConnection } from '../../infra/sequelize/config';
import { QueryTypes } from 'sequelize';
import models from '../../infra/sequelize/models';

export interface IServerVersion {
  getServerVersion(): Promise<number>;
}

export class ServerVersion implements IServerVersion {
  public async getServerVersion(): Promise<number> {
    /* old code  */
    /*
    const getNextValQry =
      "SELECT nextval('public.server_version') server_version";
    const serverVersionInstance = await sequelizeConnection.query(
      getNextValQry,
      {
        plain: true,
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    const serverVersion =
      serverVersionInstance && serverVersionInstance['server_version']
        ? serverVersionInstance['server_version']
        : '-1';
    // console.log(parseInt(serverVersion));
    return parseInt(serverVersion);
    */
    const row = await models.ServerVersion.create({});
    return row.id;
  }
}
