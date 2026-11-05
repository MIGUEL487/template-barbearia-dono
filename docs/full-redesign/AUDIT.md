# Auditoria — redesign integral

Base: 45cbd1ba1dfaca1c79ec1863f174514ee7b6b5b9. Backup backup/pre-complete-redesign; branch feat/complete-management-redesign. A árvore original do dono com alterações locais permanece isolada no worktree original.

Rotas existentes: dashboard, agenda, clientes, servicos, equipe, financeiro, analises, raio-x, resgate, fila-de-espera, configuracoes e login. Suporte estava embutido em Configurações; ganhará rota dedicada reutilizando as mesmas perguntas. Não existem subpáginas de gestão adicionais no app router; perfis e cadastro são overlays/estados dessas rotas.

Inconsistência encontrada: dashboard/agenda/clientes/serviços/equipe/configurações montam cabeçalhos e cards separados do Workspace SaaS 3. Clientes usa cartões sem perfil consultável; modais de gestão têm implementações de foco/animação diferentes. O gráfico do dashboard também difere das Análises. A unificação deve acontecer no layout, controles e composição de cada página, preservando hooks/actions/consultas/RPCs e dados.

Acesso Figma: conector indisponível na lista de ferramentas; rede gerenciada continua restricted/enforced e sem credenciais vinculadas. A conexão anterior ao arquivo retornou CONNECT 403. Os padrões descritos pelo proprietário são referência acessível; não alegar inspeção direta dos frames.

Gemini: diagnóstico por categoria, bindings OpenNext, SDK e teste autenticado já estão em produção no código-base. A resposta real do Worker/Google ainda não foi fornecida; não presumir chave ausente/configurada incorretamente. Preservar o diagnóstico e seu limite diário. Nenhuma alteração visual deve esconder fallback ou mudar o backend para tentar corrigir credencial.
