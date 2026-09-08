import { http } from '../../../../shared/lib/api/http';
import type {
  IntegrationConfigMap,
  IntegrationDetail,
  IntegrationModule,
  IntegrationSummary,
  SaveIntegrationResult,
  TestIntegrationResult,
} from '../types';

async function list(): Promise<IntegrationSummary[]> {
  const response = await http.get<IntegrationSummary[]>('/admin/integrations');
  return response.data;
}

async function get<M extends IntegrationModule>(
  module: M
): Promise<IntegrationDetail<IntegrationConfigMap[M]>> {
  const response = await http.get<IntegrationDetail<IntegrationConfigMap[M]>>(
    `/admin/integrations/${module}`
  );
  return response.data;
}

async function update<M extends IntegrationModule>(
  module: M,
  data: IntegrationConfigMap[M]
): Promise<SaveIntegrationResult> {
  const response = await http.put<SaveIntegrationResult>(`/admin/integrations/${module}`, data);
  return response.data;
}

async function test<M extends IntegrationModule>(
  module: M,
  data: IntegrationConfigMap[M]
): Promise<TestIntegrationResult> {
  const response = await http.post<TestIntegrationResult>(
    `/admin/integrations/${module}/test`,
    data
  );
  return response.data;
}

async function remove(module: IntegrationModule): Promise<SaveIntegrationResult> {
  const response = await http.delete<SaveIntegrationResult>(`/admin/integrations/${module}`);
  return response.data;
}

export const integrationsApi = {
  list,
  get,
  update,
  test,
  remove,
};
