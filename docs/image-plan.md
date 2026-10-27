# Plano de imagens e movimento

Nesta etapa usamos placeholders SVG autorais, não as fotos anexadas anteriormente, conforme pedido mais recente. Nenhuma imagem externa de estoque.

| Imagem futura | Enquadramento | Máscara/camada | Movimento |
|---|---|---|---|
| Interior / teto hexagonal | Grande angular, teto no terço superior; móvel corta laterais | Plano arquitetônico atrás do título, gradiente lateral leve | Parallax GSAP curto no wrapper; Ken Burns em camada separada, pausado fora da tela |
| Prêmio / certificado | Preservar quadro e selo sem cortar texto | Moldura editorial junto da prova social; legenda informa origem | Revelação por máscara ao entrar, sem loop sobre texto |
| Logo fornecido | Preservar proporção e área livre; pedir arquivo transparente de alta resolução | Cabeçalho e hero; sem redesenhar identidade | Reveal curto; estático em reduced-motion |
| Cortes / equipe (faltam) | Retrato 4:5, rosto e acabamento visíveis | Galeria horizontal, equipe com nomes confirmados | Scroll horizontal no desktop, swipe no celular |

Placeholder interior.svg: linhas hexagonais, plano roxo e recorte diagonal; não representa foto real. Placeholder detalhe.svg: composição abstrata de precisão; movimento somente transform/opacity. Substituir via scripts/prepare-images.mjs, manter dimensões e texto alternativo. Reduced-motion desliga parallax/loops e mantém conteúdo visível. Não animar filtro/sombra.
