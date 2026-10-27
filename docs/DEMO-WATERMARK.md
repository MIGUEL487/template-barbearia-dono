# Marca d’água de demonstração

Um interruptor: `NEXT_PUBLIC_DEMO_WATERMARK=true`. Texto em `NEXT_PUBLIC_WATERMARK_TEXT="DEMONSTRAÇÃO · SUA MARCA"`; contato opcional em `NEXT_PUBLIC_WATERMARK_CONTACT`. Não há contato inventado. Os campos são públicos, nunca coloque segredo neles.

Em Cloudflare Workers Builds, configurar como **Build variables nos dois projetos**. As variáveis NEXT_PUBLIC são compiladas: editar exige novo build e novo deploy. O interruptor false/ausente não renderiza padrão, selo, texto sobre fotos ou linha da marca no rodapé. O indicador de dados de exemplo é separado: desligar a marca não torna os dados reais.

Ativo: padrão SVG diagonal sem interação, selo discreto, linha no rodapé, selo DEMO no cabeçalho e confirmação, texto nas ilustrações principais do cliente. Metadata e robots do cliente bloqueiam indexação, e o build escreve X-Robots-Tag no _headers. O painel privado é sempre não indexável.

## Entrega após a venda
- Confirmar identidade, domínio, telefone, endereço, horários completos e Instagram.
- Trocar preços, durações, equipe e FAQ de exemplo. Aplicar fotos reais via prepare-images.
- Configurar Supabase demo/produção separadamente, revisar RLS e testar login/RPCs.
- Trocar NEXT_PUBLIC_DEMO_MODE para false, desligar a marca e rebuildar/republicar ambos.
- Conferir HTML, robots.txt, _headers e ausência de overlays; conferir indexação apenas do site público.
- Validar pagamentos de sandbox e idempotência antes de aceitar pagamentos reais.
