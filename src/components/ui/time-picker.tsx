'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimePickerProps {
  value: string; // HH:MM 格式
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  startHour?: number; // 可选小时范围起始
  endHour?: number;   // 可选小时范围结束
  minuteValues?: number[]; // 自定义分钟选项，默认 [0,5,10,15,20,30,40]
}

export function TimePicker({
  value,
  onChange,
  id,
  className,
  startHour = 0,
  endHour = 23,
  minuteValues = [0, 5, 10, 15, 20, 30, 40, 45, 50, 55],
}: TimePickerProps) {
  const hasValue = value && value.includes(':');
  const [hours, minutes] = hasValue ? value.split(':').map(Number) : [0, 0];
  const safeHours = hasValue && !isNaN(hours) ? hours : 0;
  const safeMinutes = hasValue && !isNaN(minutes) ? minutes : 0;

  // 生成小时选项
  const hourOptions = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // 使用自定义分钟选项
  const minuteOptions = minuteValues;

  const handleHourChange = (newHour: string) => {
    const h = parseInt(newHour, 10);
    const m = hasValue ? safeMinutes : 0;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    const m = parseInt(newMinute, 10);
    const h = hasValue ? safeHours : 9;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const formatHour = (h: number) => String(h).padStart(2, '0');
  const formatMinute = (m: number) => String(m).padStart(2, '0');

  // 找到最近的合法分钟值
  const closestMinute = hasValue
    ? minuteOptions.reduce((prev, curr) =>
        Math.abs(curr - safeMinutes) < Math.abs(prev - safeMinutes) ? curr : prev
      )
    : 0;

  return (
    <div id={id} className={`flex items-center gap-1 ${className || ''}`}>
      <Select value={hasValue ? String(safeHours) : ''} onValueChange={handleHourChange}>
        <SelectTrigger className="w-[72px]">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {hourOptions.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {formatHour(h)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-lg font-medium text-muted-foreground select-none">:</span>
      <Select value={hasValue ? String(closestMinute) : ''} onValueChange={handleMinuteChange}>
        <SelectTrigger className="w-[72px]">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {minuteOptions.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {formatMinute(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
