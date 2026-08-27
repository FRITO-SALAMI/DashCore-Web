import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from "./supabase-config.js";


// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);


// ============================================================
// HELPERS
// ============================================================

const $ = (id) =>
  document.getElementById(id);

const qsa = (
  selector,
  root = document
) =>
  [...root.querySelectorAll(selector)];

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const num = (value) => {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "es-DO"
  ).format(
    Number(value) || 0
  );
};

const fmt = (value) => {

  if (!value) {
    return "—";
  }

  try {

    const date =
      value?.toDate
        ? value.toDate()
        : new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "es-DO",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    ).format(date);

  } catch {

    return "—";
  }
};

const safeArray = (value) =>
  Array.isArray(value)
    ? value
    : [];


// ============================================================
// STATE
// ============================================================

const state = {

  users: [],

  userPage: 1,

  usersPageSize: 40,

  currentUserCursor: null,

  userCursors: [],

  versions: [],

  announcements: [],

  editingAnnouncement: null,

  styles: [],

  map: null,

  markers: [],

  editingVersion: null,

  initialized: false,

  loading: false,

  announcementChannel: null

};


// ============================================================
// TOAST
// ============================================================

function toast(
  message,
  type = "info"
) {

  const root =
    $("toast-root");

  if (!root) {
    return;
  }

  const element =
    document.createElement("div");

  element.className =
    `toast ${type}`;

  element.textContent =
    message;

  root.appendChild(element);

  setTimeout(() => {

    element.classList.add(
      "hide"
    );

    setTimeout(() => {

      element.remove();

    }, 250);

  }, 2800);
}


// ============================================================
// VIEW SYSTEM
// ============================================================

const VIEW_META = {

  overview: [
    "CONTROL CENTER",
    "Resumen"
  ],

  users: [
    "COMMUNITY",
    "Usuarios"
  ],

  "user-detail": [
    "COMMUNITY / PROFILE",
    "Perfil"
  ],

  styles: [
    "DESIGN SYSTEM",
    "Estilos"
  ],

  locations: [
    "GEO INTELLIGENCE",
    "Ubicaciones"
  ],

  versions: [
    "RELEASE CONTROL",
    "Versiones"
  ],

  announcements: [
    "REMOTE CONTROL",
    "Avisos"
  ]

};


function view(name) {

  const target =
    $(`view-${name}`);

  if (!target) {
    return;
  }

  qsa(".view")
    .forEach((element) => {

      element.classList.remove(
        "active"
      );

    });

  target.classList.add(
    "active"
  );

  qsa(".nav-item")
    .forEach((element) => {

      element.classList.toggle(
        "active",
        element.dataset.view === name
      );

    });

  const meta =
    VIEW_META[name] ||
    VIEW_META.overview;

  if ($("view-kicker")) {

    $("view-kicker")
      .textContent =
        meta[0];

  }

  if ($("view-title")) {

    $("view-title")
      .textContent =
        meta[1];

  }

  closeMobileMenu();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (name === "announcements") {
    loadAnnouncements();
  }

  if (
    name === "locations" &&
    state.map
  ) {

    setTimeout(() => {

      state.map.invalidateSize();

    }, 250);
  }
}


// ============================================================
// NAVIGATION
// ============================================================

qsa(".nav-item")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        view(
          button.dataset.view
        );

      }
    );

  });


qsa(".quick-action")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        view(
          button.dataset.view
        );

      }
    );

  });


qsa(".back-btn")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        view(
          button.dataset.view
        );

      }
    );

  });


// ============================================================
// MOBILE MENU
// ============================================================

function openMobileMenu() {

  $("sidebar")
    ?.classList.add("open");

  $("mobile-overlay")
    ?.classList.add("active");
}


function closeMobileMenu() {

  $("sidebar")
    ?.classList.remove("open");

  $("mobile-overlay")
    ?.classList.remove("active");
}


$("mobile-menu")
  ?.addEventListener(
    "click",
    openMobileMenu
  );


$("mobile-close")
  ?.addEventListener(
    "click",
    closeMobileMenu
  );


$("mobile-overlay")
  ?.addEventListener(
    "click",
    closeMobileMenu
  );


// ============================================================
// ADMIN CHECK
// ============================================================

async function isCurrentUserAdmin(
  userId
) {

  if (!userId) {
    return false;
  }

  const {
    data,
    error
  } =
    await supabase
      .from("admin_users")
      .select("user_id")
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (error) {

    console.error(
      "ADMIN TABLE ERROR:",
      error
    );

    throw error;
  }

  return Boolean(data);
}


// ============================================================
// LOGIN
// ============================================================

$("login-form")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const form =
        event.currentTarget;

      const email =
        $("login-email")
          ?.value
          .trim()
          .toLowerCase();

      const password =
        $("login-password")
          ?.value ||
        "";

      const status =
        $("login-status");

      const button =
        form.querySelector(
          "button[type='submit']"
        );

      if (
        !email ||
        !password
      ) {

        if (status) {

          status.textContent =
            "Introduce correo y contraseña.";

        }

        return;
      }

      if (button) {
        button.disabled = true;
      }

      if (status) {

        status.textContent =
          "Verificando acceso administrativo…";

      }

      try {

        const {
          data,
          error
        } =
          await supabase.auth.signInWithPassword({
            email,
            password
          });

        if (error) {
          throw error;
        }

        const user =
          data?.user;

        if (!user) {

          throw new Error(
            "Supabase no devolvió el usuario."
          );
        }

        if (status) {

          status.textContent =
            "Validando permisos de administrador…";

        }

        const admin =
          await isCurrentUserAdmin(
            user.id
          );

        if (!admin) {

          if (status) {

            status.textContent =
              "Esta cuenta no tiene permisos de administrador.";

          }

          toast(
            "Acceso administrativo denegado.",
            "error"
          );

          await supabase.auth.signOut();

          if (button) {
            button.disabled = false;
          }

          return;
        }

        if (status) {

          status.textContent =
            "Acceso administrativo autorizado.";

        }

        showApp(
          user
        );

        startAnnouncementRealtime();

        if (
          !state.initialized
        ) {

          state.initialized =
            true;

          await loadAll();

          toast(
            "Panel administrativo conectado.",
            "success"
          );
        }

        if (button) {
          button.disabled = false;
        }

      } catch (error) {

        console.error(
          "LOGIN / ADMIN ERROR:",
          error
        );

        let message =
          "No fue posible validar el acceso.";

        const code =
          error?.code ||
          error?.status;

        const errorMessage =
          String(
            error?.message ||
            ""
          ).toLowerCase();

        if (
          code ===
            "invalid_credentials" ||
          code ===
            "invalid_grant"
        ) {

          message =
            "Correo o contraseña incorrectos.";

        } else if (
          code ===
            "email_not_confirmed"
        ) {

          message =
            "Debes confirmar tu correo.";

        } else if (
          code ===
            "over_request_rate_limit"
        ) {

          message =
            "Demasiados intentos. Espera unos minutos.";

        } else if (
          code ===
            "network_error"
        ) {

          message =
            "No hay conexión con Supabase.";

        } else if (
          errorMessage.includes(
            "admin_users"
          )
        ) {

          message =
            "No se pudo consultar la tabla de administradores. Revisa RLS de admin_users.";

        } else if (
          errorMessage.includes(
            "permission"
          ) ||
          errorMessage.includes(
            "row-level security"
          ) ||
          errorMessage.includes(
            "rls"
          )
        ) {

          message =
            "Supabase bloqueó la validación del administrador por RLS.";

        }

        if (status) {

          status.textContent =
            message;

        }

        toast(
          message,
          "error"
        );

        if (button) {
          button.disabled = false;
        }

      }

    }
  );


