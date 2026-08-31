import { CloudOutlined } from '@ant-design/icons';
import type { RouteConfig } from '../../shared/types';
import { PERMISSIONS } from '../../shared/utils/permissions';
import { DrivePage } from './pages/DrivePage';
import { UnassignedMeetingPage } from './pages/UnassignedMeetingPage';

export const driveRoutes: RouteConfig[] = [
  {
    path: '/drive',
    element: <DrivePage />,
    title: '云盘',
    menu: true,
    permission: PERMISSIONS.DRIVE.READ,
    icon: <CloudOutlined />,
  },
  {
    path: '/drive/unassigned-meetings',
    element: <UnassignedMeetingPage />,
    title: '待归属会议',
    menu: true,
    permission: PERMISSIONS.DRIVE.ADMIN,
    icon: <CloudOutlined />,
  },
];
