# Entrega — design-branco

## Pronto

- Branch `design-branco` criada de `redesign-black` nos dois repositórios, com commits por escopo. Next/React mantido; nenhum checkout de main/master alterado.
- Paleta branca, serif Fraunces normal/itálica e sans Manrope autohospedadas; tokens, hash e escala de 8 px sincronizados.
- Hero portado de Template-padaria `9e3ee14`: players de PC, móvel e canvas sequencial; poster imediato; texto posterior; pausa total de 1 s desde o quadro final, bloqueio de impulso e saída de segurança.
- 183 JPEGs Full HD recebidos, variantes móveis derivadas 720×1280, vídeos ida/volta prontos. Nada de FFmpeg no Cloudflare. Importador mede e sincroniza manifestos reais.
- Assinatura, ritual fixado de três etapas, serviços filtráveis com preço/ação, equipe demonstrativa, história, galeria/arco/hexágonos, avaliações, contato/mapa por ação, CTA, marquee e rodapé. Filtros, expansão, preseleção demo, controles e preferência persistente funcionam.
- Wizard e gerenciamento mantidos, com nova apresentação e confirmação breve. Hold, RPCs e lógica de autenticação preservados; confete respeita a preferência de movimento. Painel branco com navegação responsiva e animação contida, sem GSAP/Lenis.
- Marca d'água ajustada a fundos claros/escuros; flag e noindex preservados. Metadata, imagem OG, favicon e sitemap configurados. `_headers` mantém hashes de script, limita linha a 2.000 caracteres e permite blob de imagem apenas pelo fallback.

## Verificação

Typecheck, lint, build/export cliente e build:cf dono passaram. Tokens e espaçamento passaram em ambos; npm audit: zero vulnerabilidades conhecidas na consulta. Testes de assinatura de pagamento existentes passaram, sem tocar banco. Diff das funções/rotas de backend e SQL contra redesign-black permaneceu vazio.

Playwright de produção local: cinco tamanhos públicos, rolagem até o rodapé com CPU 4×; metas finais de frame passaram, com registro bruto do ensaio anterior preservado em PERF.md. Pausa de aproximadamente 1 segundo medida em todos os tamanhos. Agendamento/cancelamento demo completos em celular/desktop, filtro e preseleção, mapa sob demanda, persistência de preferência, vídeo nativo ida/volta, erro/fallback, início antes de carregar e liberação por falha. Resize conserva a identidade do canvas e cobre a viewport; gestos de toque via CDP foram verificados nos dois sentidos, em scroll sticky nativo. Painel: 35 combinações com fixture sintética local. Axe: zero violações nas rotas examinadas após correções, inclusive login sem configuração; resultados inconclusivos não equivalem a aprovação automática nem certificação.

Evidências em `docs/design-branco/`: performance.json / performance-cliente.json, functional.json / functional-cliente.json, accessibility-*.json, screenshots antes/depois e QA. `PERF.md`, `PORTING.md`, `animation-plan.md`, `CUSTOMIZE.md` e `DEPLOY-CLOUDFLARE.md` descrevem decisões, portabilidade e comandos.

## O que não foi possível / depende de você

- Range no Workers preview retornou **200**, não 206. Por isso **frames são o padrão**; `?renderer=video` mantém a engenharia nativa disponível para diagnóstico. Confirmar 206 na URL publicada antes de promovê-la a padrão. Nenhum deploy manual foi executado.
- Não houve teste em aparelho físico/Moto Z3 Play nem confirmação de produção; resize/toque são emulação local. Não foi medido diretamente o número de decodificadores na GPU: o PC foi verificado com um elemento de vídeo e estatísticas do navegador.
- Não foi recebido conjunto móvel independente: o material atual é recorte derivado. O logo e as fotos enviados já foram usados. Faltam fachada limpa, retratos/identificação da equipe, história real, horários completos, serviços/preços confirmados e Instagram. Nenhum dado comercial foi inventado fora dos exemplos identificados.
- A skill animate local contém instruções, sem o catálogo/servidor original; aplicamos seus princípios, sem inventar IDs ou validação desses scripts. imagegen-frontend-web local é aviso de migração; revisão visual foi feita sobre os arquivos fornecidos, sem fotos sintéticas novas.
- Sem migrations, seeds executados ou escrita em Supabase real. Fixtures temporárias de desenvolvimento removidas; build do dono reconstruído sem elas.
