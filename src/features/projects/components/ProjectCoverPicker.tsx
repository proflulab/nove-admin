import {
  CloudOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import Alert from 'antd/es/alert';
import Avatar from 'antd/es/avatar';
import Breadcrumb from 'antd/es/breadcrumb';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Spin from 'antd/es/spin';
import Tag from 'antd/es/tag';
import Upload from 'antd/es/upload';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { driveApi } from '../../drive/api/driveApi';
import { toDriveFileReference } from '../../drive/lib/driveFileReference';
import type { DriveNode, DriveSpace } from '../../drive/model/types';
import { useProjectCoverUrl } from '../hooks/useProjectCoverUrl';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;

function isImage(node: DriveNode): boolean {
  return (
    node.type === 'FILE' && Boolean(node.fileId) && Boolean(node.contentType?.startsWith('image/'))
  );
}

async function calculateSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    ''
  );
}

async function uploadImage(
  spaceId: string,
  parentId: string | null,
  file: File
): Promise<DriveNode> {
  const checksum = await calculateSha256(file);
  const session = await driveApi.createUploadSession(spaceId, parentId, file, checksum);
  try {
    const partSize = session.recommendedPartSizeBytes || PART_SIZE;
    const partNumbers = Array.from(
      { length: Math.ceil(file.size / partSize) },
      (_, index) => index + 1
    );
    const signed = await driveApi.signParts(session.id, partNumbers);
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
    }

    return await driveApi.completeUpload(session.id, completed);
  } catch (error) {
    await driveApi.abortUpload(session.id).catch(() => undefined);
    throw error;
  }
}

export function ProjectCoverAvatar({ reference }: { reference?: string | null }) {
  const url = useProjectCoverUrl(reference);
  return (
    <Avatar
      className="project-primary-cell-avatar"
      shape="square"
      size={50}
      src={url}
      icon={!url ? <PictureOutlined /> : undefined}
    />
  );
}

export interface ProjectCoverPickerProps {
  value?: string;
  onChange?: (value?: string) => void;
  orgId: string;
}

