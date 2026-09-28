# Curso Foco · Simulados

Plataforma para montar simulados, corrigir provas (à mão ou por foto do
cartão-resposta) e acompanhar o desempenho de alunos e turmas.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth,
Storage). Todo o backend roda no próprio Next — server actions e um route handler
para a leitura óptica. Interface mobile-first, estritamente preto e branco.

---

## Como colocar no ar

### 1. Criar o projeto no Supabase

1. Em [supabase.com](https://supabase.com), crie um projeto.
2. Abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)
   e execute. Isso cria as tabelas, a view de análise, as políticas de RLS, o
   bucket de imagens e um catálogo inicial de áreas/matérias no padrão ENEM.

   > **Já tinha rodado uma versão anterior do schema?** Rode também os arquivos de
   > [`supabase/migracoes/`](supabase/migracoes) em ordem. Instalação nova não
   > precisa — o `schema.sql` já está em dia.
3. Em **Authentication → Users → Add user**, crie a conta do professor
   (e-mail + senha, com *Auto Confirm User* ligado). Não existe cadastro público:
   as contas são criadas por aqui.

### 2. Configurar o app

Copie `.env.local.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co        # Project Settings > Data API
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...      # Project Settings > API Keys
```

A *publishable key* é a substituta das chaves JWT antigas. Projetos que ainda
usam a `anon` continuam funcionando: basta preencher
`NEXT_PUBLIC_SUPABASE_ANON_KEY` no lugar. Se as duas estiverem presentes, a
publishable tem precedência — a resolução está em `src/lib/supabase/config.ts`.

Nenhuma das duas precisa ser secreta: quem controla o acesso é o RLS, ligado em
todas as tabelas. A `service_role` / `secret key` **não** é usada em lugar nenhum
deste projeto.

### 3. Rodar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000 e entre com a conta criada no passo 1.

---

## O fluxo de uso

1. **Matérias** — ajuste o catálogo de áreas (Ciências da Natureza) e matérias
   (Química, Física, Biologia). É esse catálogo que permite comparar o
   desempenho de uma mesma matéria entre simulados diferentes.
2. **Turmas e alunos** — crie as turmas e cadastre os alunos. Há importação
   rápida colando uma lista de nomes. Cada aluno ganha um **código de 4 dígitos**
   usado para identificá-lo no cartão-resposta.
3. **Simulado → Estrutura** — monte o simulado em blocos, uma matéria por bloco.
   Cada bloco tem um tipo, e o tipo decide quais campos existem:

   | Tipo | Configura | Como é corrigido |
   |---|---|---|
   | Múltipla escolha | números das questões + nº de alternativas | cartão-resposta; entra no % de acerto |
   | Discursiva | números das questões + nota máxima por questão | nota, na tela de correção |
   | Redação | número da questão + nota máxima (item único) | nota, na tela de correção |

   Não existe "discursiva com 5 alternativas": os campos somem conforme o tipo, e
   o servidor normaliza de novo antes de gravar. Os números podem ser informados
   individualmente, colados em linhas ou abreviados por intervalos (`49, 61-63,
   69`). Assim, matérias diferentes podem ocupar posições intercaladas na prova.
   Um mesmo número não pode pertencer a dois blocos. Vincule as turmas e clique
   em **Gerar provas**.
4. **Simulado → Gabarito** — marque as respostas certas, ou cole a sequência
   inteira (`ABCDEEDCBA…`) no preenchimento rápido.

   > Para a próxima aplicação, use **Duplicar** no rodapé da aba Estrutura: sai
   > um novo simulado em rascunho com os mesmos blocos, questões e numeração —
   > basta trocar título e data. O gabarito vem junto por padrão (desmarque se a
   > prova for outra); as turmas vinculadas, só se você pedir. Provas e correções
   > nunca são copiadas.
5. **Cartões-resposta** — imprima em A4. No modo *personalizado* sai um cartão
   por aluno com nome e código já preenchidos; no modo *em branco* o aluno
   preenche o próprio código.
6. **Correção** — três caminhos, do mais rápido ao mais manual:
   - **por foto** (`Corrigir por foto`, várias folhas de uma vez), sempre com
     tela de conferência antes de gravar;
   - **colando a sequência** das respostas do aluno (`ABCDE-BXA…`), onde `-` é
     questão em branco e `X` é rasura;
   - **questão por questão**, clicando nas bolhas.

   Discursivas e redação aparecem como campo de nota, com o máximo do item.
