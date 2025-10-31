/** DOM要素の取得 */
const patternInput = document.getElementById("pattern");
const redirectInput = document.getElementById("redirect");
const addRuleBtn = document.getElementById("addRule");
const rulesList = document.getElementById("rulesList");
const statusDiv = document.getElementById("status");
const statusMessage = document.getElementById("statusMessage");
const syncToggle = document.getElementById("syncToggle");

/** 言語設定の保存キー */
const LANGUAGE_KEY = "userLanguage";

/** 現在の言語設定 */
let currentLanguage = "ja_AW";

/** 翻訳辞書 */
let messages = {};

/**
 * 言語ファイルを読み込む
 * @param {string} lang - 言語コード
 */
async function loadLanguage(lang) {
  try {
    const response = await fetch(`_locales/${lang}/messages.json`);
    messages = await response.json();
    currentLanguage = lang;
  } catch (error) {
    console.error(`Failed to load language: ${lang}`, error);
    // フォールバック
    const fallbackResponse = await fetch(`_locales/ja/messages.json`);
    messages = await fallbackResponse.json();
    currentLanguage = "ja_AW";
  }
}

/**
 * i18nメッセージを取得するヘルパー関数
 * @param {string} messageName - メッセージ名
 * @returns {string} ローカライズされたメッセージ
 */
function i18n(messageName) {
  return messages[messageName]?.message || messageName;
}

/**
 * ページ内のすべてのi18n要素を翻訳する
 */
function translatePage() {
  // data-i18n属性を持つ要素のテキストを翻訳
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const messageName = element.getAttribute("data-i18n");
    element.textContent = i18n(messageName);
  });

  // data-i18n-placeholder属性を持つ要素のプレースホルダーを翻訳
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const messageName = element.getAttribute("data-i18n-placeholder");
    element.placeholder = i18n(messageName);
  });
}

/**
 * 現在のストレージタイプを取得する
 * @param {Function} callback - ストレージオブジェクトを受け取るコールバック
 */
function getStorage(callback) {
  chrome.storage.local.get(["useSync"], (result) => {
    const storage =
      result.useSync !== false ? chrome.storage.sync : chrome.storage.local;
    callback(storage);
  });
}

/**
 * ステータスメッセージを表示する
 * @param {string} message - 表示するメッセージ
 * @param {boolean} isError - エラーメッセージの場合true
 */
function showStatus(message, isError = false) {
  const icon = isError
    ? '<i class="bi bi-exclamation-circle-fill alert-icon"></i>'
    : '<i class="bi bi-check-circle-fill alert-icon"></i>';

  statusMessage.innerHTML = icon + message;
  statusDiv.className = `alert alert-dismissible fade show ${
    isError ? "alert-danger" : "alert-success"
  }`;
  statusDiv.style.display = "block";

  setTimeout(() => {
    statusDiv.style.display = "none";
  }, 5000);
}

/**
 * 登録されているリダイレクトルールを画面に表示する
 */
function displayRules() {
  getStorage((storage) => {
    storage.get(["redirectRules"], (result) => {
      const rules = result.redirectRules || [];

      if (rules.length === 0) {
        rulesList.innerHTML = `<div class="empty-message"><i class="bi bi-inbox"></i><br>${i18n(
          "noRules"
        )}</div>`;
        return;
      }

      rulesList.innerHTML = rules
        .map(
          (rule, index) => `
      <div class="rule-item ${rule.enabled ? "" : "disabled"}">
        <div class="rule-header">
          <div class="rule-toggle">
            <div class="form-check form-switch">
              <input class="form-check-input toggle-rule" type="checkbox" 
                     ${rule.enabled ? "checked" : ""} 
                     data-id="${rule.id}" id="switch-${rule.id}">
              <label class="form-check-label" for="switch-${rule.id}">
                <span class="badge ${
                  rule.enabled ? "bg-success" : "bg-secondary"
                }">
                  ${rule.enabled ? i18n("enabled") : i18n("disabled")}
                </span>
              </label>
            </div>
          </div>
          <div class="rule-actions">
            <button class="btn btn-danger btn-sm delete-rule" data-id="${
              rule.id
            }">
              <i class="bi bi-trash"></i> ${i18n("deleteButton")}
            </button>
          </div>
        </div>
        <div class="rule-content">
          <div class="mb-1">
            <strong><i class="bi bi-search"></i> ${i18n("pattern")}</strong><br>
            <span class="rule-pattern">${escapeHtml(rule.pattern)}</span>
          </div>
          <div>
            <strong><i class="bi bi-arrow-right-circle"></i> ${i18n(
              "redirectTo"
            )}</strong><br>
            <span class="rule-redirect">${escapeHtml(rule.redirect)}</span>
          </div>
        </div>
      </div>
    `
        )
        .join("");

      /** イベントリスナーを追加 */
      document.querySelectorAll(".delete-rule").forEach((btn) => {
        btn.addEventListener("click", deleteRule);
      });

      document.querySelectorAll(".toggle-rule").forEach((checkbox) => {
        checkbox.addEventListener("change", toggleRule);
      });
    });
  });
}

