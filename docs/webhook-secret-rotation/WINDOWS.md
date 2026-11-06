# Windows nativo: localizar, sincronizar e executar sem WSL

## Por que o arquivo não foi encontrado

O commit `b0e8a1c` salvou `scripts/booking-webhook-rotation.py` na branch **`fix/booking-webhook-secret-rotation`**, enviada ao GitHub. A `master` não recebeu esse arquivo. `[Errno 2]` indica que o Python não encontrou o caminho informado; a branch e o diretório do seu PC não podem ser inspecionados por este ambiente na nuvem.

Esta atualização permite Windows nativo. `create` só gera arquivos locais privados: não atualiza secrets, não faz deploy e não acessa Supabase/Cloudflare. `verify-next` continua sendo uma ação separada e explicitamente solicitada; não a execute para apenas verificar a instalação do script.

## Sincronização segura do seu projeto

Não tenho acesso ao disco `C:` do seu PC. Os comandos abaixo fazem a sincronização **quando você os executar**. Eles buscam a branch e criam um worktree separado, preservando seus arquivos modificados, index, branch atual, arquivos ignorados e trabalho não commitado no projeto original. Não usam `pull`, `reset`, `stash`, force push ou restauração por cima dos seus arquivos.

No CMD, entre no PowerShell com:

```cmd
powershell -NoProfile
```

Então cole este bloco no **PowerShell**:

```powershell
$repo = 'C:\Users\Windows\.gemini\antigravity\scratch\barbearia-template\template-barbearia-dono'
Set-Location -LiteralPath $repo

git fetch origin refs/heads/fix/booking-webhook-secret-rotation:refs/remotes/origin/fix/booking-webhook-secret-rotation
if ($LASTEXITCODE -ne 0) { throw 'Fetch falhou. Nenhum arquivo local foi sobrescrito.' }

$dest = Join-Path (Split-Path -Parent $repo) ('template-barbearia-dono-rotation-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $dest) { throw 'O destino já existe; nenhum conteúdo será sobrescrito.' }
git worktree add --detach $dest refs/remotes/origin/fix/booking-webhook-secret-rotation
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o checkout separado.' }

Set-Location -LiteralPath $dest
if (-not (Test-Path -LiteralPath '.\scripts\booking-webhook-rotation.py')) { throw 'Script não encontrado no checkout.' }
python .\scripts\booking-webhook-rotation.py create
```

Se seu Python é chamado pelo launcher `py`, substitua **somente a última linha** por:

```powershell
py -3 .\scripts\booking-webhook-rotation.py create
```

O checkout de rotação fica ao lado do original, com um sufixo de data/hora. Ele fica em detached HEAD intencionalmente; o conteúdo vem da branch remota e nenhuma branch sua é movida. O diretório original continua com suas alterações. O novo worktree não copia `.env` e outros arquivos ignorados: não os transfira para apenas gerar o segredo.

Para conferir sem executar geração:

```powershell
Test-Path -LiteralPath '.\scripts\booking-webhook-rotation.py'
git log -1 --oneline -- scripts/booking-webhook-rotation.py
python .\scripts\booking-webhook-rotation.py --help
```

## Proteção dos arquivos

No Windows, antes de gerar o segredo, o script protege a pasta vazia em `%TEMP%` com uma DACL que concede acesso apenas ao SID do usuário atual e desativa herança ampla. Confere proprietário, permissões e ausência de reparse points. Os arquivos herdam essa proteção e são verificados individualmente. Não altera ACLs da pasta do projeto ou de arquivos preexistentes e não altera políticas de execução do PowerShell.

Se não conseguir estabelecer/verificar essa proteção, falha sem prosseguir de forma insegura e remove somente a pasta temporária recém-criada. Use armazenamento local NTFS e seu próprio usuário. Não use pasta de rede, FAT/exFAT sem ACLs ou uma pasta compartilhada como alternativa desprotegida.

O valor não é impresso. A saída informa apenas a pasta privada com `next.env`, `primary.env`, `scheduler.stdin` e `metadata.json`. Guarde o caminho exibido:

```powershell
$RotationDir = 'COLE_AQUI_APENAS_O_CAMINHO_DA_PASTA_PRIVADA_EXIBIDA'
```

Não use `Get-Content` isolado, `Write-Host`, `echo`, logs de debug ou screenshots para mostrar os arquivos. Não envie o segredo ao chat.

## Sintaxe PowerShell para a rotação futura — NÃO executada automaticamente

A geração local acima **não inicia a rotação em produção**. Os comandos desta seção alteram serviços quando executados manualmente. Siga a ordem e as verificações do [procedimento principal](README.md); não promova nem remova o antigo sem os dois testes reais.

