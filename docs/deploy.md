# Deploy do cliente web

O front é servido por um container Nginx que também repassa `/api/` e o WebSocket para a API.
Para o navegador, front e API ficam na mesma origem — não há CORS nem `Origin` para liberar no
backend. **Uma imagem serve os dois ambientes**; o que muda é a variável `API_UPSTREAM`.

Imagem: `ghcr.io/insightf-ai/insight-flow-web`, com as tags do SHA do commit e `latest`.

## Ambientes

| | Homologação | Produção |
|---|---|---|
| Domínio | `hom-insight.agilesoftware.net.br` | `insight.agilesoftware.net.br` |
| Host | VM da Azure (`vm-lab`) | VPS da Hostinger |
| `API_UPSTREAM` | `https://hom-api-insight.agilesoftware.net.br` | `https://api-insight.agilesoftware.net.br` |
| Proxy | Traefik da VM: rede `proxy`, entrypoint `websecure`, certresolver `le` | Traefik do Coolify: rede `coolify`, entrypoint `https`, certresolver `letsencrypt` |
| Compose | `deploy/docker-compose.yml` | `deploy/docker-compose.prod.yml` |
| Pasta na máquina | `~/apps/insightflow/web` | `~/apps/insightflow/web` |
| Quando sobe | todo push na main, depois do CI | só por tag `vX.Y.Z` ou `Run workflow` com o SHA |

## Variáveis

Nenhuma é segredo e nenhuma entra no build: o código usa o caminho relativo `/api/v1` e, sem
`VITE_WS_URL`, monta a URL do WebSocket a partir do endereço da página.

| Variável | Onde vive | Para quê |
|---|---|---|
| `TAG` | exportada pelo CD na sessão SSH | SHA da imagem a subir (sem ela, `latest`) |
| `API_UPSTREAM` | exportada pelo CD; padrão no compose | raiz da API que o Nginx repassa, sem barra no fim |
| `WEB_DOMINIO` | exportada pelo CD; padrão no compose | domínio na regra `Host(...)` do Traefik |
| `VITE_API_URL` | só no `.env` local | destino do proxy do `npm run dev` |

Os dois composes já têm valor padrão para `API_UPSTREAM` e `WEB_DOMINIO`, então um
`docker compose up -d` feito à mão na máquina sobe o ambiente certo sem nenhum `.env`. Para
sobrepor, crie um `.env` ao lado do compose — ele tem prioridade sobre o padrão.

## Secrets no repositório

| Secret | Usado por | Chave SSH |
|---|---|---|
| `VM_HOST`, `VM_USER`, `VM_SSH_KEY` | deploy de homologação | a mesma chave de deploy que o backend usa na VM da Azure |
| `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY` | deploy de produção | a mesma chave de deploy que o backend usa na Hostinger |

O acesso ao GHCR usa o `GITHUB_TOKEN` do próprio workflow, por stdin — não há secret de registro.

## Subir produção

Produção nunca builda imagem nova: ela reaproveita a que a homologação publicou. O job confere
que quem disparou é `Vinicius11s`, que o SHA tem 40 hexadecimais e que ele é ancestral da main, e
que a imagem existe no GHCR.

```bash
# no seu PC
git tag v0.1.0 <sha-ja-validado-em-homologacao>
git push origin v0.1.0
```

Ou em **Actions → CD → Run workflow**, informando o SHA em `image_sha`.

## Rollback (reversão)

A imagem de cada commit continua no GHCR, então reverter é subir a tag de um SHA anterior.

Pelo pipeline, em **Actions → CD → Run workflow** com o SHA antigo em `image_sha`.

Na mão, **na VM ou na VPS**:

```bash
cd ~/apps/insightflow/web
export TAG=<sha-anterior>
docker compose pull
docker compose up -d --force-recreate --wait
```

Para conferir qual versão está no ar:

```bash
docker inspect --format '{{index .Config.Image}}' insightflow-web
```

## Verificações rápidas

```bash
curl -fsS https://hom-insight.agilesoftware.net.br/healthz
curl -fsS https://hom-insight.agilesoftware.net.br/api/v1/ativos/buscar?termo=PETR -o /dev/null -w '%{http_code}\n'
```

O segundo deve devolver `401` (a rota exige autenticação): é a prova de que o proxy chega à API.
O smoke test do CD também faz o aperto de mão (handshake) do WebSocket e espera `101`.
