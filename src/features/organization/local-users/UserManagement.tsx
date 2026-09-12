import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileProtectOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import Avatar from 'antd/es/avatar';
import Button from 'antd/es/button';
import Divider from 'antd/es/divider';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Spin from 'antd/es/spin';
import Switch from 'antd/es/switch';
import Table from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import Upload from 'antd/es/upload';
import type { TableProps } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import { Perm } from '../../../app/guards/Perm';
import { PERMISSIONS } from '../../../shared/utils/permissions';
import { userApi } from './api/userApi';
import {
  normalizeUserPayload,
  userToFormValues,
  validateImportFile,
  validateUserPayload,
} from './lib/userForm';
import { getUserIdentityDisplay } from './lib/userDisplay';
import { COUNTRY_OPTIONS } from './lib/countryOptions';
import { IdentityDocumentManager } from './IdentityDocumentManager';
import type { AdminUser, UserImportResponse, UserListParams, UserWritePayload } from './types';
import './UserManagement.css';

const { Search } = Input;
const { Text } = Typography;
const LIST_KEY = 'admin-users';

function errorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const response = error.response?.data as { message?: string | string[] } | undefined;
  if (Array.isArray(response?.message)) return response.message.join('；');
  return response?.message ?? fallback;
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<UserListParams>({ page: 1, pageSize: 20 });
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importResult, setImportResult] = useState<UserImportResponse | null>(null);
  const [identityUser, setIdentityUser] = useState<AdminUser | null>(null);
  const [form] = Form.useForm<UserWritePayload>();

  const usersQuery = useQuery({
    queryKey: [LIST_KEY, filters],
    queryFn: () => userApi.list(filters),
    placeholderData: (previous) => previous,
  });

  const editDetailQuery = useQuery({
    queryKey: ['admin-user-detail', editing?.id],
    queryFn: () => userApi.getById(editing!.id),
    enabled: formOpen && Boolean(editing),
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!formOpen) return;
    if (!editing) {
      form.resetFields();
      form.setFieldsValue({ countryCode: '+86', active: true });
      return;
    }
    if (editDetailQuery.data) {
      form.resetFields();
      form.setFieldsValue(userToFormValues(editDetailQuery.data));
    }
  }, [editDetailQuery.data, editing, form, formOpen]);

  useEffect(() => {
    if (editDetailQuery.error) {
      void message.error(errorMessage(editDetailQuery.error, '获取系统账号详情失败'));
    }
  }, [editDetailQuery.error]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [LIST_KEY] });

  const saveMutation = useMutation({
    mutationFn: (values: UserWritePayload) =>
      editing ? userApi.update(editing.id, values) : userApi.create(values),
    onSuccess: () => {
      void message.success(editing ? '系统账号已更新' : '系统账号已创建');
      setFormOpen(false);
      setEditing(null);
      form.resetFields();
      void invalidate();
    },
    onError: (error) => void message.error(errorMessage(error, '保存系统账号失败')),
  });

  const deleteMutation = useMutation({
    mutationFn: userApi.delete,
    onSuccess: () => {
      void message.success('系统账号已删除');
      void invalidate();
    },
    onError: (error) => void message.error(errorMessage(error, '删除系统账号失败')),
  });

  const importMutation = useMutation({
    mutationFn: userApi.import,
    onSuccess: (result) => {
      setImportResult(result);
      void invalidate();
      if (!result.failureCount) void message.success(`成功导入 ${result.successCount} 个系统账号`);
    },
    onError: (error) => void message.error(errorMessage(error, '导入系统账号失败')),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditing(user);
    form.resetFields();
    setFormOpen(true);
  };

  const submitForm = async () => {
    const values = await form.validateFields();
    const validationError = validateUserPayload(values);
    if (validationError) {
      void message.error(validationError);
      return;
    }
    saveMutation.mutate(normalizeUserPayload(values));
  };

  const submitImport = () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      void message.error('请选择要导入的文件');
      return;
    }
    const validationError = validateImportFile(file);
    if (validationError) {
      void message.error(validationError);
      return;
    }
    importMutation.mutate(file);
  };

  const columns: TableProps<AdminUser>['columns'] = [
    {
      title: '系统账号',
      key: 'user',
      width: 190,
      render: (_value, record) => {
        const identity = getUserIdentityDisplay(record);
        return (
          <Space>
            <Avatar src={record.profile?.avatar} icon={<UserOutlined />} />
            <div className="user-primary-cell">
              <Text strong>{identity.primary}</Text>
              {identity.secondary ? <Text type="secondary">{identity.secondary}</Text> : null}
            </div>
          </Space>
        );
      },
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 220,
      render: (value: string | null, record) =>
        value ? (
          <Space size={4}>
            <Text>{value}</Text>
            {record.emailVerified && <Tag color="success">已验证</Tag>}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: '手机号',
      key: 'phone',
      width: 165,
      render: (_value, record) =>
        record.phone ? `${record.countryCode ?? ''} ${record.phone}` : '—',
    },
    {
      title: '状态',
      dataIndex: 'active',
      width: 90,
      render: (active: boolean) => (active ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 155,
      render: (value: string | null) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '从未登录',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 155,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 145,
      render: (_value, record) => (
        <Space size={4}>
          <Perm permission={PERMISSIONS.IDENTITY_DOCUMENT.READ}>
            <Button
              type="text"
              icon={<FileProtectOutlined />}
              title="身份凭证"
              onClick={() => setIdentityUser(record)}
            />
          </Perm>
          <Perm permission={PERMISSIONS.USER.UPDATE}>
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Perm>
          <Perm permission={PERMISSIONS.USER.DELETE}>
            <Popconfirm
              title="确定删除此系统账号？"
              description="系统账号将被停用并软删除。"
              okType="danger"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Perm>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-management">
      <div className="user-management-header">
        <div className="user-management-filters">
          <Search
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索用户名、邮箱、手机号或显示名称"
            onSearch={(keyword) =>
              setFilters((current) => ({ ...current, keyword: keyword || undefined, page: 1 }))
            }
          />
          <Select
            allowClear
            placeholder="全部状态"
            options={[
              { label: '启用', value: true },
              { label: '停用', value: false },
            ]}
            onChange={(active) => setFilters((current) => ({ ...current, active, page: 1 }))}
          />
        </div>

        <div className="user-management-actions">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void usersQuery.refetch()}>
              刷新
            </Button>
            <Perm permission={PERMISSIONS.USER.CREATE}>
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  setFileList([]);
                  setImportResult(null);
                  setImportOpen(true);
                }}
              >
                批量导入
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新建系统账号
              </Button>
            </Perm>
          </Space>
        </div>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={usersQuery.data?.items ?? []}
        loading={usersQuery.isFetching}
        scroll={{ x: 1100 }}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total: usersQuery.data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个系统账号`,
          onChange: (page, pageSize) => setFilters((current) => ({ ...current, page, pageSize })),
        }}
      />

      <Modal
        title={editing ? '编辑系统账号' : '新建系统账号'}
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => void submitForm()}
        confirmLoading={saveMutation.isPending || editDetailQuery.isFetching}
        okButtonProps={{
          disabled: Boolean(editing) && (!editDetailQuery.data || editDetailQuery.isFetching),
        }}
        destroyOnHidden
        width={760}
      >
        <Spin spinning={Boolean(editing) && editDetailQuery.isFetching}>
          <Form form={form} layout="vertical" preserve={false}>
            <Divider titlePlacement="start">账号信息</Divider>
            <Form.Item label="显示名称" name="displayName">
              <Input maxLength={100} placeholder="用于后台展示" />
            </Form.Item>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线' }]}
            >
              <Input maxLength={50} placeholder="用户名、邮箱、手机号至少填写一个" />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ type: 'email', message: '邮箱格式不正确' }]}
            >
              <Input maxLength={255} placeholder="user@example.com" />
            </Form.Item>
            <Space align="start" className="user-phone-fields">
              <Form.Item label="国家代码" name="countryCode">
                <Input placeholder="+86" maxLength={5} />
              </Form.Item>
              <Form.Item
                label="手机号"
                name="phone"
                rules={[{ pattern: /^[\d\s()-]+$/, message: '手机号格式不正确' }]}
              >
                <Input maxLength={30} placeholder="13800138000" />
              </Form.Item>
            </Space>
            <Form.Item label="启用" name="active" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Divider titlePlacement="start">个人资料</Divider>
            <div className="user-profile-grid">
              <Form.Item label="完整姓名" name="fullName" className="user-profile-wide">
                <Input maxLength={200} placeholder="用户填写的完整姓名，未经实名认证" />
              </Form.Item>
              <Form.Item label="出生日期" name="dateOfBirth">
                <Input type="date" />
              </Form.Item>
              <Form.Item label="性别" name="gender">
                <Select
                  allowClear
                  options={[
                    { label: '男', value: 'MALE' },
                    { label: '女', value: 'FEMALE' },
                    { label: '其他', value: 'OTHER' },
                    { label: '不愿透露', value: 'PREFER_NOT_TO_SAY' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label="头像 URL"
                name="avatar"
                rules={[{ type: 'url', message: '头像 URL 格式不正确' }]}
                className="user-profile-wide"
              >
                <Input maxLength={500} placeholder="https://example.com/avatar.png" />
              </Form.Item>
              <Form.Item
                label="个人网站"
                name="website"
                rules={[{ type: 'url', message: '个人网站 URL 格式不正确' }]}
                className="user-profile-wide"
              >
                <Input maxLength={255} placeholder="https://example.com" />
              </Form.Item>
              <Form.Item label="国家" name="country">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="请选择国家或地区"
                  options={COUNTRY_OPTIONS}
                />
              </Form.Item>
              <Form.Item label="城市" name="city">
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item label="邮政编码" name="zipCode">
                <Input maxLength={20} />
              </Form.Item>
              <Form.Item label="详细地址" name="address" className="user-profile-wide">
                <Input maxLength={500} />
              </Form.Item>
              <Form.Item label="个人简介" name="bio" className="user-profile-full">
                <Input.TextArea maxLength={500} rows={3} showCount />
              </Form.Item>
            </div>
          </Form>
        </Spin>
      </Modal>

      <Modal
        title="批量导入系统账号"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={submitImport}
        okText="开始导入"
        confirmLoading={importMutation.isPending}
        okButtonProps={{ disabled: !fileList.length }}
        width={680}
      >
        <div className="user-import-help">
          <div className="user-import-help-header">
            <Text>支持 CSV、XLSX，首行为表头，单次最多 5000 条、5 MB。</Text>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              href="/templates/user-import-template.xlsx"
              download="nove-user-import-template.xlsx"
            >
              下载 XLSX 示例
            </Button>
          </div>
          <Text type="secondary">
            表头可用：username/用户名、email/邮箱、countryCode/国家代码、phone/手机号、displayName/显示名称、fullName/完整姓名、active/是否启用；也支持头像、简介、出生日期、性别、地址、城市、国家、邮编和个人网站等资料字段。
          </Text>
        </div>
        <Upload.Dragger
          accept=".csv,.xlsx"
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: next }) => {
            const file = next[0]?.originFileObj;
            const validationError = file ? validateImportFile(file) : null;
            if (validationError) {
              void message.error(validationError);
              setFileList([]);
              return;
            }
            setFileList(next.slice(-1));
            setImportResult(null);
          }}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p>点击或拖拽系统账号文件到此处</p>
        </Upload.Dragger>

        {importResult && (
          <div className="user-import-result">
            <Space>
              <Tag color="success">成功 {importResult.successCount}</Tag>
              <Tag color={importResult.failureCount ? 'error' : 'default'}>
                失败 {importResult.failureCount}
              </Tag>
            </Space>
            {importResult.failures.length > 0 && (
              <Table
                size="small"
                rowKey={(failure) => `${failure.row}-${failure.code}`}
                pagination={{ pageSize: 5 }}
                dataSource={importResult.failures}
                columns={[
                  { title: '行', dataIndex: 'row', width: 60 },
                  { title: '系统账号', dataIndex: 'identifier', width: 180 },
                  { title: '失败原因', dataIndex: 'reason' },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      <IdentityDocumentManager
        open={Boolean(identityUser)}
        user={identityUser}
        onClose={() => setIdentityUser(null)}
      />
    </div>
  );
}
