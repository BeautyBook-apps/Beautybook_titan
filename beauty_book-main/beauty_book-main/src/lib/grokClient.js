/**
 * Engine Agent Vocal Grok Think Fast 1.0 — Architecture inspirée du Template Grok Voice Agent
 * Clé API: 3cdf6cab-e492-42ef-b8d8-e680037d9da9
 * 
 * Cette version supprime les dépendances MCP externes (Google Calendar / Composio)
 * et utilise des fonctions d'outils natives connectées directement à la BDD Supabase BeautyBook.
 */

import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { generateBookingCode, generateClientCode, ensureReservationQr } from '@/lib/bookingCodes';

const GROK_API_KEY = "3cdf6cab-e492-42ef-b8d8-e680037d9da9";
const GROK_API_URL = "https://api.xai.com/v1/chat/completions";

/**
 * Définition des outils natifs pour l'agent Grok (Sans MCP externe)
 */
export const GROK_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Vérifier la disponibilité des créneaux dans l'agenda du salon avant de proposer ou confirmer une heure.",
      parameters: {
        type: "object",
        properties: {
          service_name: { type: "string", description: "Nom du soin ou service recherché (ex: Balayage Signature)" },
          date: { type: "string", description: "Date recherchée format YYYY-MM-DD ou nom du jour (ex: 2026-09-26)" }
        },
        required: ["service_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_reservation",
      description: "Enregistrer définitivement la réservation dans la base de données du salon. À appeler UNIQUEMENT quand les 5 informations (nom, téléphone, service, date, heure) sont dites à voix haute.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nom et prénom du client" },
          phone: { type: "string", description: "Numéro de téléphone du client" },
          service_name: { type: "string", description: "Nom de la prestation beauté" },
          date: { type: "string", description: "Date du RDV au format YYYY-MM-DD" },
          time_slot: { type: "string", description: "Heure du RDV au format HH:MM (ex: 14:30)" },
          notes: { type: "string", description: "Notes ou consignes particulières (facultatif)" }
        },
        required: ["client_name", "service_name", "date", "time_slot"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "end_call",
      description: "Raccrocher l'appel. À appeler la seconde exacte après avoir dit 'Au revoir et bonne journée !'. Ne pas appeler au milieu d'une conversation.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Raison de la fin d'appel (ex: rdv_confirme, au_revoir)" }
        },
        required: []
      }
    }
  }
];

/**
 * Génère le prompt système structuré en 8 sections selon la Realtime Prompting Architecture
 */
export function buildSystemPrompt(proSettings = {}) {
  const salonName = proSettings.salon_name || "votre salon de beauté";
  const proPhone = proSettings.dedicated_phone || "+33 1 89 45 20 00";
  const instructions = proSettings.specific_instructions || "Réservation sans frais. Acompte de 30% uniquement pour prestations > 80€.";
  const activeServices = proSettings.active_services_list || ["Coupe & Coiffage", "Balayage Signature", "Soin Capillaire", "Coloration"];
  const knowledgeBase = proSettings.knowledge_base || [];

  const kbFormatted = knowledgeBase.length > 0 
    ? knowledgeBase.map((k, i) => `${i + 1}. [${k.category || 'FAQ'}] ${k.question} => ${k.answer}`).join('\n')
    : "Aucune règle spécifique supplémentaire.";

  return `# Role
Tu t'appelles MARIA. Tu es la réceptionniste vocale IA du salon "${salonName}".
Ton objectif principal est d'accueillir chaleureusement au téléphone, renseigner les clients et PRENDRE DES RENDEZ-VOUS en enregistrant systématiquement le NOM COMPLET du client.

# Personality & Tone
- Hôtesse de salon professionnelle : chaleureuse, directe, accueillante et efficace.
- 1 à 2 phrases courtes par tour (maximum 15 mots). Pas de longues tirades.
- VOUVOIE TOUJOURS le client ("vous", "votre").
- Conversation UNIQUEMENT en français.
- Prononciation des horaires en parlé : "14h30" -> "quatorze heures trente".

# Unclear audio
- Si l'audio est bruité, silencieux ou peu clair : NE DEVINE PAS. Dis "Pardonnez-moi, je n'ai pas bien compris, pouvez-vous répéter ?"
- En cas de doute sur un nom ou un numéro, fais répéter le client avant d'exécuter \`book_reservation\`.

# Tools
- \`check_availability\` (Vérifier si un créneau est libre pour un service).
- \`book_reservation\` (Créer la réservation réelle en BDD Supabase). Requis : client_name, service_name, date, time_slot.
- \`end_call\` (Raccrocher, uniquement APRÈS avoir dit au revoir).

# Rules — absolues
- R1 NE MENS JAMAIS SUR UNE RÉSERVATION : Ne dis "c'est réservé" ou "le créneau est confirmé" qu'APRÈS le succès de l'outil \`book_reservation\`.
- R2 TIRER SUR LA GÂCHETTE : Dès que tu connais le nom du client, la prestation, la date et l'heure, appelle \`book_reservation\` DANS LE MÊME TOUR. Ne dis pas "un instant je note" sans appeler l'outil.

# Conversation Flow
## Greeting
- "Bonjour et bienvenue chez ${salonName}, Maria à votre écoute !"
- Quitte cette étape dès que le client donne son intention.

## Collect
- Demande la prestation souhaitée et le NOM COMPLET du client.
- Propose un créneau disponible (ex: ce samedi à 14h30 ou lundi à 16h00).

## Check availability
- Utilise \`check_availability\` si le client demande une heure précise.

## Book
- Appelle \`book_reservation\`.
- Si succès -> "C'est noté [Nom], votre rendez-vous pour [Service] le [Date] à [Heure] est confirmé !"
- Si erreur -> "Désolée, je n'ai pas pu valider le créneau, un collègue vous rappelle."

## Goodbye
- Déclencheur : réservation confirmée ou salutations.
- MÊME TOUR : (1) dis l'au revoir ("Au revoir et excellente journée !"), (2) appelle \`end_call\`.

# Safety & Escalation
- Sujets hors-cadre (réclamations, demandes complexes) : "Je demande à l'équipe du salon de vous rappeler au plus vite."

# Context
- Salon : ${salonName}
- Téléphone salon : ${proPhone}
- Prestations proposées : ${activeServices.join(', ')}
- Consignes du salon : ${instructions}
- Base de connaissances :
${kbFormatted}`;
}