// ============================================================
// LOGOUT
// ============================================================

$("logout-btn")
  ?.addEventListener(
    "click",
    async () => {

      try {

        await supabase.auth.signOut();

      } catch (error) {

        console.error(
          "LOGOUT ERROR:",
          error
        );

        toast(
          "No se pudo cerrar sesión.",
          "error"
        );
      }
    }
  );


// ============================================================
// AUTH STATE
// ============================================================

supabase.auth.onAuthStateChange(
  async (
    event,
    session
  ) => {

    if (
      event ===
      "INITIAL_SESSION"
    ) {

      await handleSession(
        session
      );

      return;
    }

    if (
      event ===
        "SIGNED_IN" ||
      event ===
        "TOKEN_REFRESHED"
    ) {

      await handleSession(
        session
      );

      return;
    }

    if (
      event ===
      "SIGNED_OUT"
    ) {

      showLogin();

    }
  }
);


// ============================================================
// SESSION HANDLER
// ============================================================

async function handleSession(
  session
) {

  if (
    !session?.user
  ) {

    showLogin();

    return;
  }

  try {

    const admin =
      await isCurrentUserAdmin(
        session.user.id
      );

    if (!admin) {

      if ($("login-status")) {

        $("login-status")
          .textContent =
            "Esta cuenta no tiene permisos de administrador.";

      }

      toast(
        "Acceso administrativo denegado.",
        "error"
      );

      await supabase.auth.signOut();

      return;
    }

    showApp(
      session.user
    );

    startAnnouncementRealtime();

    if (
      !state.initialized
    ) {

      state.initialized =
        true;

      await loadAll();

      toast(
        "Panel administrativo conectado.",
        "success"
      );
    }

  } catch (error) {

    console.error(
      "AUTH VALIDATION ERROR:",
      error
    );

    if ($("login-status")) {

      $("login-status")
        .textContent =
          "No se pudo validar el administrador.";

    }

    toast(
      "No se pudo validar el administrador.",
      "error"
    );

    await supabase.auth.signOut();
  }
}


// ============================================================
// LOGIN / APP VISIBILITY
// ============================================================

function showLogin() {

  $("login-view")
    ?.classList.remove(
      "hidden"
    );

  $("app-view")
    ?.classList.add(
      "hidden"
    );

  state.initialized =
    false;

  stopAnnouncementRealtime();
}


function showApp(user) {

  $("login-view")
    ?.classList.add(
      "hidden"
    );

  $("app-view")
    ?.classList.remove(
      "hidden"
    );

  if ($("admin-email")) {

    $("admin-email")
      .textContent =
        user.email ||
        "Administrador";

  }
}


// ============================================================
// LOAD ALL
// ============================================================

async function loadAll() {

  if (state.loading) {
    return;
  }

  state.loading =
    true;

  try {

    await Promise.all([
      loadOverview(),
      loadUsers(true),
      loadStyles(),
      loadLocations(),
      loadVersions(),
      loadAnnouncements()
    ]);

  } catch (error) {

    console.error(
      "LOAD ALL ERROR:",
      error
    );

    toast(
      "Algunos datos no pudieron cargarse.",
      "error"
    );

  } finally {

    state.loading =
      false;
  }
}


// ============================================================
// OVERVIEW REFRESH
// ============================================================

$("refresh-overview")
  ?.addEventListener(
    "click",
    async () => {

      const button =
        $("refresh-overview");

      if (button) {
        button.disabled = true;
      }

      try {

        await loadOverview();

        toast(
          "Datos actualizados.",
          "success"
        );

      } finally {

        if (button) {
          button.disabled = false;
        }
      }
    }
  );


// ============================================================
// RANK DATA
// ============================================================

function normalizeEntries(
  data
) {

  if (Array.isArray(data)) {

    return data
      .map((item) => [

        item?.name ??
          item?.label ??
          "Sin nombre",

        Number(
          item?.count ??
          item?.value ??
          0
        )

      ])
      .sort(
        (a, b) =>
          b[1] - a[1]
      );
  }

  return Object.entries(
    data || {}
  )
    .map(
      ([name, count]) => [
        name,
        Number(count) || 0
      ]
    )
    .sort(
      (a, b) =>
        b[1] - a[1]
    );
}


function renderRanks(
  id,
  data,
  bars = false
) {

  const root =
    $(id);

  if (!root) {
    return;
  }

  const list =
    normalizeEntries(
      data
    ).slice(
      0,
      8
    );

  if (!list.length) {

    root.innerHTML = `
      <div class="empty-state">
        Sin datos todavía.
      </div>
    `;

    return;
  }

  const max =
    Math.max(
      ...list.map(
        (item) =>
          item[1]
      ),
      1
    );

  if (bars) {

    root.innerHTML =
      list
        .map(
          ([name, count]) => {

            const percentage =
              Math.max(
                5,
                Math.min(
                  100,
                  (count / max) *
                    100
                )
              );

            return `
              <div class="bar-row">

                <div class="bar-meta">

                  <span>
                    ${esc(name)}
                  </span>

                  <strong>
                    ${num(count)}
                  </strong>

                </div>

                <div class="bar-track">

                  <i
                    style="width:${percentage}%"
                  ></i>

                </div>

              </div>
            `;
          }
        )
        .join("");

    return;
  }

  root.innerHTML =
    list
      .map(
        ([name, count], index) => `

          <div class="rank-row">

            <span class="rank">
              ${String(
                index + 1
              ).padStart(2, "0")}
            </span>

            <span class="rank-name">
              ${esc(name)}
            </span>

            <strong>
              ${num(count)}
            </strong>

          </div>
        `
      )
      .join("");
}


