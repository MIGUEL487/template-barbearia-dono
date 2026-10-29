import Image from 'next/image';

export function AdminSkeleton(){
 return <div className="admin-skeleton" role="status" aria-label="Abrindo painel Auto Stilo">
  <Image src="/pwa/icon-192.png?v=2" alt="" width={96} height={96} unoptimized priority/>
 </div>;
}
