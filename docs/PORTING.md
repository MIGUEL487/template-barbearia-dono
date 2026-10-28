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
