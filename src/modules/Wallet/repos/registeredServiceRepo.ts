import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { RegisteredService } from '../domain/registeredService';
import { RegisteredServiceMap } from '../mappers/registeredServiceMapper';
import { IRegisteredServiceRepo } from './interface/IRegisteredServiceRepo';

export class RegisteredServiceRepo
  extends BaseRepo
  implements IRegisteredServiceRepo
{
  constructor(models: any) {
    super(models, models.RegisteredService);
  }

  public async exists(id: string): Promise<boolean> {
    const instance = await this.baseModel.findOne({
      where: { id, voided: false },
    });
    return !!instance;
  }

  public async findById(id: string): Promise<RegisteredService | null> {
    const instance = await this.baseModel.findOne({
      where: { id, voided: false },
    });
    return instance ? RegisteredServiceMap.toDomain(instance) : null;
  }

  public async findByName(name: string): Promise<RegisteredService | null> {
    const instance = await this.baseModel.findOne({
      where: { name, voided: false },
    });
    return instance ? RegisteredServiceMap.toDomain(instance) : null;
  }

  public async findByApiKey(apiKey: string): Promise<RegisteredService | null> {
    if (!apiKey) return null;
    const instance = await this.baseModel.findOne({
      where: { apiKey, isActive: true, voided: false },
    });
    return instance ? RegisteredServiceMap.toDomain(instance) : null;
  }

  public async list(): Promise<RegisteredService[]> {
    const instances = await this.baseModel.findAll({
      where: { voided: false },
      order: [['name', 'ASC']],
    });
    const out: RegisteredService[] = [];
    for (const instance of instances) {
      const d = await RegisteredServiceMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async create(domainObject: RegisteredService): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const persistentObj = await RegisteredServiceMap.toPersistence(
        domainObject,
      );
      const saved = await this.baseModel.create(persistentObj, {
        transaction: txn,
      });
      await txn.commit();
      return saved.id;
    } catch (err) {
      if (txn) await txn.rollback();
      throw new Error(err as any);
    }
  }

  public async update(domainObject: RegisteredService): Promise<string | null> {
    const existing = await this.baseModel.findOne({
      where: { id: domainObject.id.toString() },
    });
    if (!existing) throw new Error('No RegisteredService exists with this id');
    const saved = await existing.update(
      await RegisteredServiceMap.toPersistence(domainObject),
    );
    return saved.id;
  }
}
