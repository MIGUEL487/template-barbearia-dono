# Entrega SaaS 3.1

Commits de código: `1bb0d88` (Gemini/diagnóstico) e `81c300c` (design e componentes).

Redesign de Análises, Financeiro e Raio-X preserva grafite, identidade, fontes, tokens e sidebar. O gráfico de área ganhou hierarquia central e desempenho lateral; indicadores compactos têm ícones próprios; tabelas apresentam barras proporcionais e status. Botões, seletores, expansões, modais e menu Mais compartilham linguagem de movimento, teclado/foco e reduced-motion. Histórico, relatórios, suporte, Resgate e Fila reutilizam componentes existentes/refinados.

O defeito comprovado na integração era a perda do diagnóstico: SDK e chat descartavam a categoria das exceções. Agora binding/runtime, modelo, chave recusada, permissões, cotas Google/aplicativo, rede, timeout e resposta inválida são diferenciados sem exibir secrets ou dados pessoais. Conexão Gemini oferece inspeção de metadados e teste mínimo autenticado com o mesmo SDK/schema, protegido pela cota existente.

**Não há comprovação de que a credencial real esteja ausente ou de que o Gemini esteja funcionando em produção.** Figma não foi inspecionado; o adendo descritivo foi seguido. APIs Figma/Google/Cloudflare estão bloqueadas na sessão, sem credenciais runtime vinculadas. Não afirmamos deploy confirmado ou causa externa do fallback resolvida. Para encerrar esse ponto, executar Conexão Gemini no Worker publicado e conferir código/HTTP conforme README.

Checks locais e evidências: validation.json e evidencias/. Matriz completa em ui-matrix-results.json; prints finais e menus abertos incluídos. Build Next/OpenNext e dry-run passaram, assim como regressões de gestão/agenda e notificações/som/Realtime simuladas. As fixtures não substituem um teste Google ou push no aparelho real.

Sem SQL novo, alteração de agendamentos/pagamentos/ledger ou execução de migrations. Site público e alterações locais originais preservados. Backup backup/pre-saas-3-1 aponta para 2e1a042; rollback por novos commits, sem apagar histórico nem banco. Instruções detalhadas em README.md e regra permanente em docs/COMPONENTS.md.
