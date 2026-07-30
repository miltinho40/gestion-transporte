import { createHmac } from 'node:crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { JwtPayload } from '../../config/jwt.js';
import type { AsistenteMensajeInput } from './asistente.schema.js';
import {
  assistantToolCatalog,
  assistantToolsAllowedForUser,
  selectAssistantTool
} from './asistente.tools.js';
import type {
  AssistantToolDefinition,
  AssistantToolName
} from './asistente.tools.js';

export interface AssistantInterpretation {
  tool: AssistantToolDefinition;
  message: string;
  parameters?: AssistantExtractedParameters;
  provider: 'rules' | 'openai';
  model?: string;
  confidence?: number;
  fallbackReason?: string;
  responseId?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export const assistantParameterNames = [
  'fecha_salida',
  'fecha_mantenimiento',
  'cliente',
  'vehiculo',
  'conductor',
  'origen',
  'destino',
  'tipo_carga',
  'capacidad',
  'viaticos',
  'precio_flete',
  'numeros_guia_remision',
  'tipo_mantenimiento',
  'costo_total',
  'semana',
  'anio',
  'limite',
  'estado_cobro',
  'proveedor',
  'ruc_cedula',
  'telefono',
  'email',
  'contacto_nombre',
  'direccion',
  'porcentaje_comision',
  'placa',
  'marca',
  'modelo',
  'color',
  'anio',
  'toneladas',
  'kilometraje_actual',
  'rendimiento_km_galon',
  'categoria_peaje',
  'estado',
  'facturable',
  'cedula',
  'fecha_nacimiento',
  'numero_licencia',
  'fecha_caducidad_licencia',
  'sueldo_semanal',
  'metrica',
  'agrupar_por',
  'operacion',
  'orden'
] as const;

export type AssistantParameterName = (typeof assistantParameterNames)[number];
export type AssistantExtractedParameters = Partial<
  Record<AssistantParameterName, string>
>;

interface AssistantModelClient {
  responses: {
    create: (params: unknown) => Promise<{
      output_text: string;
      id?: string;
      model?: string;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      } | null;
    }>;
  };
}

interface ModelInterpretation {
  tool: AssistantToolName;
  canonical_message: string;
  confidence: number;
  parameters: Array<{
    name: AssistantParameterName;
    value: string;
  }>;
}

const modelInterpretationSchema = z.object({
  tool: z.string().min(1),
  canonical_message: z.string().trim().min(1).max(1200),
  confidence: z.number().min(0).max(1),
  parameters: z
    .array(
      z.object({
        name: z.enum(assistantParameterNames),
        value: z.string().trim().min(1).max(240)
      })
    )
    .max(30)
    .default([])
});

const toolDescriptions: Record<AssistantToolName, string> = {
  interpretar_solicitud: 'Solicitud general, ambigua o fuera de las capacidades actuales.',
  consultar_viajes: 'Consultar viajes propios, facturacion, utilidad o historial.',
  consultar_viajes_pendientes: 'Consultar viajes propios pendientes o por cobrar.',
  consultar_viajes_proveedor: 'Consultar viajes realizados por proveedores.',
  consultar_mantenimientos: 'Consultar mantenimientos, aceite o historial del vehiculo.',
  consultar_cierre_semanal: 'Consultar un cierre o resumen semanal.',
  analizar_operacion: 'Analizar y comparar metricas de viajes por vehiculo, cliente, conductor o destino.',
  abrir_formulario: 'Abrir un formulario vacio para crear un viaje, cliente, vehiculo o conductor.',
  preparar_cliente: 'Preparar el borrador de un cliente nuevo y completar sus datos.',
  preparar_vehiculo: 'Preparar el borrador de un vehiculo nuevo y completar sus datos.',
  preparar_conductor: 'Preparar el borrador de un conductor nuevo y completar sus datos.',
  preparar_viaje: 'Preparar el borrador de un viaje propio nuevo.',
  preparar_mantenimiento: 'Preparar el borrador de un mantenimiento nuevo.',
  preparar_edicion: 'Preparar la edicion de un viaje o mantenimiento existente.',
  preparar_preferencia: 'Proponer guardar u olvidar una preferencia controlada del usuario.',
  consultar_preferencias: 'Listar las preferencias activas del usuario.',
  cancelar_borrador: 'Cancelar el borrador activo.',
  aplicar_borrador: 'Aplicar un borrador confirmado.',
  aplicar_preferencia: 'Guardar o desactivar una preferencia confirmada.'
};

