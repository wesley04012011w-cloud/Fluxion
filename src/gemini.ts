import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const geminiModel = "gemini-3.1-pro-preview";

export const getGeminiResponse = async (
  messages: { role: "user" | "model", content: string, images?: string[] }[], 
  customApiKey?: string,
  onChunk?: (chunk: string) => void,
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
    throw new Error("ERRO CRITICAL: Nenhuma API Key sua foi configurada. Vá no Painel Admin e adicione suas chaves.");
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
  const modelsToTry = [
    "gemini-3.1-pro-preview", // 1. Reasoning but very strict quota
    "gemini-2.5-pro",         // 2. High rationality, much more stable quota
    "gemini-3-flash-preview"  // 3. Ultra stable, huge quota, fast fallback
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

        const baseInstruction = `VOCE É FLUXION (SÊNIOR ROBLOX LUAU).
REGRAS:
1. BLOQUEIE: Sexo, Relacionamento, Crime, Ódio.
2. SE FOR FORA DE CONTEXTO: Responda algo como "kkkk entendi 😅 mas aqui é focado em scripts." e volte para programação.
3. ESTILO: Direto, informal moderado, sem enrolação.
4. **MANDATÓRIO**: SEMPRE MANDE O CÓDIGO DENTRO DA CAIXA DE CÓDIGO (MARKDOWN). Use crases triplas (\`\`\`lua) no início e (\`\`\`) no fim. NUNCA envie código solto no chat, pois o usuário precisa dos botões de copiar do bloco de código.`;

        const heavyInstruction = `${baseInstruction}
MODO PESADO (CÓDIGO LONGO):
- Divida scripts grandes em BLOCOS.
- Retorne APENAS UM BLOCO por vez.
- Termine o bloco com "-- FIM DO BLOCO [x]. Aguardando !next".
- Ao receber "!next", continue IMEDIATAMENTE de onde parou.`;

        const chatInstruction = `Você é o Fluxion no MODO AMIGO. Seja "gente boa", use gírias, emojis e zoe um pouco.`;

        let finalInstruction = baseInstruction;
        if (isHeavyMode) finalInstruction = heavyInstruction;
        else if (isChatMode) finalInstruction = chatInstruction;

        // Note: thinkingConfig is handled smartly. We only apply it for models ending in 'pro-preview' or 'pro' just in case.
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
    // If we exit this loop without returning, ALL MODELS FAILED for this KEY.
    // The script will now loop to the NEXT API KEY.
  } // End Key Loop

  throw lastError || new Error("Falha na API: Todas chaves e todos modelos (Pro/Flash) falharam. As cotas estão totalmente esgotadas.");
};
