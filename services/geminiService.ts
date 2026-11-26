import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from "firebase/ai";
import { app } from "../firebase";

// Gemini se invoca a través de Firebase AI Logic: la clave de Gemini vive en
// el servidor de Firebase y nunca se incluye en la app.
const ai = getAI(app, { backend: new GoogleAIBackend() });

const MODEL = 'gemini-3-flash-preview';

export const parseExpenseWithAI = async (text: string, categories: { id: string, name: string }[]) => {
  const categoryNames = categories.map(c => c.name);

  const model = getGenerativeModel(ai, {
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: Schema.object({
        properties: {
          amount: Schema.number({ description: 'Monto del gasto en pesos colombianos' }),
          categoryName: Schema.enumString({ enum: categoryNames, description: 'Categoría que mejor corresponde' }),
          description: Schema.string({ description: 'Breve descripción de lo que se compró' })
        },
        optionalProperties: ["categoryName"]
      })
    }
  });

  const result = await model.generateContent(
    `Extrae la información de gasto del siguiente texto en español: "${text}". ` +
    `Las categorías disponibles son: ${categoryNames.join(', ')}. ` +
    `Elige la categoría que más se aproxime; omítela solo si ninguna tiene relación.`
  );

  try {
    return JSON.parse(result.response.text()) as { amount: number; categoryName?: string; description: string };
  } catch (e) {
    console.error("Error parsing AI response", e);
    return null;
  }
};
