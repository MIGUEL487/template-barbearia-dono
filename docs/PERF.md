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
