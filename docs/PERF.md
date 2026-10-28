# Desempenho — medição final em produção local

Next 15.5.28, export estático servido por Wrangler/Workerd local. Chromium headless, CPU 4× via CDP durante rolagem real com mouse.wheel. Sem throttling de rede; fontes locais e placeholders SVG leves. O LCP aqui é tempo de carregamento LOCAL, não previsão de 4G, score Lighthouse ou medição de aparelho físico.

Correções observadas e verificadas: wordmark sem quebra durante troca de fonte, dimensões reservadas das imagens, contadores com largura reservada, loops pausados fora da viewport. CLS foi novamente medido desde a navegação, sem excluir a fase de carregamento das fontes.

| Viewport | Frames | Mediana ms | p95 ms | Máximo ms | LCP local ms | CLS |
|---|---:|---:|---:|---:|---:|---:|
| 360×800 | 257 | 16.7 | 16.8 | 16.8 | 204 | 0.0000 |
| 390×844 | 249 | 16.7 | 16.8 | 16.8 | 152 | 0.0000 |
| 768×1024 | 229 | 16.7 | 16.8 | 16.8 | 152 | 0.0000 |
| 1024×768 | 270 | 16.7 | 16.7 | 16.8 | 160 | 0.0000 |
| 1440×900 | 305 | 16.7 | 16.8 | 16.8 | 160 | 0.0000 |
| 844×390 | 253 | 16.7 | 16.7 | 16.8 | 160 | 0.0000 |
| 800×360 | 237 | 16.7 | 16.8 | 16.8 | 144 | 0.0000 |

Nesta execução: mediana ≤17ms, p95 ≤34ms, nenhum frame >50ms. CLS zero em todos os formatos. LCP local abaixo de 2,5s. São resultados desta máquina e desta versão com placeholders, não garantia para qualquer dispositivo. Remeça com fotos finais, rede móvel e aparelho real.

Cada viewport completou wizard demo e consulta/cancelamento simulado, sem chamada a Supabase. Testes de foco, menu móvel e reduced-motion passaram; nenhuma página apresentou overflow ou erro JS. Detalhes brutos e capturas em docs/qa/results.json e docs/qa/.

Painel: 35 combinações (7 telas × 360/390/768/1024/1440), com HTTP e autenticação sintéticos locais. Sem erro JS ou overflow; isso verifica UI e runtime, não desempenho nem integridade de um banco real. Não foi feita medição de FPS do painel com dados de produção.


## Design branco — produção local

Chromium emulado, Workers preview, CPU 4×. Dimensões 360×640, 390×844, 768×1024, 1024×768 e 1440×900. Rolagem por wheel até o rodapé, atravessando a espera do hero e o ritual fixado; não apenas scrollTo final. Transporte padrão de frames preserva os 183 índices em sequência. Resultados em `docs/design-branco/performance.json` no cliente.

Mediana 16,7 ms; p95 até 16,8 ms; o resultado final deve ser lido no JSON, incluindo máximos por largura. Pausa observada de aproximadamente 1 segundo entre a apresentação do último quadro e liberação, incluindo entrada do texto. Os testes não equivalem a aparelho físico, rede móvel real ou produção publicada. MP4 nativo foi verificado à parte com `?renderer=video`: ida/volta, 183 quadros apresentados na ida, um vídeo no PC e nenhum seek/troca involuntária na descida registrado nas estatísticas.

Sem erro de console/hidratação ou overflow nos caminhos normais. As falhas de mídia são deliberadas nos ensaios de fallback. Mapas mantêm espaço reservado e só são carregados por ação.

Correção de método: um ensaio anterior amostrava RAF também durante a captura da imagem inicial e registrou um outlier de 116,7 ms em 1024 px. Esse bruto foi preservado em `performance-with-capture.json` no cliente; não é ocultado nem tratado como aprovação. O ensaio final captura primeiro e só então inicia a amostragem da rolagem, conforme o protocolo original do projeto.

Resultado final, amostragem apenas durante scroll: todas as metas passaram.

|Largura|Mediana|p95|Máximo|Pausa final|
|---|---|---|---|---|
|360 px|16.7 ms|16.7 ms|16.8 ms|999.2 ms|
|390 px|16.7 ms|16.7 ms|16.8 ms|999.0 ms|
|768 px|16.7 ms|16.7 ms|16.8 ms|1001.7 ms|
|1024 px|16.7 ms|16.7 ms|16.8 ms|1011.7 ms|
|1440 px|16.7 ms|16.7 ms|16.8 ms|998.9 ms|
