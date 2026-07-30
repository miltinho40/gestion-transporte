import { KeyValuePipe } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideMessageSquarePlus,
  LucideMic,
  LucideMicOff,
  LucideSend,
  LucideSparkles,
  LucideVolume2,
  LucideVolumeX
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DialogService } from '../../shared/dialog.service';

interface AssistantCard {
  titulo: string;
  valor: string;
  detalle?: string;
}

interface AssistantDraft {
  tipo: 'viaje' | 'mantenimiento' | 'cliente' | 'vehiculo' | 'conductor' | 'preferencia';
  titulo: string;
  campos: Record<string, string>;
  advertencias: string[];
}

interface AssistantAction {
  label: string;
  route: string;
  query: Record<string, string>;
  operacion?: 'abrir' | 'guardar' | 'editar';
}

interface AssistantQueryContext {
  tipo: 'viajes' | 'analitica_viajes';
  filtros: Record<string, string | number | boolean | null>;
}

interface AssistantContext {
  draft?: AssistantDraft;
  action?: AssistantAction;
  consulta?: AssistantQueryContext;
  confirmar?: boolean;
}

interface AssistantResponse {
  tipo: 'consulta' | 'borrador' | 'accion';
  respuesta: string;
  cards: AssistantCard[];
  detalle: string;
  draft?: AssistantDraft;
  actions?: AssistantAction[];
  contexto?: AssistantQueryContext;
  sugerencias: string[];
  conversacion_id?: string;
}

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  text: string;
  cards?: AssistantCard[];
  detail?: string;
  draft?: AssistantDraft;
  actions?: AssistantAction[];
  suggestions?: string[];
}

interface PersistedAssistantMessage {
  id: string;
  rol: 'usuario' | 'asistente';
  contenido: string;
  metadata?: Partial<AssistantResponse> | null;
}

interface PersistedAssistantConversation {
  id: string;
  contexto?: AssistantContext | null;
  mensajes: PersistedAssistantMessage[];
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
      isFinal: boolean;
    };
    length: number;
  };
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

