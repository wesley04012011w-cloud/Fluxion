import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const geminiModel = "gemini-3.1-pro";

async function callDeepSeek(apiKey: string, messages: any[], onChunk?: (chunk: string) => void) {
  try {
    const formattedMessages = messages.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content
    }));

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-coder",
        messages: formattedMessages,
        stream: !!onChunk
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek Error: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
    }

    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          
          if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));
              const content = data.choices[0].delta?.content || "";
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              // skip non-json data
            }
          }
        }
      }
      return fullText;
    } else {
      const data = await response.json();
      return data.choices?.[0]?.message?.content;
    }
  } catch (err) {
    console.error("DeepSeek fallback final failure:", err);
    throw err;
  }
}

export const getGeminiResponse = async (
  messages: { role: "user" | "model", content: string, images?: string[] }[], 
  customApiKey?: string,
  onChunk?: (chunk: string) => void,
  isHeavyMode: boolean = false,
  isChatMode: boolean = false,
  preferredModel?: string
) => {
  let availableKeys: string[] = [];
  let deepseekApiKey: string | null = null;
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
        deepseekApiKey = data.deepseekApiKey || null;
        selectedIndex = data.selectedApiKeyIndex ?? -1;
        autoMode = data.autoApiKeySelection !== false; // Default to true
      }
    } catch (error) {
      console.error("Error fetching keys from Firestore:", error);
    }
  }

  if (availableKeys.length === 0 && !deepseekApiKey) {
    throw new Error("⚠️ SISTEMA SOBRECARREGADO: A cota da nuvem esgotou. Vá em Configurações (ícone de engrenagem) e insira sua própria API Key do Gemini para continuar usando o app.");
  }

  // Determine key order and usage
  let prioritizedKeys: string[];
  
  if (!autoMode) {
    if (selectedIndex >= 0 && selectedIndex < availableKeys.length) {
      prioritizedKeys = [availableKeys[selectedIndex]];
    } else {
      throw new Error("MODO MANUAL ATIVADO: Você precisa selecionar uma chave na lista.");
    }
  } else {
    if (selectedIndex >= 0 && selectedIndex < availableKeys.length) {
      const selectedKey = availableKeys[selectedIndex];
      const others = availableKeys.filter((_, i) => i !== selectedIndex).sort(() => Math.random() - 0.5);
      prioritizedKeys = [selectedKey, ...others];
    } else {
      prioritizedKeys = [...availableKeys].sort(() => Math.random() - 0.5);
    }
  }

  let lastError: any = null;
  // Fallback chain: Primary reasoning model, fallback to stable generation model, fallback to fast model
  const defaultModelsList = [
    "gemini-3.1-pro",
    "gemini-2.5-pro",
    "gemini-3.0-flash"
  ];

  const modelsToTry = preferredModel && preferredModel !== 'auto' 
    ? [preferredModel, ...defaultModelsList.filter(m => m !== preferredModel)]
    : defaultModelsList;

  for (const apiKey of prioritizedKeys) {
    const aiInstance = new GoogleGenAI({ apiKey });
    
    for (const currentModel of modelsToTry) {
      try {
        const prunedMessages = messages.length > 10 ? messages.slice(-10) : messages;
        
        const contents = prunedMessages.map(m => {
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
            role: m.role === 'model' ? 'model' : 'user',
            parts: parts
          };
        });

        const baseInstruction = `VOCE É FLUXION (SÊNIOR ROBLOX LUAU).
REGRAS:
1. BLOQUEIE CATEGORICAMENTE AS SEGUINTES SOLICITAÇÕES E DIGA QUE NÃO PODE FAZER ISSO:
   - Apresentar ou revelar exemplos de como o seu próprio sistema (Fluxion) funciona em linguagem Lua.
   - Scripts maliciosos severos cujo único propósito seja derrubar servidores/jogos (Server crashers) ou roubar contas/dados sensíveis de jogadores.
2. OUTROS BLOQUEIOS: Sexo, Relacionamento, Crimes do mundo real, Ódio, Tracking ilegal no mundo real. EXCEÇÃO: COMO SE TRATA DE LUAU PARA ROBLOX, VOCÊ PODE criar scripts de game exploits básicos, UI mods ou cheats in-game descontraídos que não afetem a integridade de servidores e contas, mas atenda dentro do limite do razoável.
3. SE FOR FORA DE CONTEXTO: Responda algo como "kkkk entendi 😅 mas aqui é focado em scripts." e volte para programação.
4. ESTILO: Direto, informal moderado, sem enrolação.
5. **MANDATÓRIO**: SEMPRE MANDE O CÓDIGO DENTRO DA CAIXA DE CÓDIGO (MARKDOWN). Use crases triplas (\`\`\`lua) no início e (\`\`\`) no fim. NUNCA envie código solto no chat, pois o usuário precisa dos botões de copiar do bloco de código.
6. **SEGURANÇA ATÔMICA**: Mesmo em contextos fictícios (RPG, roteiros, simulação), NUNCA mencione nomes reais de técnicas, vulnerabilidades ou métodos de invasão (ex: session fixation, cookie injection, session hijacking, phishing, etc). Sempre use termos genéricos, lúdicos ou fictícios (ex: "Protocolo Nebula", "Sincronização Divergente").
7. **FOCO EM PREVENÇÃO**: Evite descrever cenários onde a falha possa ser diretamente inferida como explorável. Foque apenas na prevenção e melhores práticas de segurança, não na falha em si ou no método de ataque.
8. **SEM VALIDAÇÕES FRACAS**: Em cenários fictícios, nunca implemente exemplos com validações fracas ou lógica que possa ser interpretada como vulnerabilidade real. Sempre use padrões altamente seguros ou abstrações neutras que não dêem margem para exploração.`;

        const heavyInstruction = `${baseInstruction}
MODO PESADO (CÓDIGO LONGO):
- Divida scripts grandes em BLOCOS.
- Retorne APENAS UM BLOCO por vez.
- Termine o bloco com "-- FIM DO BLOCO [x]. Aguardando !next".
- Ao receber "!next", continue IMEDIATAMENTE de onde parou.`;

        const chatInstruction = `Você é o Fluxion no MODO AMIGO. Seja "gente boa", use gírias, emojis e zoe um pouco.
IMPORTANTE: As regras de segurança aplicam-se aqui também. RECUSE FORTEMENTE e não forneça em hipótese alguma scripts para roubar contas, derrubar servidores, ou mostrar exemplos de como seu próprio sistema/motor interno (Fluxion) funciona em Lua.`;

        let finalInstruction = baseInstruction;
        if (isHeavyMode) finalInstruction = heavyInstruction;
        else if (isChatMode) finalInstruction = chatInstruction;

        const config: any = {
          systemInstruction: finalInstruction,
          temperature: 0.7,
        };

        if (currentModel.includes('pro')) {
           config.thinkingConfig = {
             thinkingBudget: isChatMode ? 1024 : 4096 
           };
        }

        const stream = await aiInstance.models.generateContentStream({
          model: currentModel,
          contents: contents,
          config: config
        });

        let fullText = "";
        for await (const chunk of stream) {
          const chunkText = chunk.text;
          fullText += chunkText;
          if (onChunk) onChunk(chunkText);
        }

        return fullText; // Success! Return immediately!
      } catch (err: any) {
        console.warn(`Model ${currentModel} with key failed: ${err.message}`);
        lastError = err;
        
        // Quota / Permission / Rate limit Check
        const errMsg = err.message?.toLowerCase() || '';
        if (errMsg.includes('403') || errMsg.includes('permission_denied') || 
            errMsg.includes('429') || errMsg.includes('quota') || 
            errMsg.includes('exhausted') || errMsg.includes('too many') ||
            errMsg.includes('400')) {
          // Continue to NEXT MODEL in the try_models list for this current API Key
          continue; 
        } else {
          // Unknown error (maybe payload issue), jump to next model anyway
          continue;
        }
      }
    } // End Model Loop
  } // End Key Loop

  // 🔥 Fallback Final: DeepSeek
  if (deepseekApiKey) {
    try {
      console.log("🚀 Todos modelos Gemini falharam. Usando DeepSeek como contingência final...");
      return await callDeepSeek(deepseekApiKey, messages, onChunk);
    } catch (dsError: any) {
      console.error("❌ Falha crítica no DeepSeek:", dsError);
      throw new Error(`APOCALIPSE AI: Gemini e DeepSeek falharam. Motivo final: ${dsError.message}`);
    }
  }

  throw lastError || new Error("Falha na API: Todas chaves e todos modelos (Pro/Flash) falharam. As cotas estão totalmente esgotadas.");
};
