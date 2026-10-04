/* ==========================================================================
   BRIEFING — CONFIGURAÇÃO DE ETAPAS E CAMPOS
   --------------------------------------------------------------------------
   Este é o ÚNICO arquivo que você precisa editar para mudar perguntas, textos,
   opções, obrigatoriedade ou condições. Nada aqui exige mexer na lógica.

   Como adicionar um campo novo (copie um bloco existente e troque):
     { id: 'meu_campo', type: 'text', label: 'Rótulo', required: false, hint: 'Dica' }

   TIPOS DISPONÍVEIS:
     text | email | tel | url | number | time | textarea | colors
     radio  -> options: ['a','b']                       (escolhe 1)
     multi  -> options: ['a','b']                       (escolhe vários)
     yesno  -> campo Sim/Não (pode ficar vazio)
     yesno-group -> options: [{ id, label, hint }]      (vários Sim/Não em bloco)
     checkbox -> Sim/Não único com texto de consentimento
     repeat -> itemFields: [ ... ], min, max            (blocos dynamics)
     hours  -> tabela semanal (segunda a domingo)
     holidays -> lista de datas especiais
     notice -> texto fixo na tela (tone: info | warn | danger)
   ========================================================================== */

var BRIEFING_CONFIG = (function () {
  'use strict';

  /* ---- Configurações gerais -------------------------------------------- */

  var CONFIG = {
    /* E-mail que recebe os briefings. Troque quando quiser. */
    recipientEmail: 'cleberguarize@gmail.com',

    /* Seu e-mail de gerente do Perfil da Empresa no Google.
       Aparece pré-preenchido para o cliente autorizar. */
    developerManagerEmail: 'cleberguarize@gmail.com',

    /* Endereço do endpoint de envio.
       - Hospedagem estática pura: deixe '' e o envio fica indisponível
         (a página oferece "Baixar JSON" e "Copiar respostas").
       - Vercel/Netlify: use '/api/briefing'.
       - Externo: cole a URL completa, ex.: 'https://meu-dominio.com/api/briefing'. */
    apiUrl: '',

    /* Nome do seu negócio (usado no assunto e no cabeçalho do e-mail). */
    siteName: 'Studio Gemma Home',

    /* Rotas */
    privacyPolicyUrl: '../politica-de-privacidade.html',
    homeUrl: '../index.html',

    /* Chave do rascunho salvo no navegador */
    storageKey: 'sgm_briefing_rascunho_v1'
  };

  /* ---- Atalhos para declarar os blocos grandes -------------------------- */

  var SIM_NAO = [
    { id: 'sim', label: 'Sim' },
    { id: 'nao', label: 'Não' }
  ];

  function yn(id, label, hint) {
    return { id: id, type: 'yesno', label: label, hint: hint };
  }

  function grp(id, label, items, hint) {
    return { id: id, type: 'yesno-group', label: label, hint: hint, options: items };
  }

  var UF = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP',
    'SE', 'TO'];

  /* ---- ETAPAS ----------------------------------------------------------- */

  var STEPS = [

    /* ============================ ETAPA 1 ============================= */
    {
      id: 'perfil-google',
      title: 'Boas-vindas e Perfil no Google',
      short: 'Boas-vindas',
      fields: [
        {
          type: 'notice', tone: 'info',
          title: 'Vamos começar',
          text: 'Este formulário tem 14 etapas e leva cerca de 10 a 15 minutos. ' +
            'Suas respostas ficam salvas neste navegador a cada preenchimento: ' +
            'se precisar, pode fechar a página e voltar depois exatamente onde parou. ' +
            'Só os campos com asterisco (*) são obrigatórios — o resto você pode deixar em branco.'
        },
        {
          id: 'gmn_existe', type: 'radio', required: true,
          label: 'Seu negócio já tem Perfil da Empresa no Google (Google Meu Negócio)?',
          hint: 'É aquele cartão que aparece no Google Maps e no Google quando alguém pesquisa o nome do seu negócio, com foto, endereço, horário e avaliações.',
          options: [
            { value: 'sim', label: 'Sim, já tenho' },
            { value: 'nao', label: 'Não, nunca criei' },
            { value: 'nao_sei', label: 'Não sei o que é / não sei se tenho' }
          ]
        },
        {
          showIf: function (d) { return d.gmn_existe === 'nao' || d.gmn_existe === 'nao_sei'; },
          type: 'notice', tone: 'info',
          text: 'Perfeito. Vou criar o Perfil da Empresa no Google para você, e para isso preciso destas informações mais adiante. Se preferir não responder a essa parte, tudo bem — só deixo em branco.'
        },
        {
          showIf: function (d) { return d.gmn_existe === 'sim'; },
          type: 'notice', tone: 'warn',
          text: 'Ótimo, já existe um perfil. Vou trabalhar na otimização dele. Preciso de algumas informações de acesso abaixo.'
        },

        /* --- Campos do perfil existente (só quando gmn_existe = sim) --- */
        {
          showIf: function (d) { return d.gmn_existe === 'sim'; },
          id: 'perfil_existente', type: 'group', label: 'Dados do perfil que já existe',
          fields: [
            {
              id: 'gmn_link', type: 'text', label: 'Link do perfil no Google Maps ou o nome exatamente como aparece na busca',
              hint: 'Se não souber o link, digite o nome do negócio como aparece no Google.'
            },
            yn('gmn_proprietario', 'Sou proprietário(a) do perfil?'),
            yn('gmn_acesso_conta', 'Tenho acesso à conta Google que administra o perfil?'),
            { id: 'gmn_email_proprietario', type: 'email', label: 'E-mail da conta proprietária do perfil' },
            yn('gmn_autoriza_gerente', 'Autorizo meu desenvolvedor a ser adicionado como gerente do perfil'),
            { id: 'gmn_email_gerente', type: 'email', label: 'E-mail do gerente (preenchido por mim, mas você pode corrigir)', default: CONFIG.developerManagerEmail },
            yn('gmn_suspenso', 'Já tive esse perfil suspenso ou removido?'),
            { id: 'gmn_melhorias', type: 'textarea', label: 'O que você gostaria de melhorar no perfil?', rows: 4, hint: 'Ex.: aparecer mais nas buscas da minha região, ganhar mais avaliações, foto melhor, mais horários.' }
          ]
        },

        {
          type: 'notice', tone: 'danger',
          title: 'Atenção, por segurança',
          text: 'Nunca envie sua senha do Google. Vou pedir apenas acesso de gerente, que permite cuidar do perfil sem precisar da sua senha.'
        }
      ]
    },

    /* ============================ ETAPA 2 ============================= */
    {
      id: 'sobre-negocio',
      title: 'Sobre você e o negócio',
      short: 'Sobre o negócio',
      fields: [
        {
          id: 'negocio_nome', type: 'text', required: true,
          label: 'Nome do negócio',
          hint: 'Use o nome real, igual aparece na fachada e nos documentos. Não coloque palavras-chave, nome da cidade nem slogan: o Google pode suspender o perfil.',
          placeholder: 'Ex.: Studio Bella Nutri, Dra. Ana Ribeiro Nutrição'
        },
        { id: 'negocio_razao_social', type: 'text', label: 'Razão social', hint: 'O nome que está no CNPJ. Se for a mesma do nome do negócio, pode repetir.' },
        { id: 'negocio_cnpj', type: 'text', label: 'CNPJ', hint: 'Só o número, com pontos e barras. Se não tiver, deixe em branco.', placeholder: '00.000.000/0000-00' },
        { id: 'responsavel_nome', type: 'text', required: true, label: 'Nome do(a) profissional responsável' },
        { id: 'responsavel_registro', type: 'text', label: 'Registro profissional', hint: 'Ex.: CRP 06/12345, OAB/SP 123456, CRN, CRM, CRO. Se não tiver, escreva N/A.' },
        { id: 'negocio_ano_inicio', type: 'number', label: 'Ano de início das atividades', placeholder: 'Ex.: 2015', min: 1900, max: 2100 },
        {
          id: 'negocio_segmento', type: 'text', label: 'Segmento de atuação',
          hint: 'Ex.: advocacia, nutrição, psicologia, estética, odontologia.',
          placeholder: 'Ex.: Nutrição e emagrecimento'
        },
        {
          id: 'atendimento_modos', type: 'multi', label: 'Como você atende?',
          hint: 'Pode marcar mais de um.',
          options: [
            { value: 'local', label: 'Tenho local físico onde recebo clientes' },
            { value: 'domicilio', label: 'Atendo no endereço do cliente (domicílio ou visita)' },
            { value: 'online', label: 'Atendo online (videochamada)' },
            { value: 'somente_marcada', label: 'Atendo somente com hora marcada' },
            { value: 'espaco_compartilhado', label: 'O endereço é residencial, sala compartilhada ou coworking' }
          ]
        }
      ]
    },

    /* ============================ ETAPA 3 ============================= */
    {
      id: 'objetivo-conversao',
      title: 'Objetivo do site e conversão',
      short: 'Objetivo e conversão',
      intro: 'Esta parte é a base da copy do site. Quanto mais concreto, melhor o texto que escrevo para você.',
      fields: [
        {
          id: 'objetivo_principal', type: 'radio', required: true,
          label: 'Qual é o principal objetivo do site?',
          options: [
            { value: 'orcamento', label: 'Receber pedidos de orçamento' },
            { value: 'agendar', label: 'Agendar consultas e atendimentos' },
            { value: 'ligacoes', label: 'Receber ligações' },
            { value: 'formulario', label: 'Gerar contatos por formulário' },
            { value: 'venda_online', label: 'Vender online' },
            { value: 'trazer_local', label: 'Levar clientes ao local físico' },
            { value: 'outro', label: 'Outro' }
          ]
        },
        {
          showIf: function (d) { return d.objetivo_principal === 'outro'; },
          id: 'objetivo_outro', type: 'text', label: 'Qual é o outro objetivo?', required: true
        },
        {
          id: 'conversao_canais', type: 'multi', required: true,
          label: 'Como o cliente deve entrar em contato para convertir?',
          hint: 'Marque todos os canais que o site deve oferecer.',
          options: [
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'telefone', label: 'Telefone' },
            { value: 'formulario', label: 'Formulário no site' },
            { value: 'email', label: 'E-mail' },
            { value: 'agendamento', label: 'Agendamento online' },
            { value: 'visita', label: 'Visita presencial' },
            { value: 'outro', label: 'Outro' }
          ]
        },
        {
          showIf: function (d) { return (d.conversao_canais || []).indexOf('outro') > -1; },
          id: 'conversao_outro', type: 'text', label: 'Qual é o outro canal?'
        },
        { id: 'whatsapp_numero', type: 'tel', label: 'Número de WhatsApp para os botões do site', hint: 'Com DDD. É o número que vai receber as mensagens do site.', placeholder: '(11) 90000-0000' },
        { id: 'whatsapp_mensagem', type: 'text', label: 'Mensagem pré-preenchida do botão de WhatsApp', hint: 'O texto que já aparece escrito quando alguém abre a conversa.', placeholder: 'Olá! Vim pelo site e gostaria de um orçamento.' },
        { id: 'fluxo_atendimento', type: 'textarea', label: 'Depois que o cliente entra em contato, o que acontece?', hint: 'Descreva o passo a passo do atendimento até fechar a venda. Ex.: ele manda mensagem, eu peço a região, mando o orçamento pelo WhatsApp, agendo, mando a localização.', rows: 6 },
        { id: 'tempo_resposta', type: 'text', label: 'Em quanto tempo você costuma responder? E qual horário?', hint: 'Ex.: respondo em até 1 hora, das 8h às 20h, de segunda a sexta.' },
        { id: 'contatos_desejados', type: 'text', label: 'Quantos contatos por mês você gostaria de receber pelo site?', hint: 'Número ou faixa. Ex.: de 30 a 50.' },
        { id: 'contatos_atendiveis', type: 'text', label: 'Quantos desses contatos você consegue atender por mês?', hint: 'Seja realista, isso define o tamanho do site.' },
        { id: 'ticket_medio', type: 'text', label: 'Ticket médio ou valor típico de um atendimento', hint: 'Opcional. Ex.: R$ 250 por sessão.' },
        { id: 'servico_mais_vende', type: 'text', label: 'Qual serviço você mais quer vender, ou qual dá mais resultado?' }
      ]
    },

    /* ============================ ETAPA 4 ============================= */
    {
      id: 'publico-valor',
      title: 'Público e proposta de valor',
      short: 'Público e valor',
      intro: 'Com estas respostas eu consigo escrever um texto que fala com a pessoa certa, na linguagem certa.',
      fields: [
        { id: 'publico_ideal', type: 'textarea', label: 'Quem é seu cliente ideal?', hint: 'Idade, gênero, região, momento de vida, perfil profissional. Quanto mais detalhe, melhor.', rows: 5 },
        { id: 'dor_principal', type: 'textarea', label: 'Qual é a maior dor ou problema que leva alguém a te procurar?', hint: 'O que essa pessoa está sentindo na pele quando decide procurar você.', rows: 5 },
        { id: 'resultado_buscado', type: 'textarea', label: 'Qual resultado ou transformação o cliente busca?', hint: 'O que ele quer levar de positivo para a vida depois de atender com você.', rows: 5 },
        { id: 'objecoes', type: 'textarea', label: 'Que dúvidas e objeções o cliente costuma ter antes de fechar?', hint: 'Ex.: preço, medo, confiança, falta de tempo, já ter tentado e não funcionado.', rows: 5 },
        { id: 'perguntas_que_ouve', type: 'textarea', label: 'Quais perguntas você mais ouve dos clientes?', hint: 'Pode escrever várias, separadas por vírgula.', rows: 5 },
        { id: 'diferencial_1', type: 'text', label: 'Diferencial 1 frente à concorrência' },
        { id: 'diferencial_2', type: 'text', label: 'Diferencial 2 frente à concorrência' },
        { id: 'diferencial_3', type: 'text', label: 'Diferencial 3 frente à concorrência' },
        { id: 'por_que_escolher', type: 'textarea', label: 'Por que um cliente deveria escolher você e não um concorrente?', rows: 4 },
        {
          id: 'concorrentes', type: 'repeat', label: 'Concorrentes ou referências de mercado',
          hint: 'Opcional. Até 5. Coloque o nome ou o link e o que eles fazem bem ou mal.',
          max: 5, addLabel: 'Adicionar concorrente',
          itemFields: [
            { id: 'nome', type: 'text', label: 'Nome ou link' },
            { id: 'bem', type: 'text', label: 'O que ele faz bem' },
            { id: 'mal', type: 'text', label: 'O que ele faz mal' }
          ]
        },
        {
          id: 'provas_sociais', type: 'multi',
          label: 'Provas sociais e credibilidade',
          hint: 'Marque tudo que você já tem ou pode usar.',
          options: [
            { value: 'depoimentos', label: 'Depoimentos' },
            { value: 'resultados', label: 'Resultados e números' },
            { value: 'casos', label: 'Casos de sucesso' },
            { value: 'certificacoes', label: 'Certificações e formações' },
            { value: 'premios', label: 'Prêmios' },
            { value: 'midia', label: 'Aparições na mídia' },
            { value: 'tempo', label: 'Tempo de mercado' },
            { value: 'quantidade', label: 'Quantidade de clientes atendidos' }
          ]
        },
        { id: 'provas_sociais_detalhe', type: 'textarea', label: 'Detalhe das provas sociais', hint: 'Ex.: atendo há 12 anos, mais de 2.000 consultas, 4.9 estrelas no Google, formada em X pela Y.', rows: 4 },
        { id: 'historia', type: 'textarea', label: 'Sua história e trajetória em poucas linhas', hint: 'De onde você veio, por que escolheu essa profissão, o que te marcou. Ajuda a criar a seção "Sobre" do site.', rows: 5 },
        {
          id: 'tom_voz', type: 'multi', label: 'Tom de voz desejado',
          hint: 'Marque todos que combinam com você.',
          options: [
            { value: 'acolhedor', label: 'Acolhedor' },
            { value: 'formal', label: 'Profissional / formal' },
            { value: 'tecnico', label: 'Técnico' },
            { value: 'descontraido', label: 'Descontraído' },
            { value: 'premium', label: 'Premium / sofisticado' },
            { value: 'direto', label: 'Direto e objetivo' }
          ]
        },
        { id: 'palavras_usar', type: 'text', label: 'Palavras ou expressões que você QUER usar no site', hint: 'Ex.: acolhedora, sem judgement, atendimento humanizado.' },
        { id: 'palavras_evitar', type: 'text', label: 'Palavras ou expressões que você quer EVITAR', hint: 'Ex.: "emagreça rápido", "milagre", "garantia de resultado".' },
        { id: 'slogan', type: 'text', label: 'Slogan ou frase que você já usa', hint: 'Opcional.' },
        {
          type: 'notice', tone: 'warn',
          title: 'Conteúdo sensível',
          text: 'Algumas profissões (CRP, OAB, CFN, CFM, CRO…) restringem depoimentos e publicidade. Confirme as regras do seu conselho antes de usar essas informações.'
        }
      ]
    },

    /* ============================ ETAPA 5 ============================= */
    {
      id: 'servicos',
      title: 'Serviços',
      short: 'Serviços',
      intro: 'Quanto mais serviços você detalhar, mais completa fica a página de serviços do site.',
      fields: [
        { id: 'servico_principal', type: 'text', label: 'Serviço principal', hint: 'O que você mais vende.' },
        {
          id: 'lista_servicos', type: 'repeat',
          label: 'Lista de serviços',
          hint: 'Recomendado de 5 a 15 serviços. Para cada um, diga o nome, uma descrição curta, o preço (ou "A consultar") e a duração.',
          min: 5, max: 15, addLabel: 'Adicionar serviço',
          itemFields: [
            { id: 'nome', type: 'text', label: 'Nome do serviço' },
            { id: 'descricao', type: 'textarea', label: 'Descrição curta', rows: 3, maxlength: 300, placeholder: 'Em poucas frases: o que é, para quem serve e o que entrega.' },
            { id: 'preco', type: 'text', label: 'Preço em R$ ou "A consultar"' },
            { id: 'duracao', type: 'text', label: 'Duração', hint: 'Ex.: 50 minutos, 4 sessões.' },
            { id: 'destaque', type: 'checkbox', label: 'É o serviço principal' },
            { id: 'atendimento', type: 'multi', label: 'Formas de atendimento', inline: true, options: [
              { value: 'presencial', label: 'Presencial' },
              { value: 'online', label: 'Online' },
              { value: 'domicilio', label: 'Domicílio' }
            ] }
          ]
        },
        {
          id: 'formas_atendimento', type: 'multi', label: 'Formas de atendimento oferecidas',
          hint: 'Opcional, para o site em geral.',
          options: [
            { value: 'presencial', label: 'Presencial' },
            { value: 'online', label: 'Online' },
            { value: 'domicilio', label: 'Domicílio' },
            { value: 'whatsapp', label: 'Somente por WhatsApp' }
          ]
        }
      ]
    },

    /* ============================ ETAPA 6 ============================= */
    {
      id: 'contato-online',
      title: 'Contato e presença online',
      short: 'Contato e redes',
      fields: [
        { id: 'contato_telefone', type: 'tel', label: 'Telefone principal', placeholder: '(11) 3333-4444' },
        { id: 'contato_email_dev', type: 'email', required: true, label: 'Seu e-mail para falar comigo', hint: 'É por aqui que eu respondo sobre o projeto.' },
        { id: 'contato_email_comercial', type: 'email', label: 'E-mail comercial que aparecerá no site e no perfil do Google' },
        { id: 'contato_telefone_cliente', type: 'tel', required: true, label: 'Seu telefone ou WhatsApp para contato comigo', hint: 'O número que eu uso para falar com você sobre o projeto.', placeholder: '(11) 90000-0000' },
        { id: 'site_atual', type: 'url', label: 'Site atual', hint: 'Se já tiver um site, cole o endereço. Se não tiver, deixe em branco.' },
        yn('tem_dominio', 'Já tenho domínio?'),
        {
          showIf: function (d) { return d.tem_dominio === 'sim'; },
          id: 'dominio', type: 'text', label: 'Qual é o domínio?', placeholder: 'www.seudominio.com.br'
        },
        yn('tem_hospedagem', 'Já tenho hospedagem?'),
        { id: 'link_agendamento', type: 'url', label: 'Link de agendamento online', hint: 'Calendly, Doctoralia, agenda própria. Se não tiver, deixe em branco.' },
        { id: 'social_instagram', type: 'url', label: 'Instagram', placeholder: 'https://instagram.com/seuperfil' },
        { id: 'social_facebook', type: 'url', label: 'Facebook' },
        { id: 'social_linkedin', type: 'url', label: 'LinkedIn' },
        { id: 'social_youtube', type: 'url', label: 'YouTube' },
        { id: 'social_tiktok', type: 'url', label: 'TikTok' }
      ]
    },

    /* ============================ ETAPA 7 ============================= */
    {
      id: 'endereco',
      title: 'Endereço e área de atendimento',
      short: 'Endereço',
      intro: 'Preencha o CEP e eu tento completar o resto automaticamente. Se não completar, você escreve à mão — sem problema.',
      fields: [
        { id: 'end_cep', type: 'cep', label: 'CEP', placeholder: '00000-000' },
        { id: 'end_logradouro', type: 'text', label: 'Rua ou Avenida' },
        { id: 'end_numero', type: 'text', label: 'Número' },
        { id: 'end_complemento', type: 'text', label: 'Complemento', hint: 'Sala, andar, bloco.' },
        { id: 'end_bairro', type: 'text', label: 'Bairro' },
        { id: 'end_cidade', type: 'text', label: 'Cidade' },
        { id: 'end_estado', type: 'select', label: 'Estado', options: UF.map(function (u) { return { value: u, label: u }; }) },
        { id: 'end_referencia', type: 'text', label: 'Ponto de referência', hint: 'Ex.: ao lado da praça, perto do metrô.' },
        { id: 'end_maps_link', type: 'url', label: 'Link do local no Google Maps', hint: 'Se o local já aparece lá, cole o link.' },
        {
          type: 'group', id: 'grp_endereco_exibicao', label: 'Exibição do endereço',
          fields: [
            yn('end_quero_mostrar', 'Quero mostrar o endereço no perfil'),
            {
              id: 'end_prefiro_ocultar', type: 'yesno',
              label: 'Prefiro ocultar o endereço e mostrar só a área de atendimento',
              hint: 'Só é permitido se você atende no local do cliente. Se recebe clientes no endereço, ele deve aparecer.'
            },
            yn('end_ja_aparece_maps', 'O endereço já aparece no Google Maps'),
            yn('end_outro_negocio_mesmo', 'Já existe outro negócio cadastrado neste mesmo endereço')
          ]
        },
        {
          id: 'areas_atendimento', type: 'textarea',
          label: 'Áreas de atendimento (cidades e bairros)',
          hint: 'Até 20. Se atender em várias cidades ou bairros, liste um por linha. Ex.: Moema, Vila Mariana, Santo Amaro.',
          rows: 5
        }
      ]
    },

    /* ============================ ETAPA 8 ============================= */
    {
      id: 'horarios',
      title: 'Horários de funcionamento',
      short: 'Horários',
      fields: [
        yn('atende_24h', 'Atendo 24 horas'),
        yn('somente_hora_marcada', 'Atendo somente com hora marcada'),
        {
          id: 'horarios_semana', type: 'hours',
          label: 'Tabela semanal',
          hint: 'Marque os dias que atende e preencha os horários. Se um dia não atende, pode deixar os horários em branco.'
        },
        { id: 'feriados', type: 'holidays', label: 'Feriados e datas especiais', hint: 'O Google usa esses horários nas búsquedas de natal e fim de ano.' }
      ]
    },

    /* ============================ ETAPA 9 ============================= */
    {
      id: 'categorias',
      title: 'Categorias e buscas',
      short: 'Categorias',
      fields: [
        {
          id: 'categoria_principal', type: 'text', required: false,
          label: 'Categoria principal no Google',
          hint: 'É o fator mais importante para aparecer nas buscas. Ex.: Nutricionista, Advogado, Psicólogo, Esteticista.',
          placeholder: 'Ex.: Nutricionista'
        },
        {
          id: 'categorias_secundarias', type: 'textarea',
          label: 'Categorias secundárias (até 9)',
          hint: 'Uma por linha. Ex.: Consultório de nutrição, Academia, Nutrição esportiva.',
          rows: 4
        },
        {
          id: 'termos_buscados', type: 'textarea',
          label: 'Serviços e termos que os clientes mais procuram',
          hint: 'De 5 a 10. Escreva do jeito que a gente fala na busca. Ex.: plano alimentar para emagrecimento, nutrição clínica.',
          rows: 4
        },
        { id: 'como_encontram_hoje', type: 'textarea', label: 'Como os clientes te encontram hoje?', hint: 'Indicação, Instagram, Google, convênios, cartão de visita...', rows: 3 },
        { id: 'concorrentes_admirados', type: 'textarea', label: 'Concorrentes locais que você admira', hint: 'Nomes ou links. Serve de referência de qualidade.', rows: 3 },
        {
          id: 'perfil_descricao', type: 'textarea',
          label: 'Descrição do negócio para o perfil',
          hint: 'Conte o que você faz, para quem e seus diferenciais. Sem links, telefones, preços ou frases promocionais.',
          rows: 6, maxlength: 750,
          placeholder: 'Nutrição clínica e emagrecimento com acompanhamento personalizado, atende na zona sul de São Paulo e online.'
        },
        {
          id: 'perfil_descricao_delegar', type: 'checkbox',
          label: 'Não quero escrever, prefiro que você redija',
          hint: 'Se marcar, deixo este campo em branco e escrevo por você com base no resto do briefing.'
        }
      ]
    },

    /* ============================ ETAPA 10 ============================ */
    {
      id: 'atributos',
      title: 'Atributos e comodidades',
      short: 'Comodidades',
      intro: 'Marque o que for verdade. O Google usa essas informações para mostrar o negócio em buscas mais específicas.',
      fields: [
        grp('ac_lista', 'Acessibilidade', [
          { id: 'entrada_acessivel', label: 'Entrada acessível para cadeira de rodas' },
          { id: 'banheiro_acessivel', label: 'Banheiro acessível' },
          { id: 'estacionamento_acessivel', label: 'Estacionamento acessível' },
          { id: 'elevador', label: 'Elevador ou acesso sem escadas' }
        ]),
        grp('comodidades', 'Comodidades', [
          { id: 'wifi', label: 'Wi-Fi gratuito' },
          { id: 'estacionamento_local', label: 'Estacionamento no local' },
          { id: 'estacionamento_rua', label: 'Estacionamento na rua' },
          { id: 'ar_condicionado', label: 'Ar-condicionado' },
          { id: 'sala_espera', label: 'Sala de espera' },
          { id: 'banheiro_clientes', label: 'Banheiro para clientes' }
        ]),
        grp('pagamentos', 'Formas de pagamento', [
          { id: 'dinheiro', label: 'Dinheiro' },
          { id: 'pix', label: 'Pix' },
          { id: 'cartao_debito', label: 'Cartão de débito' },
          { id: 'cartao_credito', label: 'Cartão de crédito' },
          { id: 'boleto', label: 'Boleto ou transferência' },
          { id: 'parcelamento', label: 'Parcelamento' },
          { id: 'convenios', label: 'Aceita convênios ou planos' }
        ], 'Depois de marcar convênios, escreva quais aceita.'),
        {
          showIf: function (d) { return d.pagamentos && d.pagamentos.convenios === 'sim'; },
          id: 'convenios_quais', type: 'text', label: 'Quais convênios ou planos?'
        },
        grp('atendimento_atributos', 'Atendimento', [
          { id: 'agendamento_online', label: 'Agendamento online' },
          { id: 'videochamada', label: 'Atendimento por videochamada' },
          { id: 'a_domicilio', label: 'Atendimento a domicílio' },
          { id: 'primeira_gratuita', label: 'Primeira consulta ou orçamento gratuito' },
          { id: 'urgencias', label: 'Atende urgências' },
          { id: 'criancas', label: 'Atende crianças' },
          { id: 'adolescentes', label: 'Atende adolescentes' },
          { id: 'idosos', label: 'Atende idosos' },
          { id: 'outros_idiomas', label: 'Atende em outros idiomas' }
        ], 'Depois de marcar outros idiomas, escreva quais.'),
        {
          showIf: function (d) { return d.atendimento_atributos && d.atendimento_atributos.outros_idiomas === 'sim'; },
          id: 'idiomas_quais', type: 'text', label: 'Quais idiomas?'
        },
        grp('identidade_negocio', 'Identidade do negócio (opcional)', [
          { id: 'liderado_por_mulheres', label: 'Negócio liderado por mulheres' },
          { id: 'lgbtq_friendly', label: 'Espaço LGBTQ+ friendly' }
        ]),
        { id: 'outros_diferenciais', type: 'textarea', label: 'Outros diferenciais que o cliente deveria saber', rows: 3 }
      ]
    },

    /* ============================ ETAPA 11 ============================ */
    {
      id: 'visual-midia',
      title: 'Identidade visual, fotos e vídeos',
      short: 'Visual e mídia',
      intro: 'O Google recomenda formatos específicos e fotos boas mudam muito a quantidade de cliques. Esta lista é só para eu saber o que você já tem.',
      fields: [
        yn('tem_logo', 'Já tem logo?'),
        {
          id: 'cores_marca', type: 'colors', label: 'Cores da marca',
          hint: 'Digite as cores ou use o seletor. Até 3.',
          slots: 3
        },
        { id: 'fontes_marca', type: 'text', label: 'Fontes da marca', hint: 'Ex.: Montserrat, Playfair Display.' },
        {
          id: 'sites_referencia', type: 'repeat', label: 'Sites que você gosta como referência de visual',
          hint: 'Opcional. Até 3 links.',
          max: 3, addLabel: 'Adicionar referência',
          itemFields: [
            { id: 'url', type: 'url', label: 'Link do site' }
          ]
        },
        { id: 'nao_gosta_sites', type: 'textarea', label: 'O que você não gosta em sites?', hint: 'Cores, layout, textos, velocidade. Me ajuda a não errar na mão.', rows: 3 },
        {
          id: 'midia_checklist', type: 'yesno-group',
          label: 'Checklist de mídia — "Já tenho?"',
          hint: 'Marque o que você já tem. O que faltar, combinamos depois.',
          options: [
            { id: 'logo', label: 'Logo', hint: 'Quadrada, mínimo 250 x 250 px.' },
            { id: 'capa', label: 'Foto de capa', hint: 'Horizontal, recomendado 1080 x 608 px.' },
            { id: 'fachada_dia', label: 'Fachada externa de dia', hint: 'Mostrando a placa e a entrada.' },
            { id: 'fachada_noite', label: 'Fachada à noite', hint: 'Opcional.' },
            { id: 'recepcao', label: 'Recepção ou sala de espera' },
            { id: 'sala', label: 'Sala de atendimento ou interior' },
            { id: 'profissional', label: 'Foto do(a) profissional', hint: 'Rosto visível e boa iluminação.' },
            { id: 'equipe', label: 'Foto da equipe' },
            { id: 'servicos', label: 'Fotos de serviços realizados ou antes e depois', hint: 'Se aplicável e permitido pelo seu conselho.' },
            { id: 'video', label: 'Vídeo curto de apresentação', hint: 'Até 30 s, até 100 MB, mínimo 720p.' },
            { id: 'como_chegar', label: 'Fotos de como chegar no local' }
          ]
        },
        {
          id: 'pasta_midia_link', type: 'url',
          label: 'Link da pasta com fotos e vídeos',
          hint: 'Pode ser Google Drive, Dropbox, o que preferir.'
        },
        {
          type: 'notice', tone: 'info',
          title: 'Como enviar suas fotos',
          text: 'Libere o acesso ao link da pasta com as fotos e vídeos. Se preferir, envie por WhatsApp. Nesta versão do formulário não há upload de arquivos.'
        },
        {
          type: 'notice', tone: 'info',
          title: 'Resolução recomendada pelo Google',
          text: 'Fotos e vídeos em JPG ou PNG, entre 10 KB e 5 MB, no mínimo 720 x 720 px, são recomendados pelo Google e podem mudar ao longo do tempo.'
        }
      ]
    },

    /* ============================ ETAPA 12 ============================ */
    {
      id: 'verificacao',
      title: 'Verificação e documentos',
      short: 'Verificação',
      showIf: function (d) { return d.gmn_existe === 'nao' || d.gmn_existe === 'nao_sei'; },
      intro: 'Só aparece para quem ainda não tem o perfil. Vou criar o Perfil da Empresa no Google para você, e para isso preciso destas informações.',
      fields: [
        {
          type: 'group', id: 'grp_conta_acesso', label: 'Conta e acesso',
          fields: [
            yn('conta_google_proprietaria', 'Tenho uma conta Google (Gmail) que será a proprietária do perfil', 'Prefira uma conta do negócio, não de terceiros. Se não tiver, eu te explico como criar.'),
            { id: 'email_conta_proprietaria', type: 'email', label: 'E-mail da conta proprietária', hint: 'Use uma conta do negócio, não de terceiros.' },
            yn('autoriza_gerente_verificacao', 'Autorizo meu desenvolvedor a ser adicionado como gerente do perfil'),
            { id: 'email_gerente_verificacao', type: 'email', label: 'E-mail do gerente', default: CONFIG.developerManagerEmail }
          ]
        },
        {
          type: 'group', id: 'grp_perfil_existente', label: 'Perfil já existente sem saber',
          fields: [
            yn('perfil_existe_desconhecido', 'Já existe um perfil do meu negócio no Google?', 'Dica: pesquise o nome do seu negócio no Google antes de responder.'),
            yn('perfil_suspenso_antes', 'Já tive um perfil suspenso ou removido?')
          ]
        },
        {
          type: 'group', id: 'grp_verificacao', label: 'Verificação — o que consigo fazer',
          hint: 'O Google oferece diferentes formas de provar que o lugar é seu. Marque as que você consegue fazer.',
          fields: [
            yn('verif_ligacao_sms', 'Receber ligação ou SMS no telefone comercial'),
            yn('verif_email_local', 'Receber e-mail no endereço comercial'),
            yn('verif_video', 'Gravar um vídeo do local', 'Fachada ou placa, interior, materiais de trabalho.'),
            yn('verif_fachada_placa', 'O local tem fachada ou placa com o nome do negócio'),
            yn('verif_correspondencia', 'Receber correspondência no endereço', 'Caso o Google envie cartão postal com um código.')
          ]
        },
        {
          type: 'group', id: 'grp_documentos', label: 'Documentos que tenho',
          hint: 'Aqui é só para eu saber o que você tem disponível. Não preciso que envie foto nem número de nenhum documento.',
          fields: [
            yn('doc_cnpj', 'Cartão CNPJ ou certificado MEI'),
            yn('doc_comprovante_endereco', 'Comprovante de endereço em nome do negócio', 'Conta de luz, água, internet ou telefone em nome do negócio.'),
            yn('doc_alvara', 'Alvará ou licença de funcionamento'),
            yn('doc_aluguel', 'Contrato de aluguel ou escritura'),
            yn('doc_registro_conselho', 'Registro no conselho profissional'),
            yn('doc_cartoes_visita', 'Cartões de visita, papel timbrado ou materiais com o nome do negócio')
          ]
        },
        {
          type: 'notice', tone: 'warn',
          title: 'Nada de documento por aqui',
          text: 'Não preciso que envie CPF, número de documento, foto de documento nem dados bancários. Tudo isso você compartilha direto comigo, em privado, quando for necessário.'
        }
      ]
    },

    /* ============================ ETAPA 13 ============================ */
    {
      id: 'avaliacoes-conteudo',
      title: 'Avaliações e conteúdo',
      short: 'Avaliações',
      fields: [
        {
          id: 'avaliacoes', type: 'yesno-group',
          label: 'Avaliações',
          hint: 'Avaliação é o que mais ajuda o perfil a aparecer nas buscas.',
          options: [
            { id: 'tenho_clientes_satisfeitos', label: 'Tenho clientes satisfeitos para convidar a avaliar' },
            { id: 'consigo_mandar_link', label: 'Consigo enviar o link de avaliação por WhatsApp' },
            { id: 'vou_responder_todas', label: 'Vou responder todas as avaliações' },
            { id: 'conferi_conselho', label: 'Conferi as regras do meu conselho sobre depoimentos e publicidade' }
          ]
        },
        yn('conteudo_mensal', 'Posso enviar novidades, fotos ou avisos para publicar no perfil todo mês?'),
        {
          id: 'faq', type: 'repeat',
          label: 'Perguntas frequentes',
          hint: 'De 3 a 8 perguntas. Estas vão para o site e para o perfil do Google.',
          min: 3, max: 8, addLabel: 'Adicionar pergunta',
          itemFields: [
            { id: 'pergunta', type: 'text', label: 'Pergunta', placeholder: 'Ex.: Vocês atendem por convênio?' },
            { id: 'resposta', type: 'textarea', label: 'Resposta', rows: 3 }
          ]
        }
      ]
    },

    /* ============================ ETAPA 14 ============================ */
    {
      id: 'revisao',
      title: 'Revisão e envio',
      short: 'Revisão',
      final: true,
      fields: [
        { id: 'observacoes_extras', type: 'textarea', label: 'Mais alguma coisa importante que eu deveria saber?', hint: 'Qualquer detalhe, Inclusive algo que você não conseguiu responder acima.', rows: 4 },
        {
          id: 'consentimento_lgpd', type: 'checkbox', required: true,
          label: 'Autorizo o uso dos dados informados para criar meu site e meu Perfil da Empresa no Google.',
          hint: 'Obrigatório por lei. Seus dados não são vendidos nem compartilhados com terceiros.'
        },
        {
          id: 'enviar_copia', type: 'checkbox', default: true,
          label: 'Enviar uma cópia das respostas para o meu e-mail',
          hint: 'Desmarque se preferir não receber.'
        }
      ]
    }
  ];

  return { config: CONFIG, steps: STEPS };
})();

/* O mesmo arquivo é usado pelo navegador (window) e pelo servidor Node (require),
   para que os rótulos do e-mail nunca fiquem fora de sincronia com o formulário. */
if (typeof window !== 'undefined') {
  window.BRIEFING_CONFIG = BRIEFING_CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BRIEFING_CONFIG;
}