Com o receptor compatível publicado primeiro e o terminal autenticado, cadastrar somente NEXT:

```powershell
npx.cmd supabase secrets set --project-ref jrzabortkpouqkwndpcq --env-file (Join-Path $RotationDir 'next.env')
```

O probe é opcional e separado da geração, faz uma chamada autenticada intencionalmente inválida e não testa entrega de push:

```powershell
python .\scripts\booking-webhook-rotation.py verify-next --directory $RotationDir
```

Para colar no campo secreto do Database Webhook sem imprimir o valor, desative histórico do clipboard e use:

```powershell
Get-Content -LiteralPath (Join-Path $RotationDir 'scheduler.stdin') -Raw | Set-Clipboard
```

Depois de colar, limpe o clipboard atual com `Set-Clipboard -Value ' '`. Preserve os outros campos do webhook.

Para alimentar o CLI do **Worker existente**, o PowerShell usa pipeline, não o redirecionamento `<` do CMD/Bash:

```powershell
Get-Content -LiteralPath (Join-Path $RotationDir 'scheduler.stdin') -Raw | npx.cmd wrangler secret put BOOKING_WEBHOOK_SECRET --config .\workers\raiox-scheduler\wrangler.jsonc
```

`npx.cmd` evita depender da execução de `npx.ps1` pela política de scripts. Não precisa de WSL, `chmod` nem `-ExecutionPolicy Bypass`.

## Validação desta correção

Os testes Python verificam permissões POSIX reais, arquivos consistentes, ausência de segredo na saída, nenhuma rede/CLI durante `create`, falha antes da geração quando a ACL é negada e construção segura do comando PowerShell com caminhos contendo espaços. Os testes locais Linux simulam a integração Windows. A versão corrigida também **passou nos runners Windows nativos com Python 3.12 e 3.13**, incluindo a validação real de ACLs e criação dos arquivos. [Execução confirmada](https://github.com/MIGUEL487/template-barbearia-dono/actions/runs/42211123415), código `8e5dbae`. O PC do proprietário não é acessível daqui. O próprio script faz a verificação real das ACLs quando rodar no Windows e se recusa a continuar em caso de falha. Nenhum secret de produção foi atualizado nesta correção.

## Se aparecer `Windows ACL verification failed`

A mensagem antiga era genérica: ela não comprova que o disco seja incompatível ou que falte ser administrador. A atualização aplica ACL também a cada arquivo ainda vazio e retorna somente etapas/códigos seguros. A causa específica na sua máquina precisa do diagnóstico nativo.

No worktree de rotação já criado, atualize com fast-forward (não sobrescreve modificações conflitantes):

```powershell
git fetch origin refs/heads/fix/booking-webhook-secret-rotation
if ($LASTEXITCODE -ne 0) { throw 'Fetch falhou.' }
git merge --ff-only FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw 'Atualização interrompida; preserve suas alterações locais.' }
python .\scripts\booking-webhook-rotation.py diagnose-access
```

`diagnose-access` só usa uma pasta temporária nova e arquivo vazio, removidos ao terminar. Não gera secret e não acessa os provedores. Se passar, execute `python .\scripts\booking-webhook-rotation.py create`. Se falhar, informe somente a linha `Windows ACL: stage=...; reason=...; exception=...; hresult=...`. Não envie arquivos `.env`, conteúdo do segredo, ACLs completas ou capturas de campos secretos. Não use permissões amplas nem bypass para fazer a verificação passar.

### Acesso negado em `stage=set_acl` / `0x80070005`

O código informado confirma que a escrita da ACL foi recusada; não identifica sozinho a política ou privilégio específico. A versão anterior incluía troca de proprietário. A correção carrega **somente `AccessControlSections.Access`**, mantém owner/group/auditoria intactos e persiste apenas a DACL modificada pela API .NET do arquivo/diretório. Regras herdadas e explícitas anteriores são substituídas por acesso do usuário atual; a verificação posterior continua obrigatória. Não é necessário executar `takeown`, dar acesso a Everyone ou alterar políticas globais para tentar passar no teste.

Uma recusa nessa operação aparece como `stage=set_dacl`; nesse caso a restrição real a WRITE_DAC continua bloqueando a geração, sem fallback inseguro. O workflow `Windows rotation helper` verifica a ACL nativamente em runners Windows com Python 3.12 e 3.13, usando apenas fixtures públicas, sem qualquer rotação em produção.

O proprietário pode ser o usuário atual, SYSTEM ou Administradores locais (principais privilegiados padrão do Windows). Essa aceitação não lhes concede ACEs: toda regra Allow da DACL precisa continuar referindo-se somente ao usuário atual. Um proprietário não privilegiado diferente continua sendo rejeitado. O script não tenta trocar owner/group nem requisita privilégios de auditoria.
