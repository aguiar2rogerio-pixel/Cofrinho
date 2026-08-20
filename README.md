# Cofrinho Inteligente

Aplicativo web progressivo (PWA) para controle pessoal de saldo acumulado, aportes, depósitos diários e compromissos financeiros. O projeto foi desenvolvido para uso pessoal, com interface otimizada para dispositivos móveis e persistência local no navegador.

> Versão atual: **2.0**

## Visão geral

O Cofrinho permite acompanhar quanto foi acumulado, registrar entradas financeiras e organizar contas futuras. A aplicação também oferece suporte a contas parceladas, contas fixas mensais, filtros de compromissos, histórico de depósitos, backup manual e restauração dos dados.

A aplicação é totalmente estática: não possui servidor próprio, banco de dados, autenticação ou sincronização entre dispositivos. Os dados permanecem no navegador em que foram cadastrados, utilizando `localStorage`.

## Funcionalidades

A tela principal exibe o saldo acumulado, o total de compromissos em aberto e a cobertura financeira dos compromissos vencidos ou pertencentes ao mês atual. Também apresenta uma projeção dos compromissos do mês atual e dos dois meses seguintes.

O usuário pode registrar um depósito diário, realizar aportes avulsos com data opcional e consultar os depósitos organizados por mês. Cada depósito pode ser estornado individualmente pelo histórico, com atualização automática do saldo.

Os compromissos podem ser cadastrados com nome, valor, data, data de lançamento, quantidade de parcelas e indicação de conta fixa mensal. É possível marcar compromissos como pagos, editar lançamentos, excluir uma parcela específica ou remover parcelas futuras relacionadas.

A seção de segurança permite exportar um backup em formato JSON com extensão `.txt` e restaurar um backup previamente salvo. Há também uma opção experimental de lembrete diário, utilizando as APIs de notificações, badges e service worker quando o navegador oferece suporte.

## Estrutura do projeto

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura da interface, formulários, modais e componentes visuais |
| `styles.css` | Estilos próprios da aplicação e importação da fonte Inter |
| `app.js` | Estado, regras financeiras, renderização, histórico, backup e lembretes |
| `sw.js` | Service worker, cache offline e notificações |
| `manifest.json` | Metadados do PWA, ícones e atalhos |
| `icon-192.png` | Ícone do aplicativo em 192 × 192 pixels |
| `icon-512.png` | Ícone do aplicativo em 512 × 512 pixels |

## Como executar localmente

Por ser uma aplicação estática, não é necessário instalar dependências de backend ou executar um processo de compilação. É necessário, entretanto, servi-la por HTTP para que o service worker possa ser registrado corretamente.

Com Python instalado, execute na raiz do projeto:

```bash
python3 -m http.server 8000
```

