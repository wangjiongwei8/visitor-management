'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode, Copy, Check, ExternalLink, RefreshCw, Save, Edit2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

export default function PublicAppointmentPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempUrl, setTempUrl] = useState('');

  // 生成公开预约链接
  const getDefaultUrl = useCallback(() => {
    const origin = window.location.origin;
    return `${origin}/public/appointment`;
  }, []);

  // 生成二维码
  const generateQRCode = useCallback(async (url: string) => {
    try {
      setIsGenerating(true);
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('生成二维码失败:', error);
      toast.error('生成二维码失败');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // 初始化
  useEffect(() => {
    const defaultUrl = getDefaultUrl();
    const savedUrl = localStorage.getItem('publicAppointmentUrl') || defaultUrl;
    setBaseUrl(defaultUrl);
    setPublicUrl(savedUrl);
    setTempUrl(savedUrl);
    generateQRCode(savedUrl);
  }, [getDefaultUrl, generateQRCode]);

  // 保存编辑后的URL
  const handleSaveUrl = () => {
    if (!tempUrl.trim()) {
      toast.error('URL不能为空');
      return;
    }

    try {
      // 验证URL格式
      new URL(tempUrl);
    } catch {
      toast.error('请输入有效的URL');
      return;
    }

    localStorage.setItem('publicAppointmentUrl', tempUrl);
    setPublicUrl(tempUrl);
    generateQRCode(tempUrl);
    setIsEditing(false);
    toast.success('预约地址已更新');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setTempUrl(publicUrl);
    setIsEditing(false);
  };

  // 复制链接
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  // 刷新二维码
  const refreshQRCode = () => {
    generateQRCode(publicUrl);
    toast.success('二维码已刷新');
  };

  // 下载二维码
  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = '访客预约二维码.png';
      link.href = qrCodeUrl;
      link.click();
      toast.success('二维码已下载');
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">预约二维码管理</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          生成公开预约链接和二维码，发布到网络供访客扫码预约
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* 左侧：链接管理 */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              预约链接
            </CardTitle>
            <CardDescription>
              访客访问此链接进行预约登记
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="public-url">公开预约地址</Label>
                {!isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-7 text-xs"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    编辑
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    编辑模式
                  </Badge>
                )}
              </div>

              {!isEditing ? (
                <div className="flex gap-2">
                  <Input
                    id="public-url"
                    value={publicUrl}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                    title="复制链接"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="public-url-edit"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="https://your-domain.com/public/appointment"
                    className="flex-1 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    默认地址：{baseUrl}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="flex-1"
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveUrl}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      保存
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={refreshQRCode}
                disabled={isGenerating}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                刷新二维码
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(publicUrl, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                预览
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 右侧：二维码展示 */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>访客预约二维码</CardTitle>
            <CardDescription>
              扫描二维码访问预约页面
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative rounded-2xl bg-white p-6 shadow-lg">
              {isGenerating ? (
                <div className="flex h-64 w-64 items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="预约二维码"
                  className="h-64 w-64 object-contain transition-all duration-300 hover:scale-105"
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-slate-400">
                  二维码加载中...
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-sm text-slate-500">
              将此二维码放置在访客入口处
            </p>
            <Button
              className="mt-4"
              onClick={downloadQRCode}
              disabled={!qrCodeUrl}
            >
              <QrCode className="mr-2 h-4 w-4" />
              下载二维码
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 使用说明 */}
      <Card className="mt-8 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                1
              </span>
              <span>点击「编辑」修改预约地址（可添加路径参数用于区分不同入口）</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                2
              </span>
              <span>点击「保存」后二维码会自动更新</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                3
              </span>
              <span>下载二维码图片，放置在访客入口、公司官网或发送给他人</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                4
              </span>
              <span>访客扫码后填写预约信息提交，预约信息将在管理端显示等待审批</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
