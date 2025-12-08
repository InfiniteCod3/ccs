import { Badge } from '@/components/ui/badge';
import { CcsLogo } from '@/components/ccs-logo';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  version?: string;
  healthStatus?: 'ok' | 'warning' | 'error';
  healthPassed?: number;
  healthTotal?: number;
}

const statusConfig = {
  ok: {
    icon: CheckCircle2,
    label: 'All Systems Operational',
    color: 'text-green-600',
    badgeBg: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  warning: {
    icon: AlertCircle,
    label: 'Some Issues Detected',
    color: 'text-yellow-500',
    badgeBg: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  error: {
    icon: XCircle,
    label: 'Action Required',
    color: 'text-red-500',
    badgeBg: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
};

export function HeroSection({
  version = '5.0.0',
  healthStatus = 'ok',
  healthPassed = 0,
  healthTotal = 0,
}: HeroSectionProps) {
  const status = statusConfig[healthStatus];
  const StatusIcon = status.icon;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background via-background to-muted/30 p-6">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Logo and Welcome */}
        <div className="flex items-center gap-4">
          <CcsLogo size="lg" showText={false} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">CCS Config</h1>
              <Badge variant="outline" className="font-mono text-xs">
                v{version}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">Claude Code Switch Dashboard</p>
          </div>
        </div>

        {/* Right: Health Status */}
        <div className={cn('flex items-center gap-3 px-4 py-2 rounded-lg border', status.badgeBg)}>
          <StatusIcon className={cn('w-5 h-5', status.color)} />
          <div>
            <p className={cn('text-sm font-medium', status.color)}>{status.label}</p>
            {healthTotal > 0 && (
              <p className="text-xs opacity-80">
                {healthPassed}/{healthTotal} checks passed
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