Em seguida, abra [`http://localhost:8000`](http://localhost:8000) no navegador.

Também é possível utilizar qualquer servidor estático equivalente. A abertura direta do arquivo `index.html` com `file://` permite visualizar parte da interface, mas não habilita corretamente todos os recursos do PWA, especialmente o service worker e o cache offline.

## Uso em produção

O projeto pode ser hospedado em qualquer serviço de arquivos estáticos, como GitHub Pages, Vercel, Netlify ou outro servidor web. Para instalação como PWA e funcionamento completo do service worker, o site deve ser servido em `HTTPS`, exceto durante o desenvolvimento em `localhost`.

A aplicação utiliza Tailwind CSS, Lucide Icons e a fonte Inter por meio de CDNs externas. Consequentemente, a primeira abertura depende de conexão com a internet para carregar esses recursos. O service worker armazena os arquivos locais do aplicativo, mas não transforma automaticamente as dependências externas em recursos offline.

## Persistência dos dados

Os dados principais são armazenados na chave `provisoes_v3_3_data` do `localStorage`. As preferências de lembrete são armazenadas separadamente nas chaves `saldo_seguro_reminder_enabled` e `saldo_seguro_last_visit`.

O saldo é mantido no estado principal junto com os arrays de contas e histórico. Ao excluir um depósito, o valor é estornado do saldo. Ao pagar uma conta, o valor é descontado e o compromisso passa para o estado de pago.

Como os dados são locais, limpar os dados do site, trocar de navegador, usar outro dispositivo ou navegar em modo privado pode fazer com que os registros deixem de estar disponíveis. Recomenda-se realizar backups periódicos.

## Backup e restauração

Para criar um backup, utilize o botão **Fazer Backup** na seção **Segurança e Ajustes**. O navegador fará o download de um arquivo semelhante a:

```text
backup_cofrinho_2026-08-20.txt
```

Apesar da extensão `.txt`, o conteúdo é JSON legível. Para restaurar os dados, utilize o botão **Restaurar** e selecione um backup criado pelo aplicativo. A restauração valida a estrutura mínima do arquivo antes de substituir os dados atuais.

> Recomenda-se manter cópias dos backups fora do navegador, especialmente antes de limpar os dados do site ou trocar de dispositivo.

## Service worker e atualizações

O arquivo `sw.js` registra o cache `cofrinho-v2` e armazena os principais arquivos locais do aplicativo. Quando uma nova versão do aplicativo altera arquivos importantes, o valor de `CACHE_NAME` deve ser incrementado para forçar a criação de um novo cache.

Depois de uma atualização, o navegador pode continuar utilizando arquivos antigos por algum tempo, dependendo do estado do service worker. Se a nova versão não aparecer, feche as abas antigas do aplicativo, recarregue a página e, se necessário, remova os dados/cache do site nas ferramentas de desenvolvimento do navegador.

## Desenvolvimento e manutenção

A lógica da aplicação está concentrada em `app.js`, mas organizada por blocos funcionais: estado, depósitos, histórico, compromissos, renderização, backup e lembretes. A interface permanece em `index.html`, enquanto os estilos próprios ficam em `styles.css`.

Ao adicionar qualquer valor controlado pelo usuário à interface, prefira `textContent` ou utilize a função `escapeHtml` antes de inserir o conteúdo em templates HTML. Isso evita que nomes ou textos cadastrados sejam interpretados como marcação ou código.

Ao alterar o modelo de dados armazenado no `localStorage`, mantenha a função `normalizeState` atualizada para preservar compatibilidade com backups antigos. Alterações em valores monetários devem ser avaliadas com cuidado, pois o projeto atualmente utiliza números JavaScript para representar valores em reais.

## Validações recomendadas antes de publicar

Antes de publicar uma nova versão, confirme que:

1. `index.html`, `app.js` e `sw.js` possuem sintaxe válida.
2. O aplicativo abre sem erros no console do navegador.
3. Um backup pode ser criado e restaurado corretamente.
4. Depósitos, aportes, exclusões e pagamentos atualizam o saldo esperado.
5. Parcelas e contas fixas são geradas com as datas corretas.
6. O service worker é registrado em `localhost` ou HTTPS.
7. A nova versão do cache foi definida em `sw.js` quando necessário.

## Limitações conhecidas

O aplicativo não oferece login, criptografia, banco de dados remoto, sincronização entre dispositivos ou recuperação de dados no servidor. As notificações e badges dependem do suporte e das permissões do navegador, e o lembrete é uma funcionalidade de melhor esforço, não um agendamento garantido em segundo plano.

Além disso, os recursos carregados por CDN podem não estar disponíveis sem conexão. Para tornar a aplicação completamente independente e offline, seria necessário incluir localmente essas dependências ou utilizar um processo de build.

## Licença

Este repositório não declara atualmente uma licença de software. Antes de redistribuir, incorporar o código em outro produto ou publicar uma versão para terceiros, defina uma licença adequada ao objetivo do projeto.

## Repositório

O código-fonte está disponível em [aguiar2rogerio-pixel/Cofrinho](https://github.com/aguiar2rogerio-pixel/Cofrinho).

Desenvolvido para controle financeiro pessoal com foco em simplicidade, uso móvel e autonomia local.

---

**Manus AI**