@Component({
  selector: 'app-asistente-page',
  imports: [
    FormsModule,
    KeyValuePipe,
    LucideMessageSquarePlus,
    LucideMic,
    LucideMicOff,
    LucideSend,
    LucideSparkles,
    LucideVolume2,
    LucideVolumeX
  ],
  templateUrl: './asistente-page.component.html',
  styleUrl: './asistente-page.component.scss'
})
export class AsistentePageComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private recognition: SpeechRecognition | null = null;
  private currentDraftContext?: AssistantContext;
  private currentQueryContext?: AssistantQueryContext;
  private conversationId: string | null = null;
  private nextId = 1;

  @ViewChild('messagesEnd') private messagesEnd?: ElementRef<HTMLDivElement>;

  readonly messages = signal<ChatMessage[]>([this.welcomeMessage()]);
  readonly input = signal('');
  readonly loading = signal(false);
  readonly listening = signal(false);
  readonly speechAvailable = signal(
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  readonly autoSpeak = signal(
    typeof window !== 'undefined' && localStorage.getItem('assistant-auto-speak') === 'true'
  );
  readonly error = signal<string | null>(null);

  constructor() {
    this.restoreConversation();
  }

  sendCurrent() {
    const text = this.input().trim();
    if (!text || this.loading()) return;
    this.send(text);
    this.input.set('');
  }

  sendSuggestion(text: string) {
    if (this.loading()) return;
    if (text.trim().toLowerCase().includes('cancelar')) {
      this.currentDraftContext = undefined;
      this.currentQueryContext = undefined;
      this.send(text);
      return;
    }
    const action = this.activeDraftContext()?.action;
    if (action && text.toLowerCase().startsWith('abrir')) {
      this.runAction(action);
      return;
    }
    this.send(text);
  }

  newConversation() {
    this.conversationId = null;
    this.currentDraftContext = undefined;
    this.currentQueryContext = undefined;
    sessionStorage.removeItem(this.conversationStorageKey());
    this.messages.set([this.welcomeMessage()]);
    this.error.set(null);
  }

  toggleVoice() {
    if (!this.speechAvailable()) {
      this.error.set('Tu navegador no permite dictado de voz en esta vista.');
      return;
    }

    if (this.listening()) {
      this.recognition?.stop();
      this.listening.set(false);
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    this.recognition = new Recognition();
    this.recognition.lang = 'es-EC';
    this.recognition.interimResults = false;
    this.recognition.continuous = false;
    this.recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length })
        .map((_, index) => event.results[index][0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        this.input.set(transcript);
        this.send(transcript);
        this.input.set('');
      }
    };
    this.recognition.onerror = () => {
      this.error.set('No pude escuchar bien. Intenta otra vez.');
      this.listening.set(false);
    };
    this.recognition.onend = () => this.listening.set(false);
    this.error.set(null);
    this.listening.set(true);
    this.recognition.start();
  }

  speak(text: string) {
    if (!('speechSynthesis' in window)) {
      this.error.set('Tu navegador no permite leer respuestas en voz alta.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-EC';
    window.speechSynthesis.speak(utterance);
  }

  toggleAutoSpeak() {
    const enabled = !this.autoSpeak();
    this.autoSpeak.set(enabled);
    localStorage.setItem('assistant-auto-speak', String(enabled));
    if (!enabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  async runAction(action: AssistantAction) {
    if (action.operacion === 'guardar' || action.operacion === 'editar') {
      const draft = this.currentDraftContext?.draft;
      if (!draft) {
        this.error.set('El borrador ya no está disponible. Vuelve a prepararlo.');
        return;
      }

      const isPreference = draft.tipo === 'preferencia';
      const isDeactivatePreference = isPreference && action.operacion === 'editar';
      const isOwnerPreference =
        isPreference && action.query['alcance'] === 'propietario';
      const defaultCreateTitle =
        draft.tipo === 'viaje'
          ? 'Guardar viaje'
          : draft.tipo === 'mantenimiento'
            ? 'Guardar mantenimiento'
            : draft.tipo === 'cliente'
              ? 'Guardar cliente'
              : draft.tipo === 'vehiculo'
                ? 'Guardar vehículo'
                : 'Guardar conductor';
      const confirmed = await this.dialog.confirm({
        title: isDeactivatePreference
          ? 'Olvidar preferencia'
          : isPreference
            ? 'Guardar preferencia'
            : action.operacion === 'editar'
              ? 'Confirmar modificación'
              : defaultCreateTitle,
        text: isDeactivatePreference
          ? 'Esta preferencia se desactivará y dejará de aplicarse.'
          : isPreference
            ? isOwnerPreference
              ? 'El asistente aplicará esta preferencia a todos los usuarios del propietario actual.'
              : 'El asistente aplicará esta preferencia solo a tu usuario dentro del propietario actual.'
            : action.operacion === 'editar'
              ? 'Se aplicarán los cambios mostrados en el borrador.'
              : 'Se creará este registro con los datos mostrados en el borrador.',
        confirmText: isDeactivatePreference
          ? 'Sí, olvidar'
          : isPreference
            ? 'Sí, recordar'
            : action.operacion === 'editar'
              ? 'Sí, modificar'
              : 'Sí, guardar',
        cancelText: 'Revisar'
      });
      if (!confirmed) return;

      this.send(
        draft.tipo === 'preferencia' && action.operacion === 'editar'
          ? 'Confirmo olvidar la preferencia.'
          : draft.tipo === 'preferencia'
            ? 'Confirmo guardar la preferencia.'
            : action.operacion === 'editar'
              ? 'Confirmo aplicar los cambios.'
              : draft.tipo === 'viaje'
                ? 'Confirmo guardar el viaje.'
                : draft.tipo === 'mantenimiento'
                  ? 'Confirmo guardar el mantenimiento.'
                  : draft.tipo === 'cliente'
                    ? 'Confirmo guardar el cliente.'
                    : draft.tipo === 'vehiculo'
                      ? 'Confirmo guardar el vehículo.'
                      : 'Confirmo guardar el conductor.',
        { draft, action, confirmar: true }
      );
      return;
    }

    this.currentDraftContext = undefined;
    const isMobile = this.router.url.startsWith('/movil');
    const editId = action.query['edit'] ?? action.query['editId'];
    const route =
      isMobile && action.route === '/app/viajes' && editId
        ? `/movil/viajes/${editId}/editar`
        : isMobile && action.route === '/app/mantenimientos' && editId
          ? `/movil/mantenimientos/${editId}/editar`
          : isMobile && action.route === '/app/viajes'
            ? '/movil/viajes/nuevo'
            : isMobile && action.route === '/app/mantenimientos'
              ? '/movil/mantenimientos/nuevo'
              : action.route;
    const returnUrl = isMobile ? '/movil/asistente' : '/app/asistente';
    const queryParams = editId
      ? { returnUrl }
      : {
          ...action.query,
          returnUrl
        };

    void this.router.navigate([route], { queryParams });
  }

  private send(text: string, contextOverride?: AssistantContext) {
    this.error.set(null);
    this.loading.set(true);
    this.pushMessage({ role: 'user', text });
    const normalized = text.trim().toLowerCase();
    const contexto = normalized.includes('cancelar') ? undefined : contextOverride ?? this.activeContext();

    this.api
      .post<AssistantResponse>('/asistente/mensaje', {
        mensaje: text,
        contexto,
        conversacion_id: this.conversationId ?? undefined,
        canal: this.router.url.startsWith('/movil') ? 'movil' : 'web'
      })
      .subscribe({
      next: (response) => {
        if (response.conversacion_id) {
          this.conversationId = response.conversacion_id;
          sessionStorage.setItem(this.conversationStorageKey(), response.conversacion_id);
        }
        this.currentDraftContext =
          response.draft && response.actions?.[0]
            ? {
                draft: response.draft,
                action: response.actions[0]
              }
            : undefined;
        this.currentQueryContext = response.contexto ?? this.currentQueryContext;
        this.pushMessage({
          role: 'assistant',
          text: response.respuesta,
          cards: response.cards,
          detail: response.detalle,
          draft: response.draft,
          actions: response.actions,
          suggestions: response.sugerencias
        });
        this.loading.set(false);
        if (this.autoSpeak()) {
          this.speak(response.respuesta);
        }
        const openAction = response.tipo === 'accion'
          ? response.actions?.find((action) => action.operacion === 'abrir')
          : undefined;
        if (openAction) {
          void this.runAction(openAction);
        }
      },
      error: (err) => {
        this.pushMessage({
          role: 'assistant',
          text: err?.error?.message ?? 'No pude procesar esa solicitud todavía.',
          suggestions: [
            '¿Qué viajes están pendientes de cobro?',
            'Muéstrame mantenimientos de este mes',
            'Revisa cierre semana 26'
          ]
        });
        this.loading.set(false);
      }
      });
  }

  private pushMessage(message: Omit<ChatMessage, 'id'>) {
    this.messages.update((current) => [...current, { ...message, id: this.nextId++ }]);
    setTimeout(() => this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  private activeDraftContext(): AssistantContext | undefined {
    return this.currentDraftContext;
  }

  private activeContext(): AssistantContext | undefined {
    const draftContext = this.activeDraftContext();
    if (draftContext) return draftContext;
    return this.currentQueryContext ? { consulta: this.currentQueryContext } : undefined;
  }

  private restoreConversation() {
    const conversationId = sessionStorage.getItem(this.conversationStorageKey());
    if (!conversationId) return;

    this.api
      .get<PersistedAssistantConversation>(`/asistente/conversaciones/${conversationId}`)
      .subscribe({
        next: (conversation) => {
          this.conversationId = conversation.id;
          this.currentDraftContext =
            conversation.contexto?.draft && conversation.contexto.action
              ? {
                  draft: conversation.contexto.draft,
                  action: conversation.contexto.action
                }
              : undefined;
          this.currentQueryContext = conversation.contexto?.consulta;

          const history = conversation.mensajes.map((message) => ({
            id: message.id,
            role: message.rol === 'usuario' ? ('user' as const) : ('assistant' as const),
            text: message.contenido,
            cards: message.metadata?.cards,
            detail: message.metadata?.detalle,
            draft: message.metadata?.draft,
            actions: message.metadata?.actions,
            suggestions: message.metadata?.sugerencias
          }));
          this.messages.set(history.length ? history : [this.welcomeMessage()]);
        },
        error: () => {
          sessionStorage.removeItem(this.conversationStorageKey());
          this.conversationId = null;
        }
      });
  }

  private conversationStorageKey() {
    const userId = this.auth.usuario()?.id ?? 'anon';
    const ownerId = this.auth.contexto()?.propietario_id ?? 'sin-propietario';
    const channel = this.router.url.startsWith('/movil') ? 'movil' : 'web';
    return `assistant_conversation_${userId}_${ownerId}_${channel}`;
  }

  private welcomeMessage(): ChatMessage {
    return {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola. Puedo consultar viajes pendientes, mantenimientos, cierres semanales y proveedores. También puedo preparar borradores y recordar preferencias confirmadas.',
      suggestions: [
        '¿Qué viajes están pendientes de cobro?',
        'Muéstrame mantenimientos de este mes',
        'Revisa cierre semana 26',
        'Crea un mantenimiento de aceite para hoy',
        '¿Qué recuerdas de mí?'
      ]
    };
  }
}
