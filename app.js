(function () {
  const storageKey = "ava-chore-bank-v2";
  const today = () => toKey(new Date());
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const parentPin = "081116";
  const pokemonRoster = [
    { id: 143, name: "Snorlax" },
    { id: 7, name: "Squirtle" },
    { id: 133, name: "Eevee" },
    { id: 54, name: "Psyduck" },
    { id: 25, name: "Pikachu" },
    { id: 1, name: "Bulbasaur" },
    { id: 68, name: "Machamp" },
    { id: 39, name: "Jigglypuff" }
  ];

  const defaultChores = [
    { id: uid(), name: "Make bed", coins: 3, weeklyGoal: 5, weeklyBonus: 5, active: true, type: "power", cadence: "daily", pokemon: pokemonRoster[0] },
    { id: uid(), name: "Brush teeth morning and night", coins: 4, weeklyGoal: 7, weeklyBonus: 8, active: true, type: "water", cadence: "daily", pokemon: pokemonRoster[1] },
    { id: uid(), name: "Put toys away", coins: 5, weeklyGoal: 5, weeklyBonus: 10, active: true, type: "grass", cadence: "daily", pokemon: pokemonRoster[2] },
    { id: uid(), name: "Clear dishes", coins: 4, weeklyGoal: 5, weeklyBonus: 8, active: true, type: "water", cadence: "daily", pokemon: pokemonRoster[3] },
    { id: uid(), name: "Homework or reading", coins: 6, weeklyGoal: 5, weeklyBonus: 12, active: true, type: "electric", cadence: "daily", pokemon: pokemonRoster[4] },
    { id: uid(), name: "Feed the pet", coins: 5, weeklyGoal: 7, weeklyBonus: 10, active: false, type: "grass", cadence: "daily", pokemon: pokemonRoster[5] },
    { id: uid(), name: "Laundry day", coins: 15, weeklyGoal: 1, weeklyBonus: 0, active: true, type: "power", cadence: "weekly", pokemon: pokemonRoster[6] },
    { id: uid(), name: "Kind helper moment", coins: 4, weeklyGoal: 4, weeklyBonus: 8, active: true, type: "electric", cadence: "daily", pokemon: pokemonRoster[7] }
  ];

  const state = loadState();
  let parentUnlocked = false;
  syncCurrentDay();
  const els = {
    tabs: document.querySelectorAll(".tab-button"),
    panels: document.querySelectorAll("[data-panel]"),
    weekRange: document.querySelector("#weekRange"),
    weekProgress: document.querySelector("#weekProgress"),
    coinBalance: document.querySelector("#coinBalance"),
    dollarValue: document.querySelector("#dollarValue"),
    earnedToday: document.querySelector("#earnedToday"),
    earnedWeek: document.querySelector("#earnedWeek"),
    lostWeek: document.querySelector("#lostWeek"),
    todayChores: document.querySelector("#todayChores"),
    pendingApprovals: document.querySelector("#pendingApprovals"),
    choreCatalog: document.querySelector("#choreCatalog"),
    ledger: document.querySelector("#ledger"),
    addChoreForm: document.querySelector("#addChoreForm"),
    parentPinForm: document.querySelector("#parentPinForm"),
    parentPin: document.querySelector("#parentPin"),
    parentLockStatus: document.querySelector("#parentLockStatus"),
    penaltyForm: document.querySelector("#penaltyForm"),
    cashOutForm: document.querySelector("#cashOutForm"),
    coinsPerDollar: document.querySelector("#coinsPerDollar"),
    cashOutValue: document.querySelector("#cashOutValue"),
    resetTodayButton: document.querySelector("#resetTodayButton"),
    resetAllButton: document.querySelector("#resetAllButton"),
    todayTemplate: document.querySelector("#todayChoreTemplate"),
    catalogTemplate: document.querySelector("#catalogTemplate")
  };

  els.coinsPerDollar.value = state.settings.coinsPerDollar;

  els.tabs.forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.tab));
  });

  els.parentPinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    parentUnlocked = els.parentPin.value === parentPin;
    els.parentPin.value = "";
    render();
  });

  els.addChoreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#newChoreName").value.trim();
    const coins = readNumber("#newChoreCoins", 5);
    const weeklyGoal = readNumber("#newChoreGoal", 5);
    const weeklyBonus = readNumber("#newChoreBonus", 0);

    if (!name) return;

    state.chores.push({
      id: uid(),
      name,
      coins: clamp(coins, 1, 100),
      weeklyGoal: clamp(weeklyGoal, 1, 7),
      weeklyBonus: clamp(weeklyBonus, 0, 200),
      type: nextType(),
      cadence: "daily",
      pokemon: pokemonRoster[state.chores.length % pokemonRoster.length],
      active: true
    });
    els.addChoreForm.reset();
    document.querySelector("#newChoreCoins").value = 5;
    document.querySelector("#newChoreGoal").value = 5;
    document.querySelector("#newChoreBonus").value = 10;
    persistAndRender();
  });

  els.penaltyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = clamp(readNumber("#penaltyAmount", 5), 1, 500);
    const available = coinBalance();
    const actual = Math.min(amount, available);
    if (actual <= 0) return;

    addLedger({
      type: "penalty",
      coins: -actual,
      label: document.querySelector("#penaltyReason").value
    });
    persistAndRender();
  });

  els.cashOutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const rate = clamp(Number(els.coinsPerDollar.value) || 10, 1, 500);
    state.settings.coinsPerDollar = rate;
    const balance = coinBalance();
    if (balance <= 0) {
      persistAndRender();
      return;
    }
    addLedger({
      type: "cashout",
      coins: -balance,
      label: `Cashed out ${balance} coins for ${money.format(balance / rate)}`
    });
    persistAndRender();
  });

  els.coinsPerDollar.addEventListener("input", () => {
    state.settings.coinsPerDollar = clamp(Number(els.coinsPerDollar.value) || 10, 1, 500);
    persistAndRender();
  });

  els.resetTodayButton.addEventListener("click", () => {
    if (!confirm("Clear today's completed chores?")) return;
    const day = today();
    const todaysEarns = state.ledger.filter((entry) => entry.date === day && entry.type === "earn");
    todaysEarns.forEach((entry) => {
      addLedger({ type: "adjustment", coins: -entry.coins, label: `Cleared ${entry.label}` });
    });
    state.completions = state.completions.filter((item) => item.date !== day);
    state.pendingApprovals = state.pendingApprovals.filter((item) => item.date !== day);
    persistAndRender();
  });

  els.resetAllButton.addEventListener("click", () => {
    if (!confirm("Reset all chores, coins, penalties, and history?")) return;
    localStorage.removeItem(storageKey);
    location.reload();
  });

  function loadState() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      return {
        chores: migrateChores(defaultChores),
        completions: [],
        pendingApprovals: [],
        bonuses: [],
        ledger: [],
        settings: { coinsPerDollar: 10, lastOpenedDate: today() }
      };
    }

    try {
      const parsed = JSON.parse(saved);
      return {
        chores: migrateChores(Array.isArray(parsed.chores) ? parsed.chores : defaultChores),
        completions: Array.isArray(parsed.completions) ? parsed.completions : [],
        pendingApprovals: Array.isArray(parsed.pendingApprovals) ? parsed.pendingApprovals : [],
        bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [],
        ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
        settings: {
          coinsPerDollar: Number(parsed.settings?.coinsPerDollar) || 10,
          lastOpenedDate: parsed.settings?.lastOpenedDate || today()
        }
      };
    } catch {
      return {
        chores: migrateChores(defaultChores),
        completions: [],
        pendingApprovals: [],
        bonuses: [],
        ledger: [],
        settings: { coinsPerDollar: 10, lastOpenedDate: today() }
      };
    }
  }

  function migrateChores(chores) {
    return chores.map((chore) => {
      const isLaundry = chore.name === "Laundry in hamper" || chore.name === "Laundry day";
      if (!isLaundry) {
        return {
          ...chore,
          cadence: chore.cadence || "daily",
          pokemon: normalizePokemon(chore)
        };
      }
      return {
        ...chore,
        name: "Laundry day",
        coins: 15,
        weeklyGoal: 1,
        weeklyBonus: 0,
        type: "power",
        cadence: "weekly",
        pokemon: pokemonRoster[6]
      };
    });
  }

  function syncCurrentDay() {
    const currentDay = today();
    if (state.settings.lastOpenedDate !== currentDay) {
      state.settings.lastOpenedDate = currentDay;
      saveState();
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function persistAndRender() {
    awardWeeklyBonuses();
    saveState();
    render();
  }

  function selectTab(tabName) {
    els.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tabName));
    els.panels.forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.panel === tabName));
  }

  function render() {
    renderSummary();
    renderToday();
    renderApprovals();
    renderCatalog();
    renderLedger();
  }

  function renderSummary() {
    const week = currentWeek();
    const balance = coinBalance();
    const weekEntries = state.ledger.filter((entry) => inRange(entry.date, week.startKey, week.endKey));
    const todayEarned = state.ledger
      .filter((entry) => entry.date === today() && entry.coins > 0)
      .reduce((sum, entry) => sum + entry.coins, 0);
    const weekEarned = weekEntries.filter((entry) => entry.coins > 0).reduce((sum, entry) => sum + entry.coins, 0);
    const weekLost = Math.abs(
      weekEntries.filter((entry) => entry.coins < 0 && entry.type !== "cashout").reduce((sum, entry) => sum + entry.coins, 0)
    );
    const possible = state.chores
      .filter((chore) => chore.active)
      .reduce((sum, chore) => sum + chore.weeklyGoal, 0) || 1;
    const completed = state.completions.filter((item) => inRange(item.date, week.startKey, week.endKey)).length;

    els.weekRange.textContent = `${dateLabel.format(week.start)} - ${dateLabel.format(week.end)}`;
    els.weekProgress.style.width = `${Math.min(100, Math.round((completed / possible) * 100))}%`;
    els.coinBalance.textContent = balance;
    els.dollarValue.textContent = `${money.format(balance / state.settings.coinsPerDollar)} ready`;
    els.earnedToday.textContent = todayEarned;
    els.earnedWeek.textContent = weekEarned;
    els.lostWeek.textContent = weekLost;
    els.cashOutValue.textContent = money.format(balance / state.settings.coinsPerDollar);
  }

  function renderToday() {
    els.todayChores.innerHTML = "";
    const active = state.chores.filter((chore) => chore.active);
    if (!active.length) {
      els.todayChores.append(emptyState("Choose chores in the catalog to build today's list."));
      return;
    }

    active.forEach((chore) => {
      const done = completedForCadence(chore);
      const pending = pendingForCadence(chore);
      const weekCount = completionsThisWeek(chore.id);
      const node = els.todayTemplate.content.cloneNode(true);
      const row = node.querySelector(".chore-row");
      const title = node.querySelector("h3");
      const details = node.querySelector("p");
      const button = node.querySelector("button");
      const type = getChoreType(chore);
      const chip = typeChip(type);
      const pokemon = normalizePokemon(chore);

      row.classList.add(`type-${type}`);
      row.classList.toggle("is-done", done);
      row.classList.toggle("is-pending", pending);
      row.prepend(pokemonImage(pokemon, "pokemon-buddy"));
      title.before(chip);
      title.textContent = chore.name;
      details.textContent = choreDetails(chore, weekCount);
      button.textContent = choreButtonLabel(chore, done, pending);
      button.disabled = done || pending;
      button.addEventListener("click", () => requestChoreCheck(chore.id));
      els.todayChores.append(node);
    });
  }

  function renderApprovals() {
    els.parentLockStatus.textContent = parentUnlocked ? "Unlocked" : "Locked";
    els.parentLockStatus.classList.toggle("is-unlocked", parentUnlocked);
    els.pendingApprovals.innerHTML = "";
    const pending = state.pendingApprovals.filter((item) => !item.resolved);
    if (!pending.length) {
      els.pendingApprovals.append(emptyState("No chores waiting for review."));
      return;
    }

    pending.forEach((request) => {
      const chore = state.chores.find((item) => item.id === request.choreId);
      const row = document.createElement("article");
      row.className = "approval-row";
      row.innerHTML = `
        <time>${dateLabel.format(new Date(`${request.date}T12:00:00`))}</time>
        <span>${escapeHtml(chore?.name || "Deleted chore")} requested ${request.coins} coins</span>
        <div class="approval-actions">
          <button class="primary-button" type="button" data-action="approve">Approve</button>
          <button class="ghost-button" type="button" data-action="reject">Not yet</button>
        </div>
      `;
      row.querySelectorAll("button").forEach((button) => {
        button.disabled = !parentUnlocked;
      });
      row.querySelector('[data-action="approve"]').addEventListener("click", () => approveRequest(request.id));
      row.querySelector('[data-action="reject"]').addEventListener("click", () => rejectRequest(request.id));
      els.pendingApprovals.append(row);
    });
  }

  function renderCatalog() {
    els.choreCatalog.innerHTML = "";
    state.chores.forEach((chore) => {
      const node = els.catalogTemplate.content.cloneNode(true);
      const card = node.querySelector(".catalog-card");
      const title = node.querySelector("h3");
      const detail = node.querySelector("p");
      const toggle = node.querySelector("input");
      const type = getChoreType(chore);
      const pokemon = normalizePokemon(chore);

      card.classList.add(`type-${type}`);
      card.prepend(pokemonImage(pokemon, "catalog-pokemon"));
      title.before(typeChip(type));
      title.textContent = chore.name;
      detail.textContent = catalogDetails(chore);
      toggle.checked = chore.active;
      toggle.addEventListener("change", () => {
        chore.active = toggle.checked;
        persistAndRender();
      });
      card.querySelector('[data-action="edit"]').addEventListener("click", () => editChore(chore.id));
      card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteChore(chore.id));
      els.choreCatalog.append(node);
    });
  }

  function renderLedger() {
    els.ledger.innerHTML = "";
    if (!state.ledger.length) {
      els.ledger.append(emptyState("Coin activity will appear here."));
      return;
    }

    [...state.ledger].reverse().slice(0, 80).forEach((entry) => {
      const row = document.createElement("article");
      row.className = "ledger-entry";
      row.classList.toggle("is-negative", entry.coins < 0);
      const entryDate = new Date(`${entry.date}T12:00:00`);
      row.innerHTML = `
        <time>${dateLabel.format(entryDate)}</time>
        <span>${escapeHtml(entry.label)}</span>
        <strong>${entry.coins > 0 ? "+" : ""}${entry.coins}</strong>
      `;
      els.ledger.append(row);
    });
  }

  function requestChoreCheck(choreId) {
    const chore = state.chores.find((item) => item.id === choreId);
    if (!chore || completedForCadence(chore) || pendingForCadence(chore)) return;

    state.pendingApprovals.push({
      id: uid(),
      choreId,
      date: today(),
      coins: chore.coins,
      requestedAt: new Date().toISOString(),
      resolved: false
    });
    persistAndRender();
  }

  function approveRequest(requestId) {
    if (!parentUnlocked) return;
    const request = state.pendingApprovals.find((item) => item.id === requestId && !item.resolved);
    if (!request) return;
    const chore = state.chores.find((item) => item.id === request.choreId);
    if (!chore || completedForCadence(chore)) {
      request.resolved = true;
      persistAndRender();
      return;
    }
    request.resolved = true;
    state.completions.push({ choreId: request.choreId, date: request.date });
    addLedger({ type: "earn", choreId: request.choreId, coins: request.coins, label: chore.name, date: request.date });
    persistAndRender();
  }

  function rejectRequest(requestId) {
    if (!parentUnlocked) return;
    const request = state.pendingApprovals.find((item) => item.id === requestId && !item.resolved);
    if (!request) return;
    request.resolved = true;
    persistAndRender();
  }

  function editChore(choreId) {
    const chore = state.chores.find((item) => item.id === choreId);
    if (!chore) return;
    const name = prompt("Chore name", chore.name)?.trim();
    if (!name) return;
    const coins = Number(prompt("Daily coins", chore.coins));
    const goal = Number(prompt("Weekly goal days", chore.weeklyGoal));
    const bonus = Number(prompt("Weekly bonus coins", chore.weeklyBonus));

    chore.name = name;
    chore.coins = clamp(coins || chore.coins, 1, 100);
    chore.weeklyGoal = clamp(goal || chore.weeklyGoal, 1, 7);
    chore.weeklyBonus = clamp(bonus || chore.weeklyBonus, 0, 200);
    chore.type = chore.type || nextType();
    chore.cadence = chore.cadence || "daily";
    chore.pokemon = normalizePokemon(chore);
    persistAndRender();
  }

  function deleteChore(choreId) {
    const chore = state.chores.find((item) => item.id === choreId);
    if (!chore || !confirm(`Delete ${chore.name}?`)) return;
    state.chores = state.chores.filter((item) => item.id !== choreId);
    persistAndRender();
  }

  function awardWeeklyBonuses() {
    const week = currentWeek();
    state.chores.forEach((chore) => {
      if (chore.weeklyBonus <= 0) return;
      const alreadyAwarded = state.bonuses.some((item) => item.choreId === chore.id && item.weekStart === week.startKey);
      if (alreadyAwarded || completionsThisWeek(chore.id) < chore.weeklyGoal) return;
      state.bonuses.push({ choreId: chore.id, weekStart: week.startKey });
      addLedger({ type: "bonus", choreId: chore.id, coins: chore.weeklyBonus, label: `${chore.name} weekly bonus` });
    });
  }

  function addLedger(entry) {
    state.ledger.push({
      id: uid(),
      date: entry.date || today(),
      ...entry
    });
  }

  function coinBalance() {
    return Math.max(0, state.ledger.reduce((sum, entry) => sum + entry.coins, 0));
  }

  function completedToday(choreId) {
    return state.completions.some((item) => item.choreId === choreId && item.date === today());
  }

  function completedForCadence(chore) {
    if (chore.cadence === "weekly") {
      return completionsThisWeek(chore.id) > 0;
    }
    return completedToday(chore.id);
  }

  function pendingForCadence(chore) {
    return state.pendingApprovals.some((item) => {
      if (item.choreId !== chore.id || item.resolved) return false;
      if (chore.cadence === "weekly") {
        const week = currentWeek();
        return inRange(item.date, week.startKey, week.endKey);
      }
      return item.date === today();
    });
  }

  function completionsThisWeek(choreId) {
    const week = currentWeek();
    return state.completions.filter((item) => item.choreId === choreId && inRange(item.date, week.startKey, week.endKey)).length;
  }

  function currentWeek() {
    const now = new Date();
    const start = new Date(now);
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start,
      end,
      startKey: toKey(start),
      endKey: toKey(end)
    };
  }

  function toKey(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function inRange(dateKey, startKey, endKey) {
    return dateKey >= startKey && dateKey <= endKey;
  }

  function readNumber(selector, fallback) {
    return Number(document.querySelector(selector).value) || fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function emptyState(text) {
    const node = document.createElement("div");
    node.className = "empty-state";
    node.textContent = text;
    return node;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getChoreType(chore) {
    if (["power", "water", "grass", "electric"].includes(chore.type)) return chore.type;
    const index = state.chores.findIndex((item) => item.id === chore.id);
    return ["power", "water", "grass", "electric"][Math.max(0, index) % 4];
  }

  function nextType() {
    return ["power", "water", "grass", "electric"][state.chores.length % 4];
  }

  function typeChip(type) {
    const chip = document.createElement("span");
    chip.className = `type-chip type-${type}`;
    chip.textContent = type;
    return chip;
  }

  function normalizePokemon(chore) {
    if (chore.pokemon && Number(chore.pokemon.id) && chore.pokemon.name) {
      return { id: Number(chore.pokemon.id), name: chore.pokemon.name };
    }
    const index = state.chores.findIndex((item) => item.id === chore.id);
    return pokemonRoster[Math.max(0, index) % pokemonRoster.length];
  }

  function pokemonArtwork(id) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  function pokemonImage(pokemon, className) {
    const image = document.createElement("img");
    image.className = className;
    image.src = pokemonArtwork(pokemon.id);
    image.alt = pokemon.name;
    image.loading = "lazy";
    return image;
  }

  function choreDetails(chore, weekCount) {
    if (chore.cadence === "weekly") {
      return `${chore.coins} coins once per week; ${weekCount}/${chore.weeklyGoal} done this week`;
    }
    return `${chore.coins} coins today; ${weekCount}/${chore.weeklyGoal} toward ${chore.weeklyBonus} bonus`;
  }

  function catalogDetails(chore) {
    if (chore.cadence === "weekly") {
      return `${chore.coins} coins, once per week`;
    }
    return `${chore.coins} daily coins, ${chore.weeklyBonus} bonus coins after ${chore.weeklyGoal} days`;
  }

  function doneLabel(chore) {
    return chore.cadence === "weekly" ? "Done this week" : "Done today";
  }

  function choreButtonLabel(chore, done, pending) {
    if (done) return doneLabel(chore);
    if (pending) return "Waiting for check";
    return "Request check";
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  render();
})();
