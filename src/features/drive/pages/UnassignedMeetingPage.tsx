import Button from 'antd/es/button';
import Card from 'antd/es/card';
import message from 'antd/es/message';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import { useEffect, useState, type Key } from 'react';
import { driveApi } from '../api/driveApi';
import './DrivePage.css';

type MeetingItem = Awaited<ReturnType<typeof driveApi.listUnassignedMeetings>>['meetings'][number];

export function UnassignedMeetingPage() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<Key[]>([]);
  const [orgId, setOrgId] = useState<string>();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await driveApi.listUnassignedMeetings();
      setMeetings(result.meetings);
      setOrganizations(result.organizations);
    } catch {
      message.error('读取待归属会议失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const assign = async () => {
    if (!orgId || !selected.length) return;
    const result = await driveApi.assignMeetingOrganization(selected.map(String), orgId);
    message.success(`已归属 ${result.updated} 条会议`);
    setSelected([]);
    await load();
  };

  return (
    <div className="drive-page">
      <Card
        title="待归属会议"
        extra={
          <Space>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择目标组织"
              style={{ width: 240 }}
              value={orgId}
              onChange={setOrgId}
              options={organizations.map((org) => ({ label: org.name, value: org.id }))}
            />
            <Button
              type="primary"
              disabled={!orgId || !selected.length}
              onClick={() => void assign()}
            >
              批量归属
            </Button>
          </Space>
        }
      >
        <Table<MeetingItem>
          rowKey="id"
          loading={loading}
          dataSource={meetings}
          rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
          pagination={{ pageSize: 50 }}
          columns={[
            { title: '会议标题', dataIndex: 'title' },
            { title: '平台', dataIndex: 'platform', width: 180 },
            { title: '平台会议 ID', dataIndex: 'meetingId', width: 220 },
            { title: 'Minute 数', dataIndex: ['_count', 'minutes'], width: 110 },
            {
              title: '开始时间',
              dataIndex: 'startAt',
              width: 200,
              render: (value) => (value ? new Date(value).toLocaleString() : '-'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
