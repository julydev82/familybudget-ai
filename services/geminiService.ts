
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const parseExpenseWithAI = async (text: string, categories: { id: string, name: string }[]) => {
  const categoryNames = categories.map(c => c.name).join(', ');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extrae la información de gasto del siguiente texto en español: "${text}". 
               Las categorías disponibles son: ${categoryNames}. 
               Si no hay coincidencia clara con la categoría, usa la que más se aproxime o devuélvela vacía.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: { type: Type.NUMBER, description: 'Monto del gasto' },
          categoryName: { type: Type.STRING, description: 'Nombre de la categoría coincidente' },
          description: { type: Type.STRING, description: 'Breve descripción de lo que se compró' }
        },
        required: ["amount", "description"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Error parsing AI response", e);
    return null;
  }
};
