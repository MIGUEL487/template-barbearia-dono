# Fotos e movimento — alteração aprovada para merge

## Foto por arquivo ou link

Em Equipe → Alterar foto, o dono pode escolher um arquivo de Downloads/galeria ou informar um link HTTPS público. JPG, PNG e WebP de até 10 MB são preparados no navegador, com dimensão máxima de 1024px e até 800 KB para envio. Há prévia, salvar e remover do perfil. Sem foto ou com falha, aparece avatar neutro.

O envio é feito por server action autenticada para Supabase Storage. Exige owner/admin e vínculo do barbeiro à loja; valida tamanho, tipo e assinatura do arquivo. O objeto recebe caminho loja/profissional/UUID único; só depois de enviar atualiza barbers.avatar_url. Se a atualização falhar, tenta remover o objeto recém-enviado. Não usa service_role. O cliente continua lendo avatar_url por public_barbers; novas fotos aparecem ao recarregar. Remover foto desvincula o perfil; não apaga arquivos antigos nem imagens externas.

**Configuração obrigatória para upload real:** no SQL Editor do MESMO Supabase, execute apenas supabase/migrations/20261030000000_barber_photo_storage.sql do repositório do dono. Cria o bucket público barber-photos, limite de 800 KB, MIME types permitidos e políticas que só deixam owner/admin gerenciar fotos de profissionais da própria loja. Não concede upload anônimo. Se um bucket com esse nome já existir, o SQL preserva a configuração existente: confira public=true, limite e MIME types antes de usar.

Não executei esse SQL nem gravei fotos no Supabase real. O fluxo por link HTTPS continua funcionando sem Storage. O bucket é público porque essas fotos são exibidas no site; use apenas fotos dos profissionais destinadas à publicação.

## Movimento

Foi lido o skill animate em /workspace/local-skills/animate/SKILL.md. O pacote local contém somente instruções, sem catálogo/assets/scripts do ambiente original. Integração feita com Motion/CSS/WAAPI já usados pelo projeto, seguindo transições curtas, dimensões estáveis, movimento reduzido e limpeza dos efeitos.

Cliente: mês entra/sai suavemente; destaque do dia desliza entre posições; botões respondem ao toque; horários aparecem com transição na troca de data. Mantidos dias fechados desabilitados e revalidação no clique. Grade com altura estável para não deslocar o conteúdo ao mudar de mês.

Dono: cards, filtros, linhas da agenda e fotos entram com fade/deslocamento leve e sequência curta; formulário de foto e mensagens têm transições; botões têm resposta ao toque. A camada global de entrada pausa quando a aba fica oculta e remove observers/animações ao desmontar. Os efeitos novos respeitam movimento reduzido. Paleta, tipografia, hero e marquee preservados.

## Verificação e limites

Build, typecheck e lint nos dois repositórios. Testes locais em desktop/celular: salvar link, rejeitar HTTP, remover, enviar arquivo real preparado no navegador e confirmar atualização do avatar_url no backend simulado. Calendário testado com dia fechado, erro de RPC, fechamento após carregar, recuperação e hold. Fluxos repetidos com movimento reduzido.

SQL aplicado duas vezes SOMENTE em PostgreSQL Docker isolado com esquema Storage de teste: owner pode inserir/apagar seu objeto; usuário sem vínculo e caminho de outra loja são recusados; anon sem permissão de gerenciamento. Isso testa regras SQL, não a configuração do projeto real.

Capturas neste diretório são fixtures, com retrato vetorial ilustrativo; não representam fotos reais de Carlos/Jeronimo. As fotos reais serão escolhidas pelo dono. Sem deploy manual ou alteração de configuração no Cloudflare.
