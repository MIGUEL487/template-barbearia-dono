# Portabilidade — Template-padaria @ 9e3ee14

|Referência|Next/React|
|---|---|
|app/lib/{desktop,video,frame}-player.ts|src/lib/cinematic/ (mesma lógica, caminho do manifesto adaptado)|
|app/plugins/scroll.client.ts|src/lib/cinematic/scroll-engine.ts (factory + dispose em vez de plugin Vue)|
|Hero.vue|src/components/landing/hero.tsx (refs/effect; máquina de estados de leitura preservada)|
|Story.vue / BreadPortrait.vue|src/components/landing/editorial.tsx + motion.tsx|
|MotionImage / ToneSection|ShopImage + CSS claro com arco/degradês|
|NumberTicker / BlurReveal / ShimmerButton / Marquee|motion/react + camada de interação e editorial|
|encode-hero-video.mjs / replace-pc-frames.mjs|scripts/ homônimos; FFmpeg local, nunca no build|

Desvios: frames recebidos são 183 Full HD, não os 150 da referência; mobile é recorte derivado 720×1280. Nenhum arquivo da padaria é publicado como foto da barbearia. Fontes autohospedadas mantidas (Fraunces + Manrope), somando itálico. Contratos e Cloudflare permanecem nos projetos Next.

Padrão de transporte: frames, pois GET Range local retornou 200 (arquivo completo), não 206. `?renderer=video` permite medir o código nativo preservado. Além dos imports, o wrapper do player muda essa seleção padrão; não finge suporte de Range.

Hero React mantém bloqueio, espera pelo frame real e pausa de leitura da referência. Ao girar, conserva a mídia e atualiza geometria, em vez de recriar o player no listener de orientação. A saída de segurança foi fortalecida para revelar texto e CTAs mesmo se o frame final não chegar. Provider de preferência substitui useState/watch do Nuxt, com teardown por effect. Motion-v foi substituído por motion/react. Não há Vue no bundle.

Mídia e encoders não são dependência de build. `scripts/prepare-hero.mjs` é o importador adaptado ao ZIP efetivo e sincroniza manifesto público e importado em Next, ao contrário do importador antigo que só escreve o manifesto público.

Viewport: dvh/lvh com fallback em variáveis de pixels medidos. Resize atualiza apenas geometria; altura estável acompanha expansão de barras e reinicia ao girar, sem remontar canvas/vídeo. Pausa de CSS na aba oculta é compartilhada pelo provider, inclusive no painel sem GSAP.
