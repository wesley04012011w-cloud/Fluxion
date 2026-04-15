import { GoogleGenAI } from "@google/genai";

export const geminiModel = "gemini-3.1-pro-preview";

export const getGeminiResponse = async (
  messages: { role: "user" | "model", content: string, images?: string[] }[], 
  apiKeys: string[],
  tone: 'friendly' | 'direct' | 'professional' = 'professional'
) => {
  const keys = apiKeys.length > 0 ? apiKeys : [process.env.GEMINI_API_KEY].filter(Boolean) as string[];
  
  if (keys.length === 0) {
    throw new Error("API Key não encontrada. Por favor, configure suas chaves nas configurações.");
  }

  const toneInstructions = {
    friendly: "Seja amigável, use emojis e encoraje o desenvolvedor.",
    direct: "Seja extremamente direto e conciso. Vá direto ao ponto sem introduções longas.",
    professional: "Mantenha um tom profissional, técnico e detalhado."
  };

  let lastError: any = null;

  for (const apiKey of keys) {
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
          const [mimeTypePart, data] = img.split(';base64,');
          return {
            inlineData: {
              mimeType: mimeTypePart.includes(':') ? mimeTypePart.split(':')[1] : 'image/jpeg',
              data: data
            }
          };
        }));
      }

      const contents = [...history, { role: 'user', parts: lastMessageParts }];

      return await aiInstance.models.generateContentStream({
        model: geminiModel,
        contents: contents,
        config: {
          systemInstruction: `Você é o Fluxion, a inteligência definitiva para desenvolvedores Roblox. Sua missão é ajudar a criar sistemas complexos, otimizados e seguros no Roblox usando Luau. ${toneInstructions[tone]} Sempre use as melhores práticas do Roblox (Task library, ModuleScripts, etc.). Se o usuário pedir algo fora do Roblox, tente relacionar ou ajude de forma geral, mas seu foco é Roblox. Você também pode analisar imagens de erros, layouts ou referências do Roblox para ajudar melhor.`
        }
      });
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message?.toLowerCase() || "";
      
      // If it's a quota error, try next key
      if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('limit')) {
        console.warn(`Quota exceeded for key ${apiKey.slice(0, 5)}... trying next key.`);
        continue;
      }
      
      // If it's a permission denied or other error, we might want to retry with same key or next
      // But user asked to retry automatically for "Permission Denied"
      if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        console.warn(`Permission denied for key ${apiKey.slice(0, 5)}... trying next key.`);
        continue;
      }

      // For other fatal errors, throw immediately
      throw error;
    }
  }

  throw lastError || new Error("Falha ao gerar resposta com todas as chaves disponíveis.");
};
