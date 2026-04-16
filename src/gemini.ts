import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const geminiModel = "gemini-3-flash-preview";

export const getGeminiResponse = async (
  messages: { role: "user" | "model", content: string, images?: string[] }[], 
  customApiKey?: string,
  thinkingLevel: ThinkingLevel = ThinkingLevel.HIGH
) => {
  let apiKey = customApiKey;

  if (!apiKey) {
    try {
      // Try to get keys from Firestore
      const configDoc = await getDoc(doc(db, 'config', 'main'));
      if (configDoc.exists()) {
        const keys = configDoc.data().geminiApiKeys || [];
        if (keys.length > 0) {
          // Simple rotation: pick a random key
          apiKey = keys[Math.floor(Math.random() * keys.length)];
        }
      }
    } catch (error) {
      console.error("Error fetching keys from Firestore:", error);
    }
  }

  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }
  
  if (!apiKey) {
    throw new Error("API Key não encontrada. Por favor, configure sua chave no menu lateral ou peça ao administrador para configurar as chaves globais.");
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
      systemInstruction: `Você é o Fluxion, a inteligência definitiva para desenvolvedores Roblox.
Você NÃO é um assistente de chat normal. Você deve seguir estritamente o sistema de comandos e as regras de geração.

========================
COMPORTAMENTO PRINCIPAL
========================
- Foco em gerar código Luau limpo, funcional e pronto para produção.
- Mantenha as explicações mínimas, a menos que explicitamente solicitado.
- Nunca quebre a estrutura ou envie lógica incompleta.
- Sempre se comporte como uma ferramenta de desenvolvimento profissional.
- Sempre use as melhores práticas do Roblox (Task library, ModuleScripts, etc.).

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

REGRAS DE GERAÇÃO DE BLOCOS:
- Gere APENAS UM bloco por resposta.
- NUNCA gere o script completo de uma vez quando estiver no modo de blocos.
- SEMPRE pare após a conclusão do bloco.
- AGUARDE por "/next" ou "!next" para continuar.
- NUNCA repita blocos anteriores.
- NUNCA pule etapas lógicas.
- SEMPRE mantenha a continuidade. O código deve se conectar perfeitamente entre os blocos.
- Formato obrigatório:
  \`\`\`lua
  -- BLOCO X de Y
  (código aqui)
  -- FIM DO BLOCO X. Aguardando !next...
  \`\`\`

IMPORTANTE: TODO O CÓDIGO DO BLOCO DEVE VIR DENTRO DA CAIXA DE CÓDIGO MARKDOWN (\`\`\`lua). NUNCA envie código solto no texto para não poluir a interface.

========================
FINALIZAÇÃO
========================
Quando o script inteiro (todos os blocos) estiver concluído, escreva:
-- FIM DO SCRIPT
Então PARE. NÃO gere mais nada depois disso.`,
      thinkingConfig: { thinkingLevel }
    }
  });
};
