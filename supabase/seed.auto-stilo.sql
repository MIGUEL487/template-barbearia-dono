-- PROPOSTA NÃO EXECUTADA. Somente banco de DEMONSTRAÇÃO dedicado após autorização.
-- Não cria conta auth nem shop_members. Não conecta o painel sem usuário real autenticado.
-- Horários reais pendentes: nenhum working_hours é inserido.
BEGIN;
INSERT INTO barbershops (id,name,slug,phone,address,timezone)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Auto Stilo · DEMONSTRAÇÃO','auto-stilo-demo','+5535997374960','R. do Tanque, 395 – Bela Vista, Monte Sião – MG, 37580-000','America/Sao_Paulo') ON CONFLICT (id) DO NOTHING;
INSERT INTO site_settings (barbershop_id,brand_name,brand_tagline,accent_color,hero_title,hero_subtitle,deposit_percentage,cancellation_notice_hours)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Auto Stilo','DEMONSTRAÇÃO · dados de exemplo','#A78BFA','Seu estilo. Sua assinatura.','Monte Sião · MG',0,24) ON CONFLICT (barbershop_id) DO NOTHING;
INSERT INTO services (id,barbershop_id,name,description,duration_minutes,buffer_minutes,price,is_active) VALUES ('33333333-3333-4333-8333-333333333331','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Corte de assinatura','EXEMPLO — confirmar preço e duração',40,5,45,true) ON CONFLICT (id) DO NOTHING;
INSERT INTO services (id,barbershop_id,name,description,duration_minutes,buffer_minutes,price,is_active) VALUES ('33333333-3333-4333-8333-333333333332','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Ritual da barba','EXEMPLO — confirmar preço e duração',30,5,35,true) ON CONFLICT (id) DO NOTHING;
INSERT INTO services (id,barbershop_id,name,description,duration_minutes,buffer_minutes,price,is_active) VALUES ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Corte + barba','EXEMPLO — confirmar preço e duração',70,5,75,true) ON CONFLICT (id) DO NOTHING;
INSERT INTO services (id,barbershop_id,name,description,duration_minutes,buffer_minutes,price,is_active) VALUES ('33333333-3333-4333-8333-333333333334','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Sobrancelha','EXEMPLO — confirmar preço e duração',10,5,15,true) ON CONFLICT (id) DO NOTHING;
INSERT INTO barbers (id,barbershop_id,name,bio,is_active) VALUES ('22222222-2222-4222-8222-222222222221','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Profissional 01','EXEMPLO — nome a confirmar',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO barbers (id,barbershop_id,name,bio,is_active) VALUES ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Profissional 02','EXEMPLO — nome a confirmar',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO faq_items (barbershop_id,question,answer,sort_order) SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','São dados reais?','Serviços, preços e profissionais são exemplos de demonstração.',1 WHERE NOT EXISTS (SELECT 1 FROM faq_items WHERE barbershop_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND question='São dados reais?');
COMMIT;
