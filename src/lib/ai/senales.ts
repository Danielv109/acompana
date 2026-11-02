/**
 * Red de seguridad sin IA: busca frases de riesgo en lo que dijo el adulto mayor.
 * Se usa SIEMPRE junto con la clasificación por IA; gana el nivel más alto de los dos.
 * Así, si la IA falla o tarda, una frase como "me caí" nunca pasa desapercibida.
 */
export type Nivel = "verde" | "amarillo" | "rojo";

export type Senal = { nivel: Exclude<Nivel, "verde">; motivo: string };

function sinAcentos(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const ROJAS: Array<[RegExp, string]> = [
  [/\bme (cai|caigo|resbale|tropece)\b(?! de (la )?(risa|sueno|gusto))|\bme di un (golpe|madrazo|ranazo)\b/, "Posible caída"],
  [/no (me )?puedo (levantar|parar|mover)/, "No se puede levantar o mover"],
  [/(dolor|duele|aprieta|presion).{0,15}(pecho|corazon)|(pecho|corazon).{0,15}(dolor|duele|aprieta)/, "Dolor en el pecho"],
  [/no puedo respirar|me falta (el )?aire|me ahogo|no me entra (el )?aire/, "Dificultad para respirar"],
  [/no siento (el |la |mi )?(brazo|pierna|cara|lado)|se me (durmio|torcio) (la cara|la boca|el brazo|medio cuerpo)|no puedo hablar bien/, "Posibles señales de embolia"],
  [/desmay|perdi el conocimiento|me desvaneci/, "Desmayo"],
  [/(mucha|harta) sangre|estoy sangrando|vomit(e|o|ando) sangre/, "Sangrado"],
  [/me quiero morir|ya no quiero vivir|quitarme la vida|matarme|mejor me muero|no vale la pena vivir/, "Habla de quitarse la vida"],
  [/(se metieron|entraron|alguien entro) a (la|mi) casa|me (estan )?robando|me asaltaron/, "Posible robo o intrusión"],
  [/me (estan )?extorsion|me amenaz|tienen secuestrad|secuestraron a/, "Posible extorsión"],
];

const AMARILLAS: Array<[RegExp, string]> = [
  [/\bme duele\b|\bdolor\b|\badolorid/, "Menciona dolor"],
  [/marea|mareo|se me va la cabeza|vertigo/, "Mareo"],
  [/no (he )?comido|no tengo hambre|no he desayunado|no he probado bocado/, "No ha comido"],
  [/(no|se me olvido) (me )?(tome|tomar) (la|mi|las|mis) (pastilla|medicina|pildora)/, "No tomó su medicina"],
  [/(muy|bien|re) (triste|sola|solo)|me siento (triste|sola|solo|deprimid|abandonad)|nadie me (habla|visita|quiere)/, "Tristeza o soledad"],
  [/(me|le) (llamaron|hablaron|marcaron|escribieron) (del|de un|de el) (banco|sat|imss|gobierno)/, "Llamada que dice ser del banco o gobierno"],
  [/\bnip\b|contrasena|clave (de|del) (banco|tarjeta|cajero)|numero de (la |mi )?tarjeta|codigo que (me|le) (llego|mandaron)|\btoken\b/, "Le pidieron datos de su tarjeta o banco"],
  [/(gane|ganaste|me gane) un premio|deposit(o|ar|e)|transferencia|me pidieron dinero/, "Posible fraude con dinero"],
  [/fiebre|calentura|escalofrio/, "Fiebre"],
  [/no (he )?dormido|no pude dormir|insomnio/, "No durmió"],
  [/me perdi|no se donde estoy|no me acuerdo (donde|como)/, "Desorientación"],
];

export function detectarSenales(texto: string): Senal[] {
  const t = sinAcentos(texto);
  const encontradas: Senal[] = [];
  for (const [re, motivo] of ROJAS) if (re.test(t)) encontradas.push({ nivel: "rojo", motivo });
  for (const [re, motivo] of AMARILLAS) if (re.test(t)) encontradas.push({ nivel: "amarillo", motivo });
  return encontradas;
}

export function nivelMaximo(...niveles: Nivel[]): Nivel {
  if (niveles.includes("rojo")) return "rojo";
  if (niveles.includes("amarillo")) return "amarillo";
  return "verde";
}
