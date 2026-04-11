import React from 'react';
import { Card, Typography, Tag, Empty, Image } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { OCRRecord } from '../types';

const { Text } = Typography;

const BACKEND_URL = 'http://127.0.0.1:8000';
const SCREENSHOT_INTERVAL = 10;

interface MonitorCardProps {
  latest: OCRRecord | null;
  loading: boolean;
  countdown: number;
}

const MonitorCard: React.FC<MonitorCardProps> = ({ latest, loading, countdown }) => {
  const imageUrl = latest ? `${BACKEND_URL}${latest.screenshot_url}` : '';

  return (
    <Card title="实时状态" bordered={false} style={{ height: '100%' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text strong>距离下次截图：</Text>
        <Tag icon={<ClockCircleOutlined />} color="blue">{countdown} 秒</Tag>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text strong>最新截图时间：</Text>
        <Text>{latest ? new Date(latest.timestamp).toLocaleString('zh-CN', { hour12: false }) : '暂无数据'}</Text>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text strong>处理状态：</Text>
        {latest
          ? <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
          : <Tag icon={<ClockCircleOutlined />} color="default">等待中</Tag>
        }
      </div>
      <div style={{ background: '#e6f4ff', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, overflow: 'hidden' }}>
        {latest ? (
          <Image src={imageUrl} alt="latest screenshot" style={{ maxHeight: 300, objectFit: 'contain' }} />
        ) : (
          <Empty description={loading ? '正在加载...' : '等待截图接入...'} />
        )}
      </div>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>每 {SCREENSHOT_INTERVAL} 秒自动截图一次</Text>
      </div>
    </Card>
  );
};

export default MonitorCard;