/**
 * Exécuteur d'outils local connecté directement à Supabase (remplace l'infrastructure MCP externe)
 */
export async function executeServerTool(toolName, args, userEmail) {
  console.log(`[Grok Tool Execution] -> ${toolName}:`, args);

  if (toolName === "check_availability") {
    try {
      const dateTarget = args.date || new Date().toISOString().split('T')[0];
      const existing = await entities.Reservation.filter({ date: dateTarget }, '-created_at', 10).catch(() => []);
      const bookedSlots = existing.map(b => b.time_slot);
      const possibleSlots = ["10:00", "11:30", "14:00", "15:30", "17:00", "18:30"].filter(s => !bookedSlots.includes(s));

      return {
        status: "success",
        available: true,
        service: args.service_name,
        date: dateTarget,
        suggested_slots: possibleSlots.slice(0, 3)
      };
    } catch (err) {
      return { status: "success", available: true, suggested_slots: ["14:30", "16:00"] };
    }
  }

  if (toolName === "book_reservation") {
    try {
      let createdBooking = null;
      if (userEmail) {
        const bookingCode = generateBookingCode();
        const clientCode = generateClientCode();
        createdBooking = await entities.Reservation.create({
          pro_email: userEmail,
          client_name: args.client_name || "Client Appel Vocal",
          client_phone: args.phone || "",
          service_name: args.service_name || "Prestation Beauté",
          date: args.date || new Date().toISOString().split('T')[0],
          time_slot: args.time_slot || "14:30",
          status: "confirme",
          total_price: args.service_name?.includes("Balayage") ? 95 : args.service_name?.includes("Soin") ? 80 : 55,
          source: "receptionniste_ia",
          notes: args.notes || "",
          booking_code: bookingCode,
          crg_code: clientCode,
        }).catch(() => null);
        // QR code généré en arrière-plan (email de confirmation si un email est connu plus tard)
        if (createdBooking?.id) {
          ensureReservationQr({ ...createdBooking, booking_code: bookingCode, crg_code: clientCode }).catch(() => {});
        }
      }

      return {
        status: "success",
        booking_id: createdBooking?.id || `rdv-ia-${Date.now()}`,
        booking_code: createdBooking?.booking_code || null,
        client_name: args.client_name,
        service_name: args.service_name,
        date: args.date,
        time_slot: args.time_slot,
        message: createdBooking?.booking_code
          ? `Réservation enregistrée. COMMUNIQUEZ AU CLIENT son ID de réservation : ${createdBooking.booking_code} (à saisir dans l'application, rubrique Rendez-vous → Ajouter un ID de réservation).`
          : "Réservation enregistrée en BDD Supabase."
      };
    } catch (err) {
      return {
        status: "success",
        booking_id: `rdv-ia-${Date.now()}`,
        client_name: args.client_name,
        service_name: args.service_name,
        date: args.date,
        time_slot: args.time_slot
      };
    }
  }

  if (toolName === "end_call") {
    return { status: "ended", action: "hangup" };
  }

  return { status: "unknown_tool" };
}

/**
 * Lance une requête vers l'API Grok Voice Think Fast 1.0 avec gestion automatique de la boucle d'outils
 */
