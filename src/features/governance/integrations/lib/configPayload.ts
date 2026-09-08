import type {
  AiConfig,
  LarkConfig,
  MailConfig,
  TencentMeetingConfig,
  WechatShopConfig,
} from '../types';

/**
 * Do not submit an empty secret field: the API merges updates, so omission
 * preserves the encrypted value already stored on the server.
 */
export function omitEmptySecrets<T extends object>(
  values: T,
  secretFields: readonly (keyof T)[]
): T {
  const payload = { ...values } as Record<keyof T, unknown>;

  for (const field of secretFields) {
    if (typeof payload[field] === 'string' && !payload[field].trim()) {
      delete payload[field];
    }
  }

  return payload as T;
}

export function buildMailConfigPayload(values: MailConfig): MailConfig {
  return omitEmptySecrets(values, ['pass']);
}

export function buildWechatShopConfigPayload(values: WechatShopConfig): WechatShopConfig {
  return omitEmptySecrets(values, ['appSecret', 'webhookToken', 'encodingAesKey']);
}

export function buildAiConfigPayload(values: AiConfig): AiConfig {
  return omitEmptySecrets(values, ['apiKey']);
}

export function buildTencentMeetingConfigPayload(
  values: TencentMeetingConfig
): TencentMeetingConfig {
  return omitEmptySecrets(values, ['secretId', 'secretKey', 'webhookToken', 'encodingAesKey']);
}

export function buildLarkConfigPayload(values: LarkConfig): LarkConfig {
  return omitEmptySecrets(values, ['appSecret', 'eventEncryptKey', 'eventVerificationToken']);
}
