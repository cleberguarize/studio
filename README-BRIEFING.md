# Briefing — página de coleta (site + Perfil da Empresa no Google)

Página interna em 14 etapas que coleta tudo o que é preciso para montar o site
e otimizar o Perfil da Empresa no Google. Não é pública e não deve ser indexada.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `briefing/index.html` | A página. É só abrir no navegador. |
| `briefing/config.js` | **Todo o conteúdo das perguntas.** Não precisa de build. |
| `briefing/briefing.js` | A lógica: etapas, validação, rascunho, envio. |
| `briefing/briefing.css` | O visual (mesmo palette do site principal). |
| `api/briefing.js` | Endpoint que recebe e envia o briefing por e-mail. |
| `api/briefing-email.js` | Monta o e-mail (HTML, texto e anexo JSON). Sem dependências. |
| `api/package.json` | Dependências do endpoint. |
| `.env.example` | Modelo de variáveis de ambiente. |
| `robots.txt` | Bloqueia `/briefing/` para buscadores. |
| `test/executar-testes.mjs` | Roda toda a verificação de uma vez. |

## Rodar local

Abrir `briefing/index.html` direto no navegador já funciona, inclusive o
guardar rascunho. Só o envio por e-mail precisa de configuração.

```bash
# gera um e-mail de exemplo com dados fictícios (não envia nada)
node test/gerar-briefing-teste.mjs
```

O e-mail gerado fica em `test/saida/` — abra `briefing-exemplo.html` no
navegador para ver como chega para o cliente.

## Editar as perguntas

Quase tudo está em `briefing/config.js`. Cada etapa é um objeto:

```js
{
  id: 'contato',
  title: 'Contato e presença online',
  fields: [
    { id: 'whatsapp_numero', label: 'Número de WhatsApp', type: 'tel', required: true },
    {
      id: 'atendimento_modos',
      label: 'Como você atende?',
      type: 'multi',
      required: true,
      options: [
        { value: 'presencial', label: 'Tenho local físico' },
        { value: 'online', label: 'Atendo online' }
      ]
    }
  ]
}
```

Tipos disponíveis: `text`, `textarea`, `tel`, `email`, `number`, `url`, `cep`,
`cnpj`, `select`, `radio`, `multi`, `checkbox`, `yesno`, `yesno-group`,
`group`, `repeat`, `hours`, `holidays`, `colors`, `notice`.

Para perguntas que aparecem só em alguns casos, use `showIf`:

```js
showIf: (data) => data.gmn_existe === 'nao'   // etapa 12 só aparece neste caso
```

Depois de editar, rode `node test/gerar-briefing-teste.mjs` de novo: ele
reclama se algum campo obrigatório estiver sem `label`, se faltar `type`, ou
se dois campos na mesma etapa tiverem o mesmo `id`.

## Ativar o envio por e-mail

A hospedagem atual é estática e **não executa** `api/briefing.js`. Enquanto o
endpoint não estiver publicado, a página usa o plano B: mostra o resumo, deixa
copiar e baixar um JSON.

Para ativar, publique `api/briefing.js` em uma função serverless (Vercel,
Netlify Functions, Cloudflare Workers) e aponte `apiUrl` em
`briefing/config.js` para a URL pública:

```js
config: {
  apiUrl: 'https://seu-dominio.com.br/api/briefing'
}
```

### Variáveis de ambiente

Copie `.env.example` para as variáveis do seu provedor. As obrigatórias:

| Variável | Para que serve |
| --- | --- |
| `BRIEFING_TO_EMAIL` | Quem recebe o briefing. Hoje: `cleberguarize@gmail.com` |
| `BRIEFING_FROM_EMAIL` | Remetente. Precisa ser um domínio verificado. |
| `RESEND_API_KEY` | Chave do Resend. Se não existir, o código tenta SMTP. |
| `ALLOWED_ORIGINS` | Domínio do site, ex.: `https://entreaulasefraldas.com.br` |
| `DEVELOPER_MANAGER_EMAIL` | Usado como sugestão no campo "e-mail do gerente". |

SMTP (alternativa ao Resend): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_SECURE`.

`ALLOWED_ORIGINS` é obrigatório na prática: vazio bloqueia todo envio feito
pelo navegador, porque o CORS só libera as origens listadas.

## Privacidade e segurança

- `noindex, nofollow` no `<head>` e `Disallow: /briefing/` no `robots.txt`.
- Nada de senha, CPF, dado bancário ou documento é pedido.
- O rascunho fica no `localStorage` do próprio navegador, nunca é enviado
  sozinho.
- Ao enviar com sucesso, o rascunho é apagado.
- Validação no servidor com Zod, limite de tamanho de corpo, limite de
  requisições por IP e campo-isca contra robôs.
- O e-mail pede consentimento explícito e cria uma cópia do que foi
  respondido para o cliente.

## Testes

```bash
node test/executar-testes.mjs
```

Roda tudo de uma vez. Não é preciso instalar nada, exceto para o teste de
schema — que precisa do `zod` e avisa se ele faltar:

```bash
npm install --prefix api
```

Para rodar uma parte só:

```bash
node test/gerar-briefing-teste.mjs   # gera o e-mail de exemplo
node test/testar-email.mjs           # confere o e-mail gerado
node test/testar-navegacao.mjs       # confere a etapa condicional e o Voltar
node test/testar-texto.mjs           # confere encoding e sujeira de texto
node test/testar-schema.mjs          # confere a validação do endpoint
```

`test/saida/` é gerado pelos testes e pode ser apagado a qualquer momento.

## Mudar o destinatário

Dois lugares, ambos em `briefing/config.js`:

```js
config: {
  recipientEmail: 'novo@email.com',        // quem recebe
  developerManagerEmail: 'novo@email.com'  // sugestão no campo do gerente
}
```

E `BRIEFING_TO_EMAIL` / `DEVELOPER_MANAGER_EMAIL` no ambiente do endpoint.