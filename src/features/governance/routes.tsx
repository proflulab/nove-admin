import { SafetyCertificateOutlined } from '@ant-design/icons';
import { menuGroup } from '../../shared/utils/routes';
import { permissionRoutes } from './permissions';
import { apiKeyRoutes } from './api-keys/routes';
import { integrationsRoutes } from './integrations';
import { oauthClientRoutes } from './oauth-clients';

const governanceRouteList = [
  ...permissionRoutes,
  ...apiKeyRoutes,
  ...oauthClientRoutes,
  ...integrationsRoutes,
];

export const governanceRoutes = menuGroup(
  '/governance',
  '平台治理',
  <SafetyCertificateOutlined />,
  governanceRouteList
);