let openAIClient: AssistantModelClient | undefined;

const dateInEcuador = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return `${value.year}-${value.month}-${value.day}`;
};

const rulesInterpretation = (
  input: AsistenteMensajeInput,
  fallbackReason?: string
): AssistantInterpretation => ({
  tool: selectAssistantTool(input),
  message: input.mensaje,
  provider: 'rules',
  fallbackReason
});

const userSafetyIdentifier = (user: JwtPayload) =>
  createHmac('sha256', env.JWT_SECRET)
    .update(`asistente:${user.usuario_id}`)
    .digest('hex')
    .slice(0, 64);

const getOpenAIClient = () => {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: env.OPENAI_TIMEOUT_MS,
      maxRetries: 1
    }) as unknown as AssistantModelClient;
  }

  return openAIClient;
};

const availableToolsForModel = (user: JwtPayload) =>
  assistantToolsAllowedForUser(user)
    .filter(
      (tool) =>
        tool.name !== 'cancelar_borrador' &&
        tool.name !== 'aplicar_borrador' &&
        tool.name !== 'aplicar_preferencia'
    );

const interpretationInstructions = (tools: AssistantToolDefinition[]) => `
Eres el interprete de un sistema ecuatoriano de gestion de transporte.
Tu unica tarea es clasificar la solicitud y convertirla en un mensaje canonico
en espanol para un motor determinista. No respondas al usuario y no ejecutes acciones.

Reglas:
- Conserva exactamente nombres, placas, fechas, semanas, rutas, guias y valores escritos.
- Extrae los datos identificados en parameters usando solamente los nombres permitidos.
- No confundas cantidades o capacidades con dinero: "7000 cartones" es
  capacidad=7000 y tipo_carga=CARTONES, no precio_flete.
- Extrae precio_flete solo cuando el usuario diga precio, flete, valor del viaje
  o una expresion monetaria inequivoca.
- Extrae viaticos solo del valor asociado a viatico o viaticos.
- Convierte hoy, manana y fechas relativas a YYYY-MM-DD usando fecha_actual.
- Usa el contexto previo solo para completar referencias conversacionales.
- No inventes datos, identificadores, precios ni fechas.
- Si faltan datos, conserva la solicitud; el motor determinista preguntara lo necesario.
- Una solicitud de crear o editar solo prepara un borrador, nunca guarda directamente.
- Si el usuario pide solamente abrir el modal, formulario o pantalla de un registro
  nuevo, usa abrir_formulario. No prepares un borrador ni solicites datos.
- Si la solicitud no encaja con seguridad, usa interpretar_solicitud.
- Para "recuerda que...", "memoriza...", "olvida..." o reglas con "habitual",
  "normalmente" y "predeterminado" usa preparar_preferencia.
- Son preferencias válidas: tipo de carga habitual por cliente, vehículo habitual
  general o por cliente y conductor habitual por vehículo.
- Para "que recuerdas de mi" o "muestra mis preferencias" usa consultar_preferencias.
- Las preferencias solo pueden ser propuestas; el backend pedira confirmacion antes de guardarlas.
- canonical_message debe ser autosuficiente y coherente con la herramienta elegida.
- Si eliges preparar_viaje, inicia canonical_message con "Crear viaje".
- Si eliges preparar_mantenimiento, inicia canonical_message con "Crear mantenimiento".
- Si eliges preparar_cliente, inicia canonical_message con "Crear cliente".
- Para clientes usa cliente como nombre y extrae ruc_cedula, telefono, email,
  contacto_nombre, direccion y porcentaje_comision cuando esten presentes.
- Si eliges preparar_vehiculo, inicia canonical_message con "Crear vehiculo".
- Para vehiculos extrae placa, marca, modelo, color, anio, capacidad, toneladas,
  kilometraje_actual, rendimiento_km_galon, categoria_peaje, estado y facturable.
- Si eliges preparar_conductor, inicia canonical_message con "Crear conductor".
- Para conductores usa conductor como nombre y extrae cedula, telefono, email,
  fecha_nacimiento, numero_licencia, fecha_caducidad_licencia, sueldo_semanal y estado.
- Para preguntas analiticas usa analizar_operacion y extrae metrica, agrupar_por,
  operacion, orden, limite, semana, anio y estado_cobro.
- Metricas permitidas: valor_a_facturar, precio_viaje, utilidad_viajes,
  viaticos, cantidad_viajes y pago_conductor.
- Agrupaciones permitidas: vehiculo, cliente, conductor y destino.
- "facturado" o "a facturar" significa valor_a_facturar; "mas viajes" significa cantidad_viajes.
- "cuanto gano", "pago", "sueldo" o "cuanto recibio" referido a un conductor
  significa pago_conductor. Extrae el nombre en conductor.

Ejemplo:
Mensaje: "Agrega viaje hoy de Transpalfra en OAA1227, Machala a Vinces,
7000 cartones, viatico 135"
Herramienta: preparar_viaje
Parametros: fecha_salida=<fecha_actual>, cliente=Transpalfra,
vehiculo=OAA1227, origen=Machala, destino=Vinces, tipo_carga=cartones,
capacidad=7000, viaticos=135.

Herramientas disponibles:
${tools.map((tool) => `- ${tool.name}: ${toolDescriptions[tool.name]}`).join('\n')}
`.trim();

