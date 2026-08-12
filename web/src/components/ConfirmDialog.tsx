import { FormEvent, ReactNode, useEffect, useId, useRef } from 'react';

interface ConfirmDialogInput {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface ConfirmDialogProps {
  title: string;
  description?: ReactNode;
  input?: ConfirmDialogInput;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  input,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = input ? inputRef.current : confirmRef.current;
    target?.focus();
    if (input && inputRef.current) {
      inputRef.current.select();
    }
  }, [input]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || confirmDisabled) return;
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <form
        className="card w-full max-w-md space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="space-y-2">
          <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
          {description ? <div className="text-sm text-muted">{description}</div> : null}
        </div>

        {input ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{input.label}</span>
            <input
              ref={inputRef}
              className="input"
              value={input.value}
              onChange={(e) => input.onChange(e.target.value)}
              placeholder={input.placeholder}
              disabled={busy}
              aria-label={input.label}
            />
          </label>
        ) : null}

        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            type="submit"
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
