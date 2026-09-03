/* ==========================================================================
   Language — English and Spanish

   Spanish is a launch requirement under California language access
   obligations (PRD §9.3). It is absent from the client requirements document,
   and it cannot be retrofitted convincingly: it changes copy length, form
   layout and the `lang` attribute screen readers use to choose a voice.

   IMPORTANT: these translations are working drafts written to build and test
   the mechanism. Before any pilot they must be reviewed by a certified
   translator — DMV publishes its own Spanish terminology and a form is a legal
   document, not marketing copy.
   ========================================================================== */

const LANG_KEY = 'fopwa.lang';
const LANGS = ['en', 'es'];

function currentLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (LANGS.includes(saved)) return saved;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : 'en';
}

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.setAttribute('lang', lang);
}

/* t('key') → string in the active language, falling back to English.
   t('key', { n: 3 }) substitutes {n}. */
function t(key, vars) {
  const lang = currentLang();
  let str = (UI[lang] && UI[lang][key]) || (UI.en && UI.en[key]) || key;
  if (vars) Object.keys(vars).forEach(k => { str = str.split('{' + k + '}').join(vars[k]); });
  return str;
}

/* Plural helper — English and Spanish agree on one-vs-many here. */
function plural(n, one, many) { return n === 1 ? t(one) : t(many); }

