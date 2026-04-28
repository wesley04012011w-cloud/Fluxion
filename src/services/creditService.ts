import { Timestamp } from 'firebase/firestore';
import { AppUser } from '../types';

const custos: { [key: string]: number } = {
  "deepseek-r1": 5,
  "gemini-pro": 4,
  "o3-mini": 2,
  "llama": 1
};

export const creditService = {
  getCost: (modeloId: string) => {
    if (modeloId.includes('r1')) return custos["deepseek-r1"];
    if (modeloId.includes('o3-mini')) return custos["o3-mini"];
    if (modeloId.includes('pro')) return custos["gemini-pro"];
    return custos["llama"];
  },

  usarModelo: (modeloId: string, user: AppUser) => {
    const custo = creditService.getCost(modeloId);

    if (user.creditos < custo) {
      return {
        erro: true,
        mensagem: "Créditos insuficientes"
      };
    }

    user.creditos -= custo;
    user.lastUsageTimestamp = Timestamp.now();

    return {
      erro: false,
      restante: user.creditos
    };
  },

  escolherModelo: (modeloId: string, user: AppUser) => {
    if (user.creditos >= creditService.getCost(modeloId)) {
      return modeloId;
    }
    return "llama";
  },

  podeUsar: (user: AppUser) => {
    if (!user.lastUsageTimestamp) return true;
    
    const agora = Date.now();
    const lastUso = user.lastUsageTimestamp.toMillis();

    if (agora - lastUso < 3000) {
      return false; // 3 segundos de cooldown
    }

    return true;
  }
};
