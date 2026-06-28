export interface IUser {
  id: string;
  userName: string;
  email?: string;
  firstName: string;
  lastName?: string;
  contactNo?: string;
  children?: IUser[];
  isSuperuser: boolean;
  accountId?: number;
  // Opaque role identifiers carried in the gateway JWT claims. The engine
  // validates transition rules against these by value — it never resolves them
  // against an external service on the critical path (loose coupling).
  roles?: string[];
  // Permission codes the principal's roles grant, resolved locally at auth time
  // from the engine's own role_permission grants (RBAC over config endpoints).
  permissions?: string[];
}
