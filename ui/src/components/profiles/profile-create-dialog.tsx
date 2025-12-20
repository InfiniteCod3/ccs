/**
 * Profile Create Dialog Component
 * Modal dialog with tabbed interface for creating new API profiles
 * Includes Quick Start templates and advanced model configuration
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCreateProfile } from '@/hooks/use-profiles';
import { Loader2, Plus, AlertTriangle, Info, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Must start with letter, only letters/numbers/.-_'),
  baseUrl: z.string().url('Invalid URL format'),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().optional(),
  opusModel: z.string().optional(),
  sonnetModel: z.string().optional(),
  haikuModel: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProfileCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (name: string) => void;
}

// Common URL mistakes to warn about
const PROBLEMATIC_PATHS = ['/chat/completions', '/v1/messages', '/messages', '/completions'];

export function ProfileCreateDialog({ open, onOpenChange, onSuccess }: ProfileCreateDialogProps) {
  const createMutation = useCreateProfile();
  const [activeTab, setActiveTab] = useState('basic');
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      baseUrl: '',
      apiKey: '',
      model: '',
      opusModel: '',
      sonnetModel: '',
      haikuModel: '',
    },
  });

  const baseUrlValue = useWatch({ control, name: 'baseUrl' });

  // Reset form when dialog opens

  useEffect(() => {
    if (open) {
      reset();
      setActiveTab('basic');
      setUrlWarning(null);
      setShowApiKey(false);
    }
  }, [open, reset]);

  // Check for common URL mistakes

  useEffect(() => {
    if (baseUrlValue) {
      const lowerUrl = baseUrlValue.toLowerCase();
      for (const path of PROBLEMATIC_PATHS) {
        if (lowerUrl.endsWith(path)) {
          const suggestedUrl = baseUrlValue.replace(new RegExp(path + '$', 'i'), '');
          setUrlWarning(
            `URL ends with "${path}" - Claude appends this automatically. You likely want: ${suggestedUrl}`
          );
          return;
        }
      }
    }
    setUrlWarning(null);
  }, [baseUrlValue]);

  const onSubmit = async (data: FormData) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success(`Profile "${data.name}" created`);
      onSuccess(data.name);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create profile');
    }
  };

  const hasBasicErrors = !!errors.name || !!errors.baseUrl || !!errors.apiKey;
  const hasModelErrors =
    !!errors.model || !!errors.opusModel || !!errors.sonnetModel || !!errors.haikuModel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create API Profile
          </DialogTitle>
          <DialogDescription>Configure a custom API endpoint for Claude Code.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic" className="relative">
                  Basic Information
                  {hasBasicErrors && (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="models" className="relative">
                  Model Configuration
                  {hasModelErrors && (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[60vh]">
              <TabsContent value="basic" className="p-6 space-y-6 mt-0">
                <div className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name">
                      Profile Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="my-api"
                      className="font-mono"
                    />
                    {errors.name ? (
                      <p className="text-xs text-destructive">{errors.name.message}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Used in CLI:{' '}
                        <code className="bg-muted px-1 rounded text-[10px]">
                          ccs my-api "prompt"
                        </code>
                      </p>
                    )}
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <Label htmlFor="baseUrl">
                      API Base URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="baseUrl"
                      {...register('baseUrl')}
                      placeholder="https://api.example.com/v1"
                    />
                    {errors.baseUrl ? (
                      <p className="text-xs text-destructive">{errors.baseUrl.message}</p>
                    ) : urlWarning ? (
                      <div className="flex items-start gap-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{urlWarning}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        The endpoint that accepts OpenAI-compatible and Anthropic requests
                      </p>
                    )}
                  </div>

                  {/* API Key */}
                  <div className="space-y-1.5">
                    <Label htmlFor="apiKey">
                      API Key <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? 'text' : 'password'}
                        {...register('apiKey')}
                        placeholder="sk-..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowApiKey(!showApiKey)}
                        tabIndex={-1}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">Toggle API key visibility</span>
                      </Button>
                    </div>
                    {errors.apiKey && (
                      <p className="text-xs text-destructive">{errors.apiKey.message}</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="models" className="p-6 mt-0 space-y-6">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 rounded-md text-sm border border-blue-100 dark:border-blue-900/30">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Model Mapping</p>
                    <p className="text-xs opacity-90">
                      Claude Code requests specific model tiers (Opus/Sonnet/Haiku). Map these tiers
                      to the specific models supported by your API provider.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="model">
                      Default Model
                      <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                        ANTHROPIC_MODEL
                      </Badge>
                    </Label>
                    <Input
                      id="model"
                      {...register('model')}
                      placeholder={DEFAULT_MODEL}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Fallback model if no specific tier is requested
                    </p>
                  </div>

                  <div className="grid gap-4 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label htmlFor="sonnetModel" className="text-sm">
                        Sonnet Mapping (Primary)
                        <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                          DEFAULT_SONNET
                        </Badge>
                      </Label>
                      <Input
                        id="sonnetModel"
                        {...register('sonnetModel')}
                        placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                        className="font-mono text-sm h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="opusModel" className="text-sm">
                        Opus Mapping (Complex Tasks)
                        <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                          DEFAULT_OPUS
                        </Badge>
                      </Label>
                      <Input
                        id="opusModel"
                        {...register('opusModel')}
                        placeholder="e.g. o1-preview, claude-3-opus"
                        className="font-mono text-sm h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="haikuModel" className="text-sm">
                        Haiku Mapping (Fast Tasks)
                        <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                          DEFAULT_HAIKU
                        </Badge>
                      </Label>
                      <Input
                        id="haikuModel"
                        {...register('haikuModel')}
                        placeholder="e.g. gpt-4o-mini, claude-3-haiku"
                        className="font-mono text-sm h-9"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>

            <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className={cn(createMutation.isPending && 'opacity-80')}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Profile
                  </>
                )}
              </Button>
            </DialogFooter>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}
