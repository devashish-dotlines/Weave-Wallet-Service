import { registeredServiceRepo } from '../../repos';

import RegisterServiceUseCase from './register/register.use-case';
import RegisterServiceController from './register/register.controller';

import ListServicesUseCase from './list/list.use-case';
import ListServicesController from './list/list.controller';

import RevokeServiceUseCase from './revoke/revoke.use-case';
import RevokeServiceController from './revoke/revoke.controller';

const registerServiceController = new RegisterServiceController(
  new RegisterServiceUseCase(registeredServiceRepo),
);

const listServicesController = new ListServicesController(
  new ListServicesUseCase(registeredServiceRepo),
);

const revokeServiceController = new RevokeServiceController(
  new RevokeServiceUseCase(registeredServiceRepo),
);

export {
  registerServiceController,
  listServicesController,
  revokeServiceController,
};
