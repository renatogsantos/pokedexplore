# Aviso Legal — relatório de implementação

1. **Rota criada:** `/aviso-legal`, página pública estática no App Router.
2. **Arquivos criados:** `src/app/aviso-legal/page.jsx`, `src/app/aviso-legal/style.scss`, `src/lib/legal/content.js`, `src/lib/legal/config.js`, `src/components/Footer/index.jsx`, `src/components/Footer/style.scss`, este relatório e `docs/qa/aviso-legal-mobile.png`.
3. **Arquivos modificados:** `src/Provider/ProviderLayout.jsx`, `src/app/page.jsx` e `src/app/layout.jsx`.
4. **Footer:** o bloco antes exclusivo da página inicial foi extraído para `Footer`, montado no shell compartilhado, dentro da área que já recebe espaço para a barra móvel. Mantidos GitHub, LinkedIn, WhatsApp, Controle do criador, nome e e-mail. Acrescentados Aviso Legal e “Projeto de fã gratuito e não oficial.” O componente permanece fora das rotas de arena/batalha e controle do criador, preservando o contexto de tela cheia.
5. **Texto final:** as oito seções fornecidas foram mantidas, com a seção opcional de fontes de dados, sem afirmações de autorização ou conclusões jurídicas adicionais. O texto integral está transcrito abaixo e centralizado em `content.js`. Nenhuma logo oficial foi adicionada. A seção de fontes não chama PokéAPI de oficial nem atribui licença a APIs.
6. **Contato/data:** `LEGAL_CONTACT_EMAIL = "renato.work.art@gmail.com"`, reutilizando o contato que já estava publicado na Home. Endereço com link `mailto:` na página e rodapé; string vazia oculta o endereço sem placeholder. `LAST_UPDATED = "2026-10-02"`, exibida como 02/10/2026, sem data dinâmica. Há TODO para manter o endereço monitorado.
7. **Metadata:** title “Aviso Legal | PokédExplore”; description “Informações sobre o caráter independente, gratuito e não comercial do PokédExplore.” Os valores gerais de título/descrição do layout foram preservados e movidos para o mecanismo de metadata do Next, para permitir override sem duplicação. Confirmados um título e uma descrição no DOM da rota; sem noindex.
8. **Mobile/acessibilidade:** Chrome local com viewports 320, 360, 375, 390, 412 e 430 × 844: zero elementos do aviso/rodapé fora da largura; texto 16px, entrelinha 1,85 e fallback sans-serif. Desktop 1280 × 900: coluna máxima 780px. Toque real no link do rodapé da Home abriu a rota. Inspecionados HTML semântico (`main`, `header`, `article`, `section`, `footer`, `nav`), um H1 e nove H2, nomes dos links, foco CSS visível, cores claras sobre fundos escuros e alvos de link de 44px. Não há animações no aviso, portanto não depende de movimento. Nenhuma imagem no conteúdo. Não houve teste em aparelho físico nem auditoria completa com leitor de tela. Captura: `docs/qa/aviso-legal-mobile.png`.
9. **Build:** `npm run build` terminou com código 0 depois do último ajuste de fonte; `/aviso-legal` gerada estaticamente. Permanecem avisos já existentes de Browserslist, cache webpack, autoprefixer e dependência opcional `debug`. A Home também foi exercitada no build local final. Não houve deploy.
10. **Diff:** `git diff --check` passou. Nenhum motor, item, recompensa, durabilidade ou save foi modificado. Sem novos testes unitários para conteúdo estático; validação por build, inspeção e navegador.

## Consistência com o funcionamento atual

A inspeção do código encontrou PokéAPI e Google Analytics. Analytics foi mantido; o aviso não afirma ausência de coleta de dados. Não foram encontradas integrações de compra com dinheiro real, assinaturas ou plataformas de anúncio em `src`/`package.json`. A loja usa recursos virtuais; não foram alteradas as mecânicas existentes. Esta verificação cobre o checkout, não acordos comerciais ou serviços externos que não estejam representados nele.

## Texto integral utilizado

AVISO LEGAL — POKÉDEXPLORE

Última atualização: 02/10/2026

### 1. SOBRE O PROJETO

PokédExplore é um projeto independente desenvolvido por fã, criado exclusivamente para fins pessoais, recreativos e não comerciais.

O projeto foi desenvolvido como uma experiência de programação e entretenimento para utilização entre amigos e outros usuários interessados.

O acesso ao PokédExplore é gratuito.