// ============================================================
// OVERVIEW
// ============================================================

async function loadOverview() {

  try {

    const [
      usersResult,
      stylesResult,
      versionsResult
    ] =
      await Promise.all([

        supabase
          .from("app_users")
          .select(
            "id,username,updated_at"
          ),

        supabase
          .from("user_styles")
          .select(
            "style_id"
          ),

        supabase
          .from("app_versions")
          .select(
            "version_name,version_code,is_active"
          )
          .order(
            "version_code",
            {
              ascending: false
            }
          )
      ]);

    if (usersResult.error) {
      throw usersResult.error;
    }

    if (stylesResult.error) {
      throw stylesResult.error;
    }

    if (versionsResult.error) {
      throw versionsResult.error;
    }

    const users =
      usersResult.data ||
      [];

    const styles =
      stylesResult.data ||
      [];

    const versions =
      versionsResult.data ||
      [];

    const styleCounts = {};

    styles.forEach(
      (item) => {

        const id =
          item.style_id ||
          "unknown";

        styleCounts[id] =
          (
            styleCounts[id] ||
            0
          ) + 1;
      }
    );

    const versionCounts = {};

    versions.forEach(
      (item) => {

        const name =
          item.version_name ||
          String(
            item.version_code ||
            "—"
          );

        versionCounts[name] =
          (
            versionCounts[name] ||
            0
          ) + 1;
      }
    );

    const activeVersions =
      versions.filter(
        (item) =>
          item.is_active !== false
      );

    if ($("stat-users")) {

      $("stat-users")
        .textContent =
          num(
            users.length
          );

    }

    if ($("stat-active")) {

      $("stat-active")
        .textContent =
          num(
            users.filter(
              (item) =>
                item.updated_at
            ).length
          );

    }

    if ($("stat-registrations")) {

      $("stat-registrations")
        .textContent =
          "—";

    }

    if ($("stat-versions")) {

      $("stat-versions")
        .textContent =
          num(
            activeVersions.length
          );

    }

    renderRanks(
      "version-chart",
      versionCounts,
      true
    );

    renderRanks(
      "style-chart",
      styleCounts
    );

    renderRanks(
      "country-list",
      {}
    );

    renderRanks(
      "city-list",
      {}

    );

  } catch (error) {

    console.error(
      "OVERVIEW ERROR:",
      error
    );

    toast(
      "No se pudo cargar el resumen.",
      "error"
    );
  }
}


// ============================================================
// USERS
// ============================================================

async function loadUsers(
  reset = false
) {

  if (reset) {

    state.userPage =
      1;

    state.userCursors =
      [];

    state.currentUserCursor =
      null;
  }

  try {

    const {
      data,
      error,
      count
    } =
      await supabase
        .from("app_users")
        .select(
          "*",
          {
            count: "exact"
          }
        )
        .order(
          "updated_at",
          {
            ascending: false,
            nullsFirst: false
          }
        )
        .range(
          (
            state.userPage - 1
          ) *
            state.usersPageSize,

          (
            state.userPage *
              state.usersPageSize
          ) - 1
        );

    if (error) {
      throw error;
    }

    const users =
      data || [];

    const ids =
      users.map(
        (item) =>
          item.id
      );

    let settings = [];

    let styles = [];

    if (ids.length) {

      const [
        settingsResult,
        stylesResult
      ] =
        await Promise.all([

          supabase
            .from("user_settings")
            .select(
              `
              user_id,
              selected_style,
              accent_color,
              temp_unit,
              language,
              background_path,
              model_path,
              updated_at
              `
            )
            .in(
              "user_id",
              ids
            ),

          supabase
            .from("user_styles")
            .select(
              `
              user_id,
              style_id,
              unlocked_at
              `
            )
            .in(
              "user_id",
              ids
            )

        ]);

      if (
        settingsResult.error
      ) {
        throw settingsResult.error;
      }

      if (
        stylesResult.error
      ) {
        throw stylesResult.error;
      }

      settings =
        settingsResult.data ||
        [];

      styles =
        stylesResult.data ||
        [];
    }

    const settingsMap =
      new Map();

    settings.forEach(
      (item) => {

        settingsMap.set(
          item.user_id,
          item
        );
      }
    );

    const stylesMap =
      new Map();

    styles.forEach(
      (item) => {

        if (
          !stylesMap.has(
            item.user_id
          )
        ) {

          stylesMap.set(
            item.user_id,
            []
          );
        }

        stylesMap
          .get(item.user_id)
          .push(
            item.style_id
          );
      }
    );

    state.users =
      users.map(
        (user) => {

          const setting =
            settingsMap.get(
              user.id
            ) || {};

          return {

            ...user,

            ...setting,

            unlockedStyles:
              stylesMap.get(
                user.id
              ) || []

          };
        }
      );

    renderUsers();

    updateFilters();

    if ($("users-page")) {

      $("users-page")
        .textContent =
          state.userPage;
    }

    if ($("users-prev")) {

      $("users-prev")
        .disabled =
          state.userPage <= 1;
    }

    if ($("users-next")) {

      $("users-next")
        .disabled =
          (
            state.userPage *
              state.usersPageSize
          ) >=
          (
            count || 0
          );
    }

  } catch (error) {

    console.error(
      "USERS ERROR:",
      error
    );

    toast(
      "No se pudieron cargar los usuarios.",
      "error"
    );
  }
}


// ============================================================
// USERS RENDER
// ============================================================

