import React, { useEffect, useRef, useState } from 'react';
import {
  Layout, Row, Col, Typography, Alert, Spin, Space,
  Button, Drawer, Form, Slider, InputNumber, Switch,
  Select, Upload, Image, message, ConfigProvider, Divider
} from 'antd';
import {
  LoadingOutlined, MonitorOutlined, GlobalOutlined,
  SettingOutlined, ExperimentOutlined, InboxOutlined
} from '@ant-design/icons';
import axios from 'axios';
import MonitorCard from './components/MonitorCard';
import OcrResultCard from './components/OcrResultCard';
import HistoryTable from './components/HistoryTable';
import type { OCRRecord } from './types';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const BACKEND_URL = 'http://127.0.0.1:8000';
const SCREENSHOT_INTERVAL_SECONDS = 10;

interface AppSettings {
  confidence: number;
  line_threshold: number;
  enable_preprocess: boolean;
  capture_mode: string;
}

const App: React.FC = () => {
  const [latest, setLatest] = useState<OCRRecord | null>(null);
  const [history, setHistory] = useState<OCRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const [countdown, setCountdown] = useState(SCREENSHOT_INTERVAL_SECONDS);

  // 设置抽屉
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    confidence: 0.5,
    line_threshold: 15,
    enable_preprocess: true,
    capture_mode: 'screen',
  });
  const [saving, setSaving] = useState(false);

  // Demo 抽屉
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const [demoPreview, setDemoPreview] = useState<string>('');
  const [demoText, setDemoText] = useState<string>('');
  const [demoLoading, setDemoLoading] = useState(false);

  const ipcRef = useRef<any>(null);

  // 轮询 /health
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const waitForBackend = async () => {
      while (!cancelled) {
        try {
          const res = await axios.get(`${BACKEND_URL}/health`);
          if (res.status === 200) { if (!cancelled) setBackendReady(true); return; }
        } catch {}
        await wait(1000);
      }
    };
    void waitForBackend();
    return () => { cancelled = true; };
  }, []);

  // 拉取设置
  useEffect(() => {
    if (!backendReady) return;
    axios.get<AppSettings>(`${BACKEND_URL}/settings`).then(r => setSettings(r.data)).catch(() => {});
  }, [backendReady]);

  // Electron IPC
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRef.current = ipcRenderer;
      ipcRenderer.on('open-settings', () => setSettingsOpen(true));
      ipcRenderer.on('open-demo', () => setDemoOpen(true));
      return () => {
        ipcRenderer.removeAllListeners('open-settings');
        ipcRenderer.removeAllListeners('open-demo');
      };
    }
  }, []);

  // 倒计时
  useEffect(() => {
    if (!backendReady) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? SCREENSHOT_INTERVAL_SECONDS : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [backendReady]);

  // SSE + 初始加载
  useEffect(() => {
    if (!backendReady) return;
    let active = true;
    const fetchAll = async () => {
      try {
        const res = await axios.get<OCRRecord[]>(`${BACKEND_URL}/captures`);
        if (!active) return;
        const records = res.data;
        setLatest(records.length > 0 ? records[0] : null);
        setHistory(records);
      } catch (err) {
        console.error('获取记录失败:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchAll();
    const es = new EventSource(`${BACKEND_URL}/captures/events`);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'new_capture') {
          const record: OCRRecord = msg.record;
          setLatest(record);
          setHistory((prev) => [record, ...prev]);
          setLoading(false);
          setCountdown(SCREENSHOT_INTERVAL_SECONDS);
        }
      } catch {}
    };
    es.onopen = () => { void fetchAll(); };
    return () => { active = false; es.close(); };
  }, [backendReady]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${BACKEND_URL}/settings`, settings);
      // 同步截图模式到 Electron
      if (ipcRef.current) ipcRef.current.send('set-capture-mode', settings.capture_mode);
      void message.success('设置已保存');
      setSettingsOpen(false);
    } catch {
      void message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const runDemo = async () => {
    if (!demoFile) return;
    setDemoLoading(true);
    setDemoText('');
    try {
      const form = new FormData();
      form.append('file', demoFile);
      const res = await axios.post<{ text: string }>(`${BACKEND_URL}/ocr/recognize`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDemoText(res.data.text || '（未识别到文字）');
    } catch {
      void message.error('识别失败');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <ConfigProvider theme={{ token: { fontSize: 15, fontSizeLG: 17, fontSizeXL: 20 } }}>
      <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#001529', padding: '0 24px' }}>
          <Space>
            <MonitorOutlined style={{ color: 'white', fontSize: 22 }} />
            <Title level={3} style={{ color: 'white', margin: 0, fontSize: 20 }}>截图 OCR Demo</Title>
          </Space>
          <Space>
            <Text style={{ color: 'rgba(255,255,255,0.65)' }}>每 10 秒自动截图 · OCR 识别 · 本地存储</Text>
            <Button icon={<ExperimentOutlined />} onClick={() => setDemoOpen(true)}
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', background: 'transparent' }}>
              上传识别
            </Button>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', background: 'transparent' }}>
              设置
            </Button>
            <Button icon={<GlobalOutlined />} onClick={() => window.open('http://127.0.0.1:8000', '_blank')}
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', background: 'transparent' }}>
              在浏览器打开
            </Button>
          </Space>
        </Header>

        <Content style={{ padding: '24px', background: '#f5f7fb' }}>
          {!backendReady ? (
            <Alert type="info" showIcon message="OCR 服务启动中"
              description={
                <Space direction="vertical" size={6}>
                  <Text>首次启动会加载识别模型，通常需要几秒到十几秒，请稍等。</Text>
                  <Space>
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                    <Text type="secondary">正在等待本地服务就绪…</Text>
                  </Space>
                </Space>
              }
            />
          ) : (
            <Row gutter={[24, 24]}>
              <Col span={10}><MonitorCard latest={latest} loading={loading} countdown={countdown} /></Col>
              <Col span={14}><OcrResultCard latest={latest} /></Col>
              <Col span={24}><HistoryTable history={history} loading={loading} /></Col>
            </Row>
          )}
        </Content>

        {/* 设置抽屉 */}
        <Drawer title="OCR 参数设置" open={settingsOpen} onClose={() => setSettingsOpen(false)} width={380}
          footer={
            <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
              <Button onClick={() => setSettingsOpen(false)}>取消</Button>
              <Button type="primary" loading={saving} onClick={saveSettings}>保存</Button>
            </Space>
          }
        >
          <Form layout="vertical" size="large">
            <Form.Item label="置信度阈值" help="低于此值的识别结果会被过滤，越高越严格">
              <Row gutter={12} align="middle">
                <Col flex="auto">
                  <Slider min={0.1} max={0.9} step={0.05} value={settings.confidence}
                    onChange={(v) => setSettings(s => ({ ...s, confidence: v }))} />
                </Col>
                <Col>
                  <InputNumber min={0.1} max={0.9} step={0.05} precision={2} value={settings.confidence}
                    onChange={(v) => v != null && setSettings(s => ({ ...s, confidence: v }))} style={{ width: 70 }} />
                </Col>
              </Row>
            </Form.Item>

            <Form.Item label="同行合并阈值（px）" help="y 差距在此范围内的文字块合并为一行，4K 屏建议 25">
              <Row gutter={12} align="middle">
                <Col flex="auto">
                  <Slider min={5} max={50} step={1} value={settings.line_threshold}
                    onChange={(v) => setSettings(s => ({ ...s, line_threshold: v }))} />
                </Col>
                <Col>
                  <InputNumber min={5} max={50} step={1} value={settings.line_threshold}
                    onChange={(v) => v != null && setSettings(s => ({ ...s, line_threshold: v }))} style={{ width: 70 }} />
                </Col>
              </Row>
            </Form.Item>

            <Divider />

            <Form.Item label="图像预处理" help="低分辨率截图自动放大 + 增强对比度 + 锐化，提升识别率">
              <Switch checked={settings.enable_preprocess}
                onChange={(v) => setSettings(s => ({ ...s, enable_preprocess: v }))}
                checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>

            <Form.Item label="截图范围" help="全屏：截整个桌面；活跃窗口：只截当前前台窗口（噪音更少）">
              <Select value={settings.capture_mode}
                onChange={(v) => setSettings(s => ({ ...s, capture_mode: v }))}
                options={[
                  { value: 'screen', label: '全屏' },
                  { value: 'window', label: '活跃窗口' },
                ]}
                style={{ width: 160 }}
              />
            </Form.Item>

            <Form.Item label="截图间隔">
              <Text type="secondary">10 秒（由 Electron 控制，暂不支持运行时修改）</Text>
            </Form.Item>
          </Form>
        </Drawer>

        {/* Demo 抽屉 */}
        <Drawer title="上传识别" open={demoOpen} onClose={() => setDemoOpen(false)} width={480}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Dragger
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                setDemoFile(file);
                setDemoText('');
                const url = URL.createObjectURL(file);
                setDemoPreview(url);
                return false;
              }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽图片到此处</p>
              <p className="ant-upload-hint">支持 PNG / JPG / BMP / TIFF</p>
            </Dragger>

            {demoPreview && (
              <Image src={demoPreview} alt="preview" style={{ maxHeight: 300, objectFit: 'contain', width: '100%' }} />
            )}

            <Button type="primary" block size="large" disabled={!demoFile} loading={demoLoading} onClick={runDemo}>
              开始识别
            </Button>

            {demoText && (
              <div>
                <Text strong>识别结果：</Text>
                <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, marginTop: 8, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  <Paragraph style={{ margin: 0 }}>{demoText}</Paragraph>
                </div>
              </div>
            )}
          </Space>
        </Drawer>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
