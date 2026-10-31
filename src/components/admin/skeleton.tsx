import Image from "next/image";

export function AdminSkeleton() {
  return (
    <div
      className="admin-skeleton flex flex-col items-center justify-center p-12 min-h-[280px] w-full gap-4"
      role="status"
      aria-label="Carregando dados da Auto Stilo"
    >
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl animate-pulse" />
        <Image
          src="/brand/auto-stilo/logo-on-dark.png"
          alt="Auto Stilo"
          width={72}
          height={72}
          unoptimized
          priority
          className="relative z-10 drop-shadow-[0_0_16px_rgba(124,58,237,0.4)] animate-pulse"
        />
      </div>
      <span className="text-xs font-medium text-text-muted tracking-wide animate-pulse">
        Carregando informações...
      </span>
    </div>
  );
}