O projeto não comercializa o acesso ao jogo, não possui assinaturas, anúncios publicitários, patrocínios ou venda de itens, moedas ou vantagens mediante pagamento em dinheiro real.

As moedas, itens, recompensas e demais recursos existentes dentro do jogo são exclusivamente virtuais, não possuem valor monetário real e não podem ser comprados, vendidos, transferidos ou convertidos em dinheiro através do PokédExplore.

### 2. PROJETO NÃO OFICIAL

PokédExplore é um projeto independente de fã.

PokédExplore não é afiliado, associado, patrocinado, aprovado ou endossado pela Nintendo, The Pokémon Company, Game Freak ou Creatures.

Nenhuma apresentação, funcionalidade ou conteúdo deste projeto deve ser interpretado como indicação de qualquer vínculo oficial com essas empresas.

### 3. PROPRIEDADE INTELECTUAL

PokédExplore não reivindica propriedade sobre a franquia Pokémon, seus personagens, nomes, marcas, designs, imagens ou demais propriedades intelectuais pertencentes aos seus respectivos titulares.

Pokémon e os respectivos nomes, personagens, marcas e demais elementos protegidos pertencem aos seus respectivos titulares.

A identidade, o código e as funcionalidades originais desenvolvidas especificamente para o PokédExplore não pretendem transferir, limitar ou questionar quaisquer direitos pertencentes aos titulares das propriedades intelectuais utilizadas como referência ou conteúdo no projeto.

### 4. FINALIDADE NÃO COMERCIAL

O PokédExplore foi criado sem finalidade comercial.

Não existe cobrança para utilização do projeto e nenhuma receita é obtida diretamente através de:

- acesso ao jogo;
- publicidade;
- assinaturas;
- venda de moedas virtuais;
- venda de itens;
- venda de Pokémon;
- vantagens dentro do jogo;
- apostas;
- transações envolvendo dinheiro real.

Caso essa natureza seja alterada no futuro, este aviso deverá ser revisado antes de qualquer mudança ser disponibilizada publicamente.

### 5. MOEDAS E RECOMPENSAS VIRTUAIS

As moedas e recompensas presentes no PokédExplore fazem parte exclusivamente das mecânicas internas do jogo.

Elas:

- não possuem valor monetário real;
- não podem ser adquiridas mediante pagamento através do PokédExplore;
- não podem ser convertidas em dinheiro;
- não podem ser sacadas;
- não representam ativos financeiros;
- não representam apostas ou premiações em dinheiro.

### 6. RESPEITO AOS TITULARES DOS DIREITOS

Este projeto pretende respeitar os direitos de propriedade intelectual de terceiros.

Caso um titular de direitos, ou representante devidamente autorizado, considere que algum conteúdo disponibilizado pelo PokédExplore deva ser removido, o responsável pelo projeto está disposto a analisar prontamente a solicitação e cooperar de boa-fé.

Quando solicitado de forma legítima pelo respectivo titular dos direitos, conteúdos questionados poderão ser removidos ou o projeto poderá ser descontinuado, conforme necessário.

O objetivo do PokédExplore não é disputar, prejudicar ou substituir produtos oficiais relacionados à franquia Pokémon.

### 7. SOLICITAÇÃO DE REMOÇÃO

Titulares de direitos de propriedade intelectual ou seus representantes autorizados podem entrar em contato para comunicar preocupações relacionadas ao conteúdo disponibilizado neste projeto.

Para facilitar a análise, recomenda-se informar:

- identificação do titular ou representante;
- conteúdo questionado;
- localização do conteúdo dentro do PokédExplore;
- motivo da solicitação;
- informações suficientes para permitir contato e resposta.

Solicitações legítimas serão analisadas com prioridade.

Contato: renato.work.art@gmail.com

### 8. AUSÊNCIA DE ENDOSSO

Qualquer referência a Pokémon, Nintendo, The Pokémon Company, Game Freak, Creatures ou suas respectivas propriedades intelectuais possui finalidade exclusivamente relacionada ao contexto deste projeto de fã.

Nenhuma dessas empresas participa da administração, desenvolvimento ou operação do PokédExplore.

### 9. FONTES DE DADOS

O PokédExplore utiliza serviços e fontes de dados de terceiros para algumas informações utilizadas pela aplicação.

A utilização de APIs, bibliotecas ou serviços de terceiros não deve ser interpretada como autorização, licença, patrocínio ou endosso por parte dos titulares da propriedade intelectual da franquia Pokémon.

