import Image from 'next/image';
export function AdminSkeleton(){return <div className="admin-skeleton flex items-center justify-center p-12 min-h-[280px] w-full" role="status" aria-label="Carregando dados da Auto Stilo"><Image src="/brand/auto-stilo/logo-on-dark.png" alt="" width={96} height={96} unoptimized priority/></div>}