export const interpretAssistantMessageWithClient = async (
  user: JwtPayload,
  input: AsistenteMensajeInput,
  client: AssistantModelClient
): Promise<AssistantInterpretation> => {
  const tools = availableToolsForModel(user);
  const allowedNames = tools.map((tool) => tool.name);

  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    instructions: interpretationInstructions(tools),
    input: JSON.stringify({
      fecha_actual: dateInEcuador(),
      zona_horaria: 'America/Guayaquil',
      canal: input.canal,
      mensaje: input.mensaje,
      contexto: input.contexto ?? null
    }),
    text: {
      format: {
        type: 'json_schema',
        name: 'interpretacion_asistente',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tool: {
              type: 'string',
              enum: allowedNames
            },
            canonical_message: {
              type: 'string',
              minLength: 1,
              maxLength: 1200
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1
            },
            parameters: {
              type: 'array',
              maxItems: 30,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: {
                    type: 'string',
                    enum: assistantParameterNames
                  },
                  value: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 240
                  }
                },
                required: ['name', 'value']
              }
            }
          },
          required: ['tool', 'canonical_message', 'confidence', 'parameters']
        }
      }
    },
    reasoning: { effort: 'none' },
    max_output_tokens: 500,
    safety_identifier: userSafetyIdentifier(user),
    store: false
  });

  const parsed = modelInterpretationSchema.parse(
    JSON.parse(response.output_text)
  ) as ModelInterpretation;
  const tool = assistantToolCatalog[parsed.tool];

  if (!tool || !allowedNames.includes(parsed.tool)) {
    return rulesInterpretation(input, 'herramienta_no_permitida');
  }

  if (parsed.confidence < env.OPENAI_MIN_CONFIDENCE) {
    return rulesInterpretation(input, 'confianza_baja');
  }

  return {
    tool,
    message: parsed.canonical_message,
    parameters: Object.fromEntries(
      parsed.parameters.map((parameter) => [parameter.name, parameter.value])
    ),
    provider: 'openai',
    model: response.model ?? env.OPENAI_MODEL,
    confidence: parsed.confidence,
    responseId: response.id,
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.total_tokens
        }
      : undefined
  };
};

export const interpretAssistantMessage = async (
  user: JwtPayload,
  input: AsistenteMensajeInput
): Promise<AssistantInterpretation> => {
  if (input.contexto?.confirmar || input.contexto?.draft) {
    return rulesInterpretation(input);
  }

  if (env.AI_PROVIDER !== 'openai') {
    return rulesInterpretation(input);
  }

  if (!env.OPENAI_API_KEY) {
    return rulesInterpretation(input, 'clave_openai_no_configurada');
  }

  try {
    return await interpretAssistantMessageWithClient(
      user,
      input,
      getOpenAIClient()
    );
  } catch {
    return rulesInterpretation(input, 'servicio_openai_no_disponible');
  }
};

export const __testing = {
  availableToolsForModel,
  dateInEcuador,
  interpretationInstructions,
  rulesInterpretation,
  setOpenAIClient: (client: AssistantModelClient | undefined) => {
    openAIClient = client;
  }
};