function renderUsers() {

  const root =
    $("users-table");

  if (!root) {
    return;
  }

  const term =
    $("user-search")
      ?.value
      .trim()
      .toLowerCase() ||
    "";

  const country =
    $("country-filter")
      ?.value ||
    "";

  const version =
    $("version-filter")
      ?.value ||
    "";

  const filtered =
    state.users.filter(
      (user) => {

        const searchable =
          [
            user.email,
            user.uid,
            user.id,
            user.username
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchesSearch =
          !term ||
          searchable.includes(
            term
          );

        const matchesCountry =
          !country;

        const matchesVersion =
          !version;

        return (
          matchesSearch &&
          matchesCountry &&
          matchesVersion
        );
      }
    );

  if (!filtered.length) {

    root.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            No hay usuarios que coincidan.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  root.innerHTML =
    filtered
      .map(
        (user) => {

          const username =
            user.username ||
            "Usuario";

          const avatar =
            username
              .charAt(0)
              .toUpperCase();

          const version =
            user.version_name ||
            user.app_version ||
            user.version ||
            "—";

          const style =
            user.selected_style ||
            "sporty";

          return `
            <tr
              data-id="${esc(
                user.id
              )}"
              tabindex="0"
            >

              <td>

                <div class="user-cell">

                  <span class="avatar">
                    ${esc(avatar)}
                  </span>

                  <div>

                    <strong>
                      ${esc(username)}
                    </strong>

                    <small>
                      ${esc(user.id)}
                    </small>

                  </div>

                </div>

              </td>

              <td>
                ${esc(
                  fmt(
                    user.created_at ||
                    user.inserted_at ||
                    user.updated_at
                  )
                )}
              </td>

              <td>
                ${esc(
                  fmt(
                    user.updated_at
                  )
                )}
              </td>

              <td>
                —
              </td>

              <td>
                —
              </td>

              <td>

                <span class="version-pill">
                  ${esc(version)}
                </span>

              </td>

              <td>
                ${esc(style)}
              </td>

              <td>
                ${esc(
                  fmt(
                    user.updated_at
                  )
                )}
              </td>

            </tr>
          `;
        }
      )
      .join("");

  qsa(
    "#users-table tr[data-id]"
  )
    .forEach(
      (row) => {

        row.addEventListener(
          "click",
          () => {

            openUser(
              row.dataset.id
            );

          }
        );

        row.addEventListener(
          "keydown",
          (event) => {

            if (
              event.key ===
                "Enter" ||
              event.key ===
                " "
            ) {

              event.preventDefault();

              openUser(
                row.dataset.id
              );

            }

          }
        );

      }
    );
}


// ============================================================
// FILTERS
// ============================================================

function updateFilters() {

  const countries = [];

  const versions = [];

  const currentCountry =
    $("country-filter")
      ?.value ||
    "";

  const currentVersion =
    $("version-filter")
      ?.value ||
    "";

  if ($("country-filter")) {

    $("country-filter")
      .innerHTML = `
        <option value="">
          Todos los países
        </option>
      `;

    $("country-filter")
      .value =
        currentCountry;
  }

  if ($("version-filter")) {

    $("version-filter")
      .innerHTML = `
        <option value="">
          Todas las versiones
        </option>
      `;

    $("version-filter")
      .value =
        currentVersion;
  }

  return {
    countries,
    versions
  };
}


[
  "user-search",
  "country-filter",
  "version-filter"
]
  .forEach(
    (id) => {

      $(id)
        ?.addEventListener(
          "input",
          renderUsers
        );

      $(id)
        ?.addEventListener(
          "change",
          renderUsers
        );

    }
  );


$("clear-user-filters")
  ?.addEventListener(
    "click",
    () => {

      if ($("user-search")) {
        $("user-search").value =
          "";
      }

      if ($("country-filter")) {
        $("country-filter").value =
          "";
      }

      if ($("version-filter")) {
        $("version-filter").value =
          "";
      }

      renderUsers();
    }
  );


// ============================================================
// USER PAGINATION
// ============================================================

$("users-next")
  ?.addEventListener(
    "click",
    async () => {

      if (
        $("users-next").disabled
      ) {
        return;
      }

      state.userPage++;

      await loadUsers();
    }
  );


$("users-prev")
  ?.addEventListener(
    "click",
    async () => {

      if (
        state.userPage <= 1
      ) {
        return;
      }

      state.userPage--;

      await loadUsers();
    }
  );


// ============================================================
// USER DETAIL
// ============================================================

async function openUser(
  id
) {

  if (!id) {
    return;
  }

  try {

    const [
      profileResult,
      settingsResult,
      stylesResult
    ] =
      await Promise.all([

        supabase
          .from("app_users")
          .select("*")
          .eq(
            "id",
            id
          )
          .maybeSingle(),

        supabase
          .from("user_settings")
          .select("*")
          .eq(
            "user_id",
            id
          )
          .maybeSingle(),

        supabase
          .from("user_styles")
          .select(
            "style_id,unlocked_at"
          )
          .eq(
            "user_id",
            id
          )
          .order(
            "unlocked_at",
            {
              ascending: false
            }
          )

      ]);

    if (
      profileResult.error
    ) {
      throw profileResult.error;
    }

    if (
      settingsResult.error
    ) {
      throw settingsResult.error;
    }

    if (
      stylesResult.error
    ) {
      throw stylesResult.error;
    }

    if (!profileResult.data) {

      toast(
        "Usuario no encontrado.",
        "error"
      );

      return;
    }

    const user =
      {
        ...profileResult.data,
        ...(settingsResult.data ||
          {})
      };

    const styles =
      safeArray(
        stylesResult.data
      );

    const username =
      user.username ||
      "Usuario";

    const avatar =
      username
        .charAt(0)
        .toUpperCase();

    const accountRows = [

      [
        "UID",
        user.id
      ],

      [
        "Usuario",
        user.username
      ],

      [
        "Correo",
        user.email
      ],

      [
        "Creado",
        fmt(
          user.created_at
        )
      ],

      [
        "Actualizado",
        fmt(
          user.updated_at
        )
      ]

    ];

    const deviceRows = [

      [
        "Modelo",
        user.device_model ||
        user.model ||
        "No registrado"
      ],

      [
        "Sistema",
        user.device_os ||
        user.os_version ||
        "No registrado"
      ],

      [
        "Idioma",
        user.language
      ],

      [
        "Unidad",
        user.temp_unit
      ]

    ];

    const preferenceRows = [

      [
        "Estilo seleccionado",
        user.selected_style
      ],

      [
        "Color",
        user.accent_color
      ],

      [
        "Fondo",
        user.background_path
      ],

      [
        "Modelo 3D",
        user.model_path
      ]

    ];

    const rows =
      (items) =>
        items
          .map(
            ([label, value]) => `

              <div>

                <span>
                  ${esc(label)}
                </span>

                <strong>
                  ${esc(
                    value ||
                    "—"
                  )}
                </strong>

              </div>

            `
          )
          .join("");

    $("user-detail-root")
      .innerHTML = `

        <div class="profile-head">

          <div class="profile-avatar">
            ${esc(avatar)}
          </div>

          <div>

            <p class="eyebrow">
              USER PROFILE
            </p>

            <h1>
              ${esc(username)}
            </h1>

            <p class="muted">
              ${esc(user.id)}
            </p>

          </div>

          <span class="role-badge">
            USER
          </span>

        </div>


        <div class="profile-grid">


          <article class="panel">

            <div class="panel-head">

              <p class="eyebrow">
                IDENTIDAD
              </p>

              <h3>
                Cuenta
              </h3>

            </div>

            <div class="detail-list">
              ${rows(
                accountRows
              )}
            </div>

          </article>


          <article class="panel">

            <div class="panel-head">

              <p class="eyebrow">
                ENTORNO
              </p>

              <h3>
                Configuración
              </h3>

            </div>

            <div class="detail-list">
              ${rows(
                deviceRows
              )}
            </div>

          </article>


          <article class="panel">

            <div class="panel-head">

              <p class="eyebrow">
                DISEÑOS
              </p>

              <h3>
                Estilos desbloqueados
              </h3>

            </div>

            <div class="chips">

              ${
                styles.length
                  ? styles
                      .map(
                        (style) => `

                          <span class="chip">
                            ${esc(
                              style.style_id
                            )}
                          </span>

                        `
                      )
                      .join("")
                  : `

                    <span class="muted">
                      Sin estilos registrados.
                    </span>

                  `
              }

            </div>

          </article>


          <article class="panel">

            <div class="panel-head">

              <p class="eyebrow">
                PREFERENCIAS
              </p>

              <h3>
                DashCore
              </h3>

            </div>

            <div class="detail-list">
              ${rows(
                preferenceRows
              )}
            </div>

          </article>


        </div>


        <article class="panel activity-panel">

          <div class="panel-head">

            <p class="eyebrow">
              STATUS
            </p>

            <h3>
              Estado de sincronización
            </h3>

          </div>

          <div class="activity-row">

            <span class="activity-dot"></span>

            <div>

              <strong>
                Perfil sincronizado
              </strong>

              <small>
                ${esc(
                  fmt(
                    user.updated_at
                  )
                )}
              </small>

            </div>

          </div>

        </article>
      `;

    view(
      "user-detail"
    );

  } catch (error) {

    console.error(
      "USER DETAIL ERROR:",
      error
    );

    toast(
      "No se pudo cargar el perfil.",
      "error"
    );
  }
}


// ============================================================
// STYLES
// ============================================================

async function loadStyles() {

  const root =
    $("styles-grid");

  if (!root) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await supabase
        .from("user_styles")
        .select(
          "style_id"
        );

    if (error) {
      throw error;
    }

    const counts = {};

    (data || [])
      .forEach(
        (item) => {

          const id =
            item.style_id ||
            "unknown";

          counts[id] =
            (
              counts[id] ||
              0
            ) + 1;

        }
      );

    state.styles =
      Object.entries(
        counts
      )
        .map(
          ([id, count]) => ({
            id,
            usageCount:
              count
          })
        )
        .sort(
          (a, b) =>
            b.usageCount -
            a.usageCount
        );

    if (
      !state.styles.length
    ) {

      root.innerHTML = `
        <div class="empty-state">
          No hay estilos registrados.
        </div>
      `;

      return;
    }

    root.innerHTML =
      state.styles
        .map(
          (style) => `

            <article class="style-card">

              <div class="style-preview">

                <div class="style-preview-grid"></div>

                <div class="style-preview-gauge">
                  <i></i>
                  <b></b>
                </div>

                <span>
                  DASHBOARD
                </span>

              </div>


              <div class="style-card-body">

                <div>

                  <h3>
                    ${esc(
                      style.id
                    )}
                  </h3>

                  <small>
                    ${esc(
                      style.id
                    )}
                  </small>

                </div>

                <strong>
                  ${num(
                    style.usageCount
                  )}
                </strong>

              </div>


              <div class="style-card-foot">

                <span>
                  Usuarios
                </span>

                <span>
                  ${num(
                    style.usageCount
                  )}
                </span>

              </div>

            </article>

          `
        )
        .join("");

  } catch (error) {

    console.error(
      "STYLES ERROR:",
      error
    );

    root.innerHTML = `
      <div class="empty-state">
        No se pudieron cargar los estilos.
      </div>
    `;
  }
}


// ============================================================
// LOCATIONS
// ============================================================

async function loadLocations() {

  const countryRoot =
    $("location-countries");

  const cityRoot =
    $("location-cities");

  if (countryRoot) {

    countryRoot.innerHTML = `
      <div class="empty-state">
        No hay columnas de ubicación
        en el esquema actual.
      </div>
    `;
  }

  if (cityRoot) {

    cityRoot.innerHTML = `
      <div class="empty-state">
        Ubicaciones no configuradas.
      </div>
    `;
  }

  initializeMap();

  clearMarkers();
}


// ============================================================
// MAP
// ============================================================

function initializeMap() {

  if (
    state.map ||
    typeof L ===
      "undefined"
  ) {
    return;
  }

  const mapElement =
    $("map");

  if (!mapElement) {
    return;
  }

  state.map =
    L.map(
      mapElement,
      {
        zoomControl: false
      }
    ).setView(
      [20, -10],
      2
    );

  L.control.zoom({
    position:
      "bottomright"
  }).addTo(
    state.map
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 18,

      attribution:
        "© OpenStreetMap contributors"
    }
  ).addTo(
    state.map
  );
}


