import { Link, useRouterState } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { KeyRound, Plus, QrCode, ScrollText } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Toaster } from "sonner";
import { cn } from "@/lib/cn";
import { fingerprint, runtimeCryptoOk } from "@/lib/microproof/crypto";
import { ensureIdentity, useDb } from "@/lib/microproof/store";
import type { AgreementStatus } from "@/lib/microproof/types";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-seal text-seal-ink hover:bg-seal/90",
        ink: "bg-ink text-paper hover:bg-ink/90",
        ghost: "text-ink hover:bg-ink/5",
        line: "bg-sheet text-ink shadow-border hover:bg-paper",
        fault: "text-fault hover:bg-fault/10",
      },
      size: {
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        block: "h-12 w-full px-5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

export { buttonStyles };

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function SealMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="13.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 21.2V11.6l6 4.6 6-4.6v9.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STATUS: Record<AgreementStatus, { label: string; className: string }> = {
  DRAFT: { label: "Waiting", className: "bg-brass/10 text-brass" },
  SIGNED: { label: "Sealed", className: "bg-seal/10 text-seal" },
  DISPUTED: { label: "Disputed", className: "bg-fault/10 text-fault" },
  RESOLVED: { label: "Resolved", className: "bg-ink/5 text-ink" },
};

export function StatusPill({ status }: { status: AgreementStatus }) {
  const item = STATUS[status];
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold", item.className)}>
      {item.label}
    </span>
  );
}

export const fieldClass =
  "w-full min-h-11 rounded-xl bg-sheet px-3 text-base text-ink shadow-border placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-seal/30";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

const NAV = [
  { to: "/", label: "Ledger", icon: ScrollText, on: (path: string) => path === "/" || path.startsWith("/contract") || path.startsWith("/handshake") || path.startsWith("/bench") },
  { to: "/new", label: "New", icon: Plus, on: (path: string) => path.startsWith("/new") },
  { to: "/scan", label: "Scan", icon: QrCode, on: (path: string) => path.startsWith("/scan") },
  { to: "/identity", label: "Key", icon: KeyRound, on: (path: string) => path.startsWith("/identity") },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const db = useDb();
  const mounted = useMounted();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [cryptoOk, setCryptoOk] = useState(true);
  const [clock, setClock] = useState("");

  useEffect(() => {
    ensureIdentity();
    let live = true;
    runtimeCryptoOk()
      .then((ok) => {
        if (live) setCryptoOk(ok);
      })
      .catch(() => {
        if (live) setCryptoOk(false);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, []);

  const fp = mounted && db.identity ? fingerprint(db.identity.publicKey) : "···· ····";

  return (
    <div className="app-stage">
      <div className="app-phone">
        <div className="device-status no-print" aria-hidden>
          <span>{clock}</span>
        </div>
        <header className="app-bar no-print">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <SealMark className="size-7 shrink-0 text-seal" />
            <span className="font-serif text-lg leading-none">MicroProof</span>
          </Link>
          <Link to="/identity" className="shrink-0 rounded-full bg-sheet px-3 py-1.5 text-sm font-semibold tracking-wide tabular-nums shadow-border">
            {fp}
          </Link>
        </header>
        <main className="app-scroll">
          {cryptoOk ? null : (
            <p role="alert" className="mb-4 rounded-xl bg-fault/10 px-3 py-2 text-sm text-fault">
              This phone can't produce Ed25519 signatures, so agreements can't be sealed here.
            </p>
          )}
          {children}
        </main>
        <nav className="app-tabs no-print" aria-label="Primary">
          <ul>
            {NAV.map((item) => {
              const active = item.on(pathname);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                      active ? "text-seal" : "text-muted",
                    )}
                  >
                    <span className={cn("flex size-8 items-center justify-center rounded-full", active && "bg-seal/10")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
