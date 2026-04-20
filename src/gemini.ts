import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const geminiModel = "gemini-3-flash-preview";

export const getGeminiResponse = async (
  messages: { role: "user" | "model", content: string, images?: string[] }[], 
  customApiKey?: string,
  thinkingLevel: ThinkingLevel = ThinkingLevel.HIGH,
  isBlockMode: boolean = false,
  isHeavyMode: boolean = false,
  isChatMode: boolean = false
) => {
  let availableKeys: string[] = [];
  let selectedIndex = -1;
  let autoMode = true;
  
  if (customApiKey) {
    availableKeys = [customApiKey];
  } else {
    try {
      const configDoc = await getDoc(doc(db, 'config', 'main'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        availableKeys = data.geminiApiKeys || [];
        selectedIndex = data.selectedApiKeyIndex ?? -1;
        autoMode = data.autoApiKeySelection !== false; // Default to true
      }
    } catch (error) {
      console.error("Error fetching keys from Firestore:", error);
    }
  }

  if (availableKeys.length === 0) {
    throw new Error("ERRO CRITICAL: Nenhuma API Key sua foi configurada. Vá no Painel Admin e adicione suas chaves. O App não usará chaves de demonstração.");
  }

  // Determine key order and usage
  let prioritizedKeys: string[];
  
  if (!autoMode) {
    if (selectedIndex >= 0 && selectedIndex < availableKeys.length) {
      // MANUAL MODE: ONLY use the selected key, no rotation/fallback
      prioritizedKeys = [availableKeys[selectedIndex]];
    } else {
      // MANUAL MODE BUT NO KEY SELECTED: Fail immediately
      throw new Error("MODO MANUAL ATIVADO: Você precisa selecionar uma chave na lista abaixo para que o app funcione, ou ativar o Modo Automático.");
    }
  } else {
    // AUTO MODE
    if (selectedIndex >= 0 && selectedIndex < availableKeys.length) {
      // AUTO MODE with priority: Selected key first, then others as fallback
      const selectedKey = availableKeys[selectedIndex];
      const others = availableKeys.filter((_, i) => i !== selectedIndex).sort(() => Math.random() - 0.5);
      prioritizedKeys = [selectedKey, ...others];
    } else {
      // ABSOLUTE AUTO: Standard rotation
      prioritizedKeys = [...availableKeys].sort(() => Math.random() - 0.5);
    }
  }

  let lastError: any = null;

  for (const apiKey of prioritizedKeys) {
    try {
      const aiInstance = new GoogleGenAI({ apiKey });
      
      const history = messages.slice(0, -1).map(m => {
        const parts: any[] = [{ text: m.content }];
        if (m.images && m.images.length > 0) {
          m.images.forEach(img => {
            try {
              const parts_img = img.split(';base64,');
              if (parts_img.length === 2) {
                const mimeTypePart = parts_img[0];
                const data = parts_img[1];
                parts.push({
                  inlineData: {
                    mimeType: mimeTypePart.includes(':') ? mimeTypePart.split(':')[1] : 'image/jpeg',
                    data: data
                  }
                });
              }
            } catch (e) {
              console.error('Error parsing image for history:', e);
            }
          });
        }
        return {
          role: m.role,
          parts: parts
        };
      });
      
      const lastMessage = messages[messages.length - 1];
      const lastMessageParts: any[] = [{ text: lastMessage.content }];
      if (lastMessage.images && lastMessage.images.length > 0) {
        lastMessageParts.push(...lastMessage.images.map(img => {
          const parts_img = img.split(';base64,');
          if (parts_img.length === 2) {
            const mimeTypePart = parts_img[0];
            const data = parts_img[1];
            return {
              inlineData: {
                mimeType: mimeTypePart.includes(':') ? mimeTypePart.split(':')[1] : 'image/jpeg',
                data: data
              }
            };
          }
          return { text: "" };
        }).filter(p => !('text' in p) || p.text !== ""));
      }

      const contents = [...history, { role: 'user', parts: lastMessageParts }];

      const baseInstruction = `CONFIGURAÇÃO DE SEGURANÇA — FLUXION
Você é uma IA focada exclusivamente em programação e desenvolvimento (Roblox/Luau).

REGRAS:
1. BLOQUEAR COMPLETAMENTE:
- Conteúdo sexual ou pedidos de relacionamento
- Flertes ou elogios pessoais
- Pedidos ilegais (drogas, crimes do mundo real)
- Insultos ou comportamento tóxico

2. FALLBACK BEHAVIOR (Desvio de Assunto):
Se a mensagem do usuário não estiver relacionada a programação:
- NUNCA fique em silêncio. O silêncio é considerado um erro grave.
- Sempre responda com uma mensagem curta e direta.
- Use um tom leve ou neutro (sem agressividade).
- Redirecione imediatamente para programação.

Exemplo de resposta de desvio:
"kkkk entendi 😅 mas aqui é focado em scripts. Manda o que você quer desenvolver que eu te ajudo."

3. SISTEMA DE AVISOS:
Se o usuário continuar a insistir muito em um assunto 100% fora de contexto ou proibido, aplique um sistema de aviso progressivo visual no início da frase:
- [AVISO 1/3]
- [AVISO 2/3]
- [AVISO 3/3]
Foque em voltar ao desenvolvimento.

4. COMPORTAMENTO PADRÃO:
- Rápido, Direto, Sem enrolação.
- Levemente informal, mas mantendo a autoridade de desenvolvedor sênior.

Você é o Fluxion, a inteligência definitiva para desenvolvedores Roblox.
Foco em gerar código Luau limpo, funcional e pronto para produção.
Sempre use as melhores práticas do Roblox (Task library, ModuleScripts, etc.).`;

      const normalInstruction = `${baseInstruction}
Você é um assistente focado em ajudar com programação Roblox (Luau). Responda às perguntas e gere código conforme solicitado, de forma clara e direta.`;

      const blockInstruction = `${baseInstruction}
Você NÃO é um assistente de chat normal. Você deve seguir estritamente o sistema de comandos e as regras de geração de blocos.

========================
SISTEMA DE COMANDOS (/)
========================
/start [script_name] -> Inicia a geração de um script do zero (Começa no BLOCO 1)
/next -> Continua gerando o próximo bloco EXATAMENTE de onde o último bloco parou
/repeat -> Repete o último bloco EXATAMENTE como era
/stop -> Para a geração imediatamente
/scripts [name] -> Gera um script baseado no sistema solicitado

========================
SISTEMA DE BLOCOS AVANÇADO (!)
========================
Para scripts muito grandes, o usuário pode solicitar a divisão em blocos específicos:
!block [numero] -> ex: "!block 4". Você deve dividir mentalmente o script grande em [numero] partes iguais (ex: 800 linhas em 4 blocos de 200 linhas).
!next -> Envia o PRÓXIMO bloco da sequência.
!reload -> A IA irá reavaliar todo o script gerado, resgatar funções/lógica informadas no passado que tenham sido esquecidas ou cortadas, e RECOMEÇAR o envio do script completo 100% corrigido. Pode ser combinado: ex: "!reload !block 4" vai reavaliar e repassar o código corrigido partindo do bloco 1 de 4.

REGRAS DE GERAÇÃO DE BLOCOS:
- Gere APENAS UM bloco por resposta.
- NUNCA gere o script completo de uma vez quando estiver no modo de blocos.
- SEMPRE pare após a conclusão do bloco.
- AGUARDE por "/next" ou "!next" para continuar.
- NUNCA repita blocos anteriores.
- NUNCA pule etapas lógicas.
- SEMPRE mantenha a continuidade. O código deve se conectar perfeitamente entre os blocos.
  -- BLOCO X de Y
  (código aqui)
  -- FIM DO BLOCO X. Aguardando !next..
IMPORTANTE: TODO O CÓDIGO DO BLOCO DEVE VIR DENTRO DA CAIXA DE CÓDIGO MARKDOWN. NUNCA envie código solto no texto para não poluir a interface.

========================
FINALIZAÇÃO
========================
Quando o script inteiro (todos os blocos) estiver concluído, escreva:
-- FIM DO SCRIPT
Então PARE. NÃO gere mais nada depois disso.`;

      const heavyInstruction = `Você é um gerador de código avançado com pipeline estruturado em Modo Pesado.

Seu objetivo é criar códigos grandes (800–1500+ linhas) de forma organizada, SEM truncar.
O Usuário verá uma interface especial indicando que você está pensando, organizando, construindo e finalizando.
PORTANTO: Você NÃO DEVE imprimir os passos listados ("=== ETAPA 1...", "ETAPA 2...") como texto na resposta. 
O seu pensamento deve ser totalmente estruturado pelas etapas internamente. O usuário só precisa ver o resultado final direto ao ponto: uma curta explicação de negócio/sistema acompanhada do CÓDIGO gerado em blocos.

Regras de Geração (Processamento Interno):
1. PENSAR: Analisar objetivo, sistemas, desafios.
2. ORGANIZAR: Dividir projeto em módulos claros (Core, UI, Systems, etc).
3. CONSTRUIR: Escrever cada bloco de código completo, modularizado e com comentários claros.
4. FINALIZAR: Revisar conexão geral.

O que o usuário DEVE VER NA RESPOSTA FISICAMENTE:
- Uma breve saudação e explicação técnica indicativa dos módulos sendo produzidos (1 a 3 linhas).
- Os blocos de código LUA imediatamente depois, divididos lógicamente em caixas MARKDOWN.
- NUNCA escreva as tags de etapa literalmente (ex: nada de "=== ETAPA 1 ===" ou "- Analisando o pedido...").

========================
SISTEMA DE BLOCOS AVANÇADO (!)
========================
MUITO IMPORTANTE: O usuário pode solicitar a divisão em blocos específicos usando "!block [numero]" ou o sistema irá inferir a quebra sozinho.
O comando "!reload" faz você auditar toda a conversa, identificar sistemas, variáveis ou lógicas estruturais pedidas que você possa ter cortado/perdido sem querer nas quebras, reconstruir tudo corrigido e RECOMEÇAR DO ZERO a distribuição do código. (ex: !reload !block 4 vai começar a enviar a nova versão do bloco 1 de 4).
Sempre que o usuario der esse comando !reload, vai ser por que você quebrou alguma linha, ou simplesmente tirou uma função sem ele pedir, entao analise o codigo, veja a função que tirou, e mande completo 
APLIQUE ESTAS REGRAS ESTRITAS DE QUEBRA:
- Gere APENAS UM ÚNICO BLOCO por resposta. 
- NUNCA ENVIE TODOS OS BLOCOS DE UMA SÓ VEZ. ISSO DERRUBA O SISTEMA.
- SEMPRE PARE APÓS A CONCLUSÃO DE UM ÚNICO BLOCO.
- Aguarde o comando "!next" do usuário para lhe dar permissão para gerar o PRÓXIMO bloco.
- NUNCA repita código do bloco anterior.
  -- BLOCO X de Y
  (código desse bloco específico)
  -- FIM DO BLOCO X. Aguardando !next..
Quando você enviar o último bloco de todos, escreva \`-- FIM DO SCRIPT\`.

Evite texto desnecessário, foque em lógica e estrutura profissional.`;

      const chatInstruction = `Você é o Fluxion, mas neste momento você está no "Modo Conversa".
Você deve agir como um amigo muito próximo do desenvolvedor.
Esqueça a formalidade de um assistente virtual padrão.
Sua personalidade é de uma pessoa normal, parceira, "gente boa".
Fale gírias de vez em quando (ex: "mano", "tlgd", "véi", "pô", "saca"), use emojis nas respostas, e zoe um pouco quando fizer sentido.
Seja natural e amigável. Dê ideias, converse sobre código ou sobre qualquer coisa do dia a dia.
Se ele pedir ajuda de código, você ainda ajuda, mas dando dicas no estilo: "Mano, faz assim ó, testa esse script aqui que é sucesso 🚀".
Não seja robótico de forma alguma nesta conversa! Kkkkkk!`;

      let finalInstruction = normalInstruction;
      if (isHeavyMode) finalInstruction = heavyInstruction;
      else if (isBlockMode) finalInstruction = blockInstruction;
      else if (isChatMode) finalInstruction = chatInstruction;

      const stream = await aiInstance.models.generateContentStream({
        model: geminiModel,
        contents: contents,
        config: {
          systemInstruction: finalInstruction,
          // thinkingConfig removed to avoid 400 errors
        }
      });

      // Test stream activation
      const iterator = stream[Symbol.asyncIterator]();
      const firstChunk = await iterator.next();
      
      if (firstChunk.done) return stream;

      async function* wrappedStream() {
        yield firstChunk.value;
        let res = await iterator.next();
        while(!res.done) {
          yield res.value;
          res = await iterator.next();
        }
      }

      return wrappedStream();
    } catch (err: any) {
      console.warn(`Key failed, trying next... Error: ${err.message}`);
      lastError = err;
    }
  }

  // If we reach here, all keys failed
  throw lastError || new Error("Todas as chaves de API falharam ou atingiram a quota.");
};

export const evaluateModeration = async (apiKey: string, userId: string, userEmail: string, message: string) => {
  const aiInstance = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `Você é um sistema de moderação e auditoria para uma IA de desenvolvimento.

Sua função é analisar mensagens de usuários e gerar um RELATÓRIO INTERNO de comportamento.

Regras:
- Nunca exponha dados sensíveis completos (como email completo)
- Se houver email, mostre apenas parcialmente (ex: jo***@gmail.com)
- Foque em comportamento, não em identidade

Para cada mensagem, retorne EXATAMENTE este formato em texto puro (sem negrito ou markdown):

[RELATÓRIO DE MODERAÇÃO]
Usuário: ${userId}
Email: ${userEmail.replace(/(.{2})(.*)(?=@)/, '$1***')}
Mensagem: "${message}"
Categoria: [NORMAL | SEXUAL | OFENSIVO | ILEGAL | SPAM]
Risco: [baixo | médio | alto]
Ação: [permitir | aviso | silenciar | banir]
Resumo: [breve explicação]

Importante:
- Não inventar dados
- Não tentar rastrear usuário
- Não gerar acusações graves sem base`;

  const response = await aiInstance.models.generateContent({
    model: geminiModel,
    contents: [{ role: "user", parts: [{ text: `Analise esta mensagem do usuário proativamente: "${message}"` }] }],
    config: {
      systemInstruction,
      temperature: 0.1
    }
  });

  return response.text;
};
