import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function round(v: number, digits: number) {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/** Accept hex or rgba()/rgb(); return 7-char hex for <input type="color">. */
export function toHex(color: string): string {
  if (color.startsWith('#')) {
    if (color.length === 7) return color;
    if (color.length === 4) {
      return '#' + color.slice(1).split('').map((c) => c + c).join('');
    }
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const [r, g, b] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Inline code in prose. */
export function C({ children }: { children: ReactNode }) {
  return <code className="ic">{children}</code>;
}

/** A control group in a demo's side column. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h4 className="panel-title">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="field">
        <span>{label}</span>
        <span className="val">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="field cursor-pointer">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('switch', checked && 'switch-on')}
      >
        <span className="switch-knob" />
      </button>
    </label>
  );
}

/** A labelled row of mutually exclusive options. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field flex-wrap">
      <span>{label}</span>
      <span className="flex flex-wrap justify-end -space-x-px">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn('seg', value === option && 'seg-on')}
          >
            {option}
          </button>
        ))}
      </span>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  showHex = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showHex?: boolean;
}) {
  return (
    <label className="field cursor-pointer">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {showHex && <span className="val">{toHex(value)}</span>}
        <input
          type="color"
          className="swatch"
          value={toHex(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

/** Live commentary line beneath a demo. */
export function Status({ children }: { children: ReactNode }) {
  return (
    <p className="status" role="status" aria-live="polite">
      {children}
    </p>
  );
}

/** A board, mounted like a plate in a book, with an optional caption. */
export function Plate({
  children,
  caption,
  width = '100%',
}: {
  children: ReactNode;
  caption?: ReactNode;
  width?: string;
}) {
  return (
    <figure className="m-0">
      <div className="plate flex justify-center">
        <div style={{ width, transition: 'width 0.2s var(--ease-out-quart)' }}>{children}</div>
      </div>
      {caption && <figcaption className="caption mt-2.5">{caption}</figcaption>}
    </figure>
  );
}

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the code is selectable anyway */
    }
  }, [code]);

  return (
    <div className="code-shell">
      <div className="code-head">
        <span className="code-lang">{language}</span>
        <button onClick={copy} className="code-lang hover:text-ink transition-colors">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-body">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * The two-column demo layout used by every studio: board on the left,
 * controls in a narrower right column, code spanning underneath.
 */
export function Workbench({
  board,
  controls,
  code,
}: {
  board: ReactNode;
  controls: ReactNode;
  code?: ReactNode;
}) {
  return (
    <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      {/* The board follows you down: control columns are much taller than the
          board, so without this the left column leaves a long empty gap. */}
      <div className="min-w-0 space-y-4 lg:sticky lg:top-8">{board}</div>
      <div className="min-w-0 space-y-5">{controls}</div>
      {code && <div className="min-w-0 lg:col-span-2">{code}</div>}
    </div>
  );
}