/**
 * HTMLテキストをエスケープする
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたHTML文字列
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 新しいリダイレクトルールを追加する
 */
function addRule() {
  const pattern = patternInput.value.trim();
  const redirect = redirectInput.value.trim();

  if (!pattern || !redirect) {
    showStatus(i18n("errorBothRequired"), true);
    return;
  }

  /** URLの検証 */
  try {
    new URL(redirect);
  } catch (e) {
    showStatus(i18n("errorInvalidUrl"), true);
    return;
  }

  getStorage((storage) => {
    storage.get(["redirectRules"], (result) => {
      const rules = result.redirectRules || [];

      const newRule = {
        id: Date.now(),
        pattern: pattern,
        redirect: redirect,
        enabled: true,
      };

      rules.push(newRule);

      storage.set({ redirectRules: rules }, () => {
        showStatus(i18n("successAddRule"));
        patternInput.value = "";
        redirectInput.value = "";
        displayRules();
      });
    });
  });
}

/**
 * 指定されたリダイレクトルールを削除する
 * @param {Event} e - クリックイベント
 */
function deleteRule(e) {
  const ruleId = parseInt(e.target.dataset.id);

  getStorage((storage) => {
    storage.get(["redirectRules"], (result) => {
      const rules = result.redirectRules || [];
      const filteredRules = rules.filter((rule) => rule.id !== ruleId);

      storage.set({ redirectRules: filteredRules }, () => {
        showStatus(i18n("successDeleteRule"));
        displayRules();
      });
    });
  });
}

/**
 * ルールの有効/無効を切り替える
 * @param {Event} e - チェンジイベント
 */
function toggleRule(e) {
  const ruleId = parseInt(e.target.dataset.id);
  const isEnabled = e.target.checked;

  getStorage((storage) => {
    storage.get(["redirectRules"], (result) => {
      const rules = result.redirectRules || [];
      const rule = rules.find((r) => r.id === ruleId);

      if (rule) {
        rule.enabled = isEnabled;

        storage.set({ redirectRules: rules }, () => {
          showStatus(
            i18n(isEnabled ? "successEnableRule" : "successDisableRule")
          );
          displayRules();
        });
      }
    });
  });
}

/**
 * ストレージ設定を初期化する
 */
function initStorageSettings() {
  chrome.storage.local.get(["useSync"], (result) => {
    syncToggle.checked = result.useSync !== false; // デフォルトはtrue
    updateSyncToggleLabel(result.useSync !== false);
    displayRules();
  });
}

/**
 * ストレージタイプを切り替える
 */
function toggleStorageType() {
  const useSync = syncToggle.checked;

  chrome.storage.local.set({ useSync: useSync }, () => {
    updateSyncToggleLabel(useSync);
    showStatus(
      i18n(useSync ? "successChangeSyncMode" : "successChangeLocalMode")
    );
    displayRules();
  });
}

/**
 * 同期トグルのラベルを更新する
 * @param {boolean} useSync - 同期モードかどうか
 */
function updateSyncToggleLabel(useSync) {
  const label = document.querySelector('label[for="syncToggle"]');
  const icon = useSync ? "bi-cloud-check" : "bi-hdd";
  const mainText = i18n(useSync ? "useSyncStorage" : "useLocalStorage");
  const helpText = i18n(useSync ? "syncStorageHelp" : "localStorageHelp");

  label.innerHTML = `<i class="bi ${icon}"></i> ${mainText}<br><small class="text-muted">${helpText}</small>`;
}

/**
 * 言語を切り替える
 * @param {string} lang - 言語コード
 */
async function changeLanguage(lang) {
  await loadLanguage(lang);
  chrome.storage.local.set({ [LANGUAGE_KEY]: lang });
  translatePage();

  // 同期トグルのラベルを更新
  chrome.storage.local.get(["useSync"], (result) => {
    updateSyncToggleLabel(result.useSync !== false);
  });

  // 言語切り替え通知を表示
  showStatus(i18n("successChangeLanguage"));

  displayRules();
}

/**
 * 保存された言語設定を読み込む
 */
async function initLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LANGUAGE_KEY], async (result) => {
      const lang = result[LANGUAGE_KEY] || "ja";
      await loadLanguage(lang);

      // ラジオボタンを選択状態にする
      const radioBtn = document.getElementById(
        `lang-${lang.replace("_", "-").toLowerCase()}`
      );
      if (radioBtn) {
        radioBtn.checked = true;
      }

      resolve();
    });
  });
}

/** イベントリスナーの登録 */
addRuleBtn.addEventListener("click", addRule);
syncToggle.addEventListener("change", toggleStorageType);

/** Enterキーでルールを追加 */
redirectInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addRule();
  }
});

/** Enterキーでリダイレクト先の入力欄へフォーカス移動 */
patternInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    redirectInput.focus();
  }
});

/** 言語切り替えボタンのイベントリスナー */
document.querySelectorAll('input[name="language"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    changeLanguage(e.target.value);
  });
});

/** 初期化処理 */
(async () => {
  await initLanguage();
  translatePage();
  initStorageSettings();
})();