function clearMarkers() {

  state.markers
    .forEach(
      (marker) => {

        marker.remove();

      }
    );

  state.markers =
    [];
}


// ============================================================
// VERSIONS
// ============================================================

async function loadVersions() {

  const root =
    $("versions-list");

  if (!root) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await supabase
        .from("app_versions")
        .select("*")
        .order(
          "version_code",
          {
            ascending: false
          }
        )
        .limit(50);

    if (error) {
      throw error;
    }

    state.versions =
      data || [];

    if (
      !state.versions.length
    ) {

      root.innerHTML = `
        <div class="empty-state">
          No hay versiones publicadas.
        </div>
      `;

      return;
    }

    root.innerHTML =
      state.versions
        .map(
          (version) => {

            const required =
              version.is_mandatory ===
              true;

            const active =
              version.is_active !==
              false;

            return `

              <article class="version-card">

                <div class="version-main">

                  <div class="version-number">
                    ${esc(
                      version.version_name ||
                      "—"
                    )}
                  </div>

                  <div>

                    <p class="eyebrow">
                      CODE ${esc(
                        version.version_code ??
                        "—"
                      )}
                    </p>

                    <p>
                      ${esc(
                        version.changelog ||
                        "Sin changelog."
                      )}
                    </p>

                  </div>

                </div>


                <div class="version-meta">

                  <span>
                    MIN ${esc(
                      version.min_version_code ??
                      "—"
                    )}
                  </span>

                  <span class="${
                    required
                      ? "danger"
                      : ""
                  }">

                    ${
                      required
                        ? "OBLIGATORIA"
                        : "NORMAL"
                    }

                  </span>

                  <span class="${
                    active
                      ? "success"
                      : ""
                  }">

                    ${
                      active
                        ? "ACTIVA"
                        : "INACTIVA"
                    }

                  </span>

                  <button
                    class="ghost-btn edit-version"
                    data-id="${esc(
                      version.id
                    )}"
                    type="button"
                  >
                    Editar
                  </button>

                </div>

              </article>
            `;
          }
        )
        .join("");

    qsa(
      ".edit-version"
    )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () => {

              openVersion(
                button.dataset.id
              );

            }
          );

        }
      );

  } catch (error) {

    console.error(
      "VERSIONS ERROR:",
      error
    );

    root.innerHTML = `
      <div class="empty-state">
        No se pudieron cargar las versiones.
      </div>
    `;
  }
}