export function ProjectCoverPicker({ value, onChange, orgId }: ProjectCoverPickerProps) {
  const [open, setOpen] = useState(false);
  const [spaces, setSpaces] = useState<DriveSpace[]>([]);
  const [spaceId, setSpaceId] = useState<string>();
  const [nodes, setNodes] = useState<DriveNode[]>([]);
  const [path, setPath] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const previewUrl = useProjectCoverUrl(value);
  const parentId = path.at(-1)?.id ?? null;

  const organizationSpaces = useMemo(
    () => spaces.filter((space) => space.type === 'ORG' && space.orgId === orgId),
    [orgId, spaces]
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    driveApi
      .listSpaces()
      .then((items) => {
        setSpaces(items);
        const organizationSpace = items.find(
          (space) => space.type === 'ORG' && space.orgId === orgId
        );
        setSpaceId((current) =>
          current && items.some((space) => space.id === current) ? current : organizationSpace?.id
        );
      })
      .catch(() => message.error('读取组织云盘失败'))
      .finally(() => setLoading(false));
  }, [open, orgId]);

  const loadNodes = useCallback(async () => {
    if (!open || !spaceId) {
      setNodes([]);
      return;
    }
    setLoading(true);
    try {
      const result = await driveApi.listNodes(spaceId, parentId);
      setNodes(result.items.filter((node) => node.type === 'FOLDER' || isImage(node)));
    } catch {
      message.error('读取云盘目录失败');
    } finally {
      setLoading(false);
    }
  }, [open, parentId, spaceId]);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  const selectImage = (node: DriveNode) => {
    if (!node.fileId) return;
    onChange?.(toDriveFileReference(node.fileId));
    setOpen(false);
    message.success('已选择云盘图片');
  };

  const beforeUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('仅支持图片文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      message.error('图片大小不能超过 10 MB');
      return Upload.LIST_IGNORE;
    }
    if (!spaceId) {
      message.error('当前组织没有可用的云盘空间');
      return Upload.LIST_IGNORE;
    }

    setUploading(true);
    try {
      const root = await driveApi.listNodes(spaceId, null);
      let folder = root.items.find((node) => node.type === 'FOLDER' && node.name === '项目封面');
      if (!folder) {
        const legacyFolder = root.items.find(
          (node) => node.type === 'FOLDER' && node.name === '项目封面待关联'
        );
        folder = legacyFolder
          ? await driveApi.rename(legacyFolder.id, '项目封面')
          : await driveApi.createFolder(spaceId, null, '项目封面');
      }
      const node = await uploadImage(spaceId, folder.id, file);
      if (!node.fileId) throw new Error('上传完成后未返回云盘文件标识');
      onChange?.(toDriveFileReference(node.fileId));
      setOpen(false);
      message.success(
        node.fileStatus === 'ACTIVE' ? '封面已上传到云盘' : '封面已上传，安全校验完成后即可预览'
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : '封面上传失败');
    } finally {
      setUploading(false);
    }
    return Upload.LIST_IGNORE;
  };

  return (
    <div className="project-cover-picker">
      <div className="project-cover-preview">
        {previewUrl ? <img src={previewUrl} alt="项目封面预览" /> : <PictureOutlined />}
      </div>
      <Space wrap>
        <Button icon={<CloudOutlined />} onClick={() => setOpen(true)}>
          从云盘选择
        </Button>
        <Button icon={<UploadOutlined />} onClick={() => setOpen(true)}>
          上传到云盘
        </Button>
        {value ? (
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => onChange?.(undefined)}
          >
            移除封面
          </Button>
        ) : null}
      </Space>
      <span className="project-cover-help">
        支持 JPG、PNG、WebP、GIF、SVG，最大 10 MB；保存项目后自动归档并关联
      </span>

      <Modal
        title="选择项目封面"
        open={open}
        width={720}
        footer={null}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        {organizationSpaces.length > 1 ? (
          <Select
            value={spaceId}
            options={organizationSpaces.map((space) => ({ value: space.id, label: space.name }))}
            onChange={(nextSpaceId) => {
              setSpaceId(nextSpaceId);
              setPath([]);
            }}
            style={{ width: 240, marginBottom: 16 }}
            aria-label="选择组织云盘"
          />
        ) : null}
        {!loading && organizationSpaces.length === 0 ? (
          <Alert type="warning" showIcon title="当前组织没有可用的云盘空间" />
        ) : (
          <>
            <div className="project-cover-browser-toolbar">
              <Breadcrumb
                items={[
                  {
                    title: (
                      <button type="button" onClick={() => setPath([])}>
                        组织云盘
                      </button>
                    ),
                  },
                  ...path.map((node, index) => ({
                    title: (
                      <button
                        type="button"
                        onClick={() => setPath((current) => current.slice(0, index + 1))}
                      >
                        {node.name}
                      </button>
                    ),
                  })),
                ]}
              />
              <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload}>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  loading={uploading}
                  disabled={!spaceId}
                >
                  上传项目封面
                </Button>
              </Upload>
            </div>
            <Spin spinning={loading}>
              <div className="project-cover-file-list">
                {nodes.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前目录没有图片" />
                ) : (
                  nodes.map((node) => (
                    <div className="project-cover-file-item" key={node.id}>
                      <span className="project-cover-file-icon">
                        {node.type === 'FOLDER' ? <FolderOpenOutlined /> : <PictureOutlined />}
                      </span>
                      <div className="project-cover-file-meta">
                        <strong>{node.name}</strong>
                        {node.type === 'FOLDER' ? (
                          <span>文件夹</span>
                        ) : (
                          <Tag color={node.fileStatus === 'ACTIVE' ? 'success' : 'processing'}>
                            {node.fileStatus === 'ACTIVE' ? '可用' : '校验中'}
                          </Tag>
                        )}
                      </div>
                      {node.type === 'FOLDER' ? (
                        <Button
                          type="link"
                          onClick={() => setPath((current) => [...current, node])}
                        >
                          打开
                        </Button>
                      ) : (
                        <Button
                          type="link"
                          disabled={node.fileStatus !== 'ACTIVE'}
                          onClick={() => selectImage(node)}
                        >
                          选择
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Spin>
          </>
        )}
      </Modal>
    </div>
  );
}