const UI = {
  en: {
    /* chrome */
    'app.title': 'Field Office',
    'app.subtitle': 'Vehicle Registration & Driver License',
    'app.prototype': 'Prototype',
    'lang.english': 'English',
    'lang.spanish': 'Español',
    'skip.content': 'Skip to main content',

    /* welcome */
    'welcome.eyebrow': 'Welcome',
    'welcome.lede': 'Take your place in the queue and complete your paperwork while you wait. No app to install and no account needed.',
    'welcome.address': 'Address',
    'welcome.today': 'Today',
    'welcome.status': 'Status',
    'welcome.open': 'Open now',
    'welcome.inside': 'Inside this office',
    'welcome.cta': 'Get in line',
    'welcome.waiting': '{n} waiting',
    'welcome.unknownOffice': 'We could not recognise that office code',
    'welcome.unknownOfficeBody': 'The link said “{code}”, which we do not have. We are showing {office}. If you are somewhere else, please ask staff or scan the poster again.',

    /* service selection */
    'service.step1': 'Step 1',
    'service.heading': 'Which service do you need?',
    'service.step2': 'Step 2',
    'service.heading2': 'What brings you in?',
    'service.wait': 'Wait',
    'service.inQueue': 'in queue',
    'service.notSure': 'Not sure? Ask the assistant',
    'service.notSureQ': 'Which service do I need?',
    'service.continue': 'Continue',

    /* checklist */
    'checklist.eyebrow': 'Before you queue',
    'checklist.lede': 'Check what you have with you. You can join the queue either way — but knowing now saves a second visit.',
    'checklist.feesTitle': 'Fees',
    'checklist.feesBody': 'Fees vary by vehicle, county and transaction. The assistant can give you the current figures.',
    'checklist.cta': 'Get my ticket',
    'checklist.missing': 'I’m missing something — what now?',
    'checklist.missingQ': 'I do not have all the documents. Should I still queue?',

    /* ticket */
    'ticket.label': 'Your ticket',
    'ticket.issued': 'issued {time}',
    'ticket.scanHint': 'Show this screen at the counter. Staff can scan it or type your number.',
    'ticket.validUntil': 'Valid until {time} today.',
    'ticket.ahead': 'ahead of you',
    'ticket.estimated': 'estimated wait',
    'ticket.nowServing': 'Now serving',
    'ticket.yourNumber': 'Your number',
    'ticket.now': 'Now',
    'ticket.goCounter': 'Please go to the counter',
    'ticket.calledTitle': 'Your number has been called',
    'ticket.calledBody': 'Please go to the counter now. The technician has your application.',
    'ticket.nearTitle': 'You are next but one',
    'ticket.nearBody': 'Please make your way back to the waiting area.',
    'ticket.stayTitle': 'Stay in the building',
    'ticket.stayBody': 'This prototype cannot notify you once you leave. The notification method is still being decided.',
    'ticket.leave': 'Leave the queue',
    'ticket.leaveConfirm': 'Leave the queue? Your ticket and any answers will be deleted.',

    /* application */
    'app.completeTitle': 'Complete your application',
    'app.reg343Intro': 'Form REG 343 — Application for Title or Registration.',
    'app.timeEstimate': 'About 8 minutes. Everything saves as you type.',
    'app.progressPct': 'You are {pct}% through.',
    'app.start': 'Start application',
    'app.continue': 'Continue application',
    'app.dlIntro': 'The driver license application is completed on the DMV website. We will keep your place in the queue.',
    'app.dlContinue': 'Continue to the application',

    /* form */
    'form.section': 'Section {n} of {total}',
    'form.saved': 'Saved',
    'form.help': 'Ask a question',
    'form.helpQ': 'I have a question about this section',
    'form.back': 'Back',
    'form.previous': 'Previous',
    'form.next': 'Next',
    'form.review': 'Review',
    'form.needsChecking': '{n} entries need checking in this section. You can continue and fix them later.',
    'form.needsChecking1': '1 entry needs checking in this section. You can continue and fix them later.',
    'form.alsoNeed': 'You will also need {form}',
    'form.alsoNeedBody': '{title}. The technician will give you this form at the counter.',
    'form.pleaseNote': 'Please note',

    /* review */
    'review.eyebrow': 'Almost done',
    'review.heading': 'Check your answers',
    'review.complete': 'complete',
    'review.toAnswer': 'still to answer',
    'review.problemsTitle': '{n} entries look incorrect',
    'review.problemsTitle1': '1 entry looks incorrect',
    'review.missingTitle': '{n} questions unanswered',
    'review.missingTitle1': '1 question unanswered',
    'review.missingBody': 'You can still submit. The technician will complete these with you at the counter.',
    'review.allAnswered': 'Everything answered',
    'review.allAnsweredBody': 'The technician will print this for your signature.',
    'review.signTitle': 'You will sign at the counter',
    'review.signBody': 'California law requires this form to be signed in person under penalty of perjury. The technician will print your completed application for signature.',
    'review.submit': 'Submit to the counter',
    'review.keepEditing': 'Keep editing',
    'review.notAnswered': 'Not answered',

    /* submitted */
    'sent.label': 'Application received',
    'sent.at': 'Submitted at {time}',
    'sent.title': 'Your application is waiting at the counter',
    'sent.body': 'When {token} is called, the technician will already have your details on screen.',
    'sent.remaining': 'They will complete {n} remaining questions with you.',
    'sent.remaining1': 'They will complete 1 remaining question with you.',
    'sent.viewAnswers': 'View my answers',

    /* DL hand-off */
    'dl.eyebrow': 'Driver License',
    'dl.heading': 'Complete your application online',
    'dl.body': 'The driver license application is completed on the DMV website. Once you finish, DMV emails you a confirmation number — enter it below and the technician will pull up your application when your number is called.',
    'dl.beforeTitle': 'Before you start',
    'dl.beforeBody': 'You will need a DMV online account with two-factor authentication, your social security number, and about 9 minutes. The DMV session times out after 15 minutes.',
    'dl.open': 'Open the DMV application ↗',
    'dl.newTab': 'Opens in a new tab. Your place in the queue is kept.',
    'dl.confTitle': 'Your confirmation number',
    'dl.confBody': 'Enter it here when you have it.',
    'dl.confLabel': 'Confirmation number',
    'dl.save': 'Save confirmation number',
    'dl.update': 'Update confirmation number',
    'dl.saved': 'Saved against ticket {token}.',
    'dl.privacyTitle': 'We store only this number',
    'dl.privacyBody': 'This app never collects your social security number, date of birth or address. Those stay with DMV.',
    'dl.back': 'Back to my ticket',

    /* expired */
    'expired.eyebrow': 'Ticket closed',
    'expired.heading': 'This ticket is no longer valid',
    'expired.title': 'Your details have been deleted',
    'expired.body': 'Tickets and anything typed into them are removed at the end of each day. Nothing you entered has been kept.',
    'expired.next': 'If you still need to be seen, please take a new ticket. You will need to enter your details again.',
    'expired.restart': 'Start again',

    /* assistant */
    'chat.title': 'Assistant',
    'chat.close': 'Close assistant',
    'chat.placeholder': 'Ask about registration or licences',
    'chat.send': 'Send',
    'chat.yourQuestion': 'Your question',
    'chat.opening': 'I can help with vehicle registration and driver licence questions while you wait. What do you need?',
    'chat.source': 'Source',

    /* announcements */
    'a11y.ticketIssued': 'Ticket {token} issued.',
    'a11y.submitted': 'Application submitted.',
    'a11y.confSaved': 'Confirmation number saved.',
    'a11y.viewChanged': '{heading}'
  },

  es: {
    'app.title': 'Oficina Local',
    'app.subtitle': 'Registro de Vehículos y Licencia de Conducir',
    'app.prototype': 'Prototipo',
    'lang.english': 'English',
    'lang.spanish': 'Español',
    'skip.content': 'Saltar al contenido principal',

    'welcome.eyebrow': 'Bienvenido',
    'welcome.lede': 'Tome su lugar en la fila y complete sus documentos mientras espera. No hay que instalar ninguna aplicación ni crear una cuenta.',
    'welcome.address': 'Dirección',
    'welcome.today': 'Hoy',
    'welcome.status': 'Estado',
    'welcome.open': 'Abierto ahora',
    'welcome.inside': 'Dentro de esta oficina',
    'welcome.cta': 'Tomar su lugar en la fila',
    'welcome.waiting': '{n} en espera',
    'welcome.unknownOffice': 'No reconocimos ese código de oficina',
    'welcome.unknownOfficeBody': 'El enlace decía «{code}», que no tenemos. Le estamos mostrando {office}. Si usted está en otra oficina, pregunte al personal o vuelva a escanear el cartel.',

    'service.step1': 'Paso 1',
    'service.heading': '¿Qué servicio necesita?',
    'service.step2': 'Paso 2',
    'service.heading2': '¿Qué trámite viene a realizar?',
    'service.wait': 'Espera',
    'service.inQueue': 'en la fila',
    'service.notSure': '¿No está seguro? Pregunte al asistente',
    'service.notSureQ': '¿Qué servicio necesito?',
    'service.continue': 'Continuar',

    'checklist.eyebrow': 'Antes de tomar su lugar',
    'checklist.lede': 'Revise lo que trae consigo. Puede tomar su lugar de todos modos, pero saberlo ahora le evita una segunda visita.',
    'checklist.feesTitle': 'Tarifas',
    'checklist.feesBody': 'Las tarifas varían según el vehículo, el condado y el trámite. El asistente puede darle las cifras actuales.',
    'checklist.cta': 'Obtener mi turno',
    'checklist.missing': 'Me falta algo, ¿qué hago?',
    'checklist.missingQ': 'No tengo todos los documentos. ¿Debo esperar en la fila?',

    'ticket.label': 'Su turno',
    'ticket.issued': 'emitido a las {time}',
    'ticket.scanHint': 'Muestre esta pantalla en la ventanilla. El personal puede escanearla o escribir su número.',
    'ticket.validUntil': 'Válido hasta las {time} de hoy.',
    'ticket.ahead': 'personas antes que usted',
    'ticket.estimated': 'espera estimada',
    'ticket.nowServing': 'Atendiendo ahora',
    'ticket.yourNumber': 'Su número',
    'ticket.now': 'Ahora',
    'ticket.goCounter': 'Pase a la ventanilla',
    'ticket.calledTitle': 'Han llamado su número',
    'ticket.calledBody': 'Pase a la ventanilla ahora. El personal tiene su solicitud.',
    'ticket.nearTitle': 'Usted es el siguiente después del actual',
    'ticket.nearBody': 'Por favor regrese a la sala de espera.',
    'ticket.stayTitle': 'Permanezca en el edificio',
    'ticket.stayBody': 'Este prototipo no puede avisarle si usted sale. Todavía se está decidiendo el método de aviso.',
    'ticket.leave': 'Salir de la fila',
    'ticket.leaveConfirm': '¿Salir de la fila? Se eliminarán su turno y sus respuestas.',

    'app.completeTitle': 'Complete su solicitud',
    'app.reg343Intro': 'Formulario REG 343 — Solicitud de Título o Registro.',
    'app.timeEstimate': 'Unos 8 minutos. Todo se guarda mientras escribe.',
    'app.progressPct': 'Ha completado el {pct}%.',
    'app.start': 'Comenzar la solicitud',
    'app.continue': 'Continuar la solicitud',
    'app.dlIntro': 'La solicitud de licencia de conducir se completa en el sitio web del DMV. Le guardaremos su lugar en la fila.',
    'app.dlContinue': 'Ir a la solicitud',

    'form.section': 'Sección {n} de {total}',
    'form.saved': 'Guardado',
    'form.help': 'Hacer una pregunta',
    'form.helpQ': 'Tengo una pregunta sobre esta sección',
    'form.back': 'Atrás',
    'form.previous': 'Anterior',
    'form.next': 'Siguiente',
    'form.review': 'Revisar',
    'form.needsChecking': 'Hay {n} respuestas que conviene revisar en esta sección. Puede continuar y corregirlas más tarde.',
    'form.needsChecking1': 'Hay 1 respuesta que conviene revisar en esta sección. Puede continuar y corregirla más tarde.',
    'form.alsoNeed': 'También necesitará el {form}',
    'form.alsoNeedBody': '{title}. El personal le entregará este formulario en la ventanilla.',
    'form.pleaseNote': 'Tenga en cuenta',

    'review.eyebrow': 'Casi terminado',
    'review.heading': 'Revise sus respuestas',
    'review.complete': 'completado',
    'review.toAnswer': 'sin responder',
    'review.problemsTitle': '{n} respuestas parecen incorrectas',
    'review.problemsTitle1': '1 respuesta parece incorrecta',
    'review.missingTitle': '{n} preguntas sin responder',
    'review.missingTitle1': '1 pregunta sin responder',
    'review.missingBody': 'Aun así puede enviarla. El personal las completará con usted en la ventanilla.',
    'review.allAnswered': 'Todo respondido',
    'review.allAnsweredBody': 'El personal imprimirá el formulario para su firma.',
    'review.signTitle': 'Usted firmará en la ventanilla',
    'review.signBody': 'La ley de California exige que este formulario se firme en persona bajo pena de perjurio. El personal imprimirá su solicitud completada para que la firme.',
    'review.submit': 'Enviar a la ventanilla',
    'review.keepEditing': 'Seguir editando',
    'review.notAnswered': 'Sin responder',

    'sent.label': 'Solicitud recibida',
    'sent.at': 'Enviada a las {time}',
    'sent.title': 'Su solicitud está esperando en la ventanilla',
    'sent.body': 'Cuando llamen al {token}, el personal ya tendrá sus datos en pantalla.',
    'sent.remaining': 'Completarán con usted {n} preguntas pendientes.',
    'sent.remaining1': 'Completarán con usted 1 pregunta pendiente.',
    'sent.viewAnswers': 'Ver mis respuestas',

    'dl.eyebrow': 'Licencia de Conducir',
    'dl.heading': 'Complete su solicitud en línea',
    'dl.body': 'La solicitud de licencia de conducir se completa en el sitio web del DMV. Al terminar, el DMV le enviará por correo electrónico un número de confirmación. Escríbalo aquí abajo y el personal abrirá su solicitud cuando llamen su número.',
    'dl.beforeTitle': 'Antes de comenzar',
    'dl.beforeBody': 'Necesitará una cuenta en línea del DMV con autenticación de dos pasos, su número de seguro social y unos 9 minutos. La sesión del DMV se cierra después de 15 minutos.',
    'dl.open': 'Abrir la solicitud del DMV ↗',
    'dl.newTab': 'Se abre en una pestaña nueva. Su lugar en la fila se mantiene.',
    'dl.confTitle': 'Su número de confirmación',
    'dl.confBody': 'Escríbalo aquí cuando lo tenga.',
    'dl.confLabel': 'Número de confirmación',
    'dl.save': 'Guardar número de confirmación',
    'dl.update': 'Actualizar número de confirmación',
    'dl.saved': 'Guardado con el turno {token}.',
    'dl.privacyTitle': 'Solo guardamos este número',
    'dl.privacyBody': 'Esta aplicación nunca recoge su número de seguro social, su fecha de nacimiento ni su dirección. Esos datos permanecen en el DMV.',
    'dl.back': 'Volver a mi turno',

    'expired.eyebrow': 'Turno cerrado',
    'expired.heading': 'Este turno ya no es válido',
    'expired.title': 'Sus datos han sido eliminados',
    'expired.body': 'Los turnos y todo lo que se escribe en ellos se eliminan al final de cada día. No hemos conservado nada de lo que usted escribió.',
    'expired.next': 'Si todavía necesita ser atendido, tome un turno nuevo. Tendrá que escribir sus datos otra vez.',
    'expired.restart': 'Comenzar de nuevo',

    'chat.title': 'Asistente',
    'chat.close': 'Cerrar el asistente',
    'chat.placeholder': 'Pregunte sobre registro o licencias',
    'chat.send': 'Enviar',
    'chat.yourQuestion': 'Su pregunta',
    'chat.opening': 'Puedo ayudarle con preguntas sobre registro de vehículos y licencias de conducir mientras espera. ¿Qué necesita?',
    'chat.source': 'Fuente',

    'a11y.ticketIssued': 'Turno {token} emitido.',
    'a11y.submitted': 'Solicitud enviada.',
    'a11y.confSaved': 'Número de confirmación guardado.',
    'a11y.viewChanged': '{heading}'
  }
};
