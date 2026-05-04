/* =========================================================
   Revisión de Programación · Musicala
   Frontend para GitHub Pages + Apps Script + Google Sheets
   Importante: no usa localStorage. Todo se guarda en Sheets.
========================================================= */

(() => {
  "use strict";

  // 1) Después de desplegar Apps Script como Web App, pega aquí la URL terminada en /exec.
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyguRFzxy3iJ3h6FH6jweoCHwPKEPfQt7zyXo6qDeLsz82lSl76GmEQq5UmB0nd-iZtfQ/exec";

  const APP_VERSION = "1.0.0";

  const STATUS_OPTIONS = [
    { value: "realizado", label: "Realizado" },
    { value: "sin_novedad", label: "Sin novedad" },
    { value: "con_novedad", label: "Con novedad" },
    { value: "pendiente", label: "Pendiente" },
    { value: "no_aplica", label: "No aplica" },
    { value: "requiere_seguimiento", label: "Requiere seguimiento" },
  ];

  const CATEGORIES = [
    "Programación",
    "Confirmación",
    "Canje de sesiones",
    "Agenda de estudiante",
    "Cruce docente",
    "Cruce salón",
    "Salón no disponible",
    "Cámara / novedad física",
    "Estudiante inactivo",
    "Clase de cortesía",
    "Tarea académica",
    "Seguimiento comercial",
    "Otro",
  ];

  const PRIORITIES = [
    { value: "baja", label: "Baja" },
    { value: "media", label: "Media" },
    { value: "alta", label: "Alta" },
  ];

  const REVIEW_LABELS = {
    diaria: "Revisión diaria",
    semanal: "Revisión semanal",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    view: "home",
    booted: false,
    loading: false,
    dashboard: null,
    currentReview: null,
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindGlobalEvents();
    renderShellStatus();

    if (isApiMissing()) {
      setApiStatus("Falta configurar API", "warning");
      renderSetup();
      setActiveNav("setup");
      return;
    }

    loadDashboard();
  }

  function bindGlobalEvents() {
    $$(".nav-btn").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.view));
    });

    $("#btnRefresh").addEventListener("click", () => {
      if (state.currentReview) {
        toast("Hay una revisión en curso. Termínala o vuelve al inicio para actualizar.", "error");
        return;
      }
      loadDashboard(true);
    });
  }

  function navigate(view) {
    state.view = view;
    state.currentReview = null;
    setActiveNav(view);

    const renderers = {
      home: renderHome,
      history: renderHistory,
      observations: renderObservations,
      pending: renderPending,
      setup: renderSetup,
    };

    const renderer = renderers[view] || renderHome;
    renderer();
  }

  function setActiveNav(view) {
    $$(".nav-btn").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });
  }

  function isApiMissing() {
    return !APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("PEGAR_AQUI");
  }

  function renderShellStatus() {
    setApiStatus(isApiMissing() ? "API pendiente" : "API configurada", isApiMissing() ? "warning" : "neutral");
  }

  function setApiStatus(text, type = "neutral") {
    const pill = $("#apiStatus");
    pill.textContent = text;
    pill.className = `status-pill status-${type}`;
  }

  async function loadDashboard(forceSetup = false) {
    setActiveNav("home");
    renderLoading("Cargando información desde Google Sheets…");

    try {
      if (forceSetup) await api("setup", {});
      const result = await api("getDashboard", {});
      state.dashboard = result;
      state.booted = true;
      setApiStatus("Conectado a Sheets", "ok");
      renderHome();
    } catch (error) {
      setApiStatus("Error de conexión", "error");
      renderConnectionError(error);
    }
  }

  function renderHome() {
    const data = state.dashboard || {};
    const resumen = data.resumen || {};
    const history = data.historial || [];
    const observations = data.observaciones_abiertas || [];
    const pending = data.pendientes_abiertos || [];

    html(`
      <section class="grid grid-2">
        <article class="card">
          <p class="eyebrow">Nueva tarea</p>
          <h2>Elige el tipo de revisión</h2>
          <p>La diaria ayuda a controlar la operación del día. La semanal revisa toda la semana para anticipar cruces, huecos, salones, canjes y oportunidades de cortesía. Básicamente, menos adivinación administrativa, más sistema.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="btnDaily" type="button">Iniciar revisión diaria</button>
            <button class="btn btn-secondary" id="btnWeekly" type="button">Iniciar revisión semanal</button>
          </div>
        </article>

        <article class="card soft">
          <p class="eyebrow">Resumen</p>
          <h2>Estado operativo</h2>
          <div class="grid grid-3">
            <div class="kpi-card"><strong>${safeNumber(resumen.revisiones_finalizadas)}</strong><span>Revisiones finalizadas</span></div>
            <div class="kpi-card"><strong>${safeNumber(pending.length)}</strong><span>Pendientes abiertos</span></div>
            <div class="kpi-card"><strong>${safeNumber(observations.length)}</strong><span>Observaciones abiertas</span></div>
          </div>
        </article>
      </section>

      <section class="grid grid-2" style="margin-top:16px;">
        <article class="card">
          <div class="card-title-row">
            <div>
              <p class="eyebrow">Últimas revisiones</p>
              <h2>Historial reciente</h2>
            </div>
            <button class="btn btn-ghost" data-go="history" type="button">Ver todo</button>
          </div>
          ${renderHistoryMini(history)}
        </article>

        <article class="card">
          <div class="card-title-row">
            <div>
              <p class="eyebrow">Novedades</p>
              <h2>Observaciones importantes</h2>
            </div>
            <button class="btn btn-ghost" data-go="observations" type="button">Ver observaciones</button>
          </div>
          ${renderObservationMini(observations)}
        </article>
      </section>

      <section class="card" style="margin-top:16px;">
        <div class="card-title-row">
          <div>
            <p class="eyebrow">Seguimiento</p>
            <h2>Pendientes abiertos</h2>
          </div>
          <button class="btn btn-ghost" data-go="pending" type="button">Ver pendientes</button>
        </div>
        ${renderPendingMini(pending)}
      </section>
    `);

    $("#btnDaily").addEventListener("click", () => renderStartForm("diaria"));
    $("#btnWeekly").addEventListener("click", () => renderStartForm("semanal"));
    $$('[data-go]').forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));
  }

  function renderStartForm(tipo) {
    const today = toInputDate(new Date());
    const week = getCurrentWeekRange(new Date());

    html(`
      <section class="card">
        <p class="eyebrow">${REVIEW_LABELS[tipo]}</p>
        <h2>Configurar revisión</h2>
        <p>${tipo === "diaria"
          ? "Esta revisión se enfoca en la operación del día: clases, salones, canjes, cruces y personas por retomar."
          : "Esta revisión mira la semana completa para anticipar novedades y alimentar las revisiones diarias."}</p>

        <form id="startForm" class="form-grid">
          <input type="hidden" name="tipo_revision" value="${tipo}" />

          <div class="field">
            <label for="responsable">Responsable</label>
            <input id="responsable" name="responsable" type="text" placeholder="Ej. Camila, Cata, Alek" required />
          </div>

          <div class="field">
            <label for="sede">Sede / ubicación</label>
            <input id="sede" name="sede" type="text" value="Musicala" required />
          </div>

          ${tipo === "diaria" ? `
            <div class="field">
              <label for="fecha_revision">Fecha revisada</label>
              <input id="fecha_revision" name="fecha_revision" type="date" value="${today}" required />
            </div>

            <div class="field">
              <label for="jornada">Jornada</label>
              <select id="jornada" name="jornada">
                <option value="completa">Completa</option>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
                <option value="noche">Noche</option>
              </select>
            </div>
          ` : `
            <div class="field">
              <label for="semana_inicio">Semana desde</label>
              <input id="semana_inicio" name="semana_inicio" type="date" value="${week.start}" required />
            </div>

            <div class="field">
              <label for="semana_fin">Semana hasta</label>
              <input id="semana_fin" name="semana_fin" type="date" value="${week.end}" required />
            </div>
          `}

          <div class="field" style="grid-column: 1 / -1;">
            <label for="nota_inicial">Nota inicial opcional</label>
            <textarea id="nota_inicial" name="nota_inicial" placeholder="Ej. Semana con alta carga de clases, revisar salones con especial cuidado…"></textarea>
          </div>

          <div class="form-actions" style="grid-column: 1 / -1;">
            <button class="btn btn-primary" type="submit">Crear revisión</button>
            <button class="btn btn-ghost" id="btnCancelStart" type="button">Cancelar</button>
          </div>
        </form>
      </section>
    `);

    $("#btnCancelStart").addEventListener("click", renderHome);
    $("#startForm").addEventListener("submit", startReview);
  }

  async function startReview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formToObject(form);

    try {
      setFormBusy(form, true, "Creando revisión…");
      const result = await api("startRevision", payload);
      state.currentReview = {
        revision: result.revision,
        cards: result.tarjetas || [],
        index: 0,
        answers: {},
        startedAt: Date.now(),
      };

      if (!state.currentReview.cards.length) {
        toast("No hay tarjetas activas para este tipo de revisión. Revisa Configuracion_Tarjetas en Sheets.", "error");
        renderHome();
        return;
      }

      toast("Revisión creada. A marcar tarjetas, ese deporte extremo de la administración moderna.", "ok");
      renderReviewCard();
    } catch (error) {
      toast(error.message, "error");
      setFormBusy(form, false);
    }
  }

  function renderReviewCard() {
    const review = state.currentReview;
    if (!review) return renderHome();

    const card = review.cards[review.index];
    const total = review.cards.length;
    const number = review.index + 1;
    const progress = Math.round(((number - 1) / total) * 100);
    const checklist = splitLines(card.checklist);
    const answer = review.answers[card.id_tarjeta] || {};

    html(`
      <section class="review-layout">
        <article class="card">
          <div class="card-title-row">
            <div>
              <p class="eyebrow">${escapeHTML(REVIEW_LABELS[review.revision.tipo_revision] || "Revisión")}</p>
              <h2>${escapeHTML(card.titulo)}</h2>
            </div>
            <span class="card-number">${number}/${total}</span>
          </div>

          <p>${escapeHTML(card.objetivo || "Revisa este punto y registra el estado correspondiente.")}</p>

          ${card.link_apoyo ? `
            <p><a class="btn btn-secondary" href="${escapeAttr(card.link_apoyo)}" target="_blank" rel="noopener">Abrir herramienta de apoyo</a></p>
          ` : ""}

          <div class="progress-wrap">
            <div class="progress-meta">
              <span>Progreso</span>
              <span>${progress}% completado</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          </div>

          <form id="cardForm">
            <h3>Checklist</h3>
            <ul class="checklist">
              ${checklist.map((item, index) => `
                <li class="check-item">
                  <input id="check_${index}" type="checkbox" name="checklist_completed" value="${escapeAttr(item)}" ${Array.isArray(answer.checklist_completed) && answer.checklist_completed.includes(item) ? "checked" : ""} />
                  <label for="check_${index}">${escapeHTML(item)}</label>
                </li>
              `).join("")}
            </ul>

            <div class="form-grid">
              <div class="field">
                <label for="estado">Estado de la tarjeta</label>
                <select id="estado" name="estado" required>
                  <option value="">Seleccionar…</option>
                  ${STATUS_OPTIONS.map((option) => `<option value="${option.value}" ${answer.estado === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
                </select>
              </div>

              <div class="field">
                <label for="categoria">Categoría de observación</label>
                <select id="categoria" name="categoria">
                  <option value="">Seleccionar si aplica…</option>
                  ${CATEGORIES.map((item) => `<option value="${escapeAttr(item)}" ${answer.categoria === item ? "selected" : ""}>${escapeHTML(item)}</option>`).join("")}
                </select>
              </div>

              <div class="field">
                <label for="prioridad">Prioridad</label>
                <select id="prioridad" name="prioridad">
                  ${PRIORITIES.map((option) => `<option value="${option.value}" ${answer.prioridad === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
                </select>
              </div>

              <div class="field">
                <label for="crear_pendiente">Pendiente</label>
                <select id="crear_pendiente" name="crear_pendiente">
                  <option value="false" ${answer.crear_pendiente !== "true" ? "selected" : ""}>No crear pendiente</option>
                  <option value="true" ${answer.crear_pendiente === "true" ? "selected" : ""}>Crear pendiente</option>
                </select>
              </div>

              <div class="field" id="pendingOwnerField">
                <label for="responsable_asignado">Responsable del pendiente</label>
                <input id="responsable_asignado" name="responsable_asignado" type="text" value="${escapeAttr(answer.responsable_asignado || "")}" placeholder="Ej. Camila" />
              </div>

              <div class="field" id="pendingDueField">
                <label for="fecha_limite">Fecha límite</label>
                <input id="fecha_limite" name="fecha_limite" type="date" value="${escapeAttr(answer.fecha_limite || "")}" />
              </div>

              <div class="field" style="grid-column: 1 / -1;">
                <label for="observacion">Observación</label>
                <textarea id="observacion" name="observacion" placeholder="Registra novedades, decisiones, personas por contactar, cruces, salones bloqueados o cualquier cosa que no deba perderse en el pantano del día.">${escapeHTML(answer.observacion || "")}</textarea>
                <p class="help-text" id="observationHelp">Será obligatoria si marcas Con novedad, Pendiente o Requiere seguimiento.</p>
              </div>

              <div class="field" style="grid-column: 1 / -1;">
                <label for="accion_sugerida">Acción sugerida</label>
                <textarea id="accion_sugerida" name="accion_sugerida" placeholder="Ej. Contactar a la familia, corregir agenda, mover salón, ofrecer clase de cortesía…">${escapeHTML(answer.accion_sugerida || "")}</textarea>
              </div>
            </div>

            <div class="card-actions">
              <button class="btn btn-primary" type="submit">Guardar y continuar</button>
              ${review.index > 0 ? `<button class="btn btn-ghost" id="btnBackCard" type="button">Volver</button>` : ""}
              <button class="btn btn-danger" id="btnAbortReview" type="button">Salir sin finalizar</button>
            </div>
          </form>
        </article>

        <aside class="card soft">
          <p class="eyebrow">Mapa de tarjetas</p>
          <h3>${escapeHTML(review.revision.id_revision)}</h3>
          <p class="help-text">${escapeHTML(review.revision.responsable)} · ${escapeHTML(review.revision.sede)}</p>
          <div class="side-list">
            ${review.cards.map((item, index) => `
              <div class="side-item ${index === review.index ? "is-current" : ""} ${review.answers[item.id_tarjeta] ? "is-done" : ""}">
                <strong>${index + 1}. ${escapeHTML(item.titulo)}</strong>
                <small>${review.answers[item.id_tarjeta]?.estado ? formatStatus(review.answers[item.id_tarjeta].estado) : "Pendiente"}</small>
              </div>
            `).join("")}
          </div>
        </aside>
      </section>
    `);

    const form = $("#cardForm");
    const estado = $("#estado");
    const pendingSelect = $("#crear_pendiente");

    estado.addEventListener("change", () => {
      if (["pendiente", "requiere_seguimiento"].includes(estado.value)) {
        pendingSelect.value = "true";
      }
      togglePendingFields();
    });

    pendingSelect.addEventListener("change", togglePendingFields);
    togglePendingFields();

    form.addEventListener("submit", saveCardAndContinue);
    const back = $("#btnBackCard");
    if (back) back.addEventListener("click", () => { review.index -= 1; renderReviewCard(); });
    $("#btnAbortReview").addEventListener("click", () => {
      state.currentReview = null;
      toast("Saliste de la revisión. Lo guardado hasta ahora queda en Sheets como revisión en proceso.", "ok");
      loadDashboard();
    });
  }

  function togglePendingFields() {
    const shouldShow = $("#crear_pendiente")?.value === "true";
    $("#pendingOwnerField")?.classList.toggle("hidden", !shouldShow);
    $("#pendingDueField")?.classList.toggle("hidden", !shouldShow);
  }

  async function saveCardAndContinue(event) {
    event.preventDefault();
    const review = state.currentReview;
    const form = event.currentTarget;
    const card = review.cards[review.index];
    const payload = formToObject(form);
    const completed = $$('input[name="checklist_completed"]:checked', form).map((input) => input.value);
    const checklistItems = splitLines(card.checklist);

    payload.checklist_completed = completed;
    payload.checklist_total = checklistItems.length;
    payload.checklist_completados = completed.length;

    const needsObservation = ["con_novedad", "pendiente", "requiere_seguimiento"].includes(payload.estado);
    if (needsObservation && !payload.observacion.trim()) {
      toast("Esta tarjeta necesita observación. Sí, toca escribir. El sistema no lee mentes, todavía.", "error");
      $("#observacion").focus();
      return;
    }

    if (payload.crear_pendiente === "true" && !payload.accion_sugerida.trim() && !payload.observacion.trim()) {
      toast("Para crear un pendiente, deja una observación o acción sugerida.", "error");
      $("#accion_sugerida").focus();
      return;
    }

    if (payload.estado === "realizado" && completed.length < checklistItems.length) {
      const continueAnyway = window.confirm("Hay puntos del checklist sin marcar. ¿Guardar como Realizado de todas formas?");
      if (!continueAnyway) return;
    }

    const data = {
      ...payload,
      id_revision: review.revision.id_revision,
      id_tarjeta: card.id_tarjeta,
      tipo_revision: review.revision.tipo_revision,
      orden: card.orden,
      titulo_tarjeta: card.titulo,
      tiempo_estimado: card.tiempo_estimado,
      responsable: review.revision.responsable,
      sede: review.revision.sede,
    };

    try {
      setFormBusy(form, true, "Guardando…");
      await api("saveDetalleRevision", data);
      review.answers[card.id_tarjeta] = payload;

      if (review.index + 1 >= review.cards.length) {
        await finishCurrentReview();
        return;
      }

      review.index += 1;
      renderReviewCard();
      toast("Tarjeta guardada.", "ok");
    } catch (error) {
      toast(error.message, "error");
      setFormBusy(form, false);
    }
  }

  async function finishCurrentReview() {
    const review = state.currentReview;
    const answers = Object.values(review.answers);
    const resumen = buildLocalSummary(review, answers);

    try {
      await api("finishRevision", {
        id_revision: review.revision.id_revision,
        resumen_general: resumen,
        duracion_minutos: Math.max(1, Math.round((Date.now() - review.startedAt) / 60000)),
      });

      state.currentReview = null;
      await loadDashboard();
      renderFinishSummary(resumen);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function renderFinishSummary(summaryText) {
    setActiveNav("home");
    html(`
      <section class="card">
        <p class="eyebrow">Revisión finalizada</p>
        <h2>Resumen guardado</h2>
        <p>La revisión quedó guardada en Google Sheets con sus detalles, observaciones y pendientes. Un pequeño triunfo contra el caos, tampoco nos emocionemos demasiado.</p>
        <textarea readonly>${escapeHTML(summaryText)}</textarea>
        <div class="form-actions">
          <button class="btn btn-primary" id="btnCopySummary" type="button">Copiar resumen</button>
          <button class="btn btn-secondary" id="btnGoHome" type="button">Volver al inicio</button>
        </div>
      </section>
    `);

    $("#btnCopySummary").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(summaryText);
        toast("Resumen copiado.", "ok");
      } catch (_) {
        toast("No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.", "error");
      }
    });
    $("#btnGoHome").addEventListener("click", renderHome);
  }

  function renderHistory() {
    const history = state.dashboard?.historial || [];
    html(`
      <section class="card">
        <div class="card-title-row">
          <div>
            <p class="eyebrow">Historial</p>
            <h2>Revisiones guardadas</h2>
          </div>
          <button class="btn btn-secondary" id="btnReloadHistory" type="button">Actualizar</button>
        </div>
        ${history.length ? renderRevisionTable(history) : emptyState("Todavía no hay revisiones guardadas.")}
      </section>
    `);
    $("#btnReloadHistory").addEventListener("click", async () => {
      await loadDashboard();
      renderHistory();
    });
  }

  function renderObservations() {
    const observations = state.dashboard?.observaciones_abiertas || [];
    html(`
      <section class="card">
        <div class="card-title-row">
          <div>
            <p class="eyebrow">Observaciones</p>
            <h2>Novedades abiertas</h2>
          </div>
          <button class="btn btn-secondary" id="btnReloadObs" type="button">Actualizar</button>
        </div>
        ${observations.length ? renderObservationsTable(observations) : emptyState("No hay observaciones abiertas. Extraño, sospechoso, pero agradable.")}
      </section>
    `);
    $("#btnReloadObs").addEventListener("click", async () => {
      await loadDashboard();
      renderObservations();
    });
  }

  function renderPending() {
    const pending = state.dashboard?.pendientes_abiertos || [];
    html(`
      <section class="card">
        <div class="card-title-row">
          <div>
            <p class="eyebrow">Pendientes</p>
            <h2>Seguimientos abiertos</h2>
          </div>
          <button class="btn btn-secondary" id="btnReloadPending" type="button">Actualizar</button>
        </div>
        ${pending.length ? renderPendingTable(pending) : emptyState("No hay pendientes abiertos. Tal vez el orden existe. Tal vez.")}
      </section>
    `);
    $("#btnReloadPending").addEventListener("click", async () => {
      await loadDashboard();
      renderPending();
    });
  }

  function renderSetup() {
    html(`
      <section class="grid grid-2">
        <article class="card">
          <p class="eyebrow">Configuración</p>
          <h2>Conectar con Google Sheets</h2>
          <p>Este frontend necesita la URL del Web App de Apps Script. Esa URL se pega en <strong>frontend/app.js</strong>, en la constante <strong>APPS_SCRIPT_URL</strong>.</p>
          <code class="setup-code">const APPS_SCRIPT_URL = "https://script.google.com/macros/s/TU_ID/exec";</code>
          <div class="form-actions">
            <button class="btn btn-primary" id="btnSetupSheet" type="button" ${isApiMissing() ? "disabled" : ""}>Preparar hojas en Google Sheets</button>
            <button class="btn btn-secondary" id="btnTestApi" type="button" ${isApiMissing() ? "disabled" : ""}>Probar conexión</button>
          </div>
        </article>

        <article class="card soft">
          <p class="eyebrow">Notas</p>
          <h2>Antes de publicar</h2>
          <p>1. Crea el Google Sheet.<br>2. Pega el archivo Code.gs en Apps Script.<br>3. Ejecuta la función setup una vez.<br>4. Despliega como Web App.<br>5. Pega la URL /exec en app.js.<br>6. Sube la carpeta frontend a GitHub Pages.</p>
          <p class="help-text">Versión del aplicativo: ${APP_VERSION}</p>
        </article>
      </section>
    `);

    const setupButton = $("#btnSetupSheet");
    const testButton = $("#btnTestApi");

    if (setupButton) setupButton.addEventListener("click", async () => {
      try {
        setupButton.disabled = true;
        setupButton.textContent = "Preparando…";
        await api("setup", {});
        toast("Hojas preparadas correctamente.", "ok");
        await loadDashboard();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        setupButton.disabled = false;
        setupButton.textContent = "Preparar hojas en Google Sheets";
      }
    });

    if (testButton) testButton.addEventListener("click", async () => {
      try {
        await api("ping", {});
        toast("Conexión correcta.", "ok");
        setApiStatus("Conectado a Sheets", "ok");
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  function renderConnectionError(error) {
    html(`
      <section class="card">
        <p class="eyebrow">No se pudo conectar</p>
        <h2>Revisa la configuración del Web App</h2>
        <p>El frontend no pudo leer Google Sheets mediante Apps Script. Casi siempre es una de estas joyas humanas: URL incorrecta, despliegue en /dev en vez de /exec, permisos del Web App, o no haber ejecutado setup.</p>
        <code class="setup-code">${escapeHTML(error.message)}</code>
        <div class="form-actions">
          <button class="btn btn-primary" id="btnRetry" type="button">Reintentar</button>
          <button class="btn btn-secondary" id="btnGoSetup" type="button">Ir a configuración</button>
        </div>
      </section>
    `);
    $("#btnRetry").addEventListener("click", () => loadDashboard());
    $("#btnGoSetup").addEventListener("click", () => navigate("setup"));
  }

  async function api(action, data = {}) {
    if (isApiMissing()) {
      throw new Error("Falta pegar la URL del Web App de Apps Script en frontend/app.js.");
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({ action, data }),
        signal: controller.signal,
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (_) {
        throw new Error(`La API respondió algo que no es JSON. Respuesta: ${text.slice(0, 220)}`);
      }

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || `Error HTTP ${response.status}`);
      }

      return result.data || {};
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("La conexión tardó demasiado. Revisa el Apps Script o intenta otra vez.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function renderHistoryMini(rows) {
    if (!rows.length) return emptyState("Todavía no hay revisiones recientes.");
    return `
      <div class="side-list">
        ${rows.slice(0, 5).map((row) => `
          <div class="side-item">
            <strong>${escapeHTML(REVIEW_LABELS[row.tipo_revision] || row.tipo_revision)} · ${escapeHTML(row.estado_general)}</strong>
            <small>${escapeHTML(row.fecha_revision || `${row.semana_inicio || ""} / ${row.semana_fin || ""}`)} · ${escapeHTML(row.responsable || "Sin responsable")}</small>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderObservationMini(rows) {
    if (!rows.length) return emptyState("No hay observaciones abiertas.");
    return `
      <div class="side-list">
        ${rows.slice(0, 5).map((row) => `
          <div class="side-item">
            <strong>${escapeHTML(row.categoria || "Observación")} · ${escapeHTML(row.prioridad || "media")}</strong>
            <small>${escapeHTML(truncate(row.observacion, 120))}</small>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderPendingMini(rows) {
    if (!rows.length) return emptyState("No hay pendientes abiertos.");
    return `
      <div class="side-list">
        ${rows.slice(0, 7).map((row) => `
          <div class="side-item">
            <strong>${escapeHTML(row.categoria || "Pendiente")} · ${escapeHTML(row.responsable_asignado || "Sin asignar")}</strong>
            <small>${escapeHTML(truncate(row.descripcion || row.accion_sugerida, 140))}</small>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderRevisionTable(rows) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Fecha / semana</th><th>Responsable</th><th>Estado</th><th>Tarjetas</th><th>Novedades</th><th>Duración</th><th>Resumen</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHTML(REVIEW_LABELS[row.tipo_revision] || row.tipo_revision)}</td>
                <td>${escapeHTML(row.fecha_revision || `${row.semana_inicio || ""} a ${row.semana_fin || ""}`)}</td>
                <td>${escapeHTML(row.responsable || "")}</td>
                <td>${escapeHTML(row.estado_general || "")}</td>
                <td>${escapeHTML(row.tarjetas_completadas || "0")}/${escapeHTML(row.total_tarjetas || "0")}</td>
                <td>${escapeHTML(row.tarjetas_con_novedad || "0")}</td>
                <td>${escapeHTML(row.duracion_minutos || "")}${row.duracion_minutos ? " min" : ""}</td>
                <td>${escapeHTML(truncate(row.resumen_general || "", 180))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderObservationsTable(rows) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Prioridad</th><th>Observación</th><th>Acción</th><th>Responsable</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHTML(row.fecha || "")}</td>
                <td>${escapeHTML(REVIEW_LABELS[row.tipo_revision] || row.tipo_revision || "")}</td>
                <td>${escapeHTML(row.categoria || "")}</td>
                <td>${escapeHTML(row.prioridad || "")}</td>
                <td>${escapeHTML(row.observacion || "")}</td>
                <td>${escapeHTML(row.accion_sugerida || "")}</td>
                <td>${escapeHTML(row.responsable || "")}</td>
                <td>${escapeHTML(row.estado || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPendingTable(rows) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Responsable</th><th>Límite</th><th>Estado</th><th>Origen</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHTML(row.fecha_creacion || "")}</td>
                <td>${escapeHTML(row.categoria || "")}</td>
                <td>${escapeHTML(row.descripcion || "")}</td>
                <td>${escapeHTML(row.responsable_asignado || "Sin asignar")}</td>
                <td>${escapeHTML(row.fecha_limite || "")}</td>
                <td>${escapeHTML(row.estado || "")}</td>
                <td>${escapeHTML(row.titulo_tarjeta || row.id_revision || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildLocalSummary(review, answers) {
    const conNovedad = answers.filter((item) => ["con_novedad", "pendiente", "requiere_seguimiento"].includes(item.estado)).length;
    const pendientes = answers.filter((item) => item.crear_pendiente === "true").length;
    const lines = [
      `${REVIEW_LABELS[review.revision.tipo_revision]} finalizada`,
      `Responsable: ${review.revision.responsable}`,
      `Sede: ${review.revision.sede}`,
      `Tarjetas completadas: ${answers.length}/${review.cards.length}`,
      `Tarjetas con novedad o seguimiento: ${conNovedad}`,
      `Pendientes creados: ${pendientes}`,
      "",
      "Observaciones principales:",
    ];

    answers
      .filter((item) => item.observacion && item.observacion.trim())
      .forEach((item) => {
        lines.push(`- ${formatStatus(item.estado)} · ${item.categoria || "Sin categoría"}: ${item.observacion.trim()}`);
      });

    if (lines[lines.length - 1] === "Observaciones principales:") {
      lines.push("- Sin observaciones principales registradas.");
    }

    return lines.join("\n");
  }

  function renderLoading(message) {
    html(`
      <section class="loading-card">
        <div>
          <div class="loader" style="margin: 0 auto 14px;"></div>
          <p>${escapeHTML(message)}</p>
        </div>
      </section>
    `);
  }

  function html(markup) {
    const root = $("#app");
    root.innerHTML = markup;
    root.focus({ preventScroll: true });
  }

  function emptyState(message) {
    return `<div class="empty-state"><p>${escapeHTML(message)}</p></div>`;
  }

  function toast(message, type = "neutral") {
    const node = $("#toast");
    node.textContent = message;
    node.className = `toast is-visible ${type === "error" ? "is-error" : type === "ok" ? "is-ok" : ""}`;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("is-visible"), 4200);
  }

  function formToObject(form) {
    const data = new FormData(form);
    const object = {};
    for (const [key, value] of data.entries()) {
      if (key === "checklist_completed") continue;
      object[key] = String(value).trim();
    }
    return object;
  }

  function setFormBusy(form, busy, text = "Guardando…") {
    $$('button, input, select, textarea', form).forEach((node) => { node.disabled = busy; });
    const submit = $('button[type="submit"]', form);
    if (submit) {
      if (!submit.dataset.originalText) submit.dataset.originalText = submit.textContent;
      submit.textContent = busy ? text : submit.dataset.originalText;
    }
  }

  function splitLines(value) {
    return String(value || "")
      .split(/\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getCurrentWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    return { start: toInputDate(monday), end: toInputDate(saturday) };
  }

  function toInputDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function truncate(value, length = 100) {
    const text = String(value || "");
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  }

  function safeNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function formatStatus(value) {
    const found = STATUS_OPTIONS.find((item) => item.value === value);
    return found ? found.label : value;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value).replace(/`/g, "&#096;");
  }
})();