// ============================================================
// VERSION MODAL
// ============================================================

const versionModal =
  $("version-modal");


function resetVersionForm() {

  $("version-form")
    ?.reset();

  if ($("v-active")) {

    $("v-active")
      .checked = true;

  }

  if ($("v-required")) {

    $("v-required")
      .checked = false;

  }

  if ($("version-status")) {

    $("version-status")
      .textContent = "";

  }
}


function closeVersionModal() {

  versionModal
    ?.classList.add(
      "hidden"
    );

  state.editingVersion =
    null;

  resetVersionForm();
}


qsa(
  "[data-close-version]"
)
  .forEach(
    (element) => {

      element.addEventListener(
        "click",
        closeVersionModal
      );

    }
  );


$("new-version")
  ?.addEventListener(
    "click",
    () => {

      openVersion();

    }
  );


function openVersion(
  id = null
) {

  state.editingVersion =
    id;

  resetVersionForm();

  if ($("version-modal-title")) {

    $("version-modal-title")
      .textContent =
        id
          ? "Editar versión"
          : "Nueva versión";

  }

  if (id) {

    const version =
      state.versions.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!version) {

      toast(
        "Versión no encontrada.",
        "error"
      );

      return;
    }

    $("v-name").value =
      version.version_name ||
      "";

    $("v-code").value =
      version.version_code ??
      "";

    $("v-min").value =
      version.min_version_code ??
      "";

    $("v-url").value =
      version.download_url ||
      "";

    $("v-changelog").value =
      version.changelog ||
      "";

    $("v-required").checked =
      version.is_mandatory ===
      true;

    $("v-active").checked =
      version.is_active !==
      false;
  }

  versionModal
    ?.classList.remove(
      "hidden"
    );
}


// ============================================================
// VERSION SAVE
// ============================================================

$("version-form")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const status =
        $("version-status");

      const {
        data: {
          user
        }
      } =
        await supabase.auth
          .getUser();

      if (!user) {

        if (status) {

          status.textContent =
            "La sesión administrativa expiró.";

        }

        return;
      }

      const versionName =
        $("v-name")
          ?.value
          .trim();

      const versionCode =
        Number(
          $("v-code")
            ?.value
        );

      const minVersionCode =
        Number(
          $("v-min")
            ?.value
        );

      const downloadUrl =
        $("v-url")
          ?.value
          .trim();

      const changelog =
        $("v-changelog")
          ?.value
          .trim();

      const isMandatory =
        $("v-required")
          ?.checked === true;

      const isActive =
        $("v-active")
          ?.checked !== false;

      if (
        !versionName ||
        !Number.isFinite(
          versionCode
        ) ||
        !Number.isFinite(
          minVersionCode
        ) ||
        !downloadUrl
      ) {

        if (status) {

          status.textContent =
            "Completa todos los campos obligatorios.";

        }

        toast(
          "Faltan datos de la versión.",
          "error"
        );

        return;
      }

      if (status) {

        status.textContent =
          "Guardando versión…";

      }

      const payload = {

        version_name:
          versionName,

        version_code:
          versionCode,

        min_version_code:
          minVersionCode,

        download_url:
          downloadUrl,

        changelog:
          changelog || null,

        platform:
          "android",

        is_active:
          isActive,

        is_mandatory:
          isMandatory

      };

      try {

        if (
          state.editingVersion
        ) {

          const {
            error
          } =
            await supabase
              .from("app_versions")
              .update(payload)
              .eq(
                "id",
                state.editingVersion
              );

          if (error) {
            throw error;
          }

        } else {

          const {
            error
          } =
            await supabase
              .from("app_versions")
              .insert(
                payload
              );

          if (error) {
            throw error;
          }
        }

        const wasEditing =
          Boolean(
            state.editingVersion
          );

        closeVersionModal();

        await loadVersions();

        await loadOverview();

        toast(
          wasEditing
            ? "Versión actualizada."
            : "Versión publicada.",
          "success"
        );

      } catch (error) {

        console.error(
          "VERSION SAVE ERROR:",
          error
        );

        if (status) {

          status.textContent =
            "No se pudo guardar. Revisa las políticas RLS.";

        }

        toast(
          "Error al guardar la versión.",
          "error"
        );
      }
    }
  );


// ============================================================
// REMOTE ANNOUNCEMENTS
// ============================================================

