import React from 'react';
import { Card, Typography, Tag, Space } from 'antd';
import { CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import type { OCRRecord } from '../types';

const { Text } = Typography;

interface OcrResultCardProps {
  latest: OCRRecord | null;
}

const OcrResultCard: React.FC<OcrResultCardProps> = ({ latest }) => {
  const hasText = latest && latest.text && latest.text.trim().length > 0;

  return (
    <Card title="当前识别结果" bordered={false} style={{ height: '100%' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>识别状态：</Text>
          {!latest
            ? <Tag color="default">待处理</Tag>
            : hasText
              ? <Tag icon={<CheckCircleOutlined />} color="success">识别到文字</Tag>
              : <Tag icon={<SyncOutlined />} color="warning">未识别到文字</Tag>
          }
        </div>

        <div>
          <Text strong>OCR 原文：</Text>
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, minHeight: 80, marginTop: 8, maxHeight: 400, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <Text>{latest?.text || '待处理'}</Text>
          </div>
        </div>
      </Space>
    </Card>
  );
};

export default OcrResultCard;
