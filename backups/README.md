# Backups da tabela `assessments`

Gerados diariamente por `.github/workflows/backup-assessments.yml`.

O arquivo `assessments.json.gz.enc` está **criptografado com AES-256** porque este
repositório é público e os diagnósticos contêm dados pessoais de leads (nome,
e-mail, telefone, cargo). A senha fica no secret `BACKUP_PASSPHRASE` do repositório
— quem não a tiver não abre o arquivo.

O commit só acontece quando os dados realmente mudam (a comparação é feita sobre o
sha256 do JSON em claro, guardado em `CHECKSUM`). Dias sem diagnóstico novo não
geram commit.

## Restaurar

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 240000 \
  -in backups/assessments.json.gz.enc \
  -pass env:BACKUP_PASSPHRASE | gunzip > assessments.json
```

Para reinserir no Supabase (substitui registros de mesmo id):

```bash
curl -X POST "$SUPABASE_URL/rest/v1/assessments" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  --data-binary @assessments.json
```

## O que este backup NÃO resolve

Ele copia o que está **no Supabase**. Um diagnóstico que falhou ao sincronizar
nunca chegou lá e portanto não está aqui — ele fica no `localStorage` do navegador
do consultor. Foi exatamente o que aconteceu entre 03/09 e 10/09 de 2026, quando o
projeto esteve pausado.