function ensureAnnouncementUI() {

  const nav =
    document.querySelector(
      ".main-nav"
    );

  const content =
    document.querySelector(
      ".content"
    );

  if (!nav || !content) {
    return;
  }

  if (
    !nav.querySelector(
      '[data-view="announcements"]'
    )
  ) {

    const button =
      document.createElement(
        "button"
      );

    button.className =
      "nav-item";

    button.dataset.view =
      "announcements";

    button.type =
      "button";

    button.innerHTML =
      `<span>!</span> Avisos`;

    button.addEventListener(
      "click",
      () =>
        view(
          "announcements"
        )
    );

    nav.appendChild(
      button
    );
  }

  if (
    !$("view-announcements")
  ) {

    const section =
      document.createElement(
        "div"
      );

    section.className =
      "view";

    section.id =
      "view-announcements";

    section.innerHTML = `
      <div class="welcome-row">

        <div>

          <p class="eyebrow">
            REMOTE CONTROL
          </p>

          <h1>
            Avisos
          </h1>

          <p class="muted">
            Mensajes remotos que DashCore puede consultar cuando tenga conexión.
          </p>

        </div>

        <button
          class="primary-btn compact"
          id="new-announcement"
          type="button"
        >
          + Nuevo aviso
        </button>

      </div>

      <div
        id="announcement-active"
        class="announcement-active"
      ></div>

      <div
        id="announcements-list"
        class="announcements-list"
      ></div>
    `;

    content.appendChild(
      section
    );
  }

  if (
    !$("announcement-modal")
  ) {

    const modal =
      document.createElement(
        "div"
      );

    modal.className =
      "modal hidden";

    modal.id =
      "announcement-modal";

    modal.innerHTML = `
      <div
        class="modal-backdrop"
        data-close-announcement
      ></div>

      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
      >

        <button
          class="modal-close"
          data-close-announcement
          type="button"
          aria-label="Cerrar"
        >
          ×
        </button>

        <p class="eyebrow">
          REMOTE CONTROL
        </p>

        <h2 id="announcement-modal-title">
          Nuevo aviso
        </h2>

        <form id="announcement-form">

          <label for="a-title">
            Título
          </label>

          <input
            id="a-title"
            required
            maxlength="120"
            placeholder="Mantenimiento programado"
          >

          <label for="a-message">
            Mensaje
          </label>

          <textarea
            id="a-message"
            required
            maxlength="2000"
            rows="6"
            placeholder="Escribe el aviso que verá DashCore..."
          ></textarea>

          <div class="form-grid">

            <div>

              <label for="a-expires">
                Expira
              </label>

              <input
                id="a-expires"
                type="datetime-local"
              >

            </div>

            <div>

              <label
                class="toggle-row"
                style="margin-top:28px"
              >

                <input
                  id="a-active"
                  type="checkbox"
                  checked
                >

                <span class="toggle"></span>

                Aviso activo

              </label>

            </div>

          </div>

          <div
            class="form-status"
            id="announcement-status"
          ></div>

          <button
            class="primary-btn"
            type="submit"
          >
            Guardar aviso
          </button>

        </form>

      </div>
    `;

    document.body.appendChild(
      modal
    );
  }

  $("new-announcement")
    ?.addEventListener(
      "click",
      () =>
        openAnnouncement()
    );

  qsa(
    "[data-close-announcement]"
  )
    .forEach(
      (el) =>
        el.addEventListener(
          "click",
          closeAnnouncement
        )
    );

  $("announcement-form")
    ?.addEventListener(
      "submit",
      saveAnnouncement
    );
}


function openAnnouncement(
  id = null
) {

  ensureAnnouncementUI();

  state.editingAnnouncement =
    id;

  const item =
    state.announcements.find(
      (x) =>
        String(x.id) ===
        String(id)
    );

  $("announcement-modal-title")
    .textContent =
      item
        ? "Editar aviso"
        : "Nuevo aviso";

  $("announcement-form")
    ?.reset();

  $("a-active").checked =
    item
      ? item.is_active !== false
      : true;

  $("a-title").value =
    item?.title ||
    "";

  $("a-message").value =
    item?.message ||
    "";

  if (item?.expires_at) {

    const d =
      new Date(
        item.expires_at
      );

    if (
      !Number.isNaN(
        d.getTime()
      )
    ) {

      $("a-expires").value =
        new Date(
          d.getTime() -
          d.getTimezoneOffset() *
            60000
        )
          .toISOString()
          .slice(
            0,
            16
          );

    }
  }

  $("announcement-status")
    .textContent =
      "";

  $("announcement-modal")
    ?.classList.remove(
      "hidden"
    );
}


function closeAnnouncement() {

  $("announcement-modal")
    ?.classList.add(
      "hidden"
    );

  state.editingAnnouncement =
    null;
}


async function loadAnnouncements() {

  ensureAnnouncementUI();

  const root =
    $("announcements-list");

  if (!root) {
    return;
  }

  const {
    data,
    error
  } =
    await supabase
      .from("remote_announcements")
      .select("*")
      .order(
        "published_at",
        {
          ascending: false
        }
      )
      .limit(50);

  if (error) {

    console.error(
      "ANNOUNCEMENTS ERROR:",
      error
    );

    root.innerHTML = `
      <div class="empty-state">
        No se pudieron cargar los avisos.
        Revisa RLS y la tabla remote_announcements.
      </div>
    `;

    return;
  }

  state.announcements =
    data || [];

  renderAnnouncements();
}


function isAnnouncementCurrentlyActive(
  item
) {

  if (
    !item ||
    item.is_active === false
  ) {
    return false;
  }

  if (
    !item.expires_at
  ) {
    return true;
  }

  const expiry =
    new Date(
      item.expires_at
    ).getTime();

  return (
    Number.isNaN(expiry) ||
    expiry > Date.now()
  );
}


function renderAnnouncements() {

  const activeRoot =
    $("announcement-active");

  const root =
    $("announcements-list");

  if (!root) {
    return;
  }

  const active =
    state.announcements.find(
      isAnnouncementCurrentlyActive
    );

  if (activeRoot) {

    activeRoot.innerHTML =
      active
        ? `

      <article class="announcement-active-card">

        <div>

          <span class="announcement-badge">
            ACTIVO
          </span>

          <h3>
            ${esc(active.title)}
          </h3>

          <p>
            ${esc(active.message)}
          </p>

        </div>

        <button
          class="ghost-btn"
          data-edit-announcement="${esc(active.id)}"
          type="button"
        >
          Editar
        </button>

      </article>

    `
        : `
      <div class="announcement-empty">
        No hay ningún aviso activo.
      </div>
    `;
  }

  if (
    !state.announcements.length
  ) {

    root.innerHTML = `
      <div class="empty-state">
        No hay avisos creados.
      </div>
    `;

    return;
  }

  root.innerHTML =
    state.announcements
      .map(
        (item) => {

          const activeNow =
            isAnnouncementCurrentlyActive(
              item
            );

          const expired =
            item.expires_at &&
            new Date(
              item.expires_at
            ).getTime() <=
              Date.now();

          return `
      <article class="announcement-card">

        <div class="announcement-card-main">

          <div class="announcement-card-top">

            <strong>
              ${esc(
                item.title ||
                "Sin título"
              )}
            </strong>

            <span
              class="announcement-status ${
                activeNow
                  ? "success"
                  : expired
                    ? "expired"
                    : ""
              }"
            >
              ${
                activeNow
                  ? "ACTIVO"
                  : expired
                    ? "EXPIRADO"
                    : "INACTIVO"
              }
            </span>

          </div>

          <p>
            ${esc(
              item.message ||
              ""
            )}
          </p>

          <small>
            Publicado:
            ${esc(
              fmt(
                item.published_at
              )
            )}

            ${
              item.expires_at
                ? ` · Expira: ${esc(
                    fmt(
                      item.expires_at
                    )
                  )}`
                : ""
            }
          </small>

        </div>

        <div class="announcement-actions">

          <button
            class="ghost-btn edit-announcement"
            data-id="${esc(item.id)}"
            type="button"
          >
            Editar
          </button>

          <button
            class="ghost-btn toggle-announcement"
            data-id="${esc(item.id)}"
            type="button"
          >
            ${
              item.is_active === false
                ? "Activar"
                : "Desactivar"
            }
          </button>

          <button
            class="danger-btn delete-announcement"
            data-id="${esc(item.id)}"
            type="button"
          >
            Eliminar
          </button>

        </div>

      </article>
    `;
        }
      )
      .join("");

  qsa(
    ".edit-announcement"
  )
    .forEach(
      (b) =>
        b.addEventListener(
          "click",
          () =>
            openAnnouncement(
              b.dataset.id
            )
        )
    );

  qsa(
    "[data-edit-announcement]"
  )
    .forEach(
      (b) =>
        b.addEventListener(
          "click",
          () =>
            openAnnouncement(
              b.dataset.editAnnouncement
            )
        )
    );

  qsa(
    ".toggle-announcement"
  )
    .forEach(
      (b) =>
        b.addEventListener(
          "click",
          () =>
            toggleAnnouncement(
              b.dataset.id
            )
        )
    );

  qsa(
    ".delete-announcement"
  )
    .forEach(
      (b) =>
        b.addEventListener(
          "click",
          () =>
            deleteAnnouncement(
              b.dataset.id
            )
        )
    );
}


