import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationsManagement } from './IntegrationsManagement';

const mocks = vi.hoisted(() => ({
  canWrite: true,
  listConfigs: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ checkPermission: () => mocks.canWrite }),
}));

vi.mock('./api/integrationsApi', () => ({
  integrationsApi: {
    list: mocks.listConfigs,
    get: mocks.getConfig,
    update: vi.fn(),
    test: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('IntegrationsManagement', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    mocks.canWrite = true;
    mocks.listConfigs.mockResolvedValue(
      ['mail', 'ai', 'tencent-meeting', 'lark', 'wechat-shop'].map((module) => ({
        orgId: 'org-1',
        module,
        configured: module === 'mail',
        source: module === 'mail' ? 'database' : 'default',
        updatedAt: null,
        environmentImportedAt: module === 'mail' ? '2026-09-01T00:00:00.000Z' : null,
        environmentImportedFields: module === 'mail' ? ['host', 'user'] : [],
      }))
    );
    mocks.getConfig.mockImplementation((module: string) =>
      Promise.resolve({
        orgId: 'org-1',
        module,
        configured: module === 'mail',
        source: module === 'mail' ? 'database' : 'default',
        updatedAt: null,
        environmentImportedAt: module === 'mail' ? '2026-09-01T00:00:00.000Z' : null,
        environmentImportedFields: module === 'mail' ? ['host', 'user'] : [],
        value: {
          mail: {
            host: 'smtp.example.com',
            port: 465,
            secure: true,
            user: 'noreply@example.com',
            pass: '********',
            from: 'noreply@example.com',
            brandName: 'Nove System',
            brandPrimaryColor: '#2563eb',
            brandLogoUrl: '',
            brandPublicBaseUrl: 'https://app.example.com',
            brandFooterText: '系统邮件页脚',
          },
          ai: {
            provider: 'ark',
            model: 'doubao-pro',
            baseUrl: 'https://ark.example.com/v3',
            apiKey: '********',
            maxTokens: 16000,
            temperature: 0.7,
          },
          'tencent-meeting': {
            appId: 'tencent-app',
            sdkId: 'tencent-sdk',
            secretId: '********',
            secretKey: '********',
            userId: 'default-user',
            webhookToken: '',
            encodingAesKey: '********',
          },
          lark: {
            appId: 'lark-app',
            appSecret: '********',
            eventEncryptKey: '********',
            eventVerificationToken: '********',
          },
          'wechat-shop': {
            appId: 'wechat-app',
            appSecret: '********',
            webhookToken: '********',
            encodingAesKey: '',
            apiBaseUrl: 'https://api.weixin.qq.com',
          },
        }[module],
      })
    );
  });

  it('renders grouped service navigation and the Lark restart boundary', async () => {
    render(<IntegrationsManagement />);

    expect(await screen.findByText('邮件服务配置')).toBeInTheDocument();
    expect(screen.getByLabelText('查看配置说明')).toBeInTheDocument();
    expect(screen.queryByText('密钥更新说明')).not.toBeInTheDocument();
    expect(screen.getByText('通知服务')).toBeInTheDocument();
    expect(screen.getByText('AI 能力')).toBeInTheDocument();
    expect(screen.getByText('会议集成')).toBeInTheDocument();
    expect(screen.getByText('交易集成')).toBeInTheDocument();
    expect(screen.getByLabelText('只读配置详情')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /编辑配置/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /编辑配置/ }));

    const passwordInput = await screen.findByPlaceholderText('输入新密码以替换');
    expect(passwordInput).toHaveValue('********');
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, 'replacement-secret');
    expect(passwordInput).toHaveValue('replacement-secret');

    await userEvent.click(screen.getByRole('button', { name: '取消编辑' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /编辑配置/ })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('查看配置说明'));
    expect(await screen.findByText('初始配置来源')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('查看配置说明'));

    await userEvent.click(screen.getByText('飞书'));
    await waitFor(() => expect(mocks.getConfig).toHaveBeenCalledWith('lark'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('查看配置说明'));
    expect(await screen.findByText('飞书长连接')).toBeInTheDocument();
  }, 15_000);

  it('renders a content-only detail view without edit controls for read-only users', async () => {
    mocks.canWrite = false;
    const { container } = render(<IntegrationsManagement />);

    expect(await screen.findByText('smtp.example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('只读配置详情')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(container.querySelector('.ant-form-item-required')).toBeNull();
    expect(screen.queryByRole('button', { name: '删除数据库配置' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '测试连接' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存配置/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument();
    expect(screen.getByLabelText('查看配置说明')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑配置/ })).not.toBeInTheDocument();
    expect(screen.getByText('已启用')).toBeInTheDocument();
    expect(screen.getByText('#2563eb')).toBeInTheDocument();
    expect(screen.getAllByText('已配置（不可查看）')).toHaveLength(1);
    expect(screen.getAllByText('未配置').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText('AI 模型'));
    expect(await screen.findByText('模型服务')).toBeInTheDocument();
    expect(screen.getByText('生成参数')).toBeInTheDocument();
    expect(screen.getByText('火山方舟')).toBeInTheDocument();
    expect(screen.getByText('doubao-pro')).toBeInTheDocument();

    await userEvent.click(screen.getByText('腾讯会议'));
    expect(await screen.findByText('API 凭证')).toBeInTheDocument();
    expect(screen.getByText('default-user')).toBeInTheDocument();
    expect(screen.getAllByText('已配置（不可查看）')).toHaveLength(3);

    await userEvent.click(screen.getByText('飞书'));
    expect(await screen.findByText('应用与事件')).toBeInTheDocument();
    expect(screen.getByText('lark-app')).toBeInTheDocument();

    await userEvent.click(screen.getByText('微信小店'));
    expect(await screen.findByText('应用凭证')).toBeInTheDocument();
    expect(screen.getByText('API 地址')).toBeInTheDocument();
    expect(screen.getByText('https://api.weixin.qq.com')).toBeInTheDocument();
    expect(screen.getAllByText('未配置').length).toBeGreaterThan(0);
  }, 15_000);

  it('edits drive policies without a default organization or unsupported connection test', async () => {
    const user = userEvent.setup();
    render(<IntegrationsManagement />);
    await user.click(await screen.findByText('云盘与会议文件'));
    await waitFor(() => expect(mocks.getConfig).toHaveBeenCalledWith('drive'));
    await user.click(await screen.findByRole('button', { name: /编辑配置/ }));
    expect(await screen.findByLabelText('允许扩展名')).toBeInTheDocument();
    expect(screen.queryByLabelText('会议同步默认组织 ID')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '测试连接' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存配置/ })).toBeInTheDocument();
  });
});