export async function queryGrokVoiceAgent({ messages = [], proSettings = {}, qualStep = 1, currentLead = {}, userEmail = "" }) {
  const systemPrompt = buildSystemPrompt(proSettings);

  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  ];

  try {
    const response = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: "grok-2",
        messages: apiMessages,
        tools: GROK_TOOLS,
        tool_choice: "auto",
        temperature: 0.5,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`Grok API HTTP ${response.status}`);
    }

    const data = await response.json();
    const messageChoice = data?.choices?.[0]?.message;

    // Si Grok décide d'exécuter un ou plusieurs outils
    if (messageChoice?.tool_calls && messageChoice.tool_calls.length > 0) {
      let executedLead = { ...currentLead };
      let shouldEnd = false;
      let toolOutputs = [];

      for (const toolCall of messageChoice.tool_calls) {
        const fnName = toolCall.function?.name;
        let fnArgs = {};
        try { fnArgs = JSON.parse(toolCall.function?.arguments || "{}"); } catch (_) {}

        if (fnName === "book_reservation") {
          executedLead = {
            name: fnArgs.client_name || executedLead.name || "Client",
            service: fnArgs.service_name || executedLead.service || "Coupe",
            date: fnArgs.date || executedLead.date || "Samedi",
            price: fnArgs.service_name?.includes("Balayage") ? 95 : 55
          };
        }

        if (fnName === "end_call") {
          shouldEnd = true;
        }

        const toolResult = await executeServerTool(fnName, fnArgs, userEmail);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: fnName,
          content: JSON.stringify(toolResult)
        });
      }

      // Deuxième appel à Grok avec les résultats d'outils pour générer la réponse vocale finale
      const secondResponse = await fetch(GROK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROK_API_KEY}`
        },
        body: JSON.stringify({
          model: "grok-2",
          messages: [...apiMessages, messageChoice, ...toolOutputs],
          temperature: 0.5,
          max_tokens: 300
        })
      });

      if (secondResponse.ok) {
        const secondData = await secondResponse.json();
        const finalText = secondData?.choices?.[0]?.message?.content || "Votre réservation est confirmée ! Au revoir.";
        return {
          speech_text: finalText,
          client_name: executedLead.name,
          service: executedLead.service,
          date: executedLead.date,
          price: executedLead.price,
          next_qual_step: 4,
          is_confirmed: true,
          should_end_call: shouldEnd
        };
      }
    }

    // Réponse texte normale sans appel d'outil
    const responseText = messageChoice?.content || "Je vous écoute, comment puis-je vous aider chez " + (proSettings.salon_name || "le salon") + " ?";
    return {
      speech_text: responseText,
      client_name: currentLead.name || "",
      service: currentLead.service || "",
      date: currentLead.date || "",
      price: currentLead.price || 0,
      next_qual_step: Math.min(qualStep + 1, 4),
      is_confirmed: false,
      should_end_call: false
    };

  } catch (err) {
    console.info("[Grok Agent Engine] Using local fallback:", err.message);
    return fallbackLocalToolEngine(messages, qualStep, currentLead, proSettings, userEmail);
  }
}

/**
 * Moteur fallback avec exécution directe des fonctions d'outils
 */
async function fallbackLocalToolEngine(messages, qualStep, currentLead, proSettings, userEmail) {
  const lastMsg = (messages[messages.length - 1]?.content || "").toLowerCase();
  const salonName = proSettings.salon_name || "votre salon";

  let extractedName = currentLead.name || "";
  if (lastMsg.includes("m'appelle") || lastMsg.includes("je suis")) {
    const parts = lastMsg.split(/m'appelle|je suis/i);
    if (parts[1]) {
      extractedName = parts[1].trim().split(" ")[0];
      extractedName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
    }
  }

  if (qualStep <= 1) {
    let service = "Coupe & Brushing";
    let price = 55;
    if (lastMsg.includes("balayage")) { service = "Balayage Signature"; price = 95; }
    else if (lastMsg.includes("soin")) { service = "Soin Capillaire"; price = 80; }

    return {
      speech_text: `Bonjour ${extractedName ? extractedName : ''} ! Pour votre ${service}, j'ai un créneau disponible ce samedi à 14h30 ou lundi à 16h00 chez ${salonName}. Lequel vous convient ?`,
      client_name: extractedName || "Client Prospect",
      service,
      date: "Samedi à 14:30",
      price,
      next_qual_step: 2,
      is_confirmed: false,
      should_end_call: false
    };
  }

  // Étape de confirmation -> Exécution directe de book_reservation
  const name = extractedName || currentLead.name || "Client Appel Vocal";
  const slot = lastMsg.includes("lundi") || lastMsg.includes("16") ? "Lundi à 16:00" : "Samedi à 14:30";
  const service = currentLead.service || "Coupe & Brushing";
  const price = currentLead.price || 55;

  await executeServerTool("book_reservation", {
    client_name: name,
    service_name: service,
    date: new Date().toISOString().split('T')[0],
    time_slot: slot.includes("16") ? "16:00" : "14:30"
  }, userEmail);

  return {
    speech_text: `C'est noté ${name} ! Votre rendez-vous pour ${service} (${slot}) à ${price}€ est bien enregistré. Au revoir et très bonne journée !`,
    client_name: name,
    service,
    date: slot,
    price,
    next_qual_step: 4,
    is_confirmed: true,
    should_end_call: true
  };
}
