import React, { useState } from 'react';
import { Card, Typography, Tag, Space, Button, Select, Divider, message, Spin } from 'antd';
import { CheckCircleOutlined, SyncOutlined, RobotOutlined, CopyOutlined } from '@ant-design/icons';
import type { OCRRecord } from '../types';

const { Text, Paragraph } = Typography;

interface OcrResultCardProps {
  latest: OCRRecord | null;
  backendUrl: string;
}

const OcrResultCard: React.FC<OcrResultCardProps> = ({ latest, backendUrl }) => {
  const hasText = latest && latest.text && latest.text.trim().length > 0;
  const [taskType, setTaskType] = useState<string>('code_explain');
  const [aiResult, setAiResult] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const handleAiProcess = async () => {
    if (!latest || !latest.text) {
      void message.warning('当前无识别文本，请先载入图片或截图');
      return;
    }
    setAiLoading(true);
    setAiResult('');

    try {
      const response = await fetch(`${backendUrl}/api/ai/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: latest.text,
          task_type: taskType,
        }),
      });

      if (!response.body) {
        setAiResult('无法读取流式响应');
        setAiLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Save the last partial line back to buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const dataJson = JSON.parse(dataStr);
              if (dataJson.error) {
                setAiResult((prev) => prev + `\n【错误：${dataJson.error}】`);
                break;
              }
              if (dataJson.content) {
                accumulated += dataJson.content;
                setAiResult(accumulated);
              }
            } catch (e) {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }
    } catch (err: any) {
      void message.error(`请求失败: ${err.message || '网络错误'}`);
    } finally {
      setAiLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult)
      .then(() => message.success('已复制 AI 分析结果到剪贴板'))
      .catch(() => message.error('复制失败'));
  };

  return (
    <Card title="当前识别与 AI 深度分析" bordered={false} style={{ height: '100%' }}>
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
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, minHeight: 80, marginTop: 8, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <Text>{latest?.text || '待处理'}</Text>
          </div>
        </div>

        {hasText && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>AI 智能处理器：</Text>
              <Space>
                <Select
                  value={taskType}
                  onChange={(val) => setTaskType(val)}
                  style={{ width: 180 }}
                  options={[
                    { label: '💻 代码报错解释/修复', value: 'code_explain' },
                    { label: '🌐 中英双向智能翻译', value: 'translate' },
                    { label: '📊 结构化 Markdown 表格', value: 'table_markdown' },
                    { label: '📝 文本核心纪要生成', value: 'summarize' },
                  ]}
                />
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  loading={aiLoading}
                  onClick={handleAiProcess}
                >
                  开始 AI 智能分析
                </Button>
                {aiResult && (
                  <Button
                    icon={<CopyOutlined />}
                    onClick={copyToClipboard}
                  >
                    复制结果
                  </Button>
                )}
              </Space>

              {(aiResult || aiLoading) && (
                <div style={{
                  background: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  padding: 16,
                  borderRadius: 6,
                  marginTop: 16,
                  maxHeight: 280,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  position: 'relative'
                }}>
                  {aiLoading && !aiResult && <Spin tip="AI 正在思考中..." size="small" style={{ display: 'block', margin: '20px auto' }} />}
                  <Paragraph style={{ margin: 0, fontFamily: 'Consolas, Courier New, monospace' }}>
                    {aiResult}
                  </Paragraph>
                </div>
              )}
            </div>
          </>
        )}
      </Space>
    </Card>
  );
};

export default OcrResultCard;
