# Plano de animações — antes da implementação visual

|Seção|Repertório / motor|Gatilho e duração|Custo / pausa|
|---|---|---|---|
|Hero|Players TS da referência, GSAP quickTo, sticky móvel|Destino scroll; playback 30 fps; leitura 1s do quadro final|Um decoder desktop; sem download PC no móvel; cleanup completo|
|Assinatura|Máscara por linha + foto em arco com parallax GSAP|Viewport, .8s + scrub|Transform/opacity, once|
|Ritual|Narrativa de três etapas, imagem aproxima, traço SVG|Pin GSAP, duas alturas|Sem setState por tick, desativa em movimento reduzido|
|Serviços|Filtros/layout motion, preços BRL e prévia por ponteiro|Ação / entrada .8s|Só ponteiro fino; toque expande|
|Equipe|Stagger, tilt leve de superfície|Entrada / ponteiro|Sem inventar retratos; placeholders identificados|
|História|Linha do tempo e imagem reveladas|Viewport .8s|Once, DOM visível sem JS|
|Espaço|Arco, parallax e hexágonos SVG|Scroll GSAP|Uma imagem inteira, sem fragmentação|
|Avaliações|Crossfade, estrelas e contadores|5s, só visível e aba ativa|Pausa manual e reduced motion|
|Contato|Imagem e legenda; mapa por clique|Entrada .8s / clique|Iframe ausente antes do pedido|
|CTA / rodapé|Wordmark, marquee oposto e controle persistente|Viewport / interação|No máximo duas faixas contínuas visíveis; duplicatas aria-hidden|
|Wizard|Entradas de passos/seleções, confirmação breve|Ação|Preservar handlers/hold; sem scroll JS|
|Painel|Entradas, contadores e sheets|Ação/viewport|motion/react e CSS, sem GSAP/Lenis|

`?motion=full/off`, `?lenis=off`, `?renderer=frames`. Preferência persistida; loops pausam fora de tela/aba. `$animate` lida integralmente, mas seu catálogo não veio: não inventamos IDs nem executamos scripts ausentes. A direção pedida prevalece sobre sugestões genéricas das outras skills.
