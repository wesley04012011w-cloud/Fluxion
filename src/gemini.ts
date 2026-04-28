import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { db } from "./firebase";
import { doc, getDoc } from "./firebaseMock";
import { FALLBACK_API_KEYS } from "./apiKeys";

export const geminiModel = "gemini-3.1-pro";

async function callThirdPartyAPI(apiKey: string, modelStr: string, messages: any[], systemInstruction: string, onChunk?: (chunk: string) => void) {
  try {
    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    let endpoint = "https://api.openai.com/v1/chat/completions";
    let headers: any = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };

    if (apiKey.startsWith("sk-or-")) {
      endpoint = "https://openrouter.ai/api/v1/chat/completions";
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "Fluxion AI";
    }

    console.log("Attempting fetch to:", endpoint, "with model:", modelStr);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: modelStr,
        messages: formattedMessages,
        stream: !!onChunk,
        max_tokens: 2048
      })
    });
    console.log("Fetch response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
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
    console.error("OpenRouter failure:", err);
    throw err;
  }
}

async function callDeepSeek(apiKey: string, messages: any[], systemInstruction: string, onChunk?: (chunk: string) => void) {
  try {
    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-coder",
        messages: formattedMessages,
        stream: !!onChunk,
        max_tokens: 2048
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

  if (customApiKey && customApiKey.startsWith('sk-')) {
    throw new Error("As integrações com OpenRouter e DeepSeek estão temporariamente desativadas. Por favor, utilize uma API Key do Google Gemini.");
  }


  let availableKeys: string[] = [];
  let deepseekApiKey: string | null = null;
  
  // Force local key usage.
  if (customApiKey) {
    availableKeys = [customApiKey];
  } else {
    // Check local storage instead of Firestore to avoid reading from DB
    const stored = localStorage.getItem('local_gemini_keys');
    if (stored) {
       availableKeys = JSON.parse(stored);
    }
  }

  // Combine with hardcoded keys if we don't have enough keys or if we want to distribute load
  if (!customApiKey) {
    availableKeys = [...availableKeys, ...FALLBACK_API_KEYS];
    // Remove duplicates
    availableKeys = Array.from(new Set(availableKeys));
  }

  if (availableKeys.length === 0) {
    throw new Error("⚠️ SISTEMA SOBRECARREGADO: Insira sua própria API Key do Gemini nas Configurações para continuar usando o app.");
  }

  // Determine key order 
  const prioritizedKeys = [...availableKeys].sort(() => Math.random() - 0.5);

  let lastError: any = null;
  // Fallback chain: Primary reasoning model, fallback to stable generation model, fallback to fast model
  const modelsToTry = [
    "gemini-2.5-pro",
    "gemini-3.1-pro-preview",
    "gemini-3.0-flash"
  ];

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

        const config: any = {
          systemInstruction: finalInstruction,
          temperature: 0.7,
        };

        const stream = await aiInstance.models.generateContentStream({
          model: currentModel,
          contents: contents,
          config: config
        });

        let fullText = "";
        // Usa o async iterator manualmente para conseguirmos aplicar timeout no next()
        const iterator = stream[Symbol.asyncIterator]();
        
        while (true) {
          const nextPromise = iterator.next();
          
          let timeoutId: any;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Timeout de resposta (60s)')), 60000);
          });
          
          try {
            const result = await Promise.race([nextPromise, timeoutPromise]);
            clearTimeout(timeoutId);
            
            if (result.done) break;
            
            const chunkText = result.value.text || '';
            fullText += chunkText;
            if (onChunk) onChunk(chunkText);
          } catch (error) {
            clearTimeout(timeoutId);
            throw error; // Re-throw to be caught by the outer catch
          }
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
          // If the key is exhausted/rate limited, don't try other models with this SAME key.
          // Break the inner model loop and go to the NEXT API KEY.
          break; 
        } else {
          // Unknown error (maybe specific model issue), jump to next model
          continue;
        }
      }
    } // End Model Loop
  } // End Key Loop

  /*
  // 🔥 Fallback Final: DeepSeek
  if (deepseekApiKey) {
    try {
      console.log("🚀 Todos modelos Gemini falharam. Usando DeepSeek como contingência final...");
      return await callDeepSeek(deepseekApiKey, messages, finalInstruction, onChunk);
    } catch (dsError: any) {
      console.error("❌ Falha crítica no DeepSeek:", dsError);
      throw new Error(`APOCALIPSE AI: Gemini e DeepSeek falharam. Motivo final: ${dsError.message}`);
    }
  }
  */

  throw lastError || new Error("Falha na API: Todas chaves e todos modelos (Pro/Flash) falharam. As cotas estão totalmente esgotadas.");
};
