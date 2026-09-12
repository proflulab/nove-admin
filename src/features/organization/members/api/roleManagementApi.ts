import {
  roleControllerDeleteRoleBinding,
  roleControllerCreate,
  roleControllerCreateRoleBinding,
  roleControllerDelete,
  roleControllerFindAll,
  roleControllerUpdate,
} from '../../../../shared/lib/api/orval/business/admin-roles';
import type {
  CreateRoleBindingDto,
  CreateRoleDto,
  RoleControllerFindAllParams,
  RoleDto,
  UpdateRoleDto,
} from '../../../../shared/lib/api/orval/business/schemas';

export type Role = RoleDto;
export type RoleListParams = RoleControllerFindAllParams;
export type CreateRole = CreateRoleDto;
export type UpdateRole = UpdateRoleDto;
export type CreateRoleBinding = CreateRoleBindingDto;

export interface RoleListResult {
  data: Role[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const roleManagementApi = {
  async list(params: RoleListParams): Promise<RoleListResult> {
    const result = await roleControllerFindAll(params);
    return {
      data: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  },

  create(data: CreateRole): Promise<Role> {
    return roleControllerCreate(data);
  },

  update(roleId: string, data: UpdateRole): Promise<Role> {
    return roleControllerUpdate(roleId, data);
  },

  delete(roleId: string): Promise<void> {
    return roleControllerDelete(roleId);
  },

  unbindMember(orgId: string, bindingId: string) {
    return roleControllerDeleteRoleBinding(orgId, bindingId);
  },

  bindMember(orgId: string, data: CreateRoleBinding) {
    return roleControllerCreateRoleBinding(orgId, data);
  },
};
