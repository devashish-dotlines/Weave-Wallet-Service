import { QueryTypes } from 'sequelize';
import { sequelizeConnection } from '../../infra/sequelize/config';
import { DateTimeObject } from '../../modules/Core/domain/dateTimeObject';
import { DeleteDTO } from '../DTO/deleteDTO';
import { RestoreDTO } from '../DTO/restoreDTO';
import { ServerVersion } from '../service/serverVersion';

export abstract class BaseRepo {
  constructor(
    protected readonly models: any,
    protected readonly baseModel: any,
  ) {}

  protected createBaseQuery(includes: any[] = []) {
    if (includes.length === 0) {
      return {
        where: {},
      };
    } else {
      return {
        where: {},
        include: includes,
      };
    }
  }

  protected async runQuery(query: string, replacements: any) {
    const [results, metadata] = await sequelizeConnection.query(query, {
      replacements,
    });

    return results;
  }

  protected async runUpdateQuery(query: string, replacements: any) {
    const [results, metadata] = await sequelizeConnection.query(query, {
      replacements,
      type: QueryTypes.UPDATE,
    });

    return results;
  }

  public async delete(dto: DeleteDTO): Promise<string | null> {
    try {
      const deletedAtOrError = DateTimeObject.create(-1);
      const deleteData: {
        voided: boolean;
        deleted_by: string;
        deleted_at: number;
      } = {
        voided: true,
        deleted_by: dto.requestedBy,
        deleted_at: deletedAtOrError.getValue().value,
      };
      const instance = await this.baseModel.update(deleteData, {
        where: { id: dto.id.toString() },
        returning: true,
      });
      if (instance) return dto.id;
      else return null;
    } catch (err) {
      throw new Error(err);
    }
  }

  public async restore(dto: RestoreDTO): Promise<string | null> {
    const baseQuery = this.createBaseQuery();
    baseQuery.where['id'] = dto.id;
    const instance = await this.baseModel.findOne(baseQuery);
    if (instance) {
      const updatedAtOrError = DateTimeObject.create(-1);
      const savedInstance = await instance.update({
        voided: false,
        deletedAt: null,
        deletedBy: null,
        updatedAt: updatedAtOrError.getValue().value,
        updatedBy: dto.requestedBy,
        serverVersion: await new ServerVersion().getServerVersion(),
      });
      return savedInstance.id;
    }

    return null;
  }
}
