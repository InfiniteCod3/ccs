/**
 * Router Provider Picker - Select provider + model with health status
 * Shows "provider:model" format clearly per validation requirements
 */

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { RouterProvider } from '@/lib/router-types';

interface RouterProviderPickerProps {
  providers: RouterProvider[];
  value: { provider: string; model: string };
  onChange: (value: { provider: string; model: string }) => void;
}

export function RouterProviderPicker({ providers, value, onChange }: RouterProviderPickerProps) {
  const selectedProvider = useMemo(
    () => providers.find((p) => p.name === value.provider),
    [providers, value.provider]
  );

  // Display format: "provider:model" for clarity
  const displayValue = value.provider && value.model ? `${value.provider}:${value.model}` : '';

  return (
    <div className="flex gap-2">
      <Select value={value.provider} onValueChange={(provider) => onChange({ ...value, provider })}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.name} value={p.name}>
              <div className="flex items-center gap-2">
                {p.healthy ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-500" />
                )}
                <span>{p.name}</span>
                {p.latency && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {p.latency}ms
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="text"
        value={value.model}
        onChange={(e) => onChange({ ...value, model: e.target.value })}
        placeholder="Model ID"
        className="flex-1"
      />

      {/* Show combined provider:model preview */}
      {displayValue && (
        <Badge variant="secondary" className="text-xs self-center whitespace-nowrap">
          {displayValue}
        </Badge>
      )}

      {/* Show health error if provider unhealthy */}
      {selectedProvider && !selectedProvider.healthy && selectedProvider.error && (
        <span className="text-xs text-destructive self-center truncate max-w-[150px]">
          {selectedProvider.error}
        </span>
      )}
    </div>
  );
}