async function saveAnnouncement(
  event
) {

  event.preventDefault();

  const status =
    $("announcement-status");

  const title =
    $("a-title")
      ?.value
      .trim();

  const message =
    $("a-message")
      ?.value
      .trim();

  const expiresRaw =
    $("a-expires")
      ?.value;

  const isActive =
    $("a-active")
      ?.checked !== false;

  if (
    !title ||
    !message
  ) {

    if (status) {

      status.textContent =
        "Completa título y mensaje.";

    }

    return;
  }

  if (status) {

    status.textContent =
      "Guardando aviso…";

  }

  const payload = {

    title,

    message,

    is_active:
      isActive,

    expires_at:
      expiresRaw
        ? new Date(
            expiresRaw
          ).toISOString()
        : null,

    published_at:
      new Date().toISOString(),

    metadata: {
      source:
        "admin"
    }

  };

  try {

    const wasEditing =
      Boolean(
        state.editingAnnouncement
      );

    let error;

    if (
      state.editingAnnouncement
    ) {

      ({
        error
      } =
        await supabase
          .from(
            "remote_announcements"
          )
          .update(
            payload
          )
          .eq(
            "id",
            state.editingAnnouncement
          ));

    } else {

      ({
        error
      } =
        await supabase
          .from(
            "remote_announcements"
          )
          .insert(
            payload
          ));
    }

    if (error) {
      throw error;
    }

    closeAnnouncement();

    await loadAnnouncements();

    toast(
      wasEditing
        ? "Aviso actualizado."
        : "Aviso publicado.",
      "success"
    );

  } catch (error) {

    console.error(
      "ANNOUNCEMENT SAVE ERROR:",
      error
    );

    if (status) {

      status.textContent =
        "No se pudo guardar. Revisa RLS y permisos de admin.";

    }

    toast(
      "No se pudo guardar el aviso.",
      "error"
    );
  }
}


async function toggleAnnouncement(
  id
) {

  const item =
    state.announcements.find(
      (x) =>
        String(x.id) ===
        String(id)
    );

  if (!item) {
    return;
  }

  const {
    error
  } =
    await supabase
      .from(
        "remote_announcements"
      )
      .update({
        is_active:
          item.is_active === false
      })
      .eq(
        "id",
        id
      );

  if (error) {

    console.error(
      "ANNOUNCEMENT TOGGLE ERROR:",
      error
    );

    toast(
      "No se pudo cambiar el estado.",
      "error"
    );

    return;
  }

  await loadAnnouncements();

  toast(
    item.is_active === false
      ? "Aviso activado."
      : "Aviso desactivado.",
    "success"
  );
}


async function deleteAnnouncement(
  id
) {

  if (
    !window.confirm(
      "¿Eliminar este aviso?"
    )
  ) {
    return;
  }

  const {
    error
  } =
    await supabase
      .from(
        "remote_announcements"
      )
      .delete()
      .eq(
        "id",
        id
      );

  if (error) {

    console.error(
      "ANNOUNCEMENT DELETE ERROR:",
      error
    );

    toast(
      "No se pudo eliminar el aviso.",
      "error"
    );

    return;
  }

  await loadAnnouncements();

  toast(
    "Aviso eliminado.",
    "success"
  );
}


function startAnnouncementRealtime() {

  if (
    state.announcementChannel
  ) {
    return;
  }

  state.announcementChannel =
    supabase
      .channel(
        "admin:remote_announcements"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "remote_announcements"
        },
        () =>
          loadAnnouncements()
      )
      .subscribe(
        (status) => {

          if (
            status ===
            "SUBSCRIBED"
          ) {

            setConnectionState(
              true,
              "Supabase conectado"
            );

          }

        }
      );
}


async function stopAnnouncementRealtime() {

  if (
    !state.announcementChannel
  ) {
    return;
  }

  await supabase.removeChannel(
    state.announcementChannel
  );

  state.announcementChannel =
    null;
}


function setConnectionState(
  online,
  label = "Supabase"
) {

  const pill =
    document.querySelector(
      ".connection-pill"
    );

  if (!pill) {
    return;
  }

  pill.classList.toggle(
    "offline",
    !online
  );

  pill.innerHTML =
    `<span></span>${esc(label)}`;
}


window.addEventListener(
  "online",
  () =>
    setConnectionState(
      true,
      "Supabase conectado"
    )
);


window.addEventListener(
  "offline",
  () =>
    setConnectionState(
      false,
      "Sin conexión"
    )
);


ensureAnnouncementUI();


setConnectionState(
  navigator.onLine,
  navigator.onLine
    ? "Supabase conectado"
    : "Sin conexión"
);


// ============================================================
// ESC KEY
// ============================================================

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Escape"
    ) {

      closeMobileMenu();

      if (
        !versionModal
          ?.classList.contains(
            "hidden"
          )
      ) {

        closeVersionModal();

      }

      if (
        !$("announcement-modal")
          ?.classList.contains(
            "hidden"
          )
      ) {

        closeAnnouncement();

      }
    }
  }
);


// ============================================================
// INITIAL VIEW
// ============================================================

view(
  "overview"
);


// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================

window.addEventListener(
  "unhandledrejection",
  (event) => {

    console.error(
      "UNHANDLED PROMISE:",
      event.reason
    );

  }
);


window.addEventListener(
  "error",
  (event) => {

    console.error(
      "GLOBAL ERROR:",
      event.error ||
      event.message
    );

  }
);


window.adminSupabase =
  supabase;