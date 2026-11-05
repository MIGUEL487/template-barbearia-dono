# Componentes e movimento — regra permanente Auto Stilo

Preservar tokens, fontes, grafite, logo, destaque e componentes aprovados. Hierarquia de conteúdo não exige um design system paralelo.

- Botões: `components/ui/button.tsx`, com variantes existentes, loading, disabled, foco e feedback de pressão. Sem glows ou gradientes novos arbitrários.
- Seleção: `components/admin/custom-select.tsx` ou o adaptador `components/ui/animated-select.tsx`. Listbox, teclado, typeahead, Escape/Tab, seleção confirmada e saída animada; não criar um menu instantâneo independente. O adaptador mantém um select oculto apenas para compatibilidade.
- Expansões: `components/ui/expandable.tsx`, com summary, indicador coordenado, transição de abertura e fechamento, inert/aria-hidden e região rotulada. Não inserir novos details instantâneos.
- Modais: preservar dialog nativo e foco; `components/ui/use-animated-dialog.ts` adiciona entrada/saída e deve interceptar cancel/Escape para concluir a transição.
- Tooltips: `components/ui/tooltip.tsx`, foco/mouse/Escape, atraso inicial e conteúdo seguro. Não depender exclusivamente do title nativo para os novos indicadores.
- Movimento: `use-interface-motion.ts` combina prefers-reduced-motion e preferência do aplicativo. Estados finais continuam disponíveis sem animação. Evitar transições all, grandes escalas, bloqueio de scroll e animações longas durante tarefas.
- Ao alterar dropdown, accordion, popover, submenu ou painel recolhível, testar os estados aberto **e** fechado, foco, Escape/Tab, mouse/toque e celular. Fallback nativo só quando houver razão de acessibilidade ou plataforma documentada.

Documentação não substitui QA visual: conferir screenshots e dados verdadeiros. Nunca inventar gráficos ou alegar integração de produção com base em fixture.
