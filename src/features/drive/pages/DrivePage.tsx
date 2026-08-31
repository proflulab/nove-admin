import {
  CloudDownloadOutlined,
  DeleteOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  ReloadOutlined,
  RestOutlined,
} from '@ant-design/icons';
import Breadcrumb from 'antd/es/breadcrumb';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import List from 'antd/es/list';
import Divider from 'antd/es/divider';
import Progress from 'antd/es/progress';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import Tag from 'antd/es/tag';
import Upload from 'antd/es/upload';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Perm } from '../../../app/guards/Perm';
import { PERMISSIONS } from '../../../shared/utils/permissions';
import { driveApi } from '../api/driveApi';
import type { DriveNode, DriveSpace } from '../model/types';
import './DrivePage.css';

const PART_SIZE = 16 * 1024 * 1024;
const MEDIA_EXTENSIONS = new Set(['mp3', 'm4a', 'wav', 'aac', 'ogg', 'mp4', 'mov', 'webm']);

function requiresCloudScan(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return !MEDIA_EXTENSIONS.has(extension);
}

async function calculateSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    ''
  );
}

function uploadErrorMessage(error: unknown, fileName: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
  }
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return '无法连接 OSS，请检查 Bucket CORS 是否允许当前 Admin 来源并暴露 ETag';
  }
  return error instanceof Error ? error.message : `${fileName} 上传失败`;
}

