import React, { useMemo } from 'react';
import { Card, Table, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { OCRRecord } from '../types';

interface HistoryTableProps {
  history: OCRRecord[];
  loading: boolean;
}

const HistoryTable: React.FC<HistoryTableProps> = ({ history, loading }) => {
  const columns = useMemo(
    () => [
      {
        title: '截图时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 180,
        render: (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false }),
      },
      {
        title: '处理状态',
        key: 'status',
        width: 90,
        render: () => <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>,
      },
      {
        title: 'OCR 结果',
        dataIndex: 'text',
        key: 'text',
        ellipsis: true,
        render: (value: string) => value || '（无文字）',
      },
    ],
    [],
  );

  return (
    <Card title="最近历史记录" bordered={false}>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={history}
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: loading ? '正在加载历史记录...' : '暂无历史记录' }}
      />
    </Card>
  );
};

export default HistoryTable;
