import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'

export type OpenCodeSetupResult = 'saved' | 'skipped'

type Props = {
  onDone: (result: OpenCodeSetupResult) => void
}

export function OpenCodeSetup({ onDone }: Props): React.JSX.Element {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSave = useCallback(async () => {
    if (!key.trim()) return
    setStatus('saving')
    try {
      const result = await window.api.guiying.saveOpenCodeKey(key)
      if (result.success) {
        setStatus('done')
        setMessage(result.message)
        setTimeout(() => onDone('saved'), 1500)
      } else {
        setStatus('error')
        setMessage(result.message)
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err?.message || '保存失败，请重试')
    }
  }, [key, onDone])

  const handleSkip = useCallback(() => {
    onDone('skipped')
  }, [onDone])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold">guiying</span>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">
          配置 OpenCodeGo
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          输入你的 OpenCodeGo API key（以 <code>sk-</code> 开头），
          验证通过后即可使用 Pi agent。
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="opencode-key">API Key</Label>
          <Input
            id="opencode-key"
            type="password"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              if (status === 'error') setStatus('idle')
            }}
            disabled={status === 'saving' || status === 'done'}
            className="font-mono text-sm"
          />
        </div>

        {status === 'error' && (
          <p className="text-sm text-destructive">{message}</p>
        )}
        {status === 'done' && (
          <p className="text-sm text-green-600">{message}</p>
        )}
        {status === 'saving' && (
          <p className="text-sm text-muted-foreground">正在验证...</p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleSkip} disabled={status === 'saving'}>
          跳过，稍后配置
        </Button>
        <Button onClick={handleSave} disabled={!key.trim() || status === 'saving' || status === 'done'}>
          验证并保存
        </Button>
      </div>
    </div>
  )
}