function formatBytes(value: string | null) {
  if (!value) return '-';
  let size = Number(value);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

export function DrivePage() {
  const [spaces, setSpaces] = useState<DriveSpace[]>([]);
  const [spaceId, setSpaceId] = useState<string>();
  const [nodes, setNodes] = useState<DriveNode[]>([]);
  const [path, setPath] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [trash, setTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [detailNode, setDetailNode] = useState<DriveNode | null>(null);
  const [details, setDetails] = useState<{
    version?: {
      version: number;
      contentType: string;
      sizeBytes: string;
      checksumSha256: string | null;
      status: string;
    };
    bindings: Array<{
      id: string;
      targetType: string;
      targetId: string;
      purpose: string;
      active: boolean;
    }>;
    audit: Array<{
      id: string;
      action: string;
      createdAt: string;
      actor: { username: string | null; email: string | null } | null;
    }>;
  }>({ bindings: [], audit: [] });
  const [grantNode, setGrantNode] = useState<DriveNode | null>(null);
  const [grants, setGrants] = useState<
    Array<{
      id: string;
      principalType: string;
      principalId: string;
      effect: string;
      actions: string[];
    }>
  >([]);
  const [grantPrincipalType, setGrantPrincipalType] = useState('USER');
  const [grantPrincipalId, setGrantPrincipalId] = useState('');
  const [grantEffect, setGrantEffect] = useState('ALLOW');
  const [grantActions, setGrantActions] = useState<string[]>(['VIEW', 'DOWNLOAD']);

  const parentId = path.at(-1)?.id ?? null;

  const loadNodes = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const result = trash
        ? await driveApi.listTrash(spaceId)
        : await driveApi.listNodes(spaceId, parentId);
      setNodes(result.items);
    } catch {
      message.error('读取云盘目录失败');
    } finally {
      setLoading(false);
    }
  }, [parentId, spaceId, trash]);

  useEffect(() => {
    driveApi
      .listSpaces()
      .then((items) => {
        setSpaces(items);
        setSpaceId((current) => current ?? items[0]?.id);
      })
      .catch(() => message.error('读取云盘空间失败'));
  }, []);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  const visibleNodes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? nodes.filter((node) => node.name.toLocaleLowerCase().includes(query)) : nodes;
  }, [nodes, search]);

  const createFolder = () => {
    let name = '';
    Modal.confirm({
      title: '新建文件夹',
      content: (
        <Input
          autoFocus
          placeholder="文件夹名称"
          onChange={(event) => (name = event.target.value)}
        />
      ),
      onOk: async () => {
        if (!spaceId || !name.trim()) throw new Error('请输入文件夹名称');
        await driveApi.createFolder(spaceId, parentId, name.trim());
        message.success('文件夹已创建');
        await loadNodes();
      },
    });
  };

  const rename = (node: DriveNode) => {
    let name = node.name;
    Modal.confirm({
      title: '重命名',
      content: <Input defaultValue={node.name} onChange={(event) => (name = event.target.value)} />,
      onOk: async () => {
        await driveApi.rename(node.id, name.trim());
        message.success('重命名成功');
        await loadNodes();
      },
    });
  };

  const uploadFile = async (file: File) => {
    if (!spaceId) return;
    let sessionId: string | undefined;
    setUploading((current) => ({ ...current, [file.name]: 0 }));
    try {
      const checksumSha256 = requiresCloudScan(file.name) ? await calculateSha256(file) : undefined;
      setUploading((current) => ({ ...current, [file.name]: 5 }));
      const session = await driveApi.createUploadSession(spaceId, parentId, file, checksumSha256);
      sessionId = session.id;
      const partSize = session.recommendedPartSizeBytes || PART_SIZE;
      const count = Math.ceil(file.size / partSize);
      const numbers = Array.from({ length: count }, (_, index) => index + 1);
      const signed = await driveApi.signParts(session.id, numbers);
      const completed: Array<{ number: number; etag: string }> = [];
      for (const part of signed.parts) {
        const start = (part.partNumber - 1) * partSize;
        const response = await fetch(part.url, {
          method: 'PUT',
          body: file.slice(start, Math.min(file.size, start + partSize)),
        });
        if (!response.ok) throw new Error(`分片 ${part.partNumber} 上传失败`);
        const etag = response.headers.get('etag');
        if (!etag) throw new Error('OSS CORS 必须暴露 ETag 响应头');
        completed.push({ number: part.partNumber, etag });
        setUploading((current) => ({
          ...current,
          [file.name]: 5 + Math.round((completed.length / count) * 85),
        }));
      }
      setUploading((current) => ({ ...current, [file.name]: 95 }));
      await driveApi.completeUpload(session.id, completed);
      setUploading((current) => ({ ...current, [file.name]: 100 }));
      message.success(
        session.requiresMalwareScan
          ? `${file.name} 已上传，正在后台进行病毒扫描`
          : `${file.name} 上传并校验成功`
      );
      await loadNodes();
    } catch (error) {
      if (sessionId) await driveApi.abortUpload(sessionId).catch(() => undefined);
      message.error(uploadErrorMessage(error, file.name));
    } finally {
      window.setTimeout(
        () =>
          setUploading((current) => {
            const next = { ...current };
            delete next[file.name];
            return next;
          }),
        800
      );
    }
  };

  const download = async (node: DriveNode) => {
    if (!node.fileId) return;
    const result = await driveApi.createDownloadUrl(node.fileId);
    window.location.assign(result.url);
  };

  const openDetails = async (node: DriveNode) => {
    setDetailNode(node);
    const [audit, file, bindings] = await Promise.all([
      driveApi.listAudit(node.id),
      node.fileId ? driveApi.getFile(node.fileId) : Promise.resolve(null),
      node.fileId ? driveApi.listBindings(node.fileId) : Promise.resolve([]),
    ]);
    setDetails({ version: file?.version, bindings, audit });
  };

  const openGrants = async (node: DriveNode) => {
    setGrantNode(node);
    setGrants(await driveApi.listGrants(node.id));
  };

  const moveNode = (node: DriveNode) => {
    let destination: string | null = null;
    Modal.confirm({
      title: '移动项目',
      content: (
        <Select
          defaultValue="__ROOT__"
          style={{ width: '100%' }}
          options={[
            { label: '空间根目录', value: '__ROOT__' },
            ...nodes
              .filter((item) => item.type === 'FOLDER' && item.id !== node.id)
              .map((item) => ({ label: item.name, value: item.id })),
          ]}
          onChange={(value) => {
            destination = value === '__ROOT__' ? null : value;
          }}
        />
      ),
      onOk: async () => {
        await driveApi.move(node.id, destination);
        message.success('移动成功');
        await loadNodes();
      },
    });
  };

  return (
    <div className="drive-page">
      <Card
        title="云盘"
        extra={
          <Space wrap>
            <Select
              value={spaceId}
              style={{ width: 220 }}
              options={spaces.map((item) => ({ label: item.name, value: item.id }))}
              onChange={(value) => {
                setSpaceId(value);
                setPath([]);
                setTrash(false);
              }}
            />
            <Input.Search
              allowClear
              placeholder="筛选当前目录"
              onSearch={setSearch}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadNodes()} />
          </Space>
        }
      >
        <div className="drive-toolbar">
          <Breadcrumb
            items={[
              { title: <a onClick={() => setPath([])}>根目录</a> },
              ...path.map((node, index) => ({
                title: <a onClick={() => setPath(path.slice(0, index + 1))}>{node.name}</a>,
              })),
            ]}
          />
          <Space>
            <Button
              icon={trash ? <FolderOpenOutlined /> : <RestOutlined />}
              onClick={() => setTrash((value) => !value)}
            >
              {trash ? '返回文件' : '回收站'}
            </Button>
            {!trash ? (
              <Perm permission={PERMISSIONS.DRIVE.UPLOAD}>
                <Button icon={<FolderAddOutlined />} onClick={createFolder}>
                  新建文件夹
                </Button>
                <Upload
                  multiple
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void uploadFile(file);
                    return Upload.LIST_IGNORE;
                  }}
                >
                  <Button type="primary" icon={<InboxOutlined />}>
                    上传文件
                  </Button>
                </Upload>
              </Perm>
            ) : null}
          </Space>
        </div>

        {Object.entries(uploading).map(([name, percent]) => (
          <div className="drive-upload-progress" key={name}>
            <span>{name}</span>
            <Progress percent={percent} size="small" />
          </div>
        ))}

        <Table<DriveNode>
          rowKey="id"
          loading={loading}
          dataSource={visibleNodes}
          pagination={false}
          locale={{ emptyText: trash ? '回收站为空' : '当前目录为空' }}
          columns={[
            {
              title: '名称',
              dataIndex: 'name',
              render: (name, node) => (
                <Button
                  type="link"
                  icon={node.type === 'FOLDER' ? <FolderOpenOutlined /> : <FileOutlined />}
                  onClick={() => node.type === 'FOLDER' && !trash && setPath([...path, node])}
                >
                  {name}
                </Button>
              ),
            },
            {
              title: '类型',
              dataIndex: 'contentType',
              width: 200,
              render: (value, node) => (node.type === 'FOLDER' ? '文件夹' : value || '-'),
            },
            { title: '大小', dataIndex: 'sizeBytes', width: 120, render: formatBytes },
            {
              title: '状态',
              dataIndex: 'fileStatus',
              width: 110,
              render: (value) =>
                value ? <Tag color={value === 'ACTIVE' ? 'green' : 'gold'}>{value}</Tag> : '-',
            },
            {
              title: '操作',
              width: 260,
              render: (_, node) =>
                trash ? (
                  <Space>
                    <Perm permission={PERMISSIONS.DRIVE.DELETE}>
                      <Button
                        onClick={async () => {
                          await driveApi.restore(node.id);
                          await loadNodes();
                        }}
                      >
                        恢复
                      </Button>
                    </Perm>
                    <Perm permission={PERMISSIONS.DRIVE.ADMIN}>
                      <Button
                        danger
                        onClick={async () => {
                          await driveApi.purgeTrash(node.id);
                          await loadNodes();
                        }}
                      >
                        永久清理
                      </Button>
                    </Perm>
                  </Space>
                ) : (
                  <Space>
                    {node.fileId ? (
                      <Button icon={<CloudDownloadOutlined />} onClick={() => void download(node)}>
                        下载
                      </Button>
                    ) : null}
                    <Perm permission={PERMISSIONS.DRIVE.UPDATE}>
                      <Button onClick={() => rename(node)}>重命名</Button>
                      <Button onClick={() => moveNode(node)}>移动</Button>
                    </Perm>
                    <Button onClick={() => void openDetails(node)}>详情</Button>
                    <Perm permission={PERMISSIONS.DRIVE.MANAGE_ACL}>
                      <Button onClick={() => void openGrants(node)}>权限</Button>
                    </Perm>
                    <Perm permission={PERMISSIONS.DRIVE.DELETE}>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={async () => {
                          await driveApi.trash(node.id);
                          await loadNodes();
                        }}
                      >
                        删除
                      </Button>
                    </Perm>
                  </Space>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        title={detailNode?.name}
        open={Boolean(detailNode)}
        footer={null}
        onCancel={() => setDetailNode(null)}
      >
        {details.version ? (
          <div>
            <p>
              版本：v{details.version.version} · {details.version.status}
            </p>
            <p>
              格式：{details.version.contentType} · {formatBytes(details.version.sizeBytes)}
            </p>
            <p>
              SHA-256：<code>{details.version.checksumSha256 ?? '未记录'}</code>
            </p>
          </div>
        ) : (
          <p>文件夹</p>
        )}
        <Divider titlePlacement="start">业务关联</Divider>
        <List
          size="small"
          dataSource={details.bindings}
          locale={{ emptyText: '无业务关联' }}
          renderItem={(item) => (
            <List.Item>
              {item.targetType} / {item.targetId} {item.purpose ? `· ${item.purpose}` : ''}
            </List.Item>
          )}
        />
        <Divider titlePlacement="start">审计记录</Divider>
        <List
          size="small"
          dataSource={details.audit}
          locale={{ emptyText: '暂无记录' }}
          renderItem={(item) => (
            <List.Item>
              {item.action} · {new Date(item.createdAt).toLocaleString()} ·{' '}
              {item.actor?.username || item.actor?.email || '系统'}
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title={`${grantNode?.name ?? ''} 权限`}
        open={Boolean(grantNode)}
        onCancel={() => setGrantNode(null)}
        onOk={async () => {
          if (!grantNode || !grantPrincipalId.trim()) return;
          await driveApi.putGrant(grantNode.id, {
            principalType: grantPrincipalType,
            principalId: grantPrincipalId.trim(),
            effect: grantEffect,
            actions: grantActions,
          });
          setGrants(await driveApi.listGrants(grantNode.id));
          setGrantPrincipalId('');
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            value={grantPrincipalType}
            onChange={setGrantPrincipalType}
            options={['USER', 'ORG_MEMBER', 'DEPARTMENT', 'ROLE', 'ORG'].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Input
            placeholder="授权主体 ID"
            value={grantPrincipalId}
            onChange={(event) => setGrantPrincipalId(event.target.value)}
          />
          <Select
            value={grantEffect}
            onChange={setGrantEffect}
            options={['ALLOW', 'DENY'].map((value) => ({ value, label: value }))}
          />
          <Select
            mode="multiple"
            value={grantActions}
            onChange={setGrantActions}
            options={[
              'VIEW',
              'DOWNLOAD',
              'UPLOAD',
              'RENAME',
              'MOVE',
              'SHARE',
              'DELETE',
              'MANAGE_ACL',
            ].map((value) => ({ value, label: value }))}
          />
        </Space>
        <Divider />
        <List
          size="small"
          dataSource={grants}
          locale={{ emptyText: '暂无显式授权' }}
          renderItem={(grant) => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  danger
                  type="link"
                  onClick={async () => {
                    if (!grantNode) return;
                    await driveApi.deleteGrant(grantNode.id, grant.id);
                    setGrants(await driveApi.listGrants(grantNode.id));
                  }}
                >
                  删除
                </Button>,
              ]}
            >
              {grant.effect} · {grant.principalType}:{grant.principalId} ·{' '}
              {grant.actions.join(', ')}
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
