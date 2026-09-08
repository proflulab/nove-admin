import Tag from 'antd/es/tag';
import type { ReactNode } from 'react';
import type { IntegrationConfigMap, IntegrationModule } from '../types';

type ReadonlyFieldKind = 'boolean' | 'color' | 'provider' | 'secret' | 'text';

interface ReadonlyField {
  key: string;
  label: string;
  kind?: ReadonlyFieldKind;
  fullWidth?: boolean;
}

interface ReadonlySection {
  title: string;
  fields: ReadonlyField[];
}

const PROVIDER_LABELS: Record<string, string> = {
  ark: '火山方舟',
  openai: 'OpenAI',
  custom: '自定义兼容服务',
};

const READONLY_SECTIONS: Record<IntegrationModule, ReadonlySection[]> = {
  mail: [
    {
      title: 'SMTP 设置',
      fields: [
        { key: 'host', label: 'SMTP 主机' },
        { key: 'port', label: '端口' },
        { key: 'user', label: '用户名' },
        { key: 'from', label: '发件人地址' },
        { key: 'pass', label: '密码', kind: 'secret', fullWidth: true },
        { key: 'secure', label: 'SSL/TLS 加密', kind: 'boolean', fullWidth: true },
      ],
    },
    {
      title: '邮件品牌',
      fields: [
        { key: 'brandName', label: '品牌名称' },
        { key: 'brandPrimaryColor', label: '主题色', kind: 'color' },
        { key: 'brandLogoUrl', label: 'Logo URL', fullWidth: true },
        { key: 'brandPublicBaseUrl', label: '公开访问地址', fullWidth: true },
        { key: 'brandFooterText', label: '页脚文字', fullWidth: true },
      ],
    },
  ],
  ai: [
    {
      title: '模型服务',
      fields: [
        { key: 'provider', label: '服务商', kind: 'provider' },
        { key: 'model', label: '模型' },
        { key: 'baseUrl', label: 'API Base URL', fullWidth: true },
        { key: 'apiKey', label: 'API Key', kind: 'secret', fullWidth: true },
      ],
    },
    {
      title: '生成参数',
      fields: [
        { key: 'maxTokens', label: '最大 Tokens' },
        { key: 'temperature', label: 'Temperature' },
      ],
    },
  ],
  'tencent-meeting': [
    {
      title: 'API 凭证',
      fields: [
        { key: 'appId', label: 'App ID' },
        { key: 'sdkId', label: 'SDK ID' },
        { key: 'secretId', label: 'Secret ID', kind: 'secret' },
        { key: 'userId', label: '默认用户 ID' },
        { key: 'secretKey', label: 'Secret Key', kind: 'secret', fullWidth: true },
      ],
    },
    {
      title: 'Webhook',
      fields: [
        { key: 'webhookToken', label: 'Webhook Token', kind: 'secret', fullWidth: true },
        {
          key: 'encodingAesKey',
          label: 'Encoding AES Key',
          kind: 'secret',
          fullWidth: true,
        },
      ],
    },
  ],
  lark: [
    {
      title: '应用与事件',
      fields: [
        { key: 'appId', label: 'App ID', fullWidth: true },
        { key: 'appSecret', label: 'App Secret', kind: 'secret', fullWidth: true },
        { key: 'eventEncryptKey', label: '事件 Encrypt Key', kind: 'secret' },
        {
          key: 'eventVerificationToken',
          label: '事件 Verification Token',
          kind: 'secret',
        },
      ],
    },
  ],
  'wechat-shop': [
    {
      title: '应用凭证',
      fields: [
        { key: 'appId', label: 'App ID', fullWidth: true },
        { key: 'appSecret', label: 'App Secret', kind: 'secret', fullWidth: true },
      ],
    },
    {
      title: 'Webhook',
      fields: [
        { key: 'webhookToken', label: 'Webhook Token', kind: 'secret', fullWidth: true },
        {
          key: 'encodingAesKey',
          label: 'Encoding AES Key',
          kind: 'secret',
          fullWidth: true,
        },
      ],
    },
    {
      title: 'API 地址',
      fields: [{ key: 'apiBaseUrl', label: 'API Base URL', fullWidth: true }],
    },
  ],
};

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function renderValue(field: ReadonlyField, value: unknown): ReactNode {
  if (!hasValue(value)) return <span className="integrations-readonly-empty">未配置</span>;

  if (field.kind === 'secret') return <Tag color="success">已配置（不可查看）</Tag>;
  if (field.kind === 'boolean') {
    return (
      <Tag color={value === true ? 'success' : 'default'}>
        {value === true ? '已启用' : '已关闭'}
      </Tag>
    );
  }
  if (field.kind === 'provider') return PROVIDER_LABELS[String(value)] ?? String(value);
  if (field.kind === 'color') {
    const color = String(value);
    return (
      <span className="integrations-readonly-color">
        <span className="integrations-readonly-swatch" style={{ backgroundColor: color }} />
        <span>{color}</span>
      </span>
    );
  }

  return String(value);
}

export function ReadonlyConfigView({
  module,
  value,
}: {
  module: IntegrationModule;
  value?: IntegrationConfigMap[IntegrationModule];
}) {
  const config = (value ?? {}) as Record<string, unknown>;

  return (
    <div className="integrations-readonly" aria-label="只读配置详情">
      {READONLY_SECTIONS[module].map((section) => (
        <section className="integrations-readonly-section" key={section.title}>
          <h3>{section.title}</h3>
          <dl className="integrations-readonly-grid">
            {section.fields.map((field) => (
              <div
                className={
                  field.fullWidth
                    ? 'integrations-readonly-item is-full-width'
                    : 'integrations-readonly-item'
                }
                key={field.key}
              >
                <dt>{field.label}</dt>
                <dd>{renderValue(field, config[field.key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
