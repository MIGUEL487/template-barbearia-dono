# Logo sincronizada com o site do cliente

O painel do dono agora usa os mesmos arquivos de logo e favicon do cliente (`93fe0cf`): monograma AS, assinatura Auto Stilo e duas coroas roxas, sem círculo branco. Matrizes em `assets/brand/`; exportações em `public/brand/auto-stilo/`. A comparação SHA-256 de todas as matrizes e exportações passou entre os dois repositórios ([hashes](results.json)).

- Login: nova logo de 56px, sem círculo; removida a regra antiga que escondia a marca.
- Navegação: nova logo de 48px na barra lateral e no cabeçalho mobile.
- Fundos claros usam desenho preto; a variante para escuro tem desenho branco e mantém as coroas roxas. As superfícies atuais do painel são claras; o favicon acompanha o tema do navegador.
- Mesmos SVG adaptativo, PNGs, ICO e ícone Apple do cliente. Removido o `src/app/icon.png` antigo para não sobrescrever os ícones declarados nos metadados.
- Logos são servidas diretamente como arquivos locais, sem depender do otimizador de imagens ou de nova configuração no Cloudflare.

## Verificação

`npm run build:cf` (Next + OpenNext), typecheck, lint, tokens e espaçamento passaram. O build final foi refeito sem as variáveis da fixture. Nenhum código de autenticação, dados, ações, middleware ou configuração do Cloudflare foi alterado.

Playwright/Chromium em 1440×900, 1366×768 e 390×844: login e dashboard inspecionados, tamanhos 56/48px conferidos, sem recorte circular, overflow horizontal ou erros de console. Favicon SVG renderizado nos temas claro/escuro com pixels pretos/brancos, roxos e transparência verificados. Arquivos de ícone responderam HTTP 200.

O dashboard foi testado em build OpenNext local com fixture HTTP em `127.0.0.1:54329` e cookie sintético. Zero tentativas de acessar Supabase real no navegador; nenhum login ou gravação em banco real, migration ou deploy manual. As variáveis sintéticas foram passadas apenas nos comandos locais e não foram gravadas no repositório. Auth e permissões de produção permaneceram intactos.

| Tamanho | Login | Dashboard |
| --- | --- | --- |
| 1440×900 | [captura](1440-login.jpg) | [captura](1440-dashboard.jpg) |
| 1366×768 | [captura](1366-login.jpg) | [captura](1366-dashboard.jpg) |
| 390×844 | [captura](390-login.jpg) | [captura](390-dashboard.jpg) |

[Claro](marca-e-favicon-light.png) · [Escuro](marca-e-favicon-dark.png) · [Resultados completos](results.json)

`node scripts/prepare-brand.mjs` regenera as exportações a partir das matrizes locais. `scripts/qa-brand.mjs` exige preview local e fixture local para o dashboard; `REFERENCE_REPO` aponta para o checkout do cliente ao comparar os hashes.

As evidências são de Chromium local. A aba real do navegador, Safari/iOS físico e a publicação após o push não foram validados; o teste cobre a renderização do favicon e suas declarações no HTML. Nenhum segredo ou valor de produção foi usado nos testes.