7. **Resultados** — média do simulado, ranking, acerto por área e por matéria,
   dificuldade questão a questão e comparativo entre turmas. As páginas de aluno
   e de turma trazem a evolução ao longo dos simulados.

---

## A leitura automática do cartão

Não usa serviço externo nem API paga: é visão computacional rodando no servidor
Node, em `src/lib/omr/`.

- **`layout.ts`** é a única fonte de verdade da geometria da folha, em
  milímetros. A página de impressão desenha a partir dele e o leitor amostra a
  partir dele — os dois nunca saem de sincronia.
- **`detect.ts`** faz o trabalho: limiar adaptativo por imagem integral (tolera
  iluminação irregular), componentes conexos para achar os quatro quadrados dos
  cantos, homografia de 8 parâmetros para desfazer a perspectiva, e amostragem
  do interior de cada bolha.

O quadrado superior esquerdo é maior que os outros três: é ele que define a
orientação, então a folha pode ser fotografada de cabeça para baixo ou deitada.
Cada questão recebe um score de confiança; leitura fraca ou dupla marcação sai
destacada na tela de revisão, com a folha já retificada ao lado para conferência.

### Verificando

```bash
npm run verificar            # tudo
npm run verificar:omr        # só o leitor óptico
npm run verificar:sequencia  # só o interpretador de sequências
```

O `verificar:sequencia` cobre o parser de `ABCDE-BXA…`. O risco que ele guarda é
o de **deslocamento**: se um caractere de pontuação virasse "questão em branco"
por engano, todas as respostas seguintes andariam uma casa e a prova sairia
errada sem nenhum erro aparecer.

O script desenha um cartão com um gabarito conhecido, simula a fotografia
(perspectiva de câmera na mão, sombra, ruído de sensor, compressão JPEG) e
confere o resultado. Resultado atual, 90 questões × 5 alternativas:

| Cenário | Acerto | Código |
|---|---|---|
| Escaneada, sem distorção | 90/90 | ok |
| Foto com perspectiva leve + sombra | 90/90 | ok |
| Foto inclinada forte + ruído + JPEG ruim | 90/90 | ok |
| Folha de cabeça para baixo (180°) | 90/90 | ok |
| Folha deitada (90° e 270°) | 90/90 | ok |
| Marcação fraca a lápis | 90/90 | ok |
| Quatro questões rasuradas | 90/90, as 4 sinalizadas | ok |

~120 ms por folha. Rode este script sempre que mexer em `layout.ts` — ele pega
na hora qualquer descasamento entre a impressão e a leitura.

### Como fotografar

Enquadre a folha inteira com os quatro quadrados pretos visíveis, em luz
uniforme. A inclinação da câmera é corrigida automaticamente; o que atrapalha é
sombra sobre as quinas ou a folha cortada na borda.

---

## Estrutura

```
src/
  app/
    (app)/            painel, alunos, turmas, simulados, correção
    (print)/          cartões-resposta em A4
    actions/          server actions por domínio
    api/omr/          leitura óptica (route handler, runtime Node)
  components/         UI, gráficos, navegação, desenho do cartão
  lib/
    omr/              geometria da folha + detecção
    queries.ts        leituras do banco (com paginação — PostgREST corta em 1000)
    scoring.ts        agregações de desempenho
    supabase/         clientes de servidor e navegador
  proxy.ts            guarda de sessão em todas as rotas
supabase/schema.sql   schema completo, idempotente
scripts/              verificação do leitor óptico
```

## Notas

- **Cores.** O sistema é monocromático por decisão de marca. Os gráficos, por
  isso, nunca usam matiz para identificar série: ou têm uma série só, ou separam
  por traço cheio × tracejado com legenda. Toda informação dos gráficos também
  aparece em tabela na mesma página.
- **Discursivas.** Ficam fora do cartão-resposta e do cálculo de percentual de
  acerto; são lançadas por nota na tela de correção.
- **Permissões.** O RLS libera tudo para qualquer usuário autenticado — o modelo
  é "uma equipe pedagógica, um acesso". Para separar professores por turma seria
  preciso vincular `provas`/`turmas` ao `auth.uid()` nas políticas.
