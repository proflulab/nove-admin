import {
  ApiOutlined,
  CloudOutlined,
  CloudServerOutlined,
  EditOutlined,
  MailOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SecurityScanOutlined,
  ShopOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Divider from 'antd/es/divider';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Menu from 'antd/es/menu';
import Popconfirm from 'antd/es/popconfirm';
import Popover from 'antd/es/popover';
import Row from 'antd/es/row';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import message from 'antd/es/message';
import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { PERMISSIONS } from '../../../shared/utils/permissions';
import { integrationsApi } from './api/integrationsApi';
import { ReadonlyConfigView } from './components/ReadonlyConfigView';
import {
  buildAiConfigPayload,
  buildLarkConfigPayload,
  buildMailConfigPayload,
  buildStorageConfigPayload,
  buildTencentMeetingConfigPayload,
  buildWechatShopConfigPayload,
} from './lib/configPayload';
import type {
  AiConfig,
  IntegrationDetail,
  IntegrationSummary,
  DriveConfig,
  FileScanningConfig,
  LarkConfig,
  MailConfig,
  IntegrationConfigMap,
  IntegrationModule,
  StorageConfig,
  TencentMeetingConfig,
  TestIntegrationResult,
  WechatShopConfig,
} from './types';
import './IntegrationsManagement.css';

const MODULE_META: Record<
  IntegrationModule,
  { label: string; title: string; description: string; icon: ReactNode }
> = {
  mail: {
    label: '邮件服务',
    title: '邮件服务配置',
    description: '用于系统通知、验证码、账号找回和邮件品牌展示',
    icon: <MailOutlined />,
  },
  ai: {
    label: 'AI 模型',
    title: 'AI 模型服务配置',
    description: '用于妙记总结、参会者总结和其他智能生成任务',
    icon: <RobotOutlined />,
  },
  'tencent-meeting': {
    label: '腾讯会议',
    title: '腾讯会议配置',
    description: '用于会议记录同步、智能纪要和 Webhook 验证',
    icon: <VideoCameraOutlined />,
  },
  lark: {
    label: '飞书',
    title: '飞书开放平台配置',
    description: '用于飞书会议事件接收与开放平台集成',
    icon: <ApiOutlined />,
  },
  'wechat-shop': {
    label: '微信小店',
    title: '微信小店配置',
    description: '用于微信小店回调验证和订单同步',
    icon: <ShopOutlined />,
  },
  storage: {
    label: '对象存储',
    title: '对象存储配置',
    description: '配置阿里云 OSS 或兼容存储，用于云盘、头像及附件存储',
    icon: <CloudServerOutlined />,
  },
  drive: {
    label: '云盘策略',
    title: '云盘策略配置',
    description: '控制文件白名单、容量限制和下载回收站策略',
    icon: <CloudOutlined />,
  },
  'file-scanning': {
    label: '病毒扫描',
    title: '病毒扫描服务配置',
    description: '选择扫描引擎并配置 ClamAV 或阿里云安全中心参数',
    icon: <SecurityScanOutlined />,
  },
};

type SecretInputProps = ComponentProps<typeof Input.Password>;

function SecretInput({ placeholder, ...inputProps }: SecretInputProps) {
  return (
    <Input.Password
      {...inputProps}
      autoComplete="new-password"
      placeholder={placeholder}
      visibilityToggle={false}
    />
  );
}

interface ConfigPanelProps {
  module: IntegrationModule;
  summary?: IntegrationSummary;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  deleting: boolean;
  canWrite: boolean;
  isEditing: boolean;
  testResult?: TestIntegrationResult;
  onRefresh: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onTest: () => void;
  onDelete: () => void;
  children: ReactNode;
}

function ConfigPanel({
  module,
  summary,
  loading,
  saving,
  testing,
  deleting,
  canWrite,
  isEditing,
  testResult,
  onRefresh,
  onEdit,
  onCancelEdit,
  onSave,
  onTest,
  onDelete,
  children,
}: ConfigPanelProps) {
  const meta = MODULE_META[module];
  const canDelete = summary?.source === 'database';

  return (
    <Card
      className="integrations-card"
      loading={loading}
      title={
        <div className="integrations-card-heading">
          <span className="integrations-card-title-line">
            <span>{meta.title}</span>
            <Popover
              placement="bottomLeft"
              title="配置说明"
              content={
                <div className="integrations-secret-help">
                  <div className="integrations-help-section">
                    <div className="integrations-help-section-title">密钥更新</div>
                    <div>
                      已配置的敏感字段会以 <code>********</code>{' '}
                      显示。保持原样或留空会继续使用当前密钥；输入新值后才会替换。
                    </div>
                  </div>
                  {summary?.source === 'database' &&
                    (summary.environmentImportedFields?.length ?? 0) > 0 && (
                      <div className="integrations-help-section">
                        <div className="integrations-help-section-title">初始配置来源</div>
                        <div>
                          此配置首次由环境变量导入数据库，当前及后续运行均以数据库配置为准。
                        </div>
                      </div>
                    )}
                  {module === 'lark' && (
                    <div className="integrations-help-section">
                      <div className="integrations-help-section-title">飞书长连接</div>
                      <div>
                        HTTP API 和事件配置会立即生效；App ID 或 App Secret
                        变更后，事件长连接需要重启 API。
                      </div>
                    </div>
                  )}
                </div>
              }
            >
              <Button
                type="text"
                size="small"
                className="integrations-help-button"
                aria-label="查看配置说明"
                icon={<QuestionCircleOutlined />}
              />
            </Popover>
          </span>
          <span>{meta.description}</span>
        </div>
      }
      extra={
        <Space>
          {summary && (
            <Tag color={summary.configured ? 'success' : 'default'}>
              {summary.configured ? '已配置' : '未配置'}
            </Tag>
          )}
          {canWrite && !isEditing && (
            <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>
              编辑配置
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
        </Space>
      }
    >
      {isEditing && testResult && (
        <Alert
          className="integrations-test-result"
          type={testResult.success ? 'success' : 'error'}
          showIcon
          title={testResult.message}
        />
      )}
      {children}
      {isEditing && (
        <>
          <Divider className="integrations-divider" />
          <div className="integrations-actions">
            <Popconfirm
              title={`删除${meta.label}数据库配置？`}
              description={
                module === 'drive'
                  ? '删除后将恢复默认文件策略；扫描服务仍按部署配置选择。'
                  : '删除后服务将变为未配置，重启时也不会从环境变量恢复。'
              }
              okText="删除"
              cancelText="取消"
              disabled={!canDelete}
              okButtonProps={{ danger: true, loading: deleting }}
              onConfirm={onDelete}
            >
              <Button danger disabled={!canDelete} loading={deleting}>
                删除数据库配置
              </Button>
            </Popconfirm>
            <Space>
              <Button onClick={onCancelEdit}>取消编辑</Button>
              {module !== 'drive' && (
                <Button loading={testing} onClick={onTest}>
                  测试连接
                </Button>
              )}
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
                保存配置
              </Button>
            </Space>
          </div>
        </>
      )}
    </Card>
  );
}

export function IntegrationsManagement() {
  const { checkPermission } = useAuth();
  const canWrite = checkPermission(PERMISSIONS.SYSTEM.CONFIG_WRITE);
  const [activeModule, setActiveModule] = useState<IntegrationModule>('mail');
  const [editingModule, setEditingModule] = useState<IntegrationModule | null>(null);
  const [summaries, setSummaries] = useState<IntegrationSummary[]>([]);
  const [details, setDetails] = useState<
    Partial<{ [M in IntegrationModule]: IntegrationDetail<IntegrationConfigMap[M]> }>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResults, setTestResults] = useState<
    Partial<Record<IntegrationModule, TestIntegrationResult>>
  >({});

  const [mailForm] = Form.useForm<MailConfig>();
  const [aiForm] = Form.useForm<AiConfig>();
  const [tencentForm] = Form.useForm<TencentMeetingConfig>();
  const [larkForm] = Form.useForm<LarkConfig>();
  const [wechatForm] = Form.useForm<WechatShopConfig>();
  const [storageForm] = Form.useForm<StorageConfig>();
  const [driveForm] = Form.useForm<DriveConfig>();
  const [fileScanningForm] = Form.useForm<FileScanningConfig>();

  const summaryMap = useMemo(
    () => new Map(summaries.map((summary) => [summary.module, summary])),
    [summaries]
  );

  const setFormValue = useCallback(
    (module: IntegrationModule, value: IntegrationConfigMap[IntegrationModule]) => {
      if (module === 'mail') mailForm.setFieldsValue(value as MailConfig);
      if (module === 'ai') aiForm.setFieldsValue(value as AiConfig);
      if (module === 'tencent-meeting') tencentForm.setFieldsValue(value as TencentMeetingConfig);
      if (module === 'lark') larkForm.setFieldsValue(value as LarkConfig);
      if (module === 'wechat-shop') wechatForm.setFieldsValue(value as WechatShopConfig);
      if (module === 'storage') storageForm.setFieldsValue(value as StorageConfig);
      if (module === 'drive') driveForm.setFieldsValue(value as DriveConfig);
      if (module === 'file-scanning') fileScanningForm.setFieldsValue(value as FileScanningConfig);
    },
    [aiForm, driveForm, fileScanningForm, larkForm, mailForm, storageForm, tencentForm, wechatForm]
  );

  const loadSummaries = useCallback(async () => {
    try {
      setSummaries(await integrationsApi.list());
    } catch {
      message.error('加载服务配置状态失败');
    }
  }, []);

  const loadConfig = useCallback(async (module: IntegrationModule) => {
    setLoading(true);
    try {
      const detail = await integrationsApi.get(module);
      setDetails((current) => ({ ...current, [module]: detail }));
    } catch {
      message.error(`加载${MODULE_META[module].label}配置失败`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canWrite || editingModule === null) return;
    const detail = details[editingModule];
    if (detail) setFormValue(editingModule, detail.value);
  }, [canWrite, details, editingModule, setFormValue]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    void loadConfig(activeModule);
  }, [activeModule, loadConfig]);

  const getValues = async (module: IntegrationModule) => {
    switch (module) {
      case 'mail':
        return buildMailConfigPayload(await mailForm.validateFields());
      case 'ai':
        return buildAiConfigPayload(await aiForm.validateFields());
      case 'tencent-meeting':
        return buildTencentMeetingConfigPayload(await tencentForm.validateFields());
      case 'lark':
        return buildLarkConfigPayload(await larkForm.validateFields());
      case 'wechat-shop':
        return buildWechatShopConfigPayload(await wechatForm.validateFields());
      case 'storage':
        return buildStorageConfigPayload(await storageForm.validateFields());
      case 'drive':
        return driveForm.validateFields();
      case 'file-scanning':
        return fileScanningForm.validateFields();
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const values = await getValues(activeModule);
      const result = await integrationsApi.update(activeModule, values);
      if (result.restartRequired) message.warning(result.message);
      else message.success(result.message);
      await Promise.all([loadConfig(activeModule), loadSummaries()]);
      setEditingModule(null);
    } catch (error) {
      if (error instanceof Error) message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const testConfig = async () => {
    setTesting(true);
    try {
      const values = await getValues(activeModule);
      const result = await integrationsApi.test(activeModule, values);
      setTestResults((current) => ({ ...current, [activeModule]: result }));
    } catch (error) {
      if (error instanceof Error) message.error('测试配置失败');
    } finally {
      setTesting(false);
    }
  };

  const deleteConfig = async () => {
    setDeleting(true);
    try {
      const result = await integrationsApi.remove(activeModule);
      if (result.restartRequired) message.warning(result.message);
      else message.success(result.message);
      setTestResults((current) => ({ ...current, [activeModule]: undefined }));
      await Promise.all([loadConfig(activeModule), loadSummaries()]);
      setEditingModule(null);
    } catch {
      message.error('删除配置失败');
    } finally {
      setDeleting(false);
    }
  };

  const menuItems = [
    {
      type: 'group' as const,
      label: '通知服务',
      children: [menuItem('mail', summaryMap.get('mail'))],
    },
    {
      type: 'group' as const,
      label: 'AI 能力',
      children: [menuItem('ai', summaryMap.get('ai'))],
    },
    {
      type: 'group' as const,
      label: '会议集成',
      children: [
        menuItem('tencent-meeting', summaryMap.get('tencent-meeting')),
        menuItem('lark', summaryMap.get('lark')),
      ],
    },
    {
      type: 'group' as const,
      label: '交易集成',
      children: [menuItem('wechat-shop', summaryMap.get('wechat-shop'))],
    },
    {
      type: 'group' as const,
      label: '存储服务',
      children: [
        menuItem('storage', summaryMap.get('storage')),
        menuItem('drive', summaryMap.get('drive')),
      ],
    },
    {
      type: 'group' as const,
      label: '安全服务',
      children: [menuItem('file-scanning', summaryMap.get('file-scanning'))],
    },
  ];

  const isEditing = canWrite && editingModule === activeModule;

  return (
    <div className="integrations-page">
      <aside className="integrations-sidebar">
        <Menu
          mode="inline"
          selectedKeys={[activeModule]}
          items={menuItems}
          onSelect={({ key }) => {
            setEditingModule(null);
            setActiveModule(key as IntegrationModule);
          }}
        />
      </aside>
      <main className="integrations-content">
        <ConfigPanel
          module={activeModule}
          summary={summaryMap.get(activeModule) ?? details[activeModule]}
          loading={loading}
          saving={saving}
          testing={testing}
          deleting={deleting}
          canWrite={canWrite}
          isEditing={isEditing}
          testResult={testResults[activeModule]}
          onRefresh={() => void Promise.all([loadConfig(activeModule), loadSummaries()])}
          onEdit={() => setEditingModule(activeModule)}
          onCancelEdit={() => setEditingModule(null)}
          onSave={() => void saveConfig()}
          onTest={() => void testConfig()}
          onDelete={() => void deleteConfig()}
        >
          {isEditing ? (
            <>
              {activeModule === 'mail' && <MailFields form={mailForm} />}
              {activeModule === 'ai' && <AiFields form={aiForm} />}
              {activeModule === 'tencent-meeting' && <TencentMeetingFields form={tencentForm} />}
              {activeModule === 'lark' && <LarkFields form={larkForm} />}
              {activeModule === 'wechat-shop' && <WechatShopFields form={wechatForm} />}
              {activeModule === 'storage' && <StorageFields form={storageForm} />}
              {activeModule === 'drive' && <DriveFields form={driveForm} />}
              {activeModule === 'file-scanning' && <FileScanningFields form={fileScanningForm} />}
            </>
          ) : (
            <ReadonlyConfigView module={activeModule} value={details[activeModule]?.value} />
          )}
        </ConfigPanel>
      </main>
    </div>
  );
}

function menuItem(module: IntegrationModule, summary?: IntegrationSummary) {
  return {
    key: module,
    icon: MODULE_META[module].icon,
    label: (
      <span className="integrations-menu-label">
        <span>{MODULE_META[module].label}</span>
        <span className={summary?.configured ? 'is-configured' : ''} />
      </span>
    ),
  };
}

function MailFields({ form }: { form: ReturnType<typeof Form.useForm<MailConfig>>[0] }) {
  return (
    <Form className="integrations-form" form={form} layout="vertical">
      <Divider titlePlacement="start">SMTP 设置</Divider>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="SMTP 主机" name="host" rules={[{ required: true }]}>
            <Input placeholder="smtp.example.com" />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item label="端口" name="port" rules={[{ required: true }]}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="用户名" name="user" rules={[{ required: true }]}>
            <Input autoComplete="username" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="发件人地址" name="from" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="noreply@example.com" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="密码" name="pass" rules={[{ required: true }]}>
        <SecretInput placeholder="输入新密码以替换" />
      </Form.Item>
      <div className="integrations-switch-row">
        <div>
          <div className="integrations-switch-title">SSL/TLS 加密</div>
          <div className="integrations-switch-description">根据邮件服务商端口要求启用</div>
        </div>
        <Form.Item name="secure" valuePropName="checked" noStyle>
          <Switch checkedChildren="启用" unCheckedChildren="关闭" />
        </Form.Item>
      </div>
      <Divider titlePlacement="start">邮件品牌</Divider>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="品牌名称" name="brandName">
            <Input placeholder="Nove System" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            label="主题色"
            name="brandPrimaryColor"
            rules={[{ pattern: /^#[0-9a-fA-F]{6}$/ }]}
          >
            <Input placeholder="#2563eb" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="Logo URL" name="brandLogoUrl" rules={[{ type: 'url' }]}>
        <Input placeholder="https://example.com/logo.png" />
      </Form.Item>
      <Form.Item label="公开访问地址" name="brandPublicBaseUrl" rules={[{ type: 'url' }]}>
        <Input placeholder="https://app.example.com" />
      </Form.Item>
      <Form.Item label="页脚文字" name="brandFooterText">
        <Input.TextArea rows={3} />
      </Form.Item>
    </Form>
  );
}

function AiFields({ form }: { form: ReturnType<typeof Form.useForm<AiConfig>>[0] }) {
  return (
    <Form className="integrations-form" form={form} layout="vertical">
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="服务商" name="provider" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ark', label: '火山方舟' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'custom', label: '自定义兼容服务' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item label="模型" name="model" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="API Base URL" name="baseUrl" rules={[{ required: true, type: 'url' }]}>
        <Input />
      </Form.Item>
      <Form.Item label="API Key" name="apiKey" rules={[{ required: true }]}>
        <SecretInput placeholder="输入新 API Key 以替换" />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="最大 Tokens" name="maxTokens" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Temperature" name="temperature" rules={[{ required: true }]}>
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

function TencentMeetingFields({
  form,
}: {
  form: ReturnType<typeof Form.useForm<TencentMeetingConfig>>[0];
}) {
  return (
    <Form className="integrations-form" form={form} layout="vertical">
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="App ID" name="appId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="SDK ID" name="sdkId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Secret ID" name="secretId" rules={[{ required: true }]}>
            <SecretInput placeholder="输入新 Secret ID 以替换" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="默认用户 ID" name="userId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="Secret Key" name="secretKey" rules={[{ required: true }]}>
        <SecretInput placeholder="输入新 Secret Key 以替换" />
      </Form.Item>
      <Divider titlePlacement="start">Webhook</Divider>
      <Form.Item label="Webhook Token" name="webhookToken">
        <SecretInput placeholder="输入新 Token 以替换" />
      </Form.Item>
      <Form.Item label="Encoding AES Key" name="encodingAesKey">
        <SecretInput placeholder="输入新 AES Key 以替换" />
      </Form.Item>
    </Form>
  );
}

function LarkFields({ form }: { form: ReturnType<typeof Form.useForm<LarkConfig>>[0] }) {
  return (
    <Form className="integrations-form" form={form} layout="vertical">
      <Divider titlePlacement="start">应用配置</Divider>
      <Form.Item label="App ID" name="appId" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item label="App Secret" name="appSecret" rules={[{ required: true }]}>
        <SecretInput placeholder="输入新 App Secret 以替换" />
      </Form.Item>
      <Divider titlePlacement="start">事件订阅</Divider>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="事件 Encrypt Key" name="eventEncryptKey">
            <SecretInput placeholder="输入新 Encrypt Key 以替换" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="事件 Verification Token" name="eventVerificationToken">
            <SecretInput placeholder="输入新 Verification Token 以替换" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

function WechatShopFields({
  form,
}: {
  form: ReturnType<typeof Form.useForm<WechatShopConfig>>[0];
}) {
  return (
    <Form className="integrations-form" form={form} layout="vertical">
      <Form.Item label="App ID" name="appId" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item label="App Secret" name="appSecret" rules={[{ required: true }]}>
        <SecretInput placeholder="输入新 App Secret 以替换" />
      </Form.Item>
      <Form.Item label="Webhook Token" name="webhookToken">
        <SecretInput placeholder="输入新 Webhook Token 以替换" />
      </Form.Item>
      <Form.Item label="Encoding AES Key" name="encodingAesKey">
        <SecretInput placeholder="输入新 Encoding AES Key 以替换" />
      </Form.Item>
      <Form.Item label="API Base URL" name="apiBaseUrl" rules={[{ required: true, type: 'url' }]}>
        <Input />
      </Form.Item>
    </Form>
  );
}

function DriveFields({ form }: { form: ReturnType<typeof Form.useForm<DriveConfig>>[0] }) {
  return (
    <Form
      className="integrations-form"
      form={form}
      layout="vertical"
      initialValues={{
        downloadUrlExpiresSeconds: 600,
        recycleRetentionDays: 30,
        imageMaxMiB: 20,
        documentMaxMiB: 100,
        audioMaxMiB: 2048,
        videoMaxMiB: 20480,
      }}
    >
      <Alert
        type="warning"
        showIcon
        title="危险类型（宏文件、压缩包、脚本、可执行文件）由服务端永久禁止；此处只能在安全白名单内进一步收窄。"
      />
      <Divider titlePlacement="start">文件策略</Divider>
      <Form.Item
        label="允许扩展名"
        name="allowedExtensions"
        tooltip="留空表示启用服务端全部安全白名单"
      >
        <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="例如 .pdf .docx .mp4" />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item label="图片上限 MiB" name="imageMaxMiB">
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="文档上限 MiB" name="documentMaxMiB">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="音频上限 MiB" name="audioMaxMiB">
            <InputNumber min={1} max={2048} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="视频上限 MiB" name="videoMaxMiB">
            <InputNumber min={1} max={20480} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Divider titlePlacement="start">下载与回收站</Divider>
      <Row gutter={16}>
        <Col xs={12}>
          <Form.Item label="下载 URL 有效期（秒）" name="downloadUrlExpiresSeconds">
            <InputNumber min={60} max={3600} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12}>
          <Form.Item label="回收站保留天数" name="recycleRetentionDays">
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

function FileScanningFields({
  form,
}: {
  form: ReturnType<typeof Form.useForm<FileScanningConfig>>[0];
}) {
  const scanProvider = Form.useWatch('malwareScanProvider', form);

  return (
    <Form
      className="integrations-form"
      form={form}
      layout="vertical"
      initialValues={{
        aliyunSasRegionId: 'cn-beijing',
        scanTimeoutMs: 300000,
        scanPollIntervalMs: 3000,
        clamAvPort: 3310,
        clamAvTimeoutMs: 600000,
      }}
    >
      <Form.Item label="扫描服务" name="malwareScanProvider" extra="未指定时跟随服务端配置。">
        <Select
          placeholder="跟随服务端配置"
          options={[
            { label: '阿里云安全中心', value: 'ALIYUN_SAS' },
            { label: 'ClamAV', value: 'CLAMAV' },
          ]}
        />
      </Form.Item>
      <Row gutter={16} style={{ display: scanProvider === 'ALIYUN_SAS' ? undefined : 'none' }}>
        <Col xs={24}>
          <Alert type="info" showIcon title="阿里云扫描单文件上限为 100 MiB。" />
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="阿里云地域" name="aliyunSasRegionId">
            <Input placeholder="cn-beijing" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="扫描超时（毫秒）" name="scanTimeoutMs">
            <InputNumber min={30000} max={1800000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="轮询间隔（毫秒）" name="scanPollIntervalMs">
            <InputNumber min={1000} max={30000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16} style={{ display: scanProvider === 'CLAMAV' ? undefined : 'none' }}>
        <Col xs={24} md={12}>
          <Form.Item label="ClamAV 主机" name="clamAvHost">
            <Input placeholder="clamav.internal" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="ClamAV 端口" name="clamAvPort">
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="扫描超时（毫秒）" name="clamAvTimeoutMs">
            <InputNumber min={1000} max={3600000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

function StorageFields({ form }: { form: ReturnType<typeof Form.useForm<StorageConfig>>[0] }) {
  return (
    <Form
      className="integrations-form"
      form={form}
      layout="vertical"
      initialValues={{
        provider: 'OSS',
        region: 'oss-cn-hangzhou',
        signedUrlExpiresSeconds: 600,
      }}
    >
      <Alert
        type="info"
        showIcon
        title="配置对象存储服务。未配置或删除数据库配置时，服务将处于未配置状态。"
      />
      <Divider titlePlacement="start">存储服务商与地域</Divider>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="存储服务商"
            name="provider"
            rules={[{ required: true, message: '请选择存储服务商' }]}
          >
            <Select
              options={[
                { label: '阿里云 OSS', value: 'OSS' },
                { label: '腾讯云 COS', value: 'COS' },
                { label: 'AWS S3', value: 'S3' },
                { label: '本地存储 (Local)', value: 'LOCAL' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            label="地域 (Region)"
            name="region"
            rules={[{ required: true, message: '请输入地域代码' }]}
            tooltip="例如阿里云杭州 oss-cn-hangzhou，北京 oss-cn-beijing"
          >
            <Input placeholder="oss-cn-hangzhou" />
          </Form.Item>
        </Col>
      </Row>

      <Divider titlePlacement="start">存储桶与访问凭据</Divider>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="私有存储桶 (云盘与附件)"
            name="bucket"
            rules={[{ required: true, message: '请输入存储桶名称' }]}
            tooltip="用于云盘文件、会议录音及敏感附件，默认私有读写"
          >
            <Input placeholder="my-private-bucket" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            label="公共存储桶 (头像与公开媒体)"
            name="publicBucket"
            tooltip="可选。用于用户头像等公开媒体资源。若留空，将自动复用私有存储桶"
          >
            <Input placeholder="留空则复用私有存储桶" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="AccessKey ID"
            name="accessKeyId"
            rules={[{ required: true, message: '请输入 AccessKey ID' }]}
          >
            <Input placeholder="LTAI..." />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            label="AccessKey Secret"
            name="accessKeySecret"
            tooltip="留空表示保持已保存的密钥不变"
          >
            <SecretInput placeholder="留空表示保持当前密钥不变" />
          </Form.Item>
        </Col>
      </Row>

      <Divider titlePlacement="start">访问地址与时效</Divider>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Form.Item
            label="公开访问地址 (Base URL)"
            name="publicBaseUrl"
            tooltip="可选。CDN 加速域名或 Bucket 公网访问基地址，如 https://cdn.example.com，末尾请勿包含斜杠"
          >
            <Input placeholder="https://my-bucket.oss-cn-hangzhou.aliyuncs.com" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="签名有效时长（秒）"
            name="signedUrlExpiresSeconds"
            tooltip="用于头像、云盘等临时签名下载 URL，允许 60～3600 秒"
          >
            <InputNumber min={60} max={3600} style={{ width: '100%' }} placeholder="600" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}
