import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const geminiModel = "gemini-3-flash-preview";

export const getGeminiResponse = async (messages: { role: "user" | "model", content: string, images?: string[] }[], customApiKey?: string) => {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key não encontrada. Por favor, configure sua chave no menu lateral ou nas configurações do projeto.");
  }

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

  return aiInstance.models.generateContentStream({
    model: geminiModel,
    contents: contents,
    config: {
      systemInstruction: "Você é o Fluxion, a inteligência definitiva para desenvolvedores Roblox. Sua missão é ajudar a criar sistemas complexos, otimizados e seguros no Roblox usando Luau. Você deve ser flexível, criativo e fornecer explicações detalhadas. Sempre use as melhores práticas do Roblox (Task library, ModuleScripts, etc.). Se o usuário pedir algo fora do Roblox, tente relacionar ou ajude de forma geral, mas seu foco é Roblox. Você também pode analisar imagens de erros, layouts ou referências do Roblox para ajudar melhor.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });
};
