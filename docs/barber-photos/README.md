# Fotos dos profissionais — prévia antes do merge

O calendário aprovado foi mesclado na master do cliente (e0cb288). As fotos ficam nas branches feat-fotos-profissionais dos dois repositórios e não estão mescladas.

O agendamento lê barbers.avatar_url por public_barbers e mostra a foto ao lado do nome no card de escolha. Mantém layout, radio de seleção, paleta e tipografia. Foto ausente ou com erro usa avatar neutro, sem inventar identidade.

No painel do dono, Equipe → Alterar foto permite informar o link HTTPS público, visualizar, salvar ou remover a foto. É edição por URL, não upload de arquivo. O cadastro existente já aceitava URL, mas não permitia trocar depois. Não requer bucket, migration ou conta nova.

Salvar usa server action autenticada, exige owner/admin, verifica que o barbeiro pertence à loja e limita UPDATE por id + barbershop_id. Aceita HTTPS sem credenciais na URL, ou vazio para remover. Não usa service_role. A validação de UUID dos guards foi alinhada ao formato canônico aceito pelo PostgreSQL: os IDs reais 11111111.../22222222... eram rejeitados pela validação RFC estrita de Zod apesar de existirem no banco; associação e papéis continuam verificados.

Nenhuma foto real foi atribuída por conta própria. As capturas usam retrato vetorial ilustrativo somente na fixture local; as fotos reais deverão ser cadastradas no painel. Não houve escrita no Supabase real.

Teste scripts/photo-fixture.cjs + scripts/qa-barber-photos.mjs no repo dono: salvar foto pela server action, ler a mesma URL no cliente, rejeitar HTTP e remover; desktop/celular. Backend de teste em memória, sem banco real. Builds de QA usam chaves fictícias e localhost. Capturas do cliente neste diretório; capturas do dono no diretório equivalente do repo dono.

Depois do merge aprovado, use Equipe → Alterar foto → cole o link de uma imagem pública → Salvar foto. Recarregue /agendar no cliente para conferir. Se desejar remover, use Remover foto. Nenhuma modificação no Cloudflare ou deploy manual.
