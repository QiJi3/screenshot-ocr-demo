import React, { useEffect, useState } from 'react';
import {
  Alert,
  Divider,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;
const BACKEND_URL = 'http://127.0.0.1:8000';

interface OCRConfigResponse {
  status: string;
  message?: string;
  model_version: string;
  custom_det_path: string;
  custom_rec_path: string;
  available_versions?: string[];
  model_status?: string;
}

interface OCRConfigData {
  model_version: string;
  custom_det_path: string;
  custom_rec_path: string;
  model_status?: string;
}

interface AvailableModelsResponse {
  status: string;
  available_models: ModelInfo[];
}

interface UpdateConfigResponse {
  status: string;
  message?: string;
  model_version?: string;
}

interface ModelInfo {
  name: string;
  description: string;
  available: boolean;
}

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '未知错误';
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  visible,
  onClose,
}) => {
  const [config, setConfig] = useState<OCRConfigData>({
    model_version: 'v4',
    custom_det_path: '',
    custom_rec_path: '',
    model_status: 'not_ready',
  });
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    void fetchConfig();
    void fetchAvailableModels();
  }, [visible]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await axios.get<OCRConfigResponse>(`${BACKEND_URL}/api/settings/ocr-config`);
      if (res.data.status === 'success') {
        setConfig({
          model_version: res.data.model_version,
          custom_det_path: res.data.custom_det_path,
          custom_rec_path: res.data.custom_rec_path,
          model_status: res.data.model_status,
        });
      } else {
        void message.error(`加载配置失败: ${res.data.message || '未知错误'}`);
      }
    } catch (error) {
      void message.error(`加载配置失败: ${getErrorMessage(error)}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const res = await axios.get<AvailableModelsResponse>(`${BACKEND_URL}/api/settings/available-models`);
      if (res.data.status === 'success') {
        setAvailableModels(res.data.available_models);
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
    }
  };

  const handleSave = async () => {
    if (config.model_version === 'custom') {
      if (!config.custom_det_path || !config.custom_rec_path) {
        void message.error('请填入自定义模型的两个路径');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await axios.post<UpdateConfigResponse>(`${BACKEND_URL}/api/settings/ocr-config`, {
        model_version: config.model_version,
        custom_det_path: config.custom_det_path,
        custom_rec_path: config.custom_rec_path,
      });

      if (res.data.status === 'success') {
        void message.success('配置已保存。应用重启后生效。');
        onClose();
      } else {
        void message.error(`保存失败: ${res.data.message || '未知错误'}`);
      }
    } catch (error) {
      void message.error(`保存失败: ${getErrorMessage(error)}`);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = [
    {
      label: 'PP-OCRv3 (快速)',
      value: 'v3',
      description: '识别速度快，精度相对较低，适合实时识别',
    },
    {
      label: 'PP-OCRv4 (高精度)',
      value: 'v4',
      description: '识别精度高，速度相对较慢，适合精度要求高的场景',
    },
    {
      label: '自定义模型',
      value: 'custom',
      description: '使用自己的 ONNX 格式模型',
    },
  ];

  const selectedModel = modelOptions.find((item) => item.value === config.model_version);

  return (
    <Modal
      title="OCR 设置"
      open={visible}
      onOk={() => void handleSave()}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ loading: saving }}
      width={600}
      destroyOnHidden
    >
      <Spin spinning={loading} tip="加载配置中...">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Space align="center" style={{ marginBottom: 8 }}>
              <Text strong>选择 OCR 模型</Text>
              <Tag color={config.model_status === 'ready' ? 'success' : 'default'}>
                {config.model_status === 'ready' ? '模型就绪' : '模型未就绪'}
              </Tag>
            </Space>
            <Select
              style={{ width: '100%' }}
              value={config.model_version}
              onChange={(value: string) => {
                setConfig((current) => ({
                  ...current,
                  model_version: value,
                }));
              }}
              options={modelOptions.map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
            {selectedModel && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {selectedModel.description}
              </Text>
            )}
          </div>

          {availableModels.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                模型文件状态
              </Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {availableModels.map((model) => (
                  <Space key={model.name} size="small" align="center">
                    {model.available ? (
                      <>
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                        <Text>
                          PP-OCR{model.name.toUpperCase()} - 可用
                        </Text>
                      </>
                    ) : (
                      <>
                        <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 16 }} />
                        <Text>
                          PP-OCR{model.name.toUpperCase()} - 未找到
                        </Text>
                      </>
                    )}
                    <Text type="secondary">{model.description}</Text>
                  </Space>
                ))}
              </Space>
            </div>
          )}

          {config.model_version === 'custom' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  检测模型路径（.onnx）
                </Text>
                <Input
                  placeholder="例如：C:\\models\\ch_PP-OCRv4_det_infer.onnx"
                  value={config.custom_det_path}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    setConfig((current) => ({
                      ...current,
                      custom_det_path: value,
                    }));
                  }}
                  suffix={<FolderOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  识别模型路径（.onnx）
                </Text>
                <Input
                  placeholder="例如：C:\\models\\ch_PP-OCRv4_rec_infer.onnx"
                  value={config.custom_rec_path}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    setConfig((current) => ({
                      ...current,
                      custom_rec_path: value,
                    }));
                  }}
                  suffix={<FolderOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
                />
              </div>
            </>
          )}

          <Alert
            message="提示"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>修改配置后需要重启应用才能生效</li>
                <li>如果模型文件不存在，应用会自动降级到默认模型</li>
                <li>自定义模型需要为 ONNX 格式（.onnx）</li>
              </ul>
            }
            type="info"
            showIcon
          />

          {config.model_version === 'custom' && (
            <Alert
              message="自定义模型说明"
              description="请同时提供检测模型和识别模型两个 .onnx 文件路径，否则无法保存。"
              type="warning"
              showIcon
            />
          )}
        </Space>
      </Spin>
    </Modal>
  );
};
