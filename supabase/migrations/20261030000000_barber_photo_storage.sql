-- Proposta não aplicada. Execute no SQL Editor para habilitar envio de fotos.
-- Bucket público contém somente fotos de profissionais; nunca documentos pessoais.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('barber-photos','barber-photos',true,819200,ARRAY['image/webp','image/jpeg','image/png'])
ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.can_manage_barber_photo(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.barbers b JOIN public.shop_members m ON m.barbershop_id=b.barbershop_id
 WHERE m.user_id=auth.uid() AND m.role::text IN ('owner','admin')
 AND b.barbershop_id::text=split_part(p_path,'/',1) AND b.id::text=split_part(p_path,'/',2));
$$;
REVOKE ALL ON FUNCTION public.can_manage_barber_photo(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_barber_photo(text) TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='barber_photos_upload') THEN
  CREATE POLICY barber_photos_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='barber-photos' AND public.can_manage_barber_photo(name));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='barber_photos_remove') THEN
  CREATE POLICY barber_photos_remove ON storage.objects FOR DELETE TO authenticated
  USING(bucket_id='barber-photos' AND public.can_manage_barber_photo(name));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='barber_photos_read') THEN
  CREATE POLICY barber_photos_read ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='barber-photos' AND public.can_manage_barber_photo(name));
 END IF;
END $$;
