import React from "react";

type Option = { label: string; value: string };

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  title,
  subtitle,
  actions,
  className,
  children,
}: React.PropsWithChildren<{
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}>) {
  return (
    <section className={cn("rounded-xl border border-white/10 bg-black/30 p-4 shadow-sm", className)}>
      {(title || subtitle || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title ? <h3 className="text-base font-semibold text-white">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function SectionCard(
  props: React.ComponentProps<typeof Card>,
) {
  return <Card {...props} />;
}

export function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="text-center">
      <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </Card>
  );
}

export function Badge({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Pill(props: React.ComponentProps<typeof Badge>) {
  return <Badge {...props} />;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-cyan-500 text-black hover:bg-cyan-400",
    secondary: "bg-white/10 text-white hover:bg-white/20",
    danger: "bg-red-500 text-white hover:bg-red-400",
    ghost: "bg-transparent text-white hover:bg-white/10 border border-white/20",
  };
  return (
    <button
      {...props}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant={props.variant ?? "primary"} />;
}

export function SecondaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant={props.variant ?? "secondary"} />;
}

export function SubmitButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="submit" {...props}>
      {children}
    </Button>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ label, className, ...props }: InputProps) {
  const field = (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300",
        className,
      )}
    />
  );
  if (!label) return field;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-white">{label}</span>
      {field}
    </label>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Textarea({ label, className, ...props }: TextareaProps) {
  const field = (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300",
        className,
      )}
    />
  );
  if (!label) return field;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-white">{label}</span>
      {field}
    </label>
  );
}

export function TextArea(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea {...props} />;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options?: Option[];
};

export function Select({ label, className, children, options, ...props }: SelectProps) {
  const field = (
    <select
      {...props}
      className={cn(
        "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300",
        className,
      )}
    >
      {options
        ? options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        : children}
    </select>
  );
  if (!label) return field;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-white">{label}</span>
      {field}
    </label>
  );
}

export function Label({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...props} className={cn("text-sm font-medium text-white", className)}>
      {children}
    </label>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  children?: React.ReactNode;
  multiline?: boolean;
  select?: boolean;
  options?: Option[];
  containerClassName?: string;
};

export function Field({
  label,
  children,
  multiline,
  select,
  options,
  className,
  containerClassName,
  ...props
}: FieldProps) {
  let content = children;

  if (!content) {
    if (select) {
      content = (
        <Select className={className} options={options} {...(props as React.ComponentProps<typeof Select>)} />
      );
    } else if (multiline) {
      content = (
        <Textarea className={className} {...(props as React.ComponentProps<typeof Textarea>)} />
      );
    } else {
      content = <Input className={className} {...props} />;
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", containerClassName)}>
      {label ? <Label>{label}</Label> : null}
      {content}
    </div>
  );
}

export function Grid({
  cols = 2,
  className,
  children,
}: React.PropsWithChildren<{ cols?: 2 | 3 | 4; className?: string }>) {
  const colClass = cols === 2 ? "md:grid-cols-2" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
  return <div className={cn("grid gap-3", colClass, className)}>{children}</div>;
}

export function Stack({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
    </div>
  );
}

export function Page({
  title,
  subtitle,
  actions,
  children,
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((head) => (
              <th key={head} className="px-2 py-2 text-left font-medium text-white/70">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-white/5">
              {row.map((cell, i) => (
                <td key={`${index}-${i}`} className="px-2 py-2 text-white/90">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle?: string;
  description?: string;
}) {
  return (
    <Card className="text-center">
      <p className="font-semibold text-white">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-white/70">{subtitle}</p> : null}
      {description ? <p className="mt-1 text-sm text-white/70">{description}</p> : null}
    </Card>
  );
}

export function PageShell({ children }: React.PropsWithChildren) {
  return <div className="space-y-8">{children}</div>;
}